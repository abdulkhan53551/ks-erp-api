const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require('../services/asyncHandler');
const {
    createVendorBill,
    fetchAllVendorBills,
    fetchVendorBillsMeta,
    fetchVendorBillsSummary,
    fetchVendorBillById,
    updateVendorBill,
    deleteVendorBill,
    fetchUnpaidVendorBillsByParty
} = require('../models/vendorBill.model');

/**
 * Record a new vendor bill
 */
const createVendorBillHandler = asyncHandler(async (req, res) => {
    const result = await createVendorBill(req.body);
    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: result,
            message: `Vendor bill #${result.bill_no} created successfully.`
        })
    );
});

/**
 * Get paginated list of vendor bills
 */
const getAllVendorBillsHandler = asyncHandler(async (req, res) => {
    const result = await fetchAllVendorBills(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: result.length ? 'Vendor bills fetched successfully.' : 'No vendor bills found.'
        })
    );
});

/**
 * Get vendor bills pagination metadata
 */
const getVendorBillsMetaHandler = asyncHandler(async (req, res) => {
    const result = await fetchVendorBillsMeta(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Vendor bills pagination metadata fetched successfully.'
        })
    );
});

/**
 * Get vendor bills summary metrics (totals, counts)
 */
const getVendorBillsSummaryHandler = asyncHandler(async (req, res) => {
    const result = await fetchVendorBillsSummary(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Vendor bills summary fetched successfully.'
        })
    );
});

/**
 * Get single vendor bill by ID
 */
const getVendorBillByIdHandler = asyncHandler(async (req, res) => {
    const result = await fetchVendorBillById(req.params.id);
    if (!result) {
        throw new ApiError({ statusCode: 404, message: 'Vendor bill not found.' });
    }
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Vendor bill details fetched successfully.'
        })
    );
});

/**
 * Update vendor bill
 */
const updateVendorBillHandler = asyncHandler(async (req, res) => {
    const result = await updateVendorBill(req.params.id, req.body);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `Vendor bill #${result.billNo} updated successfully.`
        })
    );
});

/**
 * Soft delete vendor bill
 */
const deleteVendorBillHandler = asyncHandler(async (req, res) => {
    const result = await deleteVendorBill(req.params.id);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: result.message
        })
    );
});

/**
 * Get unpaid or partially paid vendor bills by party ID (for payments allocation)
 */
const getUnpaidVendorBillsHandler = asyncHandler(async (req, res) => {
    const result = await fetchUnpaidVendorBillsByParty(req.params.partyId);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: result.length ? 'Unpaid vendor bills fetched successfully.' : 'No unpaid vendor bills found for this vendor.'
        })
    );
});

module.exports = {
    createVendorBillHandler,
    getAllVendorBillsHandler,
    getVendorBillsMetaHandler,
    getVendorBillsSummaryHandler,
    getVendorBillByIdHandler,
    updateVendorBillHandler,
    deleteVendorBillHandler,
    getUnpaidVendorBillsHandler
};
