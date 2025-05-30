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

// Get all abac policy by ID
const getAllAbacPolicy = async () => {
    const abacPolicies = await db('casbin_abac_policy')
        .select('id', 'sub', 'obj', 'act', 'conditions')
        .where({ 'is_active': true });

    return abacPolicies || [];
}

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

// Add a new policy
const addPolicyBulkToCasbinRule = async (policyRules = []) => {
    const enforcer = await getEnforcer();

    // Add policy if it doesn't exist
    if (!policyRules?.length) {
        throw new ApiError({ statusCode: 400, message: 'Policy rules cannot be empty' });
    }
    
    const added = await enforcer.addPolicies(policyRules);
    return added;
}

// Remove a policy
const removePolicyFromCasbinRule = async (sub, obj, act, cond) => {
    const enforcer = await getEnforcer();
    const policy = [sub, obj, act, cond];
    
    const exists = await enforcer.hasPolicy(...policy);

    // Check policy existence
    if (!exists) {
        throw new ApiError({ statusCode: 404, message: 'Policy not found' })
    }

    // Remove policy if it exists
    const removed = await enforcer.removePolicy(...policy);
    return removed;
}

// Remove a policy
const updatePolicyFromCasbinRule = async (oldPolicy = [], newPolicy = []) => {
    const enforcer = await getEnforcer();
    // const policy = [sub, obj, act, cond];
    
    const exists = await enforcer.hasPolicy(...oldPolicy);

    // Check policy existence
    if (!exists) {
        throw new ApiError({ statusCode: 404, message: 'Policy not found' })
    }

    // Remove policy if it exists
    // const removed = await enforcer.removePolicy(...policy);
    const update = await enforcer.updatePolicy([...oldPolicy], [...newPolicy]);
    // const update = await enforcer.updatePolicy(["eve", "data3", "read"], ["eve", "data3", "write"]);
    return update;
}

// Create ABAC policy
const createAbacPolicy = async (sub, obj, act, condition) => {
    // Add policy to casbin_abac_policy table
    const query = db('casbin_abac_policy').insert({
        sub,
        obj,
        act,
        conditions: condition || {}
    }).returning('id');

    const [{ id }] = await query

    return id || null;
}

// Create ABAC policy
const deleteAbacPolicy = async (sub, obj, act, condition) => {
    // Add policy to casbin_abac_policy table
    const query = await db('casbin_abac_policy')
        .where({ sub, obj, act })
        .andWhereRaw('conditions = ?::jsonb', [JSON.stringify(condition || {})])
        .del();

    const id = await query

    return id;
}

module.exports = {
    createUser,
    deleteRefreshTokenByUserIDAndToken,
    deleteRefreshTokenByUserID,
    createRole,
    createPermission,
    assignUserRole,
    assignRolePermission,
    removeAssignedRolePermissionById,
    addPolicyToCasbinRule,
    addPolicyBulkToCasbinRule,
    removePolicyFromCasbinRule,
    updatePolicyFromCasbinRule,
    createAbacPolicy,
    deleteAbacPolicy,
    getRolePermissionById,
    getAllAbacPolicy,
    getResourcePermissionById
};
