const Joi = require('joi');
const { ApiError } = require("../services/ApiError");
const { asyncHandler } = require("../services/asyncHandler");

/**
 * Middleware factory for Joi validation
 * @param {Object} schema - Joi schema object
 * @param {String} [property='body'] - Request property to validate (default is 'body')
 */

const validate = (schema, property = 'body') => {
  return asyncHandler((req, _, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });

    // If error found while validation
    if (error) {
      const errors = error.details.map((detail) => detail.message); // Collect error messages
      const errorMessage = error.details?.[0]?.message?.replace(/"/g, '');
      throw new ApiError({statusCode: 422, message: errorMessage, errors: errors});
    }
    next(); // Proceed to the next middleware or controller
  })
};

module.exports = validate;