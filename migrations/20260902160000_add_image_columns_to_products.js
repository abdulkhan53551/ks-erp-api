/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (await knex.schema.hasTable('products')) {
        await knex.schema.alterTable('products', function (table) {
            table.string('image_url', 500).nullable();
            table.string('image_public_id', 255).nullable();
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('products')) {
        await knex.schema.alterTable('products', function (table) {
            table.dropColumn('image_url');
            table.dropColumn('image_public_id');
        });
    }
};
