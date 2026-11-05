const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { printQuery } = require("../helpers/debugSql");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");
const { ApiResponse } = require("../services/ApiResponse");

// Fetch all invoice challans
const fetchAllInvoiceChallans = async (query) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false, status = '' } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0 } = getContext();

        const baseQuery = db('invoice_challans AS IC')
            .select(
                'IC.id AS challanId',
                'IC.challan_no AS challanNo',
                'IC.challan_date AS challanDate',
                'IC.firm_id AS firmId',
                'F.firm_name AS firmName',
                'IC.firm_branch_id AS firmBranchId',
                'FB.branch_name AS firmBranchName',
                'FB.branch_code AS firmBranchCode',
                'IC.party_id AS partyId',
                'P.legal_name AS partyLegalName',
                'P.display_name AS partyDisplayName',
                'P.gstin AS partyGstin',
                'IC.party_branch_id AS partyBranchId',
                'PB.branch_name AS partyBranchName',
                db.raw('("IC"."invoice_id" IS NOT NULL) AS "isInvoiced"'),
                'IC.invoice_id AS invoiceId',
                'I.invoice_no AS invoiceNo',
                'IC.customer_name AS customerName',
                'IC.transport_mode AS transportMode',
                'IC.vehicle_no AS vehicleNo',
                'IC.transporter_name AS transporterName',
                'IC.lr_no AS lrNo',
                'IC.dispatch_reason AS dispatchReason',
                'IC.status AS status',
                'IC.delivery_address AS deliveryAddress',
                'IC.notes AS notes',
                'IC.total_quantity AS totalQuantity',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS "createdBy"`),
                'IC.created_at AS createdAt',
                'IC.updated_at AS updatedAt',
                'IC.deleted_at AS deletedAt',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS "deletedBy"`)
            )
            .leftJoin('firms AS F', 'IC.firm_id', 'F.id')
            .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
            .leftJoin('firm_branches AS FB', 'IC.firm_branch_id', 'FB.id')
            .leftJoin('parties AS P', 'IC.party_id', 'P.id')
            .leftJoin('party_branches AS PB', 'IC.party_branch_id', 'PB.id')
            .leftJoin('users AS u', 'IC.created_by', 'u.id')
            .leftJoin('users AS du', 'IC.deleted_by', 'du.id')
            .where('IC.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('IC.firm_id', firmId);
        }

        const { branchId = null } = getContext();
        if (branchId) {
            baseQuery.andWhere('IC.firm_branch_id', branchId);
        }

        if (status) {
            baseQuery.andWhere('IC.status', status);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('IC.challan_no', 'ilike', `%${search}%`)
                    .orWhere('IC.customer_name', 'ilike', `%${search}%`)
                    .orWhere('P.legal_name', 'ilike', `%${search}%`)
                    .orWhere('IC.vehicle_no', 'ilike', `%${search}%`)
                    .orWhere('IC.transporter_name', 'ilike', `%${search}%`);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('IC.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('IC.id', 'desc');
        }

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
        const { page = 1, pageSize = 10, search = '', trash = false, status = '' } = query;
        const isTrash = trash === true || trash === 'true';
        const { firmId = 0, branchId = null } = getContext();

        const baseQuery = db('invoice_challans AS IC')
            .leftJoin('parties AS P', 'IC.party_id', 'P.id')
            .where('IC.is_active', !isTrash);

        if (firmId) {
            baseQuery.andWhere('IC.firm_id', firmId);
        }

        if (branchId) {
            baseQuery.andWhere('IC.firm_branch_id', branchId);
        }

        if (status) {
            baseQuery.andWhere('IC.status', status);
        }

        if (search) {
            baseQuery.where(function () {
                this.where('IC.challan_no', 'ilike', `%${search}%`)
                    .orWhere('IC.customer_name', 'ilike', `%${search}%`)
                    .orWhere('P.legal_name', 'ilike', `%${search}%`)
                    .orWhere('IC.vehicle_no', 'ilike', `%${search}%`)
                    .orWhere('IC.transporter_name', 'ilike', `%${search}%`);
            });
        }

        const result = await buildPagination({ baseQuery, page, pageSize });

        return result;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice challan meta data.',
        });
    }
};

// Fetch invoice challan by ID
const fetchInvoiceChallanById = async (id, includeDeleted = false) => {
    try {
        const { firmId = 0 } = getContext();

        const challanQuery = db('invoice_challans AS IC')
            .select(
                'IC.id AS challanId',
                'IC.challan_no AS challanNo',
                'IC.challan_date AS challanDate',
                'IC.firm_id AS firmId',
                'F.firm_name AS firmName',
                'IC.firm_branch_id AS firmBranchId',
                'FB.branch_name AS firmBranchName',
                'FB.branch_code AS firmBranchCode',
                'IC.party_id AS partyId',
                'P.legal_name AS partyLegalName',
                'P.display_name AS partyDisplayName',
                'P.gstin AS partyGstin',
                'IC.party_branch_id AS partyBranchId',
                'PB.branch_name AS partyBranchName',
                db.raw('("IC"."invoice_id" IS NOT NULL) AS "isInvoiced"'),
                'IC.invoice_id AS invoiceId',
                'I.invoice_no AS invoiceNo',
                'IC.customer_name AS customerName',
                'IC.transport_mode AS transportMode',
                'IC.vehicle_no AS vehicleNo',
                'IC.transporter_name AS transporterName',
                'IC.lr_no AS lrNo',
                'IC.dispatch_reason AS dispatchReason',
                'IC.status AS status',
                'IC.delivery_address AS deliveryAddress',
                'IC.notes AS notes',
                'IC.total_quantity AS totalQuantity'
            )
            .leftJoin('firms AS F', 'IC.firm_id', 'F.id')
            .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
            .leftJoin('firm_branches AS FB', 'IC.firm_branch_id', 'FB.id')
            .leftJoin('parties AS P', 'IC.party_id', 'P.id')
            .leftJoin('party_branches AS PB', 'IC.party_branch_id', 'PB.id')
            .where('IC.id', id);

        if (!includeDeleted) {
            challanQuery.andWhere('IC.is_active', true);
        }

        if (firmId) {
            challanQuery.andWhere('IC.firm_id', firmId);
        }

        const challan = await challanQuery.first();
        if (!challan) return null;

        // Fetch line items
        const items = await db('invoice_challan_items AS ICI')
            .select(
                'ICI.id',
                'ICI.challan_id AS challanId',
                'ICI.product_id AS productId',
                'PR.name AS productName',
                'ICI.item_name AS itemName',
                'ICI.description',
                'ICI.hsn_sac_code AS hsnSacCode',
                'ICI.qty',
                'ICI.unit',
                'ICI.rate',
                'ICI.total',
                'ICI.sort_order AS sortOrder'
            )
            .leftJoin('products AS PR', 'ICI.product_id', 'PR.id')
            .where('ICI.challan_id', id)
            .andWhere('ICI.is_active', true)
            .orderBy('ICI.sort_order', 'asc')
            .orderBy('ICI.id', 'asc');

        challan.items = items || [];
        return challan;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching invoice challan by ID.',
        });
    }
};

// Fetch invoice challans by invoice ID (for invoice selection list and invoice details)
const fetchInvoiceChallansByInvoiceId = async (invoiceId, includeUnmappedChallans, partyId = null) => {
    try {
        const { firmId = 0 } = getContext();
        const baseQuery = db('invoice_challans AS IC')
            .select(
                'IC.id AS challanId',
                'IC.challan_no AS challanNo',
                'IC.challan_date AS challanDate',
                db.raw('("IC"."invoice_id" IS NOT NULL) AS "isInvoiced"'),
                'IC.invoice_id AS invoiceId',
                'IC.party_id AS partyId',
                'IC.customer_name AS customerName',
                'IC.transport_mode AS transportMode',
                'IC.vehicle_no AS vehicleNo',
                'IC.total_quantity AS totalQuantity',
                'IC.status'
            )
            .leftJoin('invoices AS I', 'IC.invoice_id', 'I.id')
            .where('IC.is_active', true);

        if (firmId) {
            baseQuery.andWhere('IC.firm_id', firmId);
        }

        if (includeUnmappedChallans) {
            baseQuery.andWhere(function () {
                this.whereNull('IC.invoice_id');
                if (invoiceId && Number(invoiceId) > 0) {
                    this.orWhere('IC.invoice_id', invoiceId);
                }
            });

            // If partyId is provided, filter for that customer (or challans without party assigned)
            if (partyId && Number(partyId) > 0) {
                baseQuery.andWhere(function () {
                    this.where('IC.party_id', Number(partyId))
                        .orWhereNull('IC.party_id');
                });
            }
        } else {
            baseQuery.where('IC.invoice_id', invoiceId);
        }

        baseQuery.orderBy('IC.challan_date', 'desc').orderBy('IC.id', 'desc');

        const challans = await baseQuery;
        return challans;
    } catch (err) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching challans by invoice ID.',
        });
    }
};

// Helper to extract numeric suffix from challan number string
const extractChallanNumber = (challanNo) => {
    const numberMatch = String(challanNo || '').match(/\d+$/);
    return numberMatch ? parseInt(numberMatch[0], 10) : null;
};

// Calculate next sequential challan number from existing challan number string
const calculateNextChallanNumber = (challanNo) => {
    const numberMatch = String(challanNo || '').match(/\d+$/);
    if (!numberMatch) {
        return `${challanNo || 'DC-'}1`;
    }
    const number = numberMatch[0];
    const prefix = challanNo.substring(0, challanNo.length - number.length);
    const nextNumber = String(Number(number) + 1).padStart(number.length, "0");
    return `${prefix}${nextNumber}`;
};

// Fetch next expected consecutive challan number with collision check
const fetchNextExpectedChallanNumber = async (firmId, trx = db) => {
    // 1. Get the latest created challan for this firm (including active and inactive to prevent collisions)
    const lastChallan = await trx('invoice_challans')
        .select('challan_no')
        .where({ firm_id: firmId })
        .orderBy('id', 'desc')
        .first();

    if (lastChallan?.challan_no) {
        let candidateNo = calculateNextChallanNumber(lastChallan.challan_no);
        while (await trx('invoice_challans').where({ firm_id: firmId, challan_no: candidateNo }).first()) {
            candidateNo = calculateNextChallanNumber(candidateNo);
        }
        return candidateNo;
    }

    // Default starting delivery challan number
    return 'DC-0001';
};

// Insert a new invoice challan
const insertInvoiceChallan = async (headerData, items = []) => {
    // Calculate total quantity from items if available
    let totalQty = headerData.total_quantity || 0;
    if (Array.isArray(items) && items.length > 0) {
        totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    }
    headerData.total_quantity = totalQty;

    return await db.transaction(async (trx) => {
        try {
            // 1. Pessimistic Row Lock on Firm:
            // Serializes concurrent challan creations for the same firm.
            // PostgreSQL queues them sequentially, guaranteeing 100% race-condition safety.
            const firm = await trx('firms')
                .where({ id: headerData.firm_id })
                .forUpdate()
                .first();

            if (!firm) {
                throw new ApiError({
                    statusCode: 404,
                    message: 'Firm not found.'
                });
            }

            // 2. Pure Backend Auto-Assignment:
            // Generate the true, guaranteed next consecutive challan number under the lock
            const nextChallanNo = await fetchNextExpectedChallanNumber(headerData.firm_id, trx);
            headerData.challan_no = nextChallanNo;

            const [result] = await trx('invoice_challans').insert(headerData).returning(['id', 'challan_no']);
            const challanId = result?.id || null;

            if (!challanId) {
                throw new ApiError({ statusCode: 500, message: 'Failed to insert delivery challan.' });
            }

            if (Array.isArray(items) && items.length > 0) {
                const itemRecords = items.map((it, idx) => ({
                    challan_id: challanId,
                    product_id: it.productId || null,
                    item_name: it.itemName,
                    description: it.description || null,
                    hsn_sac_code: it.hsnSacCode || null,
                    qty: Number(it.qty) || 1,
                    unit: it.unit || 'Nos',
                    rate: Number(it.rate) || 0,
                    total: Number(it.total) || ((Number(it.qty) || 1) * (Number(it.rate) || 0)),
                    sort_order: it.sortOrder !== undefined ? it.sortOrder : idx
                }));
                await trx('invoice_challan_items').insert(itemRecords);
            }

            return { id: challanId, challanNo: nextChallanNo };
        } catch (err) {
            if (err.constraint === 'unique_firm_challan_no' || err.code === '23505') {
                throw new ApiError({
                    statusCode: 409,
                    message: 'Duplicate challan number found in this firm.',
                });
            }
            if (err.constraint === 'invoice_challans_invoice_id_foreign') {
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to create invoice challan.',
                });
            }
            if (err instanceof ApiError) {
                throw err;
            }
            throw new ApiError({
                statusCode: 500,
                message: `Something went wrong while inserting invoice challan data: ${err.message || ''}`,
            });
        }
    });
};

// Update invoice challan by ID
const updateInvoiceChallanById = async (id, headerData, items) => {
    // Delivery challan number is immutable once generated to maintain statutory compliance and audit integrity
    delete headerData.challan_no;

    return await db.transaction(async (trx) => {
        try {
            if (Array.isArray(items)) {
                const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
                headerData.total_quantity = totalQty;
            }

            let affectedRows = 0;
            if (Object.keys(headerData).length > 0) {
                affectedRows = await trx('invoice_challans').where({ id }).update(headerData);
            }

            if (Array.isArray(items)) {
                // Delete previous items and insert new ones
                await trx('invoice_challan_items').where({ challan_id: id }).del();

                if (items.length > 0) {
                    const itemRecords = items.map((it, idx) => ({
                        challan_id: id,
                        product_id: it.productId || null,
                        item_name: it.itemName,
                        description: it.description || null,
                        hsn_sac_code: it.hsnSacCode || null,
                        qty: Number(it.qty) || 1,
                        unit: it.unit || 'Nos',
                        rate: Number(it.rate) || 0,
                        total: Number(it.total) || ((Number(it.qty) || 1) * (Number(it.rate) || 0)),
                        sort_order: it.sortOrder !== undefined ? it.sortOrder : idx
                    }));
                    await trx('invoice_challan_items').insert(itemRecords);
                }
            }

            return affectedRows || 1;
        } catch (err) {
            if (err.constraint === 'unique_firm_challan_no') {
                throw new ApiError({
                    statusCode: 409,
                    message: 'Duplicate challan number found in this firm.',
                });
            }
            if (err.constraint === 'invoice_challans_invoice_id_foreign') {
                throw new ApiError({
                    statusCode: 409,
                    message: 'Invoice not found to update invoice challan.',
                });
            }
            if (err instanceof ApiError) {
                throw err;
            }
            throw new ApiError({
                statusCode: 500,
                message: 'Something went wrong while updating invoice challan data.',
            });
        }
    });
};

// Delete invoice challan by ID
const deleteInvoiceChallanById = async (id, isPermanentDelete) => {
    try {
        const { firmId = 0 } = getContext();

        // 1. Check if linked to an active invoice
        const activeInvoice = await db('invoice_challans as ic')
            .join('invoices as i', 'ic.invoice_id', 'i.id')
            .select('i.invoice_no')
            .where('ic.id', id)
            .andWhere('i.is_active', true);

        if (activeInvoice.length > 0) {
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete Challan because it is linked to active Invoice '${activeInvoice[0].invoice_no}'. Please unlink it from the invoice first.`
            });
        }

        // Hard delete
        if (isPermanentDelete) {
            await db('invoice_challan_items').where('challan_id', id).del();
            const delQuery = db('invoice_challans').where('id', id);
            if (firmId) delQuery.andWhere('firm_id', firmId);
            const result = await delQuery.del();
            return result > 0;
        }

        // Soft delete (move to trash)
        const updateQuery = db('invoice_challans').where('id', id);
        if (firmId) updateQuery.andWhere('firm_id', firmId);
        const updated = await updateQuery.update({ is_active: false });
        if (updated > 0) {
            await db('invoice_challan_items').where('challan_id', id).update({ is_active: false });
        }
        return updated > 0;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting invoice challan data.',
        });
    }
};

// Bulk delete invoice challans
const bulkDeleteInvoiceChallans = async (challanIds = [], isPermanentDelete = false) => {
    if (!challanIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        // Check if any are linked to an active invoice
        const activeInvoices = await db('invoice_challans as ic')
            .join('invoices as i', 'ic.invoice_id', 'i.id')
            .select('ic.challan_no', 'i.invoice_no')
            .whereIn('ic.id', challanIds)
            .andWhere('i.is_active', true);

        if (activeInvoices.length > 0) {
            const conflictList = activeInvoices.map(c => `Challan '${c.challan_no}' linked to Invoice '${c.invoice_no}'`).join(', ');
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete Challans: ${conflictList}. Please unlink them from invoices first.`
            });
        }

        if (isPermanentDelete) {
            await db('invoice_challan_items').whereIn('challan_id', challanIds).del();
            const delQuery = db('invoice_challans').whereIn('id', challanIds);
            if (firmId) delQuery.andWhere('firm_id', firmId);
            return await delQuery.del();
        }

        // Soft delete (bulk move to trash)
        const updateQuery = db('invoice_challans').whereIn('id', challanIds);
        if (firmId) updateQuery.andWhere('firm_id', firmId);
        const affectedRows = await updateQuery.update({ is_active: false });
        if (affectedRows > 0) {
            await db('invoice_challan_items').whereIn('challan_id', challanIds).update({ is_active: false });
        }

        return affectedRows;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting invoice challans.',
        });
    }
};

// Restore invoice challan by ID
const restoreInvoiceChallanById = async (id) => {
    try {
        const { firmId = 0 } = getContext();

        const challanQuery = db('invoice_challans')
            .where({ id, is_active: false });
        if (firmId) challanQuery.andWhere('firm_id', firmId);
        const challan = await challanQuery.first();

        if (!challan) {
            throw new ApiError({
                statusCode: 404,
                message: 'Challan not found in Trash or already active.'
            });
        }

        const updateQuery = db('invoice_challans')
            .where('id', id);
        if (firmId) updateQuery.andWhere('firm_id', firmId);
        const affectedRows = await updateQuery.update({ is_active: true });
        if (affectedRows > 0) {
            await db('invoice_challan_items').where('challan_id', id).update({ is_active: true });
        }

        return affectedRows > 0;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring invoice challan.',
        });
    }
};

// Bulk restore invoice challans
const bulkRestoreInvoiceChallans = async (challanIds = []) => {
    if (!challanIds.length) return 0;
    try {
        const { firmId = 0 } = getContext();

        const updateQuery = db('invoice_challans')
            .whereIn('id', challanIds)
            .andWhere('is_active', false);
        if (firmId) updateQuery.andWhere('firm_id', firmId);
        const affectedRows = await updateQuery.update({ is_active: true });
        if (affectedRows > 0) {
            await db('invoice_challan_items').whereIn('challan_id', challanIds).update({ is_active: true });
        }

        return affectedRows;
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring invoice challans.',
        });
    }
};

/**
 * Safely update challan → invoice mapping for One-to-Many relationship
 * with strict validation to prevent cross-invoice tampering.
 */
const updateInvoiceChallanMapping = async (trx, invoiceId, newChallanIds) => {
    const { firmId = 0 } = getContext();
    const uniqueNewIds = [...new Set((newChallanIds || []).map(Number))];

    if (uniqueNewIds.length > 0) {
        // 0️⃣ Fetch all challans being requested (validation)
        const challansQuery = trx('invoice_challans')
            .select('id', 'invoice_id')
            .whereIn('id', uniqueNewIds)
            .where('is_active', true);
        if (firmId) challansQuery.andWhere('firm_id', firmId);
        const challans = await challansQuery;

        // Validate: All challans must exist
        if (challans.length !== uniqueNewIds.length) {
            throw new ApiError({
                statusCode: 400,
                message: 'Invalid challan ID provided.',
            });
        }

        // 1️⃣ Fetch existing challans mapped to this invoice
        const existingQuery = trx('invoice_challans')
            .select('id')
            .where({ invoice_id: invoiceId, is_active: true });
        if (firmId) existingQuery.andWhere('firm_id', firmId);
        const existing = await existingQuery;

        const oldIds = existing.map(c => c.id);

        // 2️⃣ Calculate diff
        const toAdd = uniqueNewIds.filter(id => !oldIds.includes(id));
        const toRemove = oldIds.filter(id => !uniqueNewIds.includes(id));

        // 3️⃣ Apply updates: Map to this invoice and mark as BILLED
        if (toAdd.length > 0) {
            await trx('invoice_challans')
                .whereIn('id', toAdd)
                .update({ invoice_id: invoiceId, status: 'BILLED' });
        }

        // Unmap and restore to DISPATCHED
        if (toRemove.length > 0) {
            await trx('invoice_challans')
                .whereIn('id', toRemove)
                .update({ invoice_id: null, status: 'DISPATCHED' });
        }
    } else {
        // No challans selected — clear all existing for this invoice
        await trx('invoice_challans')
            .where({ invoice_id: invoiceId })
            .update({ invoice_id: null, status: 'DISPATCHED' });
    }
};

module.exports = {
    calculateNextChallanNumber,
    fetchNextExpectedChallanNumber,
    fetchAllInvoiceChallans,
    fetchInvoiceChallanMeta,
    fetchInvoiceChallanById,
    fetchInvoiceChallansByInvoiceId,
    insertInvoiceChallan,
    updateInvoiceChallanById,
    deleteInvoiceChallanById,
    bulkDeleteInvoiceChallans,
    restoreInvoiceChallanById,
    bulkRestoreInvoiceChallans,
    updateInvoiceChallanMapping
};
