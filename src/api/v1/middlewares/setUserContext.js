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

    let userId = 0;
    let firmId = null;
    let branchId = null;
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

            // Cryptographic JWT token is the single source of truth for tenant context
            // Custom HTTP headers (x-firm-id, x-branch-id) are never accepted
            firmId = decoded?.firmId ? parseInt(decoded.firmId, 10) : null;
            branchId = decoded?.branchId ? parseInt(decoded.branchId, 10) : null;

            isSuperAdmin = Boolean(decoded?.isSuperAdmin) || (role || '').toLowerCase() === 'super-admin';

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
                } else if (!firmId) {
                    // Fallback to user's assigned default firm if firmId was not embedded
                    firmId = defaultFirmId;
                } else if (!allowedFirmIds.has(firmId)) {
                    // Firm in token is no longer assigned to user (revoked access)
                    tenantAccessDenied = true;
                    firmId = null;
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
