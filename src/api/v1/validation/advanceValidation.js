const Joi = require("joi");

const queryAdvancesSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(500).default(20),
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        employeeId: Joi.number().integer().positive().allow(null, '').optional(),
        status: Joi.string().valid('ACTIVE', 'PAUSED', 'CLOSED', 'CANCELLED', 'ALL', '').allow(null).optional(),
        search: Joi.string().allow('', null).optional(),
        sortBy: Joi.string().allow('', null).optional(),
        sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC', '').allow(null).optional()
    }).unknown(true)
};

const advanceIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Advance ID')
    })
};

const createAdvanceSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        employeeId: Joi.number().integer().positive().required().label('Employee ID'),
        advanceDate: Joi.date().iso().required().label('Advance Date'),
        totalAmount: Joi.number().positive().precision(2).required().label('Total Amount'),
        recoveryType: Joi.string().valid('FULL', 'EMI', 'CUSTOM').default('FULL').label('Recovery Type'),
        monthlyDeduction: Joi.number().min(0).precision(2).optional().label('Monthly Deduction'),
        paymentMode: Joi.string().valid('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE').default('CASH').label('Payment Mode'),
        paymentReference: Joi.string().trim().max(150).allow('', null).optional().label('Payment Reference'),
        remarks: Joi.string().allow('', null).optional().label('Remarks')
    }).options({ stripUnknown: true })
};

const updateAdvanceSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Advance ID')
    }),
    body: Joi.object({
        monthlyDeduction: Joi.number().min(0).precision(2).optional().label('Monthly Deduction'),
        recoveryType: Joi.string().valid('FULL', 'EMI', 'CUSTOM').optional().label('Recovery Type'),
        paymentReference: Joi.string().trim().max(150).allow('', null).optional().label('Payment Reference'),
        remarks: Joi.string().allow('', null).optional().label('Remarks')
    }).options({ stripUnknown: true })
};

const togglePauseSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Advance ID')
    }),
    body: Joi.object({
        isPaused: Joi.boolean().required().label('Is Paused')
    }).options({ stripUnknown: true })
};

const manualRepaymentSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Advance ID')
    }),
    body: Joi.object({
        amount: Joi.number().positive().precision(2).required().label('Repayment Amount'),
        repaymentDate: Joi.date().iso().required().label('Repayment Date'),
        repaymentType: Joi.string().valid('DIRECT_CASH', 'DIRECT_BANK').default('DIRECT_CASH').label('Repayment Type'),
        remarks: Joi.string().allow('', null).optional().label('Remarks')
    }).options({ stripUnknown: true })
};

const updateSlipAdvanceDeductionSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Salary Slip ID')
    }),
    body: Joi.object({
        advanceDeduction: Joi.number().min(0).precision(2).required().label('Advance Deduction Amount')
    }).options({ stripUnknown: true })
};

module.exports = {
    queryAdvancesSchema,
    advanceIdParamSchema,
    createAdvanceSchema,
    updateAdvanceSchema,
    togglePauseSchema,
    manualRepaymentSchema,
    updateSlipAdvanceDeductionSchema
};
