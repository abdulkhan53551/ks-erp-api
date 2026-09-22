require("dotenv").config();
const { connectDB, db, connectRedis, getRedisClient } = require("./api/v1/database");
const { initCasbin } = require("./api/v1/services/casbin");
const { app } = require('./app')
const { PORT } = require('./config');

// Listen for the SIGINT signal (e.g., Ctrl + C in the terminal)
// process.on('SIGINT', async () => {
//     try {
//         const redisClient = getRedisClient()
//         console.log('Closing database connection...');
//         await db.destroy();

//         console.log('Closing Redis connection...');
//         await redisClient.disconnect(); // Optional if Redis needs cleanup

//         process.exit(0);
//     } catch (error) {
//         console.error('Error during shutdown:', error);
//         process.exit(1);
//     }
// });

const startDatabaseConnection = async (retries = 3, delay = 4000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await connectDB();
            return;
        } catch (err) {
            console.error(`⚠️ DB connection attempt ${attempt}/${retries} failed (Neon might be auto-resuming):`, err.message);
            if (attempt < retries) {
                console.log(`⏳ Retrying DB connection in ${delay / 1000}s...`);
                await new Promise((res) => setTimeout(res, delay));
            } else {
                console.error('❌ Could not connect to PostgreSQL after multiple attempts:', err);
            }
        }
    }
};

app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
    startDatabaseConnection();
});