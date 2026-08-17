const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require("../services/asyncHandler");
const { ApiResponse } = require("../services/ApiResponse");
const { fetchStates, fetchCities, fetchPaymentStatuses, fetchPaymentModes, fetchGSTSlabs, fetchProductUnits, checkAddressTypeCodeExists, insertAddressType, updateAddressTypeById, fetchAllAddressTypes, fetchAddressTypeById, deleteAddressTypeMaster, insertContactRole, updateContactRoleById, getAllContactRolesModel, getContactRoleByIdModel, fetchContactRolesMeta, deleteContactRoleMaster } = require("../models/masters.model");
const { ERROR_CODES } = require('../../../config/constants/statusCodeMap');

// Fetch all states
const getStates = asyncHandler(async (req, res) => {
    const result = await fetchStates();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No states found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'States fetched successfully.',
            data: result,
        })
    );
});

// Fetch all cities by state ID
const getCityByState = asyncHandler(async (req, res) => {
    const { stateId } = req.params;

    const result = await fetchCities(stateId);

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No city found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Cities fetched successfully.',
            data: result,
        })
    );
});

// Fetch all payment statuses
const getPyamentStatuses = asyncHandler(async (req, res) => {
    const result = await fetchPaymentStatuses();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No payment statuses found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Payment statuses fetched successfully.',
            data: result,
        })
    );
});

// Fetch all payment modes
const getPyamentModes = asyncHandler(async (req, res) => {
    const result = await fetchPaymentModes();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No payment modes found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Payment modes fetched successfully.',
            data: result,
        })
    );
});

// Fetch all GST slabs
const getGstSlabs = asyncHandler(async (req, res) => {
    const result = await fetchGSTSlabs();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No gst slabs found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'GST slabs fetched successfully.',
            data: result,
        })
    );
});

// Fetch all item units
const getProductUnits = asyncHandler(async (req, res) => {
    const result = await fetchProductUnits();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No product unit found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Product units fetched successfully.',
            data: result,
        })
    );
});

// Address Types
const getAllAddressTypes = asyncHandler(async (req, res) => {
    const addressTypes = await fetchAllAddressTypes();

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: addressTypes,
            message: 'Address types fetched successfully.'
        })
    );
});

// Fetch address type meta
const getAddressTypesMeta = asyncHandler(async (req, res) => {
    const result = await fetchAddressTypesMeta(req.query);

    return res
        .status(200)
        .json(
            new ApiResponse({
                statusCode: 200,
                data: result,
                message: 'Address types fetched successfully.'
            })
        );
});

// Fetch address type by ID
const getAddressTypeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const addressType = await fetchAddressTypeById(id);

    if (!addressType) {
        throw new ApiError({
            statusCode: 404,
            message: 'Address type not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: addressType,
            message: 'Address type fetched successfully.'
        })
    );
});

// Create a new address type
const createAddressType = asyncHandler(async (req, res) => {
    const { typeCode, typeName, description } = req.body;

    // Check if address type code already exists
    const existingAddressType = await checkAddressTypeCodeExists(typeCode);

    if (existingAddressType) {
        throw new ApiError({
            statusCode: 409,
            errorCode: ERROR_CODES.CONFLICT,
            message: 'Address type code already exists.'
        });
    }

    // Prepare address type data
    const addressType = {
        code: typeCode.toUpperCase(),
        name: typeName,
        description: description || null
    };

    // Insert address type
    const addressTypeId = await insertAddressType(addressType);

    if (!addressTypeId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating address type.'
        });
    }

    const response = {
        id: addressTypeId
    };

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: response,
            message: 'Address type created successfully.'
        })
    );
});

const updateAddressType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { typeCode, typeName, description } = req.body;

    // Prepare address type data
    const addressType = {
        code: typeCode.toUpperCase(),
        name: typeName,
        description: description || null
    };

    // Update address type
    const updatedAddressType = await updateAddressTypeById(id, addressType);

    if (!updatedAddressType) {
        throw new ApiError({ statusCode: 404, message: 'Address type not found or update failed' });
    }

    const response = {
        id: updatedAddressType
    };

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: response,
            message: 'Address type updated successfully.'
        })
    );
});

// Delete an existing address type
const deleteAddressType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete } = req.query;

    const affectedRows = await deleteAddressTypeMaster(id, isPermanentDelete);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Address type not found or delete failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: 'Address type deleted successfully.'
        })
    );
});

// Get all contact roles
const getAllContactRoles = asyncHandler(async (req, res) => {
    const contactRoles = await getAllContactRolesModel();

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: contactRoles,
            message: 'Contact roles fetched successfully.'
        })
    );
});

// Get contact roles meta
const getContactRolesMeta = asyncHandler(async (req, res) => {
    const result = await fetchContactRolesMeta(req.query);

    return res
        .status(200)
        .json(
            new ApiResponse({
                statusCode: 200,
                data: result,
                message: 'Contact roles fetched successfully.'
            })
        );
});

// Get contact role by ID
const getContactRoleById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const contactRole = await getContactRoleByIdModel(id);

    if (!contactRole) {
        throw new ApiError({
            statusCode: 404,
            message: 'Contact role not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: contactRole,
            message: 'Contact role fetched successfully.'
        })
    );
});

// Create a new contact role
const createContactRole = asyncHandler(async (req, res) => {
    const {
        roleCode,
        roleName,
        description
    } = req.body;

    const contactRoleData = {
        code: roleCode,
        name: roleName,
        description: description || null
    };

    const contactRoleId = await insertContactRole(contactRoleData);

    if (!contactRoleId) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating contact role.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: contactRoleId
            },
            message: 'Contact role created successfully.'
        })
    );
});

// Update an existing contact role
const updateContactRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { roleCode, roleName, description } = req.body;

    const contactRoleData = {
        code: roleCode,
        name: roleName,
        description: description || null
    };

    const contactRoleId = await updateContactRoleById(id, contactRoleData);

    if (!contactRoleId) {
        throw new ApiError({
            statusCode: 404,
            message: 'Contact role not found.'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: contactRoleId
            },
            message: 'Contact role updated successfully.'
        })
    );
});

// Delete an existing contact role
const deleteContactRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPermanentDelete } = req.query;

    const affectedRows = await deleteContactRoleMaster(id, isPermanentDelete);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 404,
            message: 'Contact role not found or delete failed'
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                id: Number(id)
            },
            message: 'Contact role deleted successfully.'
        })
    );
});

module.exports = {
    getStates,
    getCityByState,
    getPyamentStatuses,
    getPyamentModes,
    getGstSlabs,
    getProductUnits,
    getAllAddressTypes,
    getAddressTypesMeta,
    getAddressTypeById,
    createAddressType,
    updateAddressType,
    deleteAddressType,
    getAllContactRoles,
    getContactRolesMeta,
    getContactRoleById,
    createContactRole,
    updateContactRole,
    deleteContactRole
};