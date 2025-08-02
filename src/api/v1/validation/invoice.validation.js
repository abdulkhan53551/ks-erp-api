const Joi = require("joi");

// Get firm by ID validation schema
const getFirmByIdValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Firm ID'),
  })
};

// Create firm validation schema
const createInvoiceValidationSchema = {
  body: Joi.object({
    invoice_no: Joi.string().max(255).required(),
    invoice_date: Joi.date().required(),

    due_days: Joi.number().integer().min(0).optional(),
    due_date: Joi.date().optional(),

    firm_id: Joi.number().integer().required(),

    customer_name: Joi.string().max(255).required(),
    has_gst: Joi.boolean().required(),
    gst_number: Joi.string().max(20).allow(null, '').when('has_gst', {
      is: true,
      then: Joi.string().max(20).required(),
      otherwise: Joi.string().max(20).allow(null, '')
    }),

    billing_address_id: Joi.number().integer().allow(null),
    shipping_address_id: Joi.number().integer().allow(null),

    has_challan: Joi.boolean().required(),
    has_po: Joi.boolean().required(),
    has_eway_bill: Joi.boolean().required(),

    sub_total: Joi.number().precision(2).min(0).required(),
    discount_percent: Joi.number().precision(2).min(0).max(100).optional(),
    discount_amount: Joi.number().precision(2).min(0).optional(),
    taxable_amount: Joi.number().precision(2).min(0).optional(),
    cgst: Joi.number().precision(2).min(0).optional(),
    sgst: Joi.number().precision(2).min(0).optional(),
    igst: Joi.number().precision(2).min(0).optional(),
    total: Joi.number().precision(2).min(0).required(),
    round_off: Joi.number().precision(2).optional(),
    other: Joi.number().precision(2).optional(),

    payment_status_id: Joi.number().integer().min(1).required(),
    payment_mode_id: Joi.number().integer().min(0).required(),
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
    logoUrl: Joi.string().uri().allow(null, ''),

    gstin: Joi.string()
      .pattern(/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})$/)
      .allow(null, ''),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).allow(null, ''),
    cinNumber: Joi.string().pattern(/^([A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})$/).allow(null, ''),
    tanNumber: Joi.string().pattern(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/).allow(null, ''),

    invoicePrefix: Joi.string().max(10),
    invoiceStartNumber: Joi.number().integer().min(1),
    notesFooter: Joi.string().allow(null, ''),

    // Address details
    addressId: Joi.number().integer().required(),
    email: Joi.string().email().allow(null, ''),
    phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
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