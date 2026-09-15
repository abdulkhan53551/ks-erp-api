const { Router } = require('express')
const {
    refreshUserToken,
    registerUser,
    loginUser,
    getCurrentUser,
    checkVerifyAccessToken,
    logout,
    logoutAll,
    logoutAllSessions,
    createRole,
    createPermission,
    assignRolePermission,
    assignUserRole,
    syncPolicies,
    checkIsAuthorizeAccess,
    createPolicy,
    deletePolicy,
    updatePolicy,
    clearAllPolicies,
    removeRolePermission,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getPendingRegistrationsList,
    getRejectedRegistrationsList,
    approveRegistration,
    rejectRegistration,
    getPendingPasswordResetsList,
    approvePasswordResetRequest,
    rejectPasswordResetRequest,
    getRoles
} = require('../controllers/auth.controller.js')
const { verifyAccessToken, authorizeAccess, requireSuperAdmin } = require('../middlewares/auth.middleware.js')
const validate = require('../middlewares/validate.js')
const { addRolePermissionValidationSchema, removeRolePermissionValidationSchema, updateRolePermissionValidationSchema, createPolicyValidationSchema, deletePolicyValidationSchema, updatePolicyValidateSchema } = require('../validation/auth.validation.js')
const router = Router()

// Auth
router.get('/me', verifyAccessToken, getCurrentUser)
router.post('/refresh-token', refreshUserToken)
router.post('/verify-access-token', verifyAccessToken, checkVerifyAccessToken)
router.post('/check-authorize', authorizeAccess, checkIsAuthorizeAccess);
router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', verifyAccessToken, logout)
router.post('/logout-all', verifyAccessToken, logoutAllSessions)

// Password Recovery (Public)
router.post('/forgot-password', forgotPassword)
router.get('/validate-reset-token', validateResetToken)
router.post('/reset-password', resetPassword)

// Super Admin Approval Workflows
router.get('/admin/roles', verifyAccessToken, requireSuperAdmin, getRoles)
router.get('/admin/approvals/registrations', verifyAccessToken, requireSuperAdmin, getPendingRegistrationsList)
router.get('/admin/approvals/rejected-registrations', verifyAccessToken, requireSuperAdmin, getRejectedRegistrationsList)
router.patch('/admin/approvals/registrations/:id/approve', verifyAccessToken, requireSuperAdmin, approveRegistration)
router.patch('/admin/approvals/registrations/:id/reject', verifyAccessToken, requireSuperAdmin, rejectRegistration)
router.get('/admin/approvals/password-resets', verifyAccessToken, requireSuperAdmin, getPendingPasswordResetsList)
router.patch('/admin/approvals/password-resets/:id/approve', verifyAccessToken, requireSuperAdmin, approvePasswordResetRequest)
router.patch('/admin/approvals/password-resets/:id/reject', verifyAccessToken, requireSuperAdmin, rejectPasswordResetRequest)
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