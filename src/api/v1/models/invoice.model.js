const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

// Fetch all invoice
const fetchAllInvoice = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;
        const { firmId = 0 } = getContext();

        const baseQuery = db('invoices AS I')
            .select(
                'I.id AS invoice_id',
                'I.invoice_no',
                'I.invoice_date',
                'I.due_date',
                'I.customer_name',
                'I.total',
                'PS.code AS payment_status_code',
                'PM.code AS payment_mode_code',
                'PO.po_no',
                'EB.eway_bill_no',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'I.created_at',
                'I.updated_at',
            )
            .leftJoin('purchase_orders AS PO', function () {
                this.on('I.id', '=', 'PO.invoice_id')
                    .andOn('PO.is_active', '=', db.raw('true'));
            })
            .leftJoin('eway_bills AS EB', function () {
                this.on('I.id', '=', 'EB.invoice_id')
                    .andOn('EB.is_active', '=', db.raw('true'));
            })
            .leftJoin('payment_statuses AS PS', 'I.payment_status_id', 'PS.id')
            .leftJoin('payment_modes AS PM', 'I.payment_mode_id', 'PM.id')
            .leftJoin('users AS u', 'I.created_by', 'u.id')
            .where('I.is_active', true)
            .andWhere('I.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('I.invoice_no', 'ILIKE', `%${search}%`)
                    .orWhere('I.customer_name', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`]);
            });
        }

        baseQuery.orderBy('I.id', 'desc');

        // Fetch paginated data
        const result = await fetchPageData({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice.',
        });
    }
};

// Fetch invoice meta data for pagination
const fetchInvoiceMeta = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = query;
        const { firmId = 0 } = getContext();


        const baseQuery = db('invoices AS I')
            .leftJoin('purchase_orders AS PO', function () {
                this.on('I.id', '=', 'PO.invoice_id')
                    .andOn('PO.is_active', '=', db.raw('true'));
            })
            .leftJoin('eway_bills AS EB', function () {
                this.on('I.id', '=', 'EB.invoice_id')
                    .andOn('EB.is_active', '=', db.raw('true'));
            })
            .leftJoin('payment_statuses AS PS', 'I.payment_status_id', 'PS.id')
            .leftJoin('payment_modes AS PM', 'I.payment_mode_id', 'PM.id')
            .leftJoin('users AS U', 'I.created_by', 'U.id')
            .where('I.is_active', true)
            .andWhere('I.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('I.invoice_no', 'ILIKE', `%${search}%`)
                    .orWhere('I.customer_name', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`]);
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice meta data.',
        });
    }
}

// Fetch invoice by ID
const fetchInvoiceById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        // 1. Fetch invoice master
        const result = await db('invoices AS I')
            .select(
                'I.id AS invoice_id',
                'I.invoice_no',
                'I.invoice_date',
                'I.due_days',
                'I.due_date',
                'I.firm_id',
                'F.firm_name AS company_name',
                'F.firm_type',
                'F.logo_url AS company_logo',
                'F.gstin AS firm_gstin',
                'F.invoice_prefix',
                'F.notes_footer',
                'UC.entity_type AS company_entity_type',
                'UC.email AS company_email',
                'UC.phone_number AS company_phone_number',
                'UC.website AS company_website',
                'UC.address_line1 AS company_address',
                'UC.website AS company_website',
                'UC.website AS company_website',
                'UC.city_id AS company_city_id',
                'UC.state_id AS company_state_id',
                'UC.pincode AS company_pincode',
                'I.customer_name',
                'I.has_gst',
                'I.gst_number',
                'ICB.email AS billing_email',
                'ICB.phone_number AS billing_phone_number',
                'ICB.website AS billing_website',
                'ICB.address_line1 AS billing_address',
                'ICB.city_id AS billing_city_id',
                'ICB.state_id AS billing_state_id',
                'ICB.pincode AS billing_pincode',
                'ICS.email AS shipping_email',
                'ICS.phone_number AS shipping_phone_number',
                'ICS.address_line1 AS shipping_address',
                'ICS.city_id AS shipping_city_id',
                'ICS.state_id AS shipping_state_id',
                'ICS.pincode AS shipping_pincode',
                'I.has_challan',
                'I.has_po',
                'I.has_eway_bill',
                'I.sub_total',
                'I.discount_percent',
                'I.discount_amount',
                'I.taxable_amount',
                'I.cgst',
                'I.sgst',
                'I.igst',
                'I.total',
                'I.round_off',
                'I.other',
                'I.payment_status_id',
                'I.payment_mode_id',
                'FBA.bank_name',
                'FBA.account_number',
                'FBA.ifsc_code',
                'FBA.branch_name'
            )
            .leftJoin('invoice_contacts AS ICB', 'I.billing_address_id', 'ICB.id')
            .leftJoin('invoice_contacts AS ICS', 'I.shipping_address_id', 'ICS.id')
            .innerJoin('firms AS F', 'I.firm_id', 'F.id')
            .leftJoin('user_contacts AS UC', function () {
                this.on('F.id', '=', 'UC.entity_id')
                    .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
            })
            .leftJoin('firm_bank_accounts AS FBA', 'I.firm_id', 'FBA.id')
            .where('I.is_active', true)
            .andWhere('I.id', id)
            .andWhere('I.firm_id', firmId)
            .first();

        // 2. Fetch invoice items (detail)
        const items = await db('invoice_items AS II')
            .select('II.id', 'I.id AS invoice_id', 'II.description', 'II.hsn_sac_code', 'IU.uqc', 'II.qty', 'II.rate', 'GS.gst_rate', 'II.taxable_amount', 'II.cgst', 'II.sgst', 'II.total')
            .innerJoin('invoices AS I', 'II.invoice_id', 'I.id')
            .leftJoin('item_units AS IU', 'II.item_unit_id', 'IU.id')
            .leftJoin('gst_slabs AS GS', 'II.gst_slab_id', 'GS.id')
            .where('I.is_active', true)
            .where('I.id', id);

        // 3. Attach items to invoice
        if (result) {
            result.items = items;
        }

        return result || null;
    } catch (err) {
        console.log('Error in fetchInvoiceById => ', err);
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice by ID.',
        });
    }
};

// Insert a new invoice
const insertInvoice = async (data) => {
    const { masterData, items, billing, shipping } = data;
    return await db.transaction(async trx => {
        // 1. Insert master data
        const invoiceId = await insertInvoiceMaster(trx, masterData);

        const address = [billing, shipping]

        // 2 & 3. Run in parallel
        const [itemsResult, addressResult] = await Promise.all([
            insertInvoiceItems(trx, invoiceId, items),
            insertInvoiceAddresses(trx, invoiceId, address)
        ]);

        // Update billing & shipping address id into invoice
        await updateAddressIdInInvoice(trx, invoiceId, addressResult)
        return invoiceId;
    });
}

// Insert invoice master data
const insertInvoiceMaster = async (trx, data) => {
    try {
        const [{ id }] = await trx('invoices').insert(data).returning('id');
        return id;
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This invoice is already created.',
            });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while inserting invoice data.',
        });
    }
}

// Insert invoice items
const insertInvoiceItems = async (trx, invoiceId, items) => {
    try {
        const formattedItems = items.map(item => ({ ...item, invoice_id: invoiceId }));
        await trx('invoice_items').insert(formattedItems);
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while inserting invoice items.',
        });
    }
}

// Insert invoice addresses
const insertInvoiceAddresses = async (trx, invoiceId, addresses) => {
    try {
        // Fetch existing addresses for this invoice
        const existingRecords = await trx('invoice_contacts').where({ invoice_id: invoiceId });

        // 1. Separate records
        const toUpdate = addresses.filter(addr => addr.id);
        const toInsert = addresses.filter(addr => !addr.id);
        const incomingIds = toUpdate.map(addr => addr.id);

        // 2. Find records to delete
        const existingIds = existingRecords.map(addr => addr.id);
        const toDeleteIds = existingIds.filter(id => !incomingIds.includes(id));

        // 3. Perform operations in same trx
        if (toDeleteIds.length) {
            await trx('invoice_contacts').whereIn('id', toDeleteIds).del();
        }

        for (const addr of toUpdate) {
            const { id, ...data } = addr;
            await trx('invoice_contacts').where({ id }).update(data);
        }

        if (toInsert.length) {
            const insertData = toInsert.map(addr => ({ ...addr, invoice_id: invoiceId }));
            return await trx('invoice_contacts').insert(insertData).returning(['id', 'contact_type']);;
        }
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Database error while saving invoice addresses.'
        });
    }
}

// Update address id in invoice
const updateAddressIdInInvoice = async (trx, invoiceId, address) => {
    try {
        // Get address id mapping as per type
        const ids = address.reduce((acc, c) => {
            acc[c.contact_type] = c.id || 0;
            return acc;
        }, {});

        // Update the billing & shipping address id in invoice table
        const updateAddressId = {
            billing_address_id: ids.BILLING,
            shipping_address_id: ids.SHIPPING
        }

        await trx('invoices').where({ id: invoiceId }).update(updateAddressId);
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Fail to update addres id into invoice.'
        });
    }
}

// Update invoice by ID
const updateInvoiceById = async (data) => {
    const { invoiceId, masterData, items, billing, shipping } = data;
    return await db.transaction(async trx => {
        // 1. Update master
        await updateInvoiceMaster(trx, invoiceId, masterData);

        const address = [billing, shipping]
        // 2 & 3. Run in parallel
        await Promise.all([
            updateInvoiceItems(trx, invoiceId, items),
            insertInvoiceAddresses(trx, invoiceId, address)
        ]);

        return invoiceId;
    });
}

// Update invoice master data
const updateInvoiceMaster = async (trx, invoiceId, data) => {
    try {
        trx('invoices').update(data).where({ id: invoiceId });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This invoice is already created.',
            });
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating invoice data.',
        });
    }
}

// Update invoice items
const updateInvoiceItems = async (trx, invoiceId, items) => {
    try {
        // Fetch existing items for this invoice
        const existingRecords = await trx('invoice_items').where({ invoice_id: invoiceId });

        const toUpdate = items.filter(i => i.id);
        const toInsert = items.filter(i => !i.id);
        const incomingIds = toUpdate.map(i => i.id);
        const existingIds = existingRecords.map(i => i.id);
        const toDeleteIds = existingIds.filter(id => !incomingIds.includes(id));

        // Delete
        if (toDeleteIds.length) {
            await trx('invoice_items').whereIn('id', toDeleteIds).del();
        }

        // Update
        for (const item of toUpdate) {
            const { id, ...data } = item;
            await trx('invoice_items').where({ id }).update(data);
        }

        // Insert
        if (toInsert.length) {
            const insertData = toInsert.map(i => ({ ...i, invoice_id: invoiceId }));
            await trx('invoice_items').insert(insertData);
        }
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating invoice items.',
        });
    }
}

// Delete invoice by ID
const deleteInvoiceById = async (invoiceId, isPermanentDelete) => {
    try {
        const { firmId = 0 } = getContext();
        let affectedInvoices;

        return db.transaction(async trx => {
            if (isPermanentDelete) {
                // Hard delete
                await trx('invoice_contacts').where({ invoice_id: invoiceId }).del();
                await trx('invoice_items').where({ invoice_id: invoiceId }).del();
                affectedInvoices = await trx('invoices').where({ id: invoiceId, firm_id: firmId }).del();
            } else {
                // 1. Delete invoice contacts
                await trx('invoice_contacts').update({ is_active: false }).where({ invoice_id: invoiceId });

                // 2. Delete invoice items 
                await trx('invoice_items').update({ is_active: false }).where({ invoice_id: invoiceId })

                // 3. Delete invoice
                affectedInvoices = await trx('invoices').update({ is_active: false }).where({ id: invoiceId });
            }

            // return true/false
            return affectedInvoices > 0;
        });
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting invoice.',
        });
    }
}

// Fetch challans for invoice
const fetchChallansForInvoice = async (invoiceId) => {
    try {
        // Check if invoiceId is provided
        if (!invoiceId) return [];

        const { firmId = 0 } = getContext();
        const challans = await db('invoice_challans')
            .select('id', 'challan_no', 'challan_date', 'customer_name', 'is_invoiced', 'invoice_id')
            .where({ is_active: true, firm_id: firmId })
            // .where('is_active', true)
            // .andWhere('firm_id', firmId)
            .andWhere(function () {
                this.where('is_invoiced', false).orWhere('invoice_id', invoiceId);
            })
            .orderBy('challan_date', 'desc');

        return challans;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching challans for invoice.',
        });
    }
};

// Fetch eway bills for invoice
const fetchPurchaseOrdersForInvoice = async (invoiceId) => {
    try {
        // Check if invoiceId is provided
        if (!invoiceId) return [];

        const { firmId = 0 } = getContext();
        const purchaseOrder = await db('invoice_challans')
            .select('id', 'po_no', 'po_date', 'customer_name', 'is_invoiced', 'invoice_id')
            .where({ is_active: true, firm_id: firmId })
            .andWhere(function () {
                this.where('is_invoiced', false).orWhere('invoice_id', invoiceId);
            })
            .orderBy('id', 'desc');

        return purchaseOrder;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching purchase order for invoice.',
        });
    }
};

// Fetch eway bills for invoice
const fetchEwayBillsForInvoice = async (invoiceId) => {
    try {
        // Check if invoiceId is provided
        if (!invoiceId) return [];

        const { firmId = 0 } = getContext();
        const ewayBill = await db('invoice_challans')
            .select('id', 'eway_bill_no', 'eway_bill_date', 'valid_upto', 'customer_name', 'is_invoiced', 'invoice_id')
            .where({ is_active: true, firm_id: firmId })
            .andWhere(function () {
                this.where('is_invoiced', false).orWhere('invoice_id', invoiceId);
            })
            .orderBy('id', 'desc');

        return ewayBill;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching eway bill for invoice.',
        });
    }
};

// Fetch challans, purchase orders and eway bills for invoice
const fetchChallanPOEwayBillsForInvoice = async (invoiceId) => {
    try {
        if (!invoiceId) return;

        const result = await db('invoice_challans as ic')
            .select(
                'i.id as invoice_id',
                db.raw('STRING_AGG(ic.challan_no::text, \',\') as challan'),
                db.raw('MAX(po.po_no) as po'),
                db.raw('MAX(eb.eway_bill_no) as ewaybill'),
                db.raw('MAX(pm.code) as payment_code'),
                db.raw('MAX(pm.label) as payment_label')
            )
            .leftJoin('invoices as i', 'i.id', 'ic.invoice_id')
            .leftJoin('purchase_orders as po', 'i.id', 'po.invoice_id')
            .leftJoin('eway_bills as eb', 'i.id', 'eb.invoice_id')
            .leftJoin('payment_modes as pm', 'i.payment_mode_id', 'pm.id')
            .where('i.id', invoiceId)
            .andWhere('i.is_active', true)
            .groupBy('i.id')
            .first();

        return result || {};
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching challans, purchase orders and eway bills for invoice.',
        });
    }
};

module.exports = {
    fetchAllInvoice,
    fetchInvoiceMeta,
    fetchInvoiceById,
    insertInvoice,
    updateInvoiceById,
    deleteInvoiceById,
    fetchChallansForInvoice,
    fetchPurchaseOrdersForInvoice,
    fetchEwayBillsForInvoice,
    fetchChallanPOEwayBillsForInvoice
};
