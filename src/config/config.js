// Server base url
const BASE_URL = process.env.BASE_URL

// DB constants
const DATABASE = {
    DB_HOST: BASE_URL,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_PORT: process.env.DB_PORT
}

// Server port
const PORT = process.env.PORT || 3000;

// JWT Access Token
const JWT = {
    ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRE: process.env.JWT_ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRE: process.env.JWT_REFRESH_TOKEN_EXPIRY
}

// Coudinary Access Token
const CLOUDINARY = {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET
}

module.exports = {
    DATABASE,
    PORT,
    BASE_URL,
    JWT,
    CLOUDINARY
}