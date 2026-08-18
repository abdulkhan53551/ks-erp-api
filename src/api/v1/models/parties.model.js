const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Fetch all party role
const fetchAllPartyRoles = async (query) => {
    try {
        const { page = 1, pageSize = 10 } = query;
        const baseQuery = db('party_roles')
            .select(
                'id',
                'code',
                'name',
                'description'
            )
            .where({ is_active: true })
            .orderBy('name', 'asc');

        const partyRoles = await fetchPageData({ baseQuery, page, pageSize });
        return partyRoles;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party roles.'
        });
    }
};

// Fetch party role by ID
const fetchPartyRoleById = async (partyRoleId) => {
    try {
        const partyRole = await db('party_roles')
            .select(
                'id',
                'code',
                'name',
                'description'
            )
            .where({ id: partyRoleId, is_active: true })
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
    try {
        const [partyRoleId] = await db('party_roles')
            .insert(partyRole)
            .returning('id');

        return partyRoleId?.id || partyRoleId;
    } catch (error) {
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
            .select('id')
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

        return updatedRows > 0
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

// Fetch all parties for a given firm
const fetchAllParties = async (firmId, query) => {
    try {
        const { page = 1, pageSize = 10 } = query;
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
                'p.remarks',
                'p.status',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'p.created_at',
                'p.updated_at'
            )
            .leftJoin('users as u', 'p.created_by', 'u.id')
            .where({
                'p.firm_id': firmId,
                'p.is_active': true
            })
            .orderBy('p.legal_name', 'asc');

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
        const { page = 1, pageSize = 10, search = '' } = query;

        const { firmId = 0 } = getContext();

        const baseQuery = db('parties AS P')
            .where('P.firm_id', firmId)
            .andWhere('P.is_active', true);

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
                'remarks',
                'status'
            )
            .where({
                id: partyId,
                firm_id: firmId,
                is_active: true
            })
            .first();

        return party;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching party.'
        });
    }
};

// Insert party
const insertParty = async (data) => {
    try {
        const [partyId] = await db('parties')
            .insert(data)
            .returning('id');

        return partyId?.id || partyId;

    } catch (error) {
        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This party code already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party.'
        });
    }
};

// Update party
const updatePartyMaster = async (partyId, data) => {
    try {
        const affectedRows = await db('parties')
            .update(data)
            .where({ id: partyId, is_active: true });

        return affectedRows;

    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This party code already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating party data.'
        });
    }
};

// Delete party
const deletePartyMaster = async (partyId, isPermanentDelete = false) => {
    try {
        if (isPermanentDelete) {
            return await db('parties')
                .where({ id: partyId })
                .del();
        }

        return await db('parties')
            .where({ id: partyId })
            .update({
                is_active: false
            });

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Party cannot be deleted because it is already in use.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting party.'
        });
    }
};

// Fetch all addresses for a given party
const fetchAllPartyAddresses = async (partyId) => {
    try {
        const partyAddresses = await db('party_addresses AS PA')
            .leftJoin('address_types AS AT', 'PA.address_type_id', 'AT.id')
            .leftJoin('parties as P', 'P.id', 'PA.address_type_id')
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
                'cr.name as contact_role_name',
                'pc.contact_name',
                'pc.designation',
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
                'cr.name as contact_role_name',
                'pc.contact_name',
                'pc.designation',
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
const insertPartyRoleMappings = async (partyId, partyRoleIds) => {
    const trx = await db.transaction();

    try {
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
        const rolesToAdd = partyRoleIds.filter(
            (roleId) => !existingRoleIds.includes(roleId)
        );
        const rolesToRemove = existingRoleIds.filter(
            (roleId) => !partyRoleIds.includes(roleId)
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

        await trx.commit();

        return {
            partyId,
            assignedRoles: partyRoleIds,
            added: rolesToAdd,
            removed: rolesToRemove,
        };
    } catch (error) {
        console.log('error => ', error);

        await trx.rollback();

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

        return {
            ...party,
            billingAddress,
            shippingAddress
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
    insertPartyRole,
    fetchPartyRoleById,
    checkPartyRoleCodeExists,
    updatePartyRoleMaster,
    deletePartyRoleMaster,
    fetchAllParties,
    fetchPartyMeta,
    fetchPartyById,
    insertParty,
    updatePartyMaster,
    deletePartyMaster,
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
