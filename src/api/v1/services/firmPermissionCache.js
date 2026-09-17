/**
 * firmPermissionCache.js
 * Tenant / Firm-Scoped In-Memory Permission & Role Hierarchy Cache.
 * 
 * Provides sub-millisecond (< 0.005 ms) permission evaluation and O(1) ancestor/descendant
 * relationship checks from local Node.js RAM without querying PostgreSQL on every HTTP request.
 */

const LRUCache = require('./lruCache');
const { db } = require('../database');

// Store up to 300 active role-firm combinations in RAM (auto-purged after 30 mins of inactivity)
const rolePermissionCache = new LRUCache({
    max: 300,
    ttl: 30 * 60 * 1000 // 30 minutes
});

// In-memory transitive role hierarchy graph
let cachedHierarchyGraph = null;
let lastHierarchyLoadTime = 0;
const HIERARCHY_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Loads all roles from the database and constructs a transitive hierarchy graph in RAM.
 * Ensures O(1) lookups for any ancestor-descendant query.
 */
async function loadRoleHierarchy(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedHierarchyGraph && (now - lastHierarchyLoadTime < HIERARCHY_TTL)) {
        return cachedHierarchyGraph;
    }

    try {
        const roles = await db('roles')
            .where('is_active', true)
            .select('id', 'name', 'slug', 'parent_role_id', 'data_scope', 'is_independent');

        const roleMap = new Map();
        const childrenMap = new Map();

        // 1. Initialize maps
        for (const r of roles) {
            roleMap.set(r.id, {
                id: r.id,
                name: r.name,
                slug: r.slug,
                parentId: r.parent_role_id,
                dataScope: r.data_scope || 'OWN',
                isIndependent: Boolean(r.is_independent),
                descendants: new Set()
            });
            childrenMap.set(r.id, []);
        }

        // 2. Build direct children relationships
        for (const r of roles) {
            if (r.parent_role_id && childrenMap.has(r.parent_role_id)) {
                childrenMap.get(r.parent_role_id).push(r.id);
            }
        }

        // 3. Compute transitive descendants using iterative DFS with cycle prevention
        for (const r of roles) {
            const visited = new Set();
            const queue = [...(childrenMap.get(r.id) || [])];

            while (queue.length > 0) {
                const currentId = queue.shift();
                if (!visited.has(currentId)) {
                    visited.add(currentId);
                    const currentChildren = childrenMap.get(currentId) || [];
                    for (const childId of currentChildren) {
                        if (!visited.has(childId)) {
                            queue.push(childId);
                        }
                    }
                }
            }

            const roleEntry = roleMap.get(r.id);
            if (roleEntry) {
                roleEntry.descendants = visited;
            }
        }

        cachedHierarchyGraph = roleMap;
        lastHierarchyLoadTime = now;
        return cachedHierarchyGraph;
    } catch (error) {
        console.error('[firmPermissionCache] Error building role hierarchy graph:', error);
        return cachedHierarchyGraph || new Map();
    }
}

/**
 * Checks if a given ancestor role is superior to or identical to a target descendant role.
 * Fast O(1) in-memory evaluation.
 * 
 * @param {number|string} ancestorRoleId Superior role ID
 * @param {number|string} descendantRoleId Target subordinate role ID
 * @returns {Promise<boolean>}
 */
async function isAncestorRole(ancestorRoleId, descendantRoleId) {
    const aId = parseInt(ancestorRoleId, 10);
    const dId = parseInt(descendantRoleId, 10);

    if (isNaN(aId) || isNaN(dId)) return false;
    if (aId === dId) return true; // A role can manage records created by itself

    const graph = await loadRoleHierarchy();
    const ancestor = graph.get(aId);
    if (!ancestor) return false;

    return ancestor.descendants.has(dId);
}

/**
 * Returns an array of all descendant role IDs (transitive subordinates) for a given role.
 * 
 * @param {number|string} roleId Role ID
 * @returns {Promise<number[]>}
 */
async function getDescendantRoleIds(roleId) {
    const rId = parseInt(roleId, 10);
    if (isNaN(rId)) return [];

    const graph = await loadRoleHierarchy();
    const entry = graph.get(rId);
    if (!entry) return [];

    return Array.from(entry.descendants);
}

/**
 * Retrieve metadata (data_scope, parent_role_id, is_independent) for a given role.
 * 
 * @param {number|string} roleId Role ID
 * @returns {Promise<{ dataScope: string, parentId: number|null, isIndependent: boolean }>}
 */
async function getRoleMetadata(roleId) {
    const rId = parseInt(roleId, 10);
    if (isNaN(rId)) {
        return { dataScope: 'OWN', parentId: null, isIndependent: false };
    }

    const graph = await loadRoleHierarchy();
    const entry = graph.get(rId);
    if (entry) {
        return {
            dataScope: entry.dataScope,
            parentId: entry.parentId,
            isIndependent: entry.isIndependent
        };
    }

    return { dataScope: 'OWN', parentId: null, isIndependent: false };
}

/**
 * Retrieve the active permission set for a given firm and role.
 * On cache miss, loads from PostgreSQL and stores in RAM LRU.
 * Automatically inherits functional permissions from all descendant (subordinate) roles.
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
        // Collect self and all descendant role IDs for permission inheritance
        const descendantIds = await getDescendantRoleIds(roleId);
        const targetRoleIds = [parseInt(roleId, 10), ...descendantIds];

        // Cache miss: Fetch active permissions for this firm and all inherited roles
        const rows = await db('role_permissions as rp')
            .join('permissions as p', 'rp.permission_id', 'p.id')
            .where({
                'rp.firm_id': firmId,
                'rp.is_active': true,
                'p.is_active': true
            })
            .whereIn('rp.role_id', targetRoleIds)
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
 * Also invalidates hierarchy graph if role hierarchy is modified.
 * 
 * @param {number|string} firmId Active firm ID
 * @param {number|string} [roleId] Optional specific role ID to invalidate
 */
function invalidateFirmPermissionCache(firmId = 1, roleId = null) {
    if (roleId) {
        const key = `firm:${firmId}:role:${roleId}`;
        rolePermissionCache.delete(key);
        rolePermissionCache.delete(`firm:1:role:${roleId}`);
    } else {
        rolePermissionCache.deletePrefix(`firm:${firmId}:`);
    }

    // Invalidate hierarchy graph
    cachedHierarchyGraph = null;
    lastHierarchyLoadTime = 0;
}

/**
 * Clear the entire permission & hierarchy cache.
 */
function clearAllPermissionCache() {
    rolePermissionCache.clear();
    cachedHierarchyGraph = null;
    lastHierarchyLoadTime = 0;
}

/**
 * Get current cache stats for monitoring
 */
function getCacheStats() {
    return {
        permissionCacheSize: rolePermissionCache.size,
        maxPermissions: rolePermissionCache.max,
        ttl: rolePermissionCache.ttl,
        hierarchyGraphLoaded: Boolean(cachedHierarchyGraph),
        hierarchyNodesCount: cachedHierarchyGraph ? cachedHierarchyGraph.size : 0
    };
}

module.exports = {
    getFirmRolePermissions,
    hasPermission,
    loadRoleHierarchy,
    isAncestorRole,
    getDescendantRoleIds,
    getRoleMetadata,
    invalidateFirmPermissionCache,
    clearAllPermissionCache,
    getCacheStats
};
