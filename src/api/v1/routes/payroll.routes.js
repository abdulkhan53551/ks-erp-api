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
    getSalarySlipPdfController,
    generatePayrollController,
    approveSalarySlipController,
    bulkPaySlipsController,
    getPayrollReportController,
    exportSalaryMusterController
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
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');

const router = Router();

// Payroll Settings
router.get('/settings', checkPermission('payroll-settings', 'read'), getPayrollSettingsController);
router.put('/settings', requireFirmContext, checkPermission('payroll-settings', 'update'), validate(updatePayrollSettingsSchema), updatePayrollSettingsController);

// Salary Templates
router.get('/templates', checkPermission('salary-templates', 'read'), getSalaryTemplatesController);
router.post('/templates', requireFirmContext, checkPermission('salary-templates', 'create'), validate(salaryTemplateSchema), createSalaryTemplateController);
router.get('/templates/:id', checkPermission('salary-templates', 'read'), getSalaryTemplateDetail);
router.put('/templates/:id', requireFirmContext, checkPermission('salary-templates', 'update'), validate(salaryTemplateSchema), updateSalaryTemplateController);
router.delete('/templates/:id', requireFirmContext, checkPermission('salary-templates', 'delete'), deleteSalaryTemplateController);

// Payroll Run & Slips
router.get('/muster/export', checkPermission('payroll', 'read'), exportSalaryMusterController);
router.get('/report', checkPermission('payroll', 'read'), getPayrollReportController);
router.post('/generate', requireFirmContext, checkPermission('payroll', 'create'), validate(generatePayrollSchema), generatePayrollController);
router.patch('/bulk-pay', requireFirmContext, checkPermission('payroll', 'update'), validate(bulkPaySlipsSchema), bulkPaySlipsController);
router.get('/slips', checkPermission('payroll', 'read'), validate(querySlipsSchema), getSalarySlipsController);
router.get('/slips/:id/pdf', checkPermission('payroll', 'read'), validate(slipIdParamSchema), getSalarySlipPdfController);
router.get('/slips/:id', checkPermission('payroll', 'read'), validate(slipIdParamSchema), getSalarySlipDetail);
router.patch('/slips/:id/approve', requireFirmContext, checkPermission('payroll', 'approve'), validate(slipIdParamSchema), approveSalarySlipController);

module.exports = router;
