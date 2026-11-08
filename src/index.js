require("dotenv").config();
const { connectDB, db, connectRedis, getRedisClient } = require("./api/v1/database");
const { initCasbin } = require("./api/v1/services/casbin");
const { app } = require('./app')
const { PORT } = require('./config');

// Graceful shutdown handling (SIGINT, SIGTERM)
const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Closing connections...`);
    try {
        console.log('Closing database connection pool...');
        await db.destroy();

        // try {
        //     const redisClient = getRedisClient();
        //     if (redisClient) {
        //         console.log('Closing Redis connection...');
        //         await redisClient.disconnect();
        //     }
        // } catch (_) {}

        console.log('✅ Connections closed. Exiting cleanly.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Bootstrap function: connect to DB first, then start listening for HTTP traffic
 */
const startServer = async () => {
    try {
        // 1. Connect to PostgreSQL
        // Knex pool automatically waits up to acquireTimeoutMillis (60s) for Neon to wake up
        await connectDB();

        // 2. Start HTTP server only AFTER database connection is verified
        app.listen(PORT, () => {
            console.log(`✅ Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('❌ POSTGRESQL connection FAILED:', err);
        process.exit(1); // Fail-fast so process managers (Docker/PM2/Render) know startup failed
    }
};

startServer();