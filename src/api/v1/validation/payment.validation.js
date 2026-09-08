const Joi = require('joi');

const createReceiptSchema = {
    body: Joi.object({
        paymentDate: Joi.date().iso().required().messages({
            'any.required': 'Payment date is required',
            'date.base': 'Payment date must be a valid date'
        }),
        partyId: Joi.number().integer().positive().required().messages({
            'any.required': 'Customer party ID is required',
            'number.base': 'Customer party ID must be a number'
        }),
        totalAmount: Joi.number().positive().precision(2).required().messages({
            'any.required': 'Total amount received is required',
            'number.positive': 'Total amount must be greater than 0'
        }),
        paymentModeId: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment mode is required'
        }),
        referenceNo: Joi.string().trim().max(100).allow('', null).optional(),
        referenceDate: Joi.date().iso().allow('', null).optional(),
        bankName: Joi.string().trim().max(150).allow('', null).optional(),
        notes: Joi.string().trim().max(1000).allow('', null).optional(),
        allocations: Joi.array().items(
            Joi.object({
                invoiceId: Joi.number().integer().positive().required().messages({
                    'any.required': 'Invoice ID is required for allocation'
                }),
                allocatedAmount: Joi.number().min(0).precision(2).default(0),
                tdsAmount: Joi.number().min(0).precision(2).default(0),
                writeOffAmount: Joi.number().min(0).precision(2).default(0),
                writeOffReason: Joi.string().trim().max(255).allow('', null).optional()
            })
        ).default([])
    })
};

const queryReceiptsSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().trim().allow('').optional(),
        partyId: Joi.number().integer().positive().optional(),
        paymentModeId: Joi.number().integer().positive().optional(),
        status: Joi.string().valid('COMPLETED', 'CANCELLED').optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional(),
        sortBy: Joi.string().valid('payment_date', 'payment_no', 'total_amount', 'created_at').default('payment_date'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
};

const receiptIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Receipt ID is required'
        })
    })
};

const partyIdParamSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required().messages({
            'any.required': 'Party ID is required'
        })
    })
};

const invoiceIdParamSchema = {
    params: Joi.object({
        invoiceId: Joi.number().integer().positive().required().messages({
            'any.required': 'Invoice ID is required'
        })
    })
};

module.exports = {
    createReceiptSchema,
    queryReceiptsSchema,
    receiptIdParamSchema,
    partyIdParamSchema,
    invoiceIdParamSchema
};
