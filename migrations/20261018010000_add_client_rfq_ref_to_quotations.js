/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasCol = await knex.schema.hasColumn('quotations', 'client_rfq_ref');
    if (!hasCol) {
        await knex.schema.alterTable('quotations', function (table) {
            table.string('client_rfq_ref', 150).nullable();
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasCol = await knex.schema.hasColumn('quotations', 'client_rfq_ref');
    if (hasCol) {
        await knex.schema.alterTable('quotations', function (table) {
            table.dropColumn('client_rfq_ref');
        });
    }
};
