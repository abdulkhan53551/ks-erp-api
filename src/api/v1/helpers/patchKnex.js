// db/knexpatch.js
const { getContext } = require("./requestContext");

function patchKnex(knex) {
  const proto = Object.getPrototypeOf(knex.queryBuilder());

  // PATCH: .insert()
  const originalInsert = proto.insert;
  proto.insert = function (data, returning) {
    const now = new Date();
    const { userId = 0 } = getContext();

    // Skip patching knex_migrations_lock table
    if (this.tableName !== 'knex_migrations_lock') {
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

    // Skip patching knex_migrations_lock table
    if (this.tableName !== 'knex_migrations_lock') {
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

module.exports = { patchKnex };