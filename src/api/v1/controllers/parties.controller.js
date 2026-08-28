const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require("../services/asyncHandler");
const { ApiResponse } = require("../services/ApiResponse");
const { checkPartyRoleCodeExists, updatePartyRoleMaster, fetchPartyRoleById, deletePartyRoleMaster, bulkDeletePartyRoles: bulkDeletePartyRolesModel, restorePartyRoleById, bulkRestorePartyRoles: bulkRestorePartyRolesModel, insertParty, updatePartyMaster, fetchAllParties, fetchPartyById, fetchPartyMeta, deletePartyMaster, bulkDeleteParties: bulkDeletePartiesModel, restorePartyMaster, bulkRestoreParties: bulkRestorePartiesModel, insertPartyAddress, updatePartyAddressMaster, fetchAllPartyAddresses, fetchPartyAddressById, deletePartyAddressMaster, insertPartyContact, updatePartyContactById, getAllPartyContactsModel, getPartyContactByIdModel, deletePartyContactById, insertPartyBankAccount, updatePartyBankAccountById, getAllPartyBankAccountsModel, getPartyBankAccountByIdModel, deletePartyBankAccountById, fetchAllPartyRoles, fetchPartyRolesMeta, insertPartyRole, insertPartyRoleMappings, fetchPartyRolesByPartyId, fetchPartiesByName, fetchPartyDetails } = require("../models/parties.model");
const { getContext } = require("../helpers/requestContext");

// Fetch all party roles
const getAllPartyRoles = asyncHandler(async (req, res) => {
    const partyRoles = await fetchAllPartyRoles(req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyRoles,
            message: 'Party roles fetched successfully.'
        })
    );
});

// Fetch party roles pagination meta
const getPartyRolesMeta = asyncHandler(async (req, res) => {
    const result = await fetchPartyRolesMeta(req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Party roles pagination fetched successfully.'
        })
    );
});

// Fetch party role by ID
const getPartyRoleById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const partyRole = await fetchPartyRoleById(id);

    if (!partyRole) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party role not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyRole,
            message: 'Party role fetched successfully.'
        })
    );
});

// Create a new party role
const createPartyRole = asyncHandler(async (req, res) => {
    const { roleCode, roleName, description } = req.body;

    // Prepare party role data
    const partyRole = {
        code: roleCode.toUpperCase(),
        name: roleName,
        description: description || null
    };

    // Insert party role (handles duplicate active vs trash checks)
    const partyRoleId = await insertPartyRole(partyRole);

    if (!partyRoleId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party role.'
        });
    }

    const response = {
        id: partyRoleId
    };

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: response,
            message: 'Party role created successfully.'
        })
    );
});

// Update an existing party role
const updatePartyRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { roleCode, roleName, description } = req.body;

    const partyRoleData = {
        code: roleCode,
        name: roleName,
        description: description || null
    };

    // Update party role
    const affectedRows = await updatePartyRoleMaster(id, partyRoleData);

    // Check if the update was successful
    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Party role not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(id) },
            message: 'Party role updated successfully.'
        })
    );
});

// Delete a party role
const deletePartyRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete = false } = req.query;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await deletePartyRoleMaster(id, permanent);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party role not found or delete failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(id) },
            message: permanent ? 'Party role permanently deleted successfully.' : 'Party role moved to Trash successfully.'
        })
    );
});

// Restore a party role
const restorePartyRole = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restored = await restorePartyRoleById(id);

    if (!restored) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party role not found in Trash or restore failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(id) },
            message: 'Party role restored from Trash successfully.'
        })
    );
});

// Bulk delete party roles
const bulkDeletePartyRoles = asyncHandler(async (req, res) => {
    const { ids = [], isPermanentDelete = false } = req.body;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await bulkDeletePartyRolesModel(ids, permanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: permanent
                ? `${affectedRows} party roles permanently deleted successfully.`
                : `${affectedRows} party roles moved to Trash successfully.`
        })
    );
});

// Bulk restore party roles
const bulkRestorePartyRoles = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;

    const affectedRows = await bulkRestorePartyRolesModel(ids);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: `${affectedRows} party roles restored from Trash successfully.`
        })
    );
});

// Get all parties
const getAllParties = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();

    const parties = await fetchAllParties(firmId, req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: parties,
            message: 'Parties fetched successfully.'
        })
    );
});

// Get party metadata with pagination and filtering
const getPartyMeta = asyncHandler(async (req, res) => {
    const result = await fetchPartyMeta(req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Party meta data fetched successfully.'
        })
    );
});

// Get party by ID
const getPartyById = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const { id } = req.params;

    const party = await fetchPartyById(id, firmId);

    if (!party) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: party,
            message: 'Party fetched successfully.'
        })
    );
});

// Create a new party
const createParty = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const {
        partyRoleIds = [],
        partyCode,
        legalName,
        displayName,
        mobile,
        email,
        gstRegistered,
        gstin,
        cinNumber,
        tanNumber,
        panNumber,
        website,
        remarks,
        status
    } = req.body;

    const partyData = {
        firm_id: firmId,
        party_code: partyCode,
        legal_name: legalName,
        display_name: displayName || null,
        mobile: mobile || null,
        email: email || null,
        gst_registered: gstRegistered ?? false,
        gstin: gstin || null,
        cin_number: cinNumber || null,
        tan_number: tanNumber || null,
        pan_number: panNumber || null,
        website: website || null,
        remarks: remarks || null,
        status: status || 'ACTIVE'
    };

    const partyId = await insertParty(partyData, partyRoleIds);

    if (!partyId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: partyId
            },
            message: 'Party created successfully.'
        })
    );
});

// Update an existing party
const updateParty = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const { id } = req.params;

    const {
        partyRoleIds,
        partyCode,
        legalName,
        displayName,
        mobile,
        email,
        gstRegistered,
        gstin,
        cinNumber,
        tanNumber,
        panNumber,
        website,
        remarks,
        status
    } = req.body;

    const partyData = {};
    if (partyCode !== undefined) partyData.party_code = partyCode;
    if (legalName !== undefined) partyData.legal_name = legalName;
    if (displayName !== undefined) partyData.display_name = displayName;
    if (mobile !== undefined) partyData.mobile = mobile;
    if (email !== undefined) partyData.email = email || null;
    if (gstRegistered !== undefined) partyData.gst_registered = gstRegistered;
    if (gstin !== undefined) partyData.gstin = gstin || null;
    if (cinNumber !== undefined) partyData.cin_number = cinNumber || null;
    if (tanNumber !== undefined) partyData.tan_number = tanNumber || null;
    if (panNumber !== undefined) partyData.pan_number = panNumber || null;
    if (website !== undefined) partyData.website = website || null;
    if (remarks !== undefined) partyData.remarks = remarks || null;
    if (status !== undefined) partyData.status = status;

    const affectedRows = await updatePartyMaster(id, partyData, partyRoleIds);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party not found or update failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: 'Party updated successfully.'
        })
    );
});

// Delete an existing party
const deleteParty = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete = false } = req.query;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await deletePartyMaster(id, permanent);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party not found or delete failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: permanent ? 'Party permanently deleted successfully.' : 'Party moved to Trash successfully.'
        })
    );
});

// Restore a party from trash
const restoreParty = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const affectedRows = await restorePartyMaster(id);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party not found in Trash or restore failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: 'Party restored from Trash successfully.'
        })
    );
});

// Bulk delete parties
const bulkDeleteParties = asyncHandler(async (req, res) => {
    const { ids = [], isPermanentDelete = false } = req.body;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await bulkDeletePartiesModel(ids, permanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                affectedRows
            },
            message: permanent
                ? `${affectedRows} parties permanently deleted successfully.`
                : `${affectedRows} parties moved to Trash successfully.`
        })
    );
});

// Bulk restore parties from trash
const bulkRestoreParties = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;

    const affectedRows = await bulkRestorePartiesModel(ids);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                affectedRows
            },
            message: `${affectedRows} parties restored from Trash successfully.`
        })
    );
});

// Get all addresses for a specific party
const getAllPartyAddresses = asyncHandler(async (req, res) => {
    const { partyId } = req.params;

    const partyAddresses = await fetchAllPartyAddresses(partyId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyAddresses,
            message: 'Party addresses fetched successfully.'
        })
    );
});

// Get a specific party address by ID
const getPartyAddressById = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;

    const partyAddress = await fetchPartyAddressById(id, partyId);

    if (!partyAddress) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party address not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyAddress,
            message: 'Party address fetched successfully.'
        })
    );
});


// Create a new party address
const createPartyAddress = asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const { addressTypeId, address, cityId, stateId, country, pincode } = req.body;

    const partyAddressData = {
        party_id: partyId,
        address_type_id: addressTypeId,
        address,
        city_id: cityId,
        state_id: stateId,
        country,
        pincode
    };

    const partyAddressId = await insertPartyAddress(partyAddressData);

    if (!partyAddressId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party address.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: partyAddressId
            },
            message: 'Party address created successfully.'
        })
    );
});

// Update an existing party address
const updatePartyAddress = asyncHandler(async (req, res) => {
    const { id, partyId } = req.params;

    const { addressTypeId, address, cityId, stateId, country, pincode } = req.body;

    const partyAddressData = {
        party_id: partyId,
        address_type_id: addressTypeId,
        address,
        city_id: cityId,
        state_id: stateId,
        country,
        pincode
    };

    const affectedRows = await updatePartyAddressMaster(
        id,
        partyAddressData
    );

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party address not found or update failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: 'Party address updated successfully.'
        })
    );
});

// Delete an existing party address
const deletePartyAddress = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;
    const { isPermanentDelete } = req.query;

    const affectedRows = await deletePartyAddressMaster(id, partyId, isPermanentDelete);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party address not found or delete failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: 'Party address deleted successfully.'
        })
    );
});

// Get all party contacts for a specific party
const getAllPartyContacts = asyncHandler(async (req, res) => {
    const { partyId } = req.params;

    const partyContacts = await getAllPartyContactsModel(partyId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyContacts,
            message: 'Party contacts fetched successfully.'
        })
    );
});

// Get party contact by id for a specific party
const getPartyContactById = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;

    const partyContact = await getPartyContactByIdModel(id, partyId);

    if (!partyContact) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party contact not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyContact,
            message: 'Party contact fetched successfully.'
        })
    );
});

// Create a new party contact
const createPartyContact = asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const {
        contactRoleId,
        contactName,
        mobile,
        email,
        isPrimary
    } = req.body;

    const partyContactData = {
        party_id: partyId,
        contact_role_id: contactRoleId,
        contact_name: contactName,
        mobile: mobile || null,
        email: email || null,
        is_primary: isPrimary ?? false
    };

    const partyContactId = await insertPartyContact(partyContactData);

    if (!partyContactId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party contact.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: partyContactId
            },
            message: 'Party contact created successfully.'
        })
    );
});

// Update an existing party contact
const updatePartyContact = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;
    const {
        contactRoleId,
        contactName,
        mobile,
        email,
        isPrimary
    } = req.body;

    const partyContactData = {
        party_id: partyId,
        contact_role_id: contactRoleId,
        contact_name: contactName,
        mobile: mobile || null,
        email: email || null,
        is_primary: isPrimary ?? false
    };

    const partyContactId = await updatePartyContactById(id, partyContactData);

    if (!partyContactId) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party contact not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: partyContactId },
            message: 'Party contact updated successfully.'
        })
    );
});

// Delete an existing party contact
const deletePartyContact = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete } = req.query;

    const deletedPartyContactId = await deletePartyContactById(id, isPermanentDelete);

    if (!deletedPartyContactId) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party contact not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: deletedPartyContactId
            },
            message: 'Party contact deleted successfully.'
        })
    );
});

// Get all party bank accounts for a specific party
const getAllPartyBankAccounts = asyncHandler(async (req, res) => {
    const { partyId } = req.params;

    const partyBankAccounts = await getAllPartyBankAccountsModel(partyId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyBankAccounts,
            message: 'Party bank accounts fetched successfully.'
        })
    );
});

// Get party bank account by id for a specific party
const getPartyBankAccountById = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;

    const partyBankAccount = await getPartyBankAccountByIdModel(partyId, id);

    if (!partyBankAccount) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party bank account not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyBankAccount,
            message: 'Party bank account fetched successfully.'
        })
    );
});

// Create a new party bank account
const createPartyBankAccount = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;
    const {
        bankName,
        accountNumber,
        ifscCode,
        branchName,
        accountHolderName,
        upiId,
        isPrimary
    } = req.body;

    const partyBankAccountData = {
        party_id: partyId,
        bank_name: bankName,
        account_number: accountNumber,
        ifsc_code: ifscCode || null,
        branch_name: branchName || null,
        account_holder_name: accountHolderName,
        upi_id: upiId || null,
        is_primary: isPrimary ?? false
    };

    const partyBankAccountId = await insertPartyBankAccount(
        partyBankAccountData
    );

    if (!partyBankAccountId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating party bank account.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: partyBankAccountId
            },
            message: 'Party bank account created successfully.'
        })
    );
});

// Update an existing party bank account
const updatePartyBankAccount = asyncHandler(async (req, res) => {
    const { partyId, id } = req.params;
    const {
        bankName,
        accountNumber,
        ifscCode,
        branchName,
        accountHolderName,
        upiId,
        isPrimary
    } = req.body;

    const partyBankAccountData = {
        party_id: partyId,
        bank_name: bankName,
        account_number: accountNumber,
        ifsc_code: ifscCode || null,
        branch_name: branchName || null,
        account_holder_name: accountHolderName,
        upi_id: upiId || null,
        is_primary: isPrimary ?? false
    };

    const partyBankAccountId = await updatePartyBankAccountById(id, partyBankAccountData);

    if (!partyBankAccountId) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party bank account not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: partyBankAccountId },
            message: 'Party bank account updated successfully.'
        })
    );
});

// Delete an existing party bank account
const deletePartyBankAccount = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete } = req.query;

    const deletedPartyBankAccountId = await deletePartyBankAccountById(id, isPermanentDelete);

    if (!deletedPartyBankAccountId) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party bank account not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: deletedPartyBankAccountId
            },
            message: 'Party bank account deleted successfully.'
        })
    );
});

// Search parties by name for autocomplete
const searchParties = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const { search = '' } = req.query;

    const parties = await fetchPartiesByName(firmId, search);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: parties,
            message: 'Parties fetched successfully.'
        })
    );
});

// Get party details with billing and shipping addresses
const getPartyDetails = asyncHandler(async (req, res) => {
    const { partyId } = req.params;

    const partyDetails = await fetchPartyDetails(partyId);

    if (!partyDetails) {
        throw new ApiError({
            statusCode: 404,
            message: 'Party not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: partyDetails,
            message: 'Party details fetched successfully.'
        })
    );
});

module.exports = {
    getAllPartyRoles,
    getPartyRolesMeta,
    getPartyRoleById,
    createPartyRole,
    updatePartyRole,
    deletePartyRole,
    restorePartyRole,
    bulkDeletePartyRoles,
    bulkRestorePartyRoles,
    getAllParties,
    getPartyMeta,
    getPartyById,
    createParty,
    updateParty,
    deleteParty,
    restoreParty,
    bulkDeleteParties,
    bulkRestoreParties,
    getAllPartyAddresses,
    getPartyAddressById,
    createPartyAddress,
    updatePartyAddress,
    deletePartyAddress,
    getAllPartyContacts,
    getPartyContactById,
    createPartyContact,
    updatePartyContact,
    deletePartyContact,
    getAllPartyBankAccounts,
    getPartyBankAccountById,
    createPartyBankAccount,
    updatePartyBankAccount,
    deletePartyBankAccount,
    searchParties,
    getPartyDetails
};