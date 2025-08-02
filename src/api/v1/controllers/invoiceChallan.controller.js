const { insertInvoiceChallan, deleteInvoiceChallanById, updateInvoiceChallanById, fetchInvoiceChallanById } = require("../models/invoiceChallan.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");

// Fetch all invoice challans with pagination and search
const fetchAllInvoiceChallans = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '' } = req.query;

    const challans = await fetchAllInvoiceChallans({ page, pageSize, search });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Invoice challans fetched successfully.',
            data: challans,
        })
    );
});

// Fetch invoice challan by ID
const getInvoiceChallanById = asyncHandler(async (req, res) => {
    const challanId = req.params.id;

    const challan = await fetchchall(challanId);

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
    const invoiceId = req.params.invoice_id;

    const challans = await fetchInvoiceChallanById(invoiceId);

    if (!challans) {
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
    const body = req.body;

    // Create firm
    const challanData = {
        invoice_id: body.invoiceId,
        challan_no: body.challanNo,
        challan_date: body.challanDate,
        customer_name: body.customerName,
        firm_id: body.firmId,
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
    const challanId = req.params.id;
    const body = req.body;

    const updatedData = {
        invoice_id: body.invoiceId,
        challan_no: body.challanNo,
        challan_date: body.challanDate,
        customer_name: body.customerName,
        firm_id: body.firmId,
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

    const deleted = await deleteInvoiceChallanById(challanId);

    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice challan deleted successfully.' })
    );
});


module.exports = {
    fetchAllInvoiceChallans,
    getInvoiceChallanById,
    getInvoiceChallansByInvoiceId,
    createInvoiceChallan,
    updateInvoiceChallan,
    deleteInvoiceChallan
}