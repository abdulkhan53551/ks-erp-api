const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { getContext } = require('../helpers/requestContext');
const { verifyRecordOwnership } = require('../middlewares/authorize.middleware');
const {
    fetchAllProformaInvoices,
    fetchProformaInvoicePagination,
    fetchProformaInvoiceById,
    fetchNextExpectedProformaNumber,
    saveProformaInvoice,
    updateProformaInvoice,
    deleteProformaInvoice,
    restoreProformaInvoice,
    bulkDeleteProformaInvoices,
    bulkRestoreProformaInvoices,
    markProformaConvertedToInvoice
} = require('../models/proformaInvoice.model');
const { generateProformaPdf } = require('../services/proformaInvoicePdf.service');

// Helper to normalize incoming request payload
const normalizeProformaPayload = (body) => {
    const b = body || {};

    const items = Array.isArray(b.items)
        ? b.items.map(item => ({
            id: item.id,
            product_id: item.productId ?? null,
            item_name: item.itemName,
            description: item.description ?? null,
            drawing_number: item.drawingNumber ?? null,
            hsn_sac_code: item.hsnSacCode ?? null,
            qty: item.qty,
            unit: item.unit || 'Nos',
            rate: item.rate,
            discount_percent: item.discountPercent ?? 0,
            discount_amount: item.discountAmount ?? 0,
            sub_total: item.subTotal ?? 0,
            taxable_amount: item.taxableAmount ?? 0,
            gst_slab_id: item.gstSlabId ?? null,
            tax_rate: item.taxRate ?? 18.00,
            cgst: item.cgst ?? 0,
            sgst: item.sgst ?? 0,
            igst: item.igst ?? 0,
            total: item.total ?? 0,
            sort_order: item.sortOrder ?? 0
        }))
        : undefined;

    return {
        firm_id: b.firmId,
        firm_branch_id: b.firmBranchId,
        party_id: b.partyId,
        party_branch_id: b.partyBranchId,
        proforma_no: b.proformaNo,
        proforma_date: b.proformaDate,
        due_days: b.dueDays,
        due_date: b.dueDate,
        order_ref_no: b.orderRefNo,
        order_ref_date: b.orderRefDate,
        quotation_id: b.quotationId,
        tax_invoice_id: b.taxInvoiceId,
        customer_name: b.customerName,
        has_gst: b.hasGst,
        gst_number: b.gstNumber,
        contact_person: b.contactPerson,
        contact_email: b.contactEmail,
        contact_phone: b.contactPhone,
        billing_address: b.billingAddress,
        shipping_address: b.shippingAddress,
        place_of_supply: b.placeOfSupply,
        dispatch_through: b.dispatchThrough,
        destination: b.destination,
        payment_terms: b.paymentTerms,
        delivery_period: b.deliveryPeriod,
        freight_basis: b.freightBasis,
        warranty_terms: b.warrantyTerms,
        special_notes: b.specialNotes,
        terms_and_conditions: b.termsAndConditions,
        sub_total: b.subTotal,
        discount_percent: b.discountPercent,
        discount_amount: b.discountAmount,
        taxable_amount: b.taxableAmount,
        cgst: b.cgst,
        sgst: b.sgst,
        igst: b.igst,
        other: b.other,
        round_off: b.roundOff,
        total: b.total,
        advance_amount_requested: b.advanceAmountRequested,
        advance_received: b.advanceReceived,
        status: b.status,
        cancel_reason: b.cancelReason,
        notes: b.notes,
        items
    };
};

// GET /api/v1/proforma-invoices
const getAllProformaInvoicesController = asyncHandler(async (req, res) => {
    const data = await fetchAllProformaInvoices(req.query);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data,
        message: 'Proforma Invoices fetched successfully.'
    }));
});

// GET /api/v1/proforma-invoices/pagination
const getProformaInvoicePaginationController = asyncHandler(async (req, res) => {
    const data = await fetchProformaInvoicePagination(req.query);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data,
        message: 'Proforma Invoices pagination metadata fetched successfully.'
    }));
});

// GET /api/v1/proforma-invoices/next-number
const getNextExpectedProformaNumberController = asyncHandler(async (req, res) => {
    const { firmId } = getContext();
    if (!firmId || firmId <= 0) {
        throw new ApiError({
            statusCode: 400,
            message: 'Active firm context is required to determine next proforma invoice number.'
        });
    }

    const nextNumber = await fetchNextExpectedProformaNumber(firmId);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: nextNumber,
        message: 'Next proforma invoice sequence number calculated.'
    }));
});

// GET /api/v1/proforma-invoices/:id
const getProformaInvoiceByIdController = asyncHandler(async (req, res) => {
    const data = await fetchProformaInvoiceById(req.params.id);
    if (!data) {
        throw new ApiError({ statusCode: 404, message: 'Proforma Invoice not found.' });
    }
    verifyRecordOwnership(req.user, data, 'Proforma Invoice');

    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data,
        message: 'Proforma Invoice details fetched successfully.'
    }));
});

// POST /api/v1/proforma-invoices
const createProformaInvoiceController = asyncHandler(async (req, res) => {
    const payload = normalizeProformaPayload(req.body);
    const { firmId } = getContext();
    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Active firm context is required to create a proforma invoice.' });
    }
    payload.firm_id = firmId;

    const created = await saveProformaInvoice(payload);
    res.status(201).json(new ApiResponse({
        statusCode: 201,
        data: created,
        message: 'Proforma Invoice created successfully.'
    }));
});

// PUT /api/v1/proforma-invoices/:id
const updateProformaInvoiceController = asyncHandler(async (req, res) => {
    const existing = await fetchProformaInvoiceById(req.params.id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Proforma Invoice not found.' });
    }
    verifyRecordOwnership(req.user, existing, 'Proforma Invoice');

    const payload = normalizeProformaPayload(req.body);
    const updated = await updateProformaInvoice(req.params.id, payload);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: updated,
        message: 'Proforma Invoice updated successfully.'
    }));
});

// DELETE /api/v1/proforma-invoices/:id
const deleteProformaInvoiceController = asyncHandler(async (req, res) => {
    const existing = await fetchProformaInvoiceById(req.params.id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Proforma Invoice not found.' });
    }
    verifyRecordOwnership(req.user, existing, 'Proforma Invoice');

    const result = await deleteProformaInvoice(req.params.id);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: result,
        message: 'Proforma Invoice deleted successfully.'
    }));
});

// PATCH /api/v1/proforma-invoices/:id/restore
const restoreProformaInvoiceController = asyncHandler(async (req, res) => {
    const existing = await fetchProformaInvoiceById(req.params.id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Proforma Invoice not found.' });
    }
    verifyRecordOwnership(req.user, existing, 'Proforma Invoice');

    const result = await restoreProformaInvoice(req.params.id);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: result,
        message: 'Proforma Invoice restored successfully.'
    }));
});

// POST /api/v1/proforma-invoices/bulk-delete
const bulkDeleteProformaInvoicesController = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;
    const result = await bulkDeleteProformaInvoices(ids);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: result,
        message: 'Proforma Invoices moved to trash successfully.'
    }));
});

// PATCH /api/v1/proforma-invoices/bulk-restore
const bulkRestoreProformaInvoicesController = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;
    const result = await bulkRestoreProformaInvoices(ids);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: result,
        message: 'Proforma Invoices restored from trash successfully.'
    }));
});

// POST /api/v1/proforma-invoices/:id/convert-to-invoice
const convertProformaToTaxInvoiceController = asyncHandler(async (req, res) => {
    const proforma = await fetchProformaInvoiceById(req.params.id);
    if (!proforma) {
        throw new ApiError({ statusCode: 404, message: 'Proforma Invoice not found.' });
    }
    verifyRecordOwnership(req.user, proforma, 'Proforma Invoice');

    const { taxInvoiceId } = req.body;
    if (taxInvoiceId) {
        await markProformaConvertedToInvoice(req.params.id, taxInvoiceId);
    }

    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: proforma,
        message: 'Proforma Invoice marked as converted to Tax Invoice.'
    }));
});

// GET /api/v1/proforma-invoices/:id/pdf
const generateProformaInvoicePdfController = asyncHandler(async (req, res) => {
    const proforma = await fetchProformaInvoiceById(req.params.id);
    if (!proforma) {
        throw new ApiError({ statusCode: 404, message: 'Proforma Invoice not found.' });
    }
    verifyRecordOwnership(req.user, proforma, 'Proforma Invoice');

    const pdfBuffer = await generateProformaPdf(proforma);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${proforma.proforma_no || 'Proforma'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
});

// POST /api/v1/proforma-invoices/preview-pdf (for live preview before saving)
const previewProformaInvoicePdfController = asyncHandler(async (req, res) => {
    const payload = normalizeProformaPayload(req.body);
    const { firmId = 1 } = getContext();

    // Enrich with firm context if available
    const enrichedData = {
        ...payload,
        firm_id: firmId,
        id: req.body.id || null
    };

    const pdfBuffer = await generateProformaPdf(enrichedData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Proforma_Preview.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
});

module.exports = {
    getAllProformaInvoicesController,
    getProformaInvoicePaginationController,
    getNextExpectedProformaNumberController,
    getProformaInvoiceByIdController,
    createProformaInvoiceController,
    updateProformaInvoiceController,
    deleteProformaInvoiceController,
    restoreProformaInvoiceController,
    bulkDeleteProformaInvoicesController,
    bulkRestoreProformaInvoicesController,
    convertProformaToTaxInvoiceController,
    generateProformaInvoicePdfController,
    previewProformaInvoicePdfController
};

