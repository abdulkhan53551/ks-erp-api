/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (await knex.schema.hasTable('role_permissions')) {
        const hasFirmId = await knex.schema.hasColumn('role_permissions', 'firm_id');
        if (!hasFirmId) {
            // 1. Add firm_id column as nullable initially
            await knex.schema.alterTable('role_permissions', function (table) {
                table.integer('firm_id').unsigned().nullable().references('id').inTable('firms').onDelete('CASCADE');
            });

            // 2. Backfill existing rows with first available firm_id
            const firstFirm = await knex('firms').orderBy('id', 'asc').first();
            const defaultFirmId = firstFirm?.id || 1;

            await knex('role_permissions').whereNull('firm_id').update({ firm_id: defaultFirmId });

            // 3. Drop old unique constraint on (role_id, permission_id) BEFORE adding new entries
            await knex.raw(`
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_id_permission_id_unique') THEN
                        ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_role_id_permission_id_unique;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_firm_role_permission') THEN
                        ALTER TABLE role_permissions ADD CONSTRAINT uq_firm_role_permission UNIQUE (firm_id, role_id, permission_id);
                    END IF;
                END $$;
            `);

            // 4. Replicate baseline permissions for any other existing firms
            const otherFirms = await knex('firms').whereNot({ id: defaultFirmId }).select('id');
            const basePermissions = await knex('role_permissions').where({ firm_id: defaultFirmId });

            for (const firm of otherFirms) {
                for (const bp of basePermissions) {
                    const exists = await knex('role_permissions').where({
                        firm_id: firm.id,
                        role_id: bp.role_id,
                        permission_id: bp.permission_id
                    }).first();

                    if (!exists) {
                        await knex('role_permissions').insert({
                            firm_id: firm.id,
                            role_id: bp.role_id,
                            permission_id: bp.permission_id,
                            is_active: bp.is_active
                        });
                    }
                }
            }

            // 5. Make firm_id NOT NULL and add index
            await knex.schema.alterTable('role_permissions', function (table) {
                table.integer('firm_id').unsigned().notNullable().alter();
                table.index(['firm_id', 'role_id', 'is_active'], 'idx_role_permissions_firm_role_active');
            });
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('role_permissions')) {
        const firstFirm = await knex('firms').orderBy('id', 'asc').first();
        const defaultFirmId = firstFirm?.id || 1;

        // Delete replicated permissions for other firms so (role_id, permission_id) has no duplicates
        await knex('role_permissions').whereNot({ firm_id: defaultFirmId }).del();

        await knex.raw(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_firm_role_permission') THEN
                    ALTER TABLE role_permissions DROP CONSTRAINT uq_firm_role_permission;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_id_permission_id_unique') THEN
                    ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_permission_id_unique UNIQUE (role_id, permission_id);
                END IF;
            END $$;
        `);

        const hasFirmId = await knex.schema.hasColumn('role_permissions', 'firm_id');
        if (hasFirmId) {
            await knex.schema.alterTable('role_permissions', function (table) {
                table.dropColumn('firm_id');
            });
        }
    }
};
