const { getContext } = require("../helpers/requestContext");
const { db } = require("../database");
const { 
    fetchAllPurchaseOrder, 
    fetchPurchaseOrderById, 
    fetchPurchaseOrderByInvoiceId, 
    insertPurchaseOrder, 
    updatePurchaseOrderById, 
    deletePurchaseOrderById, 
    bulkDeletePurchaseOrders: bulkDeletePurchaseOrdersModel, 
    restorePurchaseOrderById, 
    bulkRestorePurchaseOrders: bulkRestorePurchaseOrdersModel, 
    fetchPurchaseOrderMeta,
    fetchPurchaseOrderSummary 
} = require("../models/purchaseOrder.model");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");
const { verifyRecordOwnership } = require("../middlewares/authorize.middleware");

// Fetch all purchase orders with pagination and search
const getAllPurchaseOrder = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '', status, trash = false, startDate = '', endDate = '' } = req.query;

    const purchaseOrder = await fetchAllPurchaseOrder({ page, pageSize, search, status, trash, startDate, endDate });

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

// Fetch purchase order executive financial summary
const getPurchaseOrderSummary = asyncHandler(async (req, res) => {
    const result = await fetchPurchaseOrderSummary(req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Purchase order summary fetched successfully.'
        })
    );
});

// Fetch purchase order by ID
const getPurchaseOrderById = asyncHandler(async (req, res) => {
    const poId = req.params.id;

    const purchaseOrder = await fetchPurchaseOrderById(poId);

    if (!purchaseOrder) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found.' });
    }

    verifyRecordOwnership(req.user, purchaseOrder, 'Purchase Order');

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
    const { includeUnmappedPurchaseOrders, partyId } = req.query;

    // Fetch all purchase orders for the given invoice ID or unmapped
    const purchaseOrder = await fetchPurchaseOrderByInvoiceId(invoiceId, includeUnmappedPurchaseOrders, partyId);

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
    const { firmId, branchId } = getContext();
    const body = req.body;

    if (!firmId) {
        throw new ApiError({
            statusCode: 400,
            message: 'Firm context is required to create a purchase order. Please select an issuing firm.'
        });
    }

    let resolvedFirmBranchId = body.firmBranchId ? Number(body.firmBranchId) : (branchId ? Number(branchId) : null);
    if (!resolvedFirmBranchId && firmId) {
        const defaultBranch = await db('firm_branches').where({ firm_id: firmId, is_head_office: true, is_active: true, is_deleted: false }).first();
        if (defaultBranch) resolvedFirmBranchId = defaultBranch.id;
    }

    // Create purchase order data
    const poData = {
        po_no: body.poNo,
        po_date: body.poDate,
        customer_name: body.customerName,
        party_id: body.partyId ? Number(body.partyId) : null,
        party_branch_id: body.partyBranchId ? Number(body.partyBranchId) : null,
        billing_address: body.billingAddress || null,
        delivery_address: body.deliveryAddress || null,
        delivery_due_date: body.deliveryDueDate || null,
        valid_until: body.validUntil || null,
        payment_terms: body.paymentTerms || null,
        advance_percentage: body.advancePercentage !== undefined ? Number(body.advancePercentage) : 0,
        firm_id: firmId,
        firm_branch_id: resolvedFirmBranchId,
        status: body.status || 'OPEN',
        notes: body.notes || null
    };

    const poId = await insertPurchaseOrder(poData, body.items || []);

    if (!poId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating purchase order' });
    }

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

    const existing = await fetchPurchaseOrderById(poId);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found.' });
    }
    verifyRecordOwnership(req.user, existing, 'Purchase Order');

    const updatedData = {
        firm_branch_id: body.firmBranchId !== undefined ? (body.firmBranchId ? Number(body.firmBranchId) : null) : undefined,
        party_id: body.partyId !== undefined ? (body.partyId ? Number(body.partyId) : null) : undefined,
        party_branch_id: body.partyBranchId !== undefined ? (body.partyBranchId ? Number(body.partyBranchId) : null) : undefined,
        po_no: body.poNo,
        po_date: body.poDate,
        customer_name: body.customerName,
        billing_address: body.billingAddress,
        delivery_address: body.deliveryAddress,
        delivery_due_date: body.deliveryDueDate,
        valid_until: body.validUntil,
        payment_terms: body.paymentTerms,
        advance_percentage: body.advancePercentage !== undefined ? Number(body.advancePercentage) : undefined,
        status: body.status,
        notes: body.notes
    };

    // Remove undefined values
    Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

    const affectedRows = await updatePurchaseOrderById(poId, updatedData, body.items);

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

    const existing = await fetchPurchaseOrderById(poId, permanent);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found or already deleted' });
    }
    verifyRecordOwnership(req.user, existing, 'Purchase Order');

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

    const existing = await fetchPurchaseOrderById(poId, true);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Purchase order not found in Trash or restore failed' });
    }
    verifyRecordOwnership(req.user, existing, 'Purchase Order');

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
    getPurchaseOrderSummary,
    getPurchaseOrderById,
    getPurchaseOrderByInvoiceId,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    restorePurchaseOrder,
    bulkDeletePurchaseOrders,
    bulkRestorePurchaseOrders
};