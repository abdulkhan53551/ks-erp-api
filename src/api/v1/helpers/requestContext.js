// requestContext.js
const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

module.exports = {
    runWithContext: (context, fn) => asyncLocalStorage.run(context, fn),
    getContext: () => asyncLocalStorage.getStore() || {},
};