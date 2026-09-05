/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (await knex.schema.hasTable('invoice_items')) {
        await knex.schema.alterTable('invoice_items', function (table) {
            table.integer('product_id').unsigned().nullable().index()
                .references('id').inTable('products').onDelete('SET NULL');
        });
    }

    if (await knex.schema.hasTable('purchase_order_items')) {
        await knex.schema.alterTable('purchase_order_items', function (table) {
            table.integer('product_id').unsigned().nullable().index()
                .references('id').inTable('products').onDelete('SET NULL');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('invoice_items')) {
        await knex.schema.alterTable('invoice_items', function (table) {
            table.dropColumn('product_id');
        });
    }

    if (await knex.schema.hasTable('purchase_order_items')) {
        await knex.schema.alterTable('purchase_order_items', function (table) {
            table.dropColumn('product_id');
        });
    }
};
