const { Router } = require('express');
const {
    registerUser,
    changeCurrentPassword,
    updateAccountDetail,
    getAllUsers,
    getUsersMeta,
    getUserCountsByFirmController,
    deleteUser,
    restoreUserController,
    bulkDeleteUsersController,
    bulkRestoreUsersController,
    changeUserRole,
    toggleUserStatus,
    adminGenerateResetLink,
    adminDirectSetPassword,
    getUserAssignments,
    updateUserAssignments
} = require('../controllers/user.controller.js');
const { getCurrentUser } = require('../controllers/auth.controller.js');
const upload = require('./../middlewares/multer.middleware.js');
const validate = require('../middlewares/validate.js');
const {
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
} = require('../validation/userValidation.js');
const { checkPermission } = require('../middlewares/authorize.middleware.js');

const router = Router();

// Legacy register (if used anywhere)
router.post('/register', upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), validate({ body: userValidationSchema }), registerUser);

// Personal account routes (any authenticated user)
router.patch('/change-password', changeCurrentPassword);
router.get('/current-user', getCurrentUser);
router.patch('/update-account-detail', updateAccountDetail);
router.patch('/update-avatar', updateAccountDetail);

// ========== User Directory & Firm Counts ==========
// Static paths must precede parameter routes /:id
router.get('/meta', checkPermission('users', 'read'), validate(queryUsersSchema), getUsersMeta);
router.get('/firm-counts', checkPermission('users', 'read'), getUserCountsByFirmController);
router.post('/bulk-delete', checkPermission('users', 'delete'), validate(bulkDeleteUsersSchema), bulkDeleteUsersController);
router.post('/bulk-restore', checkPermission('users', 'update'), validate(bulkRestoreUsersSchema), bulkRestoreUsersController);

router.get('/', checkPermission('users', 'read'), validate(queryUsersSchema), getAllUsers);
router.get('/:id/assignments', checkPermission('users', 'read'), validate(userIdParamSchema), getUserAssignments);
router.put('/:id/assignments', checkPermission('users', 'update'), validate(updateUserAssignmentsSchema), updateUserAssignments);
router.delete('/:id', checkPermission('users', 'delete'), validate(deleteUserSchema), deleteUser);
router.patch('/:id/restore', checkPermission('users', 'update'), validate(userIdParamSchema), restoreUserController);
router.patch('/:id/role', checkPermission('users', 'update'), validate(changeUserRoleSchema), changeUserRole);
router.patch('/:id/status', checkPermission('users', 'update'), validate(toggleUserStatusSchema), toggleUserStatus);
router.post('/:id/reset-link', checkPermission('users', 'update'), validate(userIdParamSchema), adminGenerateResetLink);
router.post('/:id/direct-reset-password', checkPermission('users', 'update'), validate(adminDirectSetPasswordSchema), adminDirectSetPassword);

module.exports = router;