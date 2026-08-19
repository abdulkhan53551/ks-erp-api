const Joi = require("joi");

// Get city by state id validation schema
const getCityByStateIdValidationSchema = {
  params: Joi.object({
    stateId: Joi.number().integer().required().label('State ID'),
  })
};

// Validation schema for creating a new address type
const getAddressTypeSchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  })
};

// Validation schema for creating a new address type
const createAddressTypeSchema = {
  body: Joi.object({
    typeCode: Joi.string().max(50).required().uppercase(),
    typeName: Joi.string().max(100).required(),
    description: Joi.string().allow("", null).optional()
  })
};

// Validation schema for updating an existing address type
const updateAddressTypeSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Address Type ID'),
  }),
  body: Joi.object({
    typeCode: Joi.string().max(50).uppercase().optional(),
    typeName: Joi.string().max(100).optional(),
    description: Joi.string().allow("", null).optional()
  })
};

// Validation schema for deleting an address type
const deleteAddressTypeSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Address Type ID'),
  }),
  query: Joi.object({
    isPermanentDelete: Joi.boolean()
      .default(false)
      .label('Is Permanent Delete')
      .messages({
        'boolean.base': `"isPermanentDelete" must be a boolean value.`,
      })
  })
};

// Validation schema for getting a contact role by ID
const getContactRoleSchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  })
};

// Validation schema for creating a new contact role
const createContactRoleSchema = {
  body: Joi.object({
    roleCode: Joi.string().max(50).required().uppercase(),
    roleName: Joi.string().max(100).required(),
    description: Joi.string().allow('', null).optional()
  })
};

// Validation schema for updating an existing contact role
const updateContactRoleSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Contact Role ID'),
  }),
  body: Joi.object({
    roleCode: Joi.string().max(50).uppercase().optional(),
    roleName: Joi.string().max(100).optional(),
    description: Joi.string().allow("", null).optional()
  })
};

// Validation schema for deleting a contact role
const deleteContactRoleSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Contact Role ID'),
  }),
  query: Joi.object({
    isPermanentDelete: Joi.boolean()
      .default(false)
      .label('Is Permanent Delete')
      .messages({
        'boolean.base': `"isPermanentDelete" must be a boolean value.`,
      })
  })
};

module.exports = {
  getCityByStateIdValidationSchema,
  getAddressTypeSchema,
  createAddressTypeSchema,
  updateAddressTypeSchema,
  deleteAddressTypeSchema,
  getContactRoleSchema,
  createContactRoleSchema,
  updateContactRoleSchema,
  deleteContactRoleSchema
};