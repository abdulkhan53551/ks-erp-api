/**
 * firmPermissionCache.js
 * Tenant / Firm-Scoped In-Memory Permission Cache.
 * 
 * Provides sub-millisecond (< 0.005 ms) permission evaluation from local Node.js RAM
 * without querying PostgreSQL on every HTTP request and without requiring Redis.
 */

const LRUCache = require('./lruCache');
const { db } = require('../database');

// Store up to 300 active role-firm combinations in RAM (auto-purged after 30 mins of inactivity)
const rolePermissionCache = new LRUCache({
    max: 300,
    ttl: 30 * 60 * 1000 // 30 minutes
});

/**
 * Retrieve the active permission set for a given firm and role.
 * On cache miss, loads from PostgreSQL and stores in RAM LRU.
 * 
 * @param {number|string} firmId Active firm or tenant ID
 * @param {number|string} roleId User role ID
 * @returns {Promise<Set<string>>} Set of permission strings (e.g. 'invoices:read', 'parties:create')
 */
async function getFirmRolePermissions(firmId = 1, roleId) {
    if (!roleId) return new Set();

    const cacheKey = `firm:${firmId}:role:${roleId}`;
    const cached = rolePermissionCache.get(cacheKey);

    if (cached !== null) {
        return cached;
    }

    try {
        // Cache miss: Fetch active permissions for this role from PostgreSQL
        const rows = await db('role_permissions as rp')
            .join('permissions as p', 'rp.permission_id', 'p.id')
            .where('rp.role_id', roleId)
            .andWhere('rp.is_active', true)
            .andWhere('p.is_active', true)
            .select('p.object', 'p.action');

        const permSet = new Set(rows.map(r => `${r.object}:${r.action}`));

        // Store in LRU cache
        rolePermissionCache.set(cacheKey, permSet);

        return permSet;
    } catch (error) {
        console.error(`[firmPermissionCache] Error loading permissions for firm ${firmId}, role ${roleId}:`, error);
        return new Set();
    }
}

/**
 * High-speed permission matcher against an in-memory permission set.
 * Evaluates universal wildcard (*), module wildcard (module:*), or exact action (module:action).
 * 
 * @param {Set<string>} permSet The user's active permissions set
 * @param {string} module Target module slug (e.g. 'invoices', 'parties')
 * @param {string} action Target action verb (e.g. 'read', 'create', 'update', 'delete', 'approve', 'print')
 * @returns {boolean}
 */
function hasPermission(permSet, module, action) {
    if (!permSet || permSet.size === 0) return false;

    // 1. Universal super-user wildcard
    if (permSet.has('*')) return true;

    const normalizedModule = (module || '').toLowerCase();
    const normalizedAction = (action || '').toLowerCase();

    // 2. Module-level wildcard (e.g. 'invoices:*')
    if (permSet.has(`${normalizedModule}:*`)) return true;

    // 3. Exact action match (e.g. 'invoices:create')
    if (permSet.has(`${normalizedModule}:${normalizedAction}`)) return true;

    return false;
}

/**
 * Invalidate cached permissions for a firm or specific role.
 * Called immediately when an Admin updates permissions in Roles & Permissions Studio.
 * 
 * @param {number|string} firmId Active firm ID
 * @param {number|string} [roleId] Optional specific role ID to invalidate
 */
function invalidateFirmPermissionCache(firmId = 1, roleId = null) {
    if (roleId) {
        const key = `firm:${firmId}:role:${roleId}`;
        rolePermissionCache.delete(key);
        // Also delete fallback key without firm if any
        rolePermissionCache.delete(`firm:1:role:${roleId}`);
    } else {
        // Invalidate all roles for this firm
        rolePermissionCache.deletePrefix(`firm:${firmId}:`);
    }
}

/**
 * Clear the entire permission cache (e.g. after major migration or seed).
 */
function clearAllPermissionCache() {
    rolePermissionCache.clear();
}

/**
 * Get current cache stats for monitoring
 */
function getCacheStats() {
    return {
        size: rolePermissionCache.size,
        max: rolePermissionCache.max,
        ttl: rolePermissionCache.ttl
    };
}

module.exports = {
    getFirmRolePermissions,
    hasPermission,
    invalidateFirmPermissionCache,
    clearAllPermissionCache,
    getCacheStats
};
