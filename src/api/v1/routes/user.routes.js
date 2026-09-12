const { Router } = require('express');
const {
    registerUser,
    changeCurrentPassword,
    updateAccountDetail,
    getAllUsers,
    getUsersMeta,
    deleteUser,
    restoreUserController,
    bulkDeleteUsersController,
    bulkRestoreUsersController,
    changeUserRole,
    toggleUserStatus,
    adminGenerateResetLink,
    adminDirectSetPassword
} = require('../controllers/user.controller.js');
const { getCurrentUser } = require('../controllers/auth.controller.js');
const upload = require('./../middlewares/multer.middleware.js');
const validate = require('../middlewares/validate.js');
const { userValidationSchema } = require('../validation/userValidation.js');
const { verifyAccessToken, requireSuperAdmin } = require('../middlewares/auth.middleware.js');

const router = Router();

// Legacy register (if used anywhere)
router.post('/register', upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), validate(userValidationSchema), registerUser);

// Personal account routes (any authenticated user)
router.patch('/change-password', verifyAccessToken, changeCurrentPassword);
router.get('/current-user', verifyAccessToken, getCurrentUser);
router.patch('/update-account-detail', verifyAccessToken, updateAccountDetail);
router.patch('/update-avatar', verifyAccessToken, updateAccountDetail);

// ========== Super Admin: User Directory & Recycle Bin ==========
// Static paths must precede parameter routes /:id
router.get('/meta', verifyAccessToken, requireSuperAdmin, getUsersMeta);
router.post('/bulk-delete', verifyAccessToken, requireSuperAdmin, bulkDeleteUsersController);
router.post('/bulk-restore', verifyAccessToken, requireSuperAdmin, bulkRestoreUsersController);

router.get('/', verifyAccessToken, requireSuperAdmin, getAllUsers);
router.delete('/:id', verifyAccessToken, requireSuperAdmin, deleteUser);
router.patch('/:id/restore', verifyAccessToken, requireSuperAdmin, restoreUserController);
router.patch('/:id/role', verifyAccessToken, requireSuperAdmin, changeUserRole);
router.patch('/:id/status', verifyAccessToken, requireSuperAdmin, toggleUserStatus);
router.post('/:id/reset-link', verifyAccessToken, requireSuperAdmin, adminGenerateResetLink);
router.post('/:id/direct-reset-password', verifyAccessToken, requireSuperAdmin, adminDirectSetPassword);

module.exports = router;