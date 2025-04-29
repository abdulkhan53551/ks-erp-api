function patchKnex(knex) {
    // Safely access the prototype of the query builder
    const proto = Object.getPrototypeOf(knex.queryBuilder());
  
    // PATCH: .insert()
    const originalInsert = proto.insert;
    proto.insert = function (data, returning) {
      const now = new Date();
  
      if (Array.isArray(data)) {
        data = data.map((record) => ({
          ...record,
          created_at: record.created_at || now,
          updated_at: record.updated_at || now,
          is_active: record.is_active !== undefined ? record.is_active : true,
        }));
      } else {
        data = {
          ...data,
          created_at: data.created_at || now,
          updated_at: data.updated_at || now,
          is_active: data.is_active !== undefined ? data.is_active : true,
        };
      }

      return originalInsert.call(this, data, returning);
    };
  
    // PATCH: .update()
    const originalUpdate = proto.update;
    proto.update = function (data, returning) {
      const now = new Date();
  
      if (typeof data === 'object' && data !== null) {
        data = {
          ...data,
          updated_at: now,
        };
      }
  
      return originalUpdate.call(this, data, returning);
    };
  }
  
  module.exports = { patchKnex };  