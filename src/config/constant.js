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

module.exports = {
    DATABASE,
    PORT,
    BASE_URL
}