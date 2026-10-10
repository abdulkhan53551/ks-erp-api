const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { getContext } = require('../helpers/requestContext');
const {
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
} = require('../models/firmBranch.model');

// Get all branches for a firm
const getFirmBranches = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.params.firmId ? parseInt(req.params.firmId, 10) : context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'firmId is required to fetch branches.' });
    }

    const branches = await fetchFirmBranches(firmId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: branches,
        message: 'Firm branches fetched successfully'
    }));
});

// Get branch by ID
const getFirmBranchById = asyncHandler(async (req, res) => {
    const { branchId } = req.params;

    const branch = await fetchFirmBranchById(branchId);

    if (!branch) {
        throw new ApiError({ statusCode: 404, message: 'Branch not found' });
    }

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: branch,
        message: 'Branch details fetched successfully'
    }));
});

// Create a new branch under a firm
const createFirmBranch = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.params.firmId ? parseInt(req.params.firmId, 10) : context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'firmId is required to create a branch.' });
    }
    const {
        branchName,
        branchCode,
        gstin,
        phone,
        phoneNumber,
        email,
        addressLine1,
        addressLine2,
        cityId,
        stateId,
        pincode,
        isHeadOffice = false,
        isDefault = false
    } = req.body;

    if (!branchName || !branchCode) {
        throw new ApiError({ statusCode: 400, message: 'Branch name and branch code are required.' });
    }

    // Check unique branch_code in this firm
    const existing = await findBranchByCode(firmId, branchCode.trim());

    if (existing) {
        throw new ApiError({ statusCode: 400, message: `Branch code '${branchCode}' already exists for this firm.` });
    }

    // If first branch of this firm, auto-designate as Head Office & Default
    const branchCount = await countActiveBranches(firmId);
    const effectiveIsHeadOffice = Boolean(isHeadOffice) || branchCount === 0;
    const effectiveIsDefault = Boolean(isDefault) || effectiveIsHeadOffice;

    // If marked as Head Office, remove is_head_office from other branches of this firm
    if (effectiveIsHeadOffice) {
        await clearHeadOffice(firmId);
    }

    // If marked as Default, remove is_default from other branches of this firm
    if (effectiveIsDefault) {
        await clearDefaultBranch(firmId);
    }

    const created = await insertFirmBranch({
        firm_id: firmId,
        branch_name: branchName.trim(),
        branch_code: branchCode.trim().toUpperCase(),
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        phone: phone || phoneNumber || null,
        email: email || null,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city_id: cityId ? parseInt(cityId, 10) : null,
        state_id: stateId ? parseInt(stateId, 10) : null,
        pincode: pincode || null,
        is_head_office: effectiveIsHeadOffice,
        is_default: effectiveIsDefault,
        is_active: true
    });

    const fullBranch = await fetchFirmBranchById(created.id);

    return res.status(201).json(new ApiResponse({
        statusCode: 201,
        data: fullBranch || created,
        message: 'Branch created successfully'
    }));
});

// Update an existing branch
const updateFirmBranch = asyncHandler(async (req, res) => {
    const { branchId } = req.params;
    const {
        branchName,
        branchCode,
        gstin,
        phone,
        phoneNumber,
        email,
        addressLine1,
        addressLine2,
        cityId,
        stateId,
        pincode,
        isHeadOffice,
        isDefault,
        isActive
    } = req.body;

    const existing = await findBranchById(branchId);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Branch not found' });
    }

    // If branchCode changed, verify uniqueness
    if (branchCode && branchCode.trim().toUpperCase() !== existing.branch_code) {
        const duplicate = await findBranchByCode(existing.firm_id, branchCode.trim().toUpperCase(), branchId);

        if (duplicate) {
            throw new ApiError({ statusCode: 400, message: `Branch code '${branchCode}' already exists for this firm.` });
        }
    }

    // If toggling Head Office ON, unset other branches of this firm
    if (isHeadOffice) {
        await clearHeadOffice(existing.firm_id, branchId);
    }

    // If toggling Default ON, unset other branches of this firm
    if (isDefault) {
        await clearDefaultBranch(existing.firm_id, branchId);
    }

    const updatePayload = {};
    if (branchName !== undefined) updatePayload.branch_name = branchName.trim();
    if (branchCode !== undefined) updatePayload.branch_code = branchCode.trim().toUpperCase();
    if (gstin !== undefined) updatePayload.gstin = gstin ? gstin.trim().toUpperCase() : null;
    const rawPhone = phone !== undefined ? phone : phoneNumber;
    if (rawPhone !== undefined) updatePayload.phone = rawPhone;
    if (email !== undefined) updatePayload.email = email;
    if (addressLine1 !== undefined) updatePayload.address_line1 = addressLine1;
    if (addressLine2 !== undefined) updatePayload.address_line2 = addressLine2;
    if (cityId !== undefined) updatePayload.city_id = cityId ? parseInt(cityId, 10) : null;
    if (stateId !== undefined) updatePayload.state_id = stateId ? parseInt(stateId, 10) : null;
    if (pincode !== undefined) updatePayload.pincode = pincode;
    if (isHeadOffice !== undefined) updatePayload.is_head_office = !!isHeadOffice;
    if (isDefault !== undefined) updatePayload.is_default = !!isDefault;
    if (isActive !== undefined) updatePayload.is_active = !!isActive;

    await updateFirmBranchRecord(branchId, updatePayload);
    const fullBranch = await fetchFirmBranchById(branchId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: fullBranch,
        message: 'Branch updated successfully'
    }));
});

// Soft delete / deactivate branch
const deleteFirmBranch = asyncHandler(async (req, res) => {
    const { branchId } = req.params;

    const existing = await findBranchById(branchId);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Branch not found' });
    }

    if (existing.is_head_office) {
        const activeCount = await countActiveBranches(existing.firm_id);

        if (activeCount > 1) {
            throw new ApiError({
                statusCode: 400,
                message: 'Cannot delete Head Office branch while other active branches exist. Please designate another branch as Head Office first.'
            });
        }
    }

    // Soft delete
    await softDeleteFirmBranch(branchId);

    return res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: { id: branchId },
        message: 'Branch deactivated successfully'
    }));
});

module.exports = {
    getFirmBranches,
    getFirmBranchById,
    createFirmBranch,
    updateFirmBranch,
    deleteFirmBranch
};
