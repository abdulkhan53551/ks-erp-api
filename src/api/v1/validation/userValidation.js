const Joi = require("joi");

const userValidationSchema = Joi.object({
    fullName: Joi.string().required().label('Full Name'),
    email: Joi.string().email().required().label('Email'),
    username: Joi.string().min(3).max(30).required().label('Username'),
    password: Joi.string().min(8).required().label('Password'),
}).unknown(true);

const userIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('User ID')
    })
};

const queryUsersSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(500).default(10),
        search: Joi.string().allow('', null).optional(),
        status: Joi.string().valid('APPROVED', 'PENDING', 'REJECTED', 'INACTIVE', 'ALL', '').allow(null).optional(),
        roleId: Joi.number().integer().positive().allow(null, '').optional(),
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        trash: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
        sortBy: Joi.string().allow('', null).optional(),
        sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC', '').allow(null).optional()
    }).unknown(true)
};

const toggleUserStatusSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('User ID')
    }),
    body: Joi.object({
        isActive: Joi.boolean().required().label('Active Status')
    })
};

const changeUserRoleSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('User ID')
    }),
    body: Joi.object({
        roleId: Joi.number().integer().positive().required().label('Role ID')
    })
};

const adminDirectSetPasswordSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('User ID')
    }),
    body: Joi.object({
        newPassword: Joi.string().min(6).required().label('New Password')
    })
};

const updateUserAssignmentsSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('User ID')
    }),
    body: Joi.object({
        isSuperAdmin: Joi.boolean().default(false).label('Super Admin'),
        assignments: Joi.array().items(
            Joi.object({
                firmId: Joi.number().integer().positive().required().label('Firm ID'),
                firmBranchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
                branchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
                roleId: Joi.number().integer().positive().required().label('Role ID'),
                dataScope: Joi.string().valid('GLOBAL', 'FIRM', 'BRANCH', 'DESCENDANTS', 'OWN').default('BRANCH').label('Data Scope'),
                isDefault: Joi.boolean().default(false).label('Default'),
                isActive: Joi.boolean().default(true).label('Active')
            }).unknown(true)
        ).default([]).label('Assignments')
    })
};

const deleteUserSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('User ID')
    }),
    query: Joi.object({
        permanent: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional().label('Permanent')
    }).unknown(true)
};

const bulkDeleteUsersSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive()).min(1).required().label('User IDs'),
        permanent: Joi.boolean().default(false).label('Permanent')
    })
};

const bulkRestoreUsersSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive()).min(1).required().label('User IDs')
    })
};

module.exports = {
    userValidationSchema,
    userIdParamSchema,
    queryUsersSchema,
    toggleUserStatusSchema,
    changeUserRoleSchema,
    adminDirectSetPasswordSchema,
    updateUserAssignmentsSchema,
    deleteUserSchema,
    bulkDeleteUsersSchema,
    bulkRestoreUsersSchema
};