const Joi = require('joi');

const createVendorBillSchema = {
    body: Joi.object({
        partyId: Joi.number().integer().positive().required().messages({
            'any.required': 'Vendor party ID is required.',
            'number.base': 'Vendor party ID must be a valid number.'
        }),
        branchId: Joi.number().integer().positive().allow(null).optional(),
        billNo: Joi.string().trim().max(100).required().messages({
            'any.required': 'Vendor bill number is required.',
            'string.empty': 'Vendor bill number cannot be empty.'
        }),
        billDate: Joi.date().iso().required().messages({
            'any.required': 'Bill date is required.',
            'date.base': 'Bill date must be a valid date.'
        }),
        dueDays: Joi.number().integer().min(0).allow(null).optional(),
        dueDate: Joi.date().iso().allow(null).optional(),
        taxableAmount: Joi.number().min(0).precision(2).default(0),
        cgst: Joi.number().min(0).precision(2).default(0),
        sgst: Joi.number().min(0).precision(2).default(0),
        igst: Joi.number().min(0).precision(2).default(0),
        otherCharges: Joi.number().min(0).precision(2).default(0),
        roundOff: Joi.number().precision(2).default(0),
        total: Joi.number().positive().precision(2).optional(),
        notes: Joi.string().trim().max(1000).allow('', null).optional()
    })
};

const updateVendorBillSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Vendor bill ID is required.'
        })
    }),
    body: Joi.object({
        branchId: Joi.number().integer().positive().allow(null).optional(),
        billNo: Joi.string().trim().max(100).optional(),
        billDate: Joi.date().iso().optional(),
        dueDays: Joi.number().integer().min(0).allow(null).optional(),
        dueDate: Joi.date().iso().allow(null).optional(),
        taxableAmount: Joi.number().min(0).precision(2).optional(),
        cgst: Joi.number().min(0).precision(2).optional(),
        sgst: Joi.number().min(0).precision(2).optional(),
        igst: Joi.number().min(0).precision(2).optional(),
        otherCharges: Joi.number().min(0).precision(2).optional(),
        roundOff: Joi.number().precision(2).optional(),
        total: Joi.number().positive().precision(2).optional(),
        notes: Joi.string().trim().max(1000).allow('', null).optional()
    })
};

const queryVendorBillsSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().trim().allow('').optional(),
        partyId: Joi.number().integer().positive().optional(),
        paymentStatusId: Joi.number().integer().positive().optional(),
        status: Joi.string().valid('ACTIVE', 'CANCELLED').optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional(),
        sortBy: Joi.string().valid('bill_date', 'bill_no', 'total', 'balance_amount', 'due_date', 'created_at').default('bill_date'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
};

const vendorBillIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Vendor bill ID is required.'
        })
    })
};

const vendorPartyIdParamSchema = {
    params: Joi.object({
        partyId: Joi.number().integer().positive().required().messages({
            'any.required': 'Party ID is required.'
        })
    })
};

module.exports = {
    createVendorBillSchema,
    updateVendorBillSchema,
    queryVendorBillsSchema,
    vendorBillIdParamSchema,
    vendorPartyIdParamSchema
};
