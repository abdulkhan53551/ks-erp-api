class ApiError extends Error {
    constructor(statusCode, message = 'Something went wrong', errors = [], stack = '') {
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        if (stack) {
            this.stack = stack
        } else {
           Error.captureStackTrace(this, this.constructor) 
        }

    }
}

// Custom error classes extending ApiError
class BadRequestError extends ApiError {
    constructor(message = 'Bad Request', errors = []) {
        super(400, message, errors);
    }
}

class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized', errors = []) {
        super(401, message, errors);
    }
}

class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden', errors = []) {
        super(403, message, errors);
    }
}

class NotFoundError extends ApiError {
    constructor(message = 'Not Found', errors = []) {
        super(404, message, errors);
    }
}

class ConflictError extends ApiError {
    constructor(message = 'Conflict', errors = []) {
        super(409, message, errors);
    }
}

class ValidationError extends ApiError {
    constructor(message = 'Validation Error', errors = []) {
        super(422, message, errors);
    }
}

class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error', errors = []) {
        super(500, message, errors);
    }
}

class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service Unavailable', errors = []) {
        super(503, message, errors);
    }
}

module.exports = {ApiError}