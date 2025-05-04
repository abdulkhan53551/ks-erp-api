const { asyncHandler } = require('../services/asyncHandler.js')
const { ApiResponse } = require('../services/ApiResponse.js');
const { ApiError } = require('../services/ApiError.js');
const jwt = require('jsonwebtoken');
const { rotateRefreshToken, createRefreshToken } = require('../services/tokenService.js');
const { JWT } = require('../../../config/config.js');
const bcrypt = require('bcrypt');
const { isUserExist, getHashedPassword, isPasswordCorrect } = require('../models/user.model.js');
const { createUser } = require('../models/auth.model.js');
const { generateToken, hashToken, generateAccessToken } = require('../helpers/token.js');
const { db } = require('../database/index.js');

// Convert to expiry days to number
const REFRESH_TOKEN_EXPIRY_DAYS = Number(JWT.REFRESH_TOKEN_EXPIRE?.match(/\d+/)?.[0]);
const ACCESS_TOKEN_EXPIRY = Number(JWT.ACCESS_TOKEN_EXPIRE?.match(/\d+/)?.[0]);
const REFRESH_TOKEN_EXPIRY_IN_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
const ACCESS_TOKEN_EXPIRY_IN_MS = ACCESS_TOKEN_EXPIRY * 60 * 1000

// Register user
const registerUser = asyncHandler(async (req, res) => {
    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while registering user'
    }

    // Get user detail
    const { firstName, lastName, role, email, userName, password } = req.body

    // Validation - not empty
    if (
        [firstName, lastName, role, email, userName, password].some(field => !field?.trim())
    ) {
        throw new ApiError({ statusCode: 400, message: 'All fields are required' });
    }

    // Check if user already exist
    const existedUser = await isUserExist(userName, email)

    // Throw error if user exist
    if (existedUser?.id > 0) {
        throw new ApiError({ statusCode: 409, message: 'User with email or username already exist' });
    }

    // Hashed password
    const hashedPassword = await getHashedPassword(password)

    // Check for image upload them to server
    // const avatarLocalPath = req.files?.avatar?.[0]?.path
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    // if (!avatarLocalPath) {
    //     throw new ApiError({statusCode: 400, message: 'Avatar local file is required'})
    // }

    // // Upload them to cloudanary, image
    // const avatar = await uploadOnCloudinary(avatarLocalPath)
    // const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // if (!avatar) {
    //     throw new ApiError({statusCode: 400, message: 'Avatar file is required'})
    // }

    const userData = {
        email: email,
        password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role_id: role,
        user_name: userName.toLowerCase()
    }

    // Remove password & refresh token field from response
    const newUser = await createUser(userData)

    // Check for user creation
    if (!newUser) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while registering user' })
    }

    // Prepare response
    response = {
        statusCode: 201,
        data: newUser,
        message: 'User registered successfully.'
    }

    return res.status(response.statusCode).json(new ApiResponse(response))
})

const loginUser = asyncHandler(async (req, res) => {
    const { userName, email, password } = req.body;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;
    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while logging'
    }

    // Username or email
    if (!(userName || email)) {
        throw new ApiError({ statusCode: 400, message: 'username or  email is required' })
    }

    // Check if user already exist
    const user = await isUserExist(userName, email)

    // Find the user in db
    if (!user?.id) {
        throw new ApiError({ statusCode: 404, message: 'User not found' })
    }

    // Check password
    const isPasswordValid = await isPasswordCorrect(password, user?.password)
    if (!isPasswordValid) {
        throw new ApiError({ statusCode: 401, message: 'Invalid user credential' })
    }

    // throw new ApiError({ statusCode: 200, message: 'break point' })

    // Acess and refresh token generation
    const tokenData = { user: user, ip: ipAddress, userAgent, deviceId: null }
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(tokenData)

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    }

    // Set cookie options for access token
    const optionsCookieForAccessToken = { ...optionsCookie, maxAge: ACCESS_TOKEN_EXPIRY_IN_MS }

    response = {
        statusCode: 200,
        data: { accessToken, refreshToken },
        message: 'Successfully logged in'
    }

    // Set access & refresh token as HTTP-only cookie
    return res
        .status(response.statusCode)
        .cookie('accessToken', accessToken, optionsCookieForAccessToken)
        .cookie('refreshToken', refreshToken, optionsCookie)
        .json(new ApiResponse(response))
});

// Generate refresh token
const refreshUserToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while generating refresh token'
    }

    // Check if refresh token is present
    if (!refreshToken) {
        throw new ApiError({ statusCode: 400, message: 'Refresh token is required' })
    }

    // Get new refresh token
    const { accessToken, newToken: newRefreshToken } = await rotateRefreshToken(refreshToken, ip, userAgent);

    // Get token data
    const tokens = { accessToken, refreshToken: newRefreshToken }

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    }

    // Set cookie options for access token
    const optionsCookieForAccessToken = { ...optionsCookie, maxAge: ACCESS_TOKEN_EXPIRY_IN_MS }

    response = {
        statusCode: 200,
        data: tokens,
        message: 'Successfully generated access and refreshed token'
    }

    // Set access & refresh token as HTTP-only cookie
    return res
        .status(response.statusCode)
        .cookie('accessToken', accessToken, optionsCookieForAccessToken)
        .cookie('refreshToken', newRefreshToken, optionsCookie)
        .json(new ApiResponse(response))
})

// Generate access and refresh token
const generateAccessAndRefreshTokens = async (tokenData) => {
    try {
        const { user, ip, userAgent, deviceId } = tokenData

        // Generate access token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            userName: user.user_name,
            fullName: `${user.first_name} ${user.last_name}`
        }
        const accessToken = generateAccessToken(tokenPayload)

        // Generate refresh token
        const { token: refreshToken } = await createRefreshToken(user.id, ip, userAgent, deviceId);

        return { accessToken, refreshToken }
    } catch (error) {
        console.log('Error generating access and refresh token:', error);

        throw new ApiError({ statusCode: 500, message: 'Something went wrong while generating refresh and access token.' })
    }
}

// Check verify access token
const checkVerifyAccessToken = asyncHandler(async (req, res, next) => {
    return res
        .status(200)
        .json(new ApiResponse({statusCode: 200, message: 'Access token is valid'}))
})

module.exports = {
    registerUser,
    loginUser,
    refreshUserToken,
    checkVerifyAccessToken
}