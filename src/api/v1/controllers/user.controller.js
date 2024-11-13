const {asyncHandler} = require('./../services/asyncHandler.js')
const {ApiError} = require('./../services/ApiError.js');
const { isUserExist } = require('../models/user.model.js');
const {uploadOnCloudinary} = require('./../services/cloudinary.js');
const { delay } = require('../services/common.js');
const { ApiResponse } = require('../services/ApiResponse.js');

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

module.exports = {
    registerUser
}