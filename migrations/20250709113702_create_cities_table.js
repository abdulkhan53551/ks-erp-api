/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("city", function (table) {
    table.increments("id").primary();

    table.string("name").notNullable();

    table
      .integer("state_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("state")
      .onDelete("CASCADE");

    table.boolean("is_active").defaultTo(true).notNullable();

    // 👇 audit fields
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
  return knex.schema.dropTableIfExists("city");
};
