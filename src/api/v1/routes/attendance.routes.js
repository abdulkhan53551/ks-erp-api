const { Router } = require('express');
const {
    getAttendance,
    markAttendanceController,
    bulkMarkAttendanceController,
    markDateStatusController,
    getAttendanceSummaryController,
    exportAttendanceMusterController
} = require('../controllers/attendance.controller');
const validate = require('../middlewares/validate');
const {
    queryAttendanceSchema,
    markAttendanceSchema,
    bulkMarkAttendanceSchema,
    markDateStatusSchema,
    attendanceSummarySchema
} = require('../validation/attendanceValidation');
const { checkPermission } = require('../middlewares/authorize.middleware');

const router = Router();

router.get('/muster/export', checkPermission('attendance', 'read'), exportAttendanceMusterController);
router.get('/summary', checkPermission('attendance', 'read'), validate(attendanceSummarySchema), getAttendanceSummaryController);
router.post('/bulk-mark', checkPermission('attendance', 'create'), validate(bulkMarkAttendanceSchema), bulkMarkAttendanceController);
router.post('/mark-date-status', checkPermission('attendance', 'create'), validate(markDateStatusSchema), markDateStatusController);
router.post('/mark', checkPermission('attendance', 'create'), validate(markAttendanceSchema), markAttendanceController);
router.get('/', checkPermission('attendance', 'read'), validate(queryAttendanceSchema), getAttendance);

module.exports = router;
