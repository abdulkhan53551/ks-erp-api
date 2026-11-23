const Joi = require('joi');

/**
 * Helper: Trims string fields and converts empty strings / whitespace to null
 */
const sanitizeEmptyStringsToNull = (obj, fields = []) => {
    const sanitized = { ...obj };
    fields.forEach((field) => {
        if (sanitized[field] !== undefined) {
            if (sanitized[field] === '' || (typeof sanitized[field] === 'string' && sanitized[field].trim() === '')) {
                sanitized[field] = null;
            }
        }
    });
    return sanitized;
};

/**
 * Reusable Customer Receipt Allocation Item Schema
 */
const receiptAllocationItemSchema = Joi.object({
    invoiceId: Joi.number().integer().positive().required().messages({
        'any.required': 'Invoice ID is required for allocation',
        'number.base': 'Invoice ID must be a valid number'
    }),
    allocatedAmount: Joi.number().min(0).precision(2).default(0).messages({
        'number.min': 'Allocated amount cannot be negative'
    }),
    tdsAmount: Joi.number().min(0).precision(2).default(0).messages({
        'number.min': 'TDS deduction cannot be negative'
    }),
    writeOffAmount: Joi.number().min(0).precision(2).default(0).messages({
        'number.min': 'Write-off discount cannot be negative'
    }),
    writeOffReason: Joi.when('writeOffAmount', {
        is: Joi.number().greater(0),
        then: Joi.string().trim().min(2).max(255).required().messages({
            'any.required': 'Write-off reason is required when write-off discount is applied.',
            'string.empty': 'Write-off reason is required when write-off discount is applied.',
            'string.min': 'Write-off reason must be at least 2 characters long.'
        }),
        otherwise: Joi.string().trim().max(255).allow('', null).optional()
    })
}).custom((value) => {
    if (value.writeOffReason === '' || (typeof value.writeOffReason === 'string' && !value.writeOffReason.trim())) {
        value.writeOffReason = null;
    }
    return value;
});

/**
 * Reusable Vendor Payment Allocation Item Schema
 */
const vendorPaymentAllocationItemSchema = Joi.object({
    vendorBillId: Joi.number().integer().positive().required().messages({
        'any.required': 'Vendor bill ID is required for allocation',
        'number.base': 'Vendor bill ID must be a valid number'
    }),
    allocatedAmount: Joi.number().min(0).precision(2).default(0).messages({
        'number.min': 'Allocated amount cannot be negative'
    }),
    tdsAmount: Joi.number().min(0).precision(2).default(0).messages({
        'number.min': 'TDS deduction cannot be negative'
    }),
    writeOffAmount: Joi.number().min(0).precision(2).default(0).messages({
        'number.min': 'Write-off discount cannot be negative'
    }),
    writeOffReason: Joi.when('writeOffAmount', {
        is: Joi.number().greater(0),
        then: Joi.string().trim().min(2).max(255).required().messages({
            'any.required': 'Write-off reason is required when write-off discount is applied.',
            'string.empty': 'Write-off reason is required when write-off discount is applied.',
            'string.min': 'Write-off reason must be at least 2 characters long.'
        }),
        otherwise: Joi.string().trim().max(255).allow('', null).optional()
    })
}).custom((value) => {
    if (value.writeOffReason === '' || (typeof value.writeOffReason === 'string' && !value.writeOffReason.trim())) {
        value.writeOffReason = null;
    }
    return value;
});

const createReceiptSchema = {
    body: Joi.object({
        paymentDate: Joi.date().iso().required().messages({
            'any.required': 'Payment date is required',
            'date.base': 'Payment date must be a valid date'
        }),
        partyId: Joi.number().integer().positive().allow(null).optional().messages({
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
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        notes: Joi.string().trim().max(1000).allow('', null).optional(),
        allocations: Joi.array().items(receiptAllocationItemSchema).default([])
    }).custom((value, helpers) => {
        // Direct walk-in / unregistered invoice settlement validation
        if (!value.partyId) {
            if (!value.allocations || value.allocations.length === 0) {
                return helpers.message('At least one invoice allocation is required when recording payment for an unlinked/walk-in customer.');
            }
            const totalAllocated = value.allocations.reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0);
            if (Number(value.totalAmount) > totalAllocated + 0.01) {
                return helpers.message('For walk-in/unregistered customers, payment amount cannot exceed the invoice settlement amount (excess advance is not permitted without a registered customer).');
            }
        }
        return sanitizeEmptyStringsToNull(value, ['bankName', 'referenceNo', 'referenceDate', 'notes']);
    })
};

const createVendorPaymentSchema = {
    body: Joi.object({
        paymentDate: Joi.date().iso().required().messages({
            'any.required': 'Payment date is required',
            'date.base': 'Payment date must be a valid date'
        }),
        partyId: Joi.number().integer().positive().required().messages({
            'any.required': 'Vendor party ID is required',
            'number.base': 'Vendor party ID must be a number'
        }),
        totalAmount: Joi.number().positive().precision(2).required().messages({
            'any.required': 'Total payment amount is required',
            'number.positive': 'Total payment amount must be greater than 0'
        }),
        paymentModeId: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment mode is required'
        }),
        referenceNo: Joi.string().trim().max(100).allow('', null).optional(),
        referenceDate: Joi.date().iso().allow('', null).optional(),
        bankName: Joi.string().trim().max(150).allow('', null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        notes: Joi.string().trim().max(1000).allow('', null).optional(),
        allocations: Joi.array().items(vendorPaymentAllocationItemSchema).default([])
    }).custom((value) => sanitizeEmptyStringsToNull(value, ['bankName', 'referenceNo', 'referenceDate', 'notes']))
};

const applyCustomerAdvanceSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment receipt ID is required'
        })
    }),
    body: Joi.object({
        allocations: Joi.array().items(receiptAllocationItemSchema).min(1).required().messages({
            'any.required': 'At least one invoice allocation is required.',
            'array.min': 'At least one invoice allocation is required.'
        })
    })
};

const queryPaymentsSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().trim().allow('').optional(),
        partyId: Joi.number().integer().positive().optional(),
        firmId: Joi.number().integer().positive().allow(null, '').optional(),
        firmBranchId: Joi.number().integer().positive().allow(null, '').optional(),
        paymentModeId: Joi.number().integer().positive().optional(),
        status: Joi.string().valid('COMPLETED', 'CANCELLED').optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional(),
        sortBy: Joi.string().valid('payment_date', 'payment_no', 'total_amount', 'created_at').default('payment_date'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
        trash: Joi.boolean().truthy('true').falsy('false').optional(),
        isTrash: Joi.boolean().truthy('true').falsy('false').optional()
    })
};

const queryReceiptsSchema = queryPaymentsSchema;

const paymentIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment ID is required'
        })
    })
};

const receiptIdParamSchema = paymentIdParamSchema;

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

const deletePaymentSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment ID is required'
        })
    }),
    query: Joi.object({
        isPermanentDelete: Joi.boolean().truthy('true').falsy('false').default(false)
    }).unknown(true)
};

const restorePaymentSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment ID is required'
        })
    })
};

const bulkDeletePaymentsSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive()).min(1).required().messages({
            'any.required': 'Payment IDs array is required',
            'array.min': 'At least one payment ID must be provided'
        }),
        isPermanentDelete: Joi.boolean().truthy('true').falsy('false').default(false)
    })
};

const bulkRestorePaymentsSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive()).min(1).required().messages({
            'any.required': 'Payment IDs array is required',
            'array.min': 'At least one payment ID must be provided'
        })
    })
};

const updatePaymentMetadataSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            'any.required': 'Payment ID is required',
            'number.base': 'Payment ID must be a valid number'
        })
    }),
    body: Joi.object({
        paymentDate: Joi.date().iso().optional().messages({
            'date.base': 'Payment date must be a valid date'
        }),
        paymentModeId: Joi.number().integer().positive().optional().messages({
            'number.base': 'Payment mode must be a valid ID'
        }),
        bankName: Joi.string().trim().max(150).allow('', null).optional(),
        referenceNo: Joi.string().trim().max(100).allow('', null).optional(),
        referenceDate: Joi.date().iso().allow('', null).optional(),
        notes: Joi.string().trim().max(1000).allow('', null).optional()
    }).min(1).messages({
        'object.min': 'At least one field must be provided to update payment metadata'
    }).custom((value) => sanitizeEmptyStringsToNull(value, ['bankName', 'referenceNo', 'referenceDate', 'notes']))
};

module.exports = {
    createReceiptSchema,
    createVendorPaymentSchema,
    applyCustomerAdvanceSchema,
    queryPaymentsSchema,
    queryReceiptsSchema,
    paymentIdParamSchema,
    receiptIdParamSchema,
    partyIdParamSchema,
    invoiceIdParamSchema,
    deletePaymentSchema,
    restorePaymentSchema,
    bulkDeletePaymentsSchema,
    bulkRestorePaymentsSchema,
    updatePaymentMetadataSchema
};
