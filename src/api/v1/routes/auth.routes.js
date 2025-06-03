const { Router } = require('express')
const { refreshUserToken, registerUser, loginUser, checkVerifyAccessToken, logout, logoutAll, logoutAllSessions, createRole, createPermission, assignRolePermission, assignUserRole, syncPolicies, checkIsAuthorizeAccess, createPolicy, deletePolicy, updatePolicy, clearAllPolicies, removeRolePermission } = require('../controllers/auth.controller.js')
// const verifyAccessToken = require('../middlewares/auth.middleware.js')
const { verifyAccessToken, authorizeAccess } = require('../middlewares/auth.middleware.js')
const validate = require('../middlewares/validate.js')
const { addRolePermissionValidationSchema, removeRolePermissionValidationSchema, updateRolePermissionValidationSchema, createPolicyValidationSchema, deletePolicyValidationSchema, updatePolicyValidateSchema } = require('../validation/auth.validation.js')
const router = Router()

// Auth
router.post('/refresh-token', refreshUserToken)
router.post('/verify-access-token', verifyAccessToken, checkVerifyAccessToken)
router.post('/check-authorize', authorizeAccess, checkIsAuthorizeAccess);
router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', verifyAccessToken, logout)
router.post('/logout-all', verifyAccessToken, logoutAllSessions)
// router.post('/users', controller.createUser);
router.post('/roles', createRole);
router.post('/permissions', createPermission);

router.post('/assign-role', assignUserRole);
router.post('/assign-role-permission', validate(addRolePermissionValidationSchema), assignRolePermission);
router.patch('/assign-role-permission/:id', validate(updateRolePermissionValidationSchema), assignRolePermission);
router.delete('/assign-role-permission/:id', validate(removeRolePermissionValidationSchema), removeRolePermission);

// Policy Management
router.post('/policy', validate(createPolicyValidationSchema), createPolicy);
router.delete('/policy', validate(deletePolicyValidationSchema), deletePolicy);
router.patch('/policy', validate(updatePolicyValidateSchema), updatePolicy);
router.delete('/clear-all-policies', clearAllPolicies);
router.post('/sync-policies', syncPolicies);

module.exports = router