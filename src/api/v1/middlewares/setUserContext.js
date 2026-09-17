// middleware/setUserContext.js
const jwt = require('jsonwebtoken');
const { runWithContext } = require('../helpers/requestContext');
const { JWT } = require('../../../config/config');
const { db } = require('../database');

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

            isSuperAdmin = (role || '').toLowerCase() === 'super-admin' || roleId === 1;

            if (isSuperAdmin) {
                effectiveRole = role || 'super-admin';
                effectiveRoleId = roleId || 1;
                dataScope = 'GLOBAL';
                parentRoleId = null;
                isIndependent = false;
                tenantAccessDenied = false;
            } else if (userId) {
                // Standard User:
                // If standard user didn't specify firmId or sent 'all', resolve their default assigned firm
                if (!firmId) {
                    if (decoded?.firmId) {
                        firmId = decoded.firmId;
                    } else {
                        try {
                            const firstAssignment = await db('user_firm_branches as ufb')
                                .where({ 'ufb.user_id': userId, 'ufb.is_active': true })
                                .orderBy('ufb.id', 'asc')
                                .first();
                            firmId = firstAssignment?.firm_id || 1;
                        } catch (e) {
                            firmId = 1;
                        }
                    }
                }

                // Standard User: Resolve effective role from user_firm_branches
                try {
                    const assignments = await db('user_firm_branches as ufb')
                        .join('roles as r', 'ufb.role_id', 'r.id')
                        .where({
                            'ufb.user_id': userId,
                            'ufb.firm_id': firmId,
                            'ufb.is_active': true
                        })
                        .select(
                            'ufb.role_id',
                            'r.slug as role_slug',
                            'r.name as role_name',
                            'r.parent_role_id',
                            'r.data_scope',
                            'r.is_independent',
                            'ufb.firm_branch_id'
                        );

                    if (!assignments || assignments.length === 0) {
                        tenantAccessDenied = true;
                    } else {
                        let match = null;
                        if (branchId) {
                            match = assignments.find(a => a.firm_branch_id === branchId) ||
                                    assignments.find(a => a.firm_branch_id === null);
                        } else {
                            match = assignments.find(a => a.firm_branch_id === null) || assignments[0];
                        }

                        if (match) {
                            effectiveRoleId = match.role_id;
                            effectiveRole = match.role_slug || role;
                            dataScope = match.data_scope || 'OWN';
                            parentRoleId = match.parent_role_id || null;
                            isIndependent = Boolean(match.is_independent);
                        } else {
                            tenantAccessDenied = true;
                        }
                    }
                } catch (dbErr) {
                    console.error('[setUserContext] Error resolving firm branch role:', dbErr);
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
