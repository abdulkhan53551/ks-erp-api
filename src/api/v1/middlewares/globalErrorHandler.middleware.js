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

        // Sanitize raw SQL/Knex database error messages so queries never leak to the client
        const isRawSqlOrDbError = (msg) => {
            if (!msg || typeof msg !== 'string') return false;
            const lower = msg.toLowerCase();
            return (
                lower.startsWith('select ') ||
                lower.startsWith('insert into ') ||
                lower.startsWith('update ') ||
                lower.startsWith('delete from ') ||
                lower.includes('column "') ||
                lower.includes('relation "') ||
                lower.includes('syntax error at or near') ||
                lower.includes('violates foreign key constraint') ||
                lower.includes('violates unique constraint')
            );
        };

        if (isRawSqlOrDbError(message)) {
            if (message.includes('violates unique constraint')) {
                message = 'A record with this unique information already exists.';
                if (statusCode === 500) statusCode = 409;
            } else if (message.includes('violates foreign key constraint')) {
                message = 'Referenced entity was not found or is currently in use.';
                if (statusCode === 500) statusCode = 400;
            } else {
                message = 'An internal database error occurred while processing the request. Please try again or contact support.';
            }
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