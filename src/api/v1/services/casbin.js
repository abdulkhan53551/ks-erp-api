// src/config/casbin.js
const casbin = require('casbin');
// const KnexAdapter = require('@casbin/knex-adapter');
// const { newWatcher } = require('@casbin/pg-watcher');
const { default: KnexAdapter } = require('casbin-knex-adapter');
const knexfile = require('../../../../knexfile');
const { knexConfig, db } = require('../database');
const { RedisWatcher } = require('@casbin/redis-watcher');
const path = require('path');
// const knex = require('knex')(require('../../knexfile').development);

let enforcer;

async function initCasbin() {
    try {
        // const adapter = await KnexAdapter.newAdapter({
        //     client: 'pg',
        //     connection: knexfile.client.config.connection
        // });


        // Initialize adapter using Knex
        // const adapter = await KnexAdapter.newAdapter(knexfile.development);
        const adapter = await KnexAdapter.newAdapter(db);

        // const watcher = await newWatcher({
        //     ...knexConfig.connection,
        //     // host: 'localhost',
        //     // port: 5432,
        //     // user: 'postgres',
        //     // password: 'password',
        //     // database: 'casbin_demo'
        // });

        // Redis Watcher
        const watcher = await RedisWatcher.newWatcher({
            channel: 'casbin_policy_updates',
            redisOptions: {
                host: '127.0.0.1',
                port: 6379
            }
        });


        // Resolve absolute path to model file
        const modelPath = path.join(__dirname, './casbinModel.conf');

        // Initialize enforcer with model and adapter
        enforcer = await casbin.newEnforcer(modelPath, adapter);

        // await enforcer.addPolicy('alice', '/api/data', 'get');

        // Assign watcher to enforcer
        await enforcer.setWatcher(watcher);

        const policies = await enforcer.getPolicy();
        console.log('Current policies:', policies);

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
}

const getEnforcer = async () => {
    if (!enforcer) throw new Error('Casbin not initialized');
    return enforcer;
}

module.exports = { initCasbin, getEnforcer };
