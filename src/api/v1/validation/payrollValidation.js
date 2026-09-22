const Joi = require("joi");

const querySlipsSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(500).default(20),
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        month: Joi.number().integer().min(1).max(12).allow(null, '').optional(),
        year: Joi.number().integer().min(2000).max(2100).allow(null, '').optional(),
        status: Joi.string().valid('DRAFT', 'GENERATED', 'APPROVED', 'PAID', 'ALL', '').allow(null).optional(),
        employeeId: Joi.number().integer().positive().allow(null, '').optional(),
        search: Joi.string().allow('', null).optional()
    }).unknown(true)
};

const slipIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Salary Slip ID')
    })
};

const generatePayrollSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        month: Joi.number().integer().min(1).max(12).required().label('Month'),
        year: Joi.number().integer().min(2000).max(2100).required().label('Year'),
        employeeIds: Joi.array().items(Joi.number().integer().positive()).allow(null).optional().label('Employee IDs')
    }).unknown(true)
};

const bulkPaySlipsSchema = {
    body: Joi.object({
        slipIds: Joi.array().items(Joi.number().integer().positive()).min(1).required().label('Salary Slip IDs'),
        paymentDate: Joi.date().iso().required().label('Payment Date'),
        paymentMode: Joi.string().valid('BANK_TRANSFER', 'CASH', 'UPI', 'CHEQUE').required().label('Payment Mode'),
        paymentReference: Joi.string().trim().max(150).allow('', null).optional().label('Payment Reference'),
        remarks: Joi.string().allow('', null).optional().label('Remarks')
    }).unknown(true)
};

const updatePayrollSettingsSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        workingDaysPerMonth: Joi.number().integer().min(1).max(31).default(26).label('Working Days Per Month'),
        weeklyOffDay: Joi.string().valid('SUNDAY', 'SATURDAY', 'NONE').default('SUNDAY').label('Weekly Off Day'),
        otRateType: Joi.string().valid('FIXED', 'MULTIPLIER').default('FIXED').label('OT Rate Type'),
        otHourlyRate: Joi.number().min(0).default(0).label('OT Hourly Rate'),
        otMultiplierNormal: Joi.number().min(1).max(5).default(1.5).label('OT Normal Multiplier'),
        otMultiplierHoliday: Joi.number().min(1).max(5).default(2.0).label('OT Holiday Multiplier'),
        otMultiplierWeekend: Joi.number().min(1).max(5).default(2.0).label('OT Weekend Multiplier'),

        pfEnabled: Joi.boolean().default(false).label('PF Enabled'),
        pfEmployerPercent: Joi.number().min(0).max(100).default(12.00).label('PF Employer %'),
        pfEmployeePercent: Joi.number().min(0).max(100).default(12.00).label('PF Employee %'),
        pfWageCeiling: Joi.number().min(0).default(15000).label('PF Wage Ceiling'),

        esiEnabled: Joi.boolean().default(false).label('ESI Enabled'),
        esiEmployerPercent: Joi.number().min(0).max(100).default(3.25).label('ESI Employer %'),
        esiEmployeePercent: Joi.number().min(0).max(100).default(0.75).label('ESI Employee %'),
        esiWageCeiling: Joi.number().min(0).default(21000).label('ESI Wage Ceiling'),

        ptEnabled: Joi.boolean().default(false).label('PT Enabled'),
        ptMonthlyAmount: Joi.number().min(0).default(200).label('PT Monthly Amount')
    }).unknown(true)
};

const salaryTemplateSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        templateName: Joi.string().trim().max(150).required().label('Template Name'),
        templateType: Joi.string().valid('MONTHLY', 'DAILY', 'HOURLY').default('MONTHLY').label('Template Type'),
        description: Joi.string().allow('', null).optional().label('Description'),
        isDefault: Joi.boolean().default(false).label('Is Default'),
        components: Joi.array().items(
            Joi.object({
                componentName: Joi.string().trim().max(100).required(),
                componentType: Joi.string().valid('EARNING', 'DEDUCTION').required(),
                calcType: Joi.string().valid('FIXED', 'PERCENT_OF_BASIC', 'PERCENT_OF_GROSS').required(),
                value: Joi.number().min(0).required(),
                isStatutory: Joi.boolean().default(false),
                sortOrder: Joi.number().integer().default(0)
            })
        ).default([]).label('Components')
    }).unknown(true)
};

module.exports = {
    querySlipsSchema,
    slipIdParamSchema,
    generatePayrollSchema,
    bulkPaySlipsSchema,
    updatePayrollSettingsSchema,
    salaryTemplateSchema
};
