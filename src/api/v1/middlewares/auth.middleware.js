const jwt = require("jsonwebtoken");
const { ApiError } = require("../services/ApiError");
const { asyncHandler } = require("../services/asyncHandler");
const { JWT } = require("../../../config/config");


// const verifyJWT = asyncHandler(async (req, res, next) => {
//     try {
//         // Get the token from cookie or header
//         const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '')

//         if (!token) {
//             throw new ApiError({statusCode: 401, message: 'Unauthorized request'})
//         }

//         // Verify token
//         const decodeToken = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET)

//         // Get user from db
//         const user = await userData.find(user => user.id == decodeToken.id)
//         if (!user) {
//             throw new ApiError({statusCode: 401, message: 'Invalid access token'})
//         }

//         // Append data to request
//         req.user = user

//         // Pass to next middleware
//         next()
//     } catch (error) {
//         throw error instanceof ApiError ? error : new ApiError({statusCode: 401, message: 'Invalid access token'})
//     }
// })

// module.exports = verifyJWT

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
        throw new ApiError({ statusCode: 401, message: 'Access token missing or invalid' })
    }

    try {
        const decoded = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET);
        req.user = {
            id: decoded.userId, // or whatever you encoded in the token
        };
        next();
    } catch (err) {
        throw new ApiError({ statusCode: 401, message: 'Access token expired or invalid' })
    }
});

module.exports = verifyAccessToken;