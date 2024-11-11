const { DATABASE } = require('../../../config/constant');
const Pool = require('pg').Pool;

const connectDB = async () => {
    try {
        // const pool = new Pool({
        //     host: DATABASE.DB_HOST,
        //     database: DATABASE.DB_NAME,
        //     user: DATABASE.DB_USER,
        //     password: DATABASE.DB_PASSWORD,
        //     port: DATABASE.DB_PORT
        // });
        
        // module.exports = pool;

        // Listen on error
        // app.on('error', (error) => {
        //     console.log('ERR: ', error);
        //     throw error
        // })

        console.log('Test database connected successfully.');
        
    } catch (error) {
        // Throw error when something went wrong
        console.log('POSTGRESQL connection FAILED: ', error);
        process.exit(1)
    }
}

module.exports = connectDB;