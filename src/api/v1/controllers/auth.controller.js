const { asyncHandler } = require('../services/asyncHandler.js')
const { ApiResponse } = require('../services/ApiResponse.js');
const { ApiError } = require('../services/ApiError.js');
const { rotateRefreshToken, createRefreshToken } = require('../services/tokenService.js');
const { JWT } = require('../../../config/config.js');
const {
    isUserExist,
    getHashedPassword,
    isPasswordCorrect,
    fetchUserById,
    findUserById,
    getPendingRegistrations,
    getRejectedRegistrations,
    approveUserRegistration,
    rejectUserRegistration,
    requestPasswordReset,
    getPendingPasswordResets,
    approvePasswordReset,
    rejectPasswordReset,
    findUserByResetToken,
    completePasswordReset,
    getAllRoles
} = require('../models/user.model.js');
const { createUser, deleteRefreshTokenByUserIDAndToken, deleteRefreshTokenByUserID, assignPermissionToRole, removeAssignedRolePermissionById, getResourcePermissionById, createAbacPolicy, deleteAbacPolicy, getAllAbacPolicy } = require('../models/auth.model.js');
const { hashToken, generateToken, generateAccessToken } = require('../helpers/token.js');
const { clearAccessAndRefreshTokenCookie } = require('../../../utils/cookies.js');
const casbinDb = require('../models/auth.model.js');
const { getEnforcer } = require('../services/casbin.js');
const { jsonLogicToString, stringToJsonLogic } = require('../../../utils/utility.js');

// Convert to expiry days to number
const REFRESH_TOKEN_EXPIRY_DAYS = Number(JWT.REFRESH_TOKEN_EXPIRE?.match(/\d+/)?.[0]);
const REFRESH_TOKEN_EXPIRY_IN_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

// Register user
const registerUser = asyncHandler(async (req, res) => {
    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while registering user'
    }

    // Get user detail
    const { firstName, lastName, role, email, userName, password } = req.body;

    // Validation - not empty
    if (
        [firstName, email, userName, password].some(field => !field?.trim())
    ) {
        throw new ApiError({ statusCode: 400, message: 'First name, email, username, and password are required' });
    }

    // Check if user already exist
    const existedUser = await isUserExist(userName, email);

    // Throw error if user exist
    if (existedUser?.id > 0) {
        throw new ApiError({ statusCode: 409, message: 'User with email or username already exists' });
    }

    // Hashed password
    const hashedPassword = await getHashedPassword(password);

    const userData = {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        first_name: firstName.trim(),
        last_name: (lastName || '').trim(),
        role_id: role ? parseInt(role, 10) : null,
        user_name: userName.trim().toLowerCase(),
        approval_status: 'PENDING',
        is_active: false
    };

    // Create user in pending state
    const newUser = await createUser(userData);

    if (!newUser) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while registering user' });
    }

    // Prepare response
    response = {
        statusCode: 201,
        data: newUser,
        message: 'Registration submitted successfully. Your account is pending Super Admin approval.'
    };

    return res.status(response.statusCode).json(new ApiResponse(response));
});

const loginUser = asyncHandler(async (req, res) => {
    const { userName, email, password } = req.body;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;
    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while logging'
    }

    // Username or email
    if (!(userName || email)) {
        throw new ApiError({ statusCode: 400, message: 'username or  email is required' })
    }

    // Check if user already exist
    const user = await isUserExist(userName, email)

    // Check if user exist
    if (!user?.id) {
        throw new ApiError({ statusCode: 404, message: 'User not found' })
    }

    // Check password
    const isPasswordValid = await isPasswordCorrect(password, user?.password);
    if (!isPasswordValid) {
        throw new ApiError({ statusCode: 401, message: 'Invalid user credential' });
    }

    // Approval gate checks
    if (user.approval_status === 'PENDING') {
        throw new ApiError({ statusCode: 403, message: 'Your account is pending Super Admin approval. Please contact administrator.' });
    }

    if (user.approval_status === 'REJECTED') {
        throw new ApiError({ statusCode: 403, message: 'Your account registration has been rejected. Please contact administrator.' });
    }

    if (user.deleted_at) {
        throw new ApiError({ statusCode: 403, message: 'Your account has been deleted. Please contact administrator.' });
    }

    if (!user.is_active) {
        throw new ApiError({ statusCode: 403, message: 'Your account has been deactivated. Please contact administrator.' });
    }

    // Role and tenant firm context
    const roleSlug = user.role_slug || 'admin';
    const roleName = user.role_name || 'Administrator';
    const firmId = 1;

    // Access and refresh token generation
    const tokenData = {
        user: { ...user, role: roleSlug, firmId },
        ip: ipAddress,
        userAgent,
        deviceId: null
    };
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(tokenData);

    const userProfile = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        userName: user.user_name,
        roleId: user.role_id,
        role: roleSlug,
        roleName: roleName,
        firmId: firmId
    };

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    };

    response = {
        statusCode: 200,
        data: {
            accessToken,
            refreshToken,
            user: userProfile
        },
        message: 'Successfully logged in'
    };

    // Set access & refresh token as HTTP-only cookie
    return res
        .status(response.statusCode)
        .cookie('refreshToken', refreshToken, optionsCookie)
        .json(new ApiResponse(response));
});

// Generate refresh token
const refreshUserToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while generating refresh token'
    };

    // Check if refresh token is present
    if (!refreshToken) {
        throw new ApiError({ statusCode: 400, message: 'Refresh token is required' });
    }

    // Get new refresh token
    const { accessToken, newToken: newRefreshToken } = await rotateRefreshToken(refreshToken, ip, userAgent);

    // Get token data
    const tokens = { accessToken, ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}) };

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    };

    response = {
        statusCode: 200,
        data: tokens,
        message: 'Successfully generated access and refreshed token'
    };

    // Set refresh token as HTTP-only cookie if rotated
    if (newRefreshToken) {
        res.cookie('refreshToken', newRefreshToken, optionsCookie);
    }

    return res
        .status(response.statusCode)
        .json(new ApiResponse(response));
});

// Generate access and refresh token
const generateAccessAndRefreshTokens = async (tokenData) => {
    try {
        const { user, ip, userAgent, deviceId } = tokenData;

        // Generate access token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            userName: user.user_name || user.userName,
            fullName: `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim(),
            role: user.role || user.role_slug || 'admin',
            roleId: user.role_id || user.roleId,
            firmId: user.firmId || 1
        };
        const accessToken = generateAccessToken(tokenPayload);

        // Generate refresh token
        const { token: refreshToken } = await createRefreshToken(user.id, ip, userAgent, deviceId);

        return { accessToken, refreshToken };
    } catch (error) {
        console.log('Error generating access and refresh token:', error);

        throw new ApiError({ statusCode: 500, message: 'Something went wrong while generating refresh and access token.' });
    }
};

// Get Current Authenticated User (/auth/me)
const getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const user = await fetchUserById(userId);

    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found' });
    }

    const roleSlug = user.role_slug || req.user.role || 'admin';
    const roleName = user.role_name || 'Administrator';
    const firmId = req.user.firmId || 1;

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: {
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                userName: user.user_name,
                roleId: user.role_id,
                role: roleSlug,
                roleName: roleName,
                firmId
            }
        },
        message: 'Current user profile fetched successfully'
    }));
});

// Check verify access token
const checkVerifyAccessToken = asyncHandler(async (req, res, next) => {
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, message: 'Access token is valid' }));
});

// Check verify access token
const checkIsAuthorizeAccess = asyncHandler(async (req, res, next) => {

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: { authorize: true }, message: 'User is authorized' }))
})

// Logout
const logout = asyncHandler(async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken
        const userId = req.user.id;

        // Check if refresh token is present
        if (!refreshToken) {
            throw new ApiError({ statusCode: 400, message: 'Refresh token is required' })
        }

        const hashedToken = hashToken(refreshToken);

        const wasDeleted = await deleteRefreshTokenByUserIDAndToken(userId, hashedToken)

        if (!wasDeleted) {
            throw new ApiError({ statusCode: 400, message: 'Unable to logout: token not found or already logged out' })
        }

        // Clear the refresh token cookie
        clearAccessAndRefreshTokenCookie(res)

        return res
            .status(200)
            .json(new ApiResponse({ statusCode: 200, message: 'Logged out successfully' }))
    } catch (err) {
        console.log('Error during logout:', err);

        throw err instanceof ApiError ? err : new ApiError({ statusCode: 500, message: 'Logout error' })
    }
});

// Logout all sessions
const logoutAllSessions = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;

    // Delete all refresh tokens for the user
    const wasDeleted = await deleteRefreshTokenByUserID(userId)

    // Check if any tokens were deleted
    if (!wasDeleted) {
        throw new ApiError({ statusCode: 400, message: 'Unable to logout from all sessions' })
    }

    // Clear the refresh token cookie
    clearAccessAndRefreshTokenCookie(res); // Clears cookie from browser

    return res.status(200).json(new ApiResponse({ statusCode: 200, message: 'Logged out from all sessions' }));
});

// Create Role
const createRole = asyncHandler(async (req, res) => {
    const { name, slug, description } = req.body;
    const roleData = {
        name: name,
        slug: slug,
        description: description || null
    }

    // Create role
    const id = await casbinDb.createRole(roleData);

    if (!id) {
        // Handle the case when the role is not created
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating role' })
    }

    // res.json({ id, message: 'Role created' });
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Role created' }))
})

// Create Permission
const createPermission = asyncHandler(async (req, res) => {
    const { object, action } = req.body;

    // Create permission in database
    const id = await casbinDb.createPermission(object, action);

    if (!id) {
        // Handle the case when the permission is not created
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating permission or resource' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Permission created' }))
})

// Assign Role to User
const assignUserRole = asyncHandler(async (req, res) => {
    const { userId, roleId } = req.body;

    // Assign a role to a user
    const userRoleId = await casbinDb.assignUserRole(userId, roleId);

    // Check if user role is assigned successfully
    if (!userRoleId) {
        // Handle the case when the user role not added
        throw new ApiError({ statusCode: 404, message: 'Something went wrong while assigning role to user' })
    }
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Role assigned to user' }))
})

// Assign Permission to Role
const assignRolePermission = asyncHandler(async (req, res) => {
    const { roleId, permissionId } = req.body;

    // Assign a role to a permission
    const rolePermissionId = await assignPermissionToRole(roleId, permissionId);

    if (!rolePermissionId) {
        // Handle the case when the role permission not added
        throw new ApiError({ statusCode: 404, message: 'Something went wrong while assigning role to permission OR resource' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Permission assigned to role' }))
})

// Remove Permission to Role
const removeRolePermission = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete } = req.query;

    // Assign a role to a permission
    const isDeleted = await removeAssignedRolePermissionById(id, isPermanentDelete);

    if (!isDeleted) {
        // Handle the case when the role permission is not found
        throw new ApiError({ statusCode: 404, message: 'Role permission mapping not found or already deleted' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Role & Permission mapping are removed successfully' }))
})


// Create policy
const createPolicy = asyncHandler(async (req, res) => {
    const { sub, permissionId, condRuleStr } = req.body;

    // Generate rule in json logic tree format
    const conditionRuleJson = condRuleStr && stringToJsonLogic(condRuleStr)

    // Get resource role permission
    const { resourcePermissionId, resource, action } = (await getResourcePermissionById(permissionId)) || {}

    // Check resource found or not for given role permission
    if (!resourcePermissionId) {
        throw new ApiError({ statusCode: 400, message: 'No resource found.' })
    }

    // Logical json tree to expression string
    const conditionStr = jsonLogicToString(conditionRuleJson)
    const act = action?.toLowerCase()
    const condNew = conditionStr?.trim() || String(true)

    // Add policy to casbin rule
    const isCasbinPolicyAdded = await casbinDb.addPolicyToCasbinRule(sub, resource, act, condNew)

    // Check casbin policy added successfully or not
    if (!isCasbinPolicyAdded) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while adding policy to casbin rule.' })
    }

    // Create new abac policy
    const abacPolicyId = await createAbacPolicy(sub, resource, act, conditionRuleJson);

    // Check if policy created successfully or not
    if (!abacPolicyId) {
        throw new ApiError({ statusCode: 400, message: 'Something went wrong while creating ABAC policy' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Policy added successfully.' }))
})

// Delete policy
const deletePolicy = asyncHandler(async (req, res) => {
    const { sub, permissionId, condRuleStr } = req.body;

    // Generate rule in json logic tree format
    const conditionRuleJson = condRuleStr && stringToJsonLogic(condRuleStr)

    // Get resource role permission
    const { resourcePermissionId, resource, action } = (await getResourcePermissionById(permissionId)) || {}

    // Check resource found or not for given role permission
    if (!resourcePermissionId) {
        throw new ApiError({ statusCode: 400, message: 'No resource found.' })
    }

    // Logical json tree to expression string
    const conditionStr = jsonLogicToString(conditionRuleJson)
    const act = action?.toLowerCase()
    const condNew = conditionStr?.trim() || String(true)

    // Remove policy from casbin rule
    const isCasbinPolicyRemoved = await casbinDb.removePolicyFromCasbinRule(sub, resource, act, condNew)

    // Check casbin policy added successfully or not
    if (!isCasbinPolicyRemoved) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while deleting policy from casbin rule.' })
    }

    // Delete abac policy
    const abacPolicyId = await deleteAbacPolicy(sub, resource, act, conditionRuleJson);

    // Check if policy deleted successfully or not
    if (!abacPolicyId) {
        throw new ApiError({ statusCode: 400, message: 'Something went wrong while deleting ABAC policy' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Policy deleted successfully.' }))
})

// Update policy
const updatePolicy = asyncHandler(async (req, res) => {
    const { oldSub, oldPermissionId, oldCondRuleStr, sub, permissionId, condRuleStr } = req.body;

    // Generate rule in json logic tree format
    const oldConditionRuleJson = condRuleStr && stringToJsonLogic(oldCondRuleStr)
    const newConditionRuleJson = condRuleStr && stringToJsonLogic(condRuleStr)

    // Get resource role permission
    const { resourcePermissionId: oldResourcePermissionId, resource: oldResource, action: oldAction } = (await getResourcePermissionById(oldPermissionId)) || {}
    const { resourcePermissionId: newResourcePermissionId, resource: newResource, action: newAction } = (await getResourcePermissionById(permissionId)) || {}

    // Check resource found or not for given role permission
    if (!oldResourcePermissionId || !newResourcePermissionId) {
        throw new ApiError({ statusCode: 400, message: 'No resource found.' })
    }

    // Logical json tree to expression string
    const oldConditionStr = jsonLogicToString(oldConditionRuleJson)
    const oldAct = oldAction?.toLowerCase()
    const oldCondNew = oldConditionStr?.trim() || String(true)

    const newConditionStr = jsonLogicToString(newConditionRuleJson)
    const newAct = newAction?.toLowerCase()
    const newCondNew = newConditionStr?.trim() || String(true)

    const oldPolicy = [oldSub, oldResource, oldAct, oldCondNew]
    const newPolicy = [sub, newResource, newAct, newCondNew]

    // Remove policy from casbin rule
    const isCasbinPolicyRemoved = await casbinDb.removePolicyFromCasbinRule(...oldPolicy)

    // Check casbin policy removed successfully or not
    if (!isCasbinPolicyRemoved) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while deleting policy from casbin rule.' })
    }

    // Add policy to casbin rule
    const isCasbinPolicyAdded = await casbinDb.addPolicyToCasbinRule(...newPolicy)

    // Check casbin policy added successfully or not
    if (!isCasbinPolicyAdded) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while adding policy to casbin rule.' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Policy updated successfully.' }))
})

// Sync Casbin Policies
const syncPolicies = asyncHandler(async (req, res) => {
    const enforcer = await getEnforcer();
    await enforcer.clearPolicy();

    // Get all policies from database
    const allPolicies = await getAllAbacPolicy();

    // Check if policies exist
    if (!allPolicies?.length) {
        throw new ApiError({ statusCode: 404, message: 'No policies found to sync' });
    }

    // Prepare policy rules for bulk addition
    const policyRules = allPolicies.map(policy => {
        // Convert policy conditions to string
        const policyConditionsStr = (policy.conditions && Object.keys(policy.conditions).length === 0)
            ? "true"
            : jsonLogicToString(policy.conditions);

        return [
            policy.sub,
            policy.obj,
            policy.act,
            policyConditionsStr
        ]
    })

    // Add policies in bulk to casbin rule
    const policyAdded = casbinDb.addPolicyBulkToCasbinRule(policyRules)

    // Check if policies added successfully or not
    if (!policyAdded) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while syncing policies in bulk' });
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Policies synced successfully.' }))
})

// Clear all policies
const clearAllPolicies = asyncHandler(async (req, res) => {
    const enforcer = await getEnforcer();
    await enforcer.clearPolicy();                        // clear memory
    await enforcer.savePolicy();                         // enforce empty policy set

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Successfully deleted all policies' }))
})

// ========== FORGOT & RESET PASSWORD ==========
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email?.trim()) {
        throw new ApiError({ statusCode: 400, message: 'Email is required' });
    }

    const user = await isUserExist('', email.trim());
    if (user?.id) {
        await requestPasswordReset(email.trim());
    }

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: null,
        message: 'Password reset request submitted. Awaiting Super Admin approval.'
    }));
});

const validateResetToken = asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token) {
        throw new ApiError({ statusCode: 400, message: 'Token is required' });
    }

    const tokenHash = hashToken(token);
    const user = await findUserByResetToken(tokenHash);

    if (!user) {
        throw new ApiError({ statusCode: 400, message: 'Invalid or expired password reset link' });
    }

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: { valid: true, email: user.email },
        message: 'Reset token is valid'
    }));
});

const resetPassword = asyncHandler(async (req, res) => {
    const token = req.body.token;
    const newPassword = req.body.newPassword || req.body.password;
    if (!token || !newPassword) {
        throw new ApiError({ statusCode: 400, message: 'Token and new password are required' });
    }

    const tokenHash = hashToken(token);
    const user = await findUserByResetToken(tokenHash);

    if (!user) {
        throw new ApiError({ statusCode: 400, message: 'Invalid or expired password reset link' });
    }

    const hashedPassword = await getHashedPassword(newPassword);
    await completePasswordReset(user.id, hashedPassword);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: null,
        message: 'Password has been reset successfully. You can now sign in.'
    }));
});

// ========== SUPER ADMIN APPROVAL ACTIONS ==========
const getPendingRegistrationsList = asyncHandler(async (req, res) => {
    const users = await getPendingRegistrations();
    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: users,
        message: 'Pending registrations fetched successfully'
    }));
});

const approveRegistration = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { roleId } = req.body;

    const user = await findUserById(id);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found' });
    }

    await approveUserRegistration(id, roleId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: null,
        message: 'User registration approved successfully'
    }));
});

const rejectRegistration = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await findUserById(id);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found' });
    }

    await rejectUserRegistration(id);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: null,
        message: 'User registration rejected'
    }));
});

const getRejectedRegistrationsList = asyncHandler(async (req, res) => {
    const requests = await getRejectedRegistrations();
    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: requests,
        message: 'Rejected registrations fetched successfully'
    }));
});

const getPendingPasswordResetsList = asyncHandler(async (req, res) => {
    const requests = await getPendingPasswordResets();
    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: requests,
        message: 'Pending password reset requests fetched successfully'
    }));
});

const approvePasswordResetRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await findUserById(id);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found' });
    }

    const cryptoToken = generateToken(32);
    const tokenHash = hashToken(cryptoToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await approvePasswordReset(id, tokenHash, expiresAt);

    const frontendBase = process.env.FRONTEND_URL || req.headers.origin || (req.headers.referer ? req.headers.referer.replace(/\/$/, '') : null) || 'http://localhost:5173';
    const resetLink = `${frontendBase}/auth/reset-password?token=${cryptoToken}`;

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: {
            token: cryptoToken,
            resetToken: cryptoToken,
            resetLink,
            expiresAt,
            user: {
                id: user.id,
                email: user.email,
                userName: user.userName || user.user_name,
                firstName: user.firstName || user.first_name,
                lastName: user.lastName || user.last_name
            }
        },
        message: 'Password reset approved. Reset link generated successfully.'
    }));
});

const rejectPasswordResetRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await findUserById(id);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found' });
    }

    await rejectPasswordReset(id);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: null,
        message: 'Password reset request rejected'
    }));
});

const getRoles = asyncHandler(async (req, res) => {
    const roles = await getAllRoles();
    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: roles,
        message: 'Roles fetched successfully'
    }));
});

module.exports = {
    registerUser,
    loginUser,
    refreshUserToken,
    getCurrentUser,
    checkVerifyAccessToken,
    checkIsAuthorizeAccess,
    logout,
    logoutAllSessions,
    createRole,
    createPermission,
    assignUserRole,
    assignRolePermission,
    removeRolePermission,
    syncPolicies,
    clearAllPolicies,
    createPolicy,
    deletePolicy,
    updatePolicy,
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
};