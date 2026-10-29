const { db } = require('../database');
const { ApiError } = require('./ApiError');
const Decimal = require('decimal.js');

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

  const obDate = party.opening_balance_date
    ? (party.opening_balance_date instanceof Date
        ? party.opening_balance_date.toISOString().split('T')[0]
        : String(party.opening_balance_date).split('T')[0])
    : null;

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
      'created_at'
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
      'created_at'
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
        'created_at'
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
  if (!includeObInPreRange && obDate && obDate >= fromDate && obDate <= toDate && !masterOpeningBal.isZero()) {
    rawTransactions.push({
      ref_id: party.id,
      tx_date: obDate,
      voucher_type: 'Opening Balance',
      voucher_no: party.party_code ? `${party.party_code}-OB` : 'OB-001',
      particulars: 'Party Opening Balance (Brought Forward)',
      debit: masterOpeningType === 'DR' ? masterOpeningBal.toNumber() : 0.00,
      credit: masterOpeningType === 'CR' ? masterOpeningBal.toNumber() : 0.00,
      created_at: new Date(obDate)
    });
    rawTransactions.sort((a, b) => new Date(a.tx_date) - new Date(b.tx_date));
  }

  // 5. STEP 3: Compute Cumulative Running Balance
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

    // Format transaction date to YYYY-MM-DD
    const txDateStr = tx.tx_date instanceof Date
      ? tx.tx_date.toISOString().split('T')[0]
      : String(tx.tx_date);

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
    };
  });

  const closingBalanceValue = runningBalance.abs().toNumber();
  const closingBalanceType = runningBalance.isNegative() ? 'Cr' : 'Dr';

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
  };
};

module.exports = {
  getPartyLedgerStatement,
  getDefaultFinancialYearRange,
};
