const { isFirmExistWithGst, isFirmExistWithNameAndPhone, insertFirm, insertAddress, insertBankAccount, updateFirmById, updateAddressByEntity, updateBankAccountByFirmId, deleteFirmtById, deleteAddressByFirmId, deleteBankAccountByFirmId, fetchFirmTypes, fetchAllFirm, fetchFirmById, fetchFirmMeta } = require("../models/firm.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");
const { uploadOnCloudinary, deleteFromCloudinary } = require("../services/cloudinary");
const { db } = require("../database");

// Get all firm
const getAllFirm = asyncHandler(async (req, res) => {
    const firms = await fetchAllFirm(req.query);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: firms, message: firms.length ? 'Firms fetched successfully.' : 'No firms found.' }));
});

// Get firm meta data for pagination
const getFirmMeta = asyncHandler(async (req, res) => {
    // Fetch firm meta data for pagination
    const result = await fetchFirmMeta(req.query);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: result, message: 'Firm pagination fetch successfully.' }));
});

// Get firm by ID
const getFirmById = asyncHandler(async (req, res) => {
    const { id: firmId } = req.params;

    // Fetch firm by ID
    const firm = await fetchFirmById(firmId);

    // Check if firm exists
    if (!firm) {
        throw new ApiError({ statusCode: 404, message: 'Firm with this ID does not exist.' });
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: firm, message: 'Firm fetched successfully.' }));
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
        logo_url: body.logoUrl || null,
        logo_public_id: body.logoPublicId || null,
        gstin: body.gstin,
        pan_number: body.panNumber,
        cin_number: body.cinNumber,
        tan_number: body.tanNumber,
        invoice_prefix: body.invoicePrefix,
        invoice_start_number: body.invoiceStartNumber,
        notes_footer: body.notesFooter,
    };
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

    const response = {
        id: firmId
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: response, message: 'Firm created successfully.' }))
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
        gstin: body.gstin,
        pan_number: body.panNumber,
        cin_number: body.cinNumber,
        tan_number: body.tanNumber,
        invoice_prefix: body.invoicePrefix,
        invoice_start_number: body.invoiceStartNumber,
        notes_footer: body.notesFooter,
    };

    if (body.logoUrl !== undefined) firmData.logo_url = body.logoUrl || null;
    if (body.logoPublicId !== undefined) firmData.logo_public_id = body.logoPublicId || null;

    // Check if logo is being replaced or removed and clean up previous Cloudinary asset
    const existingLogoPublicId = firmExist.logoPublicId || firmExist.logo_public_id;
    if (existingLogoPublicId) {
        const isLogoReplaced = body.logoPublicId !== undefined && body.logoPublicId !== existingLogoPublicId;
        const isLogoCleared = (body.logoUrl === '' || body.logoUrl === null) && !body.logoPublicId;
        if (isLogoReplaced || isLogoCleared) {
            try {
                await deleteFromCloudinary(existingLogoPublicId, 'image');
            } catch (err) {
                console.warn('Failed to delete old firm logo from Cloudinary:', err);
            }
        }
    }

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
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    // Check if firm exists
    const firmExist = await fetchFirmById(firmId);

    if (!firmExist) {
        throw new ApiError({ statusCode: 404, message: 'Firm with this ID does not exist.' });
    }

    // When permanently deleting, clean up attachments and logo from Cloudinary and DB
    if (permanent) {
        const logoPublicId = firmExist.logoPublicId || firmExist.logo_public_id;
        if (logoPublicId) {
            try {
                await deleteFromCloudinary(logoPublicId, 'image');
            } catch (err) {
                console.warn('Failed to delete firm logo from Cloudinary:', err);
            }
        }

        // Fetch attachments associated with this firm
        const attachments = await db('attachments')
            .select('public_id', 'resource_type')
            .where({ entity_type: 'FIRM', entity_id: firmId });

        await db('attachments').where({ entity_type: 'FIRM', entity_id: firmId }).del();

        for (const att of attachments) {
            if (att.public_id) {
                try {
                    await deleteFromCloudinary(att.public_id, att.resource_type || 'image');
                } catch (err) {
                    console.warn(`Failed to destroy attachment ${att.public_id}:`, err);
                }
            }
        }
    }

    // Delete bank account associated with the firm
    const deleteBankAccount = await deleteBankAccountByFirmId(firmId, permanent);
    if (!deleteBankAccount) {
        throw new ApiError({ statusCode: 500, message: 'Failed to delete firm bank account.' });
    }

    // Delete address associated with the firm
    const deleteAddress = await deleteAddressByFirmId(firmId, permanent);
    if (!deleteAddress) {
        throw new ApiError({ statusCode: 500, message: 'Failed to delete firm address.' });
    }

    // Delete firm by ID
    const deleted = await deleteFirmtById(firmId, permanent);
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

// Upload firm logo
const uploadFirmLogo = asyncHandler(async (req, res) => {
    const { id: firmId } = req.params;

    // Check firm exists
    const firm = await fetchFirmById(firmId);

    if (!firm) {
        throw new ApiError({
            statusCode: 404,
            message: "Firm not found. While uploading logo.",
        });
    }

    // Get uploaded file
    const logoLocalPath = req.files?.logo?.[0]?.path;

    if (!logoLocalPath) {
        throw new ApiError({
            statusCode: 400,
            message: "Logo file is required.",
        });
    }

    // Upload to Cloudinary
    const uploadedLogo = await uploadOnCloudinary(logoLocalPath);

    if (!uploadedLogo?.url) {
        throw new ApiError({
            statusCode: 500,
            message: "Failed to upload logo.",
        });
    }

    // Delete old logo if exists
    // if (firm.logo_url) {
    //     try {
    //         await deleteFromCloudinary(firm.logo_url);
    //     } catch (err) {
    //         console.error("Old logo deletion failed:", err.message);
    //     }
    // }

    // Save new logo
    const updated = await updateFirmById(firmId, {
        logo_url: uploadedLogo.url,
    });

    if (!updated) {
        throw new ApiError({
            statusCode: 500,
            message: "Failed to save logo.",
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: {
                logoUrl: uploadedLogo.url,
            },
            message: "Firm logo uploaded successfully.",
        })
    );
});

// Delete firm logo
const deleteFirmLogo = asyncHandler(async (req, res) => {
    const { id: firmId } = req.params;

    const firm = await fetchFirmById(firmId);

    if (!firm) {
        throw new ApiError({
            statusCode: 404,
            message: "Firm not found.",
        });
    }

    if (firm.logo_url) {
        try {
            await deleteFromCloudinary(firm.logo_url);
        } catch (err) {
            console.error(err);
        }
    }

    await updateFirmById(firmId, {
        logo_url: null,
    });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: [],
            message: "Firm logo deleted successfully.",
        })
    );
});

module.exports = {
    getAllFirm,
    getFirmMeta,
    getFirmById,
    createFirm,
    updateFirm,
    deleteFirm,
    getFirmType,
    uploadFirmLogo,
    deleteFirmLogo
}