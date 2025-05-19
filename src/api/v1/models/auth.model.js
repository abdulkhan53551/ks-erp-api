const { db } = require("../database");
const { logQuery } = require("../helpers/logQuery");
const { ApiError } = require("../services/ApiError");
const { getEnforcer } = require("../services/casbin");

/**
 * Inserts a new user into the database.
 */
async function createUser(data) {
    const query = db('users')
        .insert(data)
        .returning(['id', 'first_name', 'last_name', 'email', 'user_name']);

    const [user] = await query

    return user;
}

// Deletes a refresh token from the database based on user ID and hashed token.
async function deleteRefreshTokenByUserIDAndToken(userId, hashedToken) {
    const deletedCount = await db('refresh_tokens')
        .where({ user_id: userId, token_hash: hashedToken })
        .delete();

    const wasDeleted = deletedCount > 0;
    return wasDeleted;
}

// Deletes all refresh tokens associated with a user ID.
async function deleteRefreshTokenByUserID(userId) {
    const deletedCount = await db('refresh_tokens')
        .where({ user_id: userId })
        .delete();

    const wasDeleted = deletedCount > 0;
    return wasDeleted;
}


// ========== USERS ==========
// const createUser = async (username) => {
//     const [id] = await db('users').insert({ username }).returning('id');
//     return id;
// }

// ========== ROLES ==========
const createRole = async (data) => {
    const [id] = await db('roles').insert(data).returning('id');
    return id;
}

// ========== PERMISSIONS ==========
const createPermission = async (object, action) => {
    const [id] = await db('permissions').insert({ object, action }).returning('id');
    return id;
}

// ========== RELATIONSHIPS ==========
const assignUserRole = async (userId, roleId) => {
    const [id] = await db('user_roles').insert({ user_id: userId, role_id: roleId }).onConflict(['user_id', 'role_id']).ignore();
    return id;
}

const assignRolePermission = async (roleId, permissionId) => {
    const [id] = await db('role_permissions').insert({ role_id: roleId, permission_id: permissionId }).onConflict(['role_id', 'permission_id']).ignore();
    return id;
}

// Remove role permission
const removeAssignedRolePermissionById = async (id) => {
    const result = await db('role_permissions')
        .where({ id: id })
        .update({ is_active: false });

    return result > 0;
}

const getRolePermissionById = async (id) => {
    const rolePermission = await db('role_permissions as rp')
        .join('roles as r', 'rp.role_id', 'r.id')
        .join('permissions as p', 'rp.permission_id', 'p.id')
        .where('rp.is_active', true)
        .where({ 'rp.is_active': true, 'rp.id': id })
        .select('r.name as role', 'p.object', 'p.action');

    return rolePermission?.[0] || null;
}

// Get resource permission by id
const getResourcePermissionById = async (id) => {
    const resourcePermission = await db('permissions')
        .where({ 'is_active': true, 'id': id })
        .select('id as resourcePermissionId', 'object as url', 'resource', 'action');

    return resourcePermission?.[0] || null;
}

// Get ABAC policy by ID
const getAbacPolicyById = async (id) => {
    const abacPolicies = await db('casbin_abac_policy')
        .where({ 'is_active': true, 'id': id })
        .select('id', 'sub_rule', 'obj_rule', 'act');

    return abacPolicies?.[0] || null;
}

// ========== POLICY SYNC ==========
//   const syncCasbinPolicies = () => {
//     const enforcer = getEnforcer();
//     await enforcer.clearPolicy();

//     const rolePerms = await knex('role_permissions as rp')
//       .join('roles as r', 'rp.role_id', 'r.id')
//       .join('permissions as p', 'rp.permission_id', 'p.id')
//       .select('r.name as role', 'p.object', 'p.action');

//     for (const { role, object, action } of rolePerms) {
//       await enforcer.addPolicy(role, object, action);
//     }

//     const userRoles = await knex('user_roles as ur')
//       .join('users as u', 'ur.user_id', 'u.id')
//       .join('roles as r', 'ur.role_id', 'r.id')
//       .select('u.username', 'r.name as role');

//     for (const { username, role } of userRoles) {
//       await enforcer.addGroupingPolicy(username, role);
//     }

//     await enforcer.savePolicy();
//     console.log('✅ Casbin policies synced from DB');
//   },

// ========== UTILITY ==========
//   const getUserPermissions(userId) {
//     const roles = await knex('user_roles')
//       .where('user_id', userId)
//       .pluck('role_id');

//     const perms = await knex('role_permissions')
//       .whereIn('role_id', roles)
//       .join('permissions', 'permissions.id', 'role_permissions.permission_id')
//       .select('object', 'action');

//     return perms;
//   }

// Add a new policy
const addPolicyToCasbinRule = async (sub, obj, act, cond) => {
    const enforcer = await getEnforcer();
    const policy = [sub, obj, act, cond];
    const exists = await enforcer.hasPolicy(...policy);

    // Check policy existence
    if (exists) {
        throw new ApiError({ statusCode: 409, message: 'Policy already exist' })
    }

    // Add policy if it doesn't exist
    if (!exists) {
        const added = await enforcer.addPolicy(...policy);
        return added;
    }

    return false;
}

// Remove a policy
const removePolicyFromCasbinRule = async (sub, obj, act, cond) => {
    const enforcer = await getEnforcer();
    const removed = await enforcer.removePolicy(sub, obj, act, cond);
    // if (removed) {
    //     await enforcer.savePolicy();
    //     await enforcer.getWatcher().update(); // Notify others
    // }
    return removed;
}

// Add a user to a role (grouping policy)
const addUserToRole = async (user, role) => {
    const enforcer = getEnforcer();
    const added = await enforcer.addGroupingPolicy(user, role);
    // if (added) {
    //     await enforcer.savePolicy();
    //     await enforcer.getWatcher().update(); // Notify others
    // }
    return added;
}

// Remove a user from a role
const removeUserFromRole = async (user, role) => {
    const enforcer = getEnforcer();
    const removed = await enforcer.removeGroupingPolicy(user, role);
    if (removed) {
        await enforcer.savePolicy();
        await enforcer.getWatcher().update(); // Notify others
    }
    return removed;
}

// Sync Casbin Policies
// const syncCasbinPolicies = async () => {
//     try {
//         const enforcer = getEnforcer();

//         // Clear existing policies
//         await enforcer.clearPolicy();

//         const rolePerms = await db('role_permissions as rp')
//             .join('roles as r', 'rp.role_id', 'r.id')
//             .join('permissions as p', 'rp.permission_id', 'p.id')
//             .where('rp.is_active', true)
//             .select('r.name as role', 'p.object', 'p.action');

//         console.log('rolePerms', rolePerms);


//         for (const { role, object, action } of rolePerms) {
//             await enforcer.addPolicy(role, object, action);
//         }

//         const userRoles = await db('user_roles as ur')
//             .join('users as u', 'ur.user_id', 'u.id')
//             .join('roles as r', 'ur.role_id', 'r.id')
//             .where('ur.is_active', true)
//             .select('u.user_name as username', 'r.name as role');

//             console.log('userRoles', userRoles);


//         for (const { username, role } of userRoles) {
//             await enforcer.addGroupingPolicy(username, role);
//         }

//         // console.log('enforcer: ', enforcer);


//         // await enforcer.savePolicy();    // Save to DB
//         // await enforcer.getWatcher().update(); // Notify other services via Redis
//         console.log('✅ Policies synced and Redis notified');
//     } catch (error) {
//         console.error('❌ Error syncing policies:', error);
//         throw new ApiError({ statusCode: 500, message: 'Failed to sync policies' });
//         throw error;

//     }
// }

const createAbacPolicy = async (sub_rule, obj, act, condition) => {

    const action = act.toLowerCase();

    // Add policy to casbin_abac_policy table
    const query = db('casbin_abac_policy').insert({
        sub_rule,
        obj,
        act: action,
        conditions: condition || {}
    }).returning('id');

    const [{ id }] = await query

    return id;
}

// Sync ABAC policies from role-permission mappings
const addABACPolicy = async () => {
    try {
        const enforcer = getEnforcer();
        await enforcer.clearPolicy();

        const rolePerms = await db('role_permissions as rp')
            .join('roles as r', 'rp.role_id', 'r.id')
            .join('permissions as p', 'rp.permission_id', 'p.id')
            .where('rp.is_active', true)
            .select('r.name as role', 'p.object', 'p.action');

        for (const { role, object, action } of rolePerms) {
            const sub_rule = `r.sub.role == '${role}'`;
            const obj_rule = `r.obj.type == '${object}'`;

            // Add policy to casbin_abac_policy table
            await db('casbin_abac_policy').insert({
                ptype: 'p',
                sub_rule,
                obj_rule,
                act: action.toLowerCase()
            });
        }
    } catch (error) {
        throw new ApiError({ statusCode: 500, message: 'Failed to sync ABAC policies' });
    }
};

const syncCasbinPolicies = async () => {
    try {
        const enforcer = await getEnforcer();

        // Clear existing policies
        await enforcer.clearPolicy();

        // Step 1: Load role-permission mappings
        const rolePerms = await db('role_permissions as rp')
            .join('roles as r', 'rp.role_id', 'r.id')
            .join('permissions as p', 'rp.permission_id', 'p.id')
            .where('rp.is_active', true)
            .select('r.name as role', 'p.object', 'p.action');

        // Step 2: Add policies to Casbin table
        for (const { role, object, action } of rolePerms) {
            await createAbacPolicy(role, object, action);
        }

        // Step 3: Load ABAC policies with sub_rule, obj_rule, and act
        const abacPolicies = await db('casbin_abac_policy')
            .where('is_active', true)
            .select('sub_rule', 'obj_rule', 'act');

        // Step 4: Add poicies to memory
        for (const { sub_rule, obj_rule, act } of abacPolicies) {
            await enforcer.addPolicy(sub_rule, obj_rule, act);
        }

        // Optional: Notify other instances via Redis watcher if you're using it
        // await enforcer.getWatcher().update();

        console.log('✅ ABAC Policies synced');
    } catch (error) {
        console.error('❌ Error syncing ABAC policies:', error);
        throw new ApiError({ statusCode: 500, message: 'Failed to sync ABAC policies' });
    }
};

module.exports = {
    createUser,
    deleteRefreshTokenByUserIDAndToken,
    deleteRefreshTokenByUserID,
    createRole,
    createPermission,
    assignUserRole,
    assignRolePermission,
    removeAssignedRolePermissionById,
    syncCasbinPolicies,
    addPolicyToCasbinRule,
    removePolicyFromCasbinRule,
    addUserToRole,
    removeUserFromRole,
    createAbacPolicy,
    getRolePermissionById,
    getAbacPolicyById,
    getResourcePermissionById
};
