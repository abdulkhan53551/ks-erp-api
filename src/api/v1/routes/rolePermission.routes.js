const { Router } = require('express');
const {
    getAllRoles,
    getPermissionMatrix,
    updateRolePermissions,
    updateRoleDetails,
    createCustomRole,
    deleteCustomRole
} = require('../controllers/rolePermission.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/authorize.middleware');

const router = Router();

// Authenticate all role and permission routes
router.use(verifyAccessToken);

router.get('/roles', checkPermission('users', 'read'), getAllRoles);
router.post('/roles', checkPermission('users', 'create'), createCustomRole);
router.patch('/roles/:id', checkPermission('users', 'update'), updateRoleDetails);
router.delete('/roles/:id', checkPermission('users', 'delete'), deleteCustomRole);

router.get('/permissions/matrix', checkPermission('users', 'read'), getPermissionMatrix);
router.put('/roles/:id/permissions', checkPermission('users', 'update'), updateRolePermissions);

module.exports = router;
