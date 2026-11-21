const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { JWT } = require('../../../config/config')
const { ApiError } = require('../services/ApiError')
const { db } = require('../database')
const { getEnforcer } = require('../services/casbin')
const { fetchPageData, buildPagination } = require('../../../utils/pagination')
const { getContext } = require('../helpers/requestContext')
const { getUserAllowedFirms, isStrictSubordinateRole, getUserHighestRoleId, getDescendantRoleIds } = require('../services/firmPermissionCache')

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

// Pre-computed standard bcrypt hash used for constant-time comparisons when a user is not found
// Prevents side-channel timing attacks that could reveal whether an account exists in the database
const DUMMY_HASH = '$2b$10$wT8m9aU9o7L4sN8qE1v6ye7WjM.8Bq1v2K9F8c6y0D1Z2E3F4G5H6';

const isPasswordCorrect = async (password, encryptedPassword) => {
    if (!encryptedPassword) {
        // Run full bcrypt comparison so request takes the exact same ~75ms as an existing user
        await bcrypt.compare(password || '', DUMMY_HASH);
        return false;
    }
    return await bcrypt.compare(password, encryptedPassword);
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

    const roleSlug = data.role || data.role_slug || 'admin';

    return jwt.sign(
        {
            id: data.id,
            email: data.email,
            userName: data.userName || data.user_name,
            fullName: data.fullName || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            role: roleSlug,
            roleId: data.roleId || data.role_id
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
    const list = await db('users')
        .select('id', 'first_name', 'last_name', 'email', 'user_name', 'approval_status', 'created_at')
        .where({ approval_status: 'PENDING' })
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc');

    return list.map(u => ({
        ...u,
        firstName: u.first_name,
        lastName: u.last_name,
        userName: u.user_name,
        approvalStatus: u.approval_status,
        createdAt: u.created_at
    }));
};

const getRejectedRegistrations = async () => {
    const list = await db('users')
        .select('id', 'first_name', 'last_name', 'email', 'user_name', 'approval_status', 'created_at', 'updated_at')
        .where({ approval_status: 'REJECTED' })
        .whereNull('deleted_at')
        .orderBy('updated_at', 'desc');

    return list.map(u => ({
        ...u,
        firstName: u.first_name,
        lastName: u.last_name,
        userName: u.user_name,
        approvalStatus: u.approval_status,
        createdAt: u.created_at,
        updatedAt: u.updated_at
    }));
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
        .select(
            'id',
            'name',
            'slug',
            'description',
            'parent_role_id',
            'parent_role_id as parentRoleId',
            'data_scope',
            'data_scope as dataScope',
            'is_independent',
            'is_independent as isIndependent'
        )
        .where({ is_active: true })
        .orderBy('id', 'asc');
};

// ========== DYNAMIC ROLE HELPERS ==========
const getSuperAdminRoleId = async () => {
    const role = await db('roles')
        .whereRaw('LOWER(slug) = ?', ['super-admin'])
        .first();
    return role ? role.id : null;
};

/**
 * Applies tenant firm scoping and role hierarchy (descendants) scoping to user queries.
 * 
 * Rules:
 * - Super Admin: Global view across all firms (or filtered by query firmId). Sees all roles.
 * - Non-Super Admin (e.g. Administrator, Manager):
 *     1. Scoped to the caller's allowed firms (or query firmId if permitted).
 *     2. Strictly excludes Super Admin accounts.
 *     3. Only includes users whose assigned role in that firm is a descendant of the caller,
 *        plus the caller's own account (if includeSelf is true),
 *        plus pending registration users awaiting approval.
 */
const applyUserTenantAndHierarchyScoping = async (queryBuilder, {
    callerId,
    isSuperAdmin,
    firmId = null,
    includeSelf = true
} = {}) => {
    if (isSuperAdmin) {
        if (firmId && firmId !== 'all') {
            const targetFirmId = parseInt(firmId, 10);
            queryBuilder.whereIn('u.id', function () {
                this.select('user_id')
                    .from('user_firm_branches')
                    .where({ firm_id: targetFirmId, is_active: true });
            });
        }
        return queryBuilder;
    }

    if (!callerId) {
        queryBuilder.whereRaw('1 = 0');
        return queryBuilder;
    }

    const { allowedFirmIds } = await getUserAllowedFirms(callerId);
    let firmIds = Array.from(allowedFirmIds || []);

    if (firmId && firmId !== 'all') {
        const targetFirmId = parseInt(firmId, 10);
        if (firmIds.includes(targetFirmId)) {
            firmIds = [targetFirmId];
        } else {
            queryBuilder.whereRaw('1 = 0');
            return queryBuilder;
        }
    }

    if (firmIds.length === 0) {
        queryBuilder.whereRaw('1 = 0');
        return queryBuilder;
    }

    // Resolve caller's highest role rank in this tenant context
    const callerHighestRoleId = await getUserHighestRoleId(callerId, firmIds.length === 1 ? firmIds[0] : null);
    const descendantRoleIds = callerHighestRoleId ? await getDescendantRoleIds(callerHighestRoleId) : [];
    const superAdminRoleId = await getSuperAdminRoleId();

    // 1. Strictly exclude Super Admin accounts for non-super-admins
    if (superAdminRoleId) {
        queryBuilder.where(function () {
            this.whereNull('u.role_id')
                .orWhere('u.role_id', '!=', superAdminRoleId);
        });
    }

    // 2. Strict firm & descendant role scoping
    queryBuilder.where(function () {
        // A) Subordinate users assigned to caller's firm(s)
        this.whereIn('u.id', function () {
            const sub = this.select('user_id')
                .from('user_firm_branches')
                .whereIn('firm_id', firmIds)
                .where('is_active', true);

            if (descendantRoleIds.length > 0) {
                sub.whereIn('role_id', descendantRoleIds);
            } else {
                sub.whereRaw('1 = 0');
            }
        });

        // B) Caller's own account
        if (includeSelf && callerId) {
            this.orWhere('u.id', callerId);
        }

        // C) Pending registrations awaiting approval
        this.orWhere('u.approval_status', 'PENDING');
    });

    return queryBuilder;
};

// ========== USER DIRECTORY & RECYCLE BIN ==========
const fetchAllUsers = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', status = '', roleId = null, firmId = null, trash = false } = query;
        const isTrash = trash === true || trash === 'true';
        const context = getContext();
        const isSuperAdmin = Boolean(context.isSuperAdmin);

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

        // Apply tenant and hierarchy scoping
        await applyUserTenantAndHierarchyScoping(baseQuery, {
            callerId: context.userId,
            isSuperAdmin,
            firmId,
            includeSelf: !isTrash
        });

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
            baseQuery.where(function () {
                this.where('u.role_id', roleId)
                    .orWhereExists(function () {
                        this.select('*')
                            .from('user_firm_branches as ufb_filter')
                            .whereRaw('ufb_filter.user_id = u.id')
                            .where('ufb_filter.role_id', roleId)
                            .where('ufb_filter.is_active', true);
                    });
            });
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

        const users = await fetchPageData({ baseQuery, page, pageSize });
        if (!users || users.length === 0) return [];

        // Batch fetch firm & branch assignments for retrieved users
        const userIds = users.map(u => u.id);
        const assignments = await db('user_firm_branches as ufb')
            .join('firms as f', 'ufb.firm_id', 'f.id')
            .leftJoin('firm_branches as fb', 'ufb.firm_branch_id', 'fb.id')
            .join('roles as r', 'ufb.role_id', 'r.id')
            .whereIn('ufb.user_id', userIds)
            .where('ufb.is_active', true)
            .where('f.is_active', true)
            .select(
                'ufb.user_id',
                'ufb.firm_id',
                'ufb.firm_id as firmId',
                'f.firm_name',
                'f.firm_name as firmName',
                'ufb.firm_branch_id',
                'ufb.firm_branch_id as firmBranchId',
                'fb.branch_name',
                'fb.branch_name as branchName',
                'fb.branch_code',
                'fb.branch_code as branchCode',
                'ufb.role_id',
                'ufb.role_id as roleId',
                'r.name as role_name',
                'r.name as roleName',
                'r.slug as role_slug',
                'r.slug as roleSlug',
                'ufb.data_scope',
                'ufb.data_scope as dataScope',
                'ufb.is_default',
                'ufb.is_default as isDefault'
            )
            .orderBy('ufb.is_default', 'desc');

        const assignmentMap = new Map();
        for (const a of assignments) {
            if (!assignmentMap.has(a.user_id)) {
                assignmentMap.set(a.user_id, []);
            }
            assignmentMap.get(a.user_id).push(a);
        }

        return users.map(u => {
            const uAssignments = assignmentMap.get(u.id) || [];
            const defaultAssignment = uAssignments.find(a => a.is_default) || uAssignments[0] || null;
            const isUserSuperAdmin = (u.role_slug || '').toLowerCase() === 'super-admin';
            const resolvedRoleName = isUserSuperAdmin ? 'Super Admin' : (defaultAssignment?.role_name || u.role_name);
            const resolvedRoleSlug = isUserSuperAdmin ? 'super-admin' : (defaultAssignment?.role_slug || u.role_slug);
            const resolvedRoleId = isUserSuperAdmin ? u.role_id : (defaultAssignment?.role_id || u.role_id);

            return {
                ...u,
                id: u.id,
                firstName: u.first_name,
                lastName: u.last_name,
                userName: u.user_name,
                email: u.email,
                isActive: u.is_active,
                approvalStatus: u.approval_status,
                createdAt: u.created_at,
                updatedAt: u.updated_at,
                deletedAt: u.deleted_at,
                deletedByName: u.deleted_by_name,
                role_name: resolvedRoleName,
                roleName: resolvedRoleName,
                role_slug: resolvedRoleSlug,
                roleSlug: resolvedRoleSlug,
                role_id: resolvedRoleId,
                roleId: resolvedRoleId,
                assignments: uAssignments,
                is_super_admin: isUserSuperAdmin,
                isSuperAdmin: isUserSuperAdmin
            };
        });
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching users.'
        });
    }
};

const fetchUsersMeta = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', status = '', roleId = null, firmId = null, trash = false } = query;
        const isTrash = trash === true || trash === 'true';
        const context = getContext();
        const isSuperAdmin = Boolean(context.isSuperAdmin);

        const baseQuery = db('users as u');

        if (isTrash) {
            baseQuery.whereNotNull('u.deleted_at');
        } else {
            baseQuery.whereNull('u.deleted_at');
        }

        // Apply tenant and hierarchy scoping to base query
        await applyUserTenantAndHierarchyScoping(baseQuery, {
            callerId: context.userId,
            isSuperAdmin,
            firmId,
            includeSelf: !isTrash
        });

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
            baseQuery.where(function () {
                this.where('u.role_id', roleId)
                    .orWhereExists(function () {
                        this.select('*')
                            .from('user_firm_branches as ufb_filter')
                            .whereRaw('ufb_filter.user_id = u.id')
                            .where('ufb_filter.role_id', roleId)
                            .where('ufb_filter.is_active', true);
                    });
            });
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

        // 2. Scoped Active Count (non-deleted, active, approved within caller's scope)
        const activeCountQuery = db('users as u')
            .whereNull('u.deleted_at')
            .where('u.is_active', true)
            .where('u.approval_status', 'APPROVED');

        await applyUserTenantAndHierarchyScoping(activeCountQuery, {
            callerId: context.userId,
            isSuperAdmin,
            firmId,
            includeSelf: true
        });

        const activeCountRow = await activeCountQuery.count('* as count').first();

        // 3. Scoped Trash Count (deleted within caller's scope)
        const trashCountQuery = db('users as u')
            .whereNotNull('u.deleted_at');

        await applyUserTenantAndHierarchyScoping(trashCountQuery, {
            callerId: context.userId,
            isSuperAdmin,
            firmId,
            includeSelf: false
        });

        const trashCountRow = await trashCountQuery.count('* as count').first();

        // 4. Scoped Pending Count (pending approval within caller's scope)
        const pendingCountQuery = db('users as u')
            .whereNull('u.deleted_at')
            .where('u.approval_status', 'PENDING');

        await applyUserTenantAndHierarchyScoping(pendingCountQuery, {
            callerId: context.userId,
            isSuperAdmin,
            firmId,
            includeSelf: false
        });

        const pendingCountRow = await pendingCountQuery.count('* as count').first();

        return {
            ...paginationResult,
            activeCount: parseInt(activeCountRow?.count || 0, 10),
            trashCount: parseInt(trashCountRow?.count || 0, 10),
            pendingCount: parseInt(pendingCountRow?.count || 0, 10)
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

// Fetch user firm and branch assignments
const fetchUserAssignments = async (userId) => {
    return db('user_firm_branches as ufb')
        .join('firms as f', 'ufb.firm_id', 'f.id')
        .leftJoin('firm_branches as fb', 'ufb.firm_branch_id', 'fb.id')
        .join('roles as r', 'ufb.role_id', 'r.id')
        .where({ 'ufb.user_id': userId })
        .select(
            'ufb.id',
            'ufb.firm_id as firmId',
            'f.firm_name as firmName',
            'ufb.firm_branch_id as firmBranchId',
            'fb.branch_name as branchName',
            'fb.branch_code as branchCode',
            'ufb.role_id as roleId',
            'r.name as roleName',
            'r.slug as roleSlug',
            'ufb.data_scope as dataScope',
            'ufb.is_default as isDefault',
            'ufb.is_active as isActive'
        )
        .orderBy('ufb.firm_id', 'asc');
};

// Fetch user counts by firm
const fetchUserCountsByFirm = async (allowedFirmIds = null) => {
    let query = db('user_firm_branches as ufb')
        .join('firms as f', 'ufb.firm_id', 'f.id')
        .join('users as u', 'ufb.user_id', 'u.id')
        .where('ufb.is_active', true)
        .where('u.is_active', true)
        .where('f.is_active', true)
        .whereNull('u.deleted_at')
        .groupBy('ufb.firm_id', 'f.firm_name')
        .select('ufb.firm_id as firm_id', 'f.firm_name as firm_name')
        .countDistinct('ufb.user_id as user_count');

    if (allowedFirmIds && Array.isArray(allowedFirmIds) && allowedFirmIds.length > 0) {
        query = query.whereIn('ufb.firm_id', allowedFirmIds);
    }

    return await query;
};

// Save user firm and branch assignments in a transaction
const saveUserAssignments = async (userId, { isSuperAdmin = false, assignments = [], scopedFirmIds = null } = {}) => {
    return db.transaction(async (trx) => {
        if (Array.isArray(scopedFirmIds) && scopedFirmIds.length > 0) {
            await trx('user_firm_branches')
                .where({ user_id: userId })
                .whereIn('firm_id', scopedFirmIds)
                .del();
        } else {
            await trx('user_firm_branches').where({ user_id: userId }).del();
        }

        if (isSuperAdmin) {
            const superAdminRole = await trx('roles')
                .whereRaw('LOWER(slug) = ?', ['super-admin'])
                .first();
            if (superAdminRole) {
                await trx('users').where({ id: userId }).update({
                    role_id: superAdminRole.id,
                    updated_at: new Date()
                });
            }
        } else {
            if (assignments.length > 0) {
                const validScopes = ['FIRM', 'BRANCH', 'DESCENDANTS', 'OWN'];

                for (const a of assignments) {
                    const firmBranchId = (a.firmBranchId || a.firm_branch_id) ? parseInt(a.firmBranchId || a.firm_branch_id, 10) : null;
                    const scope = a.dataScope || a.data_scope || (firmBranchId ? 'BRANCH' : 'FIRM');

                    if (!validScopes.includes(scope)) {
                        throw new ApiError({
                            statusCode: 400,
                            message: `Invalid data scope '${scope}'. Allowed scopes: ${validScopes.join(', ')}`
                        });
                    }

                    if (firmBranchId && scope === 'FIRM') {
                        throw new ApiError({
                            statusCode: 400,
                            message: 'Firm-wide data scope (FIRM) cannot be assigned to a specific branch. Either select "All Branches" or set data scope to BRANCH, DESCENDANTS, or OWN.'
                        });
                    }

                    if (!firmBranchId && scope === 'BRANCH') {
                        throw new ApiError({
                            statusCode: 400,
                            message: 'Branch-only data scope (BRANCH) requires a specific branch assignment. Either select a specific branch or set data scope to FIRM, DESCENDANTS, or OWN.'
                        });
                    }
                }

                const rowsToInsert = assignments.map(a => {
                    const firmBranchId = (a.firmBranchId || a.firm_branch_id) ? parseInt(a.firmBranchId || a.firm_branch_id, 10) : null;
                    return {
                        user_id: userId,
                        firm_id: parseInt(a.firmId || a.firm_id, 10),
                        firm_branch_id: firmBranchId,
                        role_id: parseInt(a.roleId || a.role_id, 10),
                        data_scope: a.dataScope || a.data_scope || (firmBranchId ? 'BRANCH' : 'FIRM'),
                        is_default: !!(a.isDefault || a.is_default),
                        is_active: a.isActive !== undefined ? !!a.isActive : (a.is_active !== undefined ? !!a.is_active : true)
                    };
                });

                await trx('user_firm_branches').insert(rowsToInsert);
            }

            // Synchronize users.role_id with the user's active default assignment across all firms
            const allActive = await trx('user_firm_branches').where({ user_id: userId, is_active: true });
            const defaultAssignment = allActive.find(r => r.is_default) || allActive[0];
            if (defaultAssignment && defaultAssignment.role_id) {
                await trx('users').where({ id: userId }).update({
                    role_id: defaultAssignment.role_id,
                    updated_at: new Date()
                });
            } else if (allActive.length === 0) {
                // Fallback role if all firm assignments removed (e.g. employee)
                const defaultRole = await trx('roles')
                    .whereRaw('LOWER(slug) = ?', ['employee'])
                    .first();
                if (defaultRole) {
                    await trx('users').where({ id: userId }).update({
                        role_id: defaultRole.id,
                        updated_at: new Date()
                    });
                }
            }
        }
    });
};

/**
 * Validates if the caller has authority to manage/modify/delete a target user.
 * - Super Admins can manage any user.
 * - Self-administrative operations are disallowed unless allowSelf is explicitly set.
 * - Non-super-admins cannot manage Super Admin accounts.
 * - Non-super-admins must belong to at least one firm in common with the target user.
 * - Non-super-admins can ONLY manage users who hold a strict subordinate role rank.
 */
const canManageTargetUser = async (targetUserId, caller, { allowSelf = false } = {}) => {
    const isCallerSuperAdmin = Boolean(caller?.isSuperAdmin);
    const parsedTargetId = parseInt(targetUserId, 10);
    const callerId = caller?.id ? parseInt(caller.id, 10) : null;

    if (!allowSelf && callerId && parsedTargetId === callerId) {
        return {
            allowed: false,
            statusCode: 400,
            message: 'Security Violation: You cannot perform this administrative operation on your own account.'
        };
    }

    const targetUser = await findUserById(parsedTargetId);
    if (!targetUser) {
        return { allowed: false, statusCode: 404, message: 'User not found.' };
    }

    const superAdminRoleId = await getSuperAdminRoleId();
    const targetIsSuperAdmin = userIsSuperAdmin(targetUser, superAdminRoleId);

    if (targetIsSuperAdmin && !isCallerSuperAdmin) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'Access denied: Super Administrator accounts can only be managed by another Super Administrator.'
        };
    }

    if (isCallerSuperAdmin) {
        return { allowed: true, targetUser };
    }

    const { allowedFirmIds } = await getUserAllowedFirms(caller?.id);
    const firmIds = Array.from(allowedFirmIds || []);
    if (firmIds.length === 0) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'You do not have access to manage users in any firm.'
        };
    }

    const hasCommonFirm = await db('user_firm_branches')
        .where('user_id', parsedTargetId)
        .whereIn('firm_id', firmIds)
        .first();

    const targetHasAnyFirm = await db('user_firm_branches')
        .where('user_id', parsedTargetId)
        .first();

    if (targetHasAnyFirm && !hasCommonFirm) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'Access denied: Target user does not belong to any firm administered by you.'
        };
    }

    // Role hierarchy check: Non-super-admin caller cannot manage peer or superior users
    const callerHighestRoleId = await getUserHighestRoleId(caller.id);
    const targetHighestRoleId = await getUserHighestRoleId(parsedTargetId);

    if (callerHighestRoleId && targetHighestRoleId) {
        const isSubordinate = await isStrictSubordinateRole(callerHighestRoleId, targetHighestRoleId);
        if (!isSubordinate) {
            return {
                allowed: false,
                statusCode: 403,
                message: 'Access denied: You cannot manage accounts with an equal or superior role rank.'
            };
        }
    }

    return { allowed: true, targetUser };
};

const userIsSuperAdmin = (user, superAdminRoleId) => {
    return Boolean(user && user.role_id && superAdminRoleId && user.role_id === superAdminRoleId);
};

/**
 * Validates bulk operations (bulk delete, bulk restore) for caller authority.
 */
const validateBulkUserOperation = async (targetUserIds = [], caller, { permanent = false } = {}) => {
    const isCallerSuperAdmin = Boolean(caller?.isSuperAdmin);
    const callerId = caller?.id ? parseInt(caller.id, 10) : null;

    if (callerId && targetUserIds.map(id => parseInt(id, 10)).includes(callerId)) {
        return {
            allowed: false,
            statusCode: 400,
            message: 'Security Violation: You cannot perform bulk administrative operations on your own account.'
        };
    }

    if (permanent && !isCallerSuperAdmin) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'Access denied: Permanent deletion requires Super Administrator privileges.'
        };
    }

    if (isCallerSuperAdmin) {
        return { allowed: true };
    }

    const superAdminRoleId = await getSuperAdminRoleId();
    if (superAdminRoleId) {
        const superAdmins = await db('users')
            .whereIn('id', targetUserIds)
            .where('role_id', superAdminRoleId);
        if (superAdmins.length > 0) {
            return {
                allowed: false,
                statusCode: 403,
                message: 'Access denied: Super Administrator accounts cannot be modified or deleted by non-super-admins.'
            };
        }
    }

    const { allowedFirmIds } = await getUserAllowedFirms(caller?.id);
    const firmIds = Array.from(allowedFirmIds || []);
    if (firmIds.length === 0) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'You do not have access to manage users in any firm.'
        };
    }

    const validUsers = await db('user_firm_branches')
        .whereIn('user_id', targetUserIds)
        .whereIn('firm_id', firmIds)
        .distinct('user_id');
    const validUserIds = new Set(validUsers.map(u => parseInt(u.user_id, 10)));

    const unauthorizedIds = targetUserIds.filter(id => !validUserIds.has(parseInt(id, 10)));
    if (unauthorizedIds.length > 0) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'Access denied: One or more selected users do not belong to any firm administered by you.'
        };
    }

    // Role hierarchy check for bulk operation: caller cannot manage peers or superiors
    const callerHighestRoleId = await getUserHighestRoleId(caller.id);
    if (callerHighestRoleId) {
        for (const tId of targetUserIds) {
            const targetRoleId = await getUserHighestRoleId(tId);
            if (targetRoleId) {
                const isSubordinate = await isStrictSubordinateRole(callerHighestRoleId, targetRoleId);
                if (!isSubordinate) {
                    return {
                        allowed: false,
                        statusCode: 403,
                        message: 'Access denied: One or more selected users hold an equal or superior role rank.'
                    };
                }
            }
        }
    }

    return { allowed: true };
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
    getSuperAdminRoleId,
    fetchAllUsers,
    fetchUsersMeta,
    fetchUserCountsByFirm,
    softDeleteUser,
    restoreUser,
    permanentDeleteUser,
    bulkDeleteUsers,
    bulkRestoreUsers,
    updateUserRole,
    updateUserActiveStatus,
    updateUserApprovalStatus,
    fetchUserAssignments,
    saveUserAssignments,
    canManageTargetUser,
    validateBulkUserOperation
};