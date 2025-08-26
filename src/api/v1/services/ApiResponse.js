const { STATUS_CODE_MAP } = require("../../../config/constants/statusCodeMap");
const { toCamelCase } = require("./conversion");

class ApiResponse {
    constructor({ statusCode, data, message = 'Success', successCode = null }) {
        this.statusCode = statusCode
        this.data = toCamelCase(data)
        this.message = message
        this.success = statusCode < 400
        this.successCode = successCode || STATUS_CODE_MAP[statusCode] || 'UNKNOWN';
    }
}

module.exports = { ApiResponse }