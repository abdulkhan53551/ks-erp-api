const Joi = require("joi");

const queryLeavesSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(500).default(10),
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        employeeId: Joi.number().integer().positive().allow(null, '').optional(),
        status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL', '').allow(null).optional(),
        leaveType: Joi.string().valid('CASUAL', 'SICK', 'EARNED', 'UNPAID', 'COMP_OFF', 'ALL', '').allow(null).optional(),
        startDate: Joi.date().iso().allow(null, '').optional(),
        endDate: Joi.date().iso().allow(null, '').optional()
    }).unknown(true)
};

const leaveIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Leave ID')
    })
};

const applyLeaveSchema = {
    body: Joi.object({
        employeeId: Joi.number().integer().positive().required().label('Employee ID'),
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        leaveType: Joi.string().valid('CASUAL', 'SICK', 'EARNED', 'UNPAID', 'COMP_OFF').required().label('Leave Type'),
        fromDate: Joi.date().iso().required().label('From Date'),
        toDate: Joi.date().iso().required().label('To Date'),
        totalDays: Joi.number().positive().required().label('Total Days'),
        halfDayOn: Joi.string().valid('FROM', 'TO', '').allow(null).optional().label('Half Day On'),
        reason: Joi.string().trim().max(500).allow('', null).optional().label('Reason')
    }).unknown(true)
};

const reviewLeaveSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Leave ID')
    }),
    body: Joi.object({
        status: Joi.string().valid('APPROVED', 'REJECTED').required().label('Status'),
        rejectionReason: Joi.string().trim().max(500).allow('', null).optional().label('Rejection Reason')
    }).unknown(true)
};

module.exports = {
    queryLeavesSchema,
    leaveIdParamSchema,
    applyLeaveSchema,
    reviewLeaveSchema
};
