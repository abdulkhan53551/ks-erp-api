const Joi = require("joi");

// Add role permission validation schema
const addRolePermissionValidationSchema = Joi.object({
    roleId: Joi.string().required().label('Role ID'),
    permissionId: Joi.string().required().label('Permission ID'),
}).unknown(true);

// Remove role permission validation schema
const removeRolePermissionValidationSchema = Joi.object({
    rolePermissionId: Joi.string().required().label('Role Permission ID'),
}).unknown(true);

// Update role permission validation schema
const updateRolePermissionValidationSchema = Joi.object({
    rolePermissionId: Joi.string().required().label('Role Permission ID'),
    roleId: Joi.string().required().label('Role ID'),
    permissionId: Joi.string().required().label('Permission ID'),
}).unknown(true);

// Create validation schema
const createPolicyValidationSchema = Joi.object({
    sub: Joi.string().pattern(/^role:\d+$/).required().label('Role ID')
        .messages({
            'string.pattern.base': `"sub" must be in the format 'role:<number>'`,
        }),
    permissionId: Joi.number().integer().required().label('Permission ID'),
    condRuleStr: Joi.string().empty('').default('true').label('Condition Rule String')
        .custom((value, helpers) => {
            try {
                new Function(`return (${value});`);
                return value;
            } catch {
                return helpers.error('any.invalid', { value });
            }
        }, 'JS expression validation'),
}).unknown(true);

// Delete validation schema
const deletePolicyValidationSchema = Joi.object({
    sub: Joi.string().pattern(/^role:\d+$/).required().label('Role ID')
        .messages({
            'string.pattern.base': `"sub" must be in the format 'role:<number>'`,
        }),
    permissionId: Joi.number().integer().required().label('Permission ID'),
    condRuleStr: Joi.string().empty('').default('true').label('Condition Rule String')
        .custom((value, helpers) => {
            try {
                new Function(`return (${value});`);
                return value;
            } catch {
                return helpers.error('any.invalid', { value });
            }
        }, 'JS expression validation'),
}).unknown(true);

// Policy update validation schema
const updatePolicyValidateSchema = Joi.object({
    oldSub: Joi.string().pattern(/^role:\d+$/).required().label('Old Role ID')
        .messages({
            'string.pattern.base': `"oldSub" must be in the format 'role:<number>'`,
        }),
    oldPermissionId: Joi.number().integer().required().label('Old Permission ID'),
    oldCondRuleStr: Joi.string().empty('').default('true').label('Old Condition Rule String'),

    sub: Joi.string().pattern(/^role:\d+$/).required().label('Role ID')
        .messages({
            'string.pattern.base': `"sub" must be in the format 'role:<number>'`,
        }),
    permissionId: Joi.number().integer().required().label('Permission ID'),
    condRuleStr: Joi.string().empty('').default('true').label('Condition Rule String')
        .custom((value, helpers) => {
            try {
                new Function(`return (${value});`);
                return value;
            } catch {
                return helpers.error('any.invalid', { value });
            }
        }, 'JS expression validation'),
})
    .custom((value, helpers) => {
        try {
            const isSame =
                value.oldSub === value.sub &&
                value.oldPermissionId === value.permissionId &&
                value.oldCondRuleStr === value.condRuleStr;

            if (isSame) {
                return helpers.error('custom.policyConflict');
            }

            return value;
        } catch (err) {
            return helpers.error('custom.policyValidationFailed');
        }
    }, 'Policy update difference validation')
    .messages({
        'custom.policyConflict': 'New policy must different from the old policy.',
        'custom.invalidJS': 'Condition Rule String must be a valid JavaScript expression.',
        'custom.policyValidationFailed': 'Unexpected error during policy validation.'
    });


module.exports = {
    addRolePermissionValidationSchema,
    removeRolePermissionValidationSchema,
    updateRolePermissionValidationSchema,
    createPolicyValidationSchema,
    deletePolicyValidationSchema,
    updatePolicyValidateSchema
};