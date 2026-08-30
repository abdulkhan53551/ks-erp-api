const { default: Decimal } = require("decimal.js");
const Joi = require("joi");

// Get invoice by ID validation schema
const getInvoiceByIdValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  })
};

// Create invoice validation schema
const createInvoiceValidationSchema = {
  body: Joi.object({
    invoiceNo: Joi.string().max(255).required(),
    invoiceDate: Joi.date().required(),

    dueDays: Joi.number().integer().min(0).required(),
    dueDate: Joi.date().required(),

    customerName: Joi.string().max(255).required(),
    hasGst: Joi.boolean().default(false),
    gstNumber: Joi.string()
      .allow(null, '')
      .when('hasGst', {
        is: true,
        then: Joi.string()
          .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
          .required()
          .messages({
            'string.pattern.base': 'GST number must be a valid 15-character GSTIN',
            'any.required': 'GST number is required when GST is enabled'
          }),
        otherwise: Joi.string().allow(null, '')
      }),

    billingAddress: Joi.object({
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, '').messages({
        'string.pattern.base': 'Billing phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
        'string.base': 'Billing phone must be text',
      }),
      website: Joi.string().uri().allow(null, ''),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    shippingAddress: Joi.object({
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, '').messages({
        'string.pattern.base': 'Shipping phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
        'string.base': 'Shipping phone must be text',
      }),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    hasChallan: Joi.boolean().default(false),
    hasPo: Joi.boolean().default(false),
    hasEwayBill: Joi.boolean().default(false),

    // Challans
    challanIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([])
      .when('hasChallan', {
        is: true,
        then: Joi.array().min(1).required().messages({
          'any.required': 'Challan IDs are required when challan is selected.',
          'array.min': 'Please select at least one challan.'
        })
      }),

    // Purchase Orders
    poIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([])
      .when('hasPo', {
        is: true,
        then: Joi.array().min(1).required().messages({
          'any.required': 'Purchase order IDs are required when PO is selected.',
          'array.min': 'Please select at least one PO.'
        })
      }),

    // E-Way Bills
    ewayBillIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([])
      .when('hasEwayBill', {
        is: true,
        then: Joi.array().min(1).required().messages({
          'any.required': 'E-way bill IDs are required when e-way bill is selected.',
          'array.min': 'Please select at least one e-way bill.'
        })
      }),

    items: Joi.array().items(
      Joi.object({
        productId: Joi.number().integer().positive().allow(null, 0).optional(),
        description: Joi.string().max(255).required(),
        hsnSacCode: Joi.string().max(20).allow(null, ''),
        qty: Joi.number().precision(2).min(0).required(),
        itemUnitId: Joi.number().integer(),
        rate: Joi.number().precision(2).min(0).required(),
        discountPercent: Joi.number().precision(2).min(0).max(100).empty([null, ""]).default(0),
        discountAmount: Joi.number().precision(2).min(0).allow(0),
        subTotal: Joi.number().precision(2).min(0).allow(0),
        taxableAmount: Joi.number().precision(2).min(0).allow(0),
        gstSlabId: Joi.number().integer().required(),
        cgst: Joi.number().precision(2).min(0).default(0),
        sgst: Joi.number().precision(2).min(0).default(0),
        igst: Joi.number().precision(2).min(0).default(0),
        total: Joi.number().precision(2).min(0).required().allow(0)
      })
        .custom(invoiceItemCustomValidation)
        .messages({ 'any.invalid': '{{#customMessage}}' })
    ).min(1).required(),

    subTotal: Joi.number().precision(2).min(0).required(),
    discountPercent: Joi.number().precision(2).min(0).max(100).default(0).allow(0),
    discountAmount: Joi.number().precision(2).min(0).default(0).allow(0),
    taxableAmount: Joi.number().precision(2).min(0).default(0).allow(0),
    cgst: Joi.number().precision(2).min(0).default(0).allow(0),
    sgst: Joi.number().precision(2).min(0).default(0).allow(0),
    igst: Joi.number().precision(2).min(0).default(0).allow(0),
    total: Joi.number().precision(2).min(0).required(),
    roundOff: Joi.number().precision(2).default(0).allow(0),
    other: Joi.number().precision(2).default(0).allow(0),

    paymentStatusId: Joi.number().integer().min(1).required(),
    paymentModeId: Joi.number().integer().min(0).required()
  })
    .custom(validateCreateOrUpdateCustom)
    .messages({ 'any.invalid': '{{#customMessage}}' })
};

// Update invoice validation schema
const updateInvoiceValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Invoice ID'),
  }),
  body: Joi.object({
    invoiceNo: Joi.string().max(255).required(),
    invoiceDate: Joi.date().required(),

    dueDays: Joi.number().integer().min(0),
    dueDate: Joi.date().required(),

    customerName: Joi.string().max(255).required(),
    hasGst: Joi.boolean().default(false),

    gstNumber: Joi.string()
      .allow(null, '')
      .when('hasGst', {
        is: true,
        then: Joi.string()
          .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
          .required()
          .messages({
            'string.pattern.base': 'GST number must be a valid 15-character GSTIN',
            'any.required': 'GST number is required when GST is enabled'
          }),
        otherwise: Joi.string().allow(null, '')
      }),

    billingAddressId: Joi.number().integer().allow(null),
    shippingAddressId: Joi.number().integer().allow(null),

    billingAddress: Joi.object({
      id: Joi.number().integer().required(),
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, '').messages({
        'string.pattern.base': 'Billing phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
        'string.base': 'Billing phone number must be text',
      }),
      website: Joi.string().uri().allow(null, ''),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    shippingAddress: Joi.object({
      id: Joi.number().integer().required(),
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, '').messages({
        'string.pattern.base': 'Shipping phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
        'string.base': 'Shipping phone number must be text',
      }),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    hasChallan: Joi.boolean().default(false),
    hasPo: Joi.boolean().default(false),
    hasEwayBill: Joi.boolean().default(false),

    // Challans
    challanIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([])
      .when('hasChallan', {
        is: true,
        then: Joi.array().min(1).required().messages({
          'any.required': 'Challan IDs are required when challan is selected.',
          'array.min': 'Please select at least one challan.'
        })
      }),

    // Purchase Orders
    poIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([])
      .when('hasPo', {
        is: true,
        then: Joi.array().min(1).required().messages({
          'any.required': 'Purchase order IDs are required when PO is selected.',
          'array.min': 'Please select at least one PO.'
        })
      }),

    // E-Way Bills
    ewayBillIds: Joi.array()
      .items(Joi.number().integer().positive())
      .default([])
      .when('hasEwayBill', {
        is: true,
        then: Joi.array().min(1).required().messages({
          'any.required': 'E-way bill IDs are required when e-way bill is selected.',
          'array.min': 'Please select at least one e-way bill.'
        })
      }),

    // Invoice items validation for update
    items: Joi.array().items(
      Joi.object({
        id: Joi.number().integer().allow(null), // For identifying existing items
        productId: Joi.number().integer().positive().allow(null, 0).optional(),
        description: Joi.string().max(255).required(),
        hsnSacCode: Joi.string()
          .allow(null, "")        // ✅ allows empty string
          .pattern(/^\d{4}$|^\d{6}$|^\d{8}$/)
          .messages({
            "string.pattern.base": "HSN/SAC Code must be 4, 6, or 8 digits numeric."
          }),
        qty: Joi.number().precision(2).min(0).required(),
        itemUnitId: Joi.number().integer(),
        rate: Joi.number().precision(2).min(0).required(),
        discountPercent: Joi.number().precision(2).min(0).max(100).default(0).allow(0, null).empty(null),
        discountAmount: Joi.number().precision(2).min(0).default(0).allow(0, null).empty(null),
        subTotal: Joi.number().precision(2).min(0).allow(0),
        taxableAmount: Joi.number().precision(2).min(0).allow(0, null),
        gstSlabId: Joi.number().integer().required(),
        cgst: Joi.number().precision(2).min(0).allow(0, null),
        sgst: Joi.number().precision(2).min(0).allow(0, null),
        igst: Joi.number().precision(2).min(0).default(0).allow(0, null).empty(null),
        total: Joi.number().precision(2).min(0).allow(0).required()
      })
        .custom(invoiceItemCustomValidation)
        .messages({ 'any.invalid': '{{#customMessage}}' })
    ).min(1).required(),

    subTotal: Joi.number().precision(2).min(0),
    discountPercent: Joi.number().precision(2).min(0).max(100).default(0).allow(null, 0).empty(null),
    discountAmount: Joi.number().precision(2).min(0).default(0).allow(null, 0).empty(null),
    taxableAmount: Joi.number().precision(2).min(0).allow(null, 0),
    cgst: Joi.number().precision(2).min(0).allow(0),
    sgst: Joi.number().precision(2).min(0).allow(0),
    igst: Joi.number().precision(2).min(0).allow(0),
    total: Joi.number().precision(2).min(0),
    roundOff: Joi.number().precision(2).allow(0),
    other: Joi.number().precision(2).default(0).allow(0),

    paymentStatusId: Joi.number().integer().min(1),
    paymentModeId: Joi.number().integer().min(0)
  })
    .custom(validateCreateOrUpdateCustom)
    .messages({ 'any.invalid': '{{#customMessage}}' })
};

// Delete invoice validation schema
const deleteInvoiceValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Invoice ID'),
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

// Restore invoice validation schema
const restoreInvoiceValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().required().label('Invoice ID'),
  })
};

// Bulk delete invoices validation schema
const bulkDeleteInvoicesValidationSchema = {
  body: Joi.object({
    ids: Joi.array()
      .items(Joi.number().integer().positive().messages({
        'number.base': 'Invalid invoice ID.'
      }))
      .min(1)
      .unique()
      .required()
      .messages({
        'array.base': 'Invoice IDs must be an array.',
        'array.min': 'Please select at least one invoice.',
        'array.unique': 'Duplicate invoice IDs are not allowed.',
        'any.required': 'Invoice IDs are required.'
      }),
    isPermanentDelete: Joi.boolean()
      .default(false)
      .label('Is Permanent Delete')
      .messages({
        'boolean.base': `"isPermanentDelete" must be a boolean value.`
      })
  })
};

// Bulk restore invoices validation schema
const bulkRestoreInvoicesValidationSchema = {
  body: Joi.object({
    ids: Joi.array()
      .items(Joi.number().integer().positive().messages({
        'number.base': 'Invalid invoice ID.'
      }))
      .min(1)
      .unique()
      .required()
      .messages({
        'array.base': 'Invoice IDs must be an array.',
        'array.min': 'Please select at least one invoice to restore.',
        'array.unique': 'Duplicate invoice IDs are not allowed.',
        'any.required': 'Invoice IDs are required.'
      })
  })
};

// Custom validation function for create/update
function validateCreateOrUpdateCustom(item, helpers) {
  const gross = new Decimal(item.subTotal || 0);

  // Rule: If discountPercent > 0 → discountAmount must be > 0
  if (item.discountPercent && item.discountPercent > 0) {
    if (!item.discountAmount || item.discountAmount <= 0) {
      return helpers.error("any.invalid", { customMessage: "Discount amount must be provided when discount percent is greater than 0" });
    }
  }

  // If both provided → check consistency
  if (item.discountPercent > 0 && item.discountAmount > 0) {
    const expected = gross.times(item.discountPercent).div(100);
    if (!expected.equals(item.discountAmount)) {
      return helpers.error("any.invalid", { customMessage: "Discount percent and discount amount mismatch" });
    }
  }

  // Rule: discount amount cannot exceed gross
  if (gross.lessThan(item.discountAmount || 0)) {
    return helpers.error("any.invalid", { customMessage: "Discount amount cannot exceed gross amount of invoice" });
  }

  return item;
}

// Custom validation function for invoice items
function invoiceItemCustomValidation(item, helpers) {
  const qty = new Decimal(item.qty || 0);
  const rate = new Decimal(item.rate || 0);
  const grossAmount = qty.times(rate);

  // Rule 1: discount amount <= gross
  if (grossAmount.lessThan(item.discountAmount || 0)) {
    return helpers.error("any.invalid", { customMessage: "Discount amount cannot exceed gross amount (rate * qty) of invoice item" });
  }

  return item;
}

module.exports = {
  getInvoiceByIdValidationSchema,
  createInvoiceValidationSchema,
  updateInvoiceValidationSchema,
  deleteInvoiceValidationSchema,
  restoreInvoiceValidationSchema,
  bulkDeleteInvoicesValidationSchema,
  bulkRestoreInvoicesValidationSchema
};