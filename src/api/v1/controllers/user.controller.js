const { asyncHandler } = require('./../services/asyncHandler.js');
const { ApiError } = require('./../services/ApiError.js');
const {
    isUserExist,
    isPasswordCorrect,
    generateRefreshToken,
    updatePassword,
    demoDBCall,
    fetchUserById,
    findUserById,
    fetchAllUsers,
    fetchUsersMeta,
    softDeleteUser,
    restoreUser,
    permanentDeleteUser,
    bulkDeleteUsers,
    bulkRestoreUsers,
    updateUserRole,
    updateUserActiveStatus,
    updateUserApprovalStatus,
    approvePasswordReset,
    getHashedPassword,
    completePasswordReset,
    fetchUserAssignments,
    saveUserAssignments,
    fetchUserCountsByFirm,
    getSuperAdminRoleId,
    canManageTargetUser,
    validateBulkUserOperation
} = require('../models/user.model.js');
const { deleteRefreshTokenByUserID } = require('../models/auth.model.js');
const { getContext } = require('../helpers/requestContext.js');
const { getUserAllowedFirms, invalidateUserTenantCache } = require('../services/firmPermissionCache.js');
const { hashToken, generateToken } = require('../helpers/token.js');
const { uploadOnCloudinary } = require('./../services/cloudinary.js');
const { delay } = require('../services/common.js');
const { ApiResponse } = require('../services/ApiResponse.js');
const jwt = require('jsonwebtoken');
const { JWT } = require('../../../config/config.js');

const userData = [
    {
        id: 1,
        username: 'ksengg',
        email: 'ksengg@gmail.com',
        password: '123',
        yourData: 'something 1'
    },
    {
        id: 2,
        username: 'abdul',
        email: 'abdul@gmail.com',
        password: '456',
        yourData: 'something 2'
    }
];

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;

    if ([fullName, email, username, password].some(field => !field?.trim())) {
        throw new ApiError({ statusCode: 400, message: 'All fields are required' });
    }

    const existedUser = isUserExist(username, email);
    if (existedUser.length > 0) {
        throw new ApiError({ statusCode: 409, message: 'User with email or username already exist' });
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError({ statusCode: 400, message: 'Avatar local file is required' });
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError({ statusCode: 400, message: 'Avatar file is required' });
    }

    const dbData = {
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        email,
        password,
        username: username.toLowerCase()
    };

    await delay(2000);

    const createdUser = {
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        email,
        username: username.toLowerCase()
    };

    if (!createdUser) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while registering user' });
    }

    return res.status(201).json(
        new ApiResponse({ statusCode: 200, data: createdUser, message: 'User registered successfully.' })
    );
});

// Get user by id
const getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.user.id || 0;
    const result = await fetchUserById(userId);

    if (!result) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'User fetched successfully.',
        })
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        throw new ApiError({ statusCode: 400, message: 'old password and new password are required' });
    }

    const user = userData.find(user => user.id == req.user.id);
    const passwordValid = await isPasswordCorrect(oldPassword);
    if (!passwordValid) {
        throw new ApiError({ statusCode: 400, message: 'Invalid old password' });
    }

    user.password = newPassword;

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: {}, message: 'Password changed successfully' }));
});

const updateAccountDetail = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError({ statusCode: 400, message: 'All fields are required' });
    }

    const user = userData.find(user => user.id == req.user?.id);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: user, message: 'Account detail updated successfully' }));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError({ statusCode: 400, message: 'Avatar file is missing' });
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError({ statusCode: 400, message: 'Error while uploading avatar' });
    }

    const user = userData.find(user => user.id == req.user?.id);
    user.avatar = avatar.url;

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: user, message: 'Avatar updated successfully' }));
});

// ========== USER MANAGEMENT & RECYCLE BIN ==========
const getAllUsers = asyncHandler(async (req, res) => {
    const users = await fetchAllUsers(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: users,
            message: 'Users retrieved successfully.'
        })
    );
});

const getUsersMeta = asyncHandler(async (req, res) => {
    const meta = await fetchUsersMeta(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: meta,
            message: 'Users pagination meta retrieved successfully.'
        })
    );
});

const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { permanent } = req.query;
    const isPermanent = permanent === 'true';
    const isCallerSuperAdmin = Boolean(req.user?.isSuperAdmin);

    if (targetUserId === req.user.id) {
        throw new ApiError({
            statusCode: 400,
            message: 'You cannot delete your own account.'
        });
    }

    if (isPermanent && !isCallerSuperAdmin) {
        throw new ApiError({
            statusCode: 403,
            message: 'Access denied: Permanent deletion requires Super Administrator privileges.'
        });
    }

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    if (isPermanent) {
        await permanentDeleteUser(targetUserId);
        await deleteRefreshTokenByUserID(targetUserId);
        invalidateUserTenantCache(targetUserId);
        return res.status(200).json(
            new ApiResponse({
                statusCode: 200,
                data: null,
                message: 'User deleted permanently.'
            })
        );
    } else {
        await softDeleteUser(targetUserId, req.user.id);
        await deleteRefreshTokenByUserID(targetUserId);
        invalidateUserTenantCache(targetUserId);
        return res.status(200).json(
            new ApiResponse({
                statusCode: 200,
                data: null,
                message: 'User moved to recycle bin.'
            })
        );
    }
});

const restoreUserController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    await restoreUser(targetUserId);
    invalidateUserTenantCache(targetUserId);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: null,
            message: 'User restored successfully.'
        })
    );
});

const bulkDeleteUsersController = asyncHandler(async (req, res) => {
    const { ids = [], permanent = false } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError({ statusCode: 400, message: 'User IDs array is required.' });
    }

    const filteredIds = ids.map(id => parseInt(id, 10)).filter(id => id !== req.user.id);

    if (filteredIds.length === 0) {
        throw new ApiError({ statusCode: 400, message: 'No valid user IDs to delete (cannot delete own account).' });
    }

    const check = await validateBulkUserOperation(filteredIds, req.user, { permanent });
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    await bulkDeleteUsers(filteredIds, permanent, req.user.id);

    for (const id of filteredIds) {
        await deleteRefreshTokenByUserID(id);
        invalidateUserTenantCache(id);
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedCount: filteredIds.length },
            message: permanent ? 'Selected users deleted permanently.' : 'Selected users moved to recycle bin.'
        })
    );
});

const bulkRestoreUsersController = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError({ statusCode: 400, message: 'User IDs array is required.' });
    }

    const cleanIds = ids.map(id => parseInt(id, 10));

    const check = await validateBulkUserOperation(cleanIds, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    await bulkRestoreUsers(cleanIds);

    for (const id of cleanIds) {
        invalidateUserTenantCache(id);
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedCount: cleanIds.length },
            message: 'Selected users restored successfully.'
        })
    );
});

const changeUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { roleId } = req.body;
    const isCallerSuperAdmin = Boolean(req.user?.isSuperAdmin);

    if (!roleId) {
        throw new ApiError({ statusCode: 400, message: 'Role ID is required.' });
    }

    if (targetUserId === req.user.id) {
        throw new ApiError({
            statusCode: 400,
            message: 'You cannot change your own role.'
        });
    }

    const superAdminRoleId = await getSuperAdminRoleId();
    if (!isCallerSuperAdmin && superAdminRoleId && parseInt(roleId, 10) === superAdminRoleId) {
        throw new ApiError({
            statusCode: 403,
            message: 'Access denied: Only Super Administrators can assign the Super Administrator role.'
        });
    }

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    await updateUserRole(targetUserId, roleId);
    invalidateUserTenantCache(targetUserId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: null,
            message: 'User role updated successfully.'
        })
    );
});

const toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
        throw new ApiError({ statusCode: 400, message: 'isActive boolean flag is required.' });
    }

    if (targetUserId === req.user.id && !isActive) {
        throw new ApiError({
            statusCode: 400,
            message: 'You cannot deactivate your own account.'
        });
    }

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    await updateUserActiveStatus(targetUserId, isActive);

    if (!isActive) {
        await deleteRefreshTokenByUserID(targetUserId);
    }
    invalidateUserTenantCache(targetUserId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: null,
            message: isActive ? 'User activated successfully.' : 'User deactivated successfully.'
        })
    );
});

const adminGenerateResetLink = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }
    const user = check.targetUser;

    const cryptoToken = generateToken(32);
    const tokenHash = hashToken(cryptoToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await approvePasswordReset(targetUserId, tokenHash, expiresAt);

    const frontendBase = process.env.FRONTEND_URL || req.headers.origin || (req.headers.referer ? req.headers.referer.replace(/\/$/, '') : null) || 'http://localhost:5173';
    const resetLink = `${frontendBase}/auth/reset-password?token=${cryptoToken}`;

    return res.status(200).json(
        new ApiResponse({
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
            message: 'Password reset link generated successfully.'
        })
    );
});

const adminDirectSetPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    const targetUserId = parseInt(id, 10);

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
        throw new ApiError({ statusCode: 400, message: 'New password is required and must be at least 6 characters long.' });
    }

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }
    const user = check.targetUser;

    const hashedPassword = await getHashedPassword(newPassword.trim());
    await completePasswordReset(targetUserId, hashedPassword);
    await deleteRefreshTokenByUserID(targetUserId);
    invalidateUserTenantCache(targetUserId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: targetUserId,
                email: user.email
            },
            message: `Password for ${user.email} has been updated successfully.`
        })
    );
});

const getUserAssignments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);

    const check = await canManageTargetUser(targetUserId, req.user);
    if (!check.allowed) {
        throw new ApiError({ statusCode: check.statusCode, message: check.message });
    }

    const assignments = await fetchUserAssignments(targetUserId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: assignments,
        message: 'User assignments fetched successfully'
    }));
});

const updateUserAssignments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { isSuperAdmin = false, assignments = [] } = req.body;
    const isCallerSuperAdmin = Boolean(req.user?.isSuperAdmin);

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    const superAdminRoleId = await getSuperAdminRoleId();
    const targetIsSuperAdmin = user.role_id && user.role_id === superAdminRoleId;

    // A non-super-admin cannot edit or modify a Super Administrator account
    if (targetIsSuperAdmin && !isCallerSuperAdmin) {
        throw new ApiError({
            statusCode: 403,
            message: 'Access denied: Super Administrator accounts can only be managed by another Super Administrator.'
        });
    }

    if (isSuperAdmin) {
        if (!isCallerSuperAdmin) {
            throw new ApiError({
                statusCode: 403,
                message: 'Access denied: Only Super Administrators can grant Super Admin privileges.'
            });
        }

        // Promote to Super Admin
        await saveUserAssignments(targetUserId, { isSuperAdmin: true, assignments: [] });
        invalidateUserTenantCache(targetUserId);

        return res.status(200).json(new ApiResponse({
            statusCode: 200,
            data: { userId: targetUserId, isSuperAdmin: true, assignmentCount: 0 },
            message: 'User promoted to Global Super Administrator successfully.'
        }));
    }

    if (!Array.isArray(assignments)) {
        throw new ApiError({ statusCode: 400, message: 'assignments must be an array.' });
    }

    let scopedFirmIds = null;
    if (!isCallerSuperAdmin) {
        const { allowedFirmIds } = await getUserAllowedFirms(req.user?.id);
        if (!allowedFirmIds || allowedFirmIds.size === 0) {
            throw new ApiError({ statusCode: 403, message: 'You do not have access to manage users in any firm.' });
        }
        scopedFirmIds = Array.from(allowedFirmIds);

        // Verify that every assignment's firmId is within caller's allowed firms
        // and cannot assign super-admin role
        for (const a of assignments) {
            const firmId = parseInt(a.firmId, 10);
            if (!allowedFirmIds.has(firmId)) {
                throw new ApiError({
                    statusCode: 403,
                    message: `Access denied: You cannot assign users to firm #${firmId} as you do not administer it.`
                });
            }
            if (superAdminRoleId && parseInt(a.roleId, 10) === superAdminRoleId) {
                throw new ApiError({
                    statusCode: 403,
                    message: 'Access denied: The Super Administrator role cannot be assigned at firm or branch level.'
                });
            }
        }
    }

    // Validate uniqueness of firm + branch scope
    const seenScopes = new Set();
    let defaultCount = 0;

    for (const a of assignments) {
        if (!a.firmId || !a.roleId) {
            throw new ApiError({ statusCode: 400, message: 'Every assignment must have a valid firm and role selected.' });
        }
        const firmId = parseInt(a.firmId, 10);
        const firmBranchId = a.firmBranchId ? parseInt(a.firmBranchId, 10) : 'all';
        const scopeKey = `${firmId}:${firmBranchId}`;

        if (seenScopes.has(scopeKey)) {
            const scopeLabel = firmBranchId === 'all' ? 'All Branches (Firm-Wide)' : `Branch #${firmBranchId}`;
            throw new ApiError({
                statusCode: 400,
                message: `Duplicate assignment detected: Firm #${firmId} with ${scopeLabel} is assigned more than once. A user can only hold one role per branch scope.`
            });
        }
        seenScopes.add(scopeKey);

        if (a.isDefault) {
            defaultCount++;
        }
    }

    // Ensure exactly one default when assignments exist
    let normalizedAssignments = [...assignments];
    if (normalizedAssignments.length > 0 && defaultCount !== 1) {
        normalizedAssignments = normalizedAssignments.map((a, idx) => ({
            ...a,
            isDefault: idx === 0
        }));
    }

    await saveUserAssignments(targetUserId, { isSuperAdmin: false, assignments: normalizedAssignments, scopedFirmIds });
    invalidateUserTenantCache(targetUserId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: { userId: targetUserId, isSuperAdmin: false, assignmentCount: normalizedAssignments.length },
        message: 'User entity assignments updated successfully.'
    }));
});

// Get user counts by firm
const getUserCountsByFirmController = asyncHandler(async (req, res) => {
    const context = getContext();
    const isSuperAdmin = Boolean(context.isSuperAdmin);

    let allowedFirmIds = null;
    if (!isSuperAdmin && context.userId) {
        const { allowedFirmIds: userFirms } = await getUserAllowedFirms(context.userId);
        allowedFirmIds = Array.from(userFirms || []);
    }

    const counts = await fetchUserCountsByFirm(allowedFirmIds);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: counts,
        message: 'User counts by firm retrieved successfully.'
    }));
});

module.exports = {
    registerUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetail,
    updateUserAvatar,
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
};