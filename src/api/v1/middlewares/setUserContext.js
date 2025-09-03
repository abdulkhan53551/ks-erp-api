// middleware/setUserContext.js
const jwt = require('jsonwebtoken');
const { runWithContext } = require('../helpers/requestContext');

const JWT_SECRET = 'your-secret-key'; // Replace with your actual secret

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    let userId = 1;
    const firmId = 1

    const contextData = {
        userId: userId,
        firmId: firmId
    }

    // try {
    //     if (token) {
    //         const decoded = jwt.verify(token, JWT_SECRET);
    //         userId = decoded?.id || 0;
    //     }
    // } catch (err) {
    //     console.warn('Invalid JWT:', err.message);
    // }

    runWithContext(contextData, () => next());
};
