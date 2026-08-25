/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable("parties", function (table) {
        table.string("logo_url", 500).nullable();
        table.string("logo_public_id", 255).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable("parties", function (table) {
        table.dropColumn("logo_url");
        table.dropColumn("logo_public_id");
    });
};
