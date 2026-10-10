/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (await knex.schema.hasTable('roles')) {
        const hasParentRole = await knex.schema.hasColumn('roles', 'parent_role_id');
        const hasDataScope = await knex.schema.hasColumn('roles', 'data_scope');
        const hasIsIndependent = await knex.schema.hasColumn('roles', 'is_independent');

        await knex.schema.alterTable('roles', function (table) {
            if (!hasParentRole) {
                table.integer('parent_role_id')
                    .nullable()
                    .references('id')
                    .inTable('roles')
                    .onDelete('SET NULL');
                table.index(['parent_role_id'], 'idx_roles_parent_role_id');
            }

            if (!hasDataScope) {
                table.string('data_scope', 30)
                    .notNullable()
                    .defaultTo('OWN');
            }

            if (!hasIsIndependent) {
                table.boolean('is_independent')
                    .notNullable()
                    .defaultTo(false);
            }
        });

        // Backfill baseline role hierarchy and data scope for default system roles
        const existingRoles = await knex('roles').select('id', 'slug');
        const roleBySlug = {};
        for (const r of existingRoles) {
            roleBySlug[r.slug] = r.id;
        }

        const superAdminId = roleBySlug['super-admin'] || null;
        const adminId = roleBySlug['administrator'] || superAdminId;
        const managerId = roleBySlug['manager'] || adminId;
        const supervisorId = roleBySlug['supervisor'] || managerId;

        // 1. Super Admin: Global scope, no parent
        if (superAdminId) {
            await knex('roles')
                .where({ id: superAdminId })
                .update({ parent_role_id: null, data_scope: 'GLOBAL', is_independent: false });
        }

        // 2. Administrator: Firm-wide scope, parent is Super Admin
        if (roleBySlug['administrator']) {
            await knex('roles')
                .where({ id: roleBySlug['administrator'] })
                .update({ parent_role_id: superAdminId, data_scope: 'FIRM', is_independent: false });
        }

        // 3. Manager: Branch-wide scope, parent is Administrator
        if (roleBySlug['manager']) {
            await knex('roles')
                .where({ id: roleBySlug['manager'] })
                .update({ parent_role_id: adminId, data_scope: 'BRANCH', is_independent: false });
        }

        // 4. Supervisor: Descendant roles scope, parent is Manager
        if (roleBySlug['supervisor']) {
            await knex('roles')
                .where({ id: roleBySlug['supervisor'] })
                .update({ parent_role_id: managerId, data_scope: 'DESCENDANTS', is_independent: false });
        }

        // 5. Employee: Own records only, parent is Supervisor
        if (roleBySlug['employee']) {
            await knex('roles')
                .where({ id: roleBySlug['employee'] })
                .update({ parent_role_id: supervisorId, data_scope: 'OWN', is_independent: false });
        }

        // 6. Auditor: Independent compliance role, Firm scope, parent is Administrator
        if (roleBySlug['auditor']) {
            await knex('roles')
                .where({ id: roleBySlug['auditor'] })
                .update({ parent_role_id: adminId, data_scope: 'FIRM', is_independent: true });
        }

        // 7. Viewer: Firm read-only scope, parent is Administrator
        if (roleBySlug['viewer']) {
            await knex('roles')
                .where({ id: roleBySlug['viewer'] })
                .update({ parent_role_id: adminId, data_scope: 'FIRM', is_independent: false });
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('roles')) {
        await knex.schema.alterTable('roles', function (table) {
            table.dropColumn('parent_role_id');
            table.dropColumn('data_scope');
            table.dropColumn('is_independent');
        });
    }
};
