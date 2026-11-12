/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('invoices', 'cancel_reason');
    if (!hasColumn) {
        await knex.schema.alterTable('invoices', function (table) {
            table.text('cancel_reason').nullable();
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('invoices', 'cancel_reason');
    if (hasColumn) {
        await knex.schema.alterTable('invoices', function (table) {
            table.dropColumn('cancel_reason');
        });
    }
};
