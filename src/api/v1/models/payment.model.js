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
 * Generate sequential payment number for a firm (REC-0001 for INWARD, PAY-0001 for OUTWARD)
 */
const generateNextPaymentNumber = async (firmId, paymentType = 'INWARD', trx = null) => {
    const prefix = paymentType === 'OUTWARD' ? 'PAY' : 'REC';
    const query = (trx || db)('payments')
        .select('payment_no')
        .where({ firm_id: firmId, payment_type: paymentType })
        .where('payment_no', 'like', `${prefix}-%`)
        .orderBy('id', 'desc')
        .first();

    const lastPayment = await query;
    if (!lastPayment || !lastPayment.payment_no) {
        return `${prefix}-0001`;
    }

    const regex = new RegExp(`${prefix}-(\\d+)`);
    const match = lastPayment.payment_no.match(regex);
    if (!match) {
        return `${prefix}-0001`;
    }

    const nextNum = parseInt(match[1], 10) + 1;
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
};

const generateNextReceiptNumber = async (firmId, trx = null) => {
    return await generateNextPaymentNumber(firmId, 'INWARD', trx);
};

/**
 * Create a Customer Receipt with invoice allocations inside a DB transaction (INWARD)
 */
const createReceiptTransaction = async (receiptData) => {
    const { firmId = 0 } = getContext();
    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm context is required.' });
    }

    const {
        paymentDate,
        partyId,
        totalAmount,
        paymentModeId,
        referenceNo,
        referenceDate,
        bankName,
        notes,
        allocations = []
    } = receiptData;

    const totalAmountDec = new Decimal(totalAmount || 0);
    if (totalAmountDec.lte(0)) {
        throw new ApiError({ statusCode: 400, message: 'Total receipt amount must be greater than 0.' });
    }

    return await db.transaction(async (trx) => {
        // 1. Calculate and validate allocations
        let allocatedSum = new Decimal(0);
        const processedAllocations = [];

        for (const item of allocations) {
            const allocAmount = new Decimal(item.allocatedAmount || 0);
            const tdsAmount = new Decimal(item.tdsAmount || 0);
            const writeOffAmount = new Decimal(item.writeOffAmount || 0);
            const totalSettled = allocAmount.plus(tdsAmount).plus(writeOffAmount);

            if (totalSettled.lte(0)) {
                continue; // Skip zero-amount rows
            }

            if (writeOffAmount.gt(0) && (!item.writeOffReason || !item.writeOffReason.trim())) {
                throw new ApiError({
                    statusCode: 400,
                    message: `Write-off reason is required for invoice #${item.invoiceId} when a write-off amount is specified.`
                });
            }

            allocatedSum = allocatedSum.plus(allocAmount);

            // 2. Lock invoice row and verify balance
            const invoice = await trx('invoices')
                .where({ id: item.invoiceId, firm_id: firmId, is_active: true })
                .forUpdate()
                .first();

            if (!invoice) {
                throw new ApiError({
                    statusCode: 404,
                    message: `Invoice #${item.invoiceId} not found or inactive.`
                });
            }

            const currentBalance = new Decimal(
                invoice.balance_amount !== undefined && invoice.balance_amount !== null
                    ? invoice.balance_amount
                    : invoice.total
            );

            // Check if settled amount exceeds balance (with 1 paise tolerance)
            if (totalSettled.gt(currentBalance.plus(0.01))) {
                throw new ApiError({
                    statusCode: 422,
                    message: `Total settled amount (₹${totalSettled.toFixed(2)}) cannot exceed remaining balance due (₹${currentBalance.toFixed(2)}) on invoice ${invoice.invoice_no}.`
                });
            }

            processedAllocations.push({
                invoice,
                allocAmount,
                tdsAmount,
                writeOffAmount,
                writeOffReason: item.writeOffReason?.trim() || null,
                totalSettled
            });
        }

        // Validate that allocated cash doesn't exceed total cash received
        if (allocatedSum.gt(totalAmountDec)) {
            throw new ApiError({
                statusCode: 422,
                message: `Total allocated cash (₹${allocatedSum.toFixed(2)}) cannot exceed total receipt amount received (₹${totalAmountDec.toFixed(2)}).`
            });
        }

        const unallocatedAmountDec = totalAmountDec.minus(allocatedSum);

        // 3. Generate sequential receipt number
        const paymentNo = await generateNextPaymentNumber(firmId, 'INWARD', trx);

        // 4. Insert payment record
        const [payment] = await trx('payments').insert({
            firm_id: firmId,
            payment_no: paymentNo,
            payment_type: 'INWARD',
            payment_date: paymentDate,
            party_id: partyId,
            total_amount: totalAmountDec.toNumber(),
            allocated_amount: allocatedSum.toNumber(),
            unallocated_amount: unallocatedAmountDec.toNumber(),
            payment_mode_id: paymentModeId,
            reference_no: referenceNo?.trim() || null,
            reference_date: referenceDate || null,
            bank_name: bankName?.trim() || null,
            status: 'COMPLETED',
            notes: notes?.trim() || null
        }).returning('*');

        // 5. Insert allocations and update invoice balances & statuses
        const statusMap = await getPaymentStatusIds(trx);

        for (const alloc of processedAllocations) {
            await trx('payment_allocations').insert({
                payment_id: payment.id,
                invoice_id: alloc.invoice.id,
                allocated_amount: alloc.allocAmount.toNumber(),
                tds_amount: alloc.tdsAmount.toNumber(),
                write_off_amount: alloc.writeOffAmount.toNumber(),
                write_off_reason: alloc.writeOffReason,
                total_settled_amount: alloc.totalSettled.toNumber()
            });

            const currentPaid = new Decimal(alloc.invoice.paid_amount || 0);
            const newPaid = currentPaid.plus(alloc.totalSettled);
            const newBalance = new Decimal(alloc.invoice.total).minus(newPaid);
            const cleanBalance = newBalance.lte(0.01) ? 0 : newBalance.toNumber();
            const newStatusId = cleanBalance <= 0 ? statusMap['PAID'] : statusMap['PARTIAL'];

            await trx('invoices')
                .where({ id: alloc.invoice.id })
                .update({
                    paid_amount: newPaid.toNumber(),
                    balance_amount: cleanBalance,
                    payment_status_id: newStatusId
                });
        }

        return {
            ...payment,
            allocationsCount: processedAllocations.length
        };
    });
};

/**
 * Create a Vendor Payment with vendor bill allocations inside a DB transaction (OUTWARD)
 * Supports partial payments against bills and saving excess as vendor advance (unallocated_amount)
 */
const createVendorPaymentTransaction = async (paymentData) => {
    const { firmId = 0 } = getContext();
    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm context is required.' });
    }

    const {
        paymentDate,
        partyId,
        totalAmount,
        paymentModeId,
        referenceNo,
        referenceDate,
        bankName,
        notes,
        allocations = []
    } = paymentData;

    const totalAmountDec = new Decimal(totalAmount || 0);
    if (totalAmountDec.lte(0)) {
        throw new ApiError({ statusCode: 400, message: 'Total payment amount must be greater than 0.' });
    }

    // Verify vendor exists
    const party = await db('parties').where({ id: partyId, firm_id: firmId, is_active: true }).first();
    if (!party) {
        throw new ApiError({ statusCode: 404, message: 'Vendor party not found or inactive.' });
    }

    return await db.transaction(async (trx) => {
        let allocatedSum = new Decimal(0);
        const processedAllocations = [];

        for (const item of allocations) {
            const allocAmount = new Decimal(item.allocatedAmount || 0);
            const tdsAmount = new Decimal(item.tdsAmount || 0);
            const writeOffAmount = new Decimal(item.writeOffAmount || 0);
            const totalSettled = allocAmount.plus(tdsAmount).plus(writeOffAmount);

            if (totalSettled.lte(0)) {
                continue; // Skip zero-amount rows
            }

            if (writeOffAmount.gt(0) && (!item.writeOffReason || !item.writeOffReason.trim())) {
                throw new ApiError({
                    statusCode: 400,
                    message: `Write-off reason is required for bill #${item.vendorBillId} when a write-off amount is specified.`
                });
            }

            allocatedSum = allocatedSum.plus(allocAmount);

            // Lock vendor bill row and verify balance
            const bill = await trx('vendor_bills')
                .where({ id: item.vendorBillId, firm_id: firmId, party_id: partyId, is_active: true })
                .forUpdate()
                .first();

            if (!bill) {
                throw new ApiError({
                    statusCode: 404,
                    message: `Vendor bill #${item.vendorBillId} not found or does not belong to this vendor.`
                });
            }

            const currentBalance = new Decimal(
                bill.balance_amount !== undefined && bill.balance_amount !== null
                    ? bill.balance_amount
                    : bill.total
            );

            // Verify settled amount does not exceed bill's remaining balance
            if (totalSettled.gt(currentBalance.plus(0.01))) {
                throw new ApiError({
                    statusCode: 422,
                    message: `Total settled amount (₹${totalSettled.toFixed(2)}) cannot exceed remaining balance due (₹${currentBalance.toFixed(2)}) on bill ${bill.bill_no}.`
                });
            }

            processedAllocations.push({
                bill,
                allocAmount,
                tdsAmount,
                writeOffAmount,
                writeOffReason: item.writeOffReason?.trim() || null,
                totalSettled
            });
        }

        // Validate that allocated cash doesn't exceed total cash disbursed
        if (allocatedSum.gt(totalAmountDec)) {
            throw new ApiError({
                statusCode: 422,
                message: `Total allocated cash (₹${allocatedSum.toFixed(2)}) cannot exceed total payment amount disbursed (₹${totalAmountDec.toFixed(2)}).`
            });
        }

        const unallocatedAmountDec = totalAmountDec.minus(allocatedSum);

        // Generate sequential payment number (PAY-0001)
        const paymentNo = await generateNextPaymentNumber(firmId, 'OUTWARD', trx);

        // Insert payment record
        const [payment] = await trx('payments').insert({
            firm_id: firmId,
            payment_no: paymentNo,
            payment_type: 'OUTWARD',
            payment_date: paymentDate,
            party_id: partyId,
            total_amount: totalAmountDec.toNumber(),
            allocated_amount: allocatedSum.toNumber(),
            unallocated_amount: unallocatedAmountDec.toNumber(),
            payment_mode_id: paymentModeId,
            reference_no: referenceNo?.trim() || null,
            reference_date: referenceDate || null,
            bank_name: bankName?.trim() || null,
            status: 'COMPLETED',
            notes: notes?.trim() || null
        }).returning('*');

        // Insert allocations and update vendor bill balances & statuses
        const statusMap = await getPaymentStatusIds(trx);

        for (const alloc of processedAllocations) {
            await trx('payment_allocations').insert({
                payment_id: payment.id,
                vendor_bill_id: alloc.bill.id,
                allocated_amount: alloc.allocAmount.toNumber(),
                tds_amount: alloc.tdsAmount.toNumber(),
                write_off_amount: alloc.writeOffAmount.toNumber(),
                write_off_reason: alloc.writeOffReason,
                total_settled_amount: alloc.totalSettled.toNumber()
            });

            const currentPaid = new Decimal(alloc.bill.paid_amount || 0);
            const newPaid = currentPaid.plus(alloc.totalSettled);
            const newBalance = new Decimal(alloc.bill.total).minus(newPaid);
            const cleanBalance = newBalance.lte(0.01) ? 0 : newBalance.toNumber();
            const newStatusId = cleanBalance <= 0 ? statusMap['PAID'] : statusMap['PARTIAL'];

            await trx('vendor_bills')
                .where({ id: alloc.bill.id })
                .update({
                    paid_amount: newPaid.toNumber(),
                    balance_amount: cleanBalance,
                    payment_status_id: newStatusId
                });
        }

        return {
            ...payment,
            allocationsCount: processedAllocations.length
        };
    });
};

/**
 * Apply unallocated customer advance balance to unpaid invoices without new money moving
 */
const applyCustomerAdvanceTransaction = async ({ paymentId, allocations = [] }) => {
    const { firmId = 0 } = getContext();

    if (!allocations || !allocations.length) {
        throw new ApiError({ statusCode: 400, message: 'At least one invoice allocation is required.' });
    }

    return await db.transaction(async (trx) => {
        // Lock and verify payment record
        const payment = await trx('payments')
            .where({ id: paymentId, firm_id: firmId, is_active: true, payment_type: 'INWARD' })
            .forUpdate()
            .first();

        if (!payment) {
            throw new ApiError({ statusCode: 404, message: 'Payment receipt not found or not an inward payment.' });
        }

        if (payment.status === 'CANCELLED') {
            throw new ApiError({ statusCode: 400, message: 'Cannot apply advance from a cancelled payment.' });
        }

        const availableAdvance = new Decimal(payment.unallocated_amount || 0);
        if (availableAdvance.lte(0)) {
            throw new ApiError({ statusCode: 422, message: 'This receipt has no unallocated advance balance available.' });
        }

        let totalAllocatedCash = new Decimal(0);
        const processedAllocations = [];

        for (const item of allocations) {
            const allocAmount = new Decimal(item.allocatedAmount || 0);
            const tdsAmount = new Decimal(item.tdsAmount || 0);
            const writeOffAmount = new Decimal(item.writeOffAmount || 0);
            const totalSettled = allocAmount.plus(tdsAmount).plus(writeOffAmount);

            if (totalSettled.lte(0)) continue;

            if (writeOffAmount.gt(0) && (!item.writeOffReason || !item.writeOffReason.trim())) {
                throw new ApiError({
                    statusCode: 400,
                    message: `Write-off reason is required for invoice #${item.invoiceId}.`
                });
            }

            totalAllocatedCash = totalAllocatedCash.plus(allocAmount);

            // Lock invoice and verify it belongs to same customer
            const invoice = await trx('invoices')
                .where({ id: item.invoiceId, firm_id: firmId, is_active: true })
                .forUpdate()
                .first();

            if (!invoice) {
                throw new ApiError({ statusCode: 404, message: `Invoice #${item.invoiceId} not found.` });
            }

            // Verify invoice belongs to the same party
            if (invoice.party_id && invoice.party_id !== payment.party_id) {
                throw new ApiError({
                    statusCode: 422,
                    message: `Invoice #${invoice.invoice_no} does not belong to the party on this receipt.`
                });
            }

            const currentBalance = new Decimal(
                invoice.balance_amount !== undefined && invoice.balance_amount !== null
                    ? invoice.balance_amount
                    : invoice.total
            );

            if (totalSettled.gt(currentBalance.plus(0.01))) {
                throw new ApiError({
                    statusCode: 422,
                    message: `Total settled amount (₹${totalSettled.toFixed(2)}) exceeds balance (₹${currentBalance.toFixed(2)}) on invoice ${invoice.invoice_no}.`
                });
            }

            processedAllocations.push({
                invoice,
                allocAmount,
                tdsAmount,
                writeOffAmount,
                writeOffReason: item.writeOffReason?.trim() || null,
                totalSettled
            });
        }

        if (totalAllocatedCash.gt(availableAdvance)) {
            throw new ApiError({
                statusCode: 422,
                message: `Total advance cash applied (₹${totalAllocatedCash.toFixed(2)}) exceeds available advance balance (₹${availableAdvance.toFixed(2)}).`
            });
        }

        const statusMap = await getPaymentStatusIds(trx);

        // Insert new allocations and update invoices
        for (const alloc of processedAllocations) {
            await trx('payment_allocations').insert({
                payment_id: payment.id,
                invoice_id: alloc.invoice.id,
                allocated_amount: alloc.allocAmount.toNumber(),
                tds_amount: alloc.tdsAmount.toNumber(),
                write_off_amount: alloc.writeOffAmount.toNumber(),
                write_off_reason: alloc.writeOffReason,
                total_settled_amount: alloc.totalSettled.toNumber()
            });

            const currentPaid = new Decimal(alloc.invoice.paid_amount || 0);
            const newPaid = currentPaid.plus(alloc.totalSettled);
            const newBalance = new Decimal(alloc.invoice.total).minus(newPaid);
            const cleanBalance = newBalance.lte(0.01) ? 0 : newBalance.toNumber();
            const newStatusId = cleanBalance <= 0 ? statusMap['PAID'] : statusMap['PARTIAL'];

            await trx('invoices')
                .where({ id: alloc.invoice.id })
                .update({
                    paid_amount: newPaid.toNumber(),
                    balance_amount: cleanBalance,
                    payment_status_id: newStatusId
                });
        }

        // Update payment receipt balances
        const newAllocated = new Decimal(payment.allocated_amount || 0).plus(totalAllocatedCash);
        const newUnallocated = availableAdvance.minus(totalAllocatedCash);

        await trx('payments')
            .where({ id: payment.id })
            .update({
                allocated_amount: newAllocated.toNumber(),
                unallocated_amount: newUnallocated.toNumber()
            });

        return {
            paymentId: payment.id,
            paymentNo: payment.payment_no,
            appliedAmount: totalAllocatedCash.toNumber(),
            remainingAdvance: newUnallocated.toNumber(),
            allocationsCount: processedAllocations.length
        };
    });
};

/**
 * Fetch available advance payments for a party (customer or vendor)
 */
const fetchAvailableAdvancesByParty = async (partyId, paymentType = 'INWARD') => {
    const { firmId = 0 } = getContext();

    const advances = await db('payments as p')
        .select(
            'p.id',
            'p.payment_no as paymentNo',
            'p.payment_date as paymentDate',
            'p.total_amount as totalAmount',
            'p.allocated_amount as allocatedAmount',
            'p.unallocated_amount as unallocatedAmount',
            'p.payment_mode_id as paymentModeId',
            'pm.label as paymentMode',
            'p.reference_no as referenceNo',
            'p.bank_name as bankName',
            'p.created_at as createdAt'
        )
        .leftJoin('payment_modes as pm', 'p.payment_mode_id', 'pm.id')
        .where({
            'p.firm_id': firmId,
            'p.party_id': partyId,
            'p.payment_type': paymentType,
            'p.status': 'COMPLETED',
            'p.is_active': true
        })
        .where('p.unallocated_amount', '>', 0)
        .orderBy('p.payment_date', 'asc')
        .orderBy('p.id', 'asc');

    return advances;
};

/**
 * Cancel a payment (works polymorphically for both INWARD receipts and OUTWARD vendor payments)
 */
const cancelPaymentTransaction = async (paymentId) => {
    const { firmId = 0 } = getContext();

    return await db.transaction(async (trx) => {
        const payment = await trx('payments')
            .where({ id: paymentId, firm_id: firmId, is_active: true })
            .forUpdate()
            .first();

        if (!payment) {
            throw new ApiError({ statusCode: 404, message: 'Payment record not found.' });
        }

        if (payment.status === 'CANCELLED') {
            throw new ApiError({ statusCode: 400, message: 'This payment is already cancelled.' });
        }

        // Fetch allocations
        const allocations = await trx('payment_allocations')
            .where({ payment_id: paymentId });

        const statusMap = await getPaymentStatusIds(trx);

        if (payment.payment_type === 'OUTWARD') {
            // Revert vendor bills
            for (const alloc of allocations) {
                if (!alloc.vendor_bill_id) continue;

                const bill = await trx('vendor_bills')
                    .where({ id: alloc.vendor_bill_id })
                    .forUpdate()
                    .first();

                if (bill) {
                    const settledAmount = new Decimal(alloc.total_settled_amount || 0);
                    const currentPaid = new Decimal(bill.paid_amount || 0);
                    const newPaid = Decimal.max(0, currentPaid.minus(settledAmount));
                    const newBalance = new Decimal(bill.total).minus(newPaid);
                    const cleanBalance = newBalance.lte(0.01) ? 0 : newBalance.toNumber();

                    let newStatusId = statusMap['PENDING'];
                    if (cleanBalance <= 0) {
                        newStatusId = statusMap['PAID'];
                    } else if (newPaid.gt(0)) {
                        newStatusId = statusMap['PARTIAL'];
                    }

                    await trx('vendor_bills')
                        .where({ id: alloc.vendor_bill_id })
                        .update({
                            paid_amount: newPaid.toNumber(),
                            balance_amount: cleanBalance,
                            payment_status_id: newStatusId
                        });
                }
            }
        } else {
            // Revert customer invoices (INWARD)
            for (const alloc of allocations) {
                if (!alloc.invoice_id) continue;

                const invoice = await trx('invoices')
                    .where({ id: alloc.invoice_id })
                    .forUpdate()
                    .first();

                if (invoice) {
                    const settledAmount = new Decimal(alloc.total_settled_amount || 0);
                    const currentPaid = new Decimal(invoice.paid_amount || 0);
                    const newPaid = Decimal.max(0, currentPaid.minus(settledAmount));
                    const newBalance = new Decimal(invoice.total).minus(newPaid);
                    const cleanBalance = newBalance.lte(0.01) ? 0 : newBalance.toNumber();

                    let newStatusId = statusMap['PENDING'];
                    if (cleanBalance <= 0) {
                        newStatusId = statusMap['PAID'];
                    } else if (newPaid.gt(0)) {
                        newStatusId = statusMap['PARTIAL'];
                    }

                    await trx('invoices')
                        .where({ id: alloc.invoice_id })
                        .update({
                            paid_amount: newPaid.toNumber(),
                            balance_amount: cleanBalance,
                            payment_status_id: newStatusId
                        });
                }
            }
        }

        // Mark payment as CANCELLED
        await trx('payments')
            .where({ id: paymentId })
            .update({ status: 'CANCELLED' });

        return {
            id: paymentId,
            paymentNo: payment.payment_no,
            paymentType: payment.payment_type,
            status: 'CANCELLED'
        };
    });
};

const cancelReceiptTransaction = async (paymentId) => {
    return await cancelPaymentTransaction(paymentId);
};

/**
 * Fetch all customer receipts with pagination, search, and filters (INWARD)
 */
const fetchAllReceipts = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        page = 1,
        pageSize = 10,
        search = '',
        partyId,
        paymentModeId,
        status,
        startDate,
        endDate,
        sortBy = 'payment_date',
        sortOrder = 'desc'
    } = query;

    const baseQuery = db('payments as p')
        .select(
            'p.id',
            'p.payment_no as paymentNo',
            'p.payment_type as paymentType',
            'p.payment_date as paymentDate',
            'p.party_id as partyId',
            db.raw('COALESCE(pt.display_name, pt.legal_name) as "customerName"'),
            'p.total_amount as totalAmount',
            'p.allocated_amount as allocatedAmount',
            'p.unallocated_amount as unallocatedAmount',
            'p.payment_mode_id as paymentModeId',
            'pm.label as paymentMode',
            'p.reference_no as referenceNo',
            'p.reference_date as referenceDate',
            'p.bank_name as bankName',
            'p.status',
            'p.notes',
            'p.created_at as createdAt',
            db.raw("CONCAT(u.first_name, ' ', u.last_name) as createdByName")
        )
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .leftJoin('payment_modes as pm', 'p.payment_mode_id', 'pm.id')
        .leftJoin('users as u', 'p.created_by', 'u.id')
        .where('p.firm_id', firmId)
        .where('p.payment_type', 'INWARD')
        .where('p.is_active', true);

    if (partyId) baseQuery.where('p.party_id', partyId);
    if (paymentModeId) baseQuery.where('p.payment_mode_id', paymentModeId);
    if (status) baseQuery.where('p.status', status);
    if (startDate) baseQuery.where('p.payment_date', '>=', startDate);
    if (endDate) baseQuery.where('p.payment_date', '<=', endDate);

    if (search) {
        baseQuery.where(function () {
            this.where('p.payment_no', 'ILIKE', `%${search}%`)
                .orWhere('p.reference_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    const validSortCols = {
        payment_date: 'p.payment_date',
        payment_no: 'p.payment_no',
        total_amount: 'p.total_amount',
        created_at: 'p.created_at'
    };

    const sortColumn = validSortCols[sortBy] || 'p.payment_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    baseQuery.orderBy(sortColumn, order).orderBy('p.id', 'desc');

    return await fetchPageData({ baseQuery, page, pageSize });
};

/**
 * Fetch receipts pagination metadata (INWARD)
 */
const fetchReceiptsMeta = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        page = 1,
        pageSize = 10,
        search = '',
        partyId,
        paymentModeId,
        status,
        startDate,
        endDate
    } = query;

    const baseQuery = db('payments as p')
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .where('p.firm_id', firmId)
        .where('p.payment_type', 'INWARD')
        .where('p.is_active', true);

    if (partyId) baseQuery.where('p.party_id', partyId);
    if (paymentModeId) baseQuery.where('p.payment_mode_id', paymentModeId);
    if (status) baseQuery.where('p.status', status);
    if (startDate) baseQuery.where('p.payment_date', '>=', startDate);
    if (endDate) baseQuery.where('p.payment_date', '<=', endDate);

    if (search) {
        baseQuery.where(function () {
            this.where('p.payment_no', 'ILIKE', `%${search}%`)
                .orWhere('p.reference_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    return await buildPagination({ baseQuery, page, pageSize });
};

/**
 * Fetch summary metrics across receipts (INWARD)
 */
const fetchReceiptsSummary = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        search = '',
        partyId,
        paymentModeId,
        status,
        startDate,
        endDate
    } = query;

    const baseQuery = db('payments as p')
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .where('p.firm_id', firmId)
        .where('p.payment_type', 'INWARD')
        .where('p.is_active', true);

    if (partyId) baseQuery.where('p.party_id', partyId);
    if (paymentModeId) baseQuery.where('p.payment_mode_id', paymentModeId);
    if (status) baseQuery.where('p.status', status);
    if (startDate) baseQuery.where('p.payment_date', '>=', startDate);
    if (endDate) baseQuery.where('p.payment_date', '<=', endDate);

    if (search) {
        baseQuery.where(function () {
            this.where('p.payment_no', 'ILIKE', `%${search}%`)
                .orWhere('p.reference_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    const summary = await baseQuery
        .select(
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.total_amount ELSE 0 END), 0) as "totalCollections"`),
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.allocated_amount ELSE 0 END), 0) as "totalAllocated"`),
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.unallocated_amount ELSE 0 END), 0) as "totalUnallocated"`),
            db.raw(`COUNT(CASE WHEN p.status = 'COMPLETED' THEN 1 END) as "completedCount"`),
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'CANCELLED' THEN p.total_amount ELSE 0 END), 0) as "cancelledAmount"`),
            db.raw(`COUNT(CASE WHEN p.status = 'CANCELLED' THEN 1 END) as "cancelledCount"`),
            db.raw(`COUNT(*) as "totalCount"`)
        )
        .first();

    return {
        totalCollections: Number(summary?.totalCollections || 0),
        totalAllocated: Number(summary?.totalAllocated || 0),
        totalUnallocated: Number(summary?.totalUnallocated || 0),
        completedCount: Number(summary?.completedCount || 0),
        cancelledAmount: Number(summary?.cancelledAmount || 0),
        cancelledCount: Number(summary?.cancelledCount || 0),
        totalCount: Number(summary?.totalCount || 0)
    };
};

/**
 * Fetch all outward vendor payments with pagination, search, and filters (OUTWARD)
 */
const fetchAllVendorPayments = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        page = 1,
        pageSize = 10,
        search = '',
        partyId,
        paymentModeId,
        status,
        startDate,
        endDate,
        sortBy = 'payment_date',
        sortOrder = 'desc'
    } = query;

    const baseQuery = db('payments as p')
        .select(
            'p.id',
            'p.payment_no as paymentNo',
            'p.payment_type as paymentType',
            'p.payment_date as paymentDate',
            'p.party_id as partyId',
            db.raw('COALESCE(pt.display_name, pt.legal_name) as "vendorName"'),
            'pt.gstin as vendorGstin',
            'p.total_amount as totalAmount',
            'p.allocated_amount as allocatedAmount',
            'p.unallocated_amount as unallocatedAmount',
            'p.payment_mode_id as paymentModeId',
            'pm.label as paymentMode',
            'p.reference_no as referenceNo',
            'p.reference_date as referenceDate',
            'p.bank_name as bankName',
            'p.status',
            'p.notes',
            'p.created_at as createdAt',
            db.raw("CONCAT(u.first_name, ' ', u.last_name) as createdByName")
        )
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .leftJoin('payment_modes as pm', 'p.payment_mode_id', 'pm.id')
        .leftJoin('users as u', 'p.created_by', 'u.id')
        .where('p.firm_id', firmId)
        .where('p.payment_type', 'OUTWARD')
        .where('p.is_active', true);

    if (partyId) baseQuery.where('p.party_id', partyId);
    if (paymentModeId) baseQuery.where('p.payment_mode_id', paymentModeId);
    if (status) baseQuery.where('p.status', status);
    if (startDate) baseQuery.where('p.payment_date', '>=', startDate);
    if (endDate) baseQuery.where('p.payment_date', '<=', endDate);

    if (search) {
        baseQuery.where(function () {
            this.where('p.payment_no', 'ILIKE', `%${search}%`)
                .orWhere('p.reference_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    const validSortCols = {
        payment_date: 'p.payment_date',
        payment_no: 'p.payment_no',
        total_amount: 'p.total_amount',
        created_at: 'p.created_at'
    };

    const sortColumn = validSortCols[sortBy] || 'p.payment_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    baseQuery.orderBy(sortColumn, order).orderBy('p.id', 'desc');

    return await fetchPageData({ baseQuery, page, pageSize });
};

/**
 * Fetch vendor payments pagination metadata (OUTWARD)
 */
const fetchVendorPaymentsMeta = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        page = 1,
        pageSize = 10,
        search = '',
        partyId,
        paymentModeId,
        status,
        startDate,
        endDate
    } = query;

    const baseQuery = db('payments as p')
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .where('p.firm_id', firmId)
        .where('p.payment_type', 'OUTWARD')
        .where('p.is_active', true);

    if (partyId) baseQuery.where('p.party_id', partyId);
    if (paymentModeId) baseQuery.where('p.payment_mode_id', paymentModeId);
    if (status) baseQuery.where('p.status', status);
    if (startDate) baseQuery.where('p.payment_date', '>=', startDate);
    if (endDate) baseQuery.where('p.payment_date', '<=', endDate);

    if (search) {
        baseQuery.where(function () {
            this.where('p.payment_no', 'ILIKE', `%${search}%`)
                .orWhere('p.reference_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    return await buildPagination({ baseQuery, page, pageSize });
};

/**
 * Fetch summary metrics for vendor payments (OUTWARD)
 */
const fetchVendorPaymentsSummary = async (query = {}) => {
    const { firmId = 0 } = getContext();
    const {
        search = '',
        partyId,
        paymentModeId,
        status,
        startDate,
        endDate
    } = query;

    const baseQuery = db('payments as p')
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .where('p.firm_id', firmId)
        .where('p.payment_type', 'OUTWARD')
        .where('p.is_active', true);

    if (partyId) baseQuery.where('p.party_id', partyId);
    if (paymentModeId) baseQuery.where('p.payment_mode_id', paymentModeId);
    if (status) baseQuery.where('p.status', status);
    if (startDate) baseQuery.where('p.payment_date', '>=', startDate);
    if (endDate) baseQuery.where('p.payment_date', '<=', endDate);

    if (search) {
        baseQuery.where(function () {
            this.where('p.payment_no', 'ILIKE', `%${search}%`)
                .orWhere('p.reference_no', 'ILIKE', `%${search}%`)
                .orWhere('pt.legal_name', 'ILIKE', `%${search}%`)
                .orWhere('pt.display_name', 'ILIKE', `%${search}%`);
        });
    }

    const summary = await baseQuery
        .select(
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.total_amount ELSE 0 END), 0) as "totalDisbursements"`),
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.allocated_amount ELSE 0 END), 0) as "totalAllocated"`),
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.unallocated_amount ELSE 0 END), 0) as "totalUnallocated"`),
            db.raw(`COUNT(CASE WHEN p.status = 'COMPLETED' THEN 1 END) as "completedCount"`),
            db.raw(`COALESCE(SUM(CASE WHEN p.status = 'CANCELLED' THEN p.total_amount ELSE 0 END), 0) as "cancelledAmount"`),
            db.raw(`COUNT(CASE WHEN p.status = 'CANCELLED' THEN 1 END) as "cancelledCount"`),
            db.raw(`COUNT(*) as "totalCount"`)
        )
        .first();

    return {
        totalDisbursements: Number(summary?.totalDisbursements || 0),
        totalAllocated: Number(summary?.totalAllocated || 0),
        totalUnallocated: Number(summary?.totalUnallocated || 0),
        completedCount: Number(summary?.completedCount || 0),
        cancelledAmount: Number(summary?.cancelledAmount || 0),
        cancelledCount: Number(summary?.cancelledCount || 0),
        totalCount: Number(summary?.totalCount || 0)
    };
};

/**
 * Fetch single payment by ID (polymorphic: handles both INWARD customer receipts and OUTWARD vendor payments)
 */
const fetchPaymentById = async (id) => {
    const { firmId = 0 } = getContext();

    const payment = await db('payments as p')
        .select(
            'p.id',
            'p.firm_id as firmId',
            'p.payment_no as paymentNo',
            'p.payment_type as paymentType',
            'p.payment_date as paymentDate',
            'p.party_id as partyId',
            db.raw('COALESCE(pt.display_name, pt.legal_name) as "partyName"'),
            'pt.legal_name as partyLegalName',
            'pt.display_name as partyDisplayName',
            'pt.gstin as partyGstin',
            'p.total_amount as totalAmount',
            'p.allocated_amount as allocatedAmount',
            'p.unallocated_amount as unallocatedAmount',
            'p.payment_mode_id as paymentModeId',
            'pm.label as paymentMode',
            'p.reference_no as referenceNo',
            'p.reference_date as referenceDate',
            'p.bank_name as bankName',
            'p.status',
            'p.notes',
            'p.created_at as createdAt',
            db.raw("CONCAT(u.first_name, ' ', u.last_name) as createdByName")
        )
        .leftJoin('parties as pt', 'p.party_id', 'pt.id')
        .leftJoin('payment_modes as pm', 'p.payment_mode_id', 'pm.id')
        .leftJoin('users as u', 'p.created_by', 'u.id')
        .where({ 'p.id': id, 'p.firm_id': firmId, 'p.is_active': true })
        .first();

    if (!payment) {
        return null;
    }

    if (payment.paymentType === 'OUTWARD') {
        // Outward vendor payment allocations
        const allocations = await db('payment_allocations as pa')
            .select(
                'pa.id',
                'pa.vendor_bill_id as vendorBillId',
                'vb.bill_no as billNo',
                'vb.bill_date as billDate',
                'vb.total as billTotal',
                'vb.balance_amount as currentBillBalance',
                'pa.allocated_amount as allocatedAmount',
                'pa.tds_amount as tdsAmount',
                'pa.write_off_amount as writeOffAmount',
                'pa.write_off_reason as writeOffReason',
                'pa.total_settled_amount as totalSettledAmount'
            )
            .join('vendor_bills as vb', 'pa.vendor_bill_id', 'vb.id')
            .where({ 'pa.payment_id': id });

        return {
            ...payment,
            vendorName: payment.partyName,
            allocations
        };
    } else {
        // Inward customer receipt allocations
        const allocations = await db('payment_allocations as pa')
            .select(
                'pa.id',
                'pa.invoice_id as invoiceId',
                'i.invoice_no as invoiceNo',
                'i.invoice_date as invoiceDate',
                'i.total as invoiceTotal',
                'i.balance_amount as currentInvoiceBalance',
                'pa.allocated_amount as allocatedAmount',
                'pa.tds_amount as tdsAmount',
                'pa.write_off_amount as writeOffAmount',
                'pa.write_off_reason as writeOffReason',
                'pa.total_settled_amount as totalSettledAmount'
            )
            .join('invoices as i', 'pa.invoice_id', 'i.id')
            .where({ 'pa.payment_id': id });

        return {
            ...payment,
            customerName: payment.partyName,
            allocations
        };
    }
};

const fetchReceiptById = async (id) => {
    return await fetchPaymentById(id);
};

/**
 * Fetch unpaid/partially paid invoices for a customer (for receipt allocation)
 */
const fetchUnpaidInvoicesByParty = async (partyId) => {
    const { firmId = 0 } = getContext();

    const party = await db('parties').where({ id: partyId, firm_id: firmId, is_active: true }).first();
    if (!party) {
        throw new ApiError({ statusCode: 404, message: 'Customer party not found.' });
    }

    const statusMap = await getPaymentStatusIds();

    const invoices = await db('invoices as i')
        .select(
            'i.id',
            'i.invoice_no as invoiceNo',
            'i.invoice_date as invoiceDate',
            'i.due_date as dueDate',
            'i.total',
            'i.paid_amount as paidAmount',
            'i.balance_amount as balanceAmount',
            'i.payment_status_id as paymentStatusId',
            'ps.label as paymentStatus'
        )
        .join('payment_statuses as ps', 'i.payment_status_id', 'ps.id')
        .where('i.firm_id', firmId)
        .where('i.is_active', true)
        .where('i.payment_status_id', '!=', statusMap['PAID'])
        .where('i.balance_amount', '>', 0)
        .where(function () {
            this.where('i.party_id', partyId);
            if (party.legal_name) {
                this.orWhere('i.customer_name', 'ILIKE', party.legal_name);
            }
            if (party.display_name) {
                this.orWhere('i.customer_name', 'ILIKE', party.display_name);
            }
        })
        .orderBy('i.invoice_date', 'asc')
        .orderBy('i.id', 'asc');

    return invoices;
};

/**
 * Fetch payment history for a single invoice
 */
const fetchInvoicePaymentHistory = async (invoiceId) => {
    const { firmId = 0 } = getContext();

    const invoice = await db('invoices').where({ id: invoiceId, firm_id: firmId, is_active: true }).first();
    if (!invoice) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found.' });
    }

    const history = await db('payment_allocations as pa')
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
        .where('pa.invoice_id', invoiceId)
        .where('p.status', 'COMPLETED')
        .where('p.is_active', true)
        .orderBy('p.payment_date', 'desc')
        .orderBy('pa.id', 'desc');

    return {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoice_no,
        total: invoice.total,
        paidAmount: invoice.paid_amount,
        balanceAmount: invoice.balance_amount,
        paymentStatusId: invoice.payment_status_id,
        history
    };
};

module.exports = {
    getPaymentStatusIds,
    generateNextPaymentNumber,
    generateNextReceiptNumber,
    createReceiptTransaction,
    createVendorPaymentTransaction,
    applyCustomerAdvanceTransaction,
    fetchAvailableAdvancesByParty,
    cancelPaymentTransaction,
    cancelReceiptTransaction,
    fetchAllReceipts,
    fetchReceiptsMeta,
    fetchReceiptsSummary,
    fetchAllVendorPayments,
    fetchVendorPaymentsMeta,
    fetchVendorPaymentsSummary,
    fetchPaymentById,
    fetchReceiptById,
    fetchUnpaidInvoicesByParty,
    fetchInvoicePaymentHistory
};
