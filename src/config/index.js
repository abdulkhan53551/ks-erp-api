const { PORT } = require("./constant");
const pool = require("../api/v1/database");


module.exports = {
    PORT: PORT,
    pool: pool
}