const Joi = require("joi");

// Get firm by ID validation schema
const getFirmByIdValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Firm ID'),
  })
};

// Create firm validation schema
const createFirmValidationSchema = {
  body: Joi.object({
    firmName: Joi.string().max(255).required(),
    tradeName: Joi.string().max(255).allow(null, ''),
    firmType: Joi.string()
      .valid('Proprietorship', 'Partnership', 'LLP', 'Pvt Ltd', 'Public Ltd', 'Other')
      .required(),
    businessActivity: Joi.string().max(1000).allow(null, ''),
    logoUrl: Joi.string().uri().max(500).allow(null, '').optional(),
    logoPublicId: Joi.string().max(255).allow(null, '').optional(),

    gstin: Joi.string()
      .pattern(/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})$/)
      .allow(null, ''),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).allow(null, ''),
    cinNumber: Joi.string().pattern(/^([A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})$/).allow(null, ''),
    tanNumber: Joi.string().pattern(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/).allow(null, ''),

    invoicePrefix: Joi.string().max(10).default('INV'),
    invoiceStartNumber: Joi.string().pattern(/^\d+$/).min(1).max(6).required().default("1")
      .messages({
        "string.empty": "Invoice start number is required.",
        "string.pattern.base": "Invoice start number must contain only digits.",
        "string.min": "Invoice start number cannot be empty.",
      }),
    notesFooter: Joi.string().allow(null, ''),

    // Address details
    email: Joi.string().email().allow(null, ''),
    phoneNumber: Joi.string().pattern(/^(?:(?:\+91|0)?[6-9]\d{9}|1800\d{6,7}|1860\d{6,7}|0\d{8,10}|\d{8,12})$/).allow(null, ''),
    website: Joi.string().uri().allow(null, ''),

    addressLine1: Joi.string().max(500).allow(null, ''),
    cityId: Joi.number().integer().required(),
    stateId: Joi.number().integer().required(),
    pincode: Joi.number().integer().min(100000).max(999999).required(),
    country: Joi.string().default('India'),

    // Bank account details
    upiId: Joi.string().max(100).allow(null, ''),
    accountHolderName: Joi.string().max(255).required(),
    accountNumber: Joi.string().pattern(/^\d{9,18}$/).required(),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
    bankName: Joi.string().max(255).required(),
    branchName: Joi.string().max(255).allow(null, ''),
    accountType: Joi.string().valid('current', 'savings').allow(null, ''),

    createdBy: Joi.number().integer().allow(null),
    updatedBy: Joi.number().integer().allow(null)
  })
};

// Update firm validation schema
const updateFirmValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Firm ID'),
  }),
  body: Joi.object({
    firmName: Joi.string().max(255),
    tradeName: Joi.string().max(255).allow(null, ''),
    firmType: Joi.string().valid('Proprietorship', 'Partnership', 'LLP', 'Pvt Ltd', 'Public Ltd', 'Other'),
    businessActivity: Joi.string().max(255).allow(null, ''),
    logoUrl: Joi.string().uri().max(500).allow(null, '').optional(),
    logoPublicId: Joi.string().max(255).allow(null, '').optional(),

    gstin: Joi.string()
      .pattern(/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})$/)
      .allow(null, ''),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).allow(null, ''),
    cinNumber: Joi.string().pattern(/^([A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})$/).allow(null, ''),
    tanNumber: Joi.string().pattern(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/).allow(null, ''),

    invoicePrefix: Joi.string().max(10),
    invoiceStartNumber: Joi.string().pattern(/^\d+$/).min(1).max(6).required().default("1")
      .messages({
        "string.empty": "Invoice start number is required.",
        "string.pattern.base": "Invoice start number must contain only digits.",
        "string.min": "Invoice start number cannot be empty.",
      }),
    notesFooter: Joi.string().allow(null, ''),

    // Address details
    addressId: Joi.number().integer().required(),
    email: Joi.string().email().allow(null, ''),
    phoneNumber: Joi.string().pattern(/^(?:(?:\+91|0)?[6-9]\d{9}|1800\d{6,7}|1860\d{6,7}|0\d{8,10}|\d{8,12})$/).allow(null, ''),
    website: Joi.string().uri().allow(null, ''),

    addressLine1: Joi.string().max(255).allow(null, ''),
    cityId: Joi.number().integer().allow(null),
    stateId: Joi.number().integer().allow(null),
    pincode: Joi.number().integer().min(100000).max(999999).allow(null),
    country: Joi.string(),

    // Bank account details
    bankAccountId: Joi.number().integer().required(),
    upiId: Joi.string().max(100).allow(null, ''),
    accountHolderName: Joi.string().max(255),
    accountNumber: Joi.string().pattern(/^\d{9,18}$/),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    bankName: Joi.string().max(255),
    branchName: Joi.string().max(255).allow(null, ''),
    accountType: Joi.string().valid('current', 'savings').allow(null, ''),

    createdBy: Joi.number().integer().allow(null),
    updatedBy: Joi.number().integer().allow(null)
  }).min(1)
};


// Delete firm validation schema
const deleteFirmValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Firm ID'),
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
  getFirmByIdValidationSchema,
  createFirmValidationSchema,
  updateFirmValidationSchema,
  deleteFirmValidationSchema
};