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
} = require('../models/payment.model');
const { fetchStates, fetchAllCities } = require('../models/masters.model');

/**
 * Record a new customer payment receipt (INWARD)
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
 * Record a new vendor outward payment (OUTWARD)
 */
const createVendorPayment = asyncHandler(async (req, res) => {
    const result = await createVendorPaymentTransaction(req.body);
    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: result,
            message: `Vendor payment voucher ${result.payment_no} created successfully.`
        })
    );
});

/**
 * Apply unallocated customer advance balance to invoices
 */
const applyCustomerAdvanceHandler = asyncHandler(async (req, res) => {
    const result = await applyCustomerAdvanceTransaction({
        paymentId: req.params.id,
        allocations: req.body.allocations
    });
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `Advance of ₹${result.appliedAmount} applied to invoices successfully. Remaining advance: ₹${result.remainingAdvance}.`
        })
    );
});

/**
 * Get available unallocated advance payments for a party
 */
const getAvailableAdvancesHandler = asyncHandler(async (req, res) => {
    const type = req.query.type?.toUpperCase() === 'OUTWARD' ? 'OUTWARD' : 'INWARD';
    const advances = await fetchAvailableAdvancesByParty(req.params.partyId, type);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: advances,
            message: advances.length ? 'Available advances fetched successfully.' : 'No unused advance balances for this party.'
        })
    );
});

/**
 * Get paginated list of receipts with filters (INWARD)
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
 * Get receipts pagination metadata (INWARD)
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
 * Get aggregate summary metrics across filtered receipts (INWARD)
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
 * Get paginated list of vendor payments with filters (OUTWARD)
 */
const getAllVendorPayments = asyncHandler(async (req, res) => {
    const result = await fetchAllVendorPayments(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: result.length ? 'Vendor payments fetched successfully.' : 'No vendor payments found.'
        })
    );
});

/**
 * Get vendor payments pagination metadata (OUTWARD)
 */
const getVendorPaymentsMeta = asyncHandler(async (req, res) => {
    const result = await fetchVendorPaymentsMeta(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Vendor payments pagination metadata fetched successfully.'
        })
    );
});

/**
 * Get aggregate summary metrics across vendor payments (OUTWARD)
 */
const getVendorPaymentsSummary = asyncHandler(async (req, res) => {
    const result = await fetchVendorPaymentsSummary(req.query);
    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Vendor payments summary metrics fetched successfully.'
        })
    );
});

/**
 * Get payment details by ID (polymorphic: customer receipt or vendor payment)
 */
const getPaymentById = asyncHandler(async (req, res) => {
    const payment = await fetchPaymentById(req.params.id);
    if (!payment) {
        throw new ApiError({ statusCode: 404, message: 'Payment record not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: payment,
            message: 'Payment details fetched successfully.'
        })
    );
});

const getReceiptById = getPaymentById;

/**
 * Cancel a payment (works for both INWARD and OUTWARD)
 */
const cancelPaymentHandler = asyncHandler(async (req, res) => {
    const result = await cancelPaymentTransaction(req.params.id);
    const targetType = result.paymentType === 'OUTWARD' ? 'Vendor payment' : 'Receipt';
    const targetEntity = result.paymentType === 'OUTWARD' ? 'Vendor bill' : 'Invoice';

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `${targetType} ${result.paymentNo} cancelled successfully. ${targetEntity} balances and payment statuses have been rolled back.`
        })
    );
});

const cancelReceiptHandler = cancelPaymentHandler;

/**
 * Get next sequential payment number (supports type query: INWARD or OUTWARD)
 */
const getNextPaymentNumberHandler = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const type = req.query.type?.toUpperCase() === 'OUTWARD' ? 'OUTWARD' : 'INWARD';
    const nextNo = await generateNextPaymentNumber(firmId, type);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { nextNumber: nextNo, paymentType: type },
            message: `Next ${type} number generated.`
        })
    );
});

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
 * Prepare template data for PDF (handles both INWARD receipt and OUTWARD voucher)
 */
const preparePaymentPdfData = async (paymentId) => {
    const { firmId = 0 } = getContext();
    const payment = await fetchPaymentById(paymentId);
    if (!payment) {
        throw new ApiError({ statusCode: 404, message: 'Payment record not found.' });
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

    // Fetch party details
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
        .where({ 'p.id': payment.partyId })
        .first();

    const partyCity = cityMap[party?.city_id]?.name || '';
    const partyState = toTitleCase(stateMap[party?.state_id]?.name || '');
    const partyAddressParts = [party?.address, partyCity, partyState, party?.pincode].filter(Boolean);
    const partyFullAddress = partyAddressParts.join(', ');

    let hasTds = false;
    let hasWriteOff = false;
    let totalTds = 0;
    let totalWriteOff = 0;

    const formattedAllocations = (payment.allocations || []).map(item => {
        const tds = Number(item.tdsAmount || 0);
        const writeOff = Number(item.writeOffAmount || 0);
        if (tds > 0) hasTds = true;
        if (writeOff > 0) hasWriteOff = true;
        totalTds += tds;
        totalWriteOff += writeOff;

        return {
            invoiceNo: item.invoiceNo || item.billNo,
            billNo: item.billNo || item.invoiceNo,
            formattedDate: item.invoiceDate || item.billDate ? moment(item.invoiceDate || item.billDate).format('DD MMM YYYY') : '',
            invoiceTotal: formatAmount(item.invoiceTotal || item.billTotal || 0),
            billTotal: formatAmount(item.billTotal || item.invoiceTotal || 0),
            allocatedAmount: formatAmount(item.allocatedAmount),
            tdsAmount: formatAmount(tds),
            writeOffAmount: formatAmount(writeOff),
            writeOffReason: item.writeOffReason || '',
            rawBalance: Number(item.currentInvoiceBalance !== undefined ? item.currentInvoiceBalance : item.currentBillBalance || 0),
            currentInvoiceBalance: formatAmount(item.currentInvoiceBalance || 0),
            currentBillBalance: formatAmount(item.currentBillBalance || 0)
        };
    });

    const isOutward = payment.paymentType === 'OUTWARD';

    return {
        isOutward,
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
            name: payment.partyName || party?.display_name || party?.legal_name || 'Valued Customer',
            gstin: party?.gstin || '',
            address: partyFullAddress,
            phone: party?.phone || ''
        },
        vendor: {
            name: payment.partyName || party?.display_name || party?.legal_name || 'Vendor',
            gstin: party?.gstin || '',
            address: partyFullAddress,
            phone: party?.phone || ''
        },
        receipt: {
            paymentNo: payment.paymentNo,
            formattedDate: moment(payment.paymentDate).format('DD MMM YYYY').toUpperCase(),
            formattedReferenceDate: payment.referenceDate ? moment(payment.referenceDate).format('DD MMM YYYY') : '',
            status: payment.status,
            paymentMode: payment.paymentMode || 'Direct',
            referenceNo: payment.referenceNo || '',
            bankName: payment.bankName || '',
            createdByName: payment.createdByName || '',
            notes: payment.notes || '',
            totalAmount: formatAmount(payment.totalAmount),
            totalAmountInWords: amountToWords(payment.totalAmount || 0),
            allocatedAmount: formatAmount(payment.allocatedAmount),
            rawUnallocated: Number(payment.unallocatedAmount || 0),
            unallocatedAmount: formatAmount(payment.unallocatedAmount),
            rawTds: totalTds,
            tdsAmount: formatAmount(totalTds),
            rawWriteOff: totalWriteOff,
            writeOffAmount: formatAmount(totalWriteOff)
        },
        payment: {
            paymentNo: payment.paymentNo,
            formattedDate: moment(payment.paymentDate).format('DD MMM YYYY').toUpperCase(),
            formattedReferenceDate: payment.referenceDate ? moment(payment.referenceDate).format('DD MMM YYYY') : '',
            status: payment.status,
            paymentMode: payment.paymentMode || 'Direct',
            referenceNo: payment.referenceNo || '',
            bankName: payment.bankName || '',
            createdByName: payment.createdByName || '',
            notes: payment.notes || '',
            totalAmount: formatAmount(payment.totalAmount),
            totalAmountInWords: amountToWords(payment.totalAmount || 0),
            allocatedAmount: formatAmount(payment.allocatedAmount),
            rawUnallocated: Number(payment.unallocatedAmount || 0),
            unallocatedAmount: formatAmount(payment.unallocatedAmount),
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

const prepareReceiptPdfData = preparePaymentPdfData;

/**
 * Generate & download payment voucher / receipt PDF
 */
const getPaymentPDF = asyncHandler(async (req, res) => {
    const pdfData = await preparePaymentPdfData(req.params.id);
    const templateFileName = pdfData.isOutward ? 'payment-voucher-template.ejs' : 'receipt-template.ejs';
    const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/receipt/`, templateFileName);
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

        const prefix = pdfData.isOutward ? 'Payment-Voucher' : 'Receipt';
        const fileName = `${prefix}-${pdfData.payment.paymentNo}.pdf`;
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

const getReceiptPDF = getPaymentPDF;

module.exports = {
    createReceipt,
    createVendorPayment,
    applyCustomerAdvanceHandler,
    getAvailableAdvancesHandler,
    getAllReceipts,
    getReceiptsMeta,
    getReceiptsSummary,
    getAllVendorPayments,
    getVendorPaymentsMeta,
    getVendorPaymentsSummary,
    getPaymentById,
    getReceiptById,
    cancelPaymentHandler,
    cancelReceiptHandler,
    getNextPaymentNumberHandler,
    getNextReceiptNumber,
    getUnpaidInvoices,
    getInvoicePaymentHistoryHandler,
    preparePaymentPdfData,
    prepareReceiptPdfData,
    getPaymentPDF,
    getReceiptPDF
};
