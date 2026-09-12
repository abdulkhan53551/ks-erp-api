const Joi = require("joi");

// Get city by state id validation schema
const getCityByStateIdValidationSchema = {
  params: Joi.object({
    stateId: Joi.number().integer().required().label('State ID'),
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

// Validation schema for restoring a contact role
const restoreContactRoleSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Contact Role ID'),
  })
};

// Validation schema for bulk deleting contact roles
const bulkDeleteContactRolesSchema = {
  body: Joi.object({
    ids: Joi.array()
      .items(Joi.number().integer().positive().messages({
        'number.base': 'Invalid contact role ID.'
      }))
      .min(1)
      .unique()
      .required()
      .messages({
        'array.base': 'Contact role IDs must be an array.',
        'array.min': 'Please select at least one contact role.',
        'array.unique': 'Duplicate contact role IDs are not allowed.',
        'any.required': 'Contact role IDs are required.'
      }),
    isPermanentDelete: Joi.boolean()
      .default(false)
      .label('Is Permanent Delete')
      .messages({
        'boolean.base': `"isPermanentDelete" must be a boolean value.`
      })
  })
};

// Validation schema for bulk restoring contact roles
const bulkRestoreContactRolesSchema = {
  body: Joi.object({
    ids: Joi.array()
      .items(Joi.number().integer().positive().messages({
        'number.base': 'Invalid contact role ID.'
      }))
      .min(1)
      .unique()
      .required()
      .messages({
        'array.base': 'Contact role IDs must be an array.',
        'array.min': 'Please select at least one contact role to restore.',
        'array.unique': 'Duplicate contact role IDs are not allowed.',
        'any.required': 'Contact role IDs are required.'
      })
  })
};

module.exports = {
  getCityByStateIdValidationSchema,
  getContactRoleSchema,
  createContactRoleSchema,
  updateContactRoleSchema,
  deleteContactRoleSchema,
  restoreContactRoleSchema,
  bulkDeleteContactRolesSchema,
  bulkRestoreContactRolesSchema
};