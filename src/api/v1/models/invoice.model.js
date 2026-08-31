const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { printQuery } = require("../helpers/debugSql");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");
const { updateInvoiceEwayBillMapping } = require("./ewayBill.model");
const { updateInvoiceChallanMapping } = require("./invoiceChallan.model");
const { updateInvoicePurchaseOrderMapping } = require("./purchaseOrder.model");

// Fetch all invoices
const fetchAllInvoice = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0 } = getContext();

        const baseQuery = db('invoices AS I')
            .select(
                'I.id AS invoice_id',
                'I.invoice_no',
                'I.invoice_date',
                'I.due_date',
                'I.customer_name',
                'I.gst_number',
                'I.sub_total',
                'I.taxable_amount',
                'I.cgst',
                'I.sgst',
                'I.igst',
                'I.total',
                'PS.code AS payment_status_code',
                'PM.code AS payment_mode_code',
                db.raw(`(
                    SELECT STRING_AGG(DISTINCT po.po_no::text, ', ' ORDER BY po.po_no::text)
                    FROM purchase_order_invoices poi
                    JOIN purchase_orders po ON poi.purchase_order_id = po.id AND po.is_active = true
                    WHERE poi.invoice_id = "I"."id" AND poi.is_active = true
                ) AS po_no`),
                'EB.eway_bill_no',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
                'I.created_at',
                'I.updated_at',
                'I.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('eway_bills AS EB', function () {
                this.on('I.id', '=', 'EB.invoice_id')
                    .andOn('EB.is_active', '=', db.raw('true'));
            })
            .leftJoin('payment_statuses AS PS', 'I.payment_status_id', 'PS.id')
            .leftJoin('payment_modes AS PM', 'I.payment_mode_id', 'PM.id')
            .leftJoin('users AS u', 'I.created_by', 'u.id')
            .leftJoin('users AS du', 'I.deleted_by', 'du.id')
            .where('I.is_active', !isTrash)
            .andWhere('I.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('I.invoice_no', 'ILIKE', `%${search}%`)
                    .orWhere('I.customer_name', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`])
                    .orWhereExists(function () {
                        this.select('*')
                            .from('purchase_order_invoices AS poi')
                            .join('purchase_orders AS po', 'poi.purchase_order_id', 'po.id')
                            .whereRaw('"poi"."invoice_id" = "I"."id"')
                            .andWhere('poi.is_active', true)
                            .andWhere('po.is_active', true)
                            .andWhere('po.po_no', 'ILIKE', `%${search}%`);
                    });
            });
        }

        if (isTrash) {
            baseQuery.orderBy('I.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('I.id', 'desc');
        }

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
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0 } = getContext();

        const baseQuery = db('invoices AS I')
            .leftJoin('eway_bills AS EB', function () {
                this.on('I.id', '=', 'EB.invoice_id')
                    .andOn('EB.is_active', '=', db.raw('true'));
            })
            .leftJoin('payment_statuses AS PS', 'I.payment_status_id', 'PS.id')
            .leftJoin('payment_modes AS PM', 'I.payment_mode_id', 'PM.id')
            .leftJoin('users AS u', 'I.created_by', 'u.id')
            .where('I.is_active', !isTrash)
            .andWhere('I.firm_id', firmId);

        if (search) {
            baseQuery.where(function () {
                this.where('I.invoice_no', 'ILIKE', `%${search}%`)
                    .orWhere('I.customer_name', 'ILIKE', `%${search}%`)
                    .orWhereRaw(`CONCAT(u.first_name, ' ', u.last_name) ILIKE ?`, [`%${search}%`])
                    .orWhereExists(function () {
                        this.select('*')
                            .from('purchase_order_invoices AS poi')
                            .join('purchase_orders AS po', 'poi.purchase_order_id', 'po.id')
                            .whereRaw('"poi"."invoice_id" = "I"."id"')
                            .andWhere('poi.is_active', true)
                            .andWhere('po.is_active', true)
                            .andWhere('po.po_no', 'ILIKE', `%${search}%`);
                    });
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        console.log('error => ', error);

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice meta data.',
        });
    }
};

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
                'ICB.id AS billing_id',
                'ICB.email AS billing_email',
                'ICB.phone_number AS billing_phone_number',
                'ICB.website AS billing_website',
                'ICB.address_line1 AS billing_address',
                'ICB.city_id AS billing_city_id',
                'ICB.state_id AS billing_state_id',
                'ICB.pincode AS billing_pincode',
                'ICS.id AS shipping_id',
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
            .leftJoin('firm_bank_accounts AS FBA', 'I.firm_id', 'FBA.firm_id')
            .where('I.is_active', true)
            .andWhere('I.id', id)
            .andWhere('I.firm_id', firmId)
            .first();

        // printQuery(result)

        // 2️⃣ Fetch child tables in parallel
        const [challans, pos, ewayBills, items] = await Promise.all([
            db('invoice_challans AS IC')
                .select(db.raw(`array_remove(ARRAY_AGG("IC"."id"), NULL) AS ids`))
                .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
                .where({ 'IC.invoice_id': id, 'IC.is_active': true, 'I.is_active': true })
                .first(),

            db('purchase_order_invoices AS POI')
                .select(db.raw(`array_remove(ARRAY_AGG("POI"."purchase_order_id"), NULL) AS ids`))
                .join('purchase_orders AS PO', 'POI.purchase_order_id', 'PO.id')
                .where({ 'POI.invoice_id': id, 'POI.is_active': true, 'PO.is_active': true })
                .first(),

            db('eway_bills AS EWB')
                .select(db.raw(`array_remove(ARRAY_AGG("EWB"."id"), NULL) AS ids`))
                .leftJoin('invoices AS I', 'EWB.invoice_id', 'I.id')
                .where({ 'EWB.invoice_id': id, 'EWB.is_active': true, 'I.is_active': true })
                .first(),

            db('invoice_items AS II')
                .select('II.id', 'I.id AS invoice_id', 'II.description', 'II.hsn_sac_code', 'II.item_unit_id', 'IU.uqc', 'II.qty', 'II.rate', 'II.gst_slab_id', 'GS.gst_rate', 'II.sub_total', 'II.taxable_amount', 'II.cgst', 'II.sgst', 'II.igst', 'II.total')
                .innerJoin('invoices AS I', 'II.invoice_id', 'I.id')
                .leftJoin('item_units AS IU', 'II.item_unit_id', 'IU.id')
                .leftJoin('gst_slabs AS GS', 'II.gst_slab_id', 'GS.id')
                .where('I.is_active', true)
                .where('I.id', id)
                .orderBy('II.id', 'ASC')
        ]);

        // 2. Fetch invoice items (detail)
        // const items = await db('invoice_items AS II')
        //     .select('II.id', 'I.id AS invoice_id', 'II.description', 'II.hsn_sac_code', 'II.item_unit_id', 'IU.uqc', 'II.qty', 'II.rate', 'II.gst_slab_id', 'GS.gst_rate', 'II.taxable_amount', 'II.cgst', 'II.sgst', 'II.total')
        //     .innerJoin('invoices AS I', 'II.invoice_id', 'I.id')
        //     .leftJoin('item_units AS IU', 'II.item_unit_id', 'IU.id')
        //     .leftJoin('gst_slabs AS GS', 'II.gst_slab_id', 'GS.id')
        //     .where('I.is_active', true)
        //     .where('I.id', id);

        // 3. Attach items to invoice
        if (result) {
            result.items = items;
            result.challan_ids = challans ? challans.ids : [];
            result.po_ids = pos ? pos.ids : [];
            result.ewb_ids = ewayBills ? ewayBills.ids : [];
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
    const { masterData, items, billing, shipping, document = {} } = data;
    return await db.transaction(async trx => {
        // 1. Insert master data
        const invoiceId = await insertInvoiceMaster(trx, masterData);

        const address = [billing, shipping]

        // 2 & 3. Run in parallel
        const [itemsResult, addressResult] = await Promise.all([
            insertInvoiceItems(trx, invoiceId, items),
            insertInvoiceAddresses(trx, invoiceId, address),
            updateInvoiceChallanMapping(trx, invoiceId, masterData.challanIds || document.challanIds || []),
            updateInvoicePurchaseOrderMapping(trx, invoiceId, masterData.purchaseOrderIds || document.purchaseOrderIds || []),
            updateInvoiceEwayBillMapping(trx, invoiceId, masterData.ewayBillIds || document.ewayBillIds || [])
        ]);

        // Update billing & shipping address id into invoice
        await updateAddressIdInInvoice(trx, invoiceId, addressResult)
        return invoiceId;
    });
}

// Insert invoice master data
const insertInvoiceMaster = async (trx, data) => {
    // 1. Check if invoice_no already exists in active or trashed state
    const existingInvoice = await trx('invoices')
        .select('id', 'is_active', 'invoice_no')
        .where({ firm_id: data.firm_id, invoice_no: data.invoice_no })
        .first();

    if (existingInvoice) {
        if (existingInvoice.is_active) {
            throw new ApiError({
                statusCode: 409,
                message: `Invoice number '${data.invoice_no}' already exists.`
            });
        } else {
            throw new ApiError({
                statusCode: 409,
                message: `Invoice number '${data.invoice_no}' is currently in the Trash. Please restore it from the Recycle Bin or use a different invoice number.`
            });
        }
    }

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
};

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
    const { invoiceId, masterData, items, billing, shipping, document = {} } = data;
    return await db.transaction(async trx => {
        // 1. Update master
        await updateInvoiceMaster(trx, invoiceId, masterData);

        const address = [billing, shipping]

        // 2 & 3. Run in parallel
        await Promise.all([
            updateInvoiceItems(trx, invoiceId, items),
            insertInvoiceAddresses(trx, invoiceId, address),
            updateInvoiceChallanMapping(trx, invoiceId, masterData.challanIds || document.challanIds || []),
            updateInvoicePurchaseOrderMapping(trx, invoiceId, document.purchaseOrderIds || masterData.purchaseOrderIds || []),
            updateInvoiceEwayBillMapping(trx, invoiceId, masterData.ewayBillIds || document.ewayBillIds || [])
        ]);

        return invoiceId;
    });
}

// Update invoice master data
const updateInvoiceMaster = async (trx, invoiceId, data) => {
    try {
        await trx('invoices').update(data).where({ id: invoiceId });
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

        return db.transaction(async trx => {
            let result;

            if (isPermanentDelete) {
                // HARD DELETE - run in parallel
                const [contacts, items, invoice] = await Promise.all([
                    trx('invoice_contacts').where({ invoice_id: invoiceId }).del(),
                    trx('invoice_items').where({ invoice_id: invoiceId }).del(),
                    trx('invoices').where({ id: invoiceId, firm_id: firmId }).del()
                ]);

                result = invoice; // number of affected invoice rows
            } else {
                // SOFT DELETE - run in parallel
                const [contacts, items, mappings, challans, ewayBills, invoice] = await Promise.all([
                    trx('invoice_contacts').where({ invoice_id: invoiceId }).update({ is_active: false }),
                    trx('invoice_items').where({ invoice_id: invoiceId }).update({ is_active: false }),
                    trx('purchase_order_invoices').where({ invoice_id: invoiceId }).update({ is_active: false }),
                    trx('invoice_challans').where({ invoice_id: invoiceId }).update({ invoice_id: null }),
                    trx('eway_bills').where({ invoice_id: invoiceId }).update({ invoice_id: null }),
                    trx('invoices').where({ id: invoiceId, firm_id: firmId }).update({ is_active: false })
                ]);

                result = invoice;
            }

            return result > 0;
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting invoice.',
        });
    }
};

// Bulk delete invoices
const bulkDeleteInvoices = async (invoiceIds = [], isPermanentDelete = false) => {
    if (!invoiceIds || !invoiceIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        return db.transaction(async trx => {
            if (isPermanentDelete) {
                await Promise.all([
                    trx('invoice_contacts').whereIn('invoice_id', invoiceIds).del(),
                    trx('invoice_items').whereIn('invoice_id', invoiceIds).del(),
                    trx('invoices').whereIn('id', invoiceIds).andWhere({ firm_id: firmId }).del()
                ]);
                return invoiceIds.length;
            }

            // Soft delete (bulk move to trash)
            await Promise.all([
                trx('invoice_contacts').whereIn('invoice_id', invoiceIds).update({ is_active: false }),
                trx('invoice_items').whereIn('invoice_id', invoiceIds).update({ is_active: false }),
                trx('purchase_order_invoices').whereIn('invoice_id', invoiceIds).update({ is_active: false }),
                trx('invoice_challans').whereIn('invoice_id', invoiceIds).update({ invoice_id: null }),
                trx('eway_bills').whereIn('invoice_id', invoiceIds).update({ invoice_id: null }),
                trx('invoices').whereIn('id', invoiceIds).andWhere({ firm_id: firmId }).update({ is_active: false })
            ]);

            return invoiceIds.length;
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting invoices.',
        });
    }
};

// Restore invoice by ID
const restoreInvoiceById = async (invoiceId) => {
    try {
        const { firmId = 0 } = getContext();

        return db.transaction(async trx => {
            const invoice = await trx('invoices')
                .where({ id: invoiceId, firm_id: firmId, is_active: false })
                .first();

            if (!invoice) {
                throw new ApiError({
                    statusCode: 404,
                    message: 'Invoice not found in Trash or already active.'
                });
            }

            await Promise.all([
                trx('invoice_contacts').where({ invoice_id: invoiceId }).update({ is_active: true }),
                trx('invoice_items').where({ invoice_id: invoiceId }).update({ is_active: true }),
                trx('invoices').where({ id: invoiceId, firm_id: firmId }).update({ is_active: true })
            ]);

            return 1;
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring invoice.',
        });
    }
};

// Bulk restore invoices
const bulkRestoreInvoices = async (invoiceIds = []) => {
    if (!invoiceIds || !invoiceIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        return db.transaction(async trx => {
            await Promise.all([
                trx('invoice_contacts').whereIn('invoice_id', invoiceIds).update({ is_active: true }),
                trx('invoice_items').whereIn('invoice_id', invoiceIds).update({ is_active: true }),
                trx('invoices').whereIn('id', invoiceIds).andWhere({ firm_id: firmId, is_active: false }).update({ is_active: true })
            ]);

            return invoiceIds.length;
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring invoices.',
        });
    }
};

// Fetch challans for invoice
const fetchChallansForInvoice = async (invoiceId) => {
    try {
        // Check if invoiceId is provided
        if (!invoiceId) return [];

        const { firmId = 0 } = getContext();
        const challans = await db('invoice_challans')
            .select(
                'id',
                'challan_no',
                'challan_date',
                'customer_name',
                db.raw('(invoice_id IS NOT NULL) AS is_invoiced'),
                'invoice_id'
            )
            .where({ is_active: true, firm_id: firmId })
            .andWhere(function () {
                this.whereNull('invoice_id').orWhere('invoice_id', invoiceId);
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
        const ewayBill = await db('eway_bills')
            .select(
                'id',
                'eway_bill_no',
                'eway_bill_date',
                'valid_upto',
                'customer_name',
                db.raw('(invoice_id IS NOT NULL) AS is_invoiced'),
                'invoice_id'
            )
            .where({ is_active: true, firm_id: firmId })
            .andWhere(function () {
                this.whereNull('invoice_id').orWhere('invoice_id', invoiceId);
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

        const result = await db('invoices as i')
            .select(
                'i.id as invoice_id',
                'pm.code as payment_code',
                'pm.label as payment_label',
                db.raw("STRING_AGG(DISTINCT ic.challan_no::text, ',' ORDER BY ic.challan_no::text) as challan"),
                db.raw("STRING_AGG(DISTINCT po.po_no::text, ',' ORDER BY po.po_no::text) as po"),
                db.raw("STRING_AGG(DISTINCT eb.eway_bill_no::text, ',' ORDER BY eb.eway_bill_no::text) as ewaybill")
            )
            .leftJoin('invoice_challans as ic', 'i.id', 'ic.invoice_id')
            .leftJoin('purchase_order_invoices as poi', function () {
                this.on('i.id', '=', 'poi.invoice_id').andOn('poi.is_active', '=', db.raw('true'));
            })
            .leftJoin('purchase_orders as po', function () {
                this.on('poi.purchase_order_id', '=', 'po.id').andOn('po.is_active', '=', db.raw('true'));
            })
            .leftJoin('eway_bills as eb', 'i.id', 'eb.invoice_id')
            .leftJoin('payment_modes as pm', 'i.payment_mode_id', 'pm.id')
            .where('i.id', invoiceId)
            .andWhere('i.is_active', true)
            .groupBy('i.id', 'pm.code', 'pm.label')
            .first();

        return result || {};
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching challans, purchase orders and eway bills for invoice.',
        });
    }
};

// Fetch last invoice number
const fetchLastInvoiceNumber = async () => {
    try {
        const { firmId = 0 } = getContext();
        const invoice = await db('invoices')
            .select('invoice_no')
            .where({ firm_id: firmId })
            .orderBy('id', 'desc')
            .first();

        return invoice?.invoice_no || null;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching last invoice number.',
        });
    }
};

// Fetch firm invoice settings
const fetchInvoiceSettings = async () => {
    try {
        const { firmId = 0 } = getContext();
        const firm = await db('firms')
            .select('invoice_prefix', 'invoice_start_number')
            .where({ id: firmId, is_active: true })
            .first();

        if (!firm) {
            throw new ApiError({
                statusCode: 404,
                message: 'Firm invoice settings not found.',
            });
        }

        return {
            invoicePrefix: firm.invoice_prefix,
            invoiceStartNumber: firm.invoice_start_number
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice settings.',
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
    bulkDeleteInvoices,
    restoreInvoiceById,
    bulkRestoreInvoices,
    // fetchChallansForInvoice,
    // fetchPurchaseOrdersForInvoice,
    // fetchEwayBillsForInvoice,
    fetchChallanPOEwayBillsForInvoice,
    fetchLastInvoiceNumber,
    fetchInvoiceSettings
};
