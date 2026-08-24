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
    query: Joi.object({
        includeUnmappedPurchaseOrders: Joi.boolean().optional().default(false),
    })
};

// Validation schema for creating a new purchase order
const createPurchaseOrderValidationSchema = {
    body: Joi.object({
        poNo: Joi.string().max(50).required(),
        poDate: Joi.date().required(),
        customerName: Joi.string().max(255).required(),
        status: Joi.string().valid('OPEN', 'COMPLETED', 'CANCELLED').default('OPEN')
    }),
};

// Validation schema for updating an existing purchase order
const updatePurchaseOrderValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
    }),
    body: Joi.object({
        poNo: Joi.string().max(50).optional(),
        poDate: Joi.date().optional(),
        customerName: Joi.string().max(255).optional(),
        status: Joi.string().valid('OPEN', 'COMPLETED', 'CANCELLED').optional()
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

// Validation schema for restoring a purchase order
const restorePurchaseOrderValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
    })
};

// Validation schema for bulk deleting purchase orders
const bulkDeletePurchaseOrdersValidationSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid purchase order ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Purchase Order IDs must be an array.',
                'array.min': 'Please select at least one purchase order.',
                'array.unique': 'Duplicate purchase order IDs are not allowed.',
                'any.required': 'Purchase Order IDs are required.'
            }),
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`
            })
    })
};

// Validation schema for bulk restoring purchase orders
const bulkRestorePurchaseOrdersValidationSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid purchase order ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Purchase Order IDs must be an array.',
                'array.min': 'Please select at least one purchase order to restore.',
                'array.unique': 'Duplicate purchase order IDs are not allowed.',
                'any.required': 'Purchase Order IDs are required.'
            })
    })
};

module.exports = {
    getPurchaseOrderByIdValidationSchema,
    getPurchaseOrdersByInvoiceIdValidationSchema,
    createPurchaseOrderValidationSchema,
    updatePurchaseOrderValidationSchema,
    deletePurchaseOrderValidationSchema,
    restorePurchaseOrderValidationSchema,
    bulkDeletePurchaseOrdersValidationSchema,
    bulkRestorePurchaseOrdersValidationSchema
};