// knexfile.js (root level)
require('dotenv').config();
const path = require('path');
const { knexConfig } = require('./src/api/v1/database');


module.exports = {
    development: {
        ...knexConfig,
        migrations: {
            directory: path.resolve(__dirname, 'migrations')
        },
        seeds: {
            directory: path.resolve(__dirname, 'seeds'), // ✅ Add this line
        },
    },
};