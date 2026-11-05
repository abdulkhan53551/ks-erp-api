const Joi = require('joi');

// Schema: Get invoice challan by challan ID
const getInvoiceChallanByIdValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Challan ID'),
    }),
};

// Schema: Get invoice challans by invoice ID
const getInvoiceChallansByInvoiceIdValidationSchema = {
    params: Joi.object({
        invoiceId: Joi.number().integer().required().label('Invoice ID'),
    }),
    query: Joi.object({
        includeUnmappedChallans: Joi.boolean().optional().default(false),
        partyId: Joi.number().integer().positive().optional().allow(null),
    })
};

// Item schema for line items inside Delivery Challan
const challanItemSchema = Joi.object({
    id: Joi.number().integer().positive().optional(),
    productId: Joi.number().integer().positive().allow(null).optional(),
    itemName: Joi.string().max(255).required(),
    description: Joi.string().allow('', null).optional(),
    hsnSacCode: Joi.string().max(30).allow('', null).optional(),
    qty: Joi.number().positive().required(),
    unit: Joi.string().max(50).optional().default('Nos'),
    rate: Joi.number().min(0).optional().default(0),
    total: Joi.number().min(0).optional().default(0),
    sortOrder: Joi.number().integer().min(0).optional().default(0)
});

// Schema: Create a new invoice challan
const createInvoiceChallanValidationSchema = {
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        challanNo: Joi.string().max(50).optional().allow('', null),
        challanDate: Joi.date().required(),
        customerName: Joi.string().max(255).required(),
        deliveryAddress: Joi.string().allow('', null).optional(),
        transportMode: Joi.string().max(50).allow('', null).optional().default('Road'),
        vehicleNo: Joi.string().max(50).allow('', null).optional(),
        transporterName: Joi.string().max(150).allow('', null).optional(),
        lrNo: Joi.string().max(100).allow('', null).optional(),
        dispatchReason: Joi.string().max(100).allow('', null).optional().default('Supply on Delivery'),
        status: Joi.string().valid('DRAFT', 'DISPATCHED', 'BILLED', 'CANCELLED').optional().default('DISPATCHED'),
        notes: Joi.string().allow('', null).optional(),
        items: Joi.array().items(challanItemSchema).optional().default([])
    }),
};

// Schema: Update an existing invoice challan
const updateInvoiceChallanValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Challan ID'),
    }),
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        challanNo: Joi.string().max(50).optional().allow('', null),
        challanDate: Joi.date().optional(),
        customerName: Joi.string().max(255).optional(),
        deliveryAddress: Joi.string().allow('', null).optional(),
        transportMode: Joi.string().max(50).allow('', null).optional(),
        vehicleNo: Joi.string().max(50).allow('', null).optional(),
        transporterName: Joi.string().max(150).allow('', null).optional(),
        lrNo: Joi.string().max(100).allow('', null).optional(),
        dispatchReason: Joi.string().max(100).allow('', null).optional(),
        status: Joi.string().valid('DRAFT', 'DISPATCHED', 'BILLED', 'CANCELLED').optional(),
        notes: Joi.string().allow('', null).optional(),
        items: Joi.array().items(challanItemSchema).optional()
    }).min(1),
};

// Schema: Delete an invoice challan
const deleteInvoiceChallanValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Challan ID'),
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

// Schema: Restore an invoice challan
const restoreInvoiceChallanValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Challan ID'),
    })
};

// Schema: Bulk delete invoice challans
const bulkDeleteInvoiceChallansValidationSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid challan ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Challan IDs must be an array.',
                'array.min': 'Please select at least one challan.',
                'array.unique': 'Duplicate challan IDs are not allowed.',
                'any.required': 'Challan IDs are required.'
            }),
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`
            })
    })
};

// Schema: Bulk restore invoice challans
const bulkRestoreInvoiceChallansValidationSchema = {
    body: Joi.object({
        ids: Joi.array()
            .items(Joi.number().integer().positive().messages({
                'number.base': 'Invalid challan ID.'
            }))
            .min(1)
            .unique()
            .required()
            .messages({
                'array.base': 'Challan IDs must be an array.',
                'array.min': 'Please select at least one challan to restore.',
                'array.unique': 'Duplicate challan IDs are not allowed.',
                'any.required': 'Challan IDs are required.'
            })
    })
};

module.exports = {
    getInvoiceChallanByIdValidationSchema,
    getInvoiceChallansByInvoiceIdValidationSchema,
    createInvoiceChallanValidationSchema,
    updateInvoiceChallanValidationSchema,
    deleteInvoiceChallanValidationSchema,
    restoreInvoiceChallanValidationSchema,
    bulkDeleteInvoiceChallansValidationSchema,
    bulkRestoreInvoiceChallansValidationSchema
};
