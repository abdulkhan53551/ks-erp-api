const { BASE_URL } = require("./config")

// URI
const PUBLIC_URI = `${BASE_URL}/public`

// Directory of project
const ROOT_DIR = process.cwd()
const PUBLIC_DIR = `${ROOT_DIR}/public`

module.exports = {
    ROOT_DIR,
    PUBLIC_DIR,
    PUBLIC_URI
}