const Joi = require("joi");

// Add role permission validation schema
const addRolePermissionValidationSchema = {
    body: Joi.object({
        roleId: Joi.number().integer().required().label('Role ID'),
        permissionId: Joi.number().integer().required().label('Permission ID'),
    }).unknown(true)
};

// Remove role permission validation schema
const removeRolePermissionValidationSchema = {
    params: Joi.object({
        id: Joi.number().integer().required().label('Role Permission ID'),
    }),
    query: Joi.object({
        isPermanentDelete: Joi.boolean()
            .default(false)
            .label('Is Permanent Delete')
            .messages({
                'boolean.base': `"isPermanentDelete" must be a boolean value.`,
            })
    })
};

// Update role permission validation schema
const updateRolePermissionValidationSchema = {
    body: Joi.object({
        rolePermissionId: Joi.number().integer().required().label('Role Permission ID'),
        roleId: Joi.number().integer().required().label('Role ID'),
        permissionId: Joi.number().integer().required().label('Permission ID'),
    }).unknown(true)
};

// Create validation schema
const createPolicyValidationSchema = {
    body: Joi.object({
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
    }).unknown(true)
};

// Delete validation schema
const deletePolicyValidationSchema = {
    body: Joi.object({
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
    }).unknown(true)
};

// Policy update validation schema
const updatePolicyValidateSchema = {
    body: Joi.object({
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
        })
};

// ==========================================
// Authentication & Password Hardening Schemas
// ==========================================

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const PASSWORD_ERROR_MSG = 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character';

const loginValidationSchema = {
    body: Joi.object({
        userName: Joi.string().trim().allow('', null).optional(),
        email: Joi.string().trim().email().allow('', null).optional(),
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    }).or('userName', 'email').messages({
        'object.missing': 'Username or email is required'
    })
};

const registerValidationSchema = {
    body: Joi.object({
        firstName: Joi.string().trim().min(1).max(100).required().messages({
            'any.required': 'First name is required'
        }),
        lastName: Joi.string().trim().max(100).allow('', null).optional(),
        userName: Joi.string().trim().alphanum().min(3).max(100).required().messages({
            'any.required': 'Username is required',
            'string.alphanum': 'Username must only contain alphanumeric characters',
            'string.min': 'Username must be at least 3 characters long'
        }),
        email: Joi.string().trim().email().required().messages({
            'any.required': 'Email is required',
            'string.email': 'Please provide a valid email address'
        }),
        role: Joi.alternatives().try(Joi.number().integer(), Joi.string()).allow('', null).optional(),
        password: Joi.string()
            .min(8)
            .max(100)
            .pattern(PASSWORD_REGEX)
            .required()
            .messages({
                'any.required': 'Password is required',
                'string.min': 'Password must be at least 8 characters long',
                'string.pattern.base': PASSWORD_ERROR_MSG
            })
    })
};

const forgotPasswordValidationSchema = {
    body: Joi.object({
        email: Joi.string().trim().email().required().messages({
            'any.required': 'Email is required',
            'string.email': 'Please provide a valid email address'
        })
    })
};

const resetPasswordValidationSchema = {
    body: Joi.object({
        token: Joi.string().required().messages({
            'any.required': 'Reset token is required'
        }),
        newPassword: Joi.string()
            .min(8)
            .max(100)
            .pattern(PASSWORD_REGEX)
            .optional()
            .messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.pattern.base': PASSWORD_ERROR_MSG
            }),
        password: Joi.string()
            .min(8)
            .max(100)
            .pattern(PASSWORD_REGEX)
            .optional()
            .messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.pattern.base': PASSWORD_ERROR_MSG
            })
    }).or('newPassword', 'password').messages({
        'object.missing': 'New password is required'
    })
};

module.exports = {
    addRolePermissionValidationSchema,
    removeRolePermissionValidationSchema,
    updateRolePermissionValidationSchema,
    createPolicyValidationSchema,
    deletePolicyValidationSchema,
    updatePolicyValidateSchema,
    loginValidationSchema,
    registerValidationSchema,
    forgotPasswordValidationSchema,
    resetPasswordValidationSchema
};