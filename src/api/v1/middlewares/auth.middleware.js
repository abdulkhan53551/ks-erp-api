const jwt = require("jsonwebtoken");
const { ApiError } = require("../services/ApiError");
const { asyncHandler } = require("../services/asyncHandler");
const { JWT } = require("../../../config/config");
const { ApiResponse } = require("../services/ApiResponse");
const { getEnforcer } = require("../services/casbin");


const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Get the token from cookie or header
        const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '')

        if (!token) {
            throw new ApiError({ statusCode: 401, message: 'Unauthorized request' })
        }

        // Verify token
        const decodeToken = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET)

        // Get user from db
        const user = await userData.find(user => user.id == decodeToken.id)
        if (!user) {
            throw new ApiError({ statusCode: 401, message: 'Invalid access token' })
        }

        // Append data to request
        req.user = user

        // Pass to next middleware
        next()
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({ statusCode: 401, message: 'Invalid access token' })
    }
})

// module.exports = verifyJWT

// Verify access token
const verifyAccessToken = asyncHandler((req, res, next) => {
    const authHeader = req.headers.authorization;
    let token = null;

    // Check if the token is in the Authorization header or in cookies
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken; // Fallback to cookie
    }

    // If no token is found, throw an error
    if (!token) {
        throw new ApiError({ statusCode: 401, message: 'Access token required' })
    }

    try {
        const decoded = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET);
        req.user = {
            id: decoded.id, // or whatever you encoded in the token
        };
        next();
    } catch (err) {
        throw new ApiError({ statusCode: 401, message: 'Access token expired or invalid' })
    }
});

// Verify access token
const authorizeAccess = asyncHandler(async (req, res, next) => {
    const { user, resource, userAction } = req.body
    const { method } = req;
    const methodAction = {
        'GET': 'read',
        'POST': 'create',
        'PATCH': 'update',
        'DELETE': 'delete'
    }

    const sub = { ...user }
    // const obj_rule = { ...resource, createdBy: `user:${user?.id}` }
    const obj_rule = { ...resource }
    const act = userAction || methodAction[method];

    console.log('sub: ', sub);
    console.log('obj_rule: ', obj_rule);
    console.log('act: ', act);
    

    const enforcer = await getEnforcer();
    const allowed = await enforcer.enforce(sub, obj_rule, act);

    if (!allowed) {
        return res.status(403).json(new ApiResponse({ statusCode: 403, data: { authorize: false }, message: 'User is not authorize' }));
    }

    next();
});

module.exports = {
    verifyJWT,  // Remove this line. This is not needed anymore
    verifyAccessToken,
    authorizeAccess
};