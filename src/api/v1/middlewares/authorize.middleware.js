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
        if (req.user?.isSuperAdmin) {
            return next();
        }

        if (!roleId) {
            throw new ApiError({ statusCode: 401, message: 'User role ID missing from session.' });
        }

        // Determine tenant/firm ID from user or request context
        const context = getContext();
        const firmId = req.query?.firmId || req.body?.firmId || req.user.firmId || context.firmId;

        if (!firmId) {
            throw new ApiError({ statusCode: 403, message: 'Tenant firm context required before permission check.' });
        }

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
    if (currentUser?.isSuperAdmin) {
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
                    firm_id: record.firm_id || currentUser.firmId,
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

    // Super Admin: Consolidated cross-firm or single-firm filtered (GLOBAL data scope)
    if (currentUser?.isSuperAdmin || currentUser?.dataScope === 'GLOBAL') {
        if (currentUser.firmId && currentUser.firmId !== 'all') {
            query.where(firmCol, currentUser.firmId);
        }
        return query;
    }

    const firmId = currentUser.firmId;
    if (firmId) {
        query.where(firmCol, firmId);
    }

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

/**
 * Middleware to enforce that a specific firm is selected before any mutation.
 * When the header is 'all' and no firmId is in the body, it rejects with 400.
 * Super admins MUST still pick a firm for writes (they can't insert into "all firms").
 * 
 * GET requests pass through (consolidated view is allowed for reads).
 * 
 * Usage in routes:
 *   router.post('/', requireFirmContext, checkPermission('employees', 'create'), createController);
 */
const requireFirmContext = asyncHandler(async (req, res, next) => {
    // Read methods are fine without a specific firm (consolidated view)
    if (req.method === 'GET') return next();

    // Resolve firmId from body first, then from query, then from user context (set by setUserContext middleware)
    const rawFirmId = req.body?.firmId || req.body?.firm_id || req.query?.firmId || req.query?.firm_id || req.user?.firmId;

    if (!rawFirmId || rawFirmId === 'all') {
        throw new ApiError({
            statusCode: 400,
            message: 'A specific firm must be selected before performing this operation. '
                   + 'Please select a firm from the header selector.'
        });
    }

    const resolvedFirmId = parseInt(rawFirmId, 10);
    if (isNaN(resolvedFirmId) || resolvedFirmId <= 0) {
        throw new ApiError({
            statusCode: 400,
            message: 'Invalid firm ID provided. Please select a valid firm.'
        });
    }

    // If user is not super admin, ensure they cannot specify a firm they don't have access to
    if (!req.user?.isSuperAdmin && req.user?.firmId && resolvedFirmId !== parseInt(req.user.firmId, 10)) {
        throw new ApiError({
            statusCode: 403,
            message: 'Access denied: You do not have permission to perform operations on this firm.'
        });
    }

    // Stamp the resolved firmId onto req for downstream controllers
    req.effectiveFirmId = resolvedFirmId;
    if (req.user) {
        req.user.firmId = resolvedFirmId;
    }
    const context = getContext();
    if (context) {
        context.firmId = resolvedFirmId;
    }

    next();
});


/**
 * Verifies that a record belongs to the user's active firm and branch.
 * Throws 403 if the record's firm_id doesn't match the user's authorized firm.
 * This prevents IDOR / BOLA attacks where a user fetches a record by ID
 * that belongs to a different firm.
 * 
 * Super admin without a firm filter (firmId = null) can operate on any record.
 * 
 * @param {object} currentUser - req.user from the authentication middleware
 * @param {object} record - The fetched DB record (must have firm_id column)
 * @param {string} entityName - Human-readable entity name for error messages (e.g. 'Employee', 'Shift')
 */
function verifyRecordOwnership(currentUser, record, entityName = 'Record') {
    if (!record || !currentUser) return;

    // Super admin without a specific firm filter can operate on any record
    if (currentUser.isSuperAdmin && !currentUser.firmId) return;

    const userFirmId = currentUser.firmId;
    const recordFirmId = record.firm_id;

    // Firm-level check
    if (userFirmId && recordFirmId && Number(userFirmId) !== Number(recordFirmId)) {
        throw new ApiError({
            statusCode: 403,
            message: `Access denied: This ${entityName} belongs to a different firm.`
        });
    }

    // Branch-level check (if applicable and user has branch scope)
    const dataScope = currentUser.dataScope || 'OWN';
    if (dataScope === 'BRANCH' && currentUser.branchId && record.firm_branch_id) {
        if (Number(currentUser.branchId) !== Number(record.firm_branch_id)) {
            throw new ApiError({
                statusCode: 403,
                message: `Access denied: This ${entityName} belongs to a different branch.`
            });
        }
    }
}

module.exports = {
    checkPermission,
    requireFirmContext,
    verifyRecordOwnership,
    canModifyRecord,
    applyDataScopeToQuery
};
