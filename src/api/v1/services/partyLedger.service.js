const { db } = require('../database');
const { ApiError } = require('./ApiError');
const Decimal = require('decimal.js');
const moment = require('moment');

/**
 * Formats a Date object or string to YYYY-MM-DD in local time, avoiding UTC shifts.
 */
const formatDateSafe = (dateVal) => {
  if (!dateVal) return null;
  return moment(dateVal).format('YYYY-MM-DD');
};

/**
 * Calculates the start and end of the current Indian Financial Year (01-Apr to 31-Mar).
 */
const getDefaultFinancialYearRange = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)

  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fyStartDate = `${fyStartYear}-04-01`;

  // Format today's date as YYYY-MM-DD
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayDate = `${yyyy}-${mm}-${dd}`;

  return { startDate: fyStartDate, endDate: todayDate };
};

/**
 * Calculates Aging and Overdue Analysis based on agreed credit terms using FIFO debt settlement.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
const calculateAgingSummary = async ({
  partyId,
  resolvedFirmId,
  toDate,
  creditPeriodDays = 0,
  masterOpeningBal,
  masterOpeningType,
  obDate,
  closingBalanceValue,
  closingBalanceType,
  hasVendorBills = false,
}) => {
  const todayStr = moment().format('YYYY-MM-DD');
  const asOfDate = toDate < todayStr ? toDate : todayStr;
  const netClosingDec = new Decimal(closingBalanceValue || 0);

  if (netClosingDec.lte(0)) {
    return {
      applicableCreditDays: creditPeriodDays,
      asOfDate,
      totalOutstanding: 0,
      balanceType: closingBalanceType,
      overdueAmount: 0,
      currentDueAmount: 0,
      overdueInvoiceCount: 0,
      maxOverdueDays: 0,
      status: 'CLEAR',
    };
  }

  // 1. Customer Outstanding (Debit Balance)
  if (closingBalanceType === 'Dr') {
    const openDebitItems = [];

    // Opening Balance (if Dr)
    if (masterOpeningType === 'DR' && masterOpeningBal.gt(0)) {
      const obDateStr = obDate || toDate;
      const obDueDateStr = moment(obDateStr).add(creditPeriodDays, 'days').format('YYYY-MM-DD');
      openDebitItems.push({
        refNo: 'OPENING-BAL',
        date: obDateStr,
        dueDate: obDueDateStr,
        amount: new Decimal(masterOpeningBal),
      });
    }

    // Invoices with balance_amount > 0 up to toDate
    const openInvoices = await db('invoices')
      .select('id', 'invoice_no', 'invoice_date', 'due_date', 'due_days', 'balance_amount')
      .where({ party_id: partyId, firm_id: resolvedFirmId })
      .where('balance_amount', '>', 0)
      .where('invoice_date', '<=', toDate)
      .whereNot('status', 'CANCELLED')
      .whereNull('deleted_at')
      .orderBy('invoice_date', 'asc')
      .orderBy('id', 'asc')
      .timeout(5000, { cancel: true });

    openInvoices.forEach((inv) => {
      const invDateStr = formatDateSafe(inv.invoice_date);

      let invDueDate = formatDateSafe(inv.due_date);

      if (!invDueDate) {
        const days = (inv.due_days !== null && inv.due_days !== undefined) ? Number(inv.due_days) : creditPeriodDays;
        invDueDate = moment(invDateStr).add(days, 'days').format('YYYY-MM-DD');
      }

      openDebitItems.push({
        id: inv.id,
        refNo: inv.invoice_no,
        date: invDateStr,
        dueDate: invDueDate,
        amount: new Decimal(inv.balance_amount || 0),
      });
    });

    // Determine unallocated credits (either excess open debits over closing balance or explicit unallocated receipts)
    const totalOpenDebits = openDebitItems.reduce((acc, it) => acc.plus(it.amount), new Decimal(0));
    let excessCredit = totalOpenDebits.gt(netClosingDec) ? totalOpenDebits.minus(netClosingDec) : new Decimal(0);

    const unallocatedReceipts = await db('payments')
      .sum({ total: 'unallocated_amount' })
      .where({ party_id: partyId, firm_id: resolvedFirmId, payment_type: 'INWARD' })
      .where('unallocated_amount', '>', 0)
      .where('payment_date', '<=', toDate)
      .whereNot('status', 'CANCELLED')
      .whereNull('deleted_at')
      .first()
      .timeout(5000, { cancel: true });

    const explicitUnallocated = new Decimal(unallocatedReceipts?.total || 0);
    let creditToApply = Decimal.max(excessCredit, explicitUnallocated);

    // Apply FIFO to knock off oldest debits
    for (let i = 0; i < openDebitItems.length; i++) {
      if (creditToApply.lte(0)) break;
      const item = openDebitItems[i];
      if (creditToApply.gte(item.amount)) {
        creditToApply = creditToApply.minus(item.amount);
        item.amount = new Decimal(0);
      } else {
        item.amount = item.amount.minus(creditToApply);
        creditToApply = new Decimal(0);
      }
    }

    let overdueSum = new Decimal(0);
    let currentSum = new Decimal(0);
    let overdueCount = 0;
    let maxOverdueDays = 0;

    const remainingItems = openDebitItems.filter((it) => it.amount.gt(0));
    remainingItems.forEach((item) => {
      const isItemOverdue = item.dueDate < asOfDate;
      if (isItemOverdue) {
        overdueSum = overdueSum.plus(item.amount);
        overdueCount++;
        const daysPastDue = moment(asOfDate).diff(moment(item.dueDate), 'days');
        if (daysPastDue > maxOverdueDays) {
          maxOverdueDays = daysPastDue;
        }
      } else {
        currentSum = currentSum.plus(item.amount);
      }
    });

    // Cap with netClosingDec to prevent any rounding discrepancies
    const totalAgingSum = overdueSum.plus(currentSum);
    if (totalAgingSum.gt(netClosingDec) && totalAgingSum.gt(0)) {
      const factor = netClosingDec.dividedBy(totalAgingSum);
      overdueSum = overdueSum.times(factor).toDecimalPlaces(2);
      currentSum = netClosingDec.minus(overdueSum);
    } else if (totalAgingSum.lt(netClosingDec) && remainingItems.length === 0) {
      overdueSum = netClosingDec;
    }

    return {
      applicableCreditDays: creditPeriodDays,
      asOfDate,
      totalOutstanding: netClosingDec.toNumber(),
      balanceType: 'Dr',
      overdueAmount: overdueSum.toNumber(),
      currentDueAmount: currentSum.toNumber(),
      overdueInvoiceCount: overdueCount,
      maxOverdueDays,
      status: overdueSum.gt(0) ? 'OVERDUE' : (currentSum.gt(0) ? 'WITHIN_TERMS' : 'CLEAR'),
    };
  }

  // 2. Vendor Outstanding (Credit Balance)
  if (closingBalanceType === 'Cr' && hasVendorBills) {
    const openCreditItems = [];

    if (masterOpeningType === 'CR' && masterOpeningBal.gt(0)) {
      const obDateStr = obDate || toDate;
      const obDueDateStr = moment(obDateStr).add(creditPeriodDays, 'days').format('YYYY-MM-DD');
      openCreditItems.push({
        refNo: 'OPENING-BAL',
        date: obDateStr,
        dueDate: obDueDateStr,
        amount: new Decimal(masterOpeningBal),
      });
    }

    const openBills = await db('vendor_bills')
      .select('id', 'bill_no', 'bill_date', 'due_date', 'due_days', 'balance_amount')
      .where({ party_id: partyId, firm_id: resolvedFirmId })
      .where('balance_amount', '>', 0)
      .where('bill_date', '<=', toDate)
      .whereNot('status', 'CANCELLED')
      .whereNull('deleted_at')
      .orderBy('bill_date', 'asc')
      .orderBy('id', 'asc')
      .timeout(5000, { cancel: true });

    openBills.forEach((bill) => {
      const billDateStr = formatDateSafe(bill.bill_date);

      let billDueDate = formatDateSafe(bill.due_date);

      if (!billDueDate) {
        const days = (bill.due_days !== null && bill.due_days !== undefined) ? Number(bill.due_days) : creditPeriodDays;
        billDueDate = moment(billDateStr).add(days, 'days').format('YYYY-MM-DD');
      }

      openCreditItems.push({
        id: bill.id,
        refNo: bill.bill_no,
        date: billDateStr,
        dueDate: billDueDate,
        amount: new Decimal(bill.balance_amount || 0),
      });
    });

    const totalOpenCredits = openCreditItems.reduce((acc, it) => acc.plus(it.amount), new Decimal(0));
    let excessDebit = totalOpenCredits.gt(netClosingDec) ? totalOpenCredits.minus(netClosingDec) : new Decimal(0);

    for (let i = 0; i < openCreditItems.length; i++) {
      if (excessDebit.lte(0)) break;
      const item = openCreditItems[i];
      if (excessDebit.gte(item.amount)) {
        excessDebit = excessDebit.minus(item.amount);
        item.amount = new Decimal(0);
      } else {
        item.amount = item.amount.minus(excessDebit);
        excessDebit = new Decimal(0);
      }
    }

    let overdueSum = new Decimal(0);
    let currentSum = new Decimal(0);
    let overdueCount = 0;
    let maxOverdueDays = 0;

    openCreditItems.filter((it) => it.amount.gt(0)).forEach((item) => {
      const isItemOverdue = item.dueDate < asOfDate;
      if (isItemOverdue) {
        overdueSum = overdueSum.plus(item.amount);
        overdueCount++;
        const daysPastDue = moment(asOfDate).diff(moment(item.dueDate), 'days');
        if (daysPastDue > maxOverdueDays) {
          maxOverdueDays = daysPastDue;
        }
      } else {
        currentSum = currentSum.plus(item.amount);
      }
    });

    return {
      applicableCreditDays: creditPeriodDays,
      asOfDate,
      totalOutstanding: netClosingDec.toNumber(),
      balanceType: 'Cr',
      overdueAmount: overdueSum.toNumber(),
      currentDueAmount: currentSum.toNumber(),
      overdueInvoiceCount: overdueCount,
      maxOverdueDays,
      status: overdueSum.gt(0) ? 'OVERDUE' : (currentSum.gt(0) ? 'WITHIN_TERMS' : 'CLEAR'),
    };
  }

  // Default fallback (e.g. clean advance balance)
  return {
    applicableCreditDays: creditPeriodDays,
    asOfDate,
    totalOutstanding: netClosingDec.toNumber(),
    balanceType: closingBalanceType,
    overdueAmount: 0,
    currentDueAmount: 0,
    overdueInvoiceCount: 0,
    maxOverdueDays: 0,
    status: 'CLEAR',
  };
};

/**
 * Generates an end-to-end Party Ledger Statement.
 * 
 * @param {object} params
 * @param {number|string} params.partyId - Party ID
 * @param {number|string} params.firmId - Active Firm ID
 * @param {string} [params.startDate] - Start Date (YYYY-MM-DD)
 * @param {string} [params.endDate] - End Date (YYYY-MM-DD)
 * @param {number|string} [params.branchId] - Optional Party Branch Filter
 */
const getPartyLedgerStatement = async ({ partyId, firmId, startDate, endDate, branchId }) => {
  const defaultRange = getDefaultFinancialYearRange();
  const fromDate = startDate || defaultRange.startDate;
  const toDate = endDate || defaultRange.endDate;

  // 1. Fetch Party Master Details
  const partyQuery = db('parties as p')
    .select(
      'p.id',
      'p.firm_id',
      'p.party_code',
      'p.legal_name',
      'p.display_name',
      'p.mobile',
      'p.email',
      'p.gst_registered',
      'p.gstin',
      'p.pan_number',
      'p.opening_balance',
      'p.opening_balance_type',
      'p.opening_balance_date',
      'p.credit_period_days',
      'p.status'
    )
    .where({ 'p.id': partyId })
    .whereNull('p.deleted_at');

  if (firmId && Number(firmId) > 0) {
    partyQuery.andWhere({ 'p.firm_id': Number(firmId) });
  }

  const party = await partyQuery.first().timeout(5000, { cancel: true });

  if (!party) {
    throw new ApiError({
      statusCode: 404,
      message: 'Party not found or has been deleted.'
    });
  }

  const resolvedFirmId = (firmId && Number(firmId) > 0) ? Number(firmId) : party.firm_id;
  const creditPeriodDays = Number(party.credit_period_days || 0);

  // 2. Fetch Resolved Firm Details from Database
  let firmData = null;
  if (resolvedFirmId) {
    const firmRow = await db('firms as f')
      .leftJoin('user_contacts as uc', function () {
        this.on('f.id', '=', 'uc.entity_id')
          .andOn('uc.entity_type', '=', db.raw('?', ['firm']));
      })
      .leftJoin('city as c', 'uc.city_id', 'c.id')
      .leftJoin('state as s', 'uc.state_id', 's.id')
      .select(
        'f.id',
        'f.firm_name',
        'f.trade_name',
        'f.gstin',
        'f.pan_number',
        'f.logo_url',
        'uc.address_line1',
        'uc.pincode',
        'uc.phone_number',
        'uc.email',
        'c.name as city_name',
        's.name as state_name'
      )
      .where({ 'f.id': resolvedFirmId })
      .whereNull('f.deleted_at')
      .first()
      .timeout(3000, { cancel: true });

    if (firmRow) {
      const addressParts = [
        firmRow.address_line1,
        firmRow.city_name,
        firmRow.state_name ? `${firmRow.state_name}${firmRow.pincode ? ` - ${firmRow.pincode}` : ''}` : firmRow.pincode,
      ].filter(Boolean);

      firmData = {
        id: firmRow.id,
        name: firmRow.firm_name || firmRow.trade_name || '',
        tradeName: firmRow.trade_name || '',
        gstin: firmRow.gstin || '',
        panNumber: firmRow.pan_number || '',
        address: addressParts.join(', '),
        phone: firmRow.phone_number || '',
        email: firmRow.email || '',
        logoUrl: firmRow.logo_url || null,
      };
    }
  }

  // 3. Fetch Primary Billing Address (if branch exists)
  let partyAddress = null;
  const primaryBranch = await db('party_branches')
    .select('branch_name', 'address', 'pincode', 'gstin')
    .where({ party_id: partyId, firm_id: resolvedFirmId })
    .whereNull('deleted_at')
    .orderBy('is_default', 'desc')
    .first()
    .timeout(3000, { cancel: true });

  if (primaryBranch) {
    partyAddress = [
      primaryBranch.address,
      primaryBranch.pincode ? `PIN: ${primaryBranch.pincode}` : null
    ].filter(Boolean).join(', ');
  }

  // 3. STEP 1: Compute Opening Balance (All transactions before fromDate)
  // Base Opening Balance from Party Master
  let netOpening = new Decimal(0);
  const masterOpeningBal = new Decimal(party.opening_balance || 0);
  const masterOpeningType = (party.opening_balance_type || 'Dr').toUpperCase();

  const obDate = formatDateSafe(party.opening_balance_date);

  // If no obDate is set, or fromDate is on/after obDate, include masterOpeningBal in pre-range netOpening
  let includeObInPreRange = false;
  if (!obDate || fromDate >= obDate) {
    includeObInPreRange = true;
    if (masterOpeningType === 'DR') {
      netOpening = netOpening.plus(masterOpeningBal);
    } else {
      netOpening = netOpening.minus(masterOpeningBal);
    }
  }

  // Pre-range Invoices (Sales -> Debit)
  const preInvoices = await db('invoices')
    .sum({ total: 'total' })
    .where({ party_id: partyId, firm_id: resolvedFirmId })
    .where('invoice_date', '<', fromDate)
    .whereNot('status', 'CANCELLED')
    .whereNull('deleted_at')
    .first()
    .timeout(5000, { cancel: true });

  if (preInvoices?.total) {
    netOpening = netOpening.plus(new Decimal(preInvoices.total));
  }

  // Pre-range Receipts (Customer Payments -> Credit)
  const preReceipts = await db('payments')
    .sum({ total: 'total_amount' })
    .where({ party_id: partyId, firm_id: resolvedFirmId, payment_type: 'INWARD' })
    .where('payment_date', '<', fromDate)
    .whereNot('status', 'CANCELLED')
    .whereNull('deleted_at')
    .first()
    .timeout(5000, { cancel: true });

  if (preReceipts?.total) {
    netOpening = netOpening.minus(new Decimal(preReceipts.total));
  }

  // Pre-range Vendor Bills (Purchases -> Credit)
  const hasVendorBills = await db.schema.hasTable('vendor_bills');
  if (hasVendorBills) {
    const preBills = await db('vendor_bills')
      .sum({ total: 'total' })
      .where({ party_id: partyId, firm_id: resolvedFirmId })
      .where('bill_date', '<', fromDate)
      .whereNot('status', 'CANCELLED')
      .whereNull('deleted_at')
      .first()
      .timeout(5000, { cancel: true });

    if (preBills?.total) {
      netOpening = netOpening.minus(new Decimal(preBills.total));
    }
  }

  // Pre-range Outward Payments (Vendor Payments -> Debit)
  const preOutward = await db('payments')
    .sum({ total: 'total_amount' })
    .where({ party_id: partyId, firm_id: resolvedFirmId, payment_type: 'OUTWARD' })
    .where('payment_date', '<', fromDate)
    .whereNot('status', 'CANCELLED')
    .whereNull('deleted_at')
    .first()
    .timeout(5000, { cancel: true });

  if (preOutward?.total) {
    netOpening = netOpening.plus(new Decimal(preOutward.total));
  }

  const openingBalanceValue = netOpening.abs().toNumber();
  const openingBalanceType = netOpening.isNegative() ? 'Cr' : 'Dr';

  // 4. STEP 2: Query Transactions within [fromDate, toDate]
  // 4.1 Invoices Query
  const invoicesQuery = db('invoices')
    .select(
      'id as ref_id',
      'invoice_date as tx_date',
      db.raw("'Invoice' as voucher_type"),
      'invoice_no as voucher_no',
      db.raw("'Sales Invoice' as particulars"),
      'total as debit',
      db.raw('0.00 as credit'),
      'created_at',
      'due_date',
      'due_days',
      'balance_amount'
    )
    .where({ party_id: partyId, firm_id: resolvedFirmId })
    .whereBetween('invoice_date', [fromDate, toDate])
    .whereNot('status', 'CANCELLED')
    .whereNull('deleted_at');

  if (branchId) {
    invoicesQuery.where('branch_id', branchId);
  }

  // 4.2 Payments (Inward & Outward) Query
  const paymentsQuery = db('payments')
    .select(
      'id as ref_id',
      'payment_date as tx_date',
      db.raw("CASE WHEN payment_type = 'INWARD' THEN 'Receipt' ELSE 'Payment' END as voucher_type"),
      'payment_no as voucher_no',
      db.raw("CASE WHEN reference_no IS NOT NULL AND reference_no != '' THEN CONCAT(CASE WHEN payment_type = 'INWARD' THEN 'Bank Receipt (' ELSE 'Bank Payment (' END, reference_no, ')') ELSE CASE WHEN payment_type = 'INWARD' THEN 'Payment Receipt' ELSE 'Vendor Payment' END END as particulars"),
      db.raw("CASE WHEN payment_type = 'OUTWARD' THEN total_amount ELSE 0.00 END as debit"),
      db.raw("CASE WHEN payment_type = 'INWARD' THEN total_amount ELSE 0.00 END as credit"),
      'created_at',
      db.raw('NULL::date as due_date'),
      db.raw('NULL::integer as due_days'),
      db.raw('0.00 as balance_amount')
    )
    .where({ party_id: partyId, firm_id: resolvedFirmId })
    .whereBetween('payment_date', [fromDate, toDate])
    .whereNot('status', 'CANCELLED')
    .whereNull('deleted_at');

  let unionQuery = invoicesQuery.unionAll([paymentsQuery]);

  // 4.3 Vendor Bills (if table exists)
  if (hasVendorBills) {
    const billsQuery = db('vendor_bills')
      .select(
        'id as ref_id',
        'bill_date as tx_date',
        db.raw("'Vendor Bill' as voucher_type"),
        'bill_no as voucher_no',
        db.raw("'Purchase / Vendor Bill' as particulars"),
        db.raw('0.00 as debit'),
        'total as credit',
        'created_at',
        'due_date',
        'due_days',
        'balance_amount'
      )
      .where({ party_id: partyId, firm_id: resolvedFirmId })
      .whereBetween('bill_date', [fromDate, toDate])
      .whereNot('status', 'CANCELLED')
      .whereNull('deleted_at');

    if (branchId) {
      billsQuery.where('branch_id', branchId);
    }
    unionQuery = unionQuery.unionAll([billsQuery]);
  }

  // Wrap union in subquery to sort chronologically
  const rawTransactions = await db
    .from(unionQuery.as('txs'))
    .select('*')
    .orderBy('tx_date', 'asc')
    .orderBy('created_at', 'asc')
    .timeout(8000, { cancel: true });

  // If opening balance date falls WITHIN the selected range [fromDate, toDate],
  // inject it as an onboarding opening voucher in chronological sequence
  const obDueDateStr = obDate ? moment(obDate).add(creditPeriodDays, 'days').format('YYYY-MM-DD') : null;
  if (!includeObInPreRange && obDate && obDate >= fromDate && obDate <= toDate && !masterOpeningBal.isZero()) {
    rawTransactions.push({
      ref_id: party.id,
      tx_date: obDate,
      voucher_type: 'Opening Balance',
      voucher_no: party.party_code ? `${party.party_code}-OB` : 'OB-001',
      particulars: 'Party Opening Balance (Brought Forward)',
      debit: masterOpeningType === 'DR' ? masterOpeningBal.toNumber() : 0.00,
      credit: masterOpeningType === 'CR' ? masterOpeningBal.toNumber() : 0.00,
      created_at: new Date(obDate),
      due_date: obDueDateStr,
      due_days: creditPeriodDays,
      balance_amount: masterOpeningBal.toNumber()
    });
    rawTransactions.sort((a, b) => new Date(a.tx_date) - new Date(b.tx_date));
  }

  // 5. STEP 3: Compute Cumulative Running Balance
  const todayStr = moment().format('YYYY-MM-DD');
  const asOfDate = toDate < todayStr ? toDate : todayStr;

  let runningBalance = new Decimal(netOpening);
  let totalDebitSum = new Decimal(0);
  let totalCreditSum = new Decimal(0);

  const formattedTransactions = rawTransactions.map((tx, index) => {
    const debitAmount = new Decimal(tx.debit || 0);
    const creditAmount = new Decimal(tx.credit || 0);

    totalDebitSum = totalDebitSum.plus(debitAmount);
    totalCreditSum = totalCreditSum.plus(creditAmount);

    // Running Balance = Previous Running + Debit - Credit
    runningBalance = runningBalance.plus(debitAmount).minus(creditAmount);

    // Format transaction date to YYYY-MM-DD in local time
    const txDateStr = formatDateSafe(tx.tx_date);

    // Determine balance/settlement status
    const balanceAmount = (tx.balance_amount !== undefined && tx.balance_amount !== null)
      ? new Decimal(tx.balance_amount)
      : null;
    const isSettled = (tx.voucher_type === 'Invoice' || tx.voucher_type === 'Vendor Bill') && balanceAmount !== null && balanceAmount.isZero();

    // Calculate due date and aging status for invoice / bill / opening balance
    let dueDateStr = null;
    let isOverdue = false;
    let overdueDays = 0;
    let daysUntilDue = null;

    if (tx.due_date || tx.voucher_type === 'Invoice' || tx.voucher_type === 'Vendor Bill' || tx.voucher_type === 'Opening Balance') {
      let resolvedDueDate = formatDateSafe(tx.due_date);

      if (!resolvedDueDate && (tx.voucher_type === 'Invoice' || tx.voucher_type === 'Vendor Bill')) {
        const days = (tx.due_days !== null && tx.due_days !== undefined) ? Number(tx.due_days) : creditPeriodDays;
        resolvedDueDate = moment(txDateStr).add(days, 'days').format('YYYY-MM-DD');
      }

      if (resolvedDueDate) {
        dueDateStr = resolvedDueDate;
        const diffFromAsOf = moment(asOfDate).diff(moment(resolvedDueDate), 'days');
        if (!isSettled && diffFromAsOf > 0) {
          isOverdue = true;
          overdueDays = diffFromAsOf;
        } else if (!isSettled) {
          isOverdue = false;
          daysUntilDue = Math.abs(diffFromAsOf);
        }
      }
    }

    return {
      index: index + 1,
      refId: tx.ref_id,
      date: txDateStr,
      voucherType: tx.voucher_type,
      voucherNo: tx.voucher_no,
      particulars: tx.particulars,
      debit: debitAmount.toNumber(),
      credit: creditAmount.toNumber(),
      balance: runningBalance.abs().toNumber(),
      balanceType: runningBalance.isNegative() ? 'Cr' : 'Dr',
      dueDate: dueDateStr,
      balanceAmount: balanceAmount ? balanceAmount.toNumber() : 0,
      isSettled,
      isOverdue,
      overdueDays,
      daysUntilDue,
    };
  });

  const closingBalanceValue = runningBalance.abs().toNumber();
  const closingBalanceType = runningBalance.isNegative() ? 'Cr' : 'Dr';

  // 6. STEP 4: Compute Credit Aging Analysis (FIFO debt knock-off)
  const agingSummary = await calculateAgingSummary({
    partyId,
    resolvedFirmId,
    toDate,
    creditPeriodDays,
    masterOpeningBal,
    masterOpeningType,
    obDate,
    closingBalanceValue,
    closingBalanceType,
    hasVendorBills,
  });

  return {
    firm: firmData,
    party: {
      id: party.id,
      partyCode: party.party_code,
      legalName: party.legal_name,
      displayName: party.display_name || party.legal_name,
      gstin: party.gstin || '',
      panNumber: party.pan_number || '',
      mobile: party.mobile || '',
      email: party.email || '',
      address: partyAddress || '',
      creditPeriodDays,
      masterOpeningBalance: masterOpeningBal.toNumber(),
      masterOpeningBalanceType: masterOpeningType,
      masterOpeningBalanceDate: obDate,
    },
    period: {
      startDate: fromDate,
      endDate: toDate,
    },
    openingBalance: openingBalanceValue,
    openingBalanceType,
    transactions: formattedTransactions,
    summary: {
      totalDebit: totalDebitSum.toNumber(),
      totalCredit: totalCreditSum.toNumber(),
      netClosingBalance: closingBalanceValue,
      closingBalanceType,
      transactionCount: formattedTransactions.length,
    },
    agingSummary,
  };
};

module.exports = {
  getPartyLedgerStatement,
  getDefaultFinancialYearRange,
};
