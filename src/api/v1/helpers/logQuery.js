function logQuery(knexQuery) {
  const { sql, bindings } = knexQuery.toSQL();
  let i = 0;
  return sql.replace(/\?/g, () => {
    const val = bindings[i++];
    if (val === null) return 'NULL';
    if (typeof val === 'number') return val;
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${val.toString().replace(/'/g, "''")}'`; // escape single quotes
  });
}

module.exports = { logQuery };
