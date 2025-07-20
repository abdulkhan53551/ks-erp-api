// debugSQL.js
function interpolateSQL(sql, bindings) {
    let i = 0;
    return sql.replace(/\?/g, () => {
        const value = bindings[i++];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        return `'${value.toString().replace(/'/g, "''")}'`; // Escape single quotes
    });
}

function printQuery(knexQuery, label = '🔍 SQL Debug') {
    const { sql, bindings } = knexQuery.toSQL();
    const interpolated = interpolateSQL(sql, [...bindings]); // Clone bindings
    console.log(`\n${label}:\n${interpolated}\n`);
}

module.exports = {
    printQuery
};
