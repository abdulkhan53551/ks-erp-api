const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { getContext } = require('../helpers/requestContext');
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
            product_id: item.productId !== undefined ? item.productId : (item.product_id ?? null),
            item_name: item.itemName || item.item_name,
            description: item.description ?? null,
            drawing_number: item.drawingNumber !== undefined ? item.drawingNumber : (item.drawing_number ?? null),
            hsn_sac_code: item.hsnSacCode !== undefined ? item.hsnSacCode : (item.hsn_sac_code ?? null),
            qty: item.qty,
            unit: item.unit || 'Nos',
            rate: item.rate,
            discount_percent: item.discountPercent !== undefined ? item.discountPercent : (item.discount_percent ?? 0),
            discount_amount: item.discountAmount !== undefined ? item.discountAmount : (item.discount_amount ?? 0),
            sub_total: item.subTotal !== undefined ? item.subTotal : (item.sub_total ?? 0),
            taxable_amount: item.taxableAmount !== undefined ? item.taxableAmount : (item.taxable_amount ?? 0),
            gst_slab_id: item.gstSlabId !== undefined ? item.gstSlabId : (item.gst_slab_id ?? null),
            tax_rate: item.taxRate !== undefined ? item.taxRate : (item.tax_rate ?? 18.00),
            cgst: item.cgst ?? 0,
            sgst: item.sgst ?? 0,
            igst: item.igst ?? 0,
            total: item.total ?? 0,
            sort_order: item.sortOrder !== undefined ? item.sortOrder : (item.sort_order ?? 0)
        }))
        : undefined;

    return {
        firm_id: b.firmId !== undefined ? b.firmId : b.firm_id,
        firm_branch_id: b.firmBranchId !== undefined ? b.firmBranchId : b.firm_branch_id,
        party_id: b.partyId !== undefined ? b.partyId : b.party_id,
        party_branch_id: b.partyBranchId !== undefined ? b.partyBranchId : b.party_branch_id,
        proforma_no: b.proformaNo || b.proforma_no,
        proforma_date: b.proformaDate || b.proforma_date,
        due_days: b.dueDays !== undefined ? b.dueDays : b.due_days,
        due_date: b.dueDate || b.due_date,
        order_ref_no: b.orderRefNo !== undefined ? b.orderRefNo : b.order_ref_no,
        order_ref_date: b.orderRefDate || b.order_ref_date,
        quotation_id: b.quotationId !== undefined ? b.quotationId : b.quotation_id,
        tax_invoice_id: b.taxInvoiceId !== undefined ? b.taxInvoiceId : b.tax_invoice_id,
        customer_name: b.customerName || b.customer_name,
        has_gst: b.hasGst !== undefined ? b.hasGst : b.has_gst,
        gst_number: b.gstNumber !== undefined ? b.gstNumber : b.gst_number,
        contact_person: b.contactPerson !== undefined ? b.contactPerson : b.contact_person,
        contact_email: b.contactEmail !== undefined ? b.contactEmail : b.contact_email,
        contact_phone: b.contactPhone !== undefined ? b.contactPhone : b.contact_phone,
        billing_address: b.billingAddress !== undefined ? b.billingAddress : b.billing_address,
        shipping_address: b.shippingAddress !== undefined ? b.shippingAddress : b.shipping_address,
        place_of_supply: b.placeOfSupply !== undefined ? b.placeOfSupply : b.place_of_supply,
        dispatch_through: b.dispatchThrough !== undefined ? b.dispatchThrough : b.dispatch_through,
        destination: b.destination,
        payment_terms: b.paymentTerms !== undefined ? b.paymentTerms : b.payment_terms,
        delivery_period: b.deliveryPeriod !== undefined ? b.deliveryPeriod : b.delivery_period,
        freight_basis: b.freightBasis !== undefined ? b.freightBasis : b.freight_basis,
        warranty_terms: b.warrantyTerms !== undefined ? b.warrantyTerms : b.warranty_terms,
        special_notes: b.specialNotes !== undefined ? b.specialNotes : b.special_notes,
        terms_and_conditions: b.termsAndConditions !== undefined ? b.termsAndConditions : b.terms_and_conditions,
        sub_total: b.subTotal !== undefined ? b.subTotal : b.sub_total,
        discount_percent: b.discountPercent !== undefined ? b.discountPercent : b.discount_percent,
        discount_amount: b.discountAmount !== undefined ? b.discountAmount : b.discount_amount,
        taxable_amount: b.taxableAmount !== undefined ? b.taxableAmount : b.taxable_amount,
        cgst: b.cgst,
        sgst: b.sgst,
        igst: b.igst,
        other: b.other,
        round_off: b.roundOff !== undefined ? b.roundOff : b.round_off,
        total: b.total,
        advance_amount_requested: b.advanceAmountRequested !== undefined ? b.advanceAmountRequested : b.advance_amount_requested,
        advance_received: b.advanceReceived !== undefined ? b.advanceReceived : b.advance_received,
        status: b.status,
        cancel_reason: b.cancelReason || b.cancel_reason,
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
    const { firmId = 0 } = getContext();
    if (!firmId) {
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
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data,
        message: 'Proforma Invoice details fetched successfully.'
    }));
});

// POST /api/v1/proforma-invoices
const createProformaInvoiceController = asyncHandler(async (req, res) => {
    const payload = normalizeProformaPayload(req.body);
    const created = await saveProformaInvoice(payload);
    res.status(201).json(new ApiResponse({
        statusCode: 201,
        data: created,
        message: 'Proforma Invoice created successfully.'
    }));
});

// PUT /api/v1/proforma-invoices/:id
const updateProformaInvoiceController = asyncHandler(async (req, res) => {
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
    const result = await deleteProformaInvoice(req.params.id);
    res.status(200).json(new ApiResponse({
        statusCode: 200,
        data: result,
        message: 'Proforma Invoice deleted successfully.'
    }));
});

// PATCH /api/v1/proforma-invoices/:id/restore
const restoreProformaInvoiceController = asyncHandler(async (req, res) => {
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

    const pdfBuffer = await generateProformaPdf(proforma);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${proforma.proforma_no || 'Proforma'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
});

// POST /api/v1/proforma-invoices/preview-pdf (for live preview before saving)
const previewProformaInvoicePdfController = asyncHandler(async (req, res) => {
    const payload = normalizeProformaPayload(req.body);
    const { firmId = 0 } = getContext();

    // Enrich with firm context if available
    const enrichedData = {
        ...payload,
        firm_id: payload.firm_id || firmId || 1,
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

