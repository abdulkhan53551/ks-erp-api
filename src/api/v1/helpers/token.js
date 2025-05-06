const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT } = require('../../../config/config');

function generateToken(size = 64) {
    return crypto.randomBytes(size).toString('hex'); // Secure, unpredictable
}

const generateAccessToken = (data) => {
    return jwt.sign(data, JWT.ACCESS_TOKEN_SECRET, { expiresIn: JWT.ACCESS_TOKEN_EXPIRE })
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    generateToken,
    generateAccessToken,
    hashToken,
};