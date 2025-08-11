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

    billingAddressId: Joi.number().integer().allow(null),
    shippingAddressId: Joi.number().integer().allow(null),

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
  })
};

// Update invoice validation schema
const updateInvoiceValidationSchema = {
  body: Joi.object({
    invoice_no: Joi.string().max(255).required(),
    invoice_date: Joi.date().required(),

    due_days: Joi.number().integer().min(0),
    due_date: Joi.date().required(),

    customer_name: Joi.string().max(255).required(),
    has_gst: Joi.boolean().default(false),

    gst_number: Joi.string()
      .allow(null, '')
      .when('has_gst', {
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

    billing_address_id: Joi.number().integer().allow(null),
    shipping_address_id: Joi.number().integer().allow(null),

    billingAddress: Joi.object({
      invoiceId: Joi.number().integer().required(),
      email: Joi.string().email().allow(null, ''),
      phone_number: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
      website: Joi.string().uri().allow(null, ''),
      address_line1: Joi.string().max(255).allow(null, ''),
      city_id: Joi.number().integer().required(),
      state_id: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    shippingAddress: Joi.object({
      invoiceId: Joi.number().integer().required(),
      email: Joi.string().email().allow(null, ''),
      phone_number: Joi.string().pattern(/^[6-9]\d{9}$/).allow(null, ''),
      address_line1: Joi.string().max(255).allow(null, ''),
      city_id: Joi.number().integer().required(),
      state_id: Joi.number().integer().required(),
      pincode: Joi.number().integer().min(100000).max(999999).allow(null)
    }),

    has_challan: Joi.boolean().default(false),
    has_po: Joi.boolean().default(false),
    has_eway_bill: Joi.boolean().default(false),

    sub_total: Joi.number().precision(2).min(0),
    discount_percent: Joi.number().precision(2).min(0).max(100).allow(null, 0),
    discount_amount: Joi.number().precision(2).min(0).allow(null, 0),
    taxable_amount: Joi.number().precision(2).min(0).allow(null, 0),
    cgst: Joi.number().precision(2).min(0).allow(null, 0),
    sgst: Joi.number().precision(2).min(0).allow(null, 0),
    igst: Joi.number().precision(2).min(0).allow(null, 0),
    total: Joi.number().precision(2).min(0),
    round_off: Joi.number().precision(2).allow(null, 0),
    other: Joi.number().precision(2).allow(null, 0),

    payment_status_id: Joi.number().integer().min(1),
    payment_mode_id: Joi.number().integer().min(0)
  })
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
    invoice_id: Joi.number().integer().required().label('Invoice ID'),
  })
};

// Get purchase order by invoice ID validation schema
const getPurchaseOrderForInvoiceByIdValidationSchema = {
  params: Joi.object({
    invoice_id: Joi.number().integer().required().label('Invoice ID'),
  })
};

// Get eway bill by invoice ID validation schema
const getEwaybillForInvoiceByIdValidationSchema = {
  params: Joi.object({
    invoice_id: Joi.number().integer().required().label('Invoice ID'),
  })
};

module.exports = {
  getInvoiceByIdValidationSchema,
  createInvoiceValidationSchema,
  updateInvoiceValidationSchema,
  deleteInvoiceValidationSchema,
  getChallansForInvoiceByIdValidationSchema,
  getPurchaseOrderForInvoiceByIdValidationSchema,
  getEwaybillForInvoiceByIdValidationSchema
};