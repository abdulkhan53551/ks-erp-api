const { Router } = require('express');
const {
    getPayrollSettingsController,
    updatePayrollSettingsController,
    getSalaryTemplatesController,
    getSalaryTemplateDetail,
    createSalaryTemplateController,
    updateSalaryTemplateController,
    deleteSalaryTemplateController,
    getSalarySlipsController,
    getSalarySlipDetail,
    generatePayrollController,
    approveSalarySlipController,
    bulkPaySlipsController,
    getPayrollReportController
} = require('../controllers/payroll.controller');
const validate = require('../middlewares/validate');
const {
    querySlipsSchema,
    slipIdParamSchema,
    generatePayrollSchema,
    bulkPaySlipsSchema,
    updatePayrollSettingsSchema,
    salaryTemplateSchema
} = require('../validation/payrollValidation');
const { checkPermission } = require('../middlewares/authorize.middleware');

const router = Router();

// Payroll Settings
router.get('/settings', checkPermission('payroll-settings', 'read'), getPayrollSettingsController);
router.put('/settings', checkPermission('payroll-settings', 'update'), validate(updatePayrollSettingsSchema), updatePayrollSettingsController);

// Salary Templates
router.get('/templates', checkPermission('salary-templates', 'read'), getSalaryTemplatesController);
router.post('/templates', checkPermission('salary-templates', 'create'), validate(salaryTemplateSchema), createSalaryTemplateController);
router.get('/templates/:id', checkPermission('salary-templates', 'read'), getSalaryTemplateDetail);
router.put('/templates/:id', checkPermission('salary-templates', 'update'), validate(salaryTemplateSchema), updateSalaryTemplateController);
router.delete('/templates/:id', checkPermission('salary-templates', 'delete'), deleteSalaryTemplateController);

// Payroll Run & Slips
router.get('/report', checkPermission('payroll', 'read'), getPayrollReportController);
router.post('/generate', checkPermission('payroll', 'create'), validate(generatePayrollSchema), generatePayrollController);
router.patch('/bulk-pay', checkPermission('payroll', 'update'), validate(bulkPaySlipsSchema), bulkPaySlipsController);
router.get('/slips', checkPermission('payroll', 'read'), validate(querySlipsSchema), getSalarySlipsController);
router.get('/slips/:id', checkPermission('payroll', 'read'), validate(slipIdParamSchema), getSalarySlipDetail);
router.patch('/slips/:id/approve', checkPermission('payroll', 'approve'), validate(slipIdParamSchema), approveSalarySlipController);

module.exports = router;
