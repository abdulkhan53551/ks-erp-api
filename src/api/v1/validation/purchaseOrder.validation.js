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
        invoice_id: Joi.number().integer().required().label('Invoice ID'),
    }),
};

// Validation schema for creating a new purchase order
const createPurchaseOrderValidationSchema = {
    body: Joi.object({
        invoice_id: Joi.number().integer().positive().optional(),
        po_no: Joi.string().max(50).required(),
        po_date: Joi.date().required(),
        customer_name: Joi.string().max(255).required(),
        is_invoiced: Joi.boolean().default(false),
    }),
};

// Validation schema for updating an existing purchase order
const updatePurchaseOrderValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
    }),
    body: Joi.object({
        invoice_id: Joi.number().integer().positive().optional(),
        po_no: Joi.string().max(50).required(),
        po_date: Joi.date().required(),
        customer_name: Joi.string().max(255).required(),
        is_invoiced: Joi.boolean().default(false),
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