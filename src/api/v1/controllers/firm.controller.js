const { isFirmExistWithGst, isFirmExistWithNameAndPhone, insertFirm, insertAddress, insertBankAccount } = require("../models/firm.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");

// Get all firm
const getAllFirm = asyncHandler(async (req, res) => {

});

// Create firm
const createFirm = asyncHandler(async (req, res) => {
    const { userName, email, password } = req.body;

    if (body.gstin) {
        const exists = await isFirmExistWithGst(body.gstin);
        if (exists) throw new ApiError({ statusCode: 409, message: 'Role or Permission not found.' });
    } else {
        const exists = await isFirmExistWithNameAndPhone(body.firmName, body.phoneNumber);
        if (exists) throw new ApiError({ statusCode: 409, message: 'Firm with same name and phone already exists.' });
    }

    // Create firm
    const firmData = {
        firm_name: body.firmName,
        trade_name: body.firmName,
        firm_type: body.firmType,
        business_activity: body.businessActivity,
        logo_url: body.businessActivity,
        gstin: body.gstin,
        pan_number: body.panNumber,
        cin_number: body.cinNumber,
        tan_number: body.tanNumber,
        invoice_prefix: body.email,
        invoice_start_number: body.email,
        notes_footer: body.email,
    }
    const firmId = await insertFirm(firmData);

    // When firm is not created
    if (!firmId) {
        // Handle the case when the role is not created
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating firm' })
    }

    // Create address
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

});

// Delete firm
const deleteFirm = asyncHandler(async (req, res) => {

});

// Get firm type
const getFirmType = asyncHandler(async (req, res) => {
    // Propritership
    // Partnership
    // LLP, etc
});

module.exports = {
    getAllFirm,
    createFirm,
    updateFirm,
    deleteFirm,
    getFirmType
}