const { getEnforcer, initCasbin } = require("../src/api/v1/services/casbin");

(async () => {

    console.log('Adding policy in Instance A');
    await initCasbin()

    const enforcer = getEnforcer();
    // const result = await enforcer.enforce('admin', '/products', 'read');
    const result = await enforcer.enforce('sabirkhan1', '/api/data', 'get');
    console.log('[Instance B] Enforce result:', result); // ✅ true
})();