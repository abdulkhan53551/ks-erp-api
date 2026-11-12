const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Helper to ensure annexure_data is stored as clean JSON string without double stringification
const formatAnnexureData = (data) => {
    if (!data) return null;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
        } catch (_) {
            return JSON.stringify(data);
        }
    }
    return JSON.stringify(data);
};

// Helper to calculate next consecutive quotation number: QT-YYYY-XXXX
const calculateNextQuotationNumber = async (firmId, trx = db) => {
    const currentYear = new Date().getFullYear();
    const prefix = `QT-${currentYear}-`;

    // Query MAX numerical sequence across ALL quotations for this firm & current year
    // Extracting numerical suffix so revisions (which have higher table IDs) never mess up sequence calculation!
    const result = await trx('quotations')
        .where('firm_id', firmId)
        .where('quotation_no', 'LIKE', `${prefix}%`)
        .select(
            trx.raw("MAX(CAST(SUBSTRING(quotation_no FROM '([0-9]+)$') AS INTEGER)) as max_seq")
        )
        .first();

    const maxSeq = result?.max_seq ? parseInt(result.max_seq, 10) : 0;

    // Guarantee that candidate number is truly available for revision 0
    let candidateSeq = maxSeq + 1;
    while (true) {
        const candidateNo = `${prefix}${String(candidateSeq).padStart(4, '0')}`;
        const existing = await trx('quotations')
            .where({ firm_id: firmId, quotation_no: candidateNo, revision_no: 0 })
            .first('id');
        if (!existing) {
            return candidateNo;
        }
        candidateSeq++;
    }
};

// Public helper for next quotation number preview
const fetchNextExpectedQuotationNumber = async (firmId, trx = db) => {
    return calculateNextQuotationNumber(firmId, trx);
};

// Fetch all quotations with filtering and pagination
const fetchAllQuotations = async (query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            status = '',
            approvalStatus = '',
            startDate = '',
            endDate = '',
            trash = false
        } = query;

        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('quotations AS Q')
            .select(
                'Q.id',
                'Q.id AS quotation_id',
                'Q.quotation_no',
                'Q.revision_no',
                'Q.quotation_date',
                'Q.validity_days',
                'Q.validity_date',
                'Q.client_rfq_ref',
                'Q.template_type',
                'Q.include_annexure',
                'Q.party_id',
                'Q.customer_name',
                'Q.gst_number',
                'Q.contact_person',
                'Q.contact_phone',
                'Q.contact_email',
                'Q.sub_total',
                'Q.discount_amount',
                'Q.taxable_amount',
                'Q.cgst',
                'Q.sgst',
                'Q.igst',
                'Q.total',
                'Q.status',
                'Q.approval_status',
                'Q.approved_at',
                'Q.converted_to_po',
                'Q.purchase_order_id',
                'Q.created_at',
                'Q.updated_at',
                'Q.deleted_at',
                'F.firm_name',
                'FB.branch_name AS firm_branch_name',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by_name`),
                db.raw(`CONCAT(au.first_name, ' ', au.last_name) AS approved_by_name`),
                db.raw(`(
                    SELECT COUNT(*)::int
                    FROM quotation_items qi
                    WHERE qi.quotation_id = "Q"."id" AND qi.is_active = true
                ) AS items_count`)
            )
            .leftJoin('firms AS F', 'Q.firm_id', 'F.id')
            .leftJoin('firm_branches AS FB', 'Q.firm_branch_id', 'FB.id')
            .leftJoin('users AS u', 'Q.created_by', 'u.id')
            .leftJoin('users AS au', 'Q.approved_by', 'au.id')
            .where('Q.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('Q.firm_id', firmId);
        }

        if (branchId) {
            baseQuery.andWhere(function () {
                this.where('Q.firm_branch_id', branchId)
                    .orWhereNull('Q.firm_branch_id');
            });
        }

        if (status) {
            baseQuery.andWhere('Q.status', status);
        }

        if (approvalStatus) {
            baseQuery.andWhere('Q.approval_status', approvalStatus);
        }

        if (startDate) {
            baseQuery.andWhere('Q.quotation_date', '>=', startDate);
        }

        if (endDate) {
            baseQuery.andWhere('Q.quotation_date', '<=', endDate);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('Q.quotation_no', 'ILIKE', `%${search}%`)
                    .orWhere('Q.customer_name', 'ILIKE', `%${search}%`)
                    .orWhere('Q.contact_person', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`]);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('Q.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('Q.id', 'desc');
        }

        return await fetchPageData({ baseQuery, page, pageSize });
    } catch (error) {
        console.error('Error fetching quotations:', error);
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching quotations.',
        });
    }
};

// Fetch quotation meta for pagination
const fetchQuotationMeta = async (query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            status = '',
            approvalStatus = '',
            startDate = '',
            endDate = '',
            trash = false
        } = query;

        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('quotations AS Q')
            .where('Q.is_active', !isTrash);

        if (firmId) baseQuery.andWhere('Q.firm_id', firmId);
        if (branchId) {
            baseQuery.andWhere(function () {
                this.where('Q.firm_branch_id', branchId)
                    .orWhereNull('Q.firm_branch_id');
            });
        }
        if (status) baseQuery.andWhere('Q.status', status);
        if (approvalStatus) baseQuery.andWhere('Q.approval_status', approvalStatus);
        if (startDate) baseQuery.andWhere('Q.quotation_date', '>=', startDate);
        if (endDate) baseQuery.andWhere('Q.quotation_date', '<=', endDate);

        if (search) {
            baseQuery.where(function () {
                this.where('Q.quotation_no', 'ILIKE', `%${search}%`)
                    .orWhere('Q.customer_name', 'ILIKE', `%${search}%`)
                    .orWhere('Q.contact_person', 'ILIKE', `%${search}%`);
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });
        return result;
    } catch (error) {
        console.error('Error fetching quotation meta:', error);
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching quotation metadata.',
        });
    }
};

// Fetch single quotation by ID with items and full snapshot
const fetchQuotationById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const quotationQuery = db('quotations AS Q')
            .select(
                'Q.*',
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
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by_name`),
                db.raw(`CONCAT(au.first_name, ' ', au.last_name) AS approved_by_name`)
            )
            .leftJoin('firms AS F', 'Q.firm_id', 'F.id')
            .leftJoin('firm_branches AS FB', 'Q.firm_branch_id', 'FB.id')
            .leftJoin('user_contacts AS UC', function () {
                this.on('F.id', '=', 'UC.entity_id')
                    .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
            })
            .leftJoin('firm_bank_accounts AS FBA', function () {
                this.on('F.id', '=', 'FBA.firm_id')
                    .andOn('FBA.is_active', '=', db.raw('true'));
            })
            .leftJoin('parties AS P', 'Q.party_id', 'P.id')
            .leftJoin('party_branches AS PB', 'Q.party_branch_id', 'PB.id')
            .leftJoin('users AS u', 'Q.created_by', 'u.id')
            .leftJoin('users AS au', 'Q.approved_by', 'au.id')
            .where('Q.id', id);

        if (firmId) {
            quotationQuery.andWhere('Q.firm_id', firmId);
        }

        const quotation = await quotationQuery.first();

        if (!quotation) {
            throw new ApiError({
                statusCode: 404,
                message: 'Quotation not found.',
            });
        }

        // Fetch line items
        const rawItems = await db('quotation_items AS QI')
            .select(
                'QI.*',
                'PR.item_code AS product_item_code',
                'PR.material_grade AS product_material_grade',
                'PR.dimensions AS product_dimensions',
                'PR.unit_weight_kg AS product_unit_weight_kg'
            )
            .leftJoin('products AS PR', 'QI.product_id', 'PR.id')
            .where('QI.quotation_id', id)
            .where('QI.is_active', true)
            .orderBy('QI.sort_order', 'asc')
            .orderBy('QI.id', 'asc');

        const items = rawItems.map(it => {
            let annexure = it.annexure_data;
            if (typeof annexure === 'string') {
                try { annexure = JSON.parse(annexure); } catch (_) {}
            }
            if (typeof annexure === 'string') {
                try { annexure = JSON.parse(annexure); } catch (_) {}
            }
            return {
                ...it,
                annexure_data: annexure
            };
        });

        let specConfig = quotation.table_spec_config;
        if (typeof specConfig === 'string') {
            try { specConfig = JSON.parse(specConfig); } catch (_) {}
        }

        return {
            ...quotation,
            table_spec_config: specConfig,
            items
        };
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('Error fetching quotation by ID:', error);
        throw new ApiError({
            statusCode: 500,
            message: 'Failed to retrieve quotation details.',
        });
    }
};

// Insert a new quotation with line items
const insertQuotation = async (data) => {
    return db.transaction(async (trx) => {
        const { firmId: contextFirmId, branchId: contextBranchId, userId } = getContext();
        const firmId = data.firm_id || contextFirmId;

        // Resolve internal firm branch
        let firmBranchId = data.firm_branch_id ? Number(data.firm_branch_id) : (contextBranchId ? Number(contextBranchId) : null);
        if (!firmBranchId && firmId) {
            const defaultBranch = await trx('firm_branches')
                .where({ firm_id: firmId, is_active: true, is_deleted: false })
                .orderByRaw('is_head_office DESC, id ASC')
                .first();
            if (defaultBranch) firmBranchId = defaultBranch.id;
        }

        // 1. Lock firm row to serialize concurrent quotation sequence generation
        const firm = await trx('firms')
            .where({ id: firmId })
            .forUpdate()
            .first();

        if (!firm) {
            throw new ApiError({
                statusCode: 404,
                message: 'Target firm does not exist.'
            });
        }

        // 2. Generate consecutive number if not specified or if already taken
        const targetRevisionNo = data.revision_no !== undefined ? parseInt(data.revision_no, 10) : 0;
        let quotationNo = data.quotation_no ? String(data.quotation_no).trim() : '';

        if (!quotationNo) {
            quotationNo = await calculateNextQuotationNumber(firmId, trx);
        } else if (targetRevisionNo === 0) {
            // Check if quotation_no already exists with revision_no: 0 for this firm
            const alreadyExists = await trx('quotations')
                .where({ firm_id: firmId, quotation_no: quotationNo, revision_no: 0 })
                .first('id');

            if (alreadyExists) {
                // If it already exists, auto-advance to next available sequential number
                quotationNo = await calculateNextQuotationNumber(firmId, trx);
            }
        }

        const quotationDate = data.quotation_date || new Date().toISOString().split('T')[0];
        const validityDays = parseInt(data.validity_days || 30, 10);
        const validityDate = new Date(new Date(quotationDate).getTime() + validityDays * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        // 3. Insert Quotation Header
        const [createdQuotation] = await trx('quotations')
            .insert({
                firm_id: firmId,
                firm_branch_id: firmBranchId,
                party_id: data.party_id || null,
                party_branch_id: data.party_branch_id || null,
                quotation_no: quotationNo,
                revision_no: data.revision_no !== undefined ? data.revision_no : 0,
                quotation_date: quotationDate,
                validity_days: validityDays,
                validity_date: validityDate,
                client_rfq_ref: data.client_rfq_ref || null,
                template_type: data.template_type || 'CARDS',
                include_annexure: data.include_annexure !== undefined ? data.include_annexure : (data.includeAnnexure !== undefined ? data.includeAnnexure : true),
                table_spec_config: data.table_spec_config ? JSON.stringify(data.table_spec_config) : null,
                customer_name: data.customer_name,
                gst_number: data.gst_number || null,
                contact_person: data.contact_person || null,
                contact_email: data.contact_email || null,
                contact_phone: data.contact_phone || null,
                billing_address: data.billing_address || null,
                shipping_address: data.shipping_address || null,
                place_of_supply: data.place_of_supply || null,
                payment_terms: data.payment_terms || '30 Days from delivery',
                delivery_period: data.delivery_period || '4-6 Weeks from PO',
                freight_basis: data.freight_basis || 'Ex-Works / Extra at actuals',
                warranty_terms: data.warranty_terms || '12 Months against manufacturing defects',
                special_notes: data.special_notes || null,
                terms_and_conditions: data.terms_and_conditions || null,
                sub_total: data.sub_total || 0,
                discount_percent: data.discount_percent || 0,
                discount_amount: data.discount_amount || 0,
                taxable_amount: data.taxable_amount || 0,
                cgst: data.cgst || 0,
                sgst: data.sgst || 0,
                igst: data.igst || 0,
                other: data.other !== undefined ? data.other : 0,
                total: data.total || 0,
                round_off: data.round_off || 0,
                status: data.status || 'DRAFT',
                approval_status: data.approval_status || 'PENDING',
                notes: data.notes || null,
                created_by: userId || null,
                updated_by: userId || null
            })
            .returning('*');

        const quotationId = createdQuotation.id;

        // 4. Insert Quotation Items
        if (Array.isArray(data.items) && data.items.length > 0) {
            const itemsToInsert = data.items.map((item, idx) => ({
                quotation_id: quotationId,
                product_id: item.product_id || null,
                item_name: item.item_name,
                description: item.description || null,
                drawing_number: item.drawing_number || null,
                hsn_sac_code: item.hsn_sac_code || null,
                qty: item.qty || 1,
                unit: item.unit || 'Nos',
                rate: item.rate || 0,
                discount_percent: item.discount_percent || 0,
                discount_amount: item.discount_amount || 0,
                sub_total: item.sub_total || (item.qty * item.rate),
                taxable_amount: item.taxable_amount || (item.qty * item.rate),
                gst_slab_id: item.gst_slab_id || null,
                tax_rate: item.tax_rate !== undefined ? item.tax_rate : 18.00,
                cgst: item.cgst || 0,
                sgst: item.sgst || 0,
                igst: item.igst || 0,
                total: item.total || 0,
                annexure_data: formatAnnexureData(item.annexure_data),
                sort_order: item.sort_order !== undefined ? item.sort_order : idx,
                created_by: userId || null,
                updated_by: userId || null
            }));

            await trx('quotation_items').insert(itemsToInsert);
        }

        return createdQuotation;
    });
};

// Update existing quotation and items
const updateQuotation = async (id, data) => {
    return db.transaction(async (trx) => {
        const { firmId: contextFirmId, userId } = getContext();
        const firmId = data.firm_id || contextFirmId;

        const existing = await trx('quotations')
            .where({ id })
            .first();

        if (!existing) {
            throw new ApiError({
                statusCode: 404,
                message: 'Quotation not found.',
            });
        }

        // If approved and not in revision mode, warn or require revision
        if (existing.approval_status === 'APPROVED' && data.force_update !== true && !data.is_revision) {
            throw new ApiError({
                statusCode: 400,
                message: 'This quotation is approved and locked. Create a new revision to make changes.'
            });
        }

        const quotationDate = data.quotation_date || existing.quotation_date;
        const validityDays = parseInt(data.validity_days || existing.validity_days || 30, 10);
        const validityDate = new Date(new Date(quotationDate).getTime() + validityDays * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        // Reset approval status if modified
        const newApprovalStatus = (existing.approval_status === 'APPROVED' && !data.keep_approval) 
            ? 'PENDING' 
            : (data.approval_status || existing.approval_status);

        const newStatus = (existing.status === 'APPROVED' && newApprovalStatus === 'PENDING')
            ? 'PENDING_APPROVAL'
            : (data.status || existing.status);

        let firmBranchId = data.firm_branch_id !== undefined ? (data.firm_branch_id ? Number(data.firm_branch_id) : null) : existing.firm_branch_id;
        if (!firmBranchId && firmId) {
            const defaultBranch = await trx('firm_branches')
                .where({ firm_id: firmId, is_active: true, is_deleted: false })
                .orderByRaw('is_head_office DESC, id ASC')
                .first();
            if (defaultBranch) firmBranchId = defaultBranch.id;
        }

        await trx('quotations')
            .where({ id })
            .update({
                firm_branch_id: firmBranchId,
                party_id: data.party_id !== undefined ? data.party_id : existing.party_id,
                party_branch_id: data.party_branch_id !== undefined ? data.party_branch_id : existing.party_branch_id,
                quotation_date: quotationDate,
                validity_days: validityDays,
                validity_date: validityDate,
                client_rfq_ref: data.client_rfq_ref !== undefined ? data.client_rfq_ref : existing.client_rfq_ref,
                template_type: data.template_type || existing.template_type,
                include_annexure: data.include_annexure !== undefined ? data.include_annexure : (data.includeAnnexure !== undefined ? data.includeAnnexure : existing.include_annexure),
                table_spec_config: data.table_spec_config ? JSON.stringify(data.table_spec_config) : existing.table_spec_config,
                customer_name: data.customer_name || existing.customer_name,
                gst_number: data.gst_number !== undefined ? data.gst_number : existing.gst_number,
                contact_person: data.contact_person !== undefined ? data.contact_person : existing.contact_person,
                contact_email: data.contact_email !== undefined ? data.contact_email : existing.contact_email,
                contact_phone: data.contact_phone !== undefined ? data.contact_phone : existing.contact_phone,
                billing_address: data.billing_address !== undefined ? data.billing_address : existing.billing_address,
                shipping_address: data.shipping_address !== undefined ? data.shipping_address : existing.shipping_address,
                place_of_supply: data.place_of_supply !== undefined ? data.place_of_supply : existing.place_of_supply,
                payment_terms: data.payment_terms !== undefined ? data.payment_terms : existing.payment_terms,
                delivery_period: data.delivery_period !== undefined ? data.delivery_period : existing.delivery_period,
                freight_basis: data.freight_basis !== undefined ? data.freight_basis : existing.freight_basis,
                warranty_terms: data.warranty_terms !== undefined ? data.warranty_terms : existing.warranty_terms,
                special_notes: data.special_notes !== undefined ? data.special_notes : existing.special_notes,
                terms_and_conditions: data.terms_and_conditions !== undefined ? data.terms_and_conditions : existing.terms_and_conditions,
                sub_total: data.sub_total !== undefined ? data.sub_total : existing.sub_total,
                discount_percent: data.discount_percent !== undefined ? data.discount_percent : existing.discount_percent,
                discount_amount: data.discount_amount !== undefined ? data.discount_amount : existing.discount_amount,
                taxable_amount: data.taxable_amount !== undefined ? data.taxable_amount : existing.taxable_amount,
                cgst: data.cgst !== undefined ? data.cgst : existing.cgst,
                sgst: data.sgst !== undefined ? data.sgst : existing.sgst,
                igst: data.igst !== undefined ? data.igst : existing.igst,
                other: data.other !== undefined ? data.other : existing.other,
                total: data.total !== undefined ? data.total : existing.total,
                round_off: data.round_off !== undefined ? data.round_off : existing.round_off,
                status: newStatus,
                approval_status: newApprovalStatus,
                notes: data.notes !== undefined ? data.notes : existing.notes,
                updated_by: userId || null
            });

        // Replace / sync items if provided
        if (Array.isArray(data.items)) {
            // Soft-delete old items
            await trx('quotation_items')
                .where({ quotation_id: id })
                .update({ is_active: false, deleted_at: new Date(), deleted_by: userId || null });

            // Insert new items
            if (data.items.length > 0) {
                const itemsToInsert = data.items.map((item, idx) => ({
                    quotation_id: id,
                    product_id: item.product_id || null,
                    item_name: item.item_name,
                    description: item.description || null,
                    drawing_number: item.drawing_number || null,
                    hsn_sac_code: item.hsn_sac_code || null,
                    qty: item.qty || 1,
                    unit: item.unit || 'Nos',
                    rate: item.rate || 0,
                    discount_percent: item.discount_percent || 0,
                    discount_amount: item.discount_amount || 0,
                    sub_total: item.sub_total || (item.qty * item.rate),
                    taxable_amount: item.taxable_amount || (item.qty * item.rate),
                    gst_slab_id: item.gst_slab_id || null,
                    tax_rate: item.tax_rate !== undefined ? item.tax_rate : 18.00,
                    cgst: item.cgst || 0,
                    sgst: item.sgst || 0,
                    igst: item.igst || 0,
                    total: item.total || 0,
                    annexure_data: formatAnnexureData(item.annexure_data),
                    sort_order: item.sort_order !== undefined ? item.sort_order : idx,
                    created_by: userId || null,
                    updated_by: userId || null,
                    is_active: true
                }));

                await trx('quotation_items').insert(itemsToInsert);
            }
        }

        return await fetchQuotationById(id);
    });
};

// Create a new revision from an existing quotation
const createQuotationRevision = async (id, data = {}) => {
    return db.transaction(async (trx) => {
        const { userId } = getContext();

        const baseQuotation = await trx('quotations').where({ id }).first();
        if (!baseQuotation) {
            throw new ApiError({
                statusCode: 404,
                message: 'Base quotation not found to revise.'
            });
        }

        // Determine max revision_no for this quotation_no
        const maxRevRow = await trx('quotations')
            .where({ quotation_no: baseQuotation.quotation_no, firm_id: baseQuotation.firm_id })
            .max('revision_no as max_rev')
            .first();

        const nextRevNo = (parseInt(maxRevRow?.max_rev || 0, 10)) + 1;

        // Fetch existing items
        const existingItems = await trx('quotation_items')
            .where({ quotation_id: id, is_active: true })
            .orderBy('sort_order', 'asc');

        const revisedItems = (Array.isArray(data.items) && data.items.length > 0) ? data.items : existingItems;

        const createdRev = await insertQuotation({
            ...baseQuotation,
            ...data,
            id: undefined,
            quotation_no: baseQuotation.quotation_no,
            revision_no: nextRevNo,
            status: 'DRAFT',
            approval_status: 'PENDING',
            approved_by: null,
            approved_at: null,
            rejection_reason: null,
            converted_to_po: false,
            purchase_order_id: null,
            items: revisedItems
        });

        return createdRev;
    });
};

// Admin Approval or Rejection
const approveQuotation = async (id, { approval_status, rejection_reason }) => {
    const { userId } = getContext();

    const existing = await db('quotations').where({ id }).first();
    if (!existing) {
        throw new ApiError({
            statusCode: 404,
            message: 'Quotation not found.'
        });
    }

    const isApproved = approval_status === 'APPROVED';

    const [updated] = await db('quotations')
        .where({ id })
        .update({
            approval_status: isApproved ? 'APPROVED' : 'REJECTED',
            status: isApproved ? 'APPROVED' : 'REJECTED',
            approved_by: isApproved ? userId : null,
            approved_at: isApproved ? new Date() : null,
            rejection_reason: isApproved ? null : (rejection_reason || 'Rejected by Admin'),
            updated_by: userId
        })
        .returning('*');

    return updated;
};

// Soft delete quotation
const deleteQuotation = async (id) => {
    const { userId } = getContext();

    const [deleted] = await db('quotations')
        .where({ id })
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        })
        .returning('*');

    if (!deleted) {
        throw new ApiError({
            statusCode: 404,
            message: 'Quotation not found.',
        });
    }

    return deleted;
};

// Restore soft-deleted quotation
const restoreQuotation = async (id) => {
    const { userId } = getContext();

    const [restored] = await db('quotations')
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
            message: 'Quotation not found.',
        });
    }

    return restored;
};

// Bulk delete quotations
const bulkDeleteQuotations = async (ids = []) => {
    const { userId } = getContext();

    const count = await db('quotations')
        .whereIn('id', ids)
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        });

    return { affected: count };
};

// Bulk restore quotations
const bulkRestoreQuotations = async (ids = []) => {
    const { userId } = getContext();

    const count = await db('quotations')
        .whereIn('id', ids)
        .update({
            is_active: true,
            deleted_at: null,
            deleted_by: null,
            updated_by: userId || null
        });

    return { affected: count };
};

module.exports = {
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
    bulkRestoreQuotations,
    calculateNextQuotationNumber
};
