const Joi = require("joi");

// Validation schema for getting a party type by ID
const getPartyRolesSchema = {
    params: Joi.object({
        id: Joi.number().integer().required(),
    })
};

// Validation schema for creating a new party type
const createPartyRolesSchema = {
    body: Joi.object({
        roleCode: Joi.string().max(50).required().uppercase(),
        roleName: Joi.string().max(100).required(),
        description: Joi.string().allow("", null).optional()
    })
};

// Validation schema for updating an existing party type
const updatePartyRolesSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Party Type ID'),
    }),
    body: Joi.object({
        roleCode: Joi.string().max(50).uppercase().optional(),
        roleName: Joi.string().max(100).optional(),
        description: Joi.string().allow("", null).optional()
    })
};

// Validation schema for deleting a party type
const deletePartyRolesSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Party Type ID'),
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

// Validation schema for getting a party by ID
const getPartySchema = {
    params: Joi.object({
        id: Joi.number().integer().required(),
    })
};

// Validation schema for creating a new party
const createPartySchema = {
    body: Joi.object({
        partyCode: Joi.string().max(50).required().uppercase(),
        legalName: Joi.string().max(200).required(),
        displayName: Joi.string().max(200).allow('', null),
        mobile: Joi.string().max(15).allow('', null),
        email: Joi.string().email().max(150).allow('', null),
        gstRegistered: Joi.boolean().default(false),
        gstin: Joi.when('gstRegistered', {
            is: true,
            then: Joi.string()
                .trim()
                .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/)
                .required()
                .messages({
                    'any.required': 'GSTIN is required when GST is registered.',
                    'string.empty': 'GSTIN is required when GST is registered.',
                    'string.pattern.base': 'Please enter a valid GSTIN.'
                }),
            otherwise: Joi.string()
                .trim()
                .allow('', null)
                .optional()
        }),
        cinNumber: Joi.string().max(20).allow('', null),
        tanNumber: Joi.string().max(20).allow('', null),
        panNumber: Joi.string().max(20).allow('', null),
        website: Joi.string().max(200).allow('', null),
        remarks: Joi.string().allow('', null),
        status: Joi.string()
            .valid('ACTIVE', 'INACTIVE')
            .default('ACTIVE')
    })
};

// Validation schema for updating an existing party
const updatePartySchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Party ID'),
    }),
    body: createPartySchema.body.fork(
        ["partyCode", "legalName"],
        field => field.optional()
    )
};

// Validation schema for deleting a party
const deletePartySchema = {
    params: Joi.object({
        id: Joi.number().integer().required(),
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

// Search parties
const searchPartiesSchema = {
    query: Joi.object({
        search: Joi.string().trim().min(2).required().messages({
            'string.empty': 'Party name is required.',
            'string.min': 'Party name must be at least 2 characters.',
            'any.required': 'Party name is required.'
        })
    })
};

// Get party details
const getPartyDetailsSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required().messages({
            'number.base': 'Party ID must be a number.',
            'number.integer': 'Party ID must be an integer.',
            'number.positive': 'Party ID must be a positive number.',
            'any.required': 'Party ID is required.'
        })
    })
};

// Validation schema for getting a party address by ID
const getPartyAddressSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required(),
    })
};

// Validation schema for creating a new party address
const createPartyAddressSchema = {
    body: Joi.object({
        addressTypeId: Joi.number().integer().required(),
        address: Joi.string().max(200).required(),
        cityId: Joi.number().integer().required(),
        stateId: Joi.number().integer().required(),
        country: Joi.string().max(100).required(),
        pincode: Joi.string().min(6).max(10).required()
    })
};

// Validation schema for updating an existing party address
const updatePartyAddressSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required().label('Party Address ID'),
    }),
    body: createPartyAddressSchema.body
};

// Validation schema for deleting a party address
const deletePartyAddressSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required(),
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

// Validation schema for getting a party contact by ID
const getPartyContactSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required(),
    })
};

// Validation schema for creating a new party contact
const createPartyContactSchema = {
    body: Joi.object({
        contactRoleId: Joi.number().integer().required(),
        contactName: Joi.string().max(100).required(),
        mobile: Joi.string().pattern(/^\d{10}$/).allow("", null)
            .messages({
                'string.pattern.base': 'Please enter a valid mobile number.'
            }),
        email: Joi.string().email().max(150).allow("", null),
        isPrimary: Joi.boolean().default(false)
    })
};

// Validation schema for updating an existing party contact
const updatePartyContactSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required().label('Party Contact ID'),
    }),
    body: createPartyContactSchema.body
};

// Validation schema for deleting a party contact
const deletePartyContactSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required(),
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

// Validation schema for getting a party bank account by ID
const getPartyBankAccountSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required()
    })
};

// Validation schema for creating a new party bank account
const createPartyBankAccountSchema = {
    body: Joi.object({
        bankName: Joi.string().max(100).required(),
        accountNumber: Joi.string().max(50).required(),
        ifscCode: Joi.string().max(20).uppercase().allow('', null),
        branchName: Joi.string().max(100).allow('', null),
        accountHolderName: Joi.string().max(200).required(),
        upiId: Joi.string().max(100).required(),
        isPrimary: Joi.boolean().default(false)
    })
};

// Validation schema for updating an existing party bank account
const updatePartyBankAccountSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required().label('Party Bank Account ID'),
    }),
    body: createPartyBankAccountSchema.body
};

// Validation schema for deleting a party bank account
const deletePartyBankAccountSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required(),
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

// Get all roles against that party
const getPartyRolesMappingSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required()
    })
};

// Map the parties with party roles
const insertPartyRoleMappingsSchema = {
    body: Joi.object({
        partyRoleIds: Joi.array()
            .items(Joi.number().integer().positive())
            .unique()
            .required()
            .messages({
                'array.base': 'Party role IDs must be an array.',
                'array.unique': 'Duplicate party role IDs are not allowed.',
                'any.required': 'Party role IDs are required.'
            })
    })
};

module.exports = {
    getPartyRolesSchema,
    createPartyRolesSchema,
    updatePartyRolesSchema,
    deletePartyRolesSchema,
    getPartySchema,
    createPartySchema,
    updatePartySchema,
    deletePartySchema,
    searchPartiesSchema,
    getPartyDetailsSchema,
    getPartyAddressSchema,
    createPartyAddressSchema,
    updatePartyAddressSchema,
    deletePartyAddressSchema,
    getPartyContactSchema,
    createPartyContactSchema,
    updatePartyContactSchema,
    deletePartyContactSchema,
    getPartyBankAccountSchema,
    createPartyBankAccountSchema,
    updatePartyBankAccountSchema,
    deletePartyBankAccountSchema,
    getPartyRolesMappingSchema,
    insertPartyRoleMappingsSchema
};