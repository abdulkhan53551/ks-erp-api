const { Router } = require('express');
const {
    getShifts,
    getShiftDetail,
    createShiftController,
    updateShiftController,
    deleteShiftController,
    assignShiftController,
    getShiftAssignmentsController
} = require('../controllers/shift.controller');
const validate = require('../middlewares/validate');
const {
    queryShiftsSchema,
    shiftIdParamSchema,
    createShiftSchema,
    updateShiftSchema,
    assignShiftSchema
} = require('../validation/shiftValidation');
const { checkPermission } = require('../middlewares/authorize.middleware');

const router = Router();

// Shift assignments
router.get('/assignments', checkPermission('shifts', 'read'), getShiftAssignmentsController);
router.post('/assign', checkPermission('shifts', 'update'), validate(assignShiftSchema), assignShiftController);

// Shifts CRUD
router.get('/', checkPermission('shifts', 'read'), validate(queryShiftsSchema), getShifts);
router.post('/', checkPermission('shifts', 'create'), validate(createShiftSchema), createShiftController);
router.get('/:id', checkPermission('shifts', 'read'), validate(shiftIdParamSchema), getShiftDetail);
router.put('/:id', checkPermission('shifts', 'update'), validate(updateShiftSchema), updateShiftController);
router.delete('/:id', checkPermission('shifts', 'delete'), validate(shiftIdParamSchema), deleteShiftController);

module.exports = router;
