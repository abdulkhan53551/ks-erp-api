const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const puppeteer = require('puppeteer');
const { projectPaths } = require('../../../config/constants');
const { formatAmount, amountToWords } = require('./conversion');
const { getBrowser } = require('../controllers/invoice.controller');
const { ApiError } = require('./ApiError');
const { db } = require('../database');

const DEFAULT_PROFORMA_TERMS = [
    'This Proforma Invoice is issued for commercial advance payment and order confirmation purposes only, not as a GST Tax Invoice.',
    'Advance payment as specified must be credited to our bank account before fabrication or dispatch commences.',
    'Official GST Tax Invoice and E-Way Bill will accompany the material consignment upon final dispatch.',
    'Delivery lead timeline commences upon receipt of advance payment and drawing approval.',
    'All transactions and commercial disputes are subject to Nashik (Maharashtra) jurisdiction only.'
];

// Helper to parse multiline string or bullet points into clean line array
const parseTncLines = (rawText, fallbackList = []) => {
    if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
        const lines = rawText
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+[\.)]\s*/, '').trim())
            .filter(Boolean);
        if (lines.length > 0) return lines;
    }
    return fallbackList;
};

/**
 * Generate PDF buffer for Proforma Invoice
 * 
 * @param {Object} proformaData 
 * @returns {Promise<Buffer>}
 */
const generateProformaPdf = async (proformaData) => {
    if (!proformaData) {
        throw new ApiError({ statusCode: 400, message: 'Invalid proforma invoice data for PDF rendering.' });
    }

    const isInterState = Number(proformaData.igst || 0) > 0 || (
        proformaData.place_of_supply &&
        !proformaData.place_of_supply.toLowerCase().includes('maharashtra') &&
        !proformaData.place_of_supply.includes('27')
    ) || (
        proformaData.firm_gstin && proformaData.gst_number &&
        proformaData.firm_gstin.substring(0, 2) !== proformaData.gst_number.substring(0, 2)
    );

    const items = Array.isArray(proformaData.items) ? proformaData.items : [];
    let hasItemDiscount = false;

    const formattedItems = items.map(it => {
        const discAmt = parseFloat(it.discount_amount || it.discountAmount || 0);
        const discPct = parseFloat(it.discount_percent || it.discountPercent || 0);
        if (discAmt > 0 || discPct > 0) hasItemDiscount = true;

        return {
            ...it,
            itemName: it.item_name || it.itemName,
            drawingNumber: it.drawing_number || it.drawingNumber,
            hsnSacCode: it.hsn_sac_code || it.hsnSacCode,
            qty: parseFloat(it.qty || 1),
            rate: parseFloat(it.rate || 0),
            formatted_rate: formatAmount(it.rate || 0),
            discount_percent: discPct,
            discount_amount: discAmt,
            formatted_discount_amount: formatAmount(discAmt),
            taxable_amount: parseFloat(it.taxable_amount || it.taxableAmount || 0),
            formatted_taxable: formatAmount(it.taxable_amount || it.taxableAmount || 0),
            tax_rate: parseFloat(it.tax_rate !== undefined ? it.tax_rate : (it.taxRate !== undefined ? it.taxRate : 18)),
            total: parseFloat(it.total || 0),
            formatted_total: formatAmount(it.total || 0)
        };
    });

    const proformaDate = proformaData.proforma_date || proformaData.proformaDate;
    const dueDate = proformaData.due_date || proformaData.dueDate;

    const grandTotal = parseFloat(proformaData.total || 0);
    const advanceRequestedRaw = parseFloat(
        proformaData.advance_amount_requested !== undefined
            ? proformaData.advance_amount_requested
            : (proformaData.advanceAmountRequested !== undefined ? proformaData.advanceAmountRequested : 0)
    );
    const advanceReceivedRaw = parseFloat(
        proformaData.advance_received !== undefined
            ? proformaData.advance_received
            : (proformaData.advanceReceived !== undefined ? proformaData.advanceReceived : 0)
    );

    const hasAdvanceConfigured = advanceRequestedRaw > 0;
    const effectiveAdvancePayable = hasAdvanceConfigured ? advanceRequestedRaw : grandTotal;
    const balancePayable = Math.max(0, grandTotal - (hasAdvanceConfigured ? advanceRequestedRaw : 0) - advanceReceivedRaw);
    const advancePercent = grandTotal > 0 && hasAdvanceConfigured
        ? Math.round((advanceRequestedRaw / grandTotal) * 100)
        : (hasAdvanceConfigured ? 0 : 100);

    const rawTnc = proformaData.terms_and_conditions !== undefined
        ? proformaData.terms_and_conditions
        : proformaData.termsAndConditions;
    const termsList = parseTncLines(rawTnc, DEFAULT_PROFORMA_TERMS);

    const specialNotes = proformaData.special_notes !== undefined
        ? proformaData.special_notes
        : proformaData.specialNotes;

    const proformaViewModel = {
        ...proformaData,
        proforma_no: proformaData.proforma_no || proformaData.proformaNo || 'PI-DRAFT',
        formatted_date: proformaDate ? moment(proformaDate).format('DD/MM/YYYY') : moment().format('DD/MM/YYYY'),
        formatted_due_date: dueDate ? moment(dueDate).format('DD/MM/YYYY') : moment().add(15, 'days').format('DD/MM/YYYY'),
        customer_name: proformaData.customer_name || proformaData.customerName || 'Valued Customer',
        gst_number: proformaData.gst_number || proformaData.gstNumber,
        billing_address: proformaData.billing_address || proformaData.billingAddress,
        shipping_address: proformaData.shipping_address || proformaData.shippingAddress,
        place_of_supply: proformaData.place_of_supply || proformaData.placeOfSupply,
        contact_person: proformaData.contact_person || proformaData.contactPerson,
        contact_phone: proformaData.contact_phone || proformaData.contactPhone,
        dispatch_through: proformaData.dispatch_through || proformaData.dispatchThrough,
        destination: proformaData.destination,
        order_ref_no: proformaData.order_ref_no || proformaData.orderRefNo,
        quotation_no: proformaData.quotation_no || proformaData.quotationNo,
        payment_terms: proformaData.payment_terms || proformaData.paymentTerms,
        delivery_period: proformaData.delivery_period || proformaData.deliveryPeriod,
        freight_basis: proformaData.freight_basis || proformaData.freightBasis,
        warranty_terms: proformaData.warranty_terms || proformaData.warrantyTerms,
        special_notes: specialNotes,
        terms_list: termsList,
        is_interstate: isInterState,
        has_item_discount: hasItemDiscount,
        formatted_sub_total: formatAmount(proformaData.sub_total || proformaData.subTotal || 0),
        discount_amount: parseFloat(proformaData.discount_amount || proformaData.discountAmount || 0),
        formatted_discount_amount: formatAmount(proformaData.discount_amount || proformaData.discountAmount || 0),
        formatted_taxable_amount: formatAmount(proformaData.taxable_amount || proformaData.taxableAmount || 0),
        formatted_cgst: formatAmount(proformaData.cgst || 0),
        formatted_sgst: formatAmount(proformaData.sgst || 0),
        formatted_igst: formatAmount(proformaData.igst || 0),
        other: parseFloat(proformaData.other || 0),
        formatted_other: formatAmount(proformaData.other || 0),
        round_off: parseFloat(proformaData.round_off || proformaData.roundOff || 0),
        formatted_round_off: Math.abs(parseFloat(proformaData.round_off || proformaData.roundOff || 0)).toFixed(2),
        formatted_total: formatAmount(grandTotal),
        amount_in_words: amountToWords(grandTotal),
        has_advance_configured: hasAdvanceConfigured,
        advance_percent: advancePercent,
        advance_amount_requested: effectiveAdvancePayable,
        formatted_advance_requested: formatAmount(effectiveAdvancePayable),
        advance_received: advanceReceivedRaw,
        formatted_advance_received: formatAmount(advanceReceivedRaw),
        balance_payable: balancePayable,
        formatted_balance_payable: formatAmount(balancePayable),
        items: formattedItems
    };

    let firmViewModel = {
        name: proformaData.firm_name || '',
        subtitle: proformaData.firm_type || '',
        logo_url: proformaData.firm_logo_url || null,
        address: proformaData.firm_address || '',
        gstin: proformaData.firm_gstin || proformaData.firm_branch_gstin || '',
        phone: proformaData.firm_phone_number || '',
        email: proformaData.firm_email || ''
    };

    let bankViewModel = {
        bank_name: proformaData.bank_name || '',
        account_number: proformaData.account_number || '',
        ifsc_code: proformaData.ifsc_code || '',
        branch_name: proformaData.bank_branch_name || ''
    };

    // If bank or firm details are missing (e.g. preview mode or partial body), query DB fallback
    const effectiveFirmId = proformaData.firm_id || proformaData.firmId || 1;
    if (!bankViewModel.account_number || !firmViewModel.name) {
        try {
            const dbBank = await db('firm_bank_accounts')
                .where({ firm_id: effectiveFirmId, is_active: true })
                .first();
            if (dbBank) {
                bankViewModel = {
                    bank_name: bankViewModel.bank_name || dbBank.bank_name,
                    account_number: bankViewModel.account_number || dbBank.account_number,
                    ifsc_code: bankViewModel.ifsc_code || dbBank.ifsc_code,
                    branch_name: bankViewModel.branch_name || dbBank.branch_name
                };
            }

            const dbFirm = await db('firms AS F')
                .select(
                    'F.firm_name',
                    'F.firm_type',
                    'F.logo_url',
                    'F.gstin',
                    'UC.email',
                    'UC.phone_number',
                    'UC.address_line1'
                )
                .leftJoin('user_contacts AS UC', function () {
                    this.on('F.id', '=', 'UC.entity_id')
                        .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
                })
                .where('F.id', effectiveFirmId)
                .first();

            if (dbFirm) {
                firmViewModel = {
                    name: firmViewModel.name || dbFirm.firm_name,
                    subtitle: firmViewModel.subtitle || dbFirm.firm_type,
                    logo_url: firmViewModel.logo_url || dbFirm.logo_url,
                    address: firmViewModel.address || dbFirm.address_line1,
                    gstin: firmViewModel.gstin || dbFirm.gstin,
                    phone: firmViewModel.phone || dbFirm.phone_number,
                    email: firmViewModel.email || dbFirm.email
                };
            }
        } catch (err) {
            console.error('Failed to load firm/bank details for proforma invoice fallback:', err.message);
        }
    }

    if (!firmViewModel.name) {
        firmViewModel.name = 'K.S. ENGINEERING WORKS';
        firmViewModel.subtitle = 'PRECISION MACHINING & FABRICATION';
    }

    const templatePath = path.join(projectPaths.ROOT_DIR, 'templates', 'proforma-invoice', 'proforma-invoice.ejs');

    const htmlContent = await ejs.renderFile(templatePath, {
        proforma: proformaViewModel,
        firm: firmViewModel,
        bank: bankViewModel
    });

    const browser = await getBrowser(puppeteer);
    const page = await browser.newPage();

    try {
        await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
        });

        return pdfBuffer;
    } finally {
        await page.close();
    }
};

module.exports = {
    generateProformaPdf
};
