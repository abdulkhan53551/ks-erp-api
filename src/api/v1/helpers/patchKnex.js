// db/knexpatch.js
const { getContext } = require("./requestContext");

function patchKnex(knex) {
  const proto = Object.getPrototypeOf(knex.queryBuilder());

  // PATCH: .insert()
  const originalInsert = proto.insert;
  proto.insert = function (data, returning) {
    const now = new Date();
    const { userId = 0 } = getContext();
    const tableName = this._single?.table;

    // Skip patching knex_migrations_lock table
    if (tableName !== 'knex_migrations_lock' && tableName !== 'policies') {
      if (Array.isArray(data)) {
        data = data.map((record) => ({
          ...record,
          created_at: record.created_at || now,
          updated_at: record.updated_at || now,
          created_by: record.created_by || userId,
          updated_by: record.updated_by || userId,
          is_active: record.is_active !== undefined ? record.is_active : true,
        }));
      } else {
        data = {
          ...data,
          created_at: data.created_at || now,
          updated_at: data.updated_at || now,
          created_by: data.created_by || userId,
          updated_by: data.updated_by || userId,
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
    if (tableName !== 'knex_migrations_lock' && tableName !== 'policies') {
      if (typeof data === 'object' && data !== null) {
        data = {
          ...data,
          updated_at: now,
          updated_by: userId,
        };
      }
    }

    return originalUpdate.call(this, data, returning);
  };
}

// PATCH: Add default columns to existing tables
function addDefaultColumns(table, knex) {
  table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  table.boolean('isactive').defaultTo(true);
}

module.exports = { patchKnex };