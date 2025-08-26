const { getContext } = require("../helpers/requestContext");
const { insertInvoiceChallan, deleteInvoiceChallanById, updateInvoiceChallanById, fetchInvoiceChallanById, fetchInvoiceChallansByInvoiceId, fetchInvoiceChallanMeta, fetchAllInvoiceChallans } = require("../models/invoiceChallan.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");
const TOLERANCE = 0.01; // ₹0.01 = 1 paise

// Fetch all invoice challans with pagination and search
const getAllInvoiceChallans = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '' } = req.query;

    const challans = await fetchAllInvoiceChallans({ page, pageSize, search });

    if (!challans.length) {
        throw new ApiError({ statusCode: 404, message: 'No invoice challan found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Invoice challans fetched successfully.',
            data: challans,
        })
    );
});

// Fetch invoice challan meta data for pagination
const getInvoiceChallanMeta = asyncHandler(async (req, res) => {
    const result = await fetchInvoiceChallanMeta(req.query);

    if (!result) {
        throw new ApiError({ statusCode: 404, message: 'No invoice challans found' });
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: result, message: 'Invoice challan pagination fetch successfully.' }));
});

// Fetch invoice challan by ID
const getInvoiceChallanById = asyncHandler(async (req, res) => {
    const challanId = req.params.id;

    const challan = await fetchInvoiceChallanById(challanId);

    if (!challan) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: challan,
            message: 'Invoice challan fetched successfully.',
        })
    );
});

// Fetch invoice challans by invoice ID
const getInvoiceChallansByInvoiceId = asyncHandler(async (req, res) => {
    const invoiceId = req.params.invoiceId;
    const challans = await fetchInvoiceChallansByInvoiceId(invoiceId);

    if (!challans.length) {
        throw new ApiError({
            statusCode: 404,
            message: 'No challans found for the given invoice ID.',
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: challans,
            message: 'Invoice challans fetched successfully.',
        })
    );
});

// Create firm
const createInvoiceChallan = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const body = req.body;

    // Create firm
    const challanData = {
        invoice_id: body.invoiceId,
        challan_no: body.challanNo,
        challan_date: body.challanDate,
        customer_name: body.customerName,
        firm_id: firmId,
        is_invoiced: body.isInvoiced
    }
    const challanId = await insertInvoiceChallan(challanData);

    // If challanId is not returned, throw an error
    if (!challanId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating invoice challan' })
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice challan created successfully.' })
    )
});

const updateInvoiceChallan = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();

    const challanId = req.params.id;
    const body = req.body;

    const updatedData = {
        invoice_id: body.invoiceId,
        challan_no: body.challanNo,
        challan_date: body.challanDate,
        customer_name: body.customerName,
        firm_id: firmId,
        is_invoiced: body.isInvoiced,
    };

    const affectedRows = await updateInvoiceChallanById(challanId, updatedData);

    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice challan updated successfully.' })
    );
});

const deleteInvoiceChallan = asyncHandler(async (req, res) => {
    const challanId = req.params.id;
    const { isPermanentDelete = false } = req.query;

    // delete invoice challan by ID
    const deleted = await deleteInvoiceChallanById(challanId, isPermanentDelete);

    // If no rows were affected, it means the invoice challan was not found or already deleted
    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice challan deleted successfully.' })
    );
});


module.exports = {
    getAllInvoiceChallans,
    getInvoiceChallanMeta,
    getInvoiceChallanById,
    getInvoiceChallansByInvoiceId,
    createInvoiceChallan,
    updateInvoiceChallan,
    deleteInvoiceChallan
}