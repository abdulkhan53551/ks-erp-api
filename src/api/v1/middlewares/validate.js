const Joi = require('joi');
const { ApiError } = require("../services/ApiError");
const { asyncHandler } = require("../services/asyncHandler");

/**
 * Middleware factory for Joi validation
 * @param {Object} schema - Joi schema object
 * @param {String} [property='body'] - Request property to validate (default is 'body')
 */

const validate = (schemas) => {
  return asyncHandler((req, _, next) => {
    const allErrors = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });

      if (error) {
        allErrors.push(...error.details.map(detail => detail.message));
      } else {
        // Replace request part with sanitized data
        req[source] = value;
      }
    }

    if (allErrors.length > 0) {
      throw new ApiError({
        statusCode: 422,
        message: allErrors[0].replace(/"/g, ''),
        errors: allErrors
      });
    }

    next();
  });
};

module.exports = validate;