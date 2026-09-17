const { 
    getFirmRolePermissions, 
    hasPermission, 
    isAncestorRole, 
    getDescendantRoleIds, 
    getRoleMetadata 
} = require('../services/firmPermissionCache');
const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require('../services/asyncHandler');
const { getContext } = require('../helpers/requestContext');
const { db } = require('../database');

/**
 * Express middleware to check if the authenticated user has permission
 * to perform a specific action on a module.
 * 
 * Uses the tenant-scoped in-memory LRU cache for ultra-fast (< 0.005 ms) evaluation.
 * 
 * @param {string} module The module slug (e.g., 'invoices', 'challans', 'parties')
 * @param {string} action The action verb (e.g., 'read', 'create', 'update', 'delete', 'approve', 'print')
 */
const checkPermission = (module, action) => {
    return asyncHandler(async (req, res, next) => {
        // User must be authenticated (verifyAccessToken must precede this middleware)
        if (!req.user) {
            throw new ApiError({ statusCode: 401, message: 'Authentication required before permission check.' });
        }

        const userRoleSlug = (req.user.role || '').toLowerCase();
        const roleId = req.user.roleId;

        // Universal fast-path bypass for Super Admin
        if (userRoleSlug === 'super-admin' || roleId === 1 || req.user.isSuperAdmin) {
            return next();
        }

        if (!roleId) {
            throw new ApiError({ statusCode: 401, message: 'User role ID missing from session.' });
        }

        // Determine tenant/firm ID from user or request context
        const context = getContext();
        const firmId = req.user.firmId || context.firmId || 1;

        // Evaluate from high-speed in-memory tenant LRU cache (< 0.005 ms)
        const permSet = await getFirmRolePermissions(firmId, roleId);
        const isAllowed = hasPermission(permSet, module, action);

        if (!isAllowed) {
            throw new ApiError({
                statusCode: 403,
                message: `Forbidden: Your role (${req.user.role || roleId}) does not have permission to ${action} ${module}.`
            });
        }

        next();
    });
};

/**
 * Evaluates whether a user can modify, delete, or override a specific record based on:
 * 1. Super Admin universal override
 * 2. Self-ownership (creator can manage their own drafts)
 * 3. Independent compliance role protection (Auditor logs cannot be tampered with)
 * 4. Firm and branch boundary rules
 * 5. Dynamic role hierarchy (ancestor superior check)
 * 
 * @param {object} currentUser Authenticated user object from req.user
 * @param {object} record The target record (must have firm_id, firm_branch_id, created_by)
 * @param {number|null} [explicitCreatorRoleId] Optional creator role ID if already joined
 * @returns {Promise<boolean>}
 */
async function canModifyRecord(currentUser, record, explicitCreatorRoleId = null) {
    if (!currentUser || !record) return false;

    // 1. Super Admin universal fast-path
    if (currentUser.isSuperAdmin || currentUser.roleId === 1) {
        return true;
    }

    // 2. Self-ownership: User created this record
    const recordCreatorId = record.created_by || record.userId;
    if (recordCreatorId && recordCreatorId === currentUser.id) {
        return true;
    }

    // Resolve creator's active role ID if not provided explicitly
    let creatorRoleId = explicitCreatorRoleId;
    if (!creatorRoleId && recordCreatorId) {
        try {
            const assignment = await db('user_firm_branches')
                .where({
                    user_id: recordCreatorId,
                    firm_id: record.firm_id || currentUser.firmId || 1,
                    is_active: true
                })
                .first();
            creatorRoleId = assignment?.role_id || null;
            if (!creatorRoleId) {
                const userRec = await db('users').where({ id: recordCreatorId }).select('role_id').first();
                creatorRoleId = userRec?.role_id || null;
            }
        } catch (e) {
            creatorRoleId = null;
        }
    }

    // 3. Independent compliance role protection (e.g. Auditor/Compliance findings cannot be modified by operational superiors)
    if (creatorRoleId) {
        const creatorMeta = await getRoleMetadata(creatorRoleId);
        if (creatorMeta.isIndependent && !currentUser.isSuperAdmin) {
            return false;
        }
    }

    // 4. Evaluate against currentUser's operational dataScope
    const dataScope = currentUser.dataScope || 'OWN';

    switch (dataScope) {
        case 'GLOBAL':
            return true;

        case 'FIRM':
            // Can manage records across all branches in their firm
            return record.firm_id === currentUser.firmId;

        case 'BRANCH':
            // Can manage records within their assigned branch (or head-office null-branch records)
            if (record.firm_id !== currentUser.firmId) return false;
            return record.firm_branch_id === currentUser.branchId || record.firm_branch_id === null;

        case 'DESCENDANTS':
            // Must be within same firm and branch, AND creator must be a subordinate role
            if (record.firm_id !== currentUser.firmId) return false;
            if (currentUser.branchId && record.firm_branch_id && record.firm_branch_id !== currentUser.branchId) {
                return false;
            }
            if (!creatorRoleId) return false;
            return await isAncestorRole(currentUser.roleId, creatorRoleId);

        case 'OWN':
        default:
            // Only own records
            return recordCreatorId === currentUser.id;
    }
}

/**
 * Injects operational scope filters into a Knex query builder based on the user's role and data scope.
 * 
 * @param {object} query Knex query builder instance
 * @param {object} currentUser Authenticated user object
 * @param {object} options Column configuration (firmCol, branchCol, creatorCol)
 */
async function applyDataScopeToQuery(query, currentUser, options = {}) {
    const {
        firmCol = 'firm_id',
        branchCol = 'firm_branch_id',
        creatorCol = 'created_by'
    } = options;

    if (!currentUser) return query;

    // Super Admin: Consolidated cross-firm or single-firm filtered
    if (currentUser.isSuperAdmin || currentUser.roleId === 1) {
        if (currentUser.firmId && currentUser.firmId !== 'all') {
            query.where(firmCol, currentUser.firmId);
        }
        return query;
    }

    const firmId = currentUser.firmId || 1;
    query.where(firmCol, firmId);

    const dataScope = currentUser.dataScope || 'OWN';

    if (dataScope === 'FIRM') {
        // Firm wide access
        return query;
    }

    if (dataScope === 'BRANCH') {
        // Branch restricted (includes null branch HO records)
        if (currentUser.branchId) {
            query.where(function () {
                this.where(branchCol, currentUser.branchId).orWhereNull(branchCol);
            });
        }
        return query;
    }

    if (dataScope === 'DESCENDANTS') {
        // Subordinates in the role tree within active branch
        const descendantRoleIds = await getDescendantRoleIds(currentUser.roleId);
        const allowedRoleIds = [currentUser.roleId, ...descendantRoleIds];

        // Find users with these roles in this firm
        const subordinateUsers = await db('user_firm_branches')
            .where({ firm_id: firmId, is_active: true })
            .whereIn('role_id', allowedRoleIds)
            .select('user_id');

        const allowedUserIds = [currentUser.id, ...subordinateUsers.map(u => u.user_id)];

        query.whereIn(creatorCol, allowedUserIds);
        if (currentUser.branchId) {
            query.where(function () {
                this.where(branchCol, currentUser.branchId).orWhereNull(branchCol);
            });
        }
        return query;
    }

    if (dataScope === 'OWN') {
        query.where(creatorCol, currentUser.id);
        return query;
    }

    return query;
}

module.exports = { 
    checkPermission,
    canModifyRecord,
    applyDataScopeToQuery
};
