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

connectDB()
    // .then(() => {
    //     return connectRedis(); // Ensure Redis is connected
    // })
    // .then((redisClient) => {
    //     return initCasbin(redisClient)
    // })
    .then(() => {
        app.listen(PORT, () => console.log('✅ Server listing on port ' + PORT));
    })
    .catch((err) => {
        if (err.message.includes('Casbin')) {
            console.error('Error initializing Casbin:', err);
        } else if (err.message.includes('Redis')) {
            console.error('Redis connection FAILED!!!', err);
        } else {
            console.log('POSTGRESQL connection FAILED!!!', err);
        }
        process.exit(1);
    });