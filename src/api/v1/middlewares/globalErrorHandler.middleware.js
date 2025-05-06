const { ERROR_CODES } = require('../../../config/constants/errorCodes');
const { ApiError } = require('./../services/ApiError');

const globalErrorHandler = (err, req, res, next) => {
    const safeError = err || {};
    let statusCode;
    let message;
    let errors = [];
    let errorCode;

    try {
        // Check if the error is an instance of ApiError
        if (safeError instanceof require('./../services/ApiError').ApiError) {
            statusCode = safeError.statusCode;
            message = safeError.message;
            errors = safeError.errors;
            errorCode = safeError.errorCode || ERROR_CODES.INTERNAL_ERROR;
        } else {
            // Default for other types of errors
            statusCode = safeError.status || 500;
            message = safeError.message || 'Something went wrong';
        }

        // Construct the error response
        const errorResponse = {
            success: false,
            errorCode,
            status: statusCode,
            message,
        };

        // Include stack trace in development mode
        if (process.env.NODE_ENV === 'development') {
            errorResponse.stack = safeError.stack;
        }

        // Include all errors in development mode
        if (errors.length) {
            errorResponse.errors = errors
        }

        // Log critical errors for monitoring
        if (statusCode >= 500) {
            console.error(`[Critical Error] ${statusCode}:`, safeError);
        }

        // Send the error response
        res.status(statusCode).json(errorResponse);
    } catch (error) {
        res
            .status(500)
            .json({
                success: false,
                status: 500,
                message: 'Something went wrong with the error handler',
            })
    }
};

module.exports = globalErrorHandler;