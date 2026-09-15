const { getFirmRolePermissions, hasPermission } = require('../services/firmPermissionCache');
const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require('../services/asyncHandler');
const { getContext } = require('../helpers/requestContext');

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
        if (userRoleSlug === 'super-admin' || roleId === 1) {
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

module.exports = { checkPermission };
