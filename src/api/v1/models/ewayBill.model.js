const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Fetch all eway bills
const fetchAllEwayBill = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;
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
                'EB.updated_at'
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .leftJoin('users AS u', 'EB.created_by', 'u.id')
            .where('EB.is_active', true)
            .andWhere('EB.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('EB.eway_bill_no', 'ilike', `%${search}%`)
                    .orWhere('EB.customer_name', 'ilike', `%${search}%`);
            });
        }

        baseQuery.orderBy('EB.id', 'desc');

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
        const { page = 1, pageSize = 10, search = '' } = query;
        const { firmId = 0 } = getContext();

        const baseQuery = db('eway_bills')
            .where('is_active', true)
            .andWhere('firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('eway_bill_no', 'ilike', `%${search}%`)
                    .orWhere('customer_name', 'ilike', `%${search}%`);
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
    try {
        const [result] = await db('eway_bills').insert(data).returning('id');
        return result?.id || null;
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
        // Hard delete
        if (isPermanentDelete) {
            const result = await db('eway_bills').where({ id: id }).del();
            return result > 0;
        }

        // Soft delete
        const updated = await db('eway_bills').update({ is_active: false }).where({ id });
        return updated;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting eway bill data.',
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
    updateInvoiceEwayBillMapping
};
