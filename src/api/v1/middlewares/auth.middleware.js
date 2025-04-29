const jwt = require("jsonwebtoken");
const { ApiError } = require("../services/ApiError");
const { asyncHandler } = require("../services/asyncHandler");
const { JWT } = require("../../../config/config");
const userData = [
    {
        id: 1,
        username: 'ksengg',
        email: 'ksengg@gmail.com',
        password: '123',
        yourData: 'something 1'
    },
    {
        id: 2,
        username: 'abdul',
        email: 'abdul@gmail.com',
        password: '456',
        yourData: 'something 2'
    }
]

const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Get the token from cookie or header
        const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '')
    
        if (!token) {
            throw new ApiError({statusCode: 401, message: 'Unauthorized request'})
        }
    
        // Verify token
        const decodeToken = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET)
    
        // Get user from db
        const user = await userData.find(user => user.id == decodeToken.id)
        if (!user) {
            throw new ApiError({statusCode: 401, message: 'Invalid access token'})
        }
    
        // Append data to request
        req.user = user
    
        // Pass to next middleware
        next()
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({statusCode: 401, message: 'Invalid access token'})
    }
})

module.exports = verifyJWT