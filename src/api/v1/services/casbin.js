const casbin = require('casbin');
const { default: KnexAdapter } = require('casbin-knex-adapter');
const { db } = require('../database');
const { RedisWatcher } = require('@casbin/redis-watcher');
const path = require('path');

let enforcer;

const initCasbin = async (redisClient) => {
    try {
        // Initialize adapter using Knex
        const adapter = await KnexAdapter.newAdapter(db);

        // Initialize Redis Watcher
        const watcher = await RedisWatcher.newWatcher({
            channel: 'casbin_policy_updates',
            redisInstance: redisClient, // reuse existing Redis client
        });

        // Resolve absolute path to model file
        const modelPath = path.join(__dirname, './casbinModel.conf');

        // Initialize enforcer with model and adapter
        enforcer = await casbin.newEnforcer(modelPath, adapter);

        // Assign watcher to enforcer
        await enforcer.setWatcher(watcher);

        // const policies = await enforcer.getPolicy();
        // console.log('Current policies:', policies);

        // Callback when watcher receives a policy update from Redis
        watcher.setUpdateCallback(async () => {
            console.log('🔁 Reloading policy from Redis update');
            await enforcer.loadPolicy();

            const policies = await enforcer.getPolicy();
            console.log('Watcher policies:', policies);
        });

        console.log('✅ Casbin with Redis Watcher initialized');
        return enforcer;
    } catch (error) {
        console.error('❌ Error initializing Casbin:', error);
        throw error;
    }
};

const getEnforcer = async () => {
    if (!enforcer) throw new Error('Casbin not initialized');
    return enforcer;
}

module.exports = { initCasbin, getEnforcer };
