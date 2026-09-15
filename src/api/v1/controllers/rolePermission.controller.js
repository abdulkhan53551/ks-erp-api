const { db } = require('../database');
const { MODULES_REGISTRY } = require('../config/modules.registry');
const { syncPoliciesTable } = require('../services/permissionBootstrapper');
const { invalidateFirmPermissionCache } = require('../services/firmPermissionCache');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require('../services/asyncHandler');

const SYSTEM_ROLE_SLUGS = ['super-admin', 'administrator'];

/**
 * Get all roles with user counts and protection flags
 */
const getAllRoles = asyncHandler(async (req, res) => {
    // Roles with count of active users
    const roles = await db('roles as r')
        .leftJoin('users as u', function () {
            this.on('u.role_id', '=', 'r.id')
                .andOnNull('u.deleted_at');
        })
        .select(
            'r.id',
            'r.name',
            'r.slug',
            'r.description',
            'r.is_active'
        )
        .count('u.id as user_count')
        .groupBy('r.id')
        .orderBy('r.id', 'asc');

    const formattedRoles = roles.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        isActive: r.is_active,
        userCount: parseInt(r.user_count || 0),
        isSystem: SYSTEM_ROLE_SLUGS.includes(r.slug)
    }));

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
    // 1. Fetch all permissions from DB
    const allPermissions = await db('permissions')
        .where('is_active', true)
        .select('id', 'object', 'action', 'resource')
        .orderBy(['object', 'action']);

    // 2. Fetch all roles
    const roles = await db('roles as r')
        .leftJoin('users as u', function () {
            this.on('u.role_id', '=', 'r.id').andOnNull('u.deleted_at');
        })
        .select('r.id', 'r.name', 'r.slug', 'r.description')
        .count('u.id as user_count')
        .groupBy('r.id')
        .orderBy('r.id', 'asc');

    // 3. Fetch all active role_permissions
    const rolePermissions = await db('role_permissions')
        .where('is_active', true)
        .select('role_id', 'permission_id');

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
            modules: MODULES_REGISTRY,
            allPermissions,
            roles: roles.map(r => ({
                id: r.id,
                name: r.name,
                slug: r.slug,
                description: r.description,
                userCount: parseInt(r.user_count || 0),
                isSystem: SYSTEM_ROLE_SLUGS.includes(r.slug)
            })),
            rolePermissionsMap
        },
        message: 'Permission matrix fetched successfully'
    }));
});

/**
 * Update permissions assigned to a specific role
 */
const updateRolePermissions = asyncHandler(async (req, res) => {
    const roleId = parseInt(req.params.id);
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
        throw new ApiError({ statusCode: 400, message: 'permissionIds must be an array of IDs' });
    }

    const role = await db('roles').where({ id: roleId }).first();
    if (!role) {
        throw new ApiError({ statusCode: 404, message: 'Role not found' });
    }

    // Super Admin is system protected and retains universal access
    if (role.slug === 'super-admin') {
        throw new ApiError({
            statusCode: 400,
            message: 'Super Admin has universal system access and cannot be modified.'
        });
    }

    // Atomic transaction: replace role_permissions
    await db.transaction(async (trx) => {
        // Delete existing role permissions
        await trx('role_permissions').where({ role_id: roleId }).del();

        if (permissionIds.length > 0) {
            const rowsToInsert = permissionIds.map(permId => ({
                role_id: roleId,
                permission_id: permId,
                is_active: true,
                created_by: req.user?.id || null
            }));

            await trx.batchInsert('role_permissions', rowsToInsert, 100);
        }
    });

    // Invalidate in-memory tenant LRU cache immediately
    const firmId = req.user?.firmId || 1;
    invalidateFirmPermissionCache(firmId, roleId);

    // Re-sync policies into Casbin table and reload RAM cache
    await syncPoliciesTable();

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: {
            roleId,
            assignedCount: permissionIds.length
        },
        message: `Permissions updated successfully for ${role.name}`
    }));
});

/**
 * Create a new custom role
 */
const createCustomRole = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
        throw new ApiError({ statusCode: 400, message: 'Role name is required' });
    }

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check slug collision
    const existing = await db('roles').where({ slug }).first();
    if (existing) {
        throw new ApiError({ statusCode: 409, message: `A role with slug '${slug}' already exists.` });
    }

    const [newRole] = await db('roles')
        .insert({
            name: trimmedName,
            slug,
            description: description ? description.trim() : null,
            is_active: true,
            created_by: req.user?.id || null
        })
        .returning(['id', 'name', 'slug', 'description', 'is_active']);

    return res.status(201).json(new ApiResponse({
        statusCode: 201,
        data: {
            ...newRole,
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
    const roleId = parseInt(req.params.id);

    const role = await db('roles').where({ id: roleId }).first();
    if (!role) {
        throw new ApiError({ statusCode: 404, message: 'Role not found' });
    }

    if (SYSTEM_ROLE_SLUGS.includes(role.slug)) {
        throw new ApiError({ statusCode: 400, message: `Cannot delete system-protected role '${role.name}'.` });
    }

    // Check if any active users have this role
    const activeUsers = await db('users')
        .where({ role_id: roleId })
        .whereNull('deleted_at')
        .count('id as count')
        .first();

    const userCount = parseInt(activeUsers?.count || 0);
    if (userCount > 0) {
        throw new ApiError({
            statusCode: 400,
            message: `Cannot delete role '${role.name}' because ${userCount} active user(s) are assigned to it. Reassign these users first.`
        });
    }

    // Delete role (cascades to role_permissions)
    await db('roles').where({ id: roleId }).del();

    // Invalidate in-memory tenant LRU cache immediately
    const firmId = req.user?.firmId || 1;
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
    createCustomRole,
    deleteCustomRole
};
