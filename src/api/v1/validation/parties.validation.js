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

// Validation schema for restoring a party role
const restorePartyRolesSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Party Role ID'),
    })
};

// Validation schema for bulk deleting party roles
const bulkDeletePartyRolesSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid party role ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Party role IDs must be an array.',
                'array.min': 'Please select at least one party role.',
                'array.unique': 'Duplicate party role IDs are not allowed.',
                'any.required': 'Party role IDs are required.'
            }),
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`
            })
    })
};

// Validation schema for bulk restoring party roles
const bulkRestorePartyRolesSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid party role ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Party role IDs must be an array.',
                'array.min': 'Please select at least one party role to restore.',
                'array.unique': 'Duplicate party role IDs are not allowed.',
                'any.required': 'Party role IDs are required.'
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
        firmId: Joi.number().integer().allow(null, '').optional(),
        partyCode: Joi.string().max(50).required().uppercase().messages({
            "string.empty": "Party code is required.",
            "any.required": "Party code is required."
        }),
        legalName: Joi.string().max(255).required().messages({
            "string.empty": "Legal name is required.",
            "any.required": "Legal name is required."
        }),
        displayName: Joi.string().max(255).required().messages({
            "string.empty": "Display name is required.",
            "any.required": "Display name is required."
        }),
        mobile: Joi.string()
            .pattern(/^(?:(?:\+91|0)?[6-9]\d{9}|1800\d{6,7}|1860\d{6,7}|0\d{8,10}|\d{8,12})$/)
            .required()
            .messages({
                "string.empty": "Mobile number is required.",
                "string.pattern.base": "Please enter a valid phone/mobile number."
            }),
        email: Joi.string()
            .email({ tlds: { allow: false } })
            .allow(null, "")
            .messages({
                "string.email": "Please enter a valid email address."
            }),
        gstRegistered: Joi.boolean().default(false),
        gstin: Joi.when("gstRegistered", {
            is: true,
            then: Joi.string()
                .trim()
                .uppercase()
                .pattern(/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})$/)
                .required()
                .messages({
                    "string.empty": "GSTIN is required when GST is enabled.",
                    "string.pattern.base": "Please enter a valid 15-character GSTIN (e.g. 24ABCDE1234F1Z5)."
                }),
            otherwise: Joi.string().trim().allow("", null).optional()
        }),
        panNumber: Joi.string()
            .trim()
            .uppercase()
            .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
            .allow(null, "")
            .messages({
                "string.pattern.base": "Please enter a valid 10-character PAN (e.g. ABCDE1234F)."
            }),
        cinNumber: Joi.string()
            .trim()
            .uppercase()
            .pattern(/^([A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})$/)
            .allow(null, "")
            .messages({
                "string.pattern.base": "Please enter a valid 21-digit CIN number."
            }),
        tanNumber: Joi.string()
            .trim()
            .uppercase()
            .pattern(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/)
            .allow(null, "")
            .messages({
                "string.pattern.base": "Please enter a valid 10-digit TAN number."
            }),
        website: Joi.string()
            .uri({ scheme: [/https?/] })
            .allow(null, "")
            .messages({
                "string.uri": "Please enter a valid website URL (e.g. https://abc.com)."
            }),
        logoUrl: Joi.string()
            .uri({ scheme: [/https?/] })
            .allow(null, "")
            .optional()
            .messages({
                "string.uri": "Please enter a valid logo URL."
            }),
        logoPublicId: Joi.string()
            .max(255)
            .allow(null, "")
            .optional(),
        remarks: Joi.string().max(1000).allow(null, ""),
        status: Joi.string()
            .valid('ACTIVE', 'INACTIVE')
            .default('ACTIVE'),
        partyRoleIds: Joi.array()
            .items(Joi.number().integer().positive().messages({
                "number.base": "Invalid party role selected."
            }))
            .unique()
            .optional()
            .default([])
            .messages({
                "array.base": "Please select valid party roles.",
                "array.unique": "Please select each party role only once."
            })
    })
};

// Validation schema for updating an existing party
const updatePartySchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Party ID'),
    }),
    body: createPartySchema.body.fork(
        ["partyCode", "legalName", "displayName", "mobile", "partyRoleIds"],
        field => field.optional()
    ).min(1)
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

// Validation schema for restoring a party
const restorePartySchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Party ID'),
    })
};

// Validation schema for bulk deleting parties
const bulkDeletePartiesSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid party ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Party IDs must be an array.',
                'array.min': 'Please select at least one party.',
                'array.unique': 'Duplicate party IDs are not allowed.',
                'any.required': 'Party IDs are required.'
            }),
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`
            })
    })
};

// Validation schema for bulk restoring parties
const bulkRestorePartiesSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid party ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Party IDs must be an array.',
                'array.min': 'Please select at least one party to restore.',
                'array.unique': 'Duplicate party IDs are not allowed.',
                'any.required': 'Party IDs are required.'
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
        branchId: Joi.number().integer().positive().allow(null).optional(),
        contactRoleId: Joi.number().integer().required().messages({
            "number.base": "Please select a contact role.",
            "any.required": "Contact role is required."
        }),
        contactName: Joi.string().max(255).required().messages({
            "string.empty": "Contact name is required.",
            "any.required": "Contact name is required."
        }),
        designation: Joi.string().max(255).allow(null, "").optional(),
        mobile: Joi.string()
            .pattern(/^(?:(?:\+91|0)?[6-9]\d{9}|1800\d{6,7}|1860\d{6,7}|0\d{8,10}|\d{8,12})$/)
            .allow(null, "")
            .optional()
            .messages({
                "string.pattern.base": "Please enter a valid phone/mobile number."
            }),
        email: Joi.string()
            .email({ tlds: { allow: false } })
            .allow(null, "")
            .messages({
                "string.email": "Please enter a valid email address."
            }),
        isPrimary: Joi.boolean().default(false)
    })
};

// Validation schema for updating an existing party contact
const updatePartyContactSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required().label('Party Contact ID'),
    }),
    body: createPartyContactSchema.body.fork(
        ["contactRoleId", "contactName", "mobile"],
        field => field.optional()
    )
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
        bankName: Joi.string().max(255).required().messages({
            "string.empty": "Bank name is required.",
            "any.required": "Bank name is required."
        }),
        accountNumber: Joi.string()
            .pattern(/^\d{9,18}$/)
            .required()
            .messages({
                "string.empty": "Account number is required.",
                "string.pattern.base": "Account number must be 9 to 18 digits."
            }),
        ifscCode: Joi.string()
            .trim()
            .uppercase()
            .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
            .required()
            .messages({
                "string.empty": "IFSC code is required.",
                "string.pattern.base": "Please enter a valid IFSC code (e.g. SBIN0007890)."
            }),
        branchName: Joi.string().max(255).required().messages({
            "string.empty": "Branch name is required.",
            "any.required": "Branch name is required."
        }),
        accountHolderName: Joi.string().max(255).required().messages({
            "string.empty": "Account holder name is required.",
            "any.required": "Account holder name is required."
        }),
        upiId: Joi.string()
            .trim()
            .pattern(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/)
            .allow(null, "")
            .optional()
            .messages({
                "string.pattern.base": "Please enter a valid UPI ID (e.g. name@bank)."
            }),
        isPrimary: Joi.boolean().default(false)
    })
};

// Validation schema for updating an existing party bank account
const updatePartyBankAccountSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().required(),
        id: Joi.number().integer().required().label('Party Bank Account ID'),
    }),
    body: createPartyBankAccountSchema.body.fork(
        ["bankName", "accountNumber", "ifscCode", "branchName", "accountHolderName"],
        field => field.optional()
    )
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

// Validation schemas for Party Branches
const createPartyBranchSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
        branchName: Joi.string().trim().max(100).required().messages({
            'string.empty': 'Branch name is required.',
            'any.required': 'Branch name is required.'
        }),
        branchCode: Joi.string().trim().max(50).allow('', null).optional(),
        gstin: Joi.string()
            .trim()
            .uppercase()
            .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
            .allow('', null)
            .optional()
            .messages({
                'string.pattern.base': 'Please enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).'
            }),
        stateId: Joi.number().integer().positive().required().messages({
            'number.base': 'Please select a state.',
            'any.required': 'State is required.'
        }),
        address: Joi.string().trim().max(500).allow('', null).optional(),
        cityId: Joi.number().integer().positive().allow(null).optional(),
        pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).allow('', null).optional().messages({
            'string.pattern.base': 'Please enter a valid 6-digit Indian pincode.'
        }),
        country: Joi.string().trim().max(50).allow('', null).optional(),
        isHeadOffice: Joi.boolean().default(false).optional(),
        isDefault: Joi.boolean().default(false).optional(),
        email: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional().messages({
            'string.email': 'Please enter a valid email address.'
        }),
        mobile: Joi.string().trim().pattern(/^(?:(?:\+91|0)?[6-9]\d{9}|1800\d{6,7}|1860\d{6,7}|0\d{8,10}|\d{8,12})$/).allow('', null).optional().messages({
            'string.pattern.base': 'Please enter a valid mobile number.'
        }),
        remarks: Joi.string().max(500).allow('', null).optional()
    })
};

const updatePartyBranchSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required(),
        id: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
        branchName: Joi.string().trim().max(100).optional(),
        branchCode: Joi.string().trim().max(50).allow('', null).optional(),
        gstin: Joi.string()
            .trim()
            .uppercase()
            .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
            .allow('', null)
            .optional()
            .messages({
                'string.pattern.base': 'Please enter a valid 15-character GSTIN.'
            }),
        stateId: Joi.number().integer().positive().optional(),
        address: Joi.string().trim().max(500).allow('', null).optional(),
        cityId: Joi.number().integer().positive().allow(null).optional(),
        pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).allow('', null).optional().messages({
            'string.pattern.base': 'Please enter a valid 6-digit Indian pincode.'
        }),
        country: Joi.string().trim().max(50).allow('', null).optional(),
        isHeadOffice: Joi.boolean().optional(),
        isDefault: Joi.boolean().optional(),
        email: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional(),
        mobile: Joi.string().trim().pattern(/^(?:(?:\+91|0)?[6-9]\d{9}|1800\d{6,7}|1860\d{6,7}|0\d{8,10}|\d{8,12})$/).allow('', null).optional(),
        remarks: Joi.string().max(500).allow('', null).optional()
    }).min(1)
};

const getPartyBranchSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required(),
        id: Joi.number().integer().positive().required(),
    })
};

const deletePartyBranchSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required(),
        id: Joi.number().integer().positive().required(),
    }),
    query: Joi.object({
        isPermanentDelete: Joi.boolean().default(false).optional()
    })
};

const setDefaultPartyBranchSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required(),
        id: Joi.number().integer().positive().required(),
    })
};

module.exports = {
    getPartyRolesSchema,
    createPartyRolesSchema,
    updatePartyRolesSchema,
    deletePartyRolesSchema,
    restorePartyRolesSchema,
    bulkDeletePartyRolesSchema,
    bulkRestorePartyRolesSchema,
    getPartySchema,
    createPartySchema,
    updatePartySchema,
    deletePartySchema,
    restorePartySchema,
    bulkDeletePartiesSchema,
    bulkRestorePartiesSchema,
    searchPartiesSchema,
    getPartyDetailsSchema,
    getPartyBranchSchema,
    createPartyBranchSchema,
    updatePartyBranchSchema,
    deletePartyBranchSchema,
    setDefaultPartyBranchSchema,
    getPartyContactSchema,
    createPartyContactSchema,
    updatePartyContactSchema,
    deletePartyContactSchema,
    getPartyBankAccountSchema,
    createPartyBankAccountSchema,
    updatePartyBankAccountSchema,
    deletePartyBankAccountSchema
};