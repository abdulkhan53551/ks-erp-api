const { ApiError } = require('./../services/ApiError');

const globalErrorHandler = (err, req, res, next) => {
    let statusCode;
    let message;
    let errors = []

    try {
        // Check if the error is an instance of ApiError
        if (err instanceof require('./../services/ApiError').ApiError) {
            statusCode = err.statusCode;
            message = err.message;
            errors = err.errors;
        } else {
            // Default for other types of errors
            statusCode = err.status || 500;
            message = err.message || 'Something went wrong';
        }

        // Construct the error response
        const errorResponse = {
            success: false,

            status: statusCode,
            message,
        };

        // Include stack trace in development mode
        if (process.env.NODE_ENV === 'development') {
            errorResponse.stack = err.stack;
        }

        // Include all errors in development mode
        if (errors.length) {
            errorResponse.errors = errors
        }

        // Log critical errors for monitoring
        if (statusCode >= 500) {
            console.error(`[Critical Error] ${statusCode}:`, err);
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