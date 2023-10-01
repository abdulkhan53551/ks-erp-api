const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'k_s_engineering_works',
    password: 'root',
    port: 5432
});

module.exports = pool;