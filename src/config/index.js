const { PORT } = require("./config");
const pool = require("../api/v1/database");


module.exports = {
    PORT: PORT,
    pool: pool
}