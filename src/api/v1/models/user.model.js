const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { JWT } = require('../../../config/config')
const { ApiError } = require('../services/ApiError')
const { db } = require('../database')
const { getEnforcer } = require('../services/casbin')
const { fetchPageData, buildPagination } = require('../../../utils/pagination')

//  Is user exist
const isUserExist = async (username = '', email = '') => {
    try {
        const query = db('users as u')
            .leftJoin('roles as r', 'u.role_id', 'r.id')
            .select(
                'u.*',
                'r.name as role_name',
                'r.slug as role_slug'
            )
            .where(function () {
                this.where('u.email', email).orWhere('u.user_name', username);
            })
            .first();

        const user = await query;
        return user;
    } catch (error) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while checking user exist or not.' });
    }
};

// Find user by ID
const findUserById = async (id) => {
    const user = db('users')
        .where({ id })
        .first();

    return user;
};

// Fetch user by ID
const fetchUserById = async (id) => {
    try {
        const result = await db('users as u')
            .leftJoin('roles as r', 'u.role_id', 'r.id')
            .select(
                'u.id',
                'u.email',
                'u.user_name',
                'u.first_name',
                'u.last_name',
                'u.role_id',
                'u.is_active',
                'u.approval_status',
                'r.name as role_name',
                'r.slug as role_slug'
            )
            .where({ 'u.id': id })
            .first();

        return result || null;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching user by ID.',
        });
    }
};

const updatePassword = async (oldPassword, newPassword) => {
    try {
        // Check if the old password and new password is present
        if (!oldPassword || !newPassword) return

        // If the old password is the same as the new password, return 
        if (oldPassword != newPassword) return

        // If the old password is different from the new password
        // In case of password string modified
        const encPass = await bcrypt.hash(newPassword, 10)

        // Update password in database
    } catch (error) {
        new ApiError({ stateCode: 400, message: 'Error updating password' })
    }
}

const isPasswordCorrect = async (password, encryptedPassword) => {
    return await bcrypt.compare(password, encryptedPassword)
}

// Hash password
const getHashedPassword = async (password) => {
    // Check if the password is present
    if (!password) return

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    return hashedPassword
}

const generateToken = (data) => {
    // Static data for testing
    // const data = {
    //     id: 1,
    //     email: 'test@gmail.com',
    //     userName: 'test123',
    //     fullName: 'Abdul Khan'
    // }

    return jwt.sign(
        {
            id: data.id,
            email: data.email,
            userName: data.userName || data.user_name,
            fullName: data.fullName || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            role: data.role || data.role_slug || 'admin',
            roleId: data.roleId || data.role_id,
            firmId: data.firmId || 1
        },
        JWT.ACCESS_TOKEN_SECRET,
        {
            expiresIn: JWT.ACCESS_TOKEN_EXPIRE
        }
    )
}

const generateRefreshToken = (data) => {
    // Static data for testing
    // const data = {
    //     id: 1,
    // }

    return jwt.sign(
        {
            id: data.id,
        },
        JWT.REFRESH_TOKEN_SECRET,
        {
            expiresIn: JWT.REFRESH_TOKEN_EXPIRE
        }
    )
}

// ========== REGISTRATION APPROVAL ==========
const getPendingRegistrations = async () => {
    return db('users')
        .select('id', 'first_name', 'last_name', 'email', 'user_name', 'approval_status', 'created_at')
        .where({ approval_status: 'PENDING' })
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc');
};

const getRejectedRegistrations = async () => {
    return db('users')
        .select('id', 'first_name', 'last_name', 'email', 'user_name', 'approval_status', 'created_at', 'updated_at')
        .where({ approval_status: 'REJECTED' })
        .whereNull('deleted_at')
        .orderBy('updated_at', 'desc');
};

const approveUserRegistration = async (userId, roleId = null) => {
    const updateData = {
        approval_status: 'APPROVED',
        is_active: true,
        updated_at: new Date()
    };
    if (roleId) {
        updateData.role_id = roleId;
    }
    return db('users').where({ id: userId }).update(updateData);
};

const rejectUserRegistration = async (userId) => {
    return db('users').where({ id: userId }).update({
        approval_status: 'REJECTED',
        is_active: false,
        updated_at: new Date()
    });
};

// ========== PASSWORD RESET ==========
const requestPasswordReset = async (email) => {
    return db('users')
        .where({ email })
        .update({
            reset_status: 'PENDING',
            updated_at: new Date()
        });
};

const getPendingPasswordResets = async () => {
    return db('users')
        .select('id', 'first_name', 'last_name', 'email', 'user_name', 'reset_status', 'updated_at as requested_at')
        .where({ reset_status: 'PENDING' })
        .orderBy('updated_at', 'desc');
};

const approvePasswordReset = async (userId, tokenHash, expiresAt) => {
    return db('users').where({ id: userId }).update({
        reset_status: 'APPROVED',
        reset_token_hash: tokenHash,
        reset_token_expires_at: expiresAt,
        updated_at: new Date()
    });
};

const rejectPasswordReset = async (userId) => {
    return db('users').where({ id: userId }).update({
        reset_status: null,
        reset_token_hash: null,
        reset_token_expires_at: null,
        updated_at: new Date()
    });
};

const findUserByResetToken = async (tokenHash) => {
    return db('users')
        .where({ reset_token_hash: tokenHash, reset_status: 'APPROVED' })
        .andWhere('reset_token_expires_at', '>', new Date())
        .first();
};

const completePasswordReset = async (userId, hashedPassword) => {
    return db('users').where({ id: userId }).update({
        password: hashedPassword,
        reset_status: null,
        reset_token_hash: null,
        reset_token_expires_at: null,
        updated_at: new Date()
    });
};

const getAllRoles = async () => {
    return db('roles')
        .select('id', 'name', 'slug', 'description')
        .where({ is_active: true })
        .orderBy('id', 'asc');
};

// ========== USER DIRECTORY & RECYCLE BIN ==========
const fetchAllUsers = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', status = '', roleId = null, trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('users as u')
            .leftJoin('roles as r', 'u.role_id', 'r.id')
            .leftJoin('users as du', 'u.deleted_by', 'du.id')
            .select(
                'u.id',
                'u.first_name',
                'u.last_name',
                'u.user_name',
                'u.email',
                'u.role_id',
                'u.is_active',
                'u.approval_status',
                'u.created_at',
                'u.updated_at',
                'u.deleted_at',
                'r.name as role_name',
                'r.slug as role_slug',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by_name`)
            );

        if (isTrash) {
            baseQuery.whereNotNull('u.deleted_at');
        } else {
            baseQuery.whereNull('u.deleted_at');
        }

        if (status) {
            if (status === 'APPROVED') {
                baseQuery.where('u.approval_status', 'APPROVED').where('u.is_active', true);
            } else if (status === 'PENDING') {
                baseQuery.where('u.approval_status', 'PENDING');
            } else if (status === 'REJECTED') {
                baseQuery.where('u.approval_status', 'REJECTED');
            } else if (status === 'INACTIVE') {
                baseQuery.where('u.is_active', false);
            }
        }

        if (roleId) {
            baseQuery.where('u.role_id', roleId);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('u.first_name', 'ILIKE', `%${search}%`)
                    .orWhere('u.last_name', 'ILIKE', `%${search}%`)
                    .orWhere('u.user_name', 'ILIKE', `%${search}%`)
                    .orWhere('u.email', 'ILIKE', `%${search}%`);
            });
        }

        const sortColumnMap = {
            id: 'u.id',
            userName: 'u.user_name',
            email: 'u.email',
            role: 'r.name',
            approvalStatus: 'u.approval_status',
            isActive: 'u.is_active',
            createdAt: 'u.created_at',
            deletedAt: 'u.deleted_at'
        };

        const sortColumn = sortColumnMap[query.sortBy] || (isTrash ? 'u.deleted_at' : 'u.id');
        const direction = query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

        baseQuery.orderBy(sortColumn, direction);

        return await fetchPageData({ baseQuery, page, pageSize });
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching users.'
        });
    }
};

const fetchUsersMeta = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', status = '', roleId = null, trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('users as u');

        if (isTrash) {
            baseQuery.whereNotNull('u.deleted_at');
        } else {
            baseQuery.whereNull('u.deleted_at');
        }

        if (status) {
            if (status === 'APPROVED') {
                baseQuery.where('u.approval_status', 'APPROVED').where('u.is_active', true);
            } else if (status === 'PENDING') {
                baseQuery.where('u.approval_status', 'PENDING');
            } else if (status === 'REJECTED') {
                baseQuery.where('u.approval_status', 'REJECTED');
            } else if (status === 'INACTIVE') {
                baseQuery.where('u.is_active', false);
            }
        }

        if (roleId) {
            baseQuery.where('u.role_id', roleId);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('u.first_name', 'ILIKE', `%${search}%`)
                    .orWhere('u.last_name', 'ILIKE', `%${search}%`)
                    .orWhere('u.user_name', 'ILIKE', `%${search}%`)
                    .orWhere('u.email', 'ILIKE', `%${search}%`);
            });
        }

        const paginationResult = await buildPagination({ baseQuery, page, pageSize });

        // Total counts for active records vs recycle bin
        const activeCountRow = await db('users').whereNull('deleted_at').count('* as count').first();
        const trashCountRow = await db('users').whereNotNull('deleted_at').count('* as count').first();

        return {
            ...paginationResult,
            activeCount: parseInt(activeCountRow?.count || 0),
            trashCount: parseInt(trashCountRow?.count || 0)
        };
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching users pagination meta.'
        });
    }
};

const softDeleteUser = async (userId, deletedBy = null) => {
    return db('users').where({ id: userId }).update({
        deleted_at: new Date(),
        deleted_by: deletedBy,
        is_active: false,
        updated_at: new Date()
    });
};

const restoreUser = async (userId) => {
    return db('users').where({ id: userId }).update({
        deleted_at: null,
        deleted_by: null,
        is_active: true,
        updated_at: new Date()
    });
};

const permanentDeleteUser = async (userId) => {
    return db('users').where({ id: userId }).del();
};

const bulkDeleteUsers = async (ids = [], permanent = false, deletedBy = null) => {
    if (permanent) {
        return db('users').whereIn('id', ids).del();
    }
    return db('users').whereIn('id', ids).update({
        deleted_at: new Date(),
        deleted_by: deletedBy,
        is_active: false,
        updated_at: new Date()
    });
};

const bulkRestoreUsers = async (ids = []) => {
    return db('users').whereIn('id', ids).update({
        deleted_at: null,
        deleted_by: null,
        is_active: true,
        updated_at: new Date()
    });
};

const updateUserRole = async (userId, roleId) => {
    return db('users').where({ id: userId }).update({
        role_id: roleId,
        updated_at: new Date()
    });
};

const updateUserActiveStatus = async (userId, isActive) => {
    return db('users').where({ id: userId }).update({
        is_active: isActive,
        updated_at: new Date()
    });
};

const updateUserApprovalStatus = async (userId, approvalStatus) => {
    const updateData = {
        approval_status: approvalStatus,
        updated_at: new Date()
    };
    if (approvalStatus === 'APPROVED') {
        updateData.is_active = true;
    } else if (approvalStatus === 'REJECTED') {
        updateData.is_active = false;
    }
    return db('users').where({ id: userId }).update(updateData);
};

module.exports = {
    isUserExist,
    findUserById,
    fetchUserById,
    updatePassword,
    isPasswordCorrect,
    getHashedPassword,
    generateToken,
    generateRefreshToken,
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
    getAllRoles,
    fetchAllUsers,
    fetchUsersMeta,
    softDeleteUser,
    restoreUser,
    permanentDeleteUser,
    bulkDeleteUsers,
    bulkRestoreUsers,
    updateUserRole,
    updateUserActiveStatus,
    updateUserApprovalStatus
};