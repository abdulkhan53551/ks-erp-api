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

// Validation schema for restoring an address type
const restoreAddressTypeSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Address Type ID'),
  })
};

// Validation schema for bulk deleting address types
const bulkDeleteAddressTypesSchema = {
  body: Joi.object({
    ids: Joi.array()
      .items(Joi.number().integer().positive().messages({
        'number.base': 'Invalid address type ID.'
      }))
      .min(1)
      .unique()
      .required()
      .messages({
        'array.base': 'Address type IDs must be an array.',
        'array.min': 'Please select at least one address type.',
        'array.unique': 'Duplicate address type IDs are not allowed.',
        'any.required': 'Address type IDs are required.'
      }),
    isPermanentDelete: Joi.boolean()
      .default(false)
      .label('Is Permanent Delete')
      .messages({
        'boolean.base': `"isPermanentDelete" must be a boolean value.`
      })
  })
};

// Validation schema for bulk restoring address types
const bulkRestoreAddressTypesSchema = {
  body: Joi.object({
    ids: Joi.array()
      .items(Joi.number().integer().positive().messages({
        'number.base': 'Invalid address type ID.'
      }))
      .min(1)
      .unique()
      .required()
      .messages({
        'array.base': 'Address type IDs must be an array.',
        'array.min': 'Please select at least one address type to restore.',
        'array.unique': 'Duplicate address type IDs are not allowed.',
        'any.required': 'Address type IDs are required.'
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
  getAddressTypeSchema,
  createAddressTypeSchema,
  updateAddressTypeSchema,
  deleteAddressTypeSchema,
  restoreAddressTypeSchema,
  bulkDeleteAddressTypesSchema,
  bulkRestoreAddressTypesSchema,
  getContactRoleSchema,
  createContactRoleSchema,
  updateContactRoleSchema,
  deleteContactRoleSchema,
  restoreContactRoleSchema,
  bulkDeleteContactRolesSchema,
  bulkRestoreContactRolesSchema
};