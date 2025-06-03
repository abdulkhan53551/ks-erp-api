const { getEnforcer, initCasbin } = require("../src/api/v1/services/casbin");

(async () => {

    console.log('Adding policy in Instance A');
    await initCasbin()

    const enforcer = getEnforcer();
    await enforcer.addPolicy('admin', '/products', 'read');
})();