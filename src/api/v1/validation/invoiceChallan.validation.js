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
};

// Schema: Create a new invoice challan
const createInvoiceChallanValidationSchema = {
    body: Joi.object({
        invoiceId: Joi.number().integer().positive().default(0),
        challanNo: Joi.string().max(50).required(),
        challanDate: Joi.date().required(),
        customerName: Joi.string().max(255).required(),
        isInvoiced: Joi.boolean().default(false),
        firmId: Joi.number().integer().positive().optional(),
    }),
};

// Schema: Update an existing invoice challan
const updateInvoiceChallanValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Challan ID'),
    }),
    body: Joi.object({
        invoiceId: Joi.number().integer().positive(),
        challanNo: Joi.string().max(50),
        challanDate: Joi.date(),
        customerName: Joi.string().max(255),
        isInvoiced: Joi.boolean(),
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

module.exports = {
    getInvoiceChallanByIdValidationSchema,
    getInvoiceChallansByInvoiceIdValidationSchema,
    createInvoiceChallanValidationSchema,
    updateInvoiceChallanValidationSchema,
    deleteInvoiceChallanValidationSchema
};