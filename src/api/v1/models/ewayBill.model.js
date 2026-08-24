const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Fetch all eway bills
const fetchAllEwayBill = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0 } = getContext();

        const baseQuery = db('eway_bills AS EB')
            .select(
                'EB.id AS eway_bill_id',
                'EB.eway_bill_no',
                'EB.eway_bill_date',
                'EB.valid_upto',
                db.raw('("EB"."invoice_id" IS NOT NULL) AS is_invoiced'),
                'I.invoice_no',
                'EB.customer_name',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'EB.created_at',
                'EB.updated_at',
                'EB.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .leftJoin('users AS u', 'EB.created_by', 'u.id')
            .leftJoin('users AS du', 'EB.deleted_by', 'du.id')
            .where('EB.is_active', !isTrash)
            .andWhere('EB.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('EB.eway_bill_no', 'ilike', `%${search}%`)
                    .orWhere('EB.customer_name', 'ilike', `%${search}%`);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('EB.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('EB.id', 'desc');
        }

        // Fetch paginated data
        const result = await fetchPageData({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching eway bills.',
        });
    }
};

// Fetch eway bill meta data for pagination
const fetchEwayBillMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0 } = getContext();

        const baseQuery = db('eway_bills AS EB')
            .where('EB.is_active', !isTrash)
            .andWhere('EB.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('EB.eway_bill_no', 'ilike', `%${search}%`)
                    .orWhere('EB.customer_name', 'ilike', `%${search}%`);
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching eway bill meta data.',
        });
    }
};

// Fetch eway bill by ID
const fetchEwayBillById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const result = await db('eway_bills AS EB')
            .select(
                'EB.id AS eway_bill_id',
                'EB.eway_bill_no',
                'EB.eway_bill_date',
                'EB.valid_upto',
                db.raw('("EB"."invoice_id" IS NOT NULL) AS is_invoiced'),
                'EB.invoice_id',
                'EB.customer_name',
                'I.invoice_no'
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .where('EB.id', id)
            .andWhere('EB.firm_id', firmId)
            .andWhere('EB.is_active', true)
            .first();

        return result || null;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching eway bill by ID.',
        });
    }
};

// Fetch eway bill by invoice ID (for invoice selection list and invoice details)
const fetchEwayBillByInvoiceId = async (invoiceId, includeUnmappedEwayBills) => {
    try {
        const { firmId = 0 } = getContext();
        const baseQuery = db('eway_bills AS EB')
            .select(
                'EB.id AS eway_bill_id',
                'EB.eway_bill_no',
                'EB.eway_bill_date',
                'EB.valid_upto',
                db.raw('("EB"."invoice_id" IS NOT NULL) AS is_invoiced'),
                'EB.invoice_id',
                'EB.customer_name'
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .where('EB.firm_id', firmId)
            .andWhere('EB.is_active', true);

        if (includeUnmappedEwayBills) {
            baseQuery.andWhere(function () {
                this.whereNull('EB.invoice_id');
                if (invoiceId && Number(invoiceId) > 0) {
                    this.orWhere('EB.invoice_id', invoiceId);
                }
            });
        } else {
            baseQuery.where('EB.invoice_id', invoiceId);
        }

        baseQuery.orderBy('EB.eway_bill_date', 'desc').orderBy('EB.id', 'desc');

        const result = await baseQuery;

        return result;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching eway bill by invoice ID.',
        });
    }
};

// Insert a new eway bill
const insertEwayBill = async (data) => {
    // 1. Check if eway_bill_no already exists in active or trashed state
    const existingEway = await db('eway_bills')
        .select('id', 'is_active', 'eway_bill_no')
        .where({ firm_id: data.firm_id, eway_bill_no: data.eway_bill_no })
        .first();

    if (existingEway) {
        if (existingEway.is_active) {
            throw new ApiError({
                statusCode: 409,
                message: `E-Way Bill '${data.eway_bill_no}' already exists.`
            });
        } else {
            throw new ApiError({
                statusCode: 409,
                message: `E-Way Bill '${data.eway_bill_no}' is currently in the Trash. Please restore it from the Recycle Bin or use a different e-way bill number.`
            });
        }
    }

    try {
        const [result] = await db('eway_bills').insert(data).returning('id');
        return result?.id || null;
    } catch (err) {
        if (err.constraint === 'eway_bills_eway_bill_no_unique') {
            throw new ApiError({
                statusCode: 409,
                message: 'This eway bill is already created.',
            });
        }
        if (err.constraint === 'unique_eway_bills_invoice_id') {
            throw new ApiError({
                statusCode: 409,
                message: 'This invoice is already linked to another E-Way Bill.',
            });
        }
        if (err.constraint === 'eway_bills_invoice_id_foreign') {
            throw new ApiError({
                statusCode: 409,
                message: 'Invoice not found to create eway bill.',
            });
        }
        if (err instanceof ApiError) {
            throw err;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while inserting eway bill data.',
        });
    }
};

// Update eway bill by ID
const updateEwayBillById = async (id, data) => {
    try {
        const affectedRows = await db('eway_bills').where({ id }).update(data);
        return affectedRows;
    } catch (err) {
        switch (err.constraint) {
            case 'eway_bills_eway_bill_no_unique':
                throw new ApiError({
                    statusCode: 409,
                    message: 'This eway bill is already created.',
                });
            case 'unique_eway_bills_invoice_id':
                throw new ApiError({
                    statusCode: 409,
                    message: 'This invoice is already linked to another E-Way Bill.',
                });
            case 'eway_bills_invoice_id_foreign':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to create eway bill.',
                });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating eway bill data.',
        });
    }
};

// Delete eway bill by ID
const deleteEwayBillById = async (id, isPermanentDelete) => {
    try {
        const { firmId = 0 } = getContext();

        // 1. Check if linked to an active invoice
        const activeInvoice = await db('eway_bills as eb')
            .join('invoices as i', 'eb.invoice_id', 'i.id')
            .select('i.invoice_no')
            .where('eb.id', id)
            .andWhere('i.is_active', true)
            .first();

        if (activeInvoice) {
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete E-Way Bill because it is linked to active Invoice '${activeInvoice.invoice_no}'. Please unlink it from the invoice first.`
            });
        }

        // Hard delete
        if (isPermanentDelete) {
            const result = await db('eway_bills').where({ id, firm_id: firmId }).del();
            return result > 0;
        }

        // Soft delete (move to trash)
        const updated = await db('eway_bills').where({ id, firm_id: firmId }).update({ is_active: false });
        return updated > 0;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting eway bill data.',
        });
    }
};

// Bulk delete eway bills
const bulkDeleteEwayBills = async (ewayBillIds = [], isPermanentDelete = false) => {
    if (!ewayBillIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        // Check if any are linked to an active invoice
        const activeInvoices = await db('eway_bills as eb')
            .join('invoices as i', 'eb.invoice_id', 'i.id')
            .select('eb.eway_bill_no', 'i.invoice_no')
            .whereIn('eb.id', ewayBillIds)
            .andWhere('i.is_active', true);

        if (activeInvoices.length > 0) {
            const conflictList = activeInvoices.map(c => `E-Way Bill '${c.eway_bill_no}' linked to Invoice '${c.invoice_no}'`).join(', ');
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete E-Way Bills: ${conflictList}. Please unlink them from invoices first.`
            });
        }

        if (isPermanentDelete) {
            return await db('eway_bills').whereIn('id', ewayBillIds).andWhere({ firm_id: firmId }).del();
        }

        // Soft delete (bulk move to trash)
        const affectedRows = await db('eway_bills')
            .whereIn('id', ewayBillIds)
            .andWhere({ firm_id: firmId })
            .update({ is_active: false });

        return affectedRows;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting eway bills.',
        });
    }
};

// Restore eway bill by ID
const restoreEwayBillById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const ewayBill = await db('eway_bills')
            .where({ id, firm_id: firmId, is_active: false })
            .first();

        if (!ewayBill) {
            throw new ApiError({
                statusCode: 404,
                message: 'E-Way Bill not found in Trash or already active.'
            });
        }

        const affectedRows = await db('eway_bills')
            .where({ id, firm_id: firmId })
            .update({ is_active: true });

        return affectedRows > 0;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring eway bill.',
        });
    }
};

// Bulk restore eway bills
const bulkRestoreEwayBills = async (ewayBillIds = []) => {
    if (!ewayBillIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        const affectedRows = await db('eway_bills')
            .whereIn('id', ewayBillIds)
            .andWhere({ firm_id: firmId, is_active: false })
            .update({ is_active: true });

        return affectedRows;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring eway bills.',
        });
    }
};

/**
 * Safely update eway-bill → invoice mapping with strict 1:1 enforcement
 * and validation to prevent cross-invoice tampering.
 */
const updateInvoiceEwayBillMapping = async (trx, invoiceId, newEwayBillIds) => {
    const { firmId = 0 } = getContext();
    const rawIds = Array.isArray(newEwayBillIds) ? newEwayBillIds : (newEwayBillIds ? [newEwayBillIds] : []);
    const uniqueNewIds = [...new Set(rawIds.map(Number).filter(id => id > 0))];

    if (uniqueNewIds.length > 1) {
        throw new ApiError({
            statusCode: 400,
            message: 'An invoice can only have one E-Way Bill (1:1 relationship).',
        });
    }

    if (uniqueNewIds.length === 1) {
        const selectedEwayBillId = uniqueNewIds[0];

        // 0️⃣ Validate: eway bill must exist in this firm and be active
        const ewayBill = await trx('eway_bills')
            .select('id', 'invoice_id')
            .where({ id: selectedEwayBillId, firm_id: firmId, is_active: true })
            .first();

        if (!ewayBill) {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid eWay Bill ID provided.',
            });
        }

        // Ensure it is not already linked to another invoice
        if (ewayBill.invoice_id && Number(ewayBill.invoice_id) !== Number(invoiceId)) {
            throw new ApiError({
                statusCode: 400,
                message: 'This E-Way Bill is already associated with another invoice.',
            });
        }

        // Unmap any previously mapped E-Way Bill on this invoice
        await trx('eway_bills')
            .where({ invoice_id: invoiceId, firm_id: firmId, is_active: true })
            .whereNot({ id: selectedEwayBillId })
            .update({ invoice_id: null });

        // Map the new E-Way Bill
        await trx('eway_bills')
            .where({ id: selectedEwayBillId })
            .update({ invoice_id: invoiceId });

        return { mapped: selectedEwayBillId };
    } else {
        // Unmap any existing E-Way Bill for this invoice
        await trx('eway_bills')
            .where({ invoice_id: invoiceId, firm_id: firmId, is_active: true })
            .update({ invoice_id: null });

        return { mapped: null };
    }
};

module.exports = {
    fetchAllEwayBill,
    fetchEwayBillMeta,
    fetchEwayBillById,
    fetchEwayBillByInvoiceId,
    insertEwayBill,
    updateEwayBillById,
    deleteEwayBillById,
    bulkDeleteEwayBills,
    restoreEwayBillById,
    bulkRestoreEwayBills,
    updateInvoiceEwayBillMapping
};
