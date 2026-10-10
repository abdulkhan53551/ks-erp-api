/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const transactionTables = [
        'invoices',
        'purchase_orders',
        'invoice_challans',
        'payments',
        'vendor_bills'
    ];

    for (const tableName of transactionTables) {
        if (await knex.schema.hasTable(tableName)) {
            const hasCol = await knex.schema.hasColumn(tableName, 'firm_branch_id');
            if (!hasCol) {
                await knex.schema.alterTable(tableName, function (table) {
                    table.integer('firm_branch_id')
                        .unsigned()
                        .nullable()
                        .references('id')
                        .inTable('firm_branches')
                        .onDelete('RESTRICT');

                    table.index(['firm_id', 'firm_branch_id'], `idx_${tableName}_firm_branch`);
                });

                // Backfill existing transactions with the firm's default Head Office branch
                const headOffices = await knex('firm_branches')
                    .where({ is_head_office: true })
                    .select('id', 'firm_id');

                for (const ho of headOffices) {
                    await knex(tableName)
                        .where({ firm_id: ho.firm_id })
                        .whereNull('firm_branch_id')
                        .update({ firm_branch_id: ho.id });
                }

                // If any records still have NULL (e.g. firm had no explicit HO marked), fallback to any branch of that firm
                const allBranches = await knex('firm_branches').select('id', 'firm_id');
                for (const b of allBranches) {
                    await knex(tableName)
                        .where({ firm_id: b.firm_id })
                        .whereNull('firm_branch_id')
                        .update({ firm_branch_id: b.id });
                }
            }
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const transactionTables = [
        'invoices',
        'purchase_orders',
        'invoice_challans',
        'payments',
        'vendor_bills'
    ];

    for (const tableName of transactionTables) {
        if (await knex.schema.hasTable(tableName)) {
            const hasCol = await knex.schema.hasColumn(tableName, 'firm_branch_id');
            if (hasCol) {
                await knex.schema.alterTable(tableName, function (table) {
                    table.dropColumn('firm_branch_id');
                });
            }
        }
    }
};
