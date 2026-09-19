/**
 * Migration to move operational data scope from roles table to user_firm_branches table.
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Add data_scope column to user_firm_branches if it doesn't already exist
    const hasUfbDataScope = await knex.schema.hasColumn('user_firm_branches', 'data_scope');
    if (!hasUfbDataScope) {
        await knex.schema.alterTable('user_firm_branches', function (table) {
            table.string('data_scope', 30)
                .notNullable()
                .defaultTo('BRANCH');
            table.index(['data_scope'], 'idx_user_firm_branches_data_scope');
        });
    }

    // 2. Backfill existing user_firm_branches with data_scope:
    // If roles table still has data_scope, backfill from role; otherwise fallback to FIRM if null branch, else BRANCH
    const hasRolesDataScope = await knex.schema.hasColumn('roles', 'data_scope');
    if (hasRolesDataScope) {
        await knex.raw(`
            UPDATE user_firm_branches ufb
            SET data_scope = COALESCE(
                r.data_scope,
                CASE WHEN ufb.firm_branch_id IS NULL THEN 'FIRM' ELSE 'BRANCH' END
            )
            FROM roles r
            WHERE ufb.role_id = r.id
        `);
    } else {
        await knex.raw(`
            UPDATE user_firm_branches
            SET data_scope = CASE WHEN firm_branch_id IS NULL THEN 'FIRM' ELSE 'BRANCH' END
        `);
    }

    // 3. Drop data_scope column from roles table
    if (hasRolesDataScope) {
        await knex.schema.alterTable('roles', function (table) {
            table.dropColumn('data_scope');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // 1. Restore data_scope column to roles
    const hasRolesDataScope = await knex.schema.hasColumn('roles', 'data_scope');
    if (!hasRolesDataScope) {
        await knex.schema.alterTable('roles', function (table) {
            table.string('data_scope', 30)
                .notNullable()
                .defaultTo('OWN');
        });

        // Re-seed default scopes based on role slugs
        await knex('roles').whereRaw('LOWER(slug) = ?', ['super-admin']).update({ data_scope: 'GLOBAL' });
        await knex('roles').whereRaw('LOWER(slug) = ?', ['administrator']).update({ data_scope: 'FIRM' });
        await knex('roles').whereRaw('LOWER(slug) = ?', ['manager']).update({ data_scope: 'BRANCH' });
        await knex('roles').whereRaw('LOWER(slug) = ?', ['supervisor']).update({ data_scope: 'DESCENDANTS' });
        await knex('roles').whereRaw('LOWER(slug) = ?', ['employee']).update({ data_scope: 'OWN' });
        await knex('roles').whereRaw('LOWER(slug) = ?', ['auditor']).update({ data_scope: 'FIRM' });
        await knex('roles').whereRaw('LOWER(slug) = ?', ['viewer']).update({ data_scope: 'FIRM' });
    }

    // 2. Drop data_scope from user_firm_branches
    const hasUfbDataScope = await knex.schema.hasColumn('user_firm_branches', 'data_scope');
    if (hasUfbDataScope) {
        await knex.schema.alterTable('user_firm_branches', function (table) {
            table.dropIndex(['data_scope'], 'idx_user_firm_branches_data_scope');
            table.dropColumn('data_scope');
        });
    }
};
