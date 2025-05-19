const { Router } = require('express')
const { refreshUserToken, registerUser, loginUser, checkVerifyAccessToken, logout, logoutAll, logoutAllSessions, createRole, createPermission, assignRolePermission, assignUserRole, syncPolicies, checkIsAuthorizeAccess, createPolicy } = require('../controllers/auth.controller.js')
// const verifyAccessToken = require('../middlewares/auth.middleware.js')
const { verifyAccessToken, authorizeAccess } = require('../middlewares/auth.middleware.js')
const validate = require('../middlewares/validate.js')
const { addRolePermissionValidationSchema, removeRolePermissionValidationSchema, updateRolePermissionValidationSchema } = require('../validation/auth.validation.js')
const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/refresh-token', refreshUserToken)
router.post('/verify-access-token', verifyAccessToken, checkVerifyAccessToken)
router.post('/logout', verifyAccessToken, logout)
router.post('/logout-all', verifyAccessToken, logoutAllSessions)
// router.post('/users', controller.createUser);
router.post('/roles', createRole);
router.post('/permissions', createPermission);

router.post('/assign-role', assignUserRole);
router.post('/role-permission', validate(addRolePermissionValidationSchema), assignRolePermission);
router.patch('/role-permission/:id', validate(updateRolePermissionValidationSchema), assignRolePermission);
router.delete('/role-permission/:id', validate(removeRolePermissionValidationSchema), assignRolePermission);

router.post('/create-policy', createPolicy);
// router.patch('/update-policy/:id', createPolicy);
// router.delete('/create-policy/:id', createPolicy);

router.post('/sync-policies', syncPolicies);
router.post('/check-authorize', authorizeAccess, checkIsAuthorizeAccess);

module.exports = router