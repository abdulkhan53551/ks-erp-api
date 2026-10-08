const { Router } = require('express');
const {
    getAdvancesController,
    getAdvanceDetailController,
    createAdvanceController,
    updateAdvanceController,
    togglePauseController,
    recordRepaymentController,
    getEmployeeAdvanceSummaryController
} = require('../controllers/advance.controller');
const validate = require('../middlewares/validate');
const {
    queryAdvancesSchema,
    advanceIdParamSchema,
    createAdvanceSchema,
    updateAdvanceSchema,
    togglePauseSchema,
    manualRepaymentSchema
} = require('../validation/advanceValidation');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');

const router = Router();

router.get('/', checkPermission('payroll', 'read'), validate(queryAdvancesSchema), getAdvancesController);
router.post('/', requireFirmContext, checkPermission('payroll', 'create'), validate(createAdvanceSchema), createAdvanceController);

router.get('/employee/:employeeId', checkPermission('payroll', 'read'), getEmployeeAdvanceSummaryController);

router.get('/:id', checkPermission('payroll', 'read'), validate(advanceIdParamSchema), getAdvanceDetailController);
router.put('/:id', requireFirmContext, checkPermission('payroll', 'update'), validate(updateAdvanceSchema), updateAdvanceController);
router.patch('/:id/pause', requireFirmContext, checkPermission('payroll', 'update'), validate(togglePauseSchema), togglePauseController);
router.post('/:id/repayments', requireFirmContext, checkPermission('payroll', 'create'), validate(manualRepaymentSchema), recordRepaymentController);

module.exports = router;
