const crypto = require('crypto');
const CryptoJS = require('crypto-js');
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

// Decrypt a crypto key using AES
const decryptCryptoKey = (ciphertext) => {
    const key = process.env.ENCRYPTION_KEY;
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) throw new Error('Invalid encrypted data');
    return parseInt(originalText);
};


module.exports = {
    generateToken,
    generateAccessToken,
    hashToken,
    decryptCryptoKey
};