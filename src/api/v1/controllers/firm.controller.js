const { isFirmExistWithGst, isFirmExistWithNameAndPhone, insertFirm, insertAddress, insertBankAccount, updateFirmById, updateAddressByEntity, updateBankAccountByFirmId, deleteFirmtById, deleteAddressByFirmId, deleteBankAccountByFirmId, fetchFirmTypes, fetchAllFirm, fetchFirmById } = require("../models/firm.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");

// Get all firm
const getAllFirm = asyncHandler(async (req, res) => {
    const firms = await fetchAllFirm();
    if (!firms) {
        throw new ApiError({ statusCode: 404, message: 'No firms found.' });
    }
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: firms, message: 'Firms fetched successfully.' }));
});

// Create firm
const createFirm = asyncHandler(async (req, res) => {
    const body = req.body;

    if (body.gstin) {
        const exists = await isFirmExistWithGst(body.gstin);
        if (exists) throw new ApiError({ statusCode: 409, message: 'Firm with this GSTIN already exists.' });
    } else {
        const exists = await isFirmExistWithNameAndPhone(body.firmName, body.phoneNumber);
        if (exists) throw new ApiError({ statusCode: 409, message: 'Firm with same name and phone already exists.' });
    }

    // Create firm
    const firmData = {
        firm_name: body.firmName,
        trade_name: body.tradeName,
        firm_type: body.firmType,
        business_activity: body.businessActivity,
        logo_url: body.logoUrl,
        gstin: body.gstin,
        pan_number: body.panNumber,
        cin_number: body.cinNumber,
        tan_number: body.tanNumber,
        invoice_prefix: body.invoicePrefix,
        invoice_start_number: body.invoiceStartNumber,
        notes_footer: body.notesFooter,
    }
    const firmId = await insertFirm(firmData);

    // When firm is not created
    if (!firmId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating firm' })
    }

    // Create address
    const firmAddress = {
        entity_type: 'firm',
        entity_id: firmId,
        email: body.email,
        phone_number: body.phoneNumber,
        website: body.website,
        address_line1: body.addressLine1,
        city_id: body.cityId,
        state_id: body.stateId,
        pincode: body.pincode,
        country: body.country,
    }
    const addressId = await insertAddress(firmAddress);

    // When address is not created
    if (!addressId) {
        throw new ApiError({ statusCode: 500, message: 'Unable to create address for firm' })
    }

    // Create bank account
    const bankAccount = {
        firm_id: firmId,
        upi_id: body.upiId,
        account_holder_name: body.accountHolderName,
        account_number: body.accountNumber,
        ifsc_code: body.ifscCode,
        bank_name: body.bankName,
        branch_name: body.branchName,
        account_type: body.accountType,
    }
    const bankAccountId = await insertBankAccount(bankAccount);

    // When bank account is not created
    if (!bankAccountId) {
        throw new ApiError({ statusCode: 500, message: 'Unable to create bank account for firm' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Firm created successfully.' }))
});

// Update firm
const updateFirm = asyncHandler(async (req, res) => {
    const { id: firmId } = req.params;
    const body = req.body;
    const { addressId, bankAccountId } = body;

    // Check if firm exists
    const firmExist = await fetchFirmById(firmId);
    if (!firmExist) {
        throw new ApiError({ statusCode: 404, message: 'Firm with this ID does not exist.' });
    }

    // Prevent duplicate firm (based on GSTIN or (firmName + phoneNumber))
    if (body.gstin) {
        const exists = await isFirmExistWithGst(body.gstin, firmId);
        if (exists) {
            throw new ApiError({ statusCode: 409, message: 'Another firm with this GSTIN already exists.' });
        }
    } else {
        const exists = await isFirmExistWithNameAndPhone(body.firmName, body.phoneNumber, firmId);
        if (exists) {
            throw new ApiError({ statusCode: 409, message: 'Another firm with same name and phone exists.' });
        }
    }

    // Prepare firm update data
    const firmData = {
        firm_name: body.firmName,
        trade_name: body.tradeName,
        firm_type: body.firmType,
        business_activity: body.businessActivity,
        logo_url: body.logoUrl,
        gstin: body.gstin,
        pan_number: body.panNumber,
        cin_number: body.cinNumber,
        tan_number: body.tanNumber,
        invoice_prefix: body.invoicePrefix,
        invoice_start_number: body.invoiceStartNumber,
        notes_footer: body.notesFooter,
    };

    // Update firm by ID
    const updated = await updateFirmById(firmId, firmData);
    if (!updated) {
        throw new ApiError({ statusCode: 500, message: 'Failed to update firm.' });
    }

    // Prepare address update data
    const firmAddress = {
        email: body.email,
        phone_number: body.phoneNumber,
        website: body.website,
        address_line1: body.addressLine1,
        city_id: body.cityId,
        state_id: body.stateId,
        pincode: body.pincode,
        country: body.country,
    }

    // Update address or contact details
    const updatedAddress = await updateAddressByEntity(addressId, firmAddress);
    if (!updatedAddress) {
        throw new ApiError({ statusCode: 500, message: 'Failed to update address.' });
    }

    // Prepare bank account update data
    const bankAccount = {
        upi_id: body.upiId,
        account_holder_name: body.accountHolderName,
        account_number: body.accountNumber,
        ifsc_code: body.ifscCode,
        bank_name: body.bankName,
        branch_name: body.branchName,
        account_type: body.accountType,
    }

    // Update bank account
    const updatedBank = await updateBankAccountByFirmId(bankAccountId, bankAccount);
    if (!updatedBank) {
        throw new ApiError({ statusCode: 500, message: 'Failed to update bank account.' });
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Firm updated successfully.' }));
});

// Delete firm
const deleteFirm = asyncHandler(async (req, res) => {
    const { id: firmId } = req.params;
    const { isPermanentDelete } = req.query;

    // Check if firm exists
    const firmExist = await fetchFirmById(firmId);

    if (!firmExist) {
        throw new ApiError({ statusCode: 404, message: 'Firm with this ID does not exist.' });
    }

    // Delete bank account associated with the firm
    const deleteBankAccount = await deleteBankAccountByFirmId(firmId, isPermanentDelete);
    if (!deleteBankAccount) {
        throw new ApiError({ statusCode: 500, message: 'Failed to delete firm bank account.' });
    }

    // Delete address associated with the firm
    const deleteAddress = await deleteAddressByFirmId(firmId, isPermanentDelete);
    if (!deleteAddress) {
        throw new ApiError({ statusCode: 500, message: 'Failed to delete firm address.' });
    }

    // Delete firm by ID
    const deleted = await deleteFirmtById(firmId, isPermanentDelete);
    if (!deleted) {
        throw new ApiError({ statusCode: 500, message: 'Failed to delete firm.' });
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Firm deleted successfully.' }));
});

// Get firm types
const getFirmType = asyncHandler(async (req, res) => {
    // Propritership
    // Partnership
    // LLP, etc

    // Fetch firm types from the database
    const firmTypes = await fetchFirmTypes();
    if (!firmTypes) {
        throw new ApiError({ statusCode: 404, message: 'No firm types found.' });
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: firmTypes, message: 'Firm types fetched successfully.' }));
});

module.exports = {
    getAllFirm,
    createFirm,
    updateFirm,
    deleteFirm,
    getFirmType
}