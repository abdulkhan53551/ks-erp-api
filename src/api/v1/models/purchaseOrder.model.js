const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Fetch all purchase orders
const fetchAllPurchaseOrder = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', status } = query;
        const { firmId = 0 } = getContext();

        const baseQuery = db('purchase_orders AS PO')
            .select(
                'PO.id AS po_id',
                'PO.po_no',
                'PO.po_date',
                'PO.status',
                'PO.customer_name',
                db.raw(`(
                    SELECT STRING_AGG(DISTINCT I.invoice_no::text, ', ' ORDER BY I.invoice_no::text)
                    FROM purchase_order_invoices POI
                    JOIN invoices I ON POI.invoice_id = I.id AND I.is_active = true
                    WHERE POI.purchase_order_id = "PO"."id" AND POI.is_active = true
                ) AS invoice_no`),
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'PO.updated_at'
            )
            .leftJoin('users AS u', 'PO.created_by', 'u.id')
            .where('PO.is_active', true)
            .andWhere('PO.firm_id', firmId);

        if (status) {
            baseQuery.where('PO.status', status);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('PO.po_no', 'ilike', `%${search}%`)
                    .orWhere('PO.customer_name', 'ilike', `%${search}%`);
            });
        }

        baseQuery.orderBy('PO.id', 'desc');

        // Fetch paginated data
        const purchaseOrders = await fetchPageData({ baseQuery, page, pageSize });

        return purchaseOrders;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order.',
        });
    }
};

// Fetch purchase order meta data for pagination
const fetchPurchaseOrderMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', status } = query;
        const { firmId = 0 } = getContext();

        const baseQuery = db('purchase_orders')
            .where('is_active', true)
            .andWhere('firm_id', firmId);

        if (status) {
            baseQuery.where('status', status);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('po_no', 'ilike', `%${search}%`)
                    .orWhere('customer_name', 'ilike', `%${search}%`);
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

// Fetch purchase order by ID
const fetchPurchaseOrderById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const purchaseOrder = await db('purchase_orders AS PO')
            .select(
                'PO.id AS po_id',
                'PO.po_no',
                'PO.po_date',
                'PO.status',
                'PO.customer_name'
            )
            .where('PO.id', id)
            .andWhere('PO.firm_id', firmId)
            .andWhere('PO.is_active', true)
            .first();

        if (!purchaseOrder) {
            return null;
        }

        // Fetch mapped invoices
        const mappedInvoices = await db('purchase_order_invoices AS POI')
            .select('I.id AS invoice_id', 'I.invoice_no', 'I.invoice_date')
            .join('invoices AS I', 'POI.invoice_id', 'I.id')
            .where({ 'POI.purchase_order_id': id, 'POI.is_active': true, 'I.is_active': true });

        purchaseOrder.invoices = mappedInvoices;
        purchaseOrder.invoice_ids = mappedInvoices.map(inv => inv.invoice_id);

        return purchaseOrder;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order by ID.',
        });
    }
};

// Fetch purchase order by invoice ID (for invoice selection list)
const fetchPurchaseOrderByInvoiceId = async (invoiceId, includeUnmappedPurchaseOrders) => {
    try {
        const { firmId = 0 } = getContext();
        const baseQuery = db('purchase_orders AS PO')
            .select(
                'PO.id AS po_id',
                'PO.po_no',
                'PO.po_date',
                'PO.status',
                'PO.customer_name'
            )
            .where('PO.firm_id', firmId)
            .andWhere('PO.is_active', true);

        if (includeUnmappedPurchaseOrders) {
            baseQuery.andWhere(function () {
                this.where('PO.status', 'OPEN');
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
            message: 'Something went wrong while fetching purchase order by invoice ID.',
        });
    }
};

// Insert a new purchase order
const insertPurchaseOrder = async (data) => {
    try {
        const [result] = await db('purchase_orders').insert(data).returning('id');
        return result?.id || null;
    } catch (err) {
        switch (err.constraint) {
            case 'purchase_orders_firm_id_po_no_unique':
                throw new ApiError({
                    statusCode: 409,
                    message: 'This PO is already created.',
                });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while inserting purchase order data.',
        });
    }
};

// Update purchase order by ID
const updatePurchaseOrderById = async (id, data) => {
    try {
        const affectedRows = await db('purchase_orders').where({ id }).update(data);
        return affectedRows;
    } catch (err) {
        switch (err.constraint) {
            case 'purchase_orders_firm_id_po_no_unique':
                throw new ApiError({
                    statusCode: 409,
                    message: 'This PO is already created.',
                });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating purchase order data.',
        });
    }
};

// Delete purchase order by ID
const deletePurchaseOrderById = async (id, isPermanentDelete) => {
    try {
        // Hard delete
        if (isPermanentDelete) {
            const result = await db('purchase_orders').where({ id: id }).del();
            return result > 0;
        }

        // Soft delete
        const updated = await db('purchase_orders').update({ is_active: false }).where({ id });
        if (updated) {
            await db('purchase_order_invoices').update({ is_active: false }).where({ purchase_order_id: id });
        }
        return updated;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting purchase order data.',
        });
    }
};

/**
 * Safely update purchase-order → invoice mapping using junction table purchase_order_invoices
 * with strict validation to prevent invalid mappings and duplicates.
 */
const updateInvoicePurchaseOrderMapping = async (trx, invoiceId, newPurchaseOrderIds) => {
    const { firmId = 0 } = getContext();

    const uniqueNewIds = [...new Set((newPurchaseOrderIds || []).map(Number))];

    // 0️⃣ Validate: Ensure all provided PO IDs belong to this firm and are active
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

        // 1️⃣ Fetch existing POs mapped to this invoice
        const existing = await trx('purchase_order_invoices')
            .select('purchase_order_id')
            .where({ invoice_id: invoiceId, is_active: true });

        const oldIds = existing.map(po => po.purchase_order_id);

        // 2️⃣ Calculate differential update
        const toAdd = uniqueNewIds.filter(id => !oldIds.includes(id));
        const toRemove = oldIds.filter(id => !uniqueNewIds.includes(id));

        // 3️⃣ Ensure any newly added PO has OPEN status
        if (toAdd.length > 0) {
            const invalidStatusPOs = purchaseOrders.filter(po => toAdd.includes(po.id) && po.status !== 'OPEN');
            if (invalidStatusPOs.length > 0) {
                throw new ApiError({
                    statusCode: 400,
                    message: 'Only OPEN purchase orders can be linked to an invoice.',
                });
            }

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

        // 4️⃣ Unmap removed POs
        if (toRemove.length > 0) {
            await trx('purchase_order_invoices')
                .where({ invoice_id: invoiceId })
                .whereIn('purchase_order_id', toRemove)
                .update({ is_active: false });
        }

        return { added: toAdd, removed: toRemove };
    } else {
        // If empty list provided, deactivate any existing mapped POs for this invoice
        await trx('purchase_order_invoices')
            .where({ invoice_id: invoiceId, is_active: true })
            .update({ is_active: false });

        return { added: [], removed: [] };
    }
};

module.exports = {
    fetchAllPurchaseOrder,
    fetchPurchaseOrderMeta,
    fetchPurchaseOrderById,
    fetchPurchaseOrderByInvoiceId,
    insertPurchaseOrder,
    updatePurchaseOrderById,
    deletePurchaseOrderById,
    updateInvoicePurchaseOrderMapping
};
