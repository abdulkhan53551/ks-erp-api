// db.js
const knex = require('knex');
const Redis = require('ioredis');
const { patchKnex } = require('../helpers/patchKnex');
const path = require('path');
const { ROOT_DIR } = require('../../../config/constants/projectPaths');
const { REDIS } = require('../../../config/config');
let redisClient;

const knexConfig = {
    client: 'pg', // or 'mysql', etc.
    connection: {
        // host: process.env.DB_HOST,
        // port: process.env.DB_PORT || 5432,
        // user: process.env.DB_USER,
        // password: process.env.DB_PASSWORD,
        // database: process.env.DB_NAME,
        connectionString: process.env.UAT_DB_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    },
    migrations: {
        directory: path.resolve(ROOT_DIR, 'migrations'),
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

// Function to connect to Redis
const connectRedis = () => {
    return new Promise((resolve, reject) => {
        if (redisClient) {
            return resolve(redisClient);
        }

        redisClient = new Redis({
            host: REDIS.REDIS_HOST,
            port: REDIS.REDIS_PORT,
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected');
            resolve(redisClient);
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis connection error:', err);
            reject(err);
        });
    });
};

// Function to get the Redis client
const getRedisClient = () => {
    if (!redisClient) throw new Error('Redis client is not initialized');
    return redisClient;
};

module.exports = { db, connectDB, knexConfig, connectRedis, getRedisClient };