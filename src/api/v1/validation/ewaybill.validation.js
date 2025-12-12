const Joi = require('joi');

// Validation schemas for E-Way Bill operations
const getEWayBillByIdValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('E-Way Bill ID'),
    }),
};

// Validation schema for getting E-Way Bills by Invoice ID
const getEWayBillsByInvoiceValidationSchema = {
    params: Joi.object({
        invoiceId: Joi.number().integer().required().label('Invoice ID'),
    }),
    query: Joi.object({
        includeUnmappedEwayBills: Joi.boolean().optional().default(false),
    })
};

// Validation schema for creating a new E-Way Bill
const createEWayBillValidationSchema = {
    body: Joi.object({
        ewayBillNo: Joi.string().max(50).required(),
        ewayBillDate: Joi.date().required(),
        ewaybillValidUpto: Joi.date()
            .min(Joi.ref('ewayBillDate')) // must be same or after ewayBillDate
            .required()
            .messages({
                'date.min': '"ewaybillValidUpto" must be greater than or equal to "ewayBillDate"',
            }),
        customerName: Joi.string().max(255).required(),
        isInvoiced: Joi.boolean().when('invoiceId', {
            is: Joi.number().integer().positive(),
            then: Joi.boolean().default(false),
            otherwise: Joi.valid(false).default(false)
        }),
        invoiceId: Joi.number().integer().positive().allow(null).default(0),
    }),
};

// Validation schema for updating an existing E-Way Bill
const updateEWayBillValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('E-Way Bill ID'),
    }),
    body: Joi.object({
        ewayBillNo: Joi.string().max(50).required(),
        ewayBillDate: Joi.date().required(),
        ewaybillValidUpto: Joi.date()
            .min(Joi.ref('ewayBillDate')) // must be same or after ewayBillDate
            .required()
            .messages({
                'date.min': '"ewaybillValidUpto" must be greater than or equal to "ewayBillDate"',
            }),
        customerName: Joi.string().max(255).required(),
        isInvoiced: Joi.boolean().when('invoiceId', {
            is: Joi.number().integer().positive(),
            then: Joi.boolean().default(false),
            otherwise: Joi.valid(false).default(false)
        }),
        invoiceId: Joi.number().integer().positive().allow(null).default(0),
    }),
};

// Validation schema for deleting an E-Way Bill
const deleteEWayBillValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('E-Way Bill ID'),
    }),
    query: Joi.object({
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`,
            }),
    }),
};

module.exports = {
    getEWayBillByIdValidationSchema,
    getEWayBillsByInvoiceValidationSchema,
    createEWayBillValidationSchema,
    updateEWayBillValidationSchema,
    deleteEWayBillValidationSchema,
};