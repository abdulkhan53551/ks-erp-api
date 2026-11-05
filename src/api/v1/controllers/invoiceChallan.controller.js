const { getContext } = require("../helpers/requestContext");
const { db } = require("../database");
const { 
    insertInvoiceChallan, 
    deleteInvoiceChallanById, 
    bulkDeleteInvoiceChallans: bulkDeleteInvoiceChallansModel, 
    restoreInvoiceChallanById, 
    bulkRestoreInvoiceChallans: bulkRestoreInvoiceChallansModel, 
    updateInvoiceChallanById, 
    fetchInvoiceChallanById, 
    fetchInvoiceChallansByInvoiceId, 
    fetchInvoiceChallanMeta, 
    fetchAllInvoiceChallans 
} = require("../models/invoiceChallan.model");
const { generateDeliveryChallanPdf } = require("../services/deliveryChallanPdf.service");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");
const { asyncHandler } = require("../services/asyncHandler");
const { verifyRecordOwnership } = require("../middlewares/authorize.middleware");

// Fetch all invoice challans with pagination, search, and status filter
const getAllInvoiceChallans = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '', trash = false, status = '' } = req.query;

    const challans = await fetchAllInvoiceChallans({ page, pageSize, search, trash, status });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: challans.length ? 'Invoice challans fetched successfully.' : 'No invoice challan found.',
            data: challans,
        })
    );
});

// Fetch invoice challan meta data for pagination
const getInvoiceChallanMeta = asyncHandler(async (req, res) => {
    const result = await fetchInvoiceChallanMeta(req.query);

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

    verifyRecordOwnership(req.user, challan, 'Invoice Challan');

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: challan,
            message: 'Invoice challan fetched successfully.',
        })
    );
});

// Fetch invoice challans by invoice ID (with optional customer scope)
const getInvoiceChallansByInvoiceId = asyncHandler(async (req, res) => {
    const invoiceId = req.params.invoiceId;
    const { includeUnmappedChallans, partyId } = req.query;
    const challans = await fetchInvoiceChallansByInvoiceId(invoiceId, includeUnmappedChallans, partyId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: challans,
            message: challans.length > 0 ? 'Invoice challans fetched successfully.' : 'No challans found.',
        })
    );
});

// Create a new invoice challan
const createInvoiceChallan = asyncHandler(async (req, res) => {
    const { firmId, branchId } = getContext();
    const body = req.body;

    if (!firmId) {
        throw new ApiError({
            statusCode: 400,
            message: 'Firm ID is required to create a challan.'
        });
    }

    let resolvedFirmBranchId = body.firmBranchId ? Number(body.firmBranchId) : (branchId ? Number(branchId) : null);
    if (!resolvedFirmBranchId && firmId) {
        const defaultBranch = await db('firm_branches').where({ firm_id: firmId, is_head_office: true, is_active: true }).first();
        if (defaultBranch) resolvedFirmBranchId = defaultBranch.id;
    }

    const challanData = {
        invoice_id: body.invoiceId || null,
        challan_no: body.challanNo,
        challan_date: body.challanDate,
        customer_name: body.customerName,
        party_id: body.partyId || null,
        party_branch_id: body.partyBranchId || null,
        delivery_address: body.deliveryAddress || null,
        transport_mode: body.transportMode || 'Road',
        vehicle_no: body.vehicleNo || null,
        transporter_name: body.transporterName || null,
        lr_no: body.lrNo || null,
        dispatch_reason: body.dispatchReason || 'Supply on Delivery',
        status: body.status || (body.invoiceId ? 'BILLED' : 'DISPATCHED'),
        notes: body.notes || null,
        firm_id: firmId,
        firm_branch_id: resolvedFirmBranchId
    };

    const result = await insertInvoiceChallan(challanData, body.items || []);

    const challanId = typeof result === 'object' ? result.id : result;
    const finalChallanNo = typeof result === 'object' ? result.challanNo : challanData.challan_no;

    if (!challanId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating invoice challan' });
    }

    const response = {
        id: challanId,
        challanNo: finalChallanNo
    };

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: response, message: 'Invoice challan created successfully.' })
    );
});

// Update invoice challan
const updateInvoiceChallan = asyncHandler(async (req, res) => {
    const challanId = req.params.id;
    const body = req.body;

    const existing = await fetchInvoiceChallanById(challanId);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found.' });
    }
    verifyRecordOwnership(req.user, existing, 'Invoice Challan');

    const updatedData = {
        invoice_id: body.invoiceId !== undefined ? body.invoiceId : undefined,
        firm_branch_id: body.firmBranchId !== undefined ? (body.firmBranchId ? Number(body.firmBranchId) : null) : undefined,
        party_id: body.partyId !== undefined ? (body.partyId ? Number(body.partyId) : null) : undefined,
        party_branch_id: body.partyBranchId !== undefined ? (body.partyBranchId ? Number(body.partyBranchId) : null) : undefined,
        challan_date: body.challanDate,
        customer_name: body.customerName,
        delivery_address: body.deliveryAddress,
        transport_mode: body.transportMode,
        vehicle_no: body.vehicleNo,
        transporter_name: body.transporterName,
        lr_no: body.lrNo,
        dispatch_reason: body.dispatchReason,
        status: body.status,
        notes: body.notes
    };

    // Remove undefined values
    Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

    const affectedRows = await updateInvoiceChallanById(challanId, updatedData, body.items);

    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: { id: Number(challanId) }, message: 'Invoice challan updated successfully.' })
    );
});

// Delete invoice challan
const deleteInvoiceChallan = asyncHandler(async (req, res) => {
    const challanId = req.params.id;
    const { isPermanentDelete = false } = req.query;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const existing = await fetchInvoiceChallanById(challanId, permanent);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found or already deleted' });
    }
    verifyRecordOwnership(req.user, existing, 'Invoice Challan');

    const deleted = await deleteInvoiceChallanById(challanId, permanent);

    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(challanId) },
            message: permanent ? 'Invoice challan permanently deleted successfully.' : 'Invoice challan moved to Trash successfully.'
        })
    );
});

// Restore invoice challan
const restoreInvoiceChallan = asyncHandler(async (req, res) => {
    const challanId = req.params.id;

    const existing = await fetchInvoiceChallanById(challanId, true);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found in Trash or restore failed' });
    }
    verifyRecordOwnership(req.user, existing, 'Invoice Challan');

    const restored = await restoreInvoiceChallanById(challanId);

    if (!restored) {
        throw new ApiError({ statusCode: 404, message: 'Invoice challan not found in Trash or restore failed' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(challanId) },
            message: 'Invoice challan restored from Trash successfully.'
        })
    );
});

// Bulk delete invoice challans
const bulkDeleteInvoiceChallans = asyncHandler(async (req, res) => {
    const { ids = [], isPermanentDelete = false } = req.body;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await bulkDeleteInvoiceChallansModel(ids, permanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: permanent
                ? `${affectedRows} invoice challan(s) permanently deleted.`
                : `${affectedRows} invoice challan(s) moved to trash.`
        })
    );
});

// Bulk restore invoice challans
const bulkRestoreInvoiceChallans = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;

    const affectedRows = await bulkRestoreInvoiceChallansModel(ids);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: `${affectedRows} invoice challan(s) restored successfully.`
        })
    );
});

// Download / View Delivery Challan PDF
const getDeliveryChallanPdf = asyncHandler(async (req, res) => {
    const challanId = req.params.id;

    const challan = await fetchInvoiceChallanById(challanId);
    if (!challan) {
        throw new ApiError({ statusCode: 404, message: 'Delivery Challan not found.' });
    }
    verifyRecordOwnership(req.user, challan, 'Invoice Challan');

    const pdfBuffer = await generateDeliveryChallanPdf(challanId);

    const fileName = `Delivery_Challan_${challan.challan_no || challanId}`.replace(/[<>:"/\\|?*]/g, '_') + '.pdf';

    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return res.end(pdfBuffer);
});

module.exports = {
    getAllInvoiceChallans,
    getInvoiceChallanMeta,
    getInvoiceChallanById,
    getInvoiceChallansByInvoiceId,
    getDeliveryChallanPdf,
    createInvoiceChallan,
    updateInvoiceChallan,
    deleteInvoiceChallan,
    restoreInvoiceChallan,
    bulkDeleteInvoiceChallans,
    bulkRestoreInvoiceChallans
};
