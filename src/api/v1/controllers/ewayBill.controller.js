const { getContext } = require("../helpers/requestContext");
const { fetchAllEwayBill, fetchEwayBillMeta, fetchEwayBillById, fetchEwayBillByInvoiceId, insertEwayBill, updateEwayBillById, deleteEwayBillById } = require("../models/ewayBill.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");

// Fetch all eway bill with pagination and search
const getAllEwayBill = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '' } = req.query;

    const result = await fetchAllEwayBill({ page, pageSize, search });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: result.length ? 'Eway bill fetched successfully.' : 'No eway bill found.',
            data: result,
        })
    );
});

// Fetch eway bill meta data for pagination
const getEwayBillMeta = asyncHandler(async (req, res) => {
    const result = await fetchEwayBillMeta(req.query);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: result, message: 'Eway bill pagination fetch successfully.' }));
});

// Fetch eway bill by ID
const getEwayBillById = asyncHandler(async (req, res) => {
    const poId = req.params.id;

    const result = await fetchEwayBillById(poId);

    if (!result) {
        throw new ApiError({ statusCode: 404, message: 'Eway bill not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Eway bill fetched successfully.',
        })
    );
});

// Fetch eway bill by invoice ID
const getEwayBillByInvoiceId = asyncHandler(async (req, res) => {
    const invoiceId = req.params.invoiceId;
    const { includeUnmappedEwayBills } = req.query;

    // Fetch all challans for the given invoice ID
    const result = await fetchEwayBillByInvoiceId(invoiceId, includeUnmappedEwayBills);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: result.length > 0 ? 'Eway bill fetched successfully.' : 'No eway bill found for the given invoice ID.',
        })
    );
});

// Create a new eway bill
const createEwayBill = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const body = req.body;

    const data = {
        invoice_id: body.invoiceId || null,
        eway_bill_no: body.ewayBillNo,
        eway_bill_date: body.ewayBillDate,
        valid_upto: body.ewaybillValidUpto,
        customer_name: body.customerName,
        firm_id: firmId
    };

    const ewayBillId = await insertEwayBill(data);

    if (!ewayBillId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating eway bill' });
    }

    const response = {
        id: ewayBillId
    };

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: response, message: 'Eway bill created successfully.' })
    );
});

// Update eway bill
const updateEwayBill = asyncHandler(async (req, res) => {
    const ewayId = req.params.id;
    const body = req.body;

    const updatedData = {
        invoice_id: body.invoiceId !== undefined ? body.invoiceId : undefined,
        eway_bill_no: body.ewayBillNo,
        eway_bill_date: body.ewayBillDate,
        valid_upto: body.ewaybillValidUpto,
        customer_name: body.customerName
    };

    // Remove undefined values
    Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

    const affectedRows = await updateEwayBillById(ewayId, updatedData);

    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Eway bill not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Eway bill updated successfully.' })
    );
});

const deleteEwayBill = asyncHandler(async (req, res) => {
    const poId = req.params.id;
    const { isPermanentDelete = false } = req.query;

    // Delete eway bill by ID
    const deleted = await deleteEwayBillById(poId, isPermanentDelete);

    // If no rows were affected, it means the eway bill was not found or already deleted
    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Eway bill not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Eway bill deleted successfully.' })
    );
});

module.exports = {
    getAllEwayBill,
    getEwayBillMeta,
    getEwayBillById,
    getEwayBillByInvoiceId,
    createEwayBill,
    updateEwayBill,
    deleteEwayBill
}