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
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
      website: Joi.string().uri().allow(null, ''),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    shippingAddress: Joi.object({
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    hasChallan: Joi.boolean().default(false),
    hasPo: Joi.boolean().default(false),
    hasEwayBill: Joi.boolean().default(false),

    items: Joi.array().items(
      Joi.object({
        description: Joi.string().max(255).required(),
        hsnSacCode: Joi.string().max(20).allow(null, ''),
        qty: Joi.number().precision(2).min(0).required(),
        itemUnitId: Joi.number().integer().allow(0),
        rate: Joi.number().precision(2).min(0).required(),
        discountPercent: Joi.number().precision(2).min(0).max(100).allow(0),
        discountAmount: Joi.number().precision(2).min(0).allow(0),
        taxableAmount: Joi.number().precision(2).min(0).allow(0),
        gstSlabId: Joi.number().integer().required(),
        cgst: Joi.number().precision(2).min(0).allow(0),
        sgst: Joi.number().precision(2).min(0).allow(0),
        igst: Joi.number().precision(2).min(0).allow(0),
        total: Joi.number().precision(2).min(0).required().allow(0)
      }).custom(invoiceItemCustomValidation)
    ).min(1).required(),

    subTotal: Joi.number().precision(2).min(0).required(),
    discountPercent: Joi.number().precision(2).min(0).max(100).allow(null, 0),
    discountAmount: Joi.number().precision(2).min(0).allow(null, 0),
    taxableAmount: Joi.number().precision(2).min(0).allow(null, 0),
    cgst: Joi.number().precision(2).min(0).allow(null, 0),
    sgst: Joi.number().precision(2).min(0).allow(null, 0),
    igst: Joi.number().precision(2).min(0).allow(null, 0),
    total: Joi.number().precision(2).min(0).required(),
    roundOff: Joi.number().precision(2).allow(null, 0),
    other: Joi.number().precision(2).allow(null, 0),

    paymentStatusId: Joi.number().integer().min(1).required(),
    paymentModeId: Joi.number().integer().min(0).required()
  }).custom(validateCreateOrUpdateCustom)
};

// Update invoice validation schema
const updateInvoiceValidationSchema = {
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
      invoiceId: Joi.number().integer().required(),
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
      website: Joi.string().uri().allow(null, ''),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    shippingAddress: Joi.object({
      invoiceId: Joi.number().integer().required(),
      email: Joi.string().email().allow(null, ''),
      phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
      addressLine1: Joi.string().max(255).allow(null, ''),
      cityId: Joi.number().integer().required(),
      stateId: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    hasChallan: Joi.boolean().default(false),
    hasPo: Joi.boolean().default(false),
    hasEwayBill: Joi.boolean().default(false),

    // Invoice items validation for update
    items: Joi.array().items(
      Joi.object({
        id: Joi.number().integer().allow(null), // For identifying existing items
        description: Joi.string().max(255).required(),
        hsnSacCode: Joi.string().max(20).allow(null, ''),
        qty: Joi.number().precision(2).min(0).required(),
        itemUnitId: Joi.number().integer().allow(0, null),
        rate: Joi.number().precision(2).min(0).required(),
        discountPercent: Joi.number().precision(2).min(0).max(100).allow(0, null),
        discountAmount: Joi.number().precision(2).min(0).allow(0, null),
        taxableAmount: Joi.number().precision(2).min(0).allow(0, null),
        gstSlabId: Joi.number().integer().required(),
        cgst: Joi.number().precision(2).min(0).allow(0, null),
        sgst: Joi.number().precision(2).min(0).allow(0, null),
        igst: Joi.number().precision(2).min(0).allow(0, null),
        total: Joi.number().precision(2).min(0).allow(0).required()
      }).custom(invoiceItemCustomValidation)
    ).min(1).required(),

    subTotal: Joi.number().precision(2).min(0),
    discountPercent: Joi.number().precision(2).min(0).max(100).allow(null, 0),
    discountAmount: Joi.number().precision(2).min(0).allow(null, 0),
    taxableAmount: Joi.number().precision(2).min(0).allow(null, 0),
    cgst: Joi.number().precision(2).min(0).allow(null, 0),
    sgst: Joi.number().precision(2).min(0).allow(null, 0),
    igst: Joi.number().precision(2).min(0).allow(null, 0),
    total: Joi.number().precision(2).min(0),
    roundOff: Joi.number().precision(2).allow(null, 0),
    other: Joi.number().precision(2).allow(null, 0),

    paymentStatusId: Joi.number().integer().min(1),
    paymentModeId: Joi.number().integer().min(0)
  }).custom(validateCreateOrUpdateCustom)
};

// Delete invoice validation schema
const deleteInvoiceValidationSchema = {
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

// Get challan by invoice ID validation schema
const getChallansForInvoiceByIdValidationSchema = {
  params: Joi.object({
    invoiceId: Joi.number().integer().required().label('Invoice ID'),
  })
};

// Get purchase order by invoice ID validation schema
const getPurchaseOrderForInvoiceByIdValidationSchema = {
  params: Joi.object({
    invoiceId: Joi.number().integer().required().label('Invoice ID'),
  })
};

// Get eway bill by invoice ID validation schema
const getEwaybillForInvoiceByIdValidationSchema = {
  params: Joi.object({
    invoiceId: Joi.number().integer().required().label('Invoice ID'),
  })
};

// Custom validation function for create/update
const validateCreateOrUpdateCustom = (item, helpers) => {
  const gross = new Decimal(item.subTotal);

  // Rule: If discountPercent > 0 → discountAmount must be > 0
  if (item.discountPercent && item.discountPercent > 0) {
    if (!item.discountAmount || item.discountAmount <= 0) {
      return helpers.error("any.invalid", { message: "Discount amount must be provided when discount percent is greater than 0" });
    }
  }

  // If both provided → check consistency
  if (item.discountPercent > 0 && item.discountAmount > 0) {
    const expected = gross.times(item.discountPercent).div(100);
    if (!expected.equals(item.discountAmount)) {
      return helpers.error("any.invalid", { message: "Discount percent and discount amount mismatch" });
    }
  }

  // Rule: discount amount cannot exceed gross
  if (gross.lessThan(item.discountAmount)) {
    return helpers.error("any.invalid", { message: "Discount amount cannot exceed gross amount" });
  }

  return item;
}

// Custom validation function for invoice items
const invoiceItemCustomValidation = (item, helpers) => {
  const qty = new Decimal(item.qty || 0);
  const rate = new Decimal(item.rate || 0);
  const grossAmount = qty.times(rate);

  // Rule 1: discount amount <= gross
  if (grossAmount.lessThan(item.discountAmount)) {
    return helpers.error("any.invalid", { message: "Discount amount cannot exceed gross amount (rate * qty)" });
  }

  return item;
}

module.exports = {
  getInvoiceByIdValidationSchema,
  createInvoiceValidationSchema,
  updateInvoiceValidationSchema,
  deleteInvoiceValidationSchema,
  getChallansForInvoiceByIdValidationSchema,
  getPurchaseOrderForInvoiceByIdValidationSchema,
  getEwaybillForInvoiceByIdValidationSchema
};