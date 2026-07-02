const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { printQuery } = require("../helpers/debugSql");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");

// Fetch all invoice challans
const fetchAllInvoiceChallans = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;

        const baseQuery = db('invoice_challans AS IC')
            .select(
                'IC.id AS challan_id',
                'IC.challan_no',
                'IC.challan_date',
                'IC.is_invoiced',
                'I.invoice_no',
                'IC.customer_name',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'IC.updated_at'
            )
            .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
            .leftJoin('users AS u', 'IC.created_by', 'u.id')
            .where('IC.is_active', true);

        if (search) {
            baseQuery.where(function () {
                this.where('IC.challan_no', 'ilike', `%${search}%`)
                    .orWhere('IC.customer_name', 'ilike', `%${search}%`);
            });
        }

        baseQuery.orderBy('IC.id', 'desc');

        // Fetch paginated data
        const challans = await fetchPageData({ baseQuery, page, pageSize });

        return challans;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice challans.',
        });
    }
};

// Fetch invoice challan meta data for pagination
const fetchInvoiceChallanMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;

        const baseQuery = db('invoice_challans').where('is_active', true)

        // if (search) {
        //     baseQuery.andWhere('f.firm_name', 'ilike', `%${search}%`);
        // }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice challan meta data.',
        });
    }
}

// Fetch invoice challan by ID
const fetchInvoiceChallanById = async (id) => {
    try {
        const challan = await db('invoice_challans AS IC')
            .select(
                'IC.id AS challan_id',
                'IC.challan_no',
                'IC.challan_date',
                'IC.is_invoiced',
                'IC.invoice_id',
                'IC.customer_name'
            )
            .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
            .where('IC.id', id)
            .andWhere('IC.is_active', true)
            .first();

        return challan || null;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice challan by ID.',
        });
    }
};

// Fetch invoice challans by invoice ID
const fetchInvoiceChallansByInvoiceId = async (invoiceId, includeUnmappedChallans) => {
    try {
        const { firmId = 0 } = getContext();
        const baseQuery = db('invoice_challans AS IC')
            .select(
                'IC.id AS challan_id',
                'IC.challan_no',
                'IC.challan_date',
                'IC.is_invoiced',
                'IC.invoice_id',
                'IC.customer_name'
            )
            .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
            .where('IC.firm_id', firmId)
            .andWhere('IC.is_active', true);

        if (includeUnmappedChallans) {
            baseQuery.andWhere(function () {
                this.where('IC.is_invoiced', false).orWhere('IC.invoice_id', invoiceId);
            })
        } else {
            baseQuery.where('IC.invoice_id', invoiceId)
        }

        const challans = await baseQuery;
        return challans;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching challans by invoice ID.',
        });
    }
};

// Insert a new invoice challan
const insertInvoiceChallan = async (data) => {
    try {
        const [result] = await db('invoice_challans').insert(data).returning('id');
        return result?.id || null;
    } catch (err) {
        switch (err.constraint) {
            case 'unique_firm_challan_no':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Duplicate challan number found in this firm.',
                });
            case 'unique_id_invoice':
                throw new ApiError({
                    statusCode: 409,
                    message: 'This challan is already linked to the invoice.',
                });
            case 'invoice_challans_invoice_id_foreign':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to create invoice challan.',
                });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while inserting invoice challan data.',
        });
    }
};

// Update invoice challan by ID
const updateInvoiceChallanById = async (id, data) => {
    try {
        const affectedRows = await db('invoice_challans').where({ id }).update(data);
        return affectedRows;
    } catch (err) {
        switch (err.constraint) {
            case 'unique_firm_challan_no':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Duplicate challan number found in this firm.',
                });
            case 'unique_id_invoice':
                throw new ApiError({
                    statusCode: 409,
                    message: 'This challan is already linked to the invoice.',
                });
            case 'invoice_challans_invoice_id_foreign':
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to update invoice challan.',
                });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating invoice challan data.',
        });
    }
};

// Delete invoice challan by ID
const deleteInvoiceChallanById = async (id, isPermanentDelete) => {
    try {
        // Hard delete
        if (isPermanentDelete) {
            const result = await db('invoice_challans').where({ id: id }).del();
            return result > 0;
        }

        // Soft delete
        const updated = await db('invoice_challans').update({ is_active: false }).where({ id });
        return updated
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting invoice challan data.',
        });
    }
};

/**
 * Safely update challan-invoice mapping using comparison method
 * with strict validation to prevent cross-invoice tampering.
 */
const updateInvoiceChallanMapping = async (trx, invoiceId, newChallanIds) => {
    const { firmId = 0 } = getContext();

    // 0️⃣ Fetch all challans being requested (validation)
    const challans = await trx('invoice_challans')
        .select('id')
        .whereIn('id', newChallanIds)
        .where('firm_id', firmId)
        .where('is_active', true);

    // Validate: All challans must exist
    if (challans.length !== newChallanIds.length) {
        throw new ApiError({
            statusCode: 400,
            message: 'Invalid challan ID provided.',
        });
    }

    // 1️⃣ Fetch existing challans mapped to this invoice
    const existing = await trx('invoice_challans')
        .select('id')
        .where({ invoice_id: invoiceId, firm_id: firmId, is_active: true });

    const oldIds = existing.map(c => c.id);

    // 2️⃣ Calculate diff
    const toAdd = newChallanIds.filter(id => !oldIds.includes(id));
    const toRemove = oldIds.filter(id => !newChallanIds.includes(id));

    // 3️⃣ Map new challans
    if (toAdd.length > 0) {
        await trx('invoice_challans')
            .whereIn('id', toAdd)
            .update({ invoice_id: invoiceId });
    }

    // 4️⃣ Unmap removed challans
    if (toRemove.length > 0) {
        await trx('invoice_challans')
            .whereIn('id', toRemove)
            .update({ invoice_id: null });
    }

    return { added: toAdd, removed: toRemove };
}

module.exports = {
    fetchAllInvoiceChallans,
    fetchInvoiceChallanMeta,
    fetchInvoiceChallanById,
    fetchInvoiceChallansByInvoiceId,
    insertInvoiceChallan,
    updateInvoiceChallanById,
    deleteInvoiceChallanById,
    updateInvoiceChallanMapping
};
