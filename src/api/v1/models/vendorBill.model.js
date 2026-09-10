const Decimal = require("decimal.js");
const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");
const { ApiError } = require("../services/ApiError");

let paymentStatusMap = null;
const getPaymentStatusIds = async (trx = null) => {
    if (!paymentStatusMap) {
        const statuses = await (trx || db)('payment_statuses').select('id', 'code');
        paymentStatusMap = {};
        for (const s of statuses) {
            paymentStatusMap[s.code] = s.id;
        }
    }
    return paymentStatusMap;
};

/**
 * Create a new vendor bill
 */
const createVendorBill = async (billData) => {
    const { firmId = 0 } = getContext();
    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm context is required.' });
    }

    const {
        partyId,
        branchId,
        billNo,
        billDate,
        dueDays,
        dueDate,
        taxableAmount = 0,
        cgst = 0,
        sgst = 0,
        igst = 0,
        otherCharges = 0,
        roundOff = 0,
        total,
        notes
    } = billData;

    // Verify vendor exists
    const party = await db('parties')
        .where({ id: partyId, firm_id: firmId, is_active: true })
        .first();

    if (!party) {
        throw new ApiError({ statusCode: 404, message: 'Vendor party not found or inactive.' });
    }

    // Check duplicate bill number for same vendor in this firm
    const existingBill = await db('vendor_bills')
        .where({
            firm_id: firmId,
            party_id: partyId,
            bill_no: billNo.trim(),
            is_active: true
        })
        .first();

    if (existingBill) {
        throw new ApiError({
            statusCode: 409,
            message: `A bill with number "${billNo}" already exists for this vendor.`
        });
    }

    // Calculate total if not explicitly provided or to verify
    const taxableDec = new Decimal(taxableAmount || 0);
    const cgstDec = new Decimal(cgst || 0);
    const sgstDec = new Decimal(sgst || 0);
    const igstDec = new Decimal(igst || 0);
    const otherDec = new Decimal(otherCharges || 0);
    const roundOffDec = new Decimal(roundOff || 0);

    const calculatedTotal = taxableDec
        .plus(cgstDec)
        .plus(sgstDec)
        .plus(igstDec)
        .plus(otherDec)
        .plus(roundOffDec);

    const finalTotal = total !== undefined && total !== null
        ? new Decimal(total).toNumber()
        : calculatedTotal.toNumber();

    if (finalTotal <= 0) {
        throw new ApiError({ statusCode: 400, message: 'Vendor bill total amount must be greater than 0.' });
    }

    const statusMap = await getPaymentStatusIds();
    const pendingStatusId = statusMap['PENDING'];

    // Auto-calculate dueDate from billDate + dueDays if not directly passed
    let finalDueDate = dueDate || null;
    if (!finalDueDate && dueDays && billDate) {
        const d = new Date(billDate);
        d.setDate(d.getDate() + Number(dueDays));
        finalDueDate = d.toISOString().split('T')[0];
    }

    const [vendorBill] = await db('vendor_bills').insert({
        firm_id: firmId,
        party_id: partyId,
        branch_id: branchId || null,
        bill_no: billNo.trim(),
        bill_date: billDate,
        due_days: dueDays ? Number(dueDays) : null,
        due_date: finalDueDate,
        taxable_amount: taxableDec.toNumber(),
        cgst: cgstDec.toNumber(),
        sgst: sgstDec.toNumber(),
        igst: igstDec.toNumber(),
        other_charges: otherDec.toNumber(),
        round_off: roundOffDec.toNumber(),
        total: finalTotal,
        paid_amount: 0.00,
        balance_amount: finalTotal,
        payment_status_id: pendingStatusId,
        status: 'ACTIVE',
        notes: notes?.trim() || null
    }).returning('*');

    return vendorBill;
};

/**
 * Fetch all vendor bills with pagination, search, and filters
 */
const fetchAllVendorBills = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        page = 1,
        pageSize = 10,
        search = '',
        partyId,
        paymentStatusId,
        status,
        startDate,
        endDate,
        sortBy = 'bill_date',
        sortOrder = 'desc'
    } = query;

    const baseQuery = db('vendor_bills as vb')
        .select(
            'vb.id',
            'vb.bill_no as billNo',
            'vb.bill_date as billDate',
            'vb.due_days as dueDays',
            'vb.due_date as dueDate',
            'vb.party_id as partyId',
            db.raw('COALESCE(pt.display_name, pt.legal_name) as "vendorName"'),
            'pt.gstin as vendorGstin',
            'vb.branch_id as branchId',
            'pb.branch_name as branchName',
            'vb.taxable_amount as taxableAmount',
            'vb.cgst',
            'vb.sgst',
            'vb.igst',
            'vb.other_charges as otherCharges',
            'vb.round_off as roundOff',
            'vb.total',
            'vb.paid_amount as paidAmount',
            'vb.balance_amount as balanceAmount',
            'vb.payment_status_id as paymentStatusId',
            'ps.label as paymentStatus',
            'ps.code as paymentStatusCode',
            'vb.status',
            'vb.notes',
            'vb.created_at as createdAt',
            db.raw("CONCAT(u.first_name, ' ', u.last_name) as createdByName")
        )
        .leftJoin('parties as pt', 'vb.party_id', 'pt.id')
        .leftJoin('party_branches as pb', 'vb.branch_id', 'pb.id')
        .leftJoin('payment_statuses as ps', 'vb.payment_status_id', 'ps.id')
        .leftJoin('users as u', 'vb.created_by', 'u.id')
        .where('vb.firm_id', firmId)
        .where('vb.is_active', true);

    if (partyId) {
        baseQuery.where('vb.party_id', partyId);
    }

    if (paymentStatusId) {
        baseQuery.where('vb.payment_status_id', paymentStatusId);
    }

    if (status) {
        baseQuery.where('vb.status', status);
    }

    if (startDate) {
        baseQuery.where('vb.bill_date', '>=', startDate);
    }

    if (endDate) {
        baseQuery.where('vb.bill_date', '<=', endDate);
    }

    if (search) {
        baseQuery.where(function () {
            this.where('vb.bill_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.gstin', 'ILIKE', `%${search}%`);
        });
    }

    const validSortCols = {
        bill_date: 'vb.bill_date',
        bill_no: 'vb.bill_no',
        total: 'vb.total',
        balance_amount: 'vb.balance_amount',
        due_date: 'vb.due_date',
        created_at: 'vb.created_at'
    };

    const sortColumn = validSortCols[sortBy] || 'vb.bill_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    baseQuery.orderBy(sortColumn, order).orderBy('vb.id', 'desc');

    return await fetchPageData({ baseQuery, page, pageSize });
};

/**
 * Fetch vendor bills pagination metadata
 */
const fetchVendorBillsMeta = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        page = 1,
        pageSize = 10,
        search = '',
        partyId,
        paymentStatusId,
        status,
        startDate,
        endDate
    } = query;

    const baseQuery = db('vendor_bills as vb')
        .leftJoin('parties as pt', 'vb.party_id', 'pt.id')
        .where('vb.firm_id', firmId)
        .where('vb.is_active', true);

    if (partyId) {
        baseQuery.where('vb.party_id', partyId);
    }

    if (paymentStatusId) {
        baseQuery.where('vb.payment_status_id', paymentStatusId);
    }

    if (status) {
        baseQuery.where('vb.status', status);
    }

    if (startDate) {
        baseQuery.where('vb.bill_date', '>=', startDate);
    }

    if (endDate) {
        baseQuery.where('vb.bill_date', '<=', endDate);
    }

    if (search) {
        baseQuery.where(function () {
            this.where('vb.bill_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.gstin', 'ILIKE', `%${search}%`);
        });
    }

    return await buildPagination({ baseQuery, page, pageSize });
};

/**
 * Fetch summary metrics for vendor bills
 */
const fetchVendorBillsSummary = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        search = '',
        partyId,
        paymentStatusId,
        status,
        startDate,
        endDate
    } = query;

    const baseQuery = db('vendor_bills as vb')
        .leftJoin('parties as pt', 'vb.party_id', 'pt.id')
        .leftJoin('payment_statuses as ps', 'vb.payment_status_id', 'ps.id')
        .where('vb.firm_id', firmId)
        .where('vb.is_active', true);

    if (partyId) {
        baseQuery.where('vb.party_id', partyId);
    }

    if (paymentStatusId) {
        baseQuery.where('vb.payment_status_id', paymentStatusId);
    }

    if (status) {
        baseQuery.where('vb.status', status);
    }

    if (startDate) {
        baseQuery.where('vb.bill_date', '>=', startDate);
    }

    if (endDate) {
        baseQuery.where('vb.bill_date', '<=', endDate);
    }

    if (search) {
        baseQuery.where(function () {
            this.where('vb.bill_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    const summary = await baseQuery
        .select(
            db.raw(`COALESCE(SUM(vb.total), 0) as "totalBillsAmount"`),
            db.raw(`COALESCE(SUM(vb.paid_amount), 0) as "totalPaidAmount"`),
            db.raw(`COALESCE(SUM(vb.balance_amount), 0) as "totalBalanceDue"`),
            db.raw(`COUNT(CASE WHEN ps.code = 'PENDING' THEN 1 END) as "pendingCount"`),
            db.raw(`COUNT(CASE WHEN ps.code = 'PARTIAL' THEN 1 END) as "partialCount"`),
            db.raw(`COUNT(CASE WHEN ps.code = 'PAID' THEN 1 END) as "paidCount"`),
            db.raw(`COUNT(*) as "totalCount"`)
        )
        .first();

    return {
        totalBillsAmount: Number(summary?.totalBillsAmount || 0),
        totalPaidAmount: Number(summary?.totalPaidAmount || 0),
        totalBalanceDue: Number(summary?.totalBalanceDue || 0),
        pendingCount: Number(summary?.pendingCount || 0),
        partialCount: Number(summary?.partialCount || 0),
        paidCount: Number(summary?.paidCount || 0),
        totalCount: Number(summary?.totalCount || 0)
    };
};

/**
 * Fetch a single vendor bill by ID with payments and attachments
 */
const fetchVendorBillById = async (id) => {
    const { firmId = 0 } = getContext();

    const bill = await db('vendor_bills as vb')
        .select(
            'vb.id',
            'vb.firm_id as firmId',
            'vb.bill_no as billNo',
            'vb.bill_date as billDate',
            'vb.due_days as dueDays',
            'vb.due_date as dueDate',
            'vb.party_id as partyId',
            db.raw('COALESCE(pt.display_name, pt.legal_name) as "vendorName"'),
            'pt.legal_name as vendorLegalName',
            'pt.display_name as vendorDisplayName',
            'pt.gstin as vendorGstin',
            'pt.mobile as vendorMobile',
            'pt.email as vendorEmail',
            'vb.branch_id as branchId',
            'pb.branch_name as branchName',
            'vb.taxable_amount as taxableAmount',
            'vb.cgst',
            'vb.sgst',
            'vb.igst',
            'vb.other_charges as otherCharges',
            'vb.round_off as roundOff',
            'vb.total',
            'vb.paid_amount as paidAmount',
            'vb.balance_amount as balanceAmount',
            'vb.payment_status_id as paymentStatusId',
            'ps.label as paymentStatus',
            'ps.code as paymentStatusCode',
            'vb.status',
            'vb.notes',
            'vb.created_at as createdAt',
            'vb.updated_at as updatedAt',
            db.raw("CONCAT(u.first_name, ' ', u.last_name) as createdByName")
        )
        .leftJoin('parties as pt', 'vb.party_id', 'pt.id')
        .leftJoin('party_branches as pb', 'vb.branch_id', 'pb.id')
        .leftJoin('payment_statuses as ps', 'vb.payment_status_id', 'ps.id')
        .leftJoin('users as u', 'vb.created_by', 'u.id')
        .where({ 'vb.id': id, 'vb.firm_id': firmId, 'vb.is_active': true })
        .first();

    if (!bill) {
        return null;
    }

    // Fetch payments allocated to this bill
    const paymentHistory = await db('payment_allocations as pa')
        .select(
            'pa.id as allocationId',
            'p.id as paymentId',
            'p.payment_no as paymentNo',
            'p.payment_date as paymentDate',
            'pm.label as paymentMode',
            'p.reference_no as referenceNo',
            'pa.allocated_amount as cashPaid',
            'pa.tds_amount as tdsDeducted',
            'pa.write_off_amount as writeOffAmount',
            'pa.write_off_reason as writeOffReason',
            'pa.total_settled_amount as totalSettled',
            'p.status as paymentStatus',
            'pa.created_at as recordedAt'
        )
        .join('payments as p', 'pa.payment_id', 'p.id')
        .leftJoin('payment_modes as pm', 'p.payment_mode_id', 'pm.id')
        .where('pa.vendor_bill_id', id)
        .where('p.status', 'COMPLETED')
        .where('p.is_active', true)
        .orderBy('p.payment_date', 'desc')
        .orderBy('pa.id', 'desc');

    // Fetch attachments (images, PDFs)
    const attachments = await db('attachments')
        .select(
            'id',
            'doc_type as docType',
            'title',
            'original_name as originalName',
            'file_size_bytes as fileSizeBytes',
            'mime_type as mimeType',
            'public_id as publicId',
            'secure_url as secureUrl',
            'resource_type as resourceType',
            'created_at as createdAt'
        )
        .where({
            firm_id: firmId,
            entity_type: 'VENDOR_BILL',
            entity_id: id,
            is_active: true
        })
        .orderBy('id', 'desc');

    return {
        ...bill,
        paymentHistory,
        attachments
    };
};

/**
 * Update an existing vendor bill
 */
const updateVendorBill = async (id, updateData) => {
    const { firmId = 0 } = getContext();

    const existingBill = await db('vendor_bills')
        .where({ id, firm_id: firmId, is_active: true })
        .first();

    if (!existingBill) {
        throw new ApiError({ statusCode: 404, message: 'Vendor bill not found.' });
    }

    const {
        branchId,
        billNo,
        billDate,
        dueDays,
        dueDate,
        taxableAmount,
        cgst,
        sgst,
        igst,
        otherCharges,
        roundOff,
        total,
        notes
    } = updateData;

    // If bill already has payments, guard against changing monetary values
    const currentPaid = new Decimal(existingBill.paid_amount || 0);
    const hasMonetaryChanges =
        taxableAmount !== undefined ||
        cgst !== undefined ||
        sgst !== undefined ||
        igst !== undefined ||
        otherCharges !== undefined ||
        roundOff !== undefined ||
        total !== undefined;

    if (currentPaid.gt(0) && hasMonetaryChanges) {
        throw new ApiError({
            statusCode: 422,
            message: `Cannot modify monetary amounts of a bill with existing payments (paid: ₹${currentPaid.toFixed(2)}). Cancel associated payments first.`
        });
    }

    // Check duplicate bill_no if billNo changed
    if (billNo && billNo.trim() !== existingBill.bill_no) {
        const duplicate = await db('vendor_bills')
            .where({
                firm_id: firmId,
                party_id: existingBill.party_id,
                bill_no: billNo.trim(),
                is_active: true
            })
            .whereNot({ id })
            .first();

        if (duplicate) {
            throw new ApiError({
                statusCode: 409,
                message: `Another bill with number "${billNo}" already exists for this vendor.`
            });
        }
    }

    const updateFields = {};
    if (branchId !== undefined) updateFields.branch_id = branchId || null;
    if (billNo) updateFields.bill_no = billNo.trim();
    if (billDate) updateFields.bill_date = billDate;
    if (dueDays !== undefined) updateFields.due_days = dueDays ? Number(dueDays) : null;
    if (dueDate !== undefined) updateFields.due_date = dueDate || null;
    if (notes !== undefined) updateFields.notes = notes?.trim() || null;

    if (hasMonetaryChanges && currentPaid.isZero()) {
        const taxableDec = new Decimal(taxableAmount !== undefined ? taxableAmount : existingBill.taxable_amount);
        const cgstDec = new Decimal(cgst !== undefined ? cgst : existingBill.cgst);
        const sgstDec = new Decimal(sgst !== undefined ? sgst : existingBill.sgst);
        const igstDec = new Decimal(igst !== undefined ? igst : existingBill.igst);
        const otherDec = new Decimal(otherCharges !== undefined ? otherCharges : existingBill.other_charges);
        const roundOffDec = new Decimal(roundOff !== undefined ? roundOff : existingBill.round_off);

        const calculatedTotal = taxableDec
            .plus(cgstDec)
            .plus(sgstDec)
            .plus(igstDec)
            .plus(otherDec)
            .plus(roundOffDec);

        const finalTotal = total !== undefined ? new Decimal(total).toNumber() : calculatedTotal.toNumber();

        updateFields.taxable_amount = taxableDec.toNumber();
        updateFields.cgst = cgstDec.toNumber();
        updateFields.sgst = sgstDec.toNumber();
        updateFields.igst = igstDec.toNumber();
        updateFields.other_charges = otherDec.toNumber();
        updateFields.round_off = roundOffDec.toNumber();
        updateFields.total = finalTotal;
        updateFields.balance_amount = finalTotal;
    }

    await db('vendor_bills')
        .where({ id, firm_id: firmId })
        .update(updateFields);

    return await fetchVendorBillById(id);
};

/**
 * Soft delete vendor bill with safety guard
 */
const deleteVendorBill = async (id) => {
    const { firmId = 0 } = getContext();

    const bill = await db('vendor_bills')
        .where({ id, firm_id: firmId, is_active: true })
        .first();

    if (!bill) {
        throw new ApiError({ statusCode: 404, message: 'Vendor bill not found.' });
    }

    const currentPaid = new Decimal(bill.paid_amount || 0);
    if (currentPaid.gt(0)) {
        throw new ApiError({
            statusCode: 422,
            message: `Cannot delete vendor bill #${bill.bill_no} because payments (₹${currentPaid.toFixed(2)}) have been recorded against it. Cancel the payments first.`
        });
    }

    // Check if any allocation records exist
    const hasAllocations = await db('payment_allocations')
        .where({ vendor_bill_id: id })
        .first();

    if (hasAllocations) {
        throw new ApiError({
            statusCode: 422,
            message: `Cannot delete vendor bill #${bill.bill_no} because payment allocation records are attached to it.`
        });
    }

    await db('vendor_bills')
        .where({ id, firm_id: firmId })
        .update({ is_active: false });

    return { id, message: `Vendor bill #${bill.bill_no} deleted successfully.` };
};

/**
 * Fetch unpaid or partially paid vendor bills for a specific vendor
 */
const fetchUnpaidVendorBillsByParty = async (partyId) => {
    const { firmId = 0 } = getContext();

    const party = await db('parties').where({ id: partyId, firm_id: firmId, is_active: true }).first();
    if (!party) {
        throw new ApiError({ statusCode: 404, message: 'Vendor party not found.' });
    }

    const statusMap = await getPaymentStatusIds();

    const bills = await db('vendor_bills as vb')
        .select(
            'vb.id',
            'vb.bill_no as billNo',
            'vb.bill_date as billDate',
            'vb.due_date as dueDate',
            'vb.total',
            'vb.paid_amount as paidAmount',
            'vb.balance_amount as balanceAmount',
            'vb.payment_status_id as paymentStatusId',
            'ps.label as paymentStatus'
        )
        .join('payment_statuses as ps', 'vb.payment_status_id', 'ps.id')
        .where('vb.firm_id', firmId)
        .where('vb.party_id', partyId)
        .where('vb.is_active', true)
        .where('vb.payment_status_id', '!=', statusMap['PAID'])
        .where('vb.balance_amount', '>', 0)
        .orderBy('vb.bill_date', 'asc')
        .orderBy('vb.id', 'asc');

    return bills;
};

module.exports = {
    getPaymentStatusIds,
    createVendorBill,
    fetchAllVendorBills,
    fetchVendorBillsMeta,
    fetchVendorBillsSummary,
    fetchVendorBillById,
    updateVendorBill,
    deleteVendorBill,
    fetchUnpaidVendorBillsByParty
};
