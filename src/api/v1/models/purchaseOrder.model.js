const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Fetch all purchase orders (Customer PO / Receivable)
const fetchAllPurchaseOrder = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', status, trash = false, startDate = '', endDate = '' } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0 } = getContext();

        const baseQuery = db('purchase_orders AS PO')
            .select(
                'PO.id',
                'PO.id AS poId',
                'PO.po_no AS poNo',
                'PO.po_date AS poDate',
                'PO.status',
                'PO.customer_name AS customerName',
                'PO.party_id AS partyId',
                'P.legal_name AS partyLegalName',
                'P.display_name AS partyDisplayName',
                'P.gstin AS partyGstin',
                'PO.party_branch_id AS partyBranchId',
                'PB.branch_name AS partyBranchName',
                'PO.firm_branch_id AS firmBranchId',
                'FB.branch_name AS firmBranchName',
                'FB.branch_code AS firmBranchCode',
                'PO.firm_id AS firmId',
                'F.firm_name AS firmName',
                'PO.delivery_due_date AS deliveryDueDate',
                'PO.valid_until AS validUntil',
                'PO.payment_terms AS paymentTerms',
                'PO.advance_percentage AS advancePercentage',
                'PO.total_quantity AS totalQuantity',
                'PO.sub_total AS subTotal',
                'PO.taxable_amount AS taxableAmount',
                'PO.tax_amount AS taxAmount',
                'PO.total_amount AS totalAmount',
                'PO.billing_address AS billingAddress',
                'PO.delivery_address AS deliveryAddress',
                'PO.notes',
                db.raw(`(
                    SELECT STRING_AGG(DISTINCT I.invoice_no::text, ', ' ORDER BY I.invoice_no::text)
                    FROM purchase_order_invoices POI
                    JOIN invoices I ON POI.invoice_id = I.id AND I.is_active = true
                    WHERE POI.purchase_order_id = "PO"."id" AND POI.is_active = true
                ) AS "invoiceNo"`),
                db.raw(`(
                    SELECT COALESCE(SUM(poi.invoiced_qty), 0)
                    FROM purchase_order_items poi
                    WHERE poi.purchase_order_id = "PO"."id" AND poi.is_active = true
                ) AS "invoicedQuantity"`),
                db.raw(`(
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN poi.qty > 0 THEN (poi.total / poi.qty) * poi.invoiced_qty 
                            ELSE poi.invoiced_qty * poi.rate * (1 + poi.gst_rate / 100)
                        END
                    ), 0)
                    FROM purchase_order_items poi
                    WHERE poi.purchase_order_id = "PO"."id" AND poi.is_active = true
                ) AS "billedAmount"`),
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS "createdBy"`),
                'PO.created_at AS createdAt',
                'PO.updated_at AS updatedAt',
                'PO.deleted_at AS deletedAt',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS "deletedBy"`)
            )
            .leftJoin('firm_branches AS FB', 'PO.firm_branch_id', 'FB.id')
            .leftJoin('firms AS F', 'PO.firm_id', 'F.id')
            .leftJoin('parties AS P', 'PO.party_id', 'P.id')
            .leftJoin('party_branches AS PB', 'PO.party_branch_id', 'PB.id')
            .leftJoin('users AS u', 'PO.created_by', 'u.id')
            .leftJoin('users AS du', 'PO.deleted_by', 'du.id')
            .where('PO.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('PO.firm_id', firmId);
        }

        const { branchId = null } = getContext();
        if (branchId) {
            baseQuery.andWhere('PO.firm_branch_id', branchId);
        }

        if (status) {
            baseQuery.where('PO.status', status);
        }

        if (startDate) {
            baseQuery.andWhere('PO.po_date', '>=', startDate);
        }

        if (endDate) {
            baseQuery.andWhere('PO.po_date', '<=', endDate);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('PO.po_no', 'ilike', `%${search}%`)
                    .orWhere('PO.customer_name', 'ilike', `%${search}%`)
                    .orWhere('P.legal_name', 'ilike', `%${search}%`)
                    .orWhere('P.display_name', 'ilike', `%${search}%`);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('PO.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('PO.id', 'desc');
        }

        // Fetch paginated data
        const purchaseOrders = await fetchPageData({ baseQuery, page, pageSize });

        return purchaseOrders;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase orders.',
        });
    }
};

// Fetch purchase order meta data for pagination
const fetchPurchaseOrderMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', status, trash = false, startDate = '', endDate = '' } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('purchase_orders AS PO')
            .leftJoin('parties AS P', 'PO.party_id', 'P.id')
            .where('PO.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('PO.firm_id', firmId);
        }

        if (branchId) {
            baseQuery.andWhere('PO.firm_branch_id', branchId);
        }

        if (status) {
            baseQuery.where('PO.status', status);
        }

        if (startDate) {
            baseQuery.andWhere('PO.po_date', '>=', startDate);
        }

        if (endDate) {
            baseQuery.andWhere('PO.po_date', '<=', endDate);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('PO.po_no', 'ilike', `%${search}%`)
                    .orWhere('PO.customer_name', 'ilike', `%${search}%`)
                    .orWhere('P.legal_name', 'ilike', `%${search}%`)
                    .orWhere('P.display_name', 'ilike', `%${search}%`);
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order meta data.',
        });
    }
};

// Fetch purchase order executive financial summary
const fetchPurchaseOrderSummary = async (query = {}) => {
    try {
        const { search = '', status = '', trash = false, startDate = '', endDate = '' } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('purchase_orders AS PO')
            .leftJoin('parties AS P', 'PO.party_id', 'P.id')
            .where('PO.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('PO.firm_id', firmId);
        }

        if (branchId) {
            baseQuery.andWhere('PO.firm_branch_id', branchId);
        }

        if (status && status !== 'ALL') {
            baseQuery.andWhere('PO.status', status);
        }

        if (startDate) {
            baseQuery.andWhere('PO.po_date', '>=', startDate);
        }

        if (endDate) {
            baseQuery.andWhere('PO.po_date', '<=', endDate);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('PO.po_no', 'ilike', `%${search}%`)
                    .orWhere('PO.customer_name', 'ilike', `%${search}%`)
                    .orWhere('P.legal_name', 'ilike', `%${search}%`)
                    .orWhere('P.display_name', 'ilike', `%${search}%`);
            });
        }

        const summaryRow = await baseQuery.clone()
            .clearSelect()
            .clearOrder()
            .select(
                db.raw('COUNT(DISTINCT "PO"."id") as total_count'),
                db.raw('COALESCE(SUM("PO"."total_amount"), 0) as total_order_value'),
                db.raw(`COUNT(DISTINCT CASE WHEN "PO"."status" = 'OPEN' OR "PO"."status" IS NULL THEN "PO"."id" END) as open_count`),
                db.raw(`COUNT(DISTINCT CASE WHEN "PO"."status" = 'PARTIALLY_INVOICED' THEN "PO"."id" END) as partial_count`),
                db.raw(`COUNT(DISTINCT CASE WHEN "PO"."status" = 'COMPLETED' THEN "PO"."id" END) as completed_count`)
            )
            .first();

        // Calculate billed amount for matching POs
        const matchingPoIds = baseQuery.clone().clearSelect().clearOrder().select('PO.id');
        const billedRow = await db('purchase_order_items AS poi')
            .whereIn('poi.purchase_order_id', matchingPoIds)
            .andWhere('poi.is_active', true)
            .select(
                db.raw(`
                    COALESCE(SUM(
                        CASE 
                            WHEN poi.qty > 0 THEN (poi.total / poi.qty) * poi.invoiced_qty 
                            ELSE poi.invoiced_qty * poi.rate * (1 + poi.gst_rate / 100)
                        END
                    ), 0) AS total_billed_value
                `)
            )
            .first();

        const totalCount = parseInt(summaryRow?.total_count || 0, 10);
        const totalOrderValue = parseFloat(summaryRow?.total_order_value || 0);
        const totalBilledValue = parseFloat(billedRow?.total_billed_value || 0);
        const totalPendingValue = Math.max(0, totalOrderValue - totalBilledValue);

        return {
            totalCount,
            totalOrderValue,
            totalBilledValue,
            totalPendingValue,
            openCount: parseInt(summaryRow?.open_count || 0, 10),
            partialCount: parseInt(summaryRow?.partial_count || 0, 10),
            completedCount: parseInt(summaryRow?.completed_count || 0, 10)
        };
    } catch (error) {
        console.log('error in fetchPurchaseOrderSummary => ', error);
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order summary.'
        });
    }
};

// Fetch purchase order by ID (with line items and mapped invoices)
const fetchPurchaseOrderById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const poQuery = db('purchase_orders AS PO')
            .select(
                'PO.id',
                'PO.id AS poId',
                'PO.po_no AS poNo',
                'PO.po_date AS poDate',
                'PO.status',
                'PO.customer_name AS customerName',
                'PO.party_id AS partyId',
                'P.legal_name AS partyLegalName',
                'P.display_name AS partyDisplayName',
                'P.gstin AS partyGstin',
                'PO.party_branch_id AS partyBranchId',
                'PB.branch_name AS partyBranchName',
                'PO.firm_id AS firmId',
                'F.firm_name AS firmName',
                'PO.firm_branch_id AS firmBranchId',
                'FB.branch_name AS firmBranchName',
                'FB.branch_code AS firmBranchCode',
                'PO.billing_address AS billingAddress',
                'PO.delivery_address AS deliveryAddress',
                'PO.delivery_due_date AS deliveryDueDate',
                'PO.valid_until AS validUntil',
                'PO.payment_terms AS paymentTerms',
                'PO.advance_percentage AS advancePercentage',
                'PO.total_quantity AS totalQuantity',
                'PO.sub_total AS subTotal',
                'PO.taxable_amount AS taxableAmount',
                'PO.tax_amount AS taxAmount',
                'PO.total_amount AS totalAmount',
                'PO.notes',
                'PO.created_at AS createdAt',
                'PO.updated_at AS updatedAt'
            )
            .leftJoin('firm_branches AS FB', 'PO.firm_branch_id', 'FB.id')
            .leftJoin('firms AS F', 'PO.firm_id', 'F.id')
            .leftJoin('parties AS P', 'PO.party_id', 'P.id')
            .leftJoin('party_branches AS PB', 'PO.party_branch_id', 'PB.id')
            .where('PO.id', id)
            .andWhere('PO.is_active', true);

        if (firmId) {
            poQuery.andWhere('PO.firm_id', firmId);
        }

        const purchaseOrder = await poQuery.first();

        if (!purchaseOrder) {
            return null;
        }

        // Fetch line items
        const items = await db('purchase_order_items AS POI')
            .select(
                'POI.id',
                'POI.purchase_order_id AS purchaseOrderId',
                'POI.product_id AS productId',
                'PR.name AS productName',
                'POI.item_name AS itemName',
                'POI.description',
                'POI.hsn_sac_code AS hsnSacCode',
                'POI.qty',
                'POI.invoiced_qty AS invoicedQty',
                'POI.unit',
                'POI.rate',
                'POI.gst_rate AS gstRate',
                'POI.taxable_amount AS taxableAmount',
                'POI.cgst',
                'POI.sgst',
                'POI.igst',
                'POI.total',
                'POI.sort_order AS sortOrder'
            )
            .leftJoin('products AS PR', 'POI.product_id', 'PR.id')
            .where('POI.purchase_order_id', id)
            .andWhere('POI.is_active', true)
            .orderBy('POI.sort_order', 'asc')
            .orderBy('POI.id', 'asc');

        purchaseOrder.items = items || [];

        // Fetch mapped invoices
        const mappedInvoices = await db('purchase_order_invoices AS POI')
            .select('I.id AS invoiceId', 'I.invoice_no AS invoiceNo', 'I.invoice_date AS invoiceDate')
            .join('invoices AS I', 'POI.invoice_id', 'I.id')
            .where({ 'POI.purchase_order_id': id, 'POI.is_active': true, 'I.is_active': true });

        purchaseOrder.invoices = mappedInvoices || [];
        purchaseOrder.invoiceIds = mappedInvoices.map(inv => inv.invoiceId);

        return purchaseOrder;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order by ID.',
        });
    }
};

// Fetch purchase order by invoice ID (for invoice supporting documents selector)
const fetchPurchaseOrderByInvoiceId = async (invoiceId, includeUnmappedPurchaseOrders, partyId = null) => {
    try {
        const { firmId = 0 } = getContext();
        const baseQuery = db('purchase_orders AS PO')
            .select(
                'PO.id',
                'PO.id AS poId',
                'PO.po_no AS poNo',
                'PO.po_date AS poDate',
                'PO.status',
                'PO.customer_name AS customerName',
                'PO.party_id AS partyId',
                'PO.total_amount AS totalAmount',
                'PO.total_quantity AS totalQuantity'
            )
            .where('PO.firm_id', firmId)
            .andWhere('PO.is_active', true);

        if (includeUnmappedPurchaseOrders) {
            baseQuery.andWhere(function () {
                this.where('PO.status', 'OPEN')
                    .orWhere('PO.status', 'PARTIALLY_INVOICED');
                if (invoiceId && Number(invoiceId) > 0) {
                    this.orWhereExists(function () {
                        this.select('*')
                            .from('purchase_order_invoices AS POI')
                            .whereRaw('"POI"."purchase_order_id" = "PO"."id"')
                            .andWhere('POI.invoice_id', invoiceId)
                            .andWhere('POI.is_active', true);
                    });
                }
            });

            if (partyId && Number(partyId) > 0) {
                baseQuery.andWhere(function () {
                    this.where('PO.party_id', Number(partyId))
                        .orWhereNull('PO.party_id');
                });
            }
        } else {
            baseQuery.whereExists(function () {
                this.select('*')
                    .from('purchase_order_invoices AS POI')
                    .whereRaw('"POI"."purchase_order_id" = "PO"."id"')
                    .andWhere('POI.invoice_id', invoiceId)
                    .andWhere('POI.is_active', true);
            });
        }

        baseQuery.orderBy('PO.po_date', 'desc').orderBy('PO.id', 'desc');

        const purchaseOrders = await baseQuery;
        return purchaseOrders;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase orders by invoice ID.',
        });
    }
};

// Insert a new purchase order
const insertPurchaseOrder = async (headerData, items = []) => {
    // 1. Check if po_no already exists in active or trashed state
    const existingPO = await db('purchase_orders')
        .select('id', 'is_active', 'po_no')
        .where({ firm_id: headerData.firm_id, po_no: headerData.po_no })
        .first();

    if (existingPO) {
        if (existingPO.is_active) {
            throw new ApiError({
                statusCode: 409,
                message: `Purchase Order '${headerData.po_no}' already exists.`
            });
        } else {
            throw new ApiError({
                statusCode: 409,
                message: `Purchase Order '${headerData.po_no}' is currently in the Trash. Please restore it from the Recycle Bin or use a different PO number.`
            });
        }
    }

    // 2. Aggregate financial totals from items
    let totalQty = headerData.total_quantity || 0;
    let taxableAmount = headerData.taxable_amount || 0;
    let taxAmount = headerData.tax_amount || 0;
    let totalAmount = headerData.total_amount || 0;

    if (Array.isArray(items) && items.length > 0) {
        totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        taxableAmount = items.reduce((sum, it) => sum + (Number(it.taxableAmount || ((Number(it.qty) || 1) * (Number(it.rate) || 0))) || 0), 0);
        const cgstTotal = items.reduce((sum, it) => sum + (Number(it.cgst) || 0), 0);
        const sgstTotal = items.reduce((sum, it) => sum + (Number(it.sgst) || 0), 0);
        const igstTotal = items.reduce((sum, it) => sum + (Number(it.igst) || 0), 0);
        taxAmount = cgstTotal + sgstTotal + igstTotal;
        totalAmount = Number((taxableAmount + taxAmount).toFixed(2));
    }

    headerData.total_quantity = totalQty;
    headerData.sub_total = taxableAmount;
    headerData.taxable_amount = taxableAmount;
    headerData.tax_amount = taxAmount;
    headerData.total_amount = totalAmount;

    return await db.transaction(async (trx) => {
        try {
            const [result] = await trx('purchase_orders').insert(headerData).returning('id');
            const poId = result?.id || null;

            if (!poId) {
                throw new ApiError({ statusCode: 500, message: 'Failed to insert purchase order.' });
            }

            if (Array.isArray(items) && items.length > 0) {
                const itemRecords = items.map((it, idx) => ({
                    purchase_order_id: poId,
                    product_id: it.productId || null,
                    item_name: it.itemName,
                    description: it.description || null,
                    hsn_sac_code: it.hsnSacCode || null,
                    qty: Number(it.qty) || 1,
                    invoiced_qty: Number(it.invoicedQty) || 0,
                    unit: it.unit || 'Nos',
                    rate: Number(it.rate) || 0,
                    gst_rate: Number(it.gstRate) || 0,
                    taxable_amount: Number(it.taxableAmount) || ((Number(it.qty) || 1) * (Number(it.rate) || 0)),
                    cgst: Number(it.cgst) || 0,
                    sgst: Number(it.sgst) || 0,
                    igst: Number(it.igst) || 0,
                    total: Number(it.total) || 0,
                    sort_order: it.sortOrder !== undefined ? it.sortOrder : idx
                }));
                await trx('purchase_order_items').insert(itemRecords);
            }

            return poId;
        } catch (err) {
            if (err.constraint === 'purchase_orders_firm_id_po_no_unique') {
                throw new ApiError({
                    statusCode: 409,
                    message: 'Duplicate purchase order number found in this firm.',
                });
            }
            if (err instanceof ApiError) {
                throw err;
            }
            throw new ApiError({
                statusCode: 500,
                message: `Something went wrong while inserting purchase order data: ${err.message || ''}`,
            });
        }
    });
};

// Update purchase order by ID
const updatePurchaseOrderById = async (id, headerData, items) => {
    return await db.transaction(async (trx) => {
        try {
            if (Array.isArray(items)) {
                const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
                const taxableAmount = items.reduce((sum, it) => sum + (Number(it.taxableAmount || ((Number(it.qty) || 1) * (Number(it.rate) || 0))) || 0), 0);
                const cgstTotal = items.reduce((sum, it) => sum + (Number(it.cgst) || 0), 0);
                const sgstTotal = items.reduce((sum, it) => sum + (Number(it.sgst) || 0), 0);
                const igstTotal = items.reduce((sum, it) => sum + (Number(it.igst) || 0), 0);
                const taxAmount = cgstTotal + sgstTotal + igstTotal;
                const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

                headerData.total_quantity = totalQty;
                headerData.sub_total = taxableAmount;
                headerData.taxable_amount = taxableAmount;
                headerData.tax_amount = taxAmount;
                headerData.total_amount = totalAmount;
            }

            let affectedRows = 0;
            if (Object.keys(headerData).length > 0) {
                affectedRows = await trx('purchase_orders').where({ id }).update(headerData);
            }

            if (Array.isArray(items)) {
                await trx('purchase_order_items').where({ purchase_order_id: id }).del();

                if (items.length > 0) {
                    const itemRecords = items.map((it, idx) => ({
                        purchase_order_id: id,
                        product_id: it.productId || null,
                        item_name: it.itemName,
                        description: it.description || null,
                        hsn_sac_code: it.hsnSacCode || null,
                        qty: Number(it.qty) || 1,
                        invoiced_qty: Number(it.invoicedQty) || 0,
                        unit: it.unit || 'Nos',
                        rate: Number(it.rate) || 0,
                        gst_rate: Number(it.gstRate) || 0,
                        taxable_amount: Number(it.taxableAmount) || ((Number(it.qty) || 1) * (Number(it.rate) || 0)),
                        cgst: Number(it.cgst) || 0,
                        sgst: Number(it.sgst) || 0,
                        igst: Number(it.igst) || 0,
                        total: Number(it.total) || 0,
                        sort_order: it.sortOrder !== undefined ? it.sortOrder : idx
                    }));
                    await trx('purchase_order_items').insert(itemRecords);
                }
            }

            // Recalculate billing progress if already mapped to any invoices
            await syncPurchaseOrderBillingProgress(trx, id);

            return affectedRows || 1;
        } catch (err) {
            if (err.constraint === 'purchase_orders_firm_id_po_no_unique') {
                throw new ApiError({
                    statusCode: 409,
                    message: 'Duplicate purchase order number found in this firm.',
                });
            }
            if (err instanceof ApiError) {
                throw err;
            }
            throw new ApiError({
                statusCode: 500,
                message: `Something went wrong while updating purchase order data: ${err.message || ''}`,
            });
        }
    });
};

// Delete purchase order by ID
const deletePurchaseOrderById = async (id, isPermanentDelete) => {
    try {
        const { firmId = 0 } = getContext();

        // Check if linked to an active invoice
        const activeInvoice = await db('purchase_order_invoices as poi')
            .join('invoices as i', 'poi.invoice_id', 'i.id')
            .select('i.invoice_no')
            .where('poi.purchase_order_id', id)
            .andWhere('poi.is_active', true)
            .andWhere('i.is_active', true)
            .first();

        if (activeInvoice) {
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete Purchase Order because it is linked to active Invoice '${activeInvoice.invoice_no}'. Please unlink it from the invoice first.`
            });
        }

        const poWhere = firmId ? { id, firm_id: firmId } : { id };

        // Hard delete
        if (isPermanentDelete) {
            await db('purchase_order_items').where({ purchase_order_id: id }).del();
            await db('purchase_order_invoices').where({ purchase_order_id: id }).del();
            const result = await db('purchase_orders').where(poWhere).del();
            return result > 0;
        }

        // Soft delete (move to trash)
        const updated = await db('purchase_orders').where(poWhere).update({ is_active: false });
        if (updated) {
            await db('purchase_order_items').where({ purchase_order_id: id }).update({ is_active: false });
            await db('purchase_order_invoices').where({ purchase_order_id: id }).update({ is_active: false });
        }
        return updated > 0;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting purchase order data.',
        });
    }
};

// Bulk delete purchase orders
const bulkDeletePurchaseOrders = async (poIds = [], isPermanentDelete = false) => {
    if (!poIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        const activeInvoices = await db('purchase_order_invoices as poi')
            .join('invoices as i', 'poi.invoice_id', 'i.id')
            .join('purchase_orders as po', 'poi.purchase_order_id', 'po.id')
            .select('po.po_no', 'i.invoice_no')
            .whereIn('poi.purchase_order_id', poIds)
            .andWhere('poi.is_active', true)
            .andWhere('i.is_active', true);

        if (activeInvoices.length > 0) {
            const conflictList = activeInvoices.map(c => `PO '${c.po_no}' linked to Invoice '${c.invoice_no}'`).join(', ');
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete Purchase Orders: ${conflictList}. Please unlink them from invoices first.`
            });
        }

        const poQuery = db('purchase_orders').whereIn('id', poIds);
        if (firmId) {
            poQuery.andWhere({ firm_id: firmId });
        }

        if (isPermanentDelete) {
            await db('purchase_order_items').whereIn('purchase_order_id', poIds).del();
            await db('purchase_order_invoices').whereIn('purchase_order_id', poIds).del();
            return await poQuery.del();
        }

        // Soft delete
        const affectedRows = await poQuery.update({ is_active: false });
        await db('purchase_order_items').whereIn('purchase_order_id', poIds).update({ is_active: false });
        await db('purchase_order_invoices').whereIn('purchase_order_id', poIds).update({ is_active: false });

        return affectedRows;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting purchase orders.',
        });
    }
};

// Restore purchase order by ID
const restorePurchaseOrderById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const poQuery = db('purchase_orders').where({ id, is_active: false });
        if (firmId) {
            poQuery.andWhere({ firm_id: firmId });
        }
        const po = await poQuery.first();

        if (!po) {
            throw new ApiError({
                statusCode: 404,
                message: 'Purchase Order not found in Trash or already active.'
            });
        }

        const restoreQuery = db('purchase_orders').where({ id });
        if (firmId) {
            restoreQuery.andWhere({ firm_id: firmId });
        }
        const affectedRows = await restoreQuery.update({ is_active: true });
        if (affectedRows > 0) {
            await db('purchase_order_items').where({ purchase_order_id: id }).update({ is_active: true });
        }

        return affectedRows > 0;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring purchase order.',
        });
    }
};

// Bulk restore purchase orders
const bulkRestorePurchaseOrders = async (poIds = []) => {
    if (!poIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        const affectedRows = await db('purchase_orders')
            .whereIn('id', poIds)
            .andWhere({ firm_id: firmId, is_active: false })
            .update({ is_active: true });

        if (affectedRows > 0) {
            await db('purchase_order_items').whereIn('purchase_order_id', poIds).update({ is_active: true });
        }

        return affectedRows;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring purchase orders.',
        });
    }
};

/**
 * Automatically compute invoiced (billed) quantities for purchase order items
 * based on active linked invoices and their line items, and update PO status.
 *
 * Highly optimized batch processing:
 * 1. Exactly 4 batched SELECT queries total (zero queries inside loops).
 * 2. In-memory quantity matching and reconciliation.
 * 3. Bulk atomic updates executed only for rows whose values actually changed.
 *
 * @param {Object} trxOrDb - Knex transaction or db instance
 * @param {Array<number>|number} poIds - One or more purchase order IDs
 */
const syncPurchaseOrderBillingProgress = async (trxOrDb, poIds) => {
    const rawIds = Array.isArray(poIds) ? poIds : [poIds];
    const uniquePoIds = [...new Set(rawIds.map(Number).filter(id => id > 0))];
    if (!uniquePoIds.length) return;

    // 1. Batch fetch current PO statuses (1 Query)
    const currentPos = await trxOrDb('purchase_orders')
        .select('id', 'status')
        .whereIn('id', uniquePoIds);

    if (!currentPos.length) return;
    const poMap = new Map(currentPos.map(p => [Number(p.id), p]));

    // 2. Batch fetch active invoices mapped to all requested POs (1 Query)
    const linkedRows = await trxOrDb('purchase_order_invoices AS poi')
        .join('invoices AS i', 'poi.invoice_id', 'i.id')
        .whereIn('poi.purchase_order_id', uniquePoIds)
        .where('poi.is_active', true)
        .where('i.is_active', true)
        .select('poi.purchase_order_id AS poId', 'i.id AS invoiceId');

    const poToInvoiceIds = new Map();
    const allActiveInvoiceIds = new Set();
    for (const poId of uniquePoIds) {
        poToInvoiceIds.set(poId, []);
    }
    for (const row of linkedRows) {
        const poId = Number(row.poId);
        const invId = Number(row.invoiceId);
        if (poToInvoiceIds.has(poId)) {
            poToInvoiceIds.get(poId).push(invId);
            allActiveInvoiceIds.add(invId);
        }
    }

    // 3. Batch fetch all active items for all requested POs (1 Query)
    const allPoItems = await trxOrDb('purchase_order_items')
        .whereIn('purchase_order_id', uniquePoIds)
        .where('is_active', true)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc');

    const poToItems = new Map();
    for (const poId of uniquePoIds) {
        poToItems.set(poId, []);
    }
    for (const item of allPoItems) {
        const poId = Number(item.purchase_order_id);
        if (poToItems.has(poId)) {
            poToItems.get(poId).push(item);
        }
    }

    // 4. Batch fetch line items from all active linked invoices in 1 Query
    let allBilledInvoiceItems = [];
    if (allActiveInvoiceIds.size > 0) {
        allBilledInvoiceItems = await trxOrDb('invoice_items')
            .whereIn('invoice_id', [...allActiveInvoiceIds])
            .where('is_active', true)
            .select('id', 'invoice_id AS invoiceId', 'product_id', 'description', 'qty');
    }

    const invoiceToItems = new Map();
    for (const item of allBilledInvoiceItems) {
        const invId = Number(item.invoiceId);
        if (!invoiceToItems.has(invId)) {
            invoiceToItems.set(invId, []);
        }
        invoiceToItems.get(invId).push({
            id: item.id,
            product_id: item.product_id ? Number(item.product_id) : null,
            qty: Number(item.qty) || 0,
            descNormalized: (item.description || '').trim().toLowerCase()
        });
    }

    // 5. In-Memory Calculation & Diff Collection
    const itemUpdates = [];
    const poStatusUpdates = [];

    for (const poId of uniquePoIds) {
        const currentPo = poMap.get(poId);
        if (!currentPo) continue;

        const poItems = poToItems.get(poId) || [];
        if (!poItems.length) continue;

        const activeInvoiceIds = poToInvoiceIds.get(poId) || [];

        if (activeInvoiceIds.length === 0) {
            // No active invoices mapped: reset invoiced_qty to 0
            for (const poItem of poItems) {
                if (Number(poItem.invoiced_qty || 0) !== 0) {
                    itemUpdates.push({ id: poItem.id, invoiced_qty: 0 });
                }
            }

            // Do not reopen if order was manually COMPLETED (short-closed) or CANCELLED
            if (currentPo.status !== 'CANCELLED' && currentPo.status !== 'COMPLETED' && currentPo.status !== 'OPEN') {
                poStatusUpdates.push({ id: poId, status: 'OPEN' });
            }
            continue;
        }

        // Deep copy of invoice items available for this PO
        const invoiceItemRemaining = [];
        for (const invId of activeInvoiceIds) {
            const itemsForInv = invoiceToItems.get(invId) || [];
            for (const it of itemsForInv) {
                invoiceItemRemaining.push({
                    ...it,
                    availableQty: it.qty
                });
            }
        }

        let totalOrderedQty = 0;
        let totalBilledQty = 0;

        for (const poItem of poItems) {
            const orderedQty = Number(poItem.qty) || 0;
            totalOrderedQty += orderedQty;

            let allocatedBilledQty = 0;
            const poItemNameNorm = (poItem.item_name || '').trim().toLowerCase();
            const poItemProductId = poItem.product_id ? Number(poItem.product_id) : null;

            // Pass 1: Match by product_id
            if (poItemProductId) {
                for (const invItem of invoiceItemRemaining) {
                    if (invItem.availableQty > 0 && invItem.product_id && invItem.product_id === poItemProductId) {
                        const needed = orderedQty > 0 ? (orderedQty - allocatedBilledQty) : invItem.availableQty;
                        const take = Math.min(invItem.availableQty, Math.max(0, needed));
                        if (take > 0) {
                            allocatedBilledQty += take;
                            invItem.availableQty -= take;
                        }
                    }
                }
            }

            // Pass 2: Match by normalized description / item name
            for (const invItem of invoiceItemRemaining) {
                if (invItem.availableQty > 0 && invItem.descNormalized && poItemNameNorm && invItem.descNormalized === poItemNameNorm) {
                    const needed = orderedQty > 0 ? (orderedQty - allocatedBilledQty) : invItem.availableQty;
                    const take = Math.min(invItem.availableQty, Math.max(0, needed));
                    if (take > 0) {
                        allocatedBilledQty += take;
                        invItem.availableQty -= take;
                    }
                }
            }

            // Pass 3: Surplus on invoice items matching this product
            if (poItemProductId) {
                for (const invItem of invoiceItemRemaining) {
                    if (invItem.availableQty > 0 && invItem.product_id && invItem.product_id === poItemProductId) {
                        allocatedBilledQty += invItem.availableQty;
                        invItem.availableQty = 0;
                    }
                }
            }

            allocatedBilledQty = Number(allocatedBilledQty.toFixed(4));
            totalBilledQty += allocatedBilledQty;

            // Collect update only if value actually changed
            if (Number(Number(poItem.invoiced_qty || 0).toFixed(4)) !== allocatedBilledQty) {
                itemUpdates.push({ id: poItem.id, invoiced_qty: allocatedBilledQty });
            }
        }

        // Determine PO fulfillment status
        const isManuallyClosedOrCancelled = currentPo.status === 'CANCELLED' || currentPo.status === 'COMPLETED';
        if (!isManuallyClosedOrCancelled) {
            let newStatus = 'OPEN';
            if (totalBilledQty >= totalOrderedQty && totalOrderedQty > 0) {
                newStatus = 'COMPLETED';
            } else if (totalBilledQty > 0) {
                newStatus = 'PARTIALLY_INVOICED';
            }

            if (currentPo.status !== newStatus) {
                poStatusUpdates.push({ id: poId, status: newStatus });
            }
        }
    }

    // 6. Bulk Updates using CASE in single queries (0 loop queries)
    if (itemUpdates.length > 0) {
        const caseStatements = itemUpdates
            .map(u => `WHEN id = ${Number(u.id)} THEN ${Number(u.invoiced_qty)}`)
            .join(' ');
        const ids = itemUpdates.map(u => Number(u.id)).join(', ');
        await trxOrDb.raw(`
            UPDATE purchase_order_items
            SET invoiced_qty = CASE ${caseStatements} END
            WHERE id IN (${ids})
        `);
    }

    if (poStatusUpdates.length > 0) {
        const caseStatements = poStatusUpdates
            .map(u => `WHEN id = ${Number(u.id)} THEN '${u.status.replace(/[^A-Z_]/g, '')}'`)
            .join(' ');
        const ids = poStatusUpdates.map(u => Number(u.id)).join(', ');
        await trxOrDb.raw(`
            UPDATE purchase_orders
            SET status = CASE ${caseStatements} END
            WHERE id IN (${ids})
        `);
    }
};

/**
 * Safely update purchase-order → invoice mapping using junction table purchase_order_invoices
 */
const updateInvoicePurchaseOrderMapping = async (trx, invoiceId, newPurchaseOrderIds) => {
    const { firmId = 0 } = getContext();

    const uniqueNewIds = [...new Set((newPurchaseOrderIds || []).map(Number))];

    const existing = await trx('purchase_order_invoices')
        .select('purchase_order_id')
        .where({ invoice_id: invoiceId, is_active: true });

    const oldIds = existing.map(po => po.purchase_order_id);

    let toAdd = [];
    let toRemove = [];

    if (uniqueNewIds.length > 0) {
        const purchaseOrders = await trx('purchase_orders')
            .select('id', 'status')
            .whereIn('id', uniqueNewIds)
            .where('firm_id', firmId)
            .where('is_active', true);

        if (purchaseOrders.length !== uniqueNewIds.length) {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid purchase order ID provided.',
            });
        }

        toAdd = uniqueNewIds.filter(id => !oldIds.includes(id));
        toRemove = oldIds.filter(id => !uniqueNewIds.includes(id));

        if (toAdd.length > 0) {
            for (const poId of toAdd) {
                const existingRecord = await trx('purchase_order_invoices')
                    .where({ purchase_order_id: poId, invoice_id: invoiceId })
                    .first();

                if (existingRecord) {
                    await trx('purchase_order_invoices')
                        .where({ id: existingRecord.id })
                        .update({ is_active: true });
                } else {
                    await trx('purchase_order_invoices').insert({
                        purchase_order_id: poId,
                        invoice_id: invoiceId,
                        is_active: true,
                    });
                }
            }
        }

        if (toRemove.length > 0) {
            await trx('purchase_order_invoices')
                .where({ invoice_id: invoiceId })
                .whereIn('purchase_order_id', toRemove)
                .update({ is_active: false });
        }
    } else {
        toRemove = [...oldIds];
        await trx('purchase_order_invoices')
            .where({ invoice_id: invoiceId, is_active: true })
            .update({ is_active: false });
    }

    const affectedPoIds = [...new Set([...uniqueNewIds, ...oldIds])];
    if (affectedPoIds.length > 0) {
        await syncPurchaseOrderBillingProgress(trx, affectedPoIds);
    }

    return { added: toAdd, removed: toRemove };
};

module.exports = {
    fetchAllPurchaseOrder,
    fetchPurchaseOrderMeta,
    fetchPurchaseOrderSummary,
    fetchPurchaseOrderById,
    fetchPurchaseOrderByInvoiceId,
    insertPurchaseOrder,
    updatePurchaseOrderById,
    deletePurchaseOrderById,
    bulkDeletePurchaseOrders,
    restorePurchaseOrderById,
    bulkRestorePurchaseOrders,
    syncPurchaseOrderBillingProgress,
    updateInvoicePurchaseOrderMapping
};
