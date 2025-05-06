// helpers/logKnexQuery.js
function logQuery(queryBuilder, label = 'Knex Query') {
    const { sql, bindings } = queryBuilder.toSQL();

    const interpolated = bindings.reduce((query, value) => {
        const safeValue =
            typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` :
                value instanceof Date ? `'${value.toISOString()}'` :
                    value === null ? 'NULL' : value;

        return query.replace('?', safeValue);
    }, sql);

    console.log('==================== START ======================');
    console.log(`🧾 ${label}:`);
    console.log(interpolated);
    console.log('===================== END =======================');
}

module.exports = { logQuery };
