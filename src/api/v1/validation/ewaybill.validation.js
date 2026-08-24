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
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        ewayBillNo: Joi.string().max(50).required(),
        ewayBillDate: Joi.date().required(),
        ewaybillValidUpto: Joi.date()
            .min(Joi.ref('ewayBillDate')) // must be same or after ewayBillDate
            .required()
            .messages({
                'date.min': '"ewaybillValidUpto" must be greater than or equal to "ewayBillDate"',
            }),
        customerName: Joi.string().max(255).required()
    }),
};

// Validation schema for updating an existing E-Way Bill
const updateEWayBillValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('E-Way Bill ID'),
    }),
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        ewayBillNo: Joi.string().max(50).optional(),
        ewayBillDate: Joi.date().optional(),
        ewaybillValidUpto: Joi.date()
            .min(Joi.ref('ewayBillDate')) // must be same or after ewayBillDate
            .optional()
            .messages({
                'date.min': '"ewaybillValidUpto" must be greater than or equal to "ewayBillDate"',
            }),
        customerName: Joi.string().max(255).optional()
    }).min(1),
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

// Validation schema for restoring an E-Way Bill
const restoreEWayBillValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('E-Way Bill ID'),
    })
};

// Validation schema for bulk deleting E-Way Bills
const bulkDeleteEWayBillsValidationSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid e-way bill ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'E-Way Bill IDs must be an array.',
                'array.min': 'Please select at least one e-way bill.',
                'array.unique': 'Duplicate e-way bill IDs are not allowed.',
                'any.required': 'E-Way Bill IDs are required.'
            }),
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`
            })
    })
};

// Validation schema for bulk restoring E-Way Bills
const bulkRestoreEWayBillsValidationSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid e-way bill ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'E-Way Bill IDs must be an array.',
                'array.min': 'Please select at least one e-way bill to restore.',
                'array.unique': 'Duplicate e-way bill IDs are not allowed.',
                'any.required': 'E-Way Bill IDs are required.'
            })
    })
};

module.exports = {
    getEWayBillByIdValidationSchema,
    getEWayBillsByInvoiceValidationSchema,
    createEWayBillValidationSchema,
    updateEWayBillValidationSchema,
    deleteEWayBillValidationSchema,
    restoreEWayBillValidationSchema,
    bulkDeleteEWayBillsValidationSchema,
    bulkRestoreEWayBillsValidationSchema
};