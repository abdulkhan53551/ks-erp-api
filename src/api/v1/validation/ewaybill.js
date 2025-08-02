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
        invoice_id: Joi.number().integer().required().label('Invoice ID'),
    }),
};

// Validation schema for creating a new E-Way Bill
const createEWayBillValidationSchema = {
    body: Joi.object({
        ewaybill_no: Joi.string().max(50).required(),
        ewaybill_date: Joi.date().required(),
        customer_name: Joi.string().max(255).required(),
        is_invoiced: Joi.boolean().default(false),
        invoice_id: Joi.number().integer().positive().default(0).optional(),
    }),
};

// Validation schema for updating an existing E-Way Bill
const updateEWayBillValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('E-Way Bill ID'),
    }),
    body: Joi.object({
        ewaybill_no: Joi.string().max(50).required(),
        ewaybill_date: Joi.date().required(),
        customer_name: Joi.string().max(255).required(),
        is_invoiced: Joi.boolean().default(false),
        invoice_id: Joi.number().integer().positive().default(0).optional(),
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
    deleteEWayBillValidationSchema
};