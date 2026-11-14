const { decryptPayload } = require('../../../config/rsaKeys');
const { ApiError } = require('../services/ApiError');

// Allowed replay tolerance window: 60 seconds
const REPLAY_TOLERANCE_MS = 60 * 1000;

/**
 * Decrypts in-flight encrypted auth credentials (RSA-OAEP)
 * Protects passwords from appearing in plaintext in network inspect, proxies, and logs.
 */
const decryptAuthPayload = (req, res, next) => {
    // If client sent encryptedData, decrypt it
    if (req.body && req.body.encryptedData) {
        try {
            const decrypted = decryptPayload(req.body.encryptedData);

            if (!decrypted || typeof decrypted !== 'object') {
                throw new Error('Decrypted payload is not a valid JSON object.');
            }

            // Anti-Replay Attack Defense: verify timestamp within 60 seconds
            const now = Date.now();
            const requestTime = Number(decrypted.timestamp);

            if (!requestTime || isNaN(requestTime) || Math.abs(now - requestTime) > REPLAY_TOLERANCE_MS) {
                throw new ApiError({
                    statusCode: 400,
                    message: 'Authentication request has expired. Please try again.'
                });
            }

            // Merge decrypted credentials (e.g. userName, password) into req.body
            const cleanedBody = { ...req.body, ...decrypted };
            delete cleanedBody.encryptedData;
            delete cleanedBody.timestamp;

            req.body = cleanedBody;
        } catch (error) {
            if (error instanceof ApiError) {
                return next(error);
            }
            console.error('Failed to decrypt auth payload:', error.message);
            return next(new ApiError({
                statusCode: 400,
                message: 'Invalid or corrupted encrypted credentials. Please try again.'
            }));
        }
    }

    // Fallback: If client did not send encryptedData (e.g. direct API test harness), allow through
    next();
};

module.exports = {
    decryptAuthPayload
};

