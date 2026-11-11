const casbin = require('casbin');
const { default: KnexAdapter } = require('casbin-knex-adapter');
const { db } = require('../database');
const { RedisWatcher } = require('@casbin/redis-watcher');
const path = require('path');

let enforcer;
let activeWatcher;

/**
 * Initialize Casbin Enforcer
 * @param {object|null} redisClient Optional Redis client. If null/omitted, runs in Standalone In-Memory mode.
 */
const initCasbin = async (redisClient = null) => {
    try {
        // Initialize adapter using Knex (persists policies in PostgreSQL 'policies' table)
        const adapter = await KnexAdapter.newAdapter(db);

        // Resolve absolute path to model file
        const modelPath = path.join(__dirname, './casbinModel.conf');

        // Initialize enforcer with model and adapter
        enforcer = await casbin.newEnforcer(modelPath, adapter);

        // If Redis client is provided and ready, attach Redis Watcher for multi-instance sync
        if (redisClient && typeof redisClient.publish === 'function') {
            try {
                activeWatcher = await RedisWatcher.newWatcher({
                    channel: 'casbin_policy_updates',
                    redisInstance: redisClient,
                });

                await enforcer.setWatcher(activeWatcher);

                activeWatcher.setUpdateCallback(async () => {
                    console.log('🔁 Reloading Casbin policies from Redis Watcher update');
                    await enforcer.loadPolicy();
                });

                console.log('✅ Casbin initialized with Redis Watcher');
            } catch (watcherErr) {
                console.warn('⚠️ Redis Watcher failed to attach, falling back to Standalone In-Memory mode:', watcherErr.message);
            }
        } else {
            console.log('✅ Casbin initialized in Standalone In-Memory mode (Render Free Tier compatible)');
        }

        // Load policies into Node.js RAM
        await enforcer.loadPolicy();
        return enforcer;
    } catch (error) {
        console.error('❌ Error initializing Casbin:', error);
        throw error;
    }
};

/**
 * Returns the active Casbin enforcer instance
 */
const getEnforcer = async () => {
    if (!enforcer) {
        await initCasbin(null);
    }
    return enforcer;
};

/**
 * Manually reload Casbin policies into RAM
 * Used after permissions are updated via the Admin API
 */
const reloadPolicy = async () => {
    if (enforcer) {
        await enforcer.loadPolicy();
        console.log('🔄 Casbin policies reloaded into in-memory cache');
    }
};

module.exports = { initCasbin, getEnforcer, reloadPolicy };
