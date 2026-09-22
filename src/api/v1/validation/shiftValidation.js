const Joi = require("joi");

const queryShiftsSchema = {
    query: Joi.object({
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        search: Joi.string().allow('', null).optional()
    }).unknown(true)
};

const shiftIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Shift ID')
    })
};

const createShiftSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        shiftName: Joi.string().trim().max(100).required().label('Shift Name'),
        shiftCode: Joi.string().trim().max(20).required().label('Shift Code'),
        startTime: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).required().label('Start Time'),
        endTime: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).required().label('End Time'),
        breakMinutes: Joi.number().integer().min(0).default(60).label('Break Minutes'),
        isDefault: Joi.boolean().default(false).label('Is Default')
    }).unknown(true)
};

const updateShiftSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Shift ID')
    }),
    body: Joi.object({
        shiftName: Joi.string().trim().max(100).optional().label('Shift Name'),
        shiftCode: Joi.string().trim().max(20).optional().label('Shift Code'),
        startTime: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).optional().label('Start Time'),
        endTime: Joi.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)(:?([0-5]\d))?$/).optional().label('End Time'),
        breakMinutes: Joi.number().integer().min(0).optional().label('Break Minutes'),
        isDefault: Joi.boolean().optional().label('Is Default')
    }).unknown(true)
};

const assignShiftSchema = {
    body: Joi.object({
        employeeIds: Joi.array().items(Joi.number().integer().positive()).min(1).required().label('Employee IDs'),
        shiftId: Joi.number().integer().positive().required().label('Shift ID'),
        effectiveFrom: Joi.date().iso().required().label('Effective From'),
        effectiveTo: Joi.date().iso().allow(null, '').optional().label('Effective To')
    }).unknown(true)
};

module.exports = {
    queryShiftsSchema,
    shiftIdParamSchema,
    createShiftSchema,
    updateShiftSchema,
    assignShiftSchema
};
