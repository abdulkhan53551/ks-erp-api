// db/knexpatch.js
const { getContext } = require("./requestContext");

function patchKnex(knex) {
  const proto = Object.getPrototypeOf(knex.queryBuilder());
  const ignoredTables = [
    "knex_migrations",
    "knex_migrations_lock",
    "policies",
  ];

  // PATCH: .insert()
  const originalInsert = proto.insert;
  proto.insert = function (data, returning) {
    const now = new Date();
    const { userId = 0 } = getContext();
    const tableName = this._single?.table;

    // Skip patching knex_migrations_lock table
    if (!ignoredTables.includes(tableName)) {
      if (Array.isArray(data)) {
        data = data.map((record) => ({
          ...record,
          created_at: record.created_at || now,
          updated_at: record.updated_at || now,
          created_by: record.created_by || (userId ? userId : null),
          updated_by: record.updated_by || (userId ? userId : null),
          is_active: record.is_active !== undefined ? record.is_active : true,
        }));
      } else {
        data = {
          ...data,
          created_at: data.created_at || now,
          updated_at: data.updated_at || now,
          created_by: data.created_by || (userId ? userId : null),
          updated_by: data.updated_by || (userId ? userId : null),
          is_active: data.is_active !== undefined ? data.is_active : true,
        };
      }
    }

    return originalInsert.call(this, data, returning);
  };

  // PATCH: .update()
  const originalUpdate = proto.update;
  proto.update = function (data, returning) {
    const now = new Date();
    const { userId = 0 } = getContext();
    const tableName = this._single?.table;

    // Skip patching knex_migrations_lock table
    if (!ignoredTables.includes(tableName)) {
      if (typeof data === 'object' && data !== null) {
        data = {
          ...data,
          updated_at: now,
          updated_by: data.updated_by !== undefined ? data.updated_by : (userId ? userId : null),
        };

        // If soft-deleting (moving to trash)
        if (data.is_active === false && data.deleted_at === undefined) {
          data.deleted_at = now;
          data.deleted_by = data.deleted_by !== undefined ? data.deleted_by : (userId ? userId : null);
        }

        // If restoring from trash
        if (data.is_active === true && data.deleted_at === undefined) {
          data.deleted_at = null;
          data.deleted_by = null;
        }
      }
    }

    return originalUpdate.call(this, data, returning);
  };
}

// PATCH: Add default columns to existing tables
function addDefaultColumns(table, knex) {
  table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  table.timestamp('deleted_at').nullable();
  table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  table.integer('deleted_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  table.boolean('is_active').notNullable().defaultTo(true);
}

module.exports = { patchKnex, addDefaultColumns };