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
    })
};

// Schema: Create a new invoice challan
const createInvoiceChallanValidationSchema = {
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        challanNo: Joi.string().max(50).required(),
        challanDate: Joi.date().required(),
        customerName: Joi.string().max(255).required()
    }),
};

// Schema: Update an existing invoice challan
const updateInvoiceChallanValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Challan ID'),
    }),
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().allow(null).optional(),
        challanNo: Joi.string().max(50).optional(),
        challanDate: Joi.date().optional(),
        customerName: Joi.string().max(255).optional()
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