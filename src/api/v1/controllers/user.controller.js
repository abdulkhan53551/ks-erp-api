const {asyncHandler} = require('./../services/asyncHandler.js')
const {ApiError} = require('./../services/ApiError.js');
const { isUserExist, isPasswordCorrect, generateToken, generateRefreshToken } = require('../models/user.model.js');
const {uploadOnCloudinary} = require('./../services/cloudinary.js');
const { delay } = require('../services/common.js');
const { ApiResponse } = require('../services/ApiResponse.js');
const jwt = require('jsonwebtoken');
const { JWT } = require('../../../config/config.js');

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

const registerUser = asyncHandler(async (req, res) => {

    // Get user detail
    const {fullName, email, username, password} = req.body

    // Validation - not empty
    if (
        [fullName, email, username, password].some(field => !field?.trim())
    ) {
        throw new ApiError(400, 'All fields are required');
    }

    // Check if user already exist
    const existedUser = isUserExist(username, email)
    
    // Throw error if user exist
    if (existedUser.length > 0) {
        throw new ApiError(409, 'User with email or username already exist'); 
    }

    // Check for image upload them to server
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, 'Avatar local file is required')
    }

    // Upload them to cloudanary, image
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, 'Avatar file is required')
    }

    // Create user in database
    const dbData = {
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        email,
        password,
        username: username.toLowerCase()
    }


    await delay(2000) // Wait time for fetching data from database for inserted record

    // Remove password & refresh token field from response
    const createdUser = {
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        email,
        username: username.toLowerCase()
    }

    // Check for user creation
    if (!createdUser) {
        throw new ApiError(500, 'Something went wrong while registering user')
    }

    // Return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, 'User registered successfully.')
    )
})

const loginUser = asyncHandler(async (req, res) => {
    const user = [
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
    // Request body -> data
    const {username, email, password} = req.body

    // Username or email
    if (!(username || email)) {
        throw new ApiError(400, 'username or  email is required')
    }
    // Find the user in db
    const foundUser = user.find((user) => user.username === username || user.email === email)
    if (!foundUser) {
        throw new ApiError(404, 'User not found')
    }

    // Check password
    const isPasswordValid = await isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid user credential')
    }

    // Acess and refresh token generation
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(foundUser.id)

    // Send cookies
    const loggedInUser = user.find(user => user.id == foundUser.id)
    const optionsCookie = {
        httpOnly: true,
        secure: true
    }

    // Return response
    return res
        .status(200)
        .cookie('accessToken', accessToken, optionsCookie)
        .cookie('refreshToken', refreshToken, optionsCookie)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                'User logged in successfully'
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    // req.user.id

    // Update refresh token to empty in db
    let user = userData.find(user => user.id == req.user.id)
    user = {...user, refreshToken: null}

    // Cookie option
    const optionsCookie = {
        httpOnly: true,
        secure: true
    }

    // Clear cookie with response
    return res
        .status(200)
        .clearCookie('accessToken', optionsCookie)
        .clearCookie('refreshToken', optionsCookie)
        .json(new ApiResponse(200, {}, 'User logged out'))
})

const refreshAccessToken = asyncHandler(async () => {
    try {
        // Get refresh token from request
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
        if (!incomingRefreshToken) {
            throw new ApiError(401, 'Unauthorized request')
        }
    
        // Decode refresh token
        const decodeToken = jwt.verify(incomingRefreshToken, JWT.REFRESH_TOKEN_SECRET)
    
        // Get user from db
        let user = userData.find(user => user.id == decodeToken?.id)
    
        if (!user) {
            throw new ApiError(401, 'Invalid refresh token ')
        }
    
        if (incomingRefreshToken != user.refreshToken) {
            throw new ApiError(401, 'Refresh token is expired or used ')
        }
    
        // Generate new access and refresh token
        const optionsCookie = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user.id)
    
        // Return response
        return res
            .status(200)
            .cookie('accessToken', accessToken, optionsCookie)
            .cookie('refreshToken', refreshToken, optionsCookie)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    'Access token refreshed'
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || 'Invalid refresh token ')
    }
})

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const foundUser = await userData.find((user) => user.id === userId)
        const accessToken = generateToken(foundUser)
        const refreshToken = generateRefreshToken(foundUser)

        // Update refresh token to db of user
        foundUser.refreshToken = refreshToken 
        userData.map(obj => obj.id === foundUser.id ? foundUser : obj);
        console.log(foundUser);
        
        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, 'Something went wrong while generating refresh and access token.')
    }
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}