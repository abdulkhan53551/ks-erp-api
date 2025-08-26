const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");

// Fetch all purchase order
const fetchAllPurchaseOrder = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;

        const baseQuery = db('purchase_orders AS PO')
            .select(
                'PO.id AS po_id',
                'PO.po_no',
                'PO.po_date',
                'PO.is_invoiced',
                'I.invoice_no',
                'PO.customer_name'
            )
            .leftJoin('invoices AS I', 'PO.invoice_id', 'I.id')
            .where('PO.is_active', true);

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
        const { page = 1, pageSize = 10, search = '' } = query;

        const baseQuery = db('purchase_orders').where('is_active', true)

        // if (search) {
        //     baseQuery.andWhere('f.firm_name', 'ilike', `%${search}%`);
        // }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order meta data.',
        });
    }
}

// Fetch purchase order by ID
const fetchPurchaseOrderById = async (id) => {
    try {
        const purchaseOrder = await db('purchase_orders AS PO')
            .select(
                'PO.id AS po_id',
                'PO.po_no',
                'PO.po_date',
                'PO.is_invoiced',
                'PO.invoice_id',
                'PO.customer_name'
            )
            .leftJoin('invoices AS I', 'PO.invoice_id', 'I.id')
            .where('PO.id', id)
            .andWhere('PO.is_active', true)
            .first();

        return purchaseOrder || null;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order by ID.',
        });
    }
};

// Fetch purchase order by invoice ID
const fetchPurchaseOrderByInvoiceId = async (invoiceId) => {
    try {
        const purchaseOrder = await db('purchase_orders AS PO')
            .select(
                'PO.id AS po_id',
                'PO.po_no',
                'PO.po_date',
                'PO.is_invoiced',
                'PO.invoice_id',
                'PO.customer_name'
            )
            .leftJoin('invoices AS I', 'PO.invoice_id', 'I.id')
            .where('PO.invoice_id', invoiceId)
            .andWhere('PO.is_active', true);

        return purchaseOrder;
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
            case 'purchase_orders_invoice_id_foreign':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to create purchase order.',
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
            case 'purchase_orders_invoice_id_foreign':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to create purchase order.',
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
        return updated;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting purchase order data.',
        });
    }
};

module.exports = {
    fetchAllPurchaseOrder,
    fetchPurchaseOrderMeta,
    fetchPurchaseOrderById,
    fetchPurchaseOrderByInvoiceId,
    insertPurchaseOrder,
    updatePurchaseOrderById,
    deletePurchaseOrderById
};
