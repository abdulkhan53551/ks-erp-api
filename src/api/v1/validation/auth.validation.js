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

module.exports = { 
    addRolePermissionValidationSchema,
    removeRolePermissionValidationSchema,
    updateRolePermissionValidationSchema
 };