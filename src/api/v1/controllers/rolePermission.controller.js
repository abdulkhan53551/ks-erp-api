const { MODULES_REGISTRY } = require('../config/modules.registry');
const { syncPoliciesTable } = require('../services/permissionBootstrapper');
const { invalidateFirmPermissionCache, isAncestorRole, getUserAllowedFirms } = require('../services/firmPermissionCache');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require('../services/asyncHandler');
const {
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
} = require('../models/rolePermission.model');

const SYSTEM_ROLE_SLUGS = ['super-admin', 'administrator'];

/**
 * Get all roles with user counts, hierarchy parents, and data scopes
 */
const getAllRoles = asyncHandler(async (req, res) => {
    const roles = await fetchAllRolesWithDetails();
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

    let formattedRoles = roles.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        parentRoleId: r.parent_role_id,
        parentRoleName: r.parent_role_name || null,
        isIndependent: Boolean(r.is_independent),
        isActive: r.is_active,
        userCount: parseInt(r.user_count || 0, 10),
        isSystem: SYSTEM_ROLE_SLUGS.includes(r.slug)
    }));

    if (!isSuperAdmin) {
        formattedRoles = formattedRoles.filter(r => (r.slug || '').toLowerCase() !== 'super-admin');
    }

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: formattedRoles,
        message: 'Roles fetched successfully'
    }));
});

/**
 * Get full permission matrix including module registry, all permissions, and role mapping
 */
const getPermissionMatrix = asyncHandler(async (req, res) => {
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin);
    let targetFirmId;

    if (isSuperAdmin) {
        targetFirmId = await resolveTargetFirmId(req.query.firmId, req.user?.firmId);
    } else {
        const { allowedFirmIds } = await getUserAllowedFirms(req.user?.id);
        const requestedFirmId = req.query.firmId && req.query.firmId !== 'all' ? parseInt(req.query.firmId, 10) : null;

        if (requestedFirmId && allowedFirmIds.has(requestedFirmId)) {
            targetFirmId = requestedFirmId;
        } else if (req.user?.firmId && allowedFirmIds.has(req.user.firmId)) {
            targetFirmId = req.user.firmId;
        } else if (allowedFirmIds.size > 0) {
            targetFirmId = Array.from(allowedFirmIds)[0];
        } else {
            throw new ApiError({ statusCode: 403, message: 'You do not have access to manage permissions for any firm.' });
        }
    }

    // 1. Fetch all permissions from model
    const allPermissions = await fetchAllActivePermissions();

    // 2. Fetch all roles with parent & scope details from model
    let roles = await fetchAllRolesWithDetails();
    if (!isSuperAdmin) {
        roles = roles.filter(r => (r.slug || '').toLowerCase() !== 'super-admin');
    }

    // 3. Fetch all active role_permissions scoped to targetFirmId from model
    const rolePermissions = await fetchRolePermissionsByFirm(targetFirmId);

    // Group permission IDs by role_id
    const rolePermissionsMap = {};
    roles.forEach(r => {
        rolePermissionsMap[r.id] = [];
    });

    rolePermissions.forEach(rp => {
        if (rolePermissionsMap[rp.role_id]) {
            rolePermissionsMap[rp.role_id].push(rp.permission_id);
        }
    });

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: {
            firmId: targetFirmId,
            modules: MODULES_REGISTRY,
            allPermissions,
            roles: roles.map(r => ({
                id: r.id,
                name: r.name,
                slug: r.slug,
                description: r.description,
                parentRoleId: r.parent_role_id,
                parentRoleName: r.parent_role_name || null,
                isIndependent: Boolean(r.is_independent),
                userCount: parseInt(r.user_count || 0, 10),
                isSystem: SYSTEM_ROLE_SLUGS.includes(r.slug)
            })),
            rolePermissionsMap
        },
        message: 'Permission matrix fetched successfully'
    }));
});

/**
 * Update permissions assigned to a specific role across one or multiple firms
 */
const updateRolePermissions = asyncHandler(async (req, res) => {
    const roleId = parseInt(req.params.id, 10);
    const { permissionIds, firmId: bodyFirmId, firmIds: bodyFirmIds, parentRoleId, isIndependent } = req.body;
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

    const role = await findRoleById(roleId);
    if (!role) {
        throw new ApiError({ statusCode: 404, message: 'Role not found' });
    }

    // Super Admin is system protected and retains universal access
    if ((role.slug || '').toLowerCase() === 'super-admin') {
        throw new ApiError({
            statusCode: 400,
            message: 'Super Admin has universal system access and cannot be modified.'
        });
    }

    let targetFirmIds = [];
    if (isSuperAdmin) {
        if (Array.isArray(bodyFirmIds) && bodyFirmIds.length > 0) {
            targetFirmIds = bodyFirmIds
                .map(id => parseInt(id, 10))
                .filter(id => !isNaN(id) && id > 0);
        } else if (bodyFirmId === 'all') {
            targetFirmIds = await fetchAllActiveFirmIds();
        } else {
            const singleFirmId = await resolveTargetFirmId(bodyFirmId, req.user?.firmId);
            targetFirmIds = [singleFirmId];
        }
    } else {
        const { allowedFirmIds } = await getUserAllowedFirms(req.user?.id);
        if (!allowedFirmIds || allowedFirmIds.size === 0) {
            throw new ApiError({ statusCode: 403, message: 'You do not have access to manage permissions for any firm.' });
        }

        if (Array.isArray(bodyFirmIds) && bodyFirmIds.length > 0) {
            targetFirmIds = bodyFirmIds
                .map(id => parseInt(id, 10))
                .filter(id => !isNaN(id) && allowedFirmIds.has(id));
        } else if (bodyFirmId === 'all') {
            targetFirmIds = Array.from(allowedFirmIds);
        } else {
            const parsed = parseInt(bodyFirmId || req.user?.firmId, 10);
            if (parsed && allowedFirmIds.has(parsed)) {
                targetFirmIds = [parsed];
            } else if (req.user?.firmId && allowedFirmIds.has(req.user.firmId)) {
                targetFirmIds = [req.user.firmId];
            }
        }

        if (targetFirmIds.length === 0) {
            throw new ApiError({ statusCode: 403, message: 'Access denied: You cannot update permissions for firms you do not administer.' });
        }
    }

    // If hierarchy or independence fields were provided in the same payload, update role metadata
    const roleUpdates = {};

    if (isIndependent !== undefined) {
        roleUpdates.is_independent = Boolean(isIndependent);
    }

    if (parentRoleId !== undefined) {
        const pId = parentRoleId ? parseInt(parentRoleId, 10) : null;
        if (pId === roleId) {
            throw new ApiError({ statusCode: 400, message: 'A role cannot be its own parent.' });
        }
        if (pId) {
            const parentRole = await findRoleById(pId);
            if (!parentRole) {
                throw new ApiError({ statusCode: 404, message: 'Parent role not found.' });
            }
            // Cycle check
            const isCycle = await isAncestorRole(roleId, pId);
            if (isCycle) {
                throw new ApiError({
                    statusCode: 400,
                    message: `Circular hierarchy detected: cannot set '${parentRole.name}' as parent because it is already a subordinate of '${role.name}'.`
                });
            }
        }
        roleUpdates.parent_role_id = pId;
    }

    // Atomic transaction executed in model
    await saveRolePermissionsTransaction({
        roleId,
        roleUpdates,
        permissionIds,
        targetFirmIds,
        userId: req.user?.id
    });

    // Invalidate in-memory tenant LRU and hierarchy cache for all updated firms
    for (const fId of targetFirmIds) {
        invalidateFirmPermissionCache(fId, roleId);
    }

    // Re-sync policies into Casbin table and reload RAM cache
    await syncPoliciesTable();

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: {
            roleId,
            firmIds: targetFirmIds,
            assignedCount: Array.isArray(permissionIds) ? permissionIds.length : undefined
        },
        message: `Permissions updated successfully for ${role.name} across ${targetFirmIds.length} firm(s)`
    }));
});

/**
 * Update role details (name, description, parentRoleId, dataScope, isIndependent)
 */
const updateRoleDetails = asyncHandler(async (req, res) => {
    const roleId = parseInt(req.params.id, 10);
    const { name, description, parentRoleId, isIndependent } = req.body;

    const role = await findRoleById(roleId);
    if (!role) {
        throw new ApiError({ statusCode: 404, message: 'Role not found' });
    }

    const isSuperAdmin = Boolean(req.user?.isSuperAdmin);
    if (SYSTEM_ROLE_SLUGS.includes(role.slug) && !isSuperAdmin) {
        throw new ApiError({ statusCode: 403, message: `System role '${role.name}' can only be modified by a Super Administrator.` });
    }

    const updates = {};
    if (name !== undefined) {
        const trimmed = name.trim();
        if (!trimmed) throw new ApiError({ statusCode: 400, message: 'Role name cannot be empty' });
        updates.name = trimmed;
    }

    if (description !== undefined) {
        updates.description = description ? description.trim() : null;
    }

    // System role protection
    if ((role.slug || '').toLowerCase() === 'super-admin') {
        updates.parent_role_id = null;
        updates.is_independent = false;
    } else {

        if (isIndependent !== undefined) {
            updates.is_independent = Boolean(isIndependent);
        }

        if (parentRoleId !== undefined) {
            const pId = parentRoleId ? parseInt(parentRoleId, 10) : null;
            if (pId === roleId) {
                throw new ApiError({ statusCode: 400, message: 'A role cannot be its own parent.' });
            }
            if (pId) {
                const parentRole = await findRoleById(pId);
                if (!parentRole) {
                    throw new ApiError({ statusCode: 404, message: 'Parent role not found.' });
                }
                // Cycle check
                const isCycle = await isAncestorRole(roleId, pId);
                if (isCycle) {
                    throw new ApiError({
                        statusCode: 400,
                        message: `Circular hierarchy detected: cannot set '${parentRole.name}' as parent because it is already a subordinate of '${role.name}'.`
                    });
                }
            }
            updates.parent_role_id = pId;
        }
    }

    await updateRoleDetailsRecord(roleId, updates, req.user?.id);

    invalidateFirmPermissionCache(req.user?.firmId || null, roleId);

    const updatedRole = await fetchRoleWithParentById(roleId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: updatedRole,
        message: 'Role details updated successfully'
    }));
});

/**
 * Create a new custom role with hierarchy and scope
 */
const createCustomRole = asyncHandler(async (req, res) => {
    const { name, description, parentRoleId, isIndependent } = req.body;

    if (!name || !name.trim()) {
        throw new ApiError({ statusCode: 400, message: 'Role name is required' });
    }

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check slug collision
    const existing = await findRoleBySlug(slug);
    if (existing) {
        throw new ApiError({ statusCode: 409, message: `A role with slug '${slug}' already exists.` });
    }

    // Validate parent role if provided
    let pId = parentRoleId ? parseInt(parentRoleId, 10) : null;
    let parentRoleName = null;
    if (pId) {
        const parentRole = await findRoleById(pId);
        if (!parentRole) {
            throw new ApiError({ statusCode: 404, message: 'Specified parent role not found.' });
        }
        parentRoleName = parentRole.name;
    }

    const newRole = await insertCustomRole({
        name: trimmedName,
        slug,
        description,
        parentRoleId: pId,
        isIndependent,
        userId: req.user?.id
    });

    // Invalidate hierarchy cache
    invalidateFirmPermissionCache(req.user?.firmId || null);

    return res.status(201).json(new ApiResponse({
        statusCode: 201,
        data: {
            id: newRole.id,
            name: newRole.name,
            slug: newRole.slug,
            description: newRole.description,
            parentRoleId: newRole.parent_role_id,
            parentRoleName,
            isIndependent: Boolean(newRole.is_independent),
            isActive: newRole.is_active,
            userCount: 0,
            isSystem: false
        },
        message: 'Role created successfully'
    }));
});

/**
 * Delete a custom role (blocks system roles & roles with active users)
 */
const deleteCustomRole = asyncHandler(async (req, res) => {
    const roleId = parseInt(req.params.id, 10);

    const role = await findRoleById(roleId);
    if (!role) {
        throw new ApiError({ statusCode: 404, message: 'Role not found' });
    }

    if (SYSTEM_ROLE_SLUGS.includes(role.slug)) {
        throw new ApiError({ statusCode: 400, message: `Cannot delete system-protected role '${role.name}'.` });
    }

    // Check if any active users have this role
    const userCount = await countActiveUsersByRoleId(roleId);
    if (userCount > 0) {
        throw new ApiError({
            statusCode: 400,
            message: `Cannot delete role '${role.name}' because ${userCount} active user(s) are assigned to it. Reassign these users first.`
        });
    }

    // Re-parent direct child roles and delete role atomically via model
    await deleteRoleAndReparentChildren(roleId, role.parent_role_id);

    // Invalidate in-memory tenant LRU cache immediately
    const firmId = await resolveTargetFirmId(null, req.user?.firmId);
    invalidateFirmPermissionCache(firmId, roleId);

    // Re-sync policies in Casbin
    await syncPoliciesTable();

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: null,
        message: `Role '${role.name}' deleted successfully`
    }));
});

module.exports = {
    getAllRoles,
    getPermissionMatrix,
    updateRolePermissions,
    updateRoleDetails,
    createCustomRole,
    deleteCustomRole
};
