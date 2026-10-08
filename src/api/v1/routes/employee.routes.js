const { Router } = require('express');
const {
    getEmployees,
    getEmployeesMeta,
    getEmployeeDetail,
    createEmployeeController,
    updateEmployeeController,
    deleteEmployeeController,
    restoreEmployeeController,
    getEmployeesDropdown,
    getNextEmployeeCodeController
} = require('../controllers/employee.controller');
const validate = require('../middlewares/validate');
const {
    queryEmployeesSchema,
    employeeIdParamSchema,
    createEmployeeSchema,
    updateEmployeeSchema
} = require('../validation/employeeValidation');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');

const router = Router();

// Static routes before /:id
router.get('/meta', checkPermission('employees', 'read'), getEmployeesMeta);
router.get('/dropdown', checkPermission('employees', 'read'), getEmployeesDropdown);
router.get('/next-code', checkPermission('employees', 'read'), getNextEmployeeCodeController);

// Main collection routes
router.get('/', checkPermission('employees', 'read'), validate(queryEmployeesSchema), getEmployees);
router.post('/', requireFirmContext, checkPermission('employees', 'create'), validate(createEmployeeSchema), createEmployeeController);

// Single resource routes
router.get('/:id', checkPermission('employees', 'read'), validate(employeeIdParamSchema), getEmployeeDetail);
router.put('/:id', requireFirmContext, checkPermission('employees', 'update'), validate(updateEmployeeSchema), updateEmployeeController);
router.delete('/:id', requireFirmContext, checkPermission('employees', 'delete'), validate(employeeIdParamSchema), deleteEmployeeController);
router.patch('/:id/restore', requireFirmContext, checkPermission('employees', 'update'), validate(employeeIdParamSchema), restoreEmployeeController);

module.exports = router;
