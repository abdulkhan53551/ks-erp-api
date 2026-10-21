const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Helper to calculate next consecutive proforma invoice number: PI-YYYY-XXXX
const calculateNextProformaInvoiceNumber = async (firmId, trx = db) => {
    const currentYear = new Date().getFullYear();
    const prefix = `PI-${currentYear}-`;

    const result = await trx('proforma_invoices')
        .where('firm_id', firmId)
        .where('proforma_no', 'LIKE', `${prefix}%`)
        .select(
            trx.raw("MAX(CAST(SUBSTRING(proforma_no FROM '([0-9]+)$') AS INTEGER)) as max_seq")
        )
        .first();

    const maxSeq = result?.max_seq ? parseInt(result.max_seq, 10) : 0;
    let candidateSeq = maxSeq + 1;

    while (true) {
        const candidateNo = `${prefix}${String(candidateSeq).padStart(4, '0')}`;
        const existing = await trx('proforma_invoices')
            .where({ firm_id: firmId, proforma_no: candidateNo })
            .first('id');
        if (!existing) {
            return candidateNo;
        }
        candidateSeq++;
    }
};

// Public helper for next proforma number preview
const fetchNextExpectedProformaNumber = async (firmId, trx = db) => {
    return calculateNextProformaInvoiceNumber(firmId, trx);
};

// Fetch all proforma invoices with filtering and pagination
const fetchAllProformaInvoices = async (query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            status = '',
            startDate = '',
            endDate = '',
            trash = false
        } = query;

        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('proforma_invoices AS PI')
            .select(
                'PI.id',
                'PI.id AS proforma_id',
                'PI.proforma_no',
                'PI.proforma_date',
                'PI.due_days',
                'PI.due_date',
                'PI.order_ref_no',
                'PI.order_ref_date',
                'PI.quotation_id',
                'PI.tax_invoice_id',
                'PI.party_id',
                'PI.customer_name',
                'PI.gst_number',
                'PI.contact_person',
                'PI.contact_phone',
                'PI.contact_email',
                'PI.sub_total',
                'PI.discount_amount',
                'PI.taxable_amount',
                'PI.cgst',
                'PI.sgst',
                'PI.igst',
                'PI.other',
                'PI.round_off',
                'PI.total',
                'PI.advance_amount_requested',
                'PI.advance_received',
                'PI.status',
                'PI.is_converted',
                'PI.converted_at',
                'PI.created_at',
                'PI.updated_at',
                'PI.deleted_at',
                'F.firm_name',
                'FB.branch_name AS firm_branch_name',
                db.raw(`TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS created_by_name`),
                db.raw(`TRIM(CONCAT(u_upd.first_name, ' ', COALESCE(u_upd.last_name, ''))) AS updated_by_name`),
                db.raw(`TRIM(CONCAT(u_del.first_name, ' ', COALESCE(u_del.last_name, ''))) AS deleted_by_name`),
                db.raw(`(
                    SELECT COUNT(*)::int
                    FROM proforma_invoice_items pii
                    WHERE pii.proforma_invoice_id = "PI"."id" AND pii.is_active = true
                ) AS items_count`)
            )
            .leftJoin('firms AS F', 'PI.firm_id', 'F.id')
            .leftJoin('firm_branches AS FB', 'PI.firm_branch_id', 'FB.id')
            .leftJoin('users AS u', 'PI.created_by', 'u.id')
            .leftJoin('users AS u_upd', 'PI.updated_by', 'u_upd.id')
            .leftJoin('users AS u_del', 'PI.deleted_by', 'u_del.id')
            .where('PI.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('PI.firm_id', firmId);
        }

        if (branchId) {
            baseQuery.andWhere(function () {
                this.where('PI.firm_branch_id', branchId)
                    .orWhereNull('PI.firm_branch_id');
            });
        }

        if (status) {
            baseQuery.andWhere('PI.status', status);
        }

        if (startDate) {
            baseQuery.andWhere('PI.proforma_date', '>=', startDate);
        }

        if (endDate) {
            baseQuery.andWhere('PI.proforma_date', '<=', endDate);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('PI.proforma_no', 'ILIKE', `%${search}%`)
                    .orWhere('PI.customer_name', 'ILIKE', `%${search}%`)
                    .orWhere('PI.contact_person', 'ILIKE', `%${search}%`)
                    .orWhere('PI.order_ref_no', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`]);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('PI.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('PI.created_at', 'desc');
        }

        return await fetchPageData({ baseQuery, page, pageSize });
    } catch (error) {
        throw new ApiError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Something went wrong while fetching proforma invoices.',
        });
    }
};

// Fetch proforma invoice pagination metadata
const fetchProformaInvoicePagination = async (query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            status = '',
            startDate = '',
            endDate = '',
            trash = false
        } = query;

        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('proforma_invoices AS PI')
            .leftJoin('users AS u', 'PI.created_by', 'u.id')
            .where('PI.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('PI.firm_id', firmId);
        }

        if (branchId) {
            baseQuery.andWhere(function () {
                this.where('PI.firm_branch_id', branchId)
                    .orWhereNull('PI.firm_branch_id');
            });
        }

        if (status) {
            baseQuery.andWhere('PI.status', status);
        }

        if (startDate) {
            baseQuery.andWhere('PI.proforma_date', '>=', startDate);
        }

        if (endDate) {
            baseQuery.andWhere('PI.proforma_date', '<=', endDate);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('PI.proforma_no', 'ILIKE', `%${search}%`)
                    .orWhere('PI.customer_name', 'ILIKE', `%${search}%`)
                    .orWhere('PI.contact_person', 'ILIKE', `%${search}%`)
                    .orWhere('PI.order_ref_no', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`]);
            });
        }

        return await buildPagination({ baseQuery, page, pageSize });
    } catch (error) {
        throw new ApiError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Something went wrong while fetching proforma invoice pagination metadata.',
        });
    }
};

// Fetch single proforma invoice by ID with items and full snapshot
const fetchProformaInvoiceById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const piQuery = db('proforma_invoices AS PI')
            .select(
                'PI.*',
                'F.firm_name',
                'F.firm_type',
                'F.logo_url AS firm_logo_url',
                'F.gstin AS firm_gstin',
                'UC.email AS firm_email',
                'UC.phone_number AS firm_phone_number',
                'UC.address_line1 AS firm_address',
                'FB.branch_name AS firm_branch_name',
                'FB.branch_code AS firm_branch_code',
                'FB.gstin AS firm_branch_gstin',
                'P.legal_name AS party_name',
                'P.display_name AS party_display_name',
                'P.party_code',
                'PB.branch_name AS party_branch_name',
                'PB.gstin AS party_branch_gstin',
                'FBA.bank_name',
                'FBA.account_number',
                'FBA.ifsc_code',
                'FBA.branch_name AS bank_branch_name',
                db.raw(`TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS created_by_name`),
                db.raw(`TRIM(CONCAT(u_upd.first_name, ' ', COALESCE(u_upd.last_name, ''))) AS updated_by_name`),
                'Q.quotation_no',
                'INV.invoice_no AS tax_invoice_no'
            )
            .leftJoin('firms AS F', 'PI.firm_id', 'F.id')
            .leftJoin('firm_branches AS FB', 'PI.firm_branch_id', 'FB.id')
            .leftJoin('user_contacts AS UC', function () {
                this.on('F.id', '=', 'UC.entity_id')
                    .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
            })
            .leftJoin('firm_bank_accounts AS FBA', function () {
                this.on('F.id', '=', 'FBA.firm_id')
                    .andOn('FBA.is_active', '=', db.raw('true'));
            })
            .leftJoin('parties AS P', 'PI.party_id', 'P.id')
            .leftJoin('party_branches AS PB', 'PI.party_branch_id', 'PB.id')
            .leftJoin('users AS u', 'PI.created_by', 'u.id')
            .leftJoin('users AS u_upd', 'PI.updated_by', 'u_upd.id')
            .leftJoin('quotations AS Q', 'PI.quotation_id', 'Q.id')
            .leftJoin('invoices AS INV', 'PI.tax_invoice_id', 'INV.id')
            .where('PI.id', id);

        if (firmId) {
            piQuery.andWhere('PI.firm_id', firmId);
        }

        const proforma = await piQuery.first();

        if (!proforma) {
            throw new ApiError({
                statusCode: 404,
                message: 'Proforma Invoice not found.',
            });
        }

        // Fetch line items
        const rawItems = await db('proforma_invoice_items AS PII')
            .select(
                'PII.*',
                'PR.item_code AS product_item_code',
                'PR.material_grade AS product_material_grade',
                'PR.dimensions AS product_dimensions',
                'PR.unit_weight_kg AS product_unit_weight_kg'
            )
            .leftJoin('products AS PR', 'PII.product_id', 'PR.id')
            .where('PII.proforma_invoice_id', id)
            .andWhere('PII.is_active', true)
            .orderBy('PII.sort_order', 'asc');

        const items = rawItems.map(it => ({
            ...it,
            productId: it.product_id,
            itemName: it.item_name,
            drawingNumber: it.drawing_number,
            hsnSacCode: it.hsn_sac_code,
            discountPercent: parseFloat(it.discount_percent || 0),
            discountAmount: parseFloat(it.discount_amount || 0),
            taxableAmount: parseFloat(it.taxable_amount || 0),
            taxRate: parseFloat(it.tax_rate || 0),
            productMaterialGrade: it.product_material_grade,
            productDimensions: it.product_dimensions,
            productUnitWeightKg: it.product_unit_weight_kg
        }));

        proforma.items = items;
        return proforma;
    } catch (error) {
        throw new ApiError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Something went wrong while fetching proforma invoice details.',
        });
    }
};

// Create new proforma invoice with line items
const saveProformaInvoice = async (data = {}) => {
    return db.transaction(async (trx) => {
        const { firmId: contextFirmId, userId, activeBranch } = getContext();
        const firmId = data.firm_id || data.firmId || contextFirmId;
        const branchId = data.firm_branch_id || data.firmBranchId || activeBranch?.id || null;

        // Auto-assign consecutive proforma number if not explicitly supplied
        let proformaNo = data.proforma_no || data.proformaNo;
        if (!proformaNo) {
            proformaNo = await calculateNextProformaInvoiceNumber(firmId, trx);
        }

        // Calculate due_date from proforma_date + due_days
        const pDate = new Date(data.proforma_date || data.proformaDate || new Date());
        const dueDays = parseInt(data.due_days || data.dueDays || 15, 10);
        const calculatedDueDate = new Date(pDate);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + dueDays);

        const [createdProforma] = await trx('proforma_invoices')
            .insert({
                firm_id: firmId,
                firm_branch_id: branchId,
                party_id: data.party_id || data.partyId || null,
                party_branch_id: data.party_branch_id || data.partyBranchId || null,
                proforma_no: proformaNo,
                proforma_date: pDate,
                due_days: dueDays,
                due_date: data.due_date || data.dueDate || calculatedDueDate,
                order_ref_no: data.order_ref_no || data.orderRefNo || null,
                order_ref_date: data.order_ref_date || data.orderRefDate || null,
                quotation_id: data.quotation_id || data.quotationId || null,
                tax_invoice_id: data.tax_invoice_id || data.taxInvoiceId || null,
                customer_name: data.customer_name || data.customerName,
                has_gst: Boolean(data.has_gst !== undefined ? data.has_gst : data.hasGst),
                gst_number: data.gst_number || data.gstNumber || null,
                contact_person: data.contact_person || data.contactPerson || null,
                contact_email: data.contact_email || data.contactEmail || null,
                contact_phone: data.contact_phone || data.contactPhone || null,
                billing_address: data.billing_address || data.billingAddress || null,
                shipping_address: data.shipping_address || data.shippingAddress || null,
                place_of_supply: data.place_of_supply || data.placeOfSupply || null,
                dispatch_through: data.dispatch_through || data.dispatchThrough || null,
                destination: data.destination || null,
                payment_terms: data.payment_terms || data.paymentTerms || null,
                delivery_period: data.delivery_period || data.deliveryPeriod || null,
                freight_basis: data.freight_basis || data.freightBasis || null,
                warranty_terms: data.warranty_terms || data.warrantyTerms || null,
                special_notes: data.special_notes || data.specialNotes || null,
                terms_and_conditions: data.terms_and_conditions || data.termsAndConditions || null,
                sub_total: data.sub_total || data.subTotal || 0,
                discount_percent: data.discount_percent || data.discountPercent || 0,
                discount_amount: data.discount_amount || data.discountAmount || 0,
                taxable_amount: data.taxable_amount || data.taxableAmount || 0,
                cgst: data.cgst || 0,
                sgst: data.sgst || 0,
                igst: data.igst || 0,
                other: data.other || 0,
                round_off: data.round_off || data.roundOff || 0,
                total: data.total || 0,
                advance_amount_requested: data.advance_amount_requested || data.advanceAmountRequested || 0,
                advance_received: data.advance_received || data.advanceReceived || 0,
                status: data.status || 'DRAFT',
                notes: data.notes || null,
                created_by: userId || null,
                updated_by: userId || null,
                is_active: true
            })
            .returning('*');

        // Insert line items
        const rawItems = Array.isArray(data.items) ? data.items : [];
        if (rawItems.length > 0) {
            const itemsToInsert = rawItems.map((item, idx) => ({
                proforma_invoice_id: createdProforma.id,
                product_id: item.product_id !== undefined ? item.product_id : (item.productId || null),
                item_name: item.item_name || item.itemName,
                description: item.description || null,
                drawing_number: item.drawing_number !== undefined ? item.drawing_number : (item.drawingNumber || null),
                hsn_sac_code: item.hsn_sac_code !== undefined ? item.hsn_sac_code : (item.hsnSacCode || null),
                qty: item.qty || 1,
                unit: item.unit || 'Nos',
                rate: item.rate || 0,
                discount_percent: item.discount_percent || item.discountPercent || 0,
                discount_amount: item.discount_amount || item.discountAmount || 0,
                sub_total: item.sub_total || item.subTotal || (item.qty * item.rate),
                taxable_amount: item.taxable_amount || item.taxableAmount || (item.qty * item.rate),
                gst_slab_id: item.gst_slab_id || item.gstSlabId || null,
                tax_rate: item.tax_rate !== undefined ? item.tax_rate : (item.taxRate !== undefined ? item.taxRate : 18.00),
                cgst: item.cgst || 0,
                sgst: item.sgst || 0,
                igst: item.igst || 0,
                total: item.total || 0,
                sort_order: item.sort_order !== undefined ? item.sort_order : idx,
                created_by: userId || null,
                updated_by: userId || null,
                is_active: true
            }));

            await trx('proforma_invoice_items').insert(itemsToInsert);
        }

        return createdProforma;
    });
};

// Update existing proforma invoice and items
const updateProformaInvoice = async (id, data = {}) => {
    return db.transaction(async (trx) => {
        const { firmId: contextFirmId, userId } = getContext();
        const firmId = data.firm_id || data.firmId || contextFirmId;

        const existing = await trx('proforma_invoices')
            .where('id', id)
            .andWhere('is_active', true)
            .first();

        if (!existing) {
            throw new ApiError({
                statusCode: 404,
                message: 'Proforma Invoice not found or inactive.',
            });
        }

        if (firmId && existing.firm_id !== firmId) {
            throw new ApiError({
                statusCode: 403,
                message: 'Unauthorized: Cannot modify proforma invoice belonging to another firm context.',
            });
        }

        const updatePayload = {
            party_id: data.party_id !== undefined ? data.party_id : (data.partyId !== undefined ? data.partyId : existing.party_id),
            party_branch_id: data.party_branch_id !== undefined ? data.party_branch_id : (data.partyBranchId !== undefined ? data.partyBranchId : existing.party_branch_id),
            customer_name: data.customer_name || data.customerName || existing.customer_name,
            has_gst: data.has_gst !== undefined ? data.has_gst : (data.hasGst !== undefined ? data.hasGst : existing.has_gst),
            gst_number: data.gst_number !== undefined ? data.gst_number : (data.gstNumber !== undefined ? data.gstNumber : existing.gst_number),
            contact_person: data.contact_person !== undefined ? data.contact_person : (data.contactPerson !== undefined ? data.contactPerson : existing.contact_person),
            contact_email: data.contact_email !== undefined ? data.contact_email : (data.contactEmail !== undefined ? data.contactEmail : existing.contact_email),
            contact_phone: data.contact_phone !== undefined ? data.contact_phone : (data.contactPhone !== undefined ? data.contactPhone : existing.contact_phone),
            billing_address: data.billing_address !== undefined ? data.billing_address : (data.billingAddress !== undefined ? data.billingAddress : existing.billing_address),
            shipping_address: data.shipping_address !== undefined ? data.shipping_address : (data.shippingAddress !== undefined ? data.shippingAddress : existing.shipping_address),
            place_of_supply: data.place_of_supply !== undefined ? data.place_of_supply : (data.placeOfSupply !== undefined ? data.placeOfSupply : existing.place_of_supply),
            dispatch_through: data.dispatch_through !== undefined ? data.dispatch_through : (data.dispatchThrough !== undefined ? data.dispatchThrough : existing.dispatch_through),
            destination: data.destination !== undefined ? data.destination : existing.destination,
            order_ref_no: data.order_ref_no !== undefined ? data.order_ref_no : (data.orderRefNo !== undefined ? data.orderRefNo : existing.order_ref_no),
            order_ref_date: data.order_ref_date !== undefined ? data.order_ref_date : (data.orderRefDate !== undefined ? data.orderRefDate : existing.order_ref_date),
            payment_terms: data.payment_terms !== undefined ? data.payment_terms : (data.paymentTerms !== undefined ? data.paymentTerms : existing.payment_terms),
            delivery_period: data.delivery_period !== undefined ? data.delivery_period : (data.deliveryPeriod !== undefined ? data.deliveryPeriod : existing.delivery_period),
            freight_basis: data.freight_basis !== undefined ? data.freight_basis : (data.freightBasis !== undefined ? data.freightBasis : existing.freight_basis),
            warranty_terms: data.warranty_terms !== undefined ? data.warranty_terms : (data.warrantyTerms !== undefined ? data.warrantyTerms : existing.warranty_terms),
            special_notes: data.special_notes !== undefined ? data.special_notes : (data.specialNotes !== undefined ? data.specialNotes : existing.special_notes),
            terms_and_conditions: data.terms_and_conditions !== undefined ? data.terms_and_conditions : (data.termsAndConditions !== undefined ? data.termsAndConditions : existing.terms_and_conditions),
            sub_total: data.sub_total !== undefined ? data.sub_total : (data.subTotal !== undefined ? data.subTotal : existing.sub_total),
            discount_percent: data.discount_percent !== undefined ? data.discount_percent : (data.discountPercent !== undefined ? data.discountPercent : existing.discount_percent),
            discount_amount: data.discount_amount !== undefined ? data.discount_amount : (data.discountAmount !== undefined ? data.discountAmount : existing.discount_amount),
            taxable_amount: data.taxable_amount !== undefined ? data.taxable_amount : (data.taxableAmount !== undefined ? data.taxableAmount : existing.taxable_amount),
            cgst: data.cgst !== undefined ? data.cgst : existing.cgst,
            sgst: data.sgst !== undefined ? data.sgst : existing.sgst,
            igst: data.igst !== undefined ? data.igst : existing.igst,
            other: data.other !== undefined ? data.other : existing.other,
            round_off: data.round_off !== undefined ? data.round_off : (data.roundOff !== undefined ? data.roundOff : existing.round_off),
            total: data.total !== undefined ? data.total : existing.total,
            advance_amount_requested: data.advance_amount_requested !== undefined ? data.advance_amount_requested : (data.advanceAmountRequested !== undefined ? data.advanceAmountRequested : existing.advance_amount_requested),
            advance_received: data.advance_received !== undefined ? data.advance_received : (data.advanceReceived !== undefined ? data.advanceReceived : existing.advance_received),
            status: data.status || existing.status,
            notes: data.notes !== undefined ? data.notes : existing.notes,
            updated_by: userId || null,
            updated_at: new Date()
        };

        if (data.due_days || data.dueDays) {
            updatePayload.due_days = parseInt(data.due_days || data.dueDays, 10);
            const pDate = new Date(existing.proforma_date);
            const calculatedDueDate = new Date(pDate);
            calculatedDueDate.setDate(calculatedDueDate.getDate() + updatePayload.due_days);
            updatePayload.due_date = calculatedDueDate;
        }

        const [updatedProforma] = await trx('proforma_invoices')
            .where('id', id)
            .update(updatePayload)
            .returning('*');

        // Line items update: soft-delete old items and insert updated ones
        if (Array.isArray(data.items)) {
            await trx('proforma_invoice_items')
                .where('proforma_invoice_id', id)
                .update({
                    is_active: false,
                    deleted_at: new Date(),
                    deleted_by: userId || null
                });

            if (data.items.length > 0) {
                const itemsToInsert = data.items.map((item, idx) => ({
                    proforma_invoice_id: id,
                    product_id: item.product_id !== undefined ? item.product_id : (item.productId || null),
                    item_name: item.item_name || item.itemName,
                    description: item.description || null,
                    drawing_number: item.drawing_number !== undefined ? item.drawing_number : (item.drawingNumber || null),
                    hsn_sac_code: item.hsn_sac_code !== undefined ? item.hsn_sac_code : (item.hsnSacCode || null),
                    qty: item.qty || 1,
                    unit: item.unit || 'Nos',
                    rate: item.rate || 0,
                    discount_percent: item.discount_percent || item.discountPercent || 0,
                    discount_amount: item.discount_amount || item.discountAmount || 0,
                    sub_total: item.sub_total || item.subTotal || (item.qty * item.rate),
                    taxable_amount: item.taxable_amount || item.taxableAmount || (item.qty * item.rate),
                    gst_slab_id: item.gst_slab_id || item.gstSlabId || null,
                    tax_rate: item.tax_rate !== undefined ? item.tax_rate : (item.taxRate !== undefined ? item.taxRate : 18.00),
                    cgst: item.cgst || 0,
                    sgst: item.sgst || 0,
                    igst: item.igst || 0,
                    total: item.total || 0,
                    sort_order: item.sort_order !== undefined ? item.sort_order : idx,
                    created_by: userId || null,
                    updated_by: userId || null,
                    is_active: true
                }));

                await trx('proforma_invoice_items').insert(itemsToInsert);
            }
        }

        return updatedProforma;
    });
};

// Soft delete proforma invoice
const deleteProformaInvoice = async (id) => {
    return db.transaction(async (trx) => {
        const { firmId: contextFirmId, userId } = getContext();

        const existing = await trx('proforma_invoices')
            .where('id', id)
            .andWhere('is_active', true)
            .first();

        if (!existing) {
            throw new ApiError({
                statusCode: 404,
                message: 'Proforma Invoice not found or already deleted.',
            });
        }

        if (contextFirmId && existing.firm_id !== contextFirmId) {
            throw new ApiError({
                statusCode: 403,
                message: 'Unauthorized: Cannot delete proforma invoice belonging to another firm context.',
            });
        }

        await trx('proforma_invoices')
            .where('id', id)
            .update({
                is_active: false,
                deleted_at: new Date(),
                deleted_by: userId || null
            });

        await trx('proforma_invoice_items')
            .where('proforma_invoice_id', id)
            .update({
                is_active: false,
                deleted_at: new Date(),
                deleted_by: userId || null
            });

        return { success: true, message: 'Proforma Invoice deleted successfully.' };
    });
};

// Restore soft-deleted proforma invoice
const restoreProformaInvoice = async (id) => {
    const { userId } = getContext();

    const [restored] = await db('proforma_invoices')
        .where({ id })
        .update({
            is_active: true,
            deleted_at: null,
            deleted_by: null,
            updated_by: userId || null
        })
        .returning('*');

    if (!restored) {
        throw new ApiError({
            statusCode: 404,
            message: 'Proforma Invoice not found.',
        });
    }

    await db('proforma_invoice_items')
        .where('proforma_invoice_id', id)
        .update({
            is_active: true,
            deleted_at: null,
            deleted_by: null,
            updated_by: userId || null
        });

    return restored;
};

// Bulk delete proforma invoices
const bulkDeleteProformaInvoices = async (ids = []) => {
    const { userId } = getContext();

    const count = await db('proforma_invoices')
        .whereIn('id', ids)
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        });

    await db('proforma_invoice_items')
        .whereIn('proforma_invoice_id', ids)
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        });

    return { affected: count };
};

// Bulk restore proforma invoices
const bulkRestoreProformaInvoices = async (ids = []) => {
    const { userId } = getContext();

    const count = await db('proforma_invoices')
        .whereIn('id', ids)
        .update({
            is_active: true,
            deleted_at: null,
            deleted_by: null,
            updated_by: userId || null
        });

    await db('proforma_invoice_items')
        .whereIn('proforma_invoice_id', ids)
        .update({
            is_active: true,
            deleted_at: null,
            deleted_by: null,
            updated_by: userId || null
        });

    return { affected: count };
};

// Mark proforma invoice as converted to Tax Invoice
const markProformaConvertedToInvoice = async (id, taxInvoiceId) => {
    return db('proforma_invoices')
        .where('id', id)
        .update({
            status: 'CONVERTED',
            is_converted: true,
            converted_at: new Date(),
            tax_invoice_id: taxInvoiceId,
            updated_at: new Date()
        });
};

module.exports = {
    fetchAllProformaInvoices,
    fetchProformaInvoicePagination,
    fetchProformaInvoiceById,
    fetchNextExpectedProformaNumber,
    calculateNextProformaInvoiceNumber,
    saveProformaInvoice,
    updateProformaInvoice,
    deleteProformaInvoice,
    restoreProformaInvoice,
    bulkDeleteProformaInvoices,
    bulkRestoreProformaInvoices,
    markProformaConvertedToInvoice
};

