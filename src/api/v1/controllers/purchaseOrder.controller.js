const { fetchAllPurchaseOrder, fetchPurchaseOrderById, fetchPurchaseOrderByInvoiceId, insertPurchaseOrder, updatePurchaseOrderById, deletePurchaseOrderById, fetchPurchaseOrderMeta } = require("../models/purchaseOrder.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");

// Fetch all purchase orders with pagination and search
const getAllPurchaseOrder = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '' } = req.query;

    const purchaseOrder = await fetchAllPurchaseOrder({ page, pageSize, search });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Purchase order fetched successfully.',
            data: purchaseOrder,
        })
    );
});

// Fetch purchase order meta data for pagination
const getPurchaseOrderMeta = asyncHandler(async (req, res) => {
    const result = await fetchPurchaseOrderMeta(req.query);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: result, message: 'Purchase order pagination fetch successfully.' }));
});

// Fetch purchase order by ID
const getPurchaseOrderById = asyncHandler(async (req, res) => {
    const poId = req.params.id;

    const purchaseOrder = await fetchPurchaseOrderById(poId);

    if (!purchaseOrder) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: purchaseOrder,
            message: 'Purchase order fetched successfully.',
        })
    );
});

// Fetch purchase orders by invoice ID
const getPurchaseOrderByInvoiceId = asyncHandler(async (req, res) => {
    const invoiceId = req.params.invoice_id;

    // Fetch all challans for the given invoice ID
    const purchaseOrder = await fetchPurchaseOrderByInvoiceId(invoiceId);

    // If no purchase order is found, throw an error
    if (!purchaseOrder) {
        throw new ApiError({
            statusCode: 404,
            message: 'No purchase order found for the given invoice ID.',
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: challans,
            message: 'Purchase order fetched successfully.',
        })
    );
});

// Create a new purchase order
const createPurchaseOrder = asyncHandler(async (req, res) => {
    const body = req.body;

    // Create purchase order
    const poData = {
        invoice_id: body.invoiceId,
        po_no: body.po_no,
        po_date: body.po_date,
        customer_name: body.customerName,
        firm_id: body.firmId,
        is_invoiced: body.isInvoiced
    }
    const challanId = await insertPurchaseOrder(poData);

    // If challanId is not returned, throw an error
    if (!challanId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating purchase order' })
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Purchase order created successfully.' })
    )
});

const updatePurchaseOrder = asyncHandler(async (req, res) => {
    const poId = req.params.id;
    const body = req.body;

    const updatedData = {
        invoice_id: body.invoiceId,
        po_no: body.po_no,
        po_date: body.po_date,
        customer_name: body.customerName,
        firm_id: body.firmId,
        is_invoiced: body.isInvoiced
    }

    // Update purchase order
    const affectedRows = await updatePurchaseOrderById(poId, updatedData);

    // If no rows were affected, it means the purchase order was not found or update failed
    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Purchase order updated successfully.' })
    );
});

const deletePurchaseOrder = asyncHandler(async (req, res) => {
    const poId = req.params.id;
    const { isPermanentDelete = false } = req.query;

    // Delete purchase order by ID
    const deleted = await deletePurchaseOrderById(poId, isPermanentDelete);

    // If no rows were affected, it means the purchase order was not found or already deleted
    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Purchase order deleted successfully.' })
    );
});

module.exports = {
    getAllPurchaseOrder,
    getPurchaseOrderMeta,
    getPurchaseOrderById,
    getPurchaseOrderByInvoiceId,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder
}