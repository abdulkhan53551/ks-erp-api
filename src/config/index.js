const { PORT } = require("./constant");
const pool = require("./database");


module.exports = {
    PORT: PORT,
    pool: pool
}