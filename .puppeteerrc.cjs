const { join } = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // On Render / Linux servers, store the cache inside the project directory
  // so that Render bundles the downloaded browser into the deployment container.
  // On local development (Mac/Windows), use the standard home cache directory
  // so existing installed Chrome works seamlessly without re-downloading.
  cacheDirectory: (process.env.RENDER || process.platform === 'linux')
    ? join(__dirname, '.cache', 'puppeteer')
    : join(os.homedir(), '.cache', 'puppeteer'),
};
