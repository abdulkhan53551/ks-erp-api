const { getContext } = require("../helpers/requestContext");
const { fetchAllPurchaseOrder, fetchPurchaseOrderById, fetchPurchaseOrderByInvoiceId, insertPurchaseOrder, updatePurchaseOrderById, deletePurchaseOrderById, bulkDeletePurchaseOrders: bulkDeletePurchaseOrdersModel, restorePurchaseOrderById, bulkRestorePurchaseOrders: bulkRestorePurchaseOrdersModel, fetchPurchaseOrderMeta } = require("../models/purchaseOrder.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");

// Fetch all purchase orders with pagination and search
const getAllPurchaseOrder = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '', status, trash = false } = req.query;

    const purchaseOrder = await fetchAllPurchaseOrder({ page, pageSize, search, status, trash });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: purchaseOrder.length ? 'Purchase order fetched successfully.' : 'No purchase order found.',
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
    const invoiceId = req.params.invoiceId;
    const { includeUnmappedPurchaseOrders } = req.query;

    // Fetch all challans for the given invoice ID
    const purchaseOrder = await fetchPurchaseOrderByInvoiceId(invoiceId, includeUnmappedPurchaseOrders);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: purchaseOrder,
            message: purchaseOrder.length > 0 ? 'Purchase order fetched successfully.' : 'No purchase order found for the given invoice ID.',
        })
    );
});

// Create a new purchase order
const createPurchaseOrder = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const body = req.body;

    // Create purchase order
    const poData = {
        po_no: body.poNo,
        po_date: body.poDate,
        customer_name: body.customerName,
        firm_id: firmId,
        status: body.status || 'OPEN'
    };

    const poId = await insertPurchaseOrder(poData);

    // If poId is not returned, throw an error
    if (!poId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating purchase order' });
    }

    // Response
    const response = {
        id: poId
    };

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: response, message: 'Purchase order created successfully.' })
    );
});

const updatePurchaseOrder = asyncHandler(async (req, res) => {
    const poId = req.params.id;
    const body = req.body;

    const updatedData = {
        po_no: body.poNo,
        po_date: body.poDate,
        customer_name: body.customerName,
        status: body.status
    };

    // Remove undefined values
    Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

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
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    // Delete purchase order by ID
    const deleted = await deletePurchaseOrderById(poId, permanent);

    // If no rows were affected, it means the purchase order was not found or already deleted
    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(poId) },
            message: permanent ? 'Purchase order permanently deleted successfully.' : 'Purchase order moved to Trash successfully.'
        })
    );
});

// Restore purchase order by ID
const restorePurchaseOrder = asyncHandler(async (req, res) => {
    const poId = req.params.id;

    const restored = await restorePurchaseOrderById(poId);

    if (!restored) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found in Trash or restore failed' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(poId) },
            message: 'Purchase order restored from Trash successfully.'
        })
    );
});

// Bulk delete purchase orders
const bulkDeletePurchaseOrders = asyncHandler(async (req, res) => {
    const { ids = [], isPermanentDelete = false } = req.body;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await bulkDeletePurchaseOrdersModel(ids, permanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: permanent
                ? `${affectedRows} purchase orders permanently deleted successfully.`
                : `${affectedRows} purchase orders moved to Trash successfully.`
        })
    );
});

// Bulk restore purchase orders
const bulkRestorePurchaseOrders = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;

    const affectedRows = await bulkRestorePurchaseOrdersModel(ids);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: `${affectedRows} purchase orders restored from Trash successfully.`
        })
    );
});

module.exports = {
    getAllPurchaseOrder,
    getPurchaseOrderMeta,
    getPurchaseOrderById,
    getPurchaseOrderByInvoiceId,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    restorePurchaseOrder,
    bulkDeletePurchaseOrders,
    bulkRestorePurchaseOrders
};