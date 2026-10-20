/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasCol = await knex.schema.hasColumn('quotations', 'include_annexure');
    if (!hasCol) {
        await knex.schema.alterTable('quotations', function (table) {
            table.boolean('include_annexure').notNullable().defaultTo(true);
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasCol = await knex.schema.hasColumn('quotations', 'include_annexure');
    if (hasCol) {
        await knex.schema.alterTable('quotations', function (table) {
            table.dropColumn('include_annexure');
        });
    }
};
