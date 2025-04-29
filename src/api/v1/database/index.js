// db.js
const knex = require('knex');
const { patchKnex } = require('../helpers/patchKnex');

const knexConfig = {
    client: 'pg', // or 'mysql', etc.
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    },
    pool: { min: 2, max: 10 },
};

const db = knex(knexConfig);

patchKnex(db); // ← This line applies the patch globally

// Function to check the database connection
const connectDB = () => {
    return new Promise(async (resolve, reject) => {
        try {
            await db.raw('SELECT 1+1 AS result');
            console.log('✅ Database connected successfully!');
            resolve();
        } catch (error) {
            console.error('❌ Error connecting to the database:', error);
            reject(error);
        }
    });
};

module.exports = { db, connectDB };