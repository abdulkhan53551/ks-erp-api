const Joi = require("joi");

// Normalizes date inputs strictly to 'YYYY-MM-DD' strings without casting to JS Date objects
const dateStringSchema = Joi.string()
    .trim()
    .custom((val, helpers) => {
        if (!val) return val;
        const match = typeof val === 'string' && val.match(/^(\d{4}-\d{2}-\d{2})/);
        if (!match) return helpers.error('any.invalid');
        return match[1];
    })
    .messages({ 'any.invalid': '{{#label}} must be a valid date in YYYY-MM-DD format' });

const queryAttendanceSchema = {
    query: Joi.object({
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        branchId: Joi.number().integer().positive().allow(null, '').optional(),
        employeeId: Joi.number().integer().positive().allow(null, '').optional(),
        startDate: dateStringSchema.allow(null, '').optional().label('Start Date'),
        endDate: dateStringSchema.allow(null, '').optional().label('End Date'),
        month: Joi.number().integer().min(1).max(12).allow(null, '').optional(),
        year: Joi.number().integer().min(2000).max(2100).allow(null, '').optional(),
        status: Joi.string().valid('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF', 'ALL', '').allow(null).optional()
    }).unknown(true)
};

const markAttendanceSchema = {
    body: Joi.object({
        employeeId: Joi.number().integer().positive().required().label('Employee ID'),
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        branchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
        shiftId: Joi.number().integer().positive().allow(null).optional().label('Shift ID'),
        attendanceDate: dateStringSchema.required().label('Attendance Date'),
        status: Joi.string().valid('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF').required().label('Status'),
        checkIn: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).allow(null, '').optional().label('Check In'),
        checkOut: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).allow(null, '').optional().label('Check Out'),
        totalHours: Joi.number().min(0).max(24).allow(null).optional().label('Total Hours'),
        overtimeHours: Joi.number().min(0).max(24).default(0).label('Overtime Hours'),
        overtimeType: Joi.string().valid('NORMAL', 'HOLIDAY', 'WEEKEND').default('NORMAL').label('Overtime Type'),
        remarks: Joi.string().allow('', null).optional().label('Remarks')
    }).options({ stripUnknown: true })
};

const bulkMarkAttendanceSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        attendanceDate: dateStringSchema.allow(null, '').optional().label('Attendance Date'),
        records: Joi.array().items(
            Joi.object({
                employeeId: Joi.number().integer().positive().required().label('Employee ID'),
                attendanceDate: dateStringSchema.allow(null, '').optional().label('Attendance Date'),
                branchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
                shiftId: Joi.number().integer().positive().allow(null).optional().label('Shift ID'),
                status: Joi.string().valid('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF').required().label('Status'),
                checkIn: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).allow(null, '').optional().label('Check In'),
                checkOut: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).allow(null, '').optional().label('Check Out'),
                totalHours: Joi.number().min(0).max(24).allow(null).optional().label('Total Hours'),
                overtimeHours: Joi.number().min(0).max(24).default(0).label('Overtime Hours'),
                overtimeType: Joi.string().valid('NORMAL', 'HOLIDAY', 'WEEKEND').default('NORMAL').label('Overtime Type'),
                remarks: Joi.string().allow('', null).optional().label('Remarks')
            })
        ).min(1).required().label('Attendance Records')
    }).options({ stripUnknown: true })
};

const markDateStatusSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        branchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
        attendanceDate: dateStringSchema.required().label('Attendance Date'),
        status: Joi.string().valid('HOLIDAY', 'WEEKLY_OFF').required().label('Status'),
        remarks: Joi.string().allow('', null).optional().label('Remarks')
    }).options({ stripUnknown: true })
};

const attendanceSummarySchema = {
    query: Joi.object({
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        month: Joi.number().integer().min(1).max(12).required().label('Month'),
        year: Joi.number().integer().min(2000).max(2100).required().label('Year'),
        branchId: Joi.number().integer().positive().allow(null, '').optional()
    }).unknown(true)
};

module.exports = {
    queryAttendanceSchema,
    markAttendanceSchema,
    bulkMarkAttendanceSchema,
    markDateStatusSchema,
    attendanceSummarySchema
};
