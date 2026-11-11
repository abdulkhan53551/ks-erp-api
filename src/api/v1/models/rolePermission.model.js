const { db } = require('../database');

/**
 * Fetch the first active primary firm
 */
const fetchFirstActiveFirm = async () => {
    return db('firms').where({ is_active: true }).orderBy('id', 'asc').first();
};

/**
 * Safely resolves a numerical firm ID from raw query/body or user session context,
 * falling back to the default active firm if 'all' or an invalid value is passed.
 */
const resolveTargetFirmId = async (rawFirmId, userFirmId) => {
    if (rawFirmId && rawFirmId !== 'all') {
        const parsed = parseInt(rawFirmId, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (userFirmId && userFirmId !== 'all') {
        const parsed = parseInt(userFirmId, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    try {
        const firstFirm = await fetchFirstActiveFirm();
        return firstFirm?.id || 1;
    } catch (e) {
        return 1;
    }
};

/**
 * Fetch all roles with active assigned user counts, parent role names, and operational data scopes
 */
const fetchAllRolesWithDetails = async () => {
    const activeUserRolesSubquery = db('users as u')
        .whereNull('u.deleted_at')
        .where('u.is_active', true)
        .whereNotNull('u.role_id')
        .select('u.id as user_id', 'u.role_id')
        .union(function () {
            this.select('ufb.user_id', 'ufb.role_id')
                .from('user_firm_branches as ufb')
                .join('users as u2', 'ufb.user_id', 'u2.id')
                .whereNull('u2.deleted_at')
                .where('u2.is_active', true)
                .where('ufb.is_active', true);
        })
        .as('aur');

    return db('roles as r')
        .leftJoin(activeUserRolesSubquery, 'aur.role_id', 'r.id')
        .leftJoin('roles as pr', 'r.parent_role_id', 'pr.id')
        .select(
            'r.id',
            'r.name',
            'r.slug',
            'r.description',
            'r.parent_role_id',
            'pr.name as parent_role_name',
            'r.is_independent',
            'r.is_active'
        )
        .countDistinct('aur.user_id as user_count')
        .groupBy('r.id', 'pr.name')
        .orderBy('r.id', 'asc');
};

/**
 * Fetch all active system permissions ordered by object and action
 */
const fetchAllActivePermissions = async () => {
    return db('permissions')
        .where('is_active', true)
        .select('id', 'object', 'action', 'resource')
        .orderBy(['object', 'action']);
};

/**
 * Fetch active role permissions scoped to a target firm
 */
const fetchRolePermissionsByFirm = async (firmId) => {
    return db('role_permissions')
        .where({ firm_id: firmId, is_active: true })
        .select('role_id', 'permission_id');
};

/**
 * Fetch all active firm IDs (used when broadcasting permissions in 'all' firms mode)
 */
const fetchAllActiveFirmIds = async () => {
    const firms = await db('firms').where({ is_active: true }).select('id');
    return firms.map(f => f.id);
};

/**
 * Find a role record by primary ID
 */
const findRoleById = async (roleId) => {
    return db('roles').where({ id: roleId }).first();
};

/**
 * Find a role record by unique slug
 */
const findRoleBySlug = async (slug) => {
    return db('roles').where({ slug }).first();
};

/**
 * Fetch a single role with its joined parent role name and hierarchy metadata
 */
const fetchRoleWithParentById = async (roleId) => {
    return db('roles as r')
        .leftJoin('roles as pr', 'r.parent_role_id', 'pr.id')
        .where('r.id', roleId)
        .select(
            'r.id',
            'r.name',
            'r.slug',
            'r.description',
            'r.parent_role_id as parentRoleId',
            'pr.name as parentRoleName',
            'r.is_independent as isIndependent',
            'r.is_active as isActive'
        )
        .first();
};

/**
 * Execute an atomic transaction to update role metadata and sync permissions across target firms
 */
const saveRolePermissionsTransaction = async ({ roleId, roleUpdates = {}, permissionIds, targetFirmIds, userId }) => {
    return db.transaction(async (trx) => {
        if (roleUpdates && Object.keys(roleUpdates).length > 0) {
            const updatesToApply = {
                ...roleUpdates,
                updated_at: trx.fn.now(),
                updated_by: userId || null
            };
            await trx('roles').where({ id: roleId }).update(updatesToApply);
        }

        if (Array.isArray(permissionIds)) {
            for (const fId of targetFirmIds) {
                // Delete existing role permissions for this firm
                await trx('role_permissions')
                    .where({ role_id: roleId, firm_id: fId })
                    .del();

                if (permissionIds.length > 0) {
                    const rowsToInsert = permissionIds.map(permId => ({
                        firm_id: fId,
                        role_id: roleId,
                        permission_id: permId,
                        is_active: true,
                        created_by: userId || null
                    }));

                    await trx.batchInsert('role_permissions', rowsToInsert, 100);
                }
            }
        }
    });
};

/**
 * Update role details (name, description, hierarchy parent, data scope, compliance independence)
 */
const updateRoleDetailsRecord = async (roleId, updates, userId) => {
    if (updates && Object.keys(updates).length > 0) {
        const payload = {
            ...updates,
            updated_at: db.fn.now(),
            updated_by: userId || null
        };
        await db('roles').where({ id: roleId }).update(payload);
    }
};

/**
 * Insert a new custom role record
 */
const insertCustomRole = async ({ name, slug, description, parentRoleId, isIndependent, userId }) => {
    const [newRole] = await db('roles')
        .insert({
            name,
            slug,
            description: description ? description.trim() : null,
            parent_role_id: parentRoleId || null,
            is_independent: Boolean(isIndependent),
            is_active: true,
            created_by: userId || null
        })
        .returning(['id', 'name', 'slug', 'description', 'parent_role_id', 'is_independent', 'is_active']);
    return newRole;
};

/**
 * Count active assigned users for a given role (from both users and firm/branch assignments)
 */
const countActiveUsersByRoleId = async (roleId) => {
    const directUsers = db('users as u')
        .where({ 'u.role_id': roleId, 'u.is_active': true })
        .whereNull('u.deleted_at')
        .select('u.id as user_id');

    const mappedUsers = db('user_firm_branches as ufb')
        .join('users as u', 'ufb.user_id', 'u.id')
        .where({ 'ufb.role_id': roleId, 'ufb.is_active': true, 'u.is_active': true })
        .whereNull('u.deleted_at')
        .select('ufb.user_id as user_id');

    const combined = db.union([directUsers, mappedUsers]).as('all_users');
    const result = await db.from(combined).countDistinct('user_id as count').first();
    return parseInt(result?.count || 0, 10);
};

/**
 * Re-parent child roles and delete role record atomically
 */
const deleteRoleAndReparentChildren = async (roleId, parentRoleId) => {
    return db.transaction(async (trx) => {
        // Re-parent direct child roles to the deleted role's parent (prevents orphaned/broken graph)
        await trx('roles')
            .where({ parent_role_id: roleId })
            .update({ parent_role_id: parentRoleId || null });

        // Delete role (cascades to role_permissions)
        await trx('roles').where({ id: roleId }).del();
    });
};

module.exports = {
    fetchFirstActiveFirm,
    resolveTargetFirmId,
    fetchAllRolesWithDetails,
    fetchAllActivePermissions,
    fetchRolePermissionsByFirm,
    fetchAllActiveFirmIds,
    findRoleById,
    findRoleBySlug,
    fetchRoleWithParentById,
    saveRolePermissionsTransaction,
    updateRoleDetailsRecord,
    insertCustomRole,
    countActiveUsersByRoleId,
    deleteRoleAndReparentChildren
};
