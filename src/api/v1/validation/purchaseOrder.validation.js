const Joi = require('joi');

// Validation schemas for Purchase Order operations
const getPurchaseOrderByIdValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
    }),
};

// Validation schema for getting purchase orders by invoice ID
const getPurchaseOrdersByInvoiceIdValidationSchema = {
    params: Joi.object({
        invoiceId: Joi.number().integer().required().label('Invoice ID'),
    }),
};

// Validation schema for creating a new purchase order
const createPurchaseOrderValidationSchema = {
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        poNo: Joi.string().max(50).required(),
        poDate: Joi.date().required(),
        customerName: Joi.string().max(255).required(),
        isInvoiced: Joi.boolean().when('invoiceId', {
            is: Joi.number().integer().positive(),
            then: Joi.boolean().default(false),
            otherwise: Joi.valid(false).default(false)
        })
    }),
};

// Validation schema for updating an existing purchase order
const updatePurchaseOrderValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
    }),
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        poNo: Joi.string().max(50).required(),
        poDate: Joi.date().required(),
        customerName: Joi.string().max(255).required(),
        isInvoiced: Joi.boolean().when('invoiceId', {
            is: Joi.number().integer().positive(),
            then: Joi.boolean().default(false),
            otherwise: Joi.valid(false).default(false)
        })
    }).min(1), // Ensure at least one field is provided
};

// Validation schema for deleting a purchase order
const deletePurchaseOrderValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
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
    getPurchaseOrderByIdValidationSchema,
    getPurchaseOrdersByInvoiceIdValidationSchema,
    createPurchaseOrderValidationSchema,
    updatePurchaseOrderValidationSchema,
    deletePurchaseOrderValidationSchema
};