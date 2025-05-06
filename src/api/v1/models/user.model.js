const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { JWT } = require('../../../config/config')
const { ApiError } = require('../services/ApiError')
const { db } = require('../database')
const { logQuery } = require('../helpers/logQuery')

//  Is user exist
const isUserExist = async (username = '', email = '') => {
    try {
        const query = db('users')
            .where(function () {
                this.where('email', email).orWhere('user_name', username);
            })
            .andWhere({ is_active: true })
            .first();
    
        const user = await query
        return user;
    } catch (error) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while checking user exist or not.' })
    }
}

// Find user by ID
const findUserById = async (id) => {
    const user = db('users')
        .where({ id, is_active: true })
        .first();

    return user;
}

const updatePassword = async (oldPassword, newPassword) => {
    try {
        // Check if the old password and new password is present
        if (!oldPassword || !newPassword) return

        // If the old password is the same as the new password, return 
        if (oldPassword != newPassword) return

        // If the old password is different from the new password
        // In case of password string modified
        const encPass = await bcrypt.hash(newPassword, 10)

        // Update password in database
    } catch (error) {
        new ApiError({ stateCode: 400, message: 'Error updating password' })
    }
}

const isPasswordCorrect = async (password, encryptedPassword) => {
    return await bcrypt.compare(password, encryptedPassword)
}

// Hash password
const getHashedPassword = async (password) => {
    // Check if the password is present
    if (!password) return

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    return hashedPassword
}

const generateToken = (data) => {
    // Static data for testing
    // const data = {
    //     id: 1,
    //     email: 'test@gmail.com',
    //     userName: 'test123',
    //     fullName: 'Abdul Khan'
    // }

    return jwt.sign(
        {
            id: data.id,
            email: data.email,
            userName: data.userName,
            fullName: data.fullName
        },
        JWT.ACCESS_TOKEN_SECRET,
        {
            expiresIn: JWT.ACCESS_TOKEN_EXPIRE
        }
    )
}

const generateRefreshToken = (data) => {
    // Static data for testing
    // const data = {
    //     id: 1,
    // }

    return jwt.sign(
        {
            id: data.id,
        },
        JWT.REFRESH_TOKEN_SECRET,
        {
            expiresIn: JWT.REFRESH_TOKEN_EXPIRE
        }
    )
}

module.exports = {
    isUserExist,
    updatePassword,
    isPasswordCorrect,
    getHashedPassword,
    generateToken,
    generateRefreshToken
}