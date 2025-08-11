const Joi = require("joi");

// Get city by state id validation schema
const getCityByStateIdValidationSchema = {
  params: Joi.object({
    stateId: Joi.number().integer().required().label('State ID'),
  })
};


module.exports = {
  getCityByStateIdValidationSchema
};