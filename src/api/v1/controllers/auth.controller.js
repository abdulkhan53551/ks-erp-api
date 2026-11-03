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

const { db } = require('../database');
const { getFirmRolePermissions } = require('../services/firmPermissionCache');
const { getPublicKey } = require('../../../config/rsaKeys');

// Convert to expiry days to number
const REFRESH_TOKEN_EXPIRY_DAYS = Number(JWT.REFRESH_TOKEN_EXPIRE?.match(/\d+/)?.[0]);
const REFRESH_TOKEN_EXPIRY_IN_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

/**
 * Helper to fetch permission strings for a user role, using the in-memory LRU cache
 */
const getUserPermissions = async (roleSlug, roleId, firmId = null) => {
    if ((roleSlug || '').toLowerCase() === 'super-admin') return ['*'];
    if (!roleId || !firmId) return [];
    try {
        const permSet = await getFirmRolePermissions(firmId, roleId);
        return Array.from(permSet);
    } catch (err) {
        console.error('Error fetching user permissions:', err);
        return [];
    }
};

/**
 * Helper to fetch all authorized firms and branches for a user.
 * For Super Admin, returns all active firms and their active branches.
 * For Standard Users, returns mappings from user_firm_branches with assigned roles.
 */
const getUserFirmsAndBranches = async (user) => {
    const isSuperAdmin = (user.role_slug || '').toLowerCase() === 'super-admin';

    let availableFirms = [];
    if (isSuperAdmin) {
        const firms = await db('firms')
            .where({ is_active: true })
            .select('id', 'firm_name as firmName', 'trade_name as tradeName', 'logo_url as logoUrl', 'gstin')
            .orderBy('id', 'asc');

        for (const f of firms) {
            const branches = await db('firm_branches')
                .where({ firm_id: f.id, is_active: true })
                .select('id', 'branch_name as branchName', 'branch_code as branchCode', 'is_head_office as isHeadOffice', 'gstin')
                .orderBy('is_head_office', 'desc')
                .orderBy('id', 'asc');

            availableFirms.push({
                ...f,
                role: user.role_slug || 'super-admin',
                roleId: user.role_id || null,
                roleName: user.role_name || 'Super Administrator',
                branches
            });
        }
    } else {
        const mappings = await db('user_firm_branches as ufb')
            .join('firms as f', 'ufb.firm_id', 'f.id')
            .leftJoin('firm_branches as fb', 'ufb.firm_branch_id', 'fb.id')
            .join('roles as r', 'ufb.role_id', 'r.id')
            .where({
                'ufb.user_id': user.id,
                'ufb.is_active': true,
                'f.is_active': true
            })
            .select(
                'f.id as firm_id',
                'f.firm_name as firm_name',
                'f.trade_name as trade_name',
                'f.logo_url as logo_url',
                'f.gstin as firm_gstin',
                'fb.id as branch_id',
                'fb.branch_name as branch_name',
                'fb.branch_code as branch_code',
                'fb.is_head_office as is_head_office',
                'fb.gstin as branch_gstin',
                'r.id as role_id',
                'r.name as role_name',
                'r.slug as role_slug',
                'ufb.data_scope as data_scope',
                'ufb.is_default as is_default'
            )
            .orderBy('f.id', 'asc');

        const firmMap = new Map();
        for (const m of mappings) {
            if (!firmMap.has(m.firm_id)) {
                firmMap.set(m.firm_id, {
                    id: m.firm_id,
                    firmName: m.firm_name,
                    tradeName: m.trade_name,
                    logoUrl: m.logo_url,
                    gstin: m.firm_gstin,
                    role: m.role_slug,
                    roleId: m.role_id,
                    roleName: m.role_name,
                    dataScope: m.data_scope || (m.branch_id ? 'BRANCH' : 'FIRM'),
                    isDefault: m.is_default,
                    branches: []
                });
            }

            const currentFirm = firmMap.get(m.firm_id);
            if (m.branch_id) {
                currentFirm.branches.push({
                    id: m.branch_id,
                    branchName: m.branch_name,
                    branchCode: m.branch_code,
                    isHeadOffice: m.is_head_office,
                    gstin: m.branch_gstin,
                    role: m.role_slug,
                    roleId: m.role_id,
                    roleName: m.role_name,
                    dataScope: m.data_scope || 'BRANCH'
                });
            } else {
                // Wildcard access to all branches of this firm
                const allBranches = await db('firm_branches')
                    .where({ firm_id: m.firm_id, is_active: true })
                    .select('id', 'branch_name as branchName', 'branch_code as branchCode', 'is_head_office as isHeadOffice', 'gstin')
                    .orderBy('is_head_office', 'desc')
                    .orderBy('id', 'asc');

                currentFirm.branches = allBranches.map(b => ({
                    ...b,
                    role: m.role_slug,
                    roleId: m.role_id,
                    roleName: m.role_name,
                    dataScope: m.data_scope || 'FIRM'
                }));
            }
        }
        availableFirms = Array.from(firmMap.values());
    }

    return availableFirms;
};

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

    // Verify password in constant time (dummy comparison runs if user does not exist)
    // Unified error message prevents username/email enumeration attacks
    const isPasswordValid = await isPasswordCorrect(password, user?.password);
    if (!user?.id || !isPasswordValid) {
        throw new ApiError({ statusCode: 401, message: 'Invalid username/email or password' });
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

    // Fetch user's authorized firms & branches
    const availableFirms = await getUserFirmsAndBranches(user);

    const isSuperAdmin = (user.role_slug || '').toLowerCase() === 'super-admin';
    if (!isSuperAdmin && availableFirms.length === 0) {
        throw new ApiError({
            statusCode: 403,
            message: 'Your account is approved, but no firm has been assigned to you yet. Please contact your administrator.'
        });
    }

    // Determine default firm and branch
    // For Super Admin: starts in Global Consolidated View ("All Firms") with firmId: null, branchId: null
    // For Standard Users: starts in their primary assigned default firm
    let defaultFirm = null;
    let firmId = null;
    let defaultBranch = null;
    let branchId = null;

    if (!isSuperAdmin) {
        defaultFirm = availableFirms.find(f => f.isDefault) || availableFirms[0] || null;
        firmId = defaultFirm?.id || null;
        defaultBranch = defaultFirm?.branches?.find(b => b.isHeadOffice) || defaultFirm?.branches?.[0] || null;
        branchId = defaultBranch?.id || null;
    }

    const roleSlug = isSuperAdmin ? 'super-admin' : (defaultFirm?.role || user.role_slug || 'admin');
    const roleName = isSuperAdmin ? 'Super Administrator' : (defaultFirm?.roleName || user.role_name || 'Administrator');
    const roleId = isSuperAdmin ? user.role_id : (defaultFirm?.roleId || user.role_id);
    const isSuperAdminUser = isSuperAdmin;
    const dataScope = isSuperAdminUser ? 'GLOBAL' : (defaultFirm?.dataScope || 'OWN');

    // Access and refresh token generation (cryptographically bound to active tenant context)
    const tokenData = {
        user: { ...user, role: roleSlug, roleId, firmId, branchId, isSuperAdmin: isSuperAdminUser, dataScope },
        ip: ipAddress,
        userAgent,
        deviceId: null
    };
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(tokenData);

    const permissions = await getUserPermissions(roleSlug, roleId, firmId);

    const userProfile = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        userName: user.user_name,
        roleId,
        role: roleSlug,
        roleName,
        firmId,
        branchId,
        isSuperAdmin: isSuperAdminUser,
        dataScope,
        permissions
    };

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        partitioned: true,
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    };

    response = {
        statusCode: 200,
        data: {
            accessToken,
            refreshToken,
            user: userProfile,
            firms: availableFirms,
            defaultContext: {
                firmId,
                branchId
            }
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
    const { firmId, branchId } = req.body || {};

    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while generating refresh token'
    };

    // Check if refresh token is present
    if (!refreshToken) {
        throw new ApiError({ statusCode: 400, message: 'Refresh token is required' });
    }

    const preferredContext = {
        firmId: firmId ? parseInt(firmId, 10) : null,
        branchId: branchId ? parseInt(branchId, 10) : null
    };

    // Get new refresh token
    const { accessToken, newToken: newRefreshToken } = await rotateRefreshToken(refreshToken, ip, userAgent, null, preferredContext);

    // Get token data
    const tokens = { accessToken, ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}) };

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        partitioned: true,
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
        const roleSlug = user.role || user.roleSlug || user.role_slug || null;
        const isSuperAdmin = Boolean(user.isSuperAdmin) || (roleSlug || '').toLowerCase() === 'super-admin';

        // Generate access token (clean identity payload + cryptographically bound tenant context)
        const tokenPayload = {
            id: user.id,
            email: user.email,
            userName: user.user_name || user.userName,
            fullName: `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim(),
            role: roleSlug,
            roleId: user.role_id || user.roleId,
            firmId: user.firmId || null,
            branchId: user.branchId || null,
            isSuperAdmin,
            dataScope: user.dataScope || (isSuperAdmin ? 'GLOBAL' : 'OWN')
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

/**
 * Switch Active Firm and Branch Context
 * Signs and issues a brand-new accessToken with updated firmId and branchId.
 * Refresh token remains untouched in DB and client session.
 * POST /api/v1/auth/switch-context
 */
const switchFirmContext = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ApiError({ statusCode: 401, message: 'Authentication required to switch firm context.' });
    }

    // Client must pass camelCase inputs
    const { firmId, branchId } = req.body;

    const user = await fetchUserById(userId);
    if (!user || !user.is_active || user.deleted_at) {
        throw new ApiError({ statusCode: 403, message: 'User account is not active.' });
    }

    const isSuperAdmin = (user.role_slug || '').toLowerCase() === 'super-admin';
    const isAllFirms = firmId === 'all' || firmId === null || firmId === 'null' || firmId === 0 || firmId === '' || firmId === undefined;

    // Handle Consolidated All Firms mode for Super Admin
    if (isAllFirms) {
        if (!isSuperAdmin) {
            throw new ApiError({ statusCode: 403, message: 'Only Super Administrators can switch to consolidated All Firms view.' });
        }

        const roleSlug = 'super-admin';
        const roleId = user.role_id;
        const roleName = 'Super Administrator';
        const dataScope = 'GLOBAL';
        const permissions = ['*'];

        const tokenPayload = {
            id: user.id,
            email: user.email,
            userName: user.user_name,
            fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            role: roleSlug,
            roleId,
            firmId: null,
            branchId: null,
            isSuperAdmin: true,
            dataScope
        };
        const accessToken = generateAccessToken(tokenPayload);

        const userProfile = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            userName: user.user_name,
            roleId,
            role: roleSlug,
            roleName,
            firmId: null,
            branchId: null,
            isSuperAdmin: true,
            dataScope,
            permissions
        };

        return res.status(200).json(
            new ApiResponse({
                statusCode: 200,
                data: {
                    accessToken,
                    user: userProfile,
                    defaultContext: {
                        firmId: null,
                        branchId: null
                    }
                },
                message: 'Switched to Consolidated All Firms context.'
            })
        );
    }

    const targetFirmId = parseInt(firmId, 10);
    if (isNaN(targetFirmId) || targetFirmId <= 0) {
        throw new ApiError({ statusCode: 400, message: 'Valid firmId is required.' });
    }
    const targetBranchId = branchId ? parseInt(branchId, 10) : null;
    let roleSlug = user.role_slug;
    let roleId = user.role_id;
    let roleName = user.role_name;
    let dataScope = 'OWN';

    if (isSuperAdmin) {
        const targetFirm = await db('firms').where({ id: targetFirmId, is_active: true }).first();
        if (!targetFirm) {
            throw new ApiError({ statusCode: 404, message: 'Selected firm does not exist or is inactive.' });
        }
        roleSlug = 'super-admin';
        roleName = 'Super Administrator';
        dataScope = 'GLOBAL';
    } else {
        const { allowedFirmIds, assignments } = await firmPermissionCache.getUserAllowedFirms(userId);
        if (!allowedFirmIds || !allowedFirmIds.has(targetFirmId)) {
            throw new ApiError({ statusCode: 403, message: 'Access denied: You do not have access to the selected firm.' });
        }

        const firmAssignments = (assignments || []).filter(a => a.firm_id === targetFirmId);
        let match = null;
        if (targetBranchId) {
            match = firmAssignments.find(a => a.firm_branch_id === targetBranchId) ||
                    firmAssignments.find(a => a.firm_branch_id === null);
        } else {
            match = firmAssignments.find(a => a.firm_branch_id === null) || firmAssignments[0];
        }

        if (match) {
            roleSlug = match.role_slug || user.role_slug;
            roleId = match.role_id || user.role_id;
            roleName = match.role_name || user.role_name;
            dataScope = match.data_scope || (match.firm_branch_id ? 'BRANCH' : 'FIRM');
        } else {
            throw new ApiError({ statusCode: 403, message: 'Access denied: You do not have access to the selected branch.' });
        }
    }

    const permissions = await getUserPermissions(roleSlug, roleId, targetFirmId);

    // Sign new access token with updated firm and branch context
    const tokenPayload = {
        id: user.id,
        email: user.email,
        userName: user.user_name,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        role: roleSlug,
        roleId,
        firmId: targetFirmId,
        branchId: targetBranchId,
        isSuperAdmin,
        dataScope
    };
    const accessToken = generateAccessToken(tokenPayload);

    const userProfile = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        userName: user.user_name,
        roleId,
        role: roleSlug,
        roleName,
        firmId: targetFirmId,
        branchId: targetBranchId,
        isSuperAdmin,
        dataScope,
        permissions
    };

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                accessToken,
                user: userProfile,
                defaultContext: {
                    firmId: targetFirmId,
                    branchId: targetBranchId
                }
            },
            message: 'Switched firm context successfully.'
        })
    );
});

// Get Current Authenticated User (/auth/me)
const getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const user = await fetchUserById(userId);

    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found' });
    }

    const availableFirms = await getUserFirmsAndBranches(user);
    const isSuperAdminUser = (user.role_slug || '').toLowerCase() === 'super-admin';

    if (!isSuperAdminUser && availableFirms.length === 0) {
        throw new ApiError({
            statusCode: 403,
            message: 'Your account is approved, but no firm has been assigned to you yet. Please contact your administrator.'
        });
    }

    const activeFirmId = req.user?.firmId || (isSuperAdminUser ? null : (availableFirms[0]?.id || null));
    const activeBranchId = req.user?.branchId || null;

    const currentFirm = activeFirmId ? (availableFirms.find(f => f.id === activeFirmId) || null) : (isSuperAdminUser ? null : (availableFirms[0] || null));
    const currentBranch = activeBranchId ? currentFirm?.branches?.find(b => b.id === activeBranchId) : null;

    const roleSlug = isSuperAdminUser ? 'super-admin' : (currentBranch?.role || currentFirm?.role || user.role_slug || req.user?.role || 'admin');
    const roleId = isSuperAdminUser ? user.role_id : (currentBranch?.roleId || currentFirm?.roleId || user.role_id || req.user?.roleId);
    const roleName = isSuperAdminUser ? 'Super Administrator' : (currentBranch?.roleName || currentFirm?.roleName || user.role_name || 'Administrator');
    const dataScope = isSuperAdminUser ? 'GLOBAL' : (currentBranch?.dataScope || currentFirm?.dataScope || req.user?.dataScope || 'OWN');

    const permissions = await getUserPermissions(roleSlug, roleId, activeFirmId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: {
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                userName: user.user_name,
                roleId,
                role: roleSlug,
                roleName,
                firmId: activeFirmId,
                branchId: activeBranchId,
                isSuperAdmin: isSuperAdminUser,
                dataScope,
                permissions
            },
            firms: availableFirms
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
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        const userId = req.user?.id;

        if (refreshToken && userId) {
            const hashedToken = hashToken(refreshToken);
            await deleteRefreshTokenByUserIDAndToken(userId, hashedToken);
        } else if (userId) {
            // Incognito / third-party cookie blocked fallback:
            // Invalidate active refresh tokens for this user
            await deleteRefreshTokenByUserID(userId);
        }

        // Clear the refresh token cookie
        clearAccessAndRefreshTokenCookie(res);

        return res
            .status(200)
            .json(new ApiResponse({ statusCode: 200, message: 'Logged out successfully' }));
    } catch (err) {
        console.log('Error during logout:', err);
        // Ensure cookie is cleared even on error so user is never trapped
        clearAccessAndRefreshTokenCookie(res);
        return res
            .status(200)
            .json(new ApiResponse({ statusCode: 200, message: 'Logged out successfully' }));
    }
});

// Logout all sessions
const logoutAllSessions = asyncHandler(async (req, res, next) => {
    try {
        const userId = req.user?.id;

        if (userId) {
            await deleteRefreshTokenByUserID(userId);
        }

        // Clear the refresh token cookie
        clearAccessAndRefreshTokenCookie(res);

        return res.status(200).json(new ApiResponse({ statusCode: 200, message: 'Logged out from all sessions' }));
    } catch (err) {
        clearAccessAndRefreshTokenCookie(res);
        return res.status(200).json(new ApiResponse({ statusCode: 200, message: 'Logged out from all sessions' }));
    }
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

    // Invalidate all active refresh tokens & sessions across all devices for this user
    await deleteRefreshTokenByUserID(user.id);
    clearAccessAndRefreshTokenCookie(res);

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

// Get RSA Public Key for client-side in-flight credential encryption
const getAuthPublicKey = asyncHandler(async (req, res) => {
    const publicKey = getPublicKey();
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { publicKey },
            message: 'Public key retrieved successfully.'
        })
    );
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
    getRoles,
    switchFirmContext,
    getAuthPublicKey
};