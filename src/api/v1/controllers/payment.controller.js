const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const puppeteer = require('puppeteer');
const { projectPaths } = require('../../../config/constants');
const { db } = require('../database');
const { getContext } = require('../helpers/requestContext');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { asyncHandler } = require('../services/asyncHandler');
const { amountToWords, formatAmount, toTitleCase } = require('../services/conversion');
const { getBrowser } = require('./invoice.controller');
const {
    generateNextReceiptNumber,
    createReceiptTransaction,
    cancelReceiptTransaction,
    fetchAllReceipts,
    fetchReceiptsMeta,
    fetchReceiptsSummary,
    fetchReceiptById,
    fetchUnpaidInvoicesByParty,
    fetchInvoicePaymentHistory
} = require('../models/payment.model');
const { fetchStates, fetchAllCities } = require('../models/masters.model');

/**
 * Record a new customer payment receipt
 */
const createReceipt = asyncHandler(async (req, res) => {
    const result = await createReceiptTransaction(req.body);
    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: result,
            message: `Payment receipt ${result.payment_no} created successfully.`
        })
    );
});

/**
 * Get paginated list of receipts with filters
 */
const getAllReceipts = asyncHandler(async (req, res) => {
    const result = await fetchAllReceipts(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: result.length ? 'Receipts fetched successfully.' : 'No receipts found.'
        })
    );
});

/**
 * Get receipts pagination metadata
 */
const getReceiptsMeta = asyncHandler(async (req, res) => {
    const result = await fetchReceiptsMeta(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Receipts pagination metadata fetched successfully.'
        })
    );
});

/**
 * Get aggregate summary metrics across filtered receipts
 */
const getReceiptsSummary = asyncHandler(async (req, res) => {
    const result = await fetchReceiptsSummary(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Receipts summary metrics fetched successfully.'
        })
    );
});

/**
 * Get receipt details by ID with allocated invoices
 */
const getReceiptById = asyncHandler(async (req, res) => {
    const receipt = await fetchReceiptById(req.params.id);
    if (!receipt) {
        throw new ApiError({ statusCode: 404, message: 'Payment receipt not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: receipt,
            message: 'Receipt details fetched successfully.'
        })
    );
});

/**
 * Cancel a payment receipt
 */
const cancelReceiptHandler = asyncHandler(async (req, res) => {
    const result = await cancelReceiptTransaction(req.params.id);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `Receipt ${result.paymentNo} cancelled successfully. Invoice balances and payment statuses have been rolled back.`
        })
    );
});

/**
 * Get next receipt number for preview
 */
const getNextReceiptNumber = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const nextNo = await generateNextReceiptNumber(firmId);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { nextReceiptNo: nextNo },
            message: 'Next receipt number generated.'
        })
    );
});

/**
 * Get unpaid/partial invoices for a customer
 */
const getUnpaidInvoices = asyncHandler(async (req, res) => {
    const invoices = await fetchUnpaidInvoicesByParty(req.params.partyId);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: invoices,
            message: invoices.length ? 'Unpaid invoices fetched successfully.' : 'No pending invoices for this customer.'
        })
    );
});

/**
 * Get payment history for a single invoice
 */
const getInvoicePaymentHistoryHandler = asyncHandler(async (req, res) => {
    const history = await fetchInvoicePaymentHistory(req.params.invoiceId);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: history,
            message: 'Invoice payment history fetched successfully.'
        })
    );
});

/**
 * Prepare template data for Receipt PDF
 */
const prepareReceiptPdfData = async (receiptId) => {
    const { firmId = 0 } = getContext();
    const receipt = await fetchReceiptById(receiptId);
    if (!receipt) {
        throw new ApiError({ statusCode: 404, message: 'Payment receipt not found.' });
    }

    // Load master mappings for cities & states
    const [statesList, citiesList] = await Promise.all([
        fetchStates(),
        fetchAllCities()
    ]);

    const stateMap = (statesList || []).reduce((acc, s) => { acc[s.id] = s; return acc; }, {});
    const cityMap = (citiesList || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

    // Fetch firm corporate profile
    const firm = await db('firms as f')
        .select(
            'f.id',
            'f.firm_name as name',
            'f.trade_name as tradeName',
            'f.logo_url as logo',
            'f.gstin',
            'f.pan_number as pan',
            'uc.address_line1 as address',
            'uc.email',
            'uc.phone_number as mobile',
            'uc.website',
            'uc.city_id',
            'uc.state_id',
            'uc.pincode'
        )
        .leftJoin('user_contacts as uc', function () {
            this.on('f.id', '=', 'uc.entity_id').andOn('uc.entity_type', '=', db.raw('?', ['firm']));
        })
        .where({ 'f.id': firmId })
        .first();

    const companyCity = cityMap[firm?.city_id]?.name || '';
    const companyState = toTitleCase(stateMap[firm?.state_id]?.name || '');
    const companyAddressParts = [firm?.address, companyCity, companyState, firm?.pincode].filter(Boolean);
    const companyFullAddress = companyAddressParts.join(', ');

    // Fetch customer party details
    const party = await db('parties as p')
        .select(
            'p.id',
            'p.legal_name',
            'p.display_name',
            'p.email',
            'p.mobile as phone',
            db.raw('COALESCE(pb.gstin, p.gstin) as gstin'),
            'pb.address',
            'pb.city_id',
            'pb.state_id',
            'pb.pincode'
        )
        .leftJoin('party_branches as pb', function () {
            this.on('p.id', '=', 'pb.party_id').andOn('pb.is_head_office', '=', db.raw('?', [true]));
        })
        .where({ 'p.id': receipt.partyId })
        .first();

    const customerCity = cityMap[party?.city_id]?.name || '';
    const customerState = toTitleCase(stateMap[party?.state_id]?.name || '');
    const customerAddressParts = [party?.address, customerCity, customerState, party?.pincode].filter(Boolean);
    const customerFullAddress = customerAddressParts.join(', ');

    // Process allocations
    let hasTds = false;
    let hasWriteOff = false;
    let totalTds = 0;
    let totalWriteOff = 0;

    const formattedAllocations = (receipt.allocations || []).map(item => {
        const tds = Number(item.tdsAmount || 0);
        const writeOff = Number(item.writeOffAmount || 0);
        if (tds > 0) hasTds = true;
        if (writeOff > 0) hasWriteOff = true;
        totalTds += tds;
        totalWriteOff += writeOff;

        return {
            invoiceNo: item.invoiceNo,
            formattedDate: item.invoiceDate ? moment(item.invoiceDate).format('DD MMM YYYY') : '',
            invoiceTotal: formatAmount(item.invoiceTotal),
            allocatedAmount: formatAmount(item.allocatedAmount),
            tdsAmount: formatAmount(tds),
            writeOffAmount: formatAmount(writeOff),
            writeOffReason: item.writeOffReason || '',
            rawBalance: Number(item.currentInvoiceBalance || 0),
            currentInvoiceBalance: formatAmount(item.currentInvoiceBalance)
        };
    });

    return {
        company: {
            name: firm?.name || 'KS Engineering Works',
            tradeName: firm?.tradeName || '',
            logo: firm?.logo || '',
            gstin: firm?.gstin || '',
            pan: firm?.pan || '',
            address: companyFullAddress,
            mobile: firm?.mobile || '',
            email: firm?.email || '',
            website: firm?.website || ''
        },
        customer: {
            name: receipt.customerName || party?.display_name || party?.legal_name || 'Valued Customer',
            gstin: party?.gstin || '',
            address: customerFullAddress,
            phone: party?.phone || ''
        },
        receipt: {
            paymentNo: receipt.paymentNo,
            formattedDate: moment(receipt.paymentDate).format('DD MMM YYYY').toUpperCase(),
            formattedReferenceDate: receipt.referenceDate ? moment(receipt.referenceDate).format('DD MMM YYYY') : '',
            status: receipt.status,
            paymentMode: receipt.paymentMode || 'Direct',
            referenceNo: receipt.referenceNo || '',
            bankName: receipt.bankName || '',
            createdByName: receipt.createdByName || '',
            notes: receipt.notes || '',
            totalAmount: formatAmount(receipt.totalAmount),
            totalAmountInWords: amountToWords(receipt.totalAmount || 0),
            allocatedAmount: formatAmount(receipt.allocatedAmount),
            rawUnallocated: Number(receipt.unallocatedAmount || 0),
            unallocatedAmount: formatAmount(receipt.unallocatedAmount),
            rawTds: totalTds,
            tdsAmount: formatAmount(totalTds),
            rawWriteOff: totalWriteOff,
            writeOffAmount: formatAmount(totalWriteOff)
        },
        hasTds,
        hasWriteOff,
        allocations: formattedAllocations,
        generatedAt: moment().format('DD MMM YYYY, hh:mm A')
    };
};

/**
 * Generate & download receipt voucher PDF
 */
const getReceiptPDF = asyncHandler(async (req, res) => {
    const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/receipt/`, 'receipt-template.ejs');
    const pdfData = await prepareReceiptPdfData(req.params.id);
    const filledHtml = await ejs.renderFile(templatePath, pdfData);

    const browser = await getBrowser(puppeteer);
    let page;

    try {
        page = await browser.newPage();
        await page.setContent(filledHtml, { waitUntil: 'load' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '12mm',
                right: '12mm'
            }
        });

        const fileName = `Receipt-${pdfData.receipt.paymentNo}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(pdf));
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }
});

module.exports = {
    createReceipt,
    getAllReceipts,
    getReceiptsMeta,
    getReceiptsSummary,
    getReceiptById,
    cancelReceiptHandler,
    getNextReceiptNumber,
    getUnpaidInvoices,
    getInvoicePaymentHistoryHandler,
    prepareReceiptPdfData,
    getReceiptPDF
};
