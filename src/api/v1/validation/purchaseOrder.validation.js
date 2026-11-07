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
        partyId: Joi.number().integer().positive().optional().allow(null),
    })
};

// Line item schema for Customer Purchase Order
const purchaseOrderItemSchema = Joi.object({
    id: Joi.number().integer().positive().optional(),
    productId: Joi.number().integer().positive().allow(null).optional(),
    itemName: Joi.string().max(255).required(),
    description: Joi.string().allow('', null).optional(),
    hsnSacCode: Joi.string().max(30).allow('', null).optional(),
    qty: Joi.number().positive().required(),
    invoicedQty: Joi.number().min(0).optional().default(0),
    unit: Joi.string().max(50).optional().default('Nos'),
    rate: Joi.number().min(0).optional().default(0),
    gstRate: Joi.number().min(0).optional().default(0),
    taxableAmount: Joi.number().min(0).optional().default(0),
    cgst: Joi.number().min(0).optional().default(0),
    sgst: Joi.number().min(0).optional().default(0),
    igst: Joi.number().min(0).optional().default(0),
    total: Joi.number().min(0).optional().default(0),
    sortOrder: Joi.number().integer().min(0).optional().default(0)
});

// Validation schema for creating a new purchase order
const createPurchaseOrderValidationSchema = {
    body: Joi.object({
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        poNo: Joi.string().max(50).required(),
        poDate: Joi.date().required(),
        customerName: Joi.string().max(255).required(),
        billingAddress: Joi.string().allow('', null).optional(),
        deliveryAddress: Joi.string().allow('', null).optional(),
        deliveryDueDate: Joi.date().allow(null).optional(),
        validUntil: Joi.date().allow(null).optional(),
        paymentTerms: Joi.string().max(255).allow('', null).optional(),
        advancePercentage: Joi.number().min(0).max(100).optional().default(0),
        status: Joi.string().valid('OPEN', 'PARTIALLY_INVOICED', 'COMPLETED', 'CANCELLED').default('OPEN'),
        notes: Joi.string().allow('', null).optional(),
        items: Joi.array().items(purchaseOrderItemSchema).optional().default([])
    }),
};

// Validation schema for updating an existing purchase order
const updatePurchaseOrderValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Purchase Order ID'),
    }),
    body: Joi.object({
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        poNo: Joi.string().max(50).optional(),
        poDate: Joi.date().optional(),
        customerName: Joi.string().max(255).optional(),
        billingAddress: Joi.string().allow('', null).optional(),
        deliveryAddress: Joi.string().allow('', null).optional(),
        deliveryDueDate: Joi.date().allow(null).optional(),
        validUntil: Joi.date().allow(null).optional(),
        paymentTerms: Joi.string().max(255).allow('', null).optional(),
        advancePercentage: Joi.number().min(0).max(100).optional(),
        status: Joi.string().valid('OPEN', 'PARTIALLY_INVOICED', 'COMPLETED', 'CANCELLED').optional(),
        notes: Joi.string().allow('', null).optional(),
        items: Joi.array().items(purchaseOrderItemSchema).optional()
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