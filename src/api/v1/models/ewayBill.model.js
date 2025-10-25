const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { ApiError } = require("../services/ApiError");

// Fetch all eway bill
const fetchAllEwayBill = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;

        const baseQuery = db('eway_bills AS EB')
            .select(
                'EB.id AS eway_bill_id',
                'EB.eway_bill_no',
                'EB.eway_bill_date',
                'EB.valid_upto',
                'EB.is_invoiced',
                'I.invoice_no',
                'EB.customer_name',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'EB.created_at',
                'EB.updated_at'
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .leftJoin('users AS u', 'EB.created_by', 'u.id')
            .where('EB.is_active', true);

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
            message: 'Something went wrong while fetching eway bill.',
        });
    }
};

// Fetch eway bill meta data for pagination
const fetchEwayBillMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;

        const baseQuery = db('eway_bills').where('is_active', true)

        // if (search) {
        //     baseQuery.andWhere('f.firm_name', 'ilike', `%${search}%`);
        // }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching eway bill meta data.',
        });
    }
}

// Fetch eway bill by ID
const fetchEwayBillById = async (id) => {
    try {
        const result = await db('eway_bills AS EB')
            .select(
                'EB.id AS eway_bill_id',
                'EB.eway_bill_no',
                'EB.eway_bill_date',
                'EB.valid_upto',
                'EB.is_invoiced',
                'EB.invoice_id',
                'EB.customer_name'
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .where('EB.id', id)
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

// Fetch eway bill by invoice ID
const fetchEwayBillByInvoiceId = async (invoiceId) => {
    try {
        const result = await db('eway_bills AS EB')
            .select(
                'EB.id AS eway_bill_id',
                'EB.eway_bill_no',
                'EB.eway_bill_date',
                'EB.valid_upto',
                'EB.is_invoiced',
                'EB.invoice_id',
                'EB.customer_name'
            )
            .leftJoin('invoices AS I', 'EB.invoice_id', 'I.id')
            .where('EB.invoice_id', invoiceId)
            .andWhere('EB.is_active', true);

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

module.exports = {
    fetchAllEwayBill,
    fetchEwayBillMeta,
    fetchEwayBillById,
    fetchEwayBillByInvoiceId,
    insertEwayBill,
    updateEwayBillById,
    deleteEwayBillById
};
