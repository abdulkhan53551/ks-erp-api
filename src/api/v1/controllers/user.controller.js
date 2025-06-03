const { asyncHandler } = require('./../services/asyncHandler.js')
const { ApiError } = require('./../services/ApiError.js');
const { isUserExist, isPasswordCorrect, generateToken, generateRefreshToken, updatePassword, demoDBCall } = require('../models/user.model.js');
const { uploadOnCloudinary } = require('./../services/cloudinary.js');
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
    const { fullName, email, username, password } = req.body

    // Validation - not empty
    if (
        [fullName, email, username, password].some(field => !field?.trim())
    ) {
        throw new ApiError({ statusCode: 400, message: 'All fields are required' });
    }

    // Check if user already exist
    const existedUser = isUserExist(username, email)

    // Throw error if user exist
    if (existedUser.length > 0) {
        throw new ApiError({ statusCode: 409, message: 'User with email or username already exist' });
    }

    // Check for image upload them to server
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError({ statusCode: 400, message: 'Avatar local file is required' })
    }

    // Upload them to cloudanary, image
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError({ statusCode: 400, message: 'Avatar file is required' })
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
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while registering user' })
    }

    // Return response
    return res.status(201).json(
        new ApiResponse({ statusCode: 200, data: createdUser, message: 'User registered successfully.' })
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
    const { username, email, password } = req.body

    // Username or email
    if (!(username || email)) {
        throw new ApiError({ statusCode: 400, message: 'username or  email is required' })
    }
    // Find the user in db
    const foundUser = user.find((user) => user.username === username || user.email === email)
    if (!foundUser) {
        throw new ApiError({ statusCode: 404, message: 'User not found' })
    }

    // Check password
    const isPasswordValid = await isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError({ statusCode: 401, message: 'Invalid user credential' })
    }

    // Acess and refresh token generation
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(foundUser.id)

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
            new ApiResponse({
                statusCode: 200,
                data: { user: loggedInUser, accessToken, refreshToken },
                message: 'User logged in successfully'
            })
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    // req.user.id

    // Update refresh token to empty in db
    let user = userData.find(user => user.id == req.user.id)
    user = { ...user, refreshToken: null }

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
        .json(new ApiResponse({ statusCode: 200, data: {}, message: 'User logged out' }))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        // Get refresh token from request
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new ApiError({ statusCode: 401, message: 'Unauthorized request' })
        }

        // Decode refresh token
        const decodeToken = jwt.verify(incomingRefreshToken, JWT.REFRESH_TOKEN_SECRET)

        // Get user from db
        let user = userData.find(user => user.id == decodeToken?.id)

        if (!user) {
            throw new ApiError({ statusCode: 401, message: 'Invalid refresh token' })
        }

        if (incomingRefreshToken != user.refreshToken) {
            throw new ApiError({ statusCode: 401, message: 'Refresh token is expired or used' })
        }

        // Generate new access and refresh token
        const optionsCookie = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id)

        // Return response
        return res
            .status(200)
            .cookie('accessToken', accessToken, optionsCookie)
            .cookie('refreshToken', refreshToken, optionsCookie)
            .json(
                new ApiResponse({
                    statusCode: 200,
                    data: { accessToken, refreshToken },
                    message: 'Access token refreshed'
                })
            )
    } catch (error) {
        throw new ApiError({ statusCode: 401, message: error?.message || 'Invalid refresh token' })
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    // Get old and new password from request
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
        throw new ApiError({ statusCode: 400, message: 'old password and new password are required' })
    }

    // Get user data from request which is put by middleware when user loged in successfully
    // Get user by id
    const user = userData.find(user => user.id == req.user.id)

    // Check the old password is correct with db user password
    // If password is not correct, throw error
    const isPasswordCorrect = await isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError({ statusCode: 400, message: 'Invalid old password' })
    }

    // Set new password to db
    user.password = newPassword
    // updatePassword(oldPassword, newPassword)

    // Return response
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: {}, message: 'Password changed successfully' }))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    // Get current user data from request which is put by middleware when user loged in successfully
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: req.user, message: 'Current user fetched successfully' }))
})

const updateAccountDetail = asyncHandler(async (req, res) => {
    // Get update data from request
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiError({ statusCode: 400, message: 'All fields are required' })
    }

    // Find user by id
    const user = userData.find(user => user.id == req.user?.id)

    // Update user data in db and get updated data from db

    // Return response
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: user, message: 'Account detail updated successfully' }))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    // Get file from request
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError({ statusCode: 400, message: 'Avatar file is missing' })
    }

    // Upload on server or cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError({ statusCode: 400, message: 'Error while uploading avatar' })
    }

    // Update avatar in db
    const user = userData.find(user => user.id == req.user?.id)
    user.avatar = avatar.url

    // Return response
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: user, message: 'Avatar updated successfully' }))
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

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while generating refresh and access token.' })
    }
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetail,
    updateUserAvatar
}