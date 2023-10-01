const { DATABASE } = require('./constant');
const Pool = require('pg').Pool;

const pool = new Pool({
    host: DATABASE.DB_HOST,
    database: DATABASE.DB_NAME,
    user: DATABASE.DB_USER,
    password: DATABASE.DB_PASSWORD,
    port: DATABASE.DB_PORT
});

module.exports = pool;