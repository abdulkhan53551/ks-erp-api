const { Router } = require('express');
const {
    getLeaves,
    getLeaveDetail,
    applyLeaveController,
    reviewLeaveController,
    cancelLeaveController
} = require('../controllers/leave.controller');
const validate = require('../middlewares/validate');
const {
    queryLeavesSchema,
    leaveIdParamSchema,
    applyLeaveSchema,
    reviewLeaveSchema
} = require('../validation/leaveValidation');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');

const router = Router();

router.get('/', checkPermission('leaves', 'read'), validate(queryLeavesSchema), getLeaves);
router.post('/apply', requireFirmContext, checkPermission('leaves', 'create'), validate(applyLeaveSchema), applyLeaveController);
router.get('/:id', checkPermission('leaves', 'read'), validate(leaveIdParamSchema), getLeaveDetail);
router.patch('/:id/review', requireFirmContext, checkPermission('leaves', 'approve'), validate(reviewLeaveSchema), reviewLeaveController);
router.patch('/:id/cancel', requireFirmContext, checkPermission('leaves', 'update'), validate(leaveIdParamSchema), cancelLeaveController);

module.exports = router;
