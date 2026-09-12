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
    completePasswordReset
} = require('../models/user.model.js');
const { deleteRefreshTokenByUserID } = require('../models/auth.model.js');
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

    if (targetUserId === req.user.id) {
        throw new ApiError({
            statusCode: 400,
            message: 'You cannot delete your own account.'
        });
    }

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    if (isPermanent) {
        await permanentDeleteUser(targetUserId);
        await deleteRefreshTokenByUserID(targetUserId);
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

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    await restoreUser(targetUserId);
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

    await bulkDeleteUsers(filteredIds, permanent, req.user.id);

    for (const id of filteredIds) {
        await deleteRefreshTokenByUserID(id);
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
    await bulkRestoreUsers(cleanIds);

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

    if (!roleId) {
        throw new ApiError({ statusCode: 400, message: 'Role ID is required.' });
    }

    if (targetUserId === req.user.id) {
        throw new ApiError({
            statusCode: 400,
            message: 'You cannot change your own role.'
        });
    }

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    await updateUserRole(targetUserId, roleId);

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

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    await updateUserActiveStatus(targetUserId, isActive);

    if (!isActive) {
        await deleteRefreshTokenByUserID(targetUserId);
    }

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

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

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

    const user = await findUserById(targetUserId);
    if (!user) {
        throw new ApiError({ statusCode: 404, message: 'User not found.' });
    }

    const hashedPassword = await getHashedPassword(newPassword.trim());
    await completePasswordReset(targetUserId, hashedPassword);
    await deleteRefreshTokenByUserID(targetUserId);

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

module.exports = {
    registerUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetail,
    updateUserAvatar,
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
};