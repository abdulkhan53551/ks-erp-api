const { getEnforcer, initCasbin } = require("../src/api/v1/services/casbin");

(async () => {
    await initCasbin()

    const enforcer = getEnforcer();
    const result = await enforcer.enforce('sabirkhan1', '/api/data', 'get');
})();