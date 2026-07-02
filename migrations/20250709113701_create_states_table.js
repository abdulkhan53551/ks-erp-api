/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("state", function (table) {
    table.increments("id").primary();

    table.string("name").notNullable();

    table.boolean("is_active").defaultTo(true).notNullable();

    table
      .integer("created_by")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    table
      .integer("updated_by")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("state");
};