const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { getContext } = require('../helpers/requestContext');
const {
    fetchAllQuotations,
    fetchQuotationMeta,
    fetchQuotationById,
    fetchNextExpectedQuotationNumber,
    insertQuotation,
    updateQuotation,
    createQuotationRevision,
    approveQuotation,
    deleteQuotation,
    restoreQuotation,
    bulkDeleteQuotations,
    bulkRestoreQuotations
} = require('../models/quotation.model');
const { generateQuotationPdf } = require('../services/quotationPdf.service');

// Helper to map incoming camelCase request body to database snake_case columns
const normalizeQuotationPayload = (body) => {
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
            annexure_data: item.annexureData ?? null,
            sort_order: item.sortOrder ?? 0
        }))
        : undefined;

    return {
        firm_id: b.firmId,
        firm_branch_id: b.firmBranchId,
        party_id: b.partyId,
        party_branch_id: b.partyBranchId,
        quotation_no: b.quotationNo,
        revision_no: b.revisionNo,
        quotation_date: b.quotationDate,
        validity_days: b.validityDays,
        client_rfq_ref: b.clientRfqRef,
        template_type: b.templateType || 'CARDS',
        include_annexure: b.includeAnnexure,
        table_spec_config: b.tableSpecConfig,
        customer_name: b.customerName,
        gst_number: b.gstNumber,
        contact_person: b.contactPerson,
        contact_email: b.contactEmail,
        contact_phone: b.contactPhone,
        billing_address: b.billingAddress,
        shipping_address: b.shippingAddress,
        place_of_supply: b.placeOfSupply,
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
        cgst: b.cgst ?? 0,
        sgst: b.sgst ?? 0,
        igst: b.igst ?? 0,
        total: b.total ?? 0,
        round_off: b.roundOff ?? 0,
        other: b.other ?? 0,
        status: b.status,
        approval_status: b.approvalStatus,
        notes: b.notes,
        force_update: b.forceUpdate,
        is_revision: b.isRevision,
        keep_approval: b.keepApproval,
        items
    };
};

// GET /api/v1/quotations
const getAllQuotations = asyncHandler(async (req, res) => {
    const result = await fetchAllQuotations(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Quotations fetched successfully.'
        })
    );
});

// GET /api/v1/quotations/pagination
const getQuotationMeta = asyncHandler(async (req, res) => {
    const meta = await fetchQuotationMeta(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: meta,
            message: 'Quotation metadata fetched successfully.'
        })
    );
});

// GET /api/v1/quotations/next-quotation-number
const getNextQuotationNumber = asyncHandler(async (req, res) => {
    const { firmId } = getContext();
    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Active firm context is required.' });
    }
    const nextNumber = await fetchNextExpectedQuotationNumber(firmId);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { nextQuotationNumber: nextNumber },
            message: 'Next quotation number fetched successfully.'
        })
    );
});

// GET /api/v1/quotations/:id
const getQuotationById = asyncHandler(async (req, res) => {
    const quotation = await fetchQuotationById(req.params.id);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: quotation,
            message: 'Quotation details fetched successfully.'
        })
    );
});

// POST /api/v1/quotations
const createQuotation = asyncHandler(async (req, res) => {
    const payload = normalizeQuotationPayload(req.body);
    const created = await insertQuotation(payload);
    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: created,
            message: 'Quotation created successfully.'
        })
    );
});

// PATCH /api/v1/quotations/:id
const updateQuotationController = asyncHandler(async (req, res) => {
    const payload = normalizeQuotationPayload(req.body);
    const updated = await updateQuotation(req.params.id, payload);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Quotation updated successfully.'
        })
    );
});

// POST /api/v1/quotations/:id/revisions
const createQuotationRevisionController = asyncHandler(async (req, res) => {
    const payload = normalizeQuotationPayload(req.body);
    const revised = await createQuotationRevision(req.params.id, payload);
    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: revised,
            message: 'New quotation revision created successfully.'
        })
    );
});

// PATCH /api/v1/quotations/:id/approve
const approveQuotationController = asyncHandler(async (req, res) => {
    const approval_status = req.body.approvalStatus || req.body.approval_status;
    const rejection_reason = req.body.rejectionReason !== undefined ? req.body.rejectionReason : req.body.rejection_reason;
    const updated = await approveQuotation(req.params.id, { approval_status, rejection_reason });
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: `Quotation ${approval_status.toLowerCase()} successfully.`
        })
    );
});

// DELETE /api/v1/quotations/:id
const deleteQuotationController = asyncHandler(async (req, res) => {
    const deleted = await deleteQuotation(req.params.id);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: deleted,
            message: 'Quotation moved to trash successfully.'
        })
    );
});

// PATCH /api/v1/quotations/:id/restore
const restoreQuotationController = asyncHandler(async (req, res) => {
    const restored = await restoreQuotation(req.params.id);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: restored,
            message: 'Quotation restored successfully.'
        })
    );
});

// POST /api/v1/quotations/bulk-delete
const bulkDeleteQuotationsController = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const result = await bulkDeleteQuotations(ids);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Quotations deleted successfully.'
        })
    );
});

// PATCH /api/v1/quotations/bulk-restore
const bulkRestoreQuotationsController = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const result = await bulkRestoreQuotations(ids);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Quotations restored successfully.'
        })
    );
});

// GET /api/v1/quotations/:id/pdf
const getQuotationPdfController = asyncHandler(async (req, res) => {
    const quotation = await fetchQuotationById(req.params.id);
    if (!quotation) {
        throw new ApiError({ statusCode: 404, message: 'Quotation not found.' });
    }

    // Support query override: ?include_annexure=false/true or fallback to saved quotation setting
    let includeAnnexure = quotation.include_annexure !== false;
    if (req.query.include_annexure !== undefined) {
        includeAnnexure = req.query.include_annexure === 'true' || req.query.include_annexure === true || req.query.include_annexure === '1';
    } else if (req.query.includeAnnexure !== undefined) {
        includeAnnexure = req.query.includeAnnexure === 'true' || req.query.includeAnnexure === true || req.query.includeAnnexure === '1';
    }

    const pdfBuffer = await generateQuotationPdf({
        ...quotation,
        include_annexure: includeAnnexure,
        includeAnnexure: includeAnnexure
    });
    const fileName = `Quotation_${quotation.quotation_no}_R${quotation.revision_no || 0}`.replace(/[<>:"/\\|?*]/g, '_') + '.pdf';

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.send(pdfBuffer);
});

module.exports = {
    getAllQuotations,
    getQuotationMeta,
    getNextQuotationNumber,
    getQuotationById,
    createQuotation,
    updateQuotationController,
    createQuotationRevisionController,
    approveQuotationController,
    deleteQuotationController,
    restoreQuotationController,
    bulkDeleteQuotationsController,
    bulkRestoreQuotationsController,
    getQuotationPdfController
};
