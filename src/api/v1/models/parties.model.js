const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");
const { deleteFromCloudinary } = require("../services/cloudinary");

// Fetch all party role
const fetchAllPartyRoles = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('party_roles AS pr')
            .select(
                'pr.id',
                'pr.code',
                'pr.name',
                'pr.description',
                'pr.is_active',
                'pr.created_at',
                'pr.updated_at',
                'pr.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('users AS du', 'pr.deleted_by', 'du.id')
            .where('pr.is_active', !isTrash);

        if (search) {
            baseQuery.where(function () {
                this.where('pr.code', 'ILIKE', `%${search}%`)
                    .orWhere('pr.name', 'ILIKE', `%${search}%`)
                    .orWhere('pr.description', 'ILIKE', `%${search}%`);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('pr.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('pr.name', 'asc');
        }

        const partyRoles = await fetchPageData({ baseQuery, page, pageSize });
        return partyRoles;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party roles.'
        });
    }
};

// Fetch party role pagination meta
const fetchPartyRolesMeta = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('party_roles AS pr')
            .where('pr.is_active', !isTrash);

        if (search) {
            baseQuery.where(function () {
                this.where('pr.code', 'ILIKE', `%${search}%`)
                    .orWhere('pr.name', 'ILIKE', `%${search}%`)
                    .orWhere('pr.description', 'ILIKE', `%${search}%`);
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });
        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party role meta data.'
        });
    }
};

// Fetch party role by ID
const fetchPartyRoleById = async (partyRoleId) => {
    try {
        const partyRole = await db('party_roles AS pr')
            .select(
                'pr.id',
                'pr.code',
                'pr.name',
                'pr.description',
                'pr.is_active',
                'pr.created_at',
                'pr.updated_at',
                'pr.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('users AS du', 'pr.deleted_by', 'du.id')
            .where({ 'pr.id': partyRoleId, 'pr.is_active': true })
            .first();

        return partyRole;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party role.'
        });
    }
};

// Insert party role
const insertPartyRole = async (partyRole) => {
    // Check if party role code already exists (active or in trash)
    const existing = await checkPartyRoleCodeExists(partyRole.code);
    if (existing) {
        if (existing.is_active) {
            throw new ApiError({
                statusCode: 409,
                message: `Party role code '${partyRole.code}' already exists.`
            });
        } else {
            throw new ApiError({
                statusCode: 409,
                message: `Party role code '${partyRole.code}' is currently in the Trash. Please restore it from the Recycle Bin or use a different code.`
            });
        }
    }

    try {
        const [partyRoleId] = await db('party_roles')
            .insert(partyRole)
            .returning('id');

        return partyRoleId?.id || partyRoleId;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party role.'
        });
    }
};

// Check whether party role code already exists
const checkPartyRoleCodeExists = async (roleCode) => {
    try {
        const partyRole = await db('party_roles')
            .select('id', 'code', 'is_active')
            .where('code', roleCode.toUpperCase())
            .first();

        return partyRole;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while checking party role code.'
        });
    }
};

const updatePartyRoleMaster = async (partyRoleId, data) => {
    try {
        const updatedRows = await db('party_roles')
            .update(data)
            .where({ id: partyRoleId, is_active: true });

        return updatedRows > 0;
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This party role code already exists.',
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party role data.',
        });
    }
};

// Delete party role
const deletePartyRoleMaster = async (partyRoleId, isPermanentDelete = false) => {
    try {
        // Check if role is in active use by any active party
        const activeUsage = await db('party_role_mapping as prm')
            .join('parties as p', 'prm.party_id', 'p.id')
            .where('prm.party_role_id', partyRoleId)
            .andWhere('p.is_active', true)
            .first();

        if (activeUsage) {
            throw new ApiError({
                statusCode: 409,
                message: 'Cannot delete Party Role because it is in use by active parties.'
            });
        }

        if (isPermanentDelete) {
            return await db('party_roles')
                .where({ id: partyRoleId })
                .del();
        }

        return await db('party_roles')
            .where({ id: partyRoleId })
            .update({
                is_active: false
            });

    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Party role cannot be deleted because it is already in use.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party role.'
        });
    }
};

// Bulk delete party roles
const bulkDeletePartyRoles = async (partyRoleIds = [], isPermanentDelete = false) => {
    if (!partyRoleIds.length) return 0;
    try {
        const activeUsage = await db('party_role_mapping as prm')
            .join('parties as p', 'prm.party_id', 'p.id')
            .join('party_roles as pr', 'prm.party_role_id', 'pr.id')
            .select('pr.name')
            .whereIn('prm.party_role_id', partyRoleIds)
            .andWhere('p.is_active', true)
            .first();

        if (activeUsage) {
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete Party Role '${activeUsage.name}' because it is in use by active parties.`
            });
        }

        if (isPermanentDelete) {
            return await db('party_roles').whereIn('id', partyRoleIds).del();
        }

        return await db('party_roles')
            .whereIn('id', partyRoleIds)
            .update({ is_active: false });
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party roles.'
        });
    }
};

// Restore party role by ID
const restorePartyRoleById = async (partyRoleId) => {
    try {
        const role = await db('party_roles')
            .where({ id: partyRoleId, is_active: false })
            .first();

        if (!role) {
            throw new ApiError({
                statusCode: 404,
                message: 'Party role not found in Trash or already active.'
            });
        }

        const affectedRows = await db('party_roles')
            .where({ id: partyRoleId })
            .update({ is_active: true });

        return affectedRows > 0;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring party role.'
        });
    }
};

// Bulk restore party roles
const bulkRestorePartyRoles = async (partyRoleIds = []) => {
    if (!partyRoleIds.length) return 0;
    try {
        const affectedRows = await db('party_roles')
            .whereIn('id', partyRoleIds)
            .andWhere({ is_active: false })
            .update({ is_active: true });

        return affectedRows;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring party roles.'
        });
    }
};

// Fetch all parties for a given firm
const fetchAllParties = async (firmId, query) => {
    try {
        const { page = 1, pageSize = 10, trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('parties as p')
            .select(
                'p.id',
                'p.firm_id',
                'p.party_code',
                'p.legal_name',
                'p.display_name',
                'p.mobile',
                'p.email',
                'p.gst_registered',
                'p.gstin',
                'p.cin_number',
                'p.tan_number',
                'p.pan_number',
                'p.website',
                'p.logo_url as logoUrl',
                'p.logo_public_id as logoPublicId',
                'p.remarks',
                'p.status',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'p.created_at',
                'p.updated_at',
                'p.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('users as u', 'p.created_by', 'u.id')
            .leftJoin('users as du', 'p.deleted_by', 'du.id')
            .where({
                'p.firm_id': firmId,
                'p.is_active': !isTrash
            });

        if (isTrash) {
            baseQuery.orderBy('p.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('p.legal_name', 'asc');
        }

        const parties = await fetchPageData({ baseQuery, page, pageSize });

        return parties;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching parties.'
        });
    }
};

// Fetch party pagination
const fetchPartyMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const { firmId = 0 } = getContext();

        const baseQuery = db('parties AS P')
            .where('P.firm_id', firmId)
            .andWhere('P.is_active', !isTrash);

        if (search) {
            baseQuery.where(function () {
                this.where('P.party_code', 'ILIKE', `%${search}%`)
                    .orWhere('P.legal_name', 'ILIKE', `%${search}%`)
                    .orWhere('P.display_name', 'ILIKE', `%${search}%`)
                    .orWhere('P.mobile', 'ILIKE', `%${search}%`)
                    .orWhere('P.email', 'ILIKE', `%${search}%`);
            });
        }

        const result = await buildPagination({
            baseQuery,
            page,
            pageSize
        });

        return result;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party meta data.',
        });
    }
};


// Fetch party by ID for a given firm
const fetchPartyById = async (partyId, firmId) => {
    try {
        const party = await db('parties')
            .select(
                'id',
                'firm_id',
                'party_code',
                'legal_name',
                'display_name',
                'mobile',
                'email',
                'gst_registered',
                'gstin',
                'cin_number',
                'tan_number',
                'pan_number',
                'website',
                'logo_url as logoUrl',
                'logo_public_id as logoPublicId',
                'remarks',
                'status'
            )
            .where({
                id: partyId,
                firm_id: firmId,
                is_active: true
            })
            .first();

        if (!party) return null;

        // Fetch mapped roles for this party
        const roles = await db('party_role_mapping as prm')
            .join('party_roles as pr', 'prm.party_role_id', 'pr.id')
            .select(
                'pr.id as roleId',
                'pr.code as roleCode',
                'pr.name as roleName'
            )
            .where({ 'prm.party_id': partyId, 'prm.is_active': true, 'pr.is_active': true });

        party.roles = roles;
        party.partyRoleIds = roles.map(r => r.roleId);

        return party;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party.'
        });
    }
};

// Insert party
const insertParty = async (data, partyRoleIds = []) => {
    // 1. Check if party code already exists in active or trashed state
    const existingParty = await db('parties')
        .select('id', 'is_active', 'party_code')
        .where({ firm_id: data.firm_id, party_code: data.party_code })
        .first();

    if (existingParty) {
        if (existingParty.is_active) {
            throw new ApiError({
                statusCode: 409,
                message: `Party code '${data.party_code}' already exists.`
            });
        } else {
            throw new ApiError({
                statusCode: 409,
                message: `Party code '${data.party_code}' is currently in the Trash. Please restore it from the Recycle Bin or use a different code.`
            });
        }
    }

    const trx = await db.transaction();
    try {
        const [createdParty] = await trx('parties')
            .insert(data)
            .returning('id');

        const partyId = createdParty?.id || createdParty;

        if (partyRoleIds && partyRoleIds.length > 0) {
            await insertPartyRoleMappings(partyId, partyRoleIds, trx);
        }

        await trx.commit();
        return partyId;

    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This party code already exists.'
            });
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party.'
        });
    }
};

// Update party
const updatePartyMaster = async (partyId, data, partyRoleIds) => {
    const trx = await db.transaction();
    try {
        let affectedRows = 0;

        if (data && Object.keys(data).length > 0) {
            affectedRows = await trx('parties')
                .update(data)
                .where({ id: partyId, is_active: true });

            if (!affectedRows) {
                await trx.rollback();
                return 0;
            }
        }

        if (partyRoleIds !== undefined) {
            await insertPartyRoleMappings(partyId, partyRoleIds, trx);
            affectedRows = 1;
        }

        await trx.commit();
        return affectedRows;

    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This party code already exists.'
            });
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party data.'
        });
    }
};

// Delete single party
const deletePartyMaster = async (partyId, isPermanentDelete = false) => {
    const trx = await db.transaction();
    try {
        const { firmId = 0 } = getContext();

        const party = await trx('parties')
            .where({ id: partyId, firm_id: firmId })
            .first();

        if (!party) {
            await trx.rollback();
            return 0;
        }

        if (isPermanentDelete) {
            // Fetch associated attachments before deleting
            const attachments = await trx('attachments')
                .select('public_id', 'resource_type')
                .where({ entity_type: 'PARTY', entity_id: partyId });

            await trx('attachments').where({ entity_type: 'PARTY', entity_id: partyId }).del();
            await trx('party_role_mapping').where({ party_id: partyId }).del();
            await trx('party_bank_accounts').where({ party_id: partyId }).del();
            await trx('party_contacts').where({ party_id: partyId }).del();
            await trx('party_addresses').where({ party_id: partyId }).del();
            const affectedRows = await trx('parties').where({ id: partyId, firm_id: firmId }).del();

            await trx.commit();

            // Destroy logo from Cloudinary if exists
            if (party.logo_public_id) {
                await deleteFromCloudinary(party.logo_public_id, 'image');
            }

            // Destroy attachments from Cloudinary
            for (const att of attachments) {
                if (att.public_id) {
                    await deleteFromCloudinary(att.public_id, att.resource_type || 'image');
                }
            }

            return affectedRows;
        }

        // Soft delete (move to trash)
        await trx('attachments').where({ entity_type: 'PARTY', entity_id: partyId }).update({ is_active: false });
        await trx('party_bank_accounts').where({ party_id: partyId }).update({ is_active: false });
        await trx('party_contacts').where({ party_id: partyId }).update({ is_active: false });
        await trx('party_addresses').where({ party_id: partyId }).update({ is_active: false });
        const affectedRows = await trx('parties').where({ id: partyId, firm_id: firmId }).update({ is_active: false });

        await trx.commit();
        return affectedRows;

    } catch (error) {
        await trx.rollback();

        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Party cannot be deleted because it is already in use.'
            });
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party.'
        });
    }
};

// Bulk delete parties
const bulkDeleteParties = async (partyIds = [], isPermanentDelete = false) => {
    if (!partyIds || !partyIds.length) return 0;
    const trx = await db.transaction();
    try {
        const { firmId = 0 } = getContext();

        if (isPermanentDelete) {
            // Fetch party logos and attachments before deleting
            const parties = await trx('parties')
                .select('id', 'logo_public_id')
                .whereIn('id', partyIds)
                .andWhere({ firm_id: firmId });

            const attachments = await trx('attachments')
                .select('public_id', 'resource_type')
                .where('entity_type', 'PARTY')
                .whereIn('entity_id', partyIds);

            await trx('attachments').where('entity_type', 'PARTY').whereIn('entity_id', partyIds).del();
            await trx('party_role_mapping').whereIn('party_id', partyIds).del();
            await trx('party_bank_accounts').whereIn('party_id', partyIds).del();
            await trx('party_contacts').whereIn('party_id', partyIds).del();
            await trx('party_addresses').whereIn('party_id', partyIds).del();
            const affectedRows = await trx('parties')
                .whereIn('id', partyIds)
                .andWhere({ firm_id: firmId })
                .del();

            await trx.commit();

            // Destroy logos from Cloudinary
            for (const p of parties) {
                if (p.logo_public_id) {
                    await deleteFromCloudinary(p.logo_public_id, 'image');
                }
            }

            // Destroy attachments from Cloudinary
            for (const att of attachments) {
                if (att.public_id) {
                    await deleteFromCloudinary(att.public_id, att.resource_type || 'image');
                }
            }

            return affectedRows;
        }

        // Bulk soft-delete (move to trash)
        await trx('attachments').where('entity_type', 'PARTY').whereIn('entity_id', partyIds).update({ is_active: false });
        await trx('party_bank_accounts').whereIn('party_id', partyIds).update({ is_active: false });
        await trx('party_contacts').whereIn('party_id', partyIds).update({ is_active: false });
        await trx('party_addresses').whereIn('party_id', partyIds).update({ is_active: false });
        const affectedRows = await trx('parties')
            .whereIn('id', partyIds)
            .andWhere({ firm_id: firmId })
            .update({ is_active: false });

        await trx.commit();
        return affectedRows;

    } catch (error) {
        await trx.rollback();

        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'One or more parties cannot be deleted because they are in use.'
            });
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting parties.'
        });
    }
};

// Restore single party from trash
const restorePartyMaster = async (partyId) => {
    const trx = await db.transaction();
    try {
        const { firmId = 0 } = getContext();

        const party = await trx('parties')
            .where({ id: partyId, firm_id: firmId, is_active: false })
            .first();

        if (!party) {
            await trx.rollback();
            throw new ApiError({
                statusCode: 404,
                message: 'Party not found in Trash or already active.'
            });
        }

        // Restore party and associated child records
        await trx('attachments').where({ entity_type: 'PARTY', entity_id: partyId }).update({ is_active: true });
        await trx('party_bank_accounts').where({ party_id: partyId }).update({ is_active: true });
        await trx('party_contacts').where({ party_id: partyId }).update({ is_active: true });
        await trx('party_addresses').where({ party_id: partyId }).update({ is_active: true });
        const affectedRows = await trx('parties').where({ id: partyId, firm_id: firmId }).update({ is_active: true });

        await trx.commit();
        return affectedRows;

    } catch (error) {
        await trx.rollback();

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring party.'
        });
    }
};

// Bulk restore parties from trash
const bulkRestoreParties = async (partyIds = []) => {
    if (!partyIds || !partyIds.length) return 0;
    const trx = await db.transaction();
    try {
        const { firmId = 0 } = getContext();

        await trx('attachments').where('entity_type', 'PARTY').whereIn('entity_id', partyIds).update({ is_active: true });
        await trx('party_bank_accounts').whereIn('party_id', partyIds).update({ is_active: true });
        await trx('party_contacts').whereIn('party_id', partyIds).update({ is_active: true });
        await trx('party_addresses').whereIn('party_id', partyIds).update({ is_active: true });
        const affectedRows = await trx('parties')
            .whereIn('id', partyIds)
            .andWhere({ firm_id: firmId, is_active: false })
            .update({ is_active: true });

        await trx.commit();
        return affectedRows;

    } catch (error) {
        await trx.rollback();

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring parties.'
        });
    }
};

// Fetch all addresses for a given party
const fetchAllPartyAddresses = async (partyId) => {
    try {
        const partyAddresses = await db('party_addresses AS PA')
            .leftJoin('address_types AS AT', 'PA.address_type_id', 'AT.id')
            .leftJoin('parties as P', 'P.id', 'PA.party_id')
            .select(
                'PA.id',
                'PA.party_id',
                'PA.address_type_id',
                'AT.code AS address_type_code',
                'AT.name AS address_type_name',
                'PA.address',
                'PA.city_id',
                'PA.state_id',
                'PA.country',
                'PA.pincode'
            )
            .where({
                'PA.party_id': partyId,
                'PA.is_active': true,
                'P.is_active': true
            })
            .orderBy('PA.id', 'asc');

        return partyAddresses;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party addresses.'
        });
    }
};

// Fetch party address by ID for a given party
const fetchPartyAddressById = async (partyAddressId, partyId) => {
    try {
        const partyAddress = await db('party_addresses AS PA')
            .leftJoin('address_types AS AT', 'PA.address_type_id', 'AT.id')
            .leftJoin('parties as P', 'P.id', 'PA.party_id')
            .select(
                'PA.id',
                'PA.party_id',
                'PA.address_type_id',
                'AT.code AS address_type_code',
                'AT.name AS address_type_name',
                'PA.address',
                'PA.city_id',
                'PA.state_id',
                'PA.country',
                'PA.pincode'
            )
            .where({
                'PA.id': partyAddressId,
                'PA.party_id': partyId,
                'PA.is_active': true,
                'P.is_active': true
            })
            .first();

        return partyAddress;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party address.'
        });
    }
};

// Insert party address
const insertPartyAddress = async (data) => {
    try {
        const [partyAddressId] = await db('party_addresses')
            .insert(data)
            .returning('id');

        return partyAddressId?.id || partyAddressId;

    } catch (error) {
        if (error.code === '23503') { // Foreign key violation
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid party, address type, city, or state.'
            });
        }

        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This party address already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party address.'
        });
    }
};

// Update party address
const updatePartyAddressMaster = async (partyAddressId, data) => {
    try {
        const affectedRows = await db('party_addresses')
            .update(data)
            .where({ id: partyAddressId, is_active: true });

        return affectedRows;

    } catch (error) {
        if (error.code === '23503') { // Foreign key violation
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid party, address type, city, or state.'
            });
        }

        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This party address already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party address data.'
        });
    }
};

// Delete party address
const deletePartyAddressMaster = async (partyAddressId, partyId, isPermanentDelete = false) => {
    try {
        if (isPermanentDelete) {
            return await db('party_addresses')
                .where({
                    id: partyAddressId,
                    party_id: partyId
                })
                .del();
        }

        return await db('party_addresses')
            .where({
                id: partyAddressId,
                party_id: partyId
            })
            .update({
                is_active: false
            });

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Party address cannot be deleted because it is already in use.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party address.'
        });
    }
};

// Fetch all party contacts for a given party
const getAllPartyContactsModel = async (partyId = null) => {
    try {
        const query = db('party_contacts as pc')
            .leftJoin('parties as p', 'p.id', 'pc.party_id')
            .leftJoin('contact_roles as cr', 'cr.id', 'pc.contact_role_id')
            .select(
                'pc.id',
                'pc.party_id',
                'p.display_name as party_name',
                'pc.contact_role_id',
                'cr.name as designation',
                'pc.contact_name',
                'pc.mobile',
                'pc.email',
                'pc.is_primary'
            )
            .where({ 'pc.is_active': true, 'p.is_active': true })
            .orderBy('pc.id', 'desc');

        if (partyId) {
            query.where('pc.party_id', partyId);
        }

        return await query;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party contacts.'
        });
    }
};

// Fetch party contact by ID
const getPartyContactByIdModel = async (id, partyId) => {
    try {
        const partyContact = db('party_contacts as pc')
            .leftJoin('parties as p', 'p.id', 'pc.party_id')
            .leftJoin('contact_roles as cr', 'cr.id', 'pc.contact_role_id')
            .select(
                'pc.id',
                'pc.party_id',
                'pc.contact_role_id',
                'cr.code as contact_role_code',
                'cr.name as designation',
                'pc.contact_name',
                'pc.mobile',
                'pc.email',
                'pc.is_primary'
            )
            .where('pc.id', id)
            .where('pc.party_id', partyId)
            .where('pc.is_active', true)
            .where('p.is_active', true)
            .first();

        return partyContact || null;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party contact.'
        });
    }
};


// Insert party contact
const insertPartyContact = async (data) => {
    try {
        const [partyContactId] = await db('party_contacts')
            .insert(data)
            .returning('id');

        return partyContactId?.id || partyContactId;

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid party or contact role.'
            });
        }

        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This party contact already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party contact.'
        });
    }
};

// Update party contact
const updatePartyContactById = async (id, data) => {
    try {
        const [partyContactId] = await db('party_contacts')
            .where({ id, is_active: true })
            .update(data)
            .returning('id');

        return partyContactId?.id || partyContactId;

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid party or contact role.'
            });
        }

        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This party contact already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party contact.'
        });
    }
};

// Delete party contact
const deletePartyContactById = async (id, isPermanentDelete = false) => {
    try {
        if (isPermanentDelete) {
            const [partyContactId] = await db('party_contacts')
                .where({ id })
                .del()
                .returning('id');

            return partyContactId?.id || partyContactId;
        }

        const [partyContactId] = await db('party_contacts')
            .where({ id })
            .update({
                is_active: false
            })
            .returning('id');

        return partyContactId?.id || partyContactId;

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Party contact cannot be deleted because it is being used elsewhere.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party contact.'
        });
    }
};

// Get all party bank accounts for a given party
const getAllPartyBankAccountsModel = async (partyId = null) => {
    try {
        const query = db('party_bank_accounts as PBA')
            .leftJoin('parties as P', 'P.id', 'PBA.party_id')
            .select(
                'PBA.id',
                'PBA.party_id',
                'PBA.bank_name',
                'PBA.account_number',
                'PBA.ifsc_code',
                'PBA.branch_name',
                'PBA.account_holder_name',
                'PBA.upi_id',
                'PBA.is_primary',
                'PBA.is_active'
            )
            .where({
                'PBA.is_active': true,
                'P.is_active': true
            })
            .orderBy('PBA.id', 'desc');

        if (partyId) {
            query.where('PBA.party_id', partyId);
        }

        return await query;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party bank accounts.'
        });
    }
};

// Get party bank account by ID
const getPartyBankAccountByIdModel = async (partyId, id) => {
    try {
        const partyBankAccount = await db('party_bank_accounts as PBA')
            .leftJoin('parties as P', 'P.id', 'PBA.party_id')
            .select(
                'PBA.id',
                'PBA.party_id',
                'PBA.bank_name',
                'PBA.account_number',
                'PBA.ifsc_code',
                'PBA.branch_name',
                'PBA.account_holder_name',
                'PBA.upi_id',
                'PBA.is_primary',
                'PBA.is_active'
            )
            .where('PBA.id', id)
            .andWhere('PBA.is_active', true)
            .where('P.id', partyId)
            .andWhere('P.is_active', true)
            .first();

        return partyBankAccount || null;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party bank account.'
        });
    }
};

// Insert party bank account
const insertPartyBankAccount = async (data) => {
    try {
        const [partyBankAccountId] = await db('party_bank_accounts')
            .insert(data)
            .returning('id');

        return partyBankAccountId?.id || partyBankAccountId;

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid party.'
            });
        }

        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This party bank account already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party bank account.'
        });
    }
};

// Update party bank account
const updatePartyBankAccountById = async (id, data) => {
    try {
        const [partyBankAccountId] = await db('party_bank_accounts')
            .where({ id, is_active: true })
            .update(data)
            .returning('id');

        return partyBankAccountId?.id || partyBankAccountId;

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid party.'
            });
        }

        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This party bank account already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party bank account.'
        });
    }
};

// Delete party bank account
const deletePartyBankAccountById = async (id, isPermanentDelete = false) => {
    try {
        if (isPermanentDelete) {
            const [partyBankAccountId] = await db('party_bank_accounts')
                .where({ id })
                .del()
                .returning('id');

            return partyBankAccountId?.id || partyBankAccountId;
        }

        const [partyBankAccountId] = await db('party_bank_accounts')
            .where({ id })
            .update({
                is_active: false
            })
            .returning('id');

        return partyBankAccountId?.id || partyBankAccountId;

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Party bank account cannot be deleted because it is being used elsewhere.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party bank account.'
        });
    }
};

/**
 * Fetch assigned roles for a given party ID
 */
const fetchPartyRolesByPartyId = async (partyId) => {
    try {
        const { firmId = 0 } = getContext();

        const roles = await db('party_role_mapping as prm')
            .join('party_roles as pr', 'prm.party_role_id', 'pr.id')
            .select(
                'prm.id as mappingId',
                'pr.id as roleId',
                'pr.name as roleName'
            )
            .where({ 'prm.party_id': partyId, 'prm.is_active': true, 'pr.is_active': true });

        return roles;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party roles.',
        });
    }
};

/**
 * Syncs party role mappings for a specific party while preserving existing record IDs.
*/
const insertPartyRoleMappings = async (partyId, partyRoleIds, externalTrx = null) => {
    const execute = async (trx) => {
        const { firmId = 0, userId = 0 } = getContext();

        // 1. Check if party exists
        const partyExists = await trx('parties')
            .select('id')
            .where({ id: partyId, firm_id: firmId })
            .first();

        if (!partyExists) {
            throw new ApiError({
                statusCode: 404,
                message: 'Party not found or inactive.',
            });
        }

        // 2. Get existing mapped role IDs for this party
        const existingRecords = await trx('party_role_mapping')
            .select('party_role_id')
            .where({ party_id: partyId });

        const existingRoleIds = existingRecords.map((r) => r.party_role_id);

        // 3. Determine which roles to add and which roles to remove
        const rolesToAdd = (partyRoleIds || []).filter(
            (roleId) => !existingRoleIds.includes(roleId)
        );
        const rolesToRemove = existingRoleIds.filter(
            (roleId) => !(partyRoleIds || []).includes(roleId)
        );

        // 4. Delete only the roles that were unchecked/removed
        if (rolesToRemove.length > 0) {
            await trx('party_role_mapping')
                .where({ party_id: partyId })
                .whereIn('party_role_id', rolesToRemove)
                .del();
        }

        // 5. Insert only the newly added roles (preserving IDs of existing records)
        if (rolesToAdd.length > 0) {
            const newRecords = rolesToAdd.map((roleId) => ({
                party_id: partyId,
                party_role_id: roleId
            }));

            await trx('party_role_mapping').insert(newRecords);
        }

        return {
            partyId,
            assignedRoles: partyRoleIds,
            added: rolesToAdd,
            removed: rolesToRemove,
        };
    };

    try {
        if (externalTrx) {
            return await execute(externalTrx);
        } else {
            return await db.transaction(execute);
        }
    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Invalid party role selected.'
            });
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party role mappings.',
        });
    }
};

// Fetch parties by name
const fetchPartiesByName = async (firmId, search) => {
    try {
        const parties = await db('parties')
            .select(
                'id',
                'party_code',
                'legal_name',
                'display_name'
            )
            .where({
                firm_id: firmId,
                is_active: true
            })
            .where((query) => {
                query
                    .whereILike('legal_name', `%${search}%`)
                    .orWhereILike('display_name', `%${search}%`);
            })
            .orderBy('legal_name', 'asc')
            .limit(10);

        return parties;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while searching parties.'
        });
    }
};

// Fetch party details
const fetchPartyDetails = async (partyId) => {
    try {
        // Fetch party details
        const party = await db('parties')
            .select(
                'id',
                'firm_id',
                'party_code',
                'legal_name',
                'display_name',
                'mobile',
                'email',
                'gst_registered',
                'gstin',
                'cin_number',
                'tan_number',
                'pan_number',
                'website',
                'remarks',
                'status'
            )
            .where({ id: partyId, is_active: true })
            .first();

        if (!party) {
            return null;
        }

        // Fetch billing and shipping addresses
        const addresses = await db('party_addresses AS PA')
            .leftJoin('address_types AS AT', 'PA.address_type_id', 'AT.id')
            .select(
                'PA.id',
                'PA.party_id',
                'PA.address_type_id',
                'AT.code AS address_type_code',
                'AT.name AS address_type_name',
                'PA.address',
                'PA.city_id',
                'PA.state_id',
                'PA.country',
                'PA.pincode'
            )
            .where({ 'PA.party_id': partyId, 'PA.is_active': true })
            .whereIn('AT.code', ['BILLING', 'SHIPPING']);

        const billingAddress = addresses.find(
            (address) => address.address_type_code === 'BILLING'
        ) || null;

        const shippingAddress = addresses.find(
            (address) => address.address_type_code === 'SHIPPING'
        ) || null;

        // Fetch mapped roles for this party
        const roles = await db('party_role_mapping as prm')
            .join('party_roles as pr', 'prm.party_role_id', 'pr.id')
            .select(
                'pr.id as roleId',
                'pr.code as roleCode',
                'pr.name as roleName'
            )
            .where({ 'prm.party_id': partyId, 'prm.is_active': true, 'pr.is_active': true });

        return {
            ...party,
            billingAddress,
            shippingAddress,
            roles,
            partyRoleIds: roles.map(r => r.roleId)
        };

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party details.'
        });
    }
};

module.exports = {
    fetchAllPartyRoles,
    fetchPartyRolesMeta,
    insertPartyRole,
    fetchPartyRoleById,
    checkPartyRoleCodeExists,
    updatePartyRoleMaster,
    deletePartyRoleMaster,
    bulkDeletePartyRoles,
    restorePartyRoleById,
    bulkRestorePartyRoles,
    fetchAllParties,
    fetchPartyMeta,
    fetchPartyById,
    insertParty,
    updatePartyMaster,
    deletePartyMaster,
    bulkDeleteParties,
    restorePartyMaster,
    bulkRestoreParties,
    fetchAllPartyAddresses,
    fetchPartyAddressById,
    insertPartyAddress,
    updatePartyAddressMaster,
    deletePartyAddressMaster,
    getAllPartyContactsModel,
    getPartyContactByIdModel,
    insertPartyContact,
    updatePartyContactById,
    deletePartyContactById,
    getAllPartyBankAccountsModel,
    getPartyBankAccountByIdModel,
    insertPartyBankAccount,
    updatePartyBankAccountById,
    deletePartyBankAccountById,
    fetchPartyRolesByPartyId,
    insertPartyRoleMappings,
    fetchPartiesByName,
    fetchPartyDetails
};
