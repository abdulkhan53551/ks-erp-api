const { Router } = require('express');
const {
    getAllRoles,
    getPermissionMatrix,
    updateRolePermissions,
    updateRoleDetails,
    createCustomRole,
    deleteCustomRole
} = require('../controllers/rolePermission.controller');
const { verifyAccessToken, requireSuperAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// All role and permission management routes require Super Admin privileges
router.use(verifyAccessToken, requireSuperAdmin);

router.get('/roles', getAllRoles);
router.post('/roles', createCustomRole);
router.patch('/roles/:id', updateRoleDetails);
router.delete('/roles/:id', deleteCustomRole);

router.get('/permissions/matrix', getPermissionMatrix);
router.put('/roles/:id/permissions', updateRolePermissions);

module.exports = router;
