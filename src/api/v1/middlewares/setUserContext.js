const jwt = require('jsonwebtoken');
const { runWithContext } = require('../helpers/requestContext');
const { JWT } = require('../../../config/config');
const { db } = require('../database');
const firmPermissionCache = require('../services/firmPermissionCache');

module.exports = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.replace(/^Bearer\s+/i, '');
    } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }

    let rawFirmHeader = req.headers['x-firm-id'];
    let requestedFirmId = null;
    if (rawFirmHeader && rawFirmHeader !== 'all') {
        const parsed = parseInt(rawFirmHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
            requestedFirmId = parsed;
        }
    }

    let branchId = null;
    if (req.headers['x-branch-id'] && req.headers['x-branch-id'] !== 'all') {
        const parsed = parseInt(req.headers['x-branch-id'], 10);
        if (!isNaN(parsed) && parsed > 0) {
            branchId = parsed;
        }
    }

    let userId = 0;
    let firmId = requestedFirmId;
    let role = null;
    let roleId = null;
    let effectiveRole = null;
    let effectiveRoleId = null;
    let isSuperAdmin = false;
    let tenantAccessDenied = false;
    let dataScope = 'OWN';
    let parentRoleId = null;
    let isIndependent = false;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET);
            userId = decoded?.id || 0;
            role = decoded?.role || null;
            roleId = decoded?.roleId || null;

            isSuperAdmin = (role || '').toLowerCase() === 'super-admin';

            if (isSuperAdmin) {
                effectiveRole = 'super-admin';
                effectiveRoleId = roleId;
                dataScope = 'GLOBAL';
                parentRoleId = null;
                isIndependent = false;
                tenantAccessDenied = false;
            } else if (userId) {
                // Standard User:
                // Validate tenant access via in-memory LRU cache (< 0.005 ms)
                const { allowedFirmIds, assignments, defaultFirmId } = await firmPermissionCache.getUserAllowedFirms(userId);

                if (!allowedFirmIds || allowedFirmIds.size === 0) {
                    // User is not assigned to any active firm
                    tenantAccessDenied = true;
                    firmId = null;
                } else if (!requestedFirmId) {
                    // No firm specified by client: default strictly to user's primary assigned firm from DB
                    firmId = defaultFirmId;
                } else if (!allowedFirmIds.has(requestedFirmId)) {
                    // Client requested a firm that this user is not assigned to
                    tenantAccessDenied = true;
                    firmId = null;
                } else {
                    // Client requested a valid assigned firm
                    firmId = requestedFirmId;
                }

                if (firmId && !tenantAccessDenied) {
                    // Find assignments for this specific active firm
                    const firmAssignments = (assignments || []).filter(a => a.firm_id === firmId);

                    let match = null;
                    if (branchId) {
                        match = firmAssignments.find(a => a.firm_branch_id === branchId) ||
                                firmAssignments.find(a => a.firm_branch_id === null);
                    } else {
                        match = firmAssignments.find(a => a.firm_branch_id === null) || firmAssignments[0];
                    }

                    if (match) {
                        effectiveRoleId = match.role_id;
                        effectiveRole = match.role_slug || role;
                        dataScope = match.data_scope || (match.firm_branch_id ? 'BRANCH' : 'FIRM');
                        parentRoleId = match.parent_role_id || null;
                        isIndependent = Boolean(match.is_independent);
                    } else {
                        tenantAccessDenied = true;
                    }
                }
            }

            req.tenantAccessDenied = tenantAccessDenied;
            if (userId) {
                req.user = {
                    id: userId,
                    email: decoded?.email,
                    userName: decoded?.userName,
                    fullName: decoded?.fullName,
                    role: effectiveRole || role,
                    roleId: effectiveRoleId || roleId,
                    firmId,
                    branchId,
                    isSuperAdmin,
                    dataScope,
                    parentRoleId,
                    isIndependent,
                    tenantAccessDenied
                };
            }
        } catch (err) {
            // Expired or invalid token: let verifyAccessToken handle 401
        }
    }

    const contextData = {
        userId,
        firmId,
        branchId,
        role: effectiveRole || role,
        roleId: effectiveRoleId || roleId,
        isSuperAdmin,
        dataScope,
        parentRoleId,
        isIndependent
    };

    runWithContext(contextData, () => next());
};
