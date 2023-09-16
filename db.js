const Pool = require('pg').Pool;

const pool = new Pool({
    // user: 'root',
    user: 'postgres',
    host: 'localhost',
    database: 'NewDB',
    password: 'root',
    port: 5432
});

module.exports = pool;