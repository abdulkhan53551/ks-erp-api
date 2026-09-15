// middleware/setUserContext.js
const jwt = require('jsonwebtoken');
const { runWithContext } = require('../helpers/requestContext');
const { JWT } = require('../../../config/config');

module.exports = (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.replace(/^Bearer\s+/i, '');
    } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }

    let userId = 0;
    let firmId = 1;
    let role = null;
    let roleId = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET);
            userId = decoded?.id || 0;
            role = decoded?.role || null;
            roleId = decoded?.roleId || null;
            firmId = req.headers['x-firm-id']
                ? parseInt(req.headers['x-firm-id'], 10) || 1
                : (decoded?.firmId || 1);

            if (!req.user && userId) {
                req.user = {
                    id: userId,
                    email: decoded?.email,
                    userName: decoded?.userName,
                    fullName: decoded?.fullName,
                    role,
                    roleId,
                    firmId
                };
            }
        } catch (err) {
            // Expired or invalid token: ignore here so public endpoints work,
            // route-level auth middleware (verifyAccessToken) will enforce 401 when required.
        }
    } else if (req.headers['x-firm-id']) {
        firmId = parseInt(req.headers['x-firm-id'], 10) || 1;
    }

    const contextData = {
        userId,
        firmId,
        role,
        roleId
    };

    runWithContext(contextData, () => next());
};
