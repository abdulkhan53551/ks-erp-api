const { db } = require('../database');

/**
 * Fetch all branches for a firm with joined city and state names
 */
const fetchFirmBranches = async (firmId) => {
    return db('firm_branches as fb')
        .leftJoin('city as c', 'fb.city_id', 'c.id')
        .leftJoin('state as s', 'fb.state_id', 's.id')
        .where({ 'fb.firm_id': firmId })
        .whereNull('fb.deleted_at')
        .select(
            'fb.id',
            'fb.firm_id as firmId',
            'fb.branch_name as branchName',
            'fb.branch_code as branchCode',
            'fb.gstin',
            'fb.phone',
            'fb.email',
            'fb.address_line1 as addressLine1',
            'fb.address_line2 as addressLine2',
            'fb.city_id as cityId',
            'c.name as cityName',
            'fb.state_id as stateId',
            's.name as stateName',
            'fb.pincode',
            'fb.is_head_office as isHeadOffice',
            'fb.is_default as isDefault',
            'fb.is_active as isActive',
            'fb.created_at as createdAt',
            'fb.updated_at as updatedAt'
        )
        .orderBy('fb.is_head_office', 'desc')
        .orderBy('fb.id', 'asc');
};

/**
 * Fetch single branch by ID with joined city and state names
 */
const fetchFirmBranchById = async (branchId) => {
    return db('firm_branches as fb')
        .leftJoin('city as c', 'fb.city_id', 'c.id')
        .leftJoin('state as s', 'fb.state_id', 's.id')
        .where({ 'fb.id': branchId })
        .whereNull('fb.deleted_at')
        .select(
            'fb.id',
            'fb.firm_id as firmId',
            'fb.branch_name as branchName',
            'fb.branch_code as branchCode',
            'fb.gstin',
            'fb.phone',
            'fb.email',
            'fb.address_line1 as addressLine1',
            'fb.address_line2 as addressLine2',
            'fb.city_id as cityId',
            'c.name as cityName',
            'fb.state_id as stateId',
            's.name as stateName',
            'fb.pincode',
            'fb.is_head_office as isHeadOffice',
            'fb.is_default as isDefault',
            'fb.is_active as isActive'
        )
        .first();
};

/**
 * Find raw branch record by ID
 */
const findBranchById = async (branchId) => {
    return db('firm_branches')
        .where({ id: branchId })
        .whereNull('deleted_at')
        .first();
};

/**
 * Check if branch code exists in a firm (optionally excluding a branch ID)
 */
const findBranchByCode = async (firmId, branchCode, excludeId = null) => {
    const query = db('firm_branches')
        .where({ firm_id: firmId, branch_code: branchCode })
        .whereNull('deleted_at');

    if (excludeId) {
        query.whereNot({ id: excludeId });
    }

    return query.first();
};

/**
 * Clear head office flag from other branches of a firm
 */
const clearHeadOffice = async (firmId, excludeBranchId = null) => {
    const query = db('firm_branches')
        .where({ firm_id: firmId });

    if (excludeBranchId) {
        query.whereNot({ id: excludeBranchId });
    }

    return query.update({ is_head_office: false });
};

/**
 * Clear default flag from other branches of a firm
 */
const clearDefaultBranch = async (firmId, excludeBranchId = null) => {
    const query = db('firm_branches')
        .where({ firm_id: firmId });

    if (excludeBranchId) {
        query.whereNot({ id: excludeBranchId });
    }

    return query.update({ is_default: false });
};

/**
 * Insert new firm branch
 */
const insertFirmBranch = async (branchData) => {
    const [created] = await db('firm_branches')
        .insert(branchData)
        .returning('*');

    return created;
};

/**
 * Update existing firm branch
 */
const updateFirmBranchRecord = async (branchId, updateData) => {
    const [updated] = await db('firm_branches')
        .where({ id: branchId })
        .update({
            ...updateData,
            updated_at: new Date()
        })
        .returning('*');

    return updated;
};

/**
 * Count active branches for a firm
 */
const countActiveBranches = async (firmId) => {
    const count = await db('firm_branches')
        .where({ firm_id: firmId, is_active: true })
        .whereNull('deleted_at')
        .count('* as count')
        .first();

    return parseInt(count.count, 10);
};

/**
 * Soft delete branch
 */
const softDeleteFirmBranch = async (branchId) => {
    return db('firm_branches')
        .where({ id: branchId })
        .update({
            is_active: false,
            deleted_at: new Date(),
            updated_at: new Date()
        });
};

module.exports = {
    fetchFirmBranches,
    fetchFirmBranchById,
    findBranchById,
    findBranchByCode,
    clearHeadOffice,
    clearDefaultBranch,
    insertFirmBranch,
    updateFirmBranchRecord,
    countActiveBranches,
    softDeleteFirmBranch
};
