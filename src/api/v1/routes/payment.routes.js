const { Router } = require('express');
const validate = require('../middlewares/validate');
const {
    createReceiptSchema,
    createVendorPaymentSchema,
    applyCustomerAdvanceSchema,
    queryPaymentsSchema,
    paymentIdParamSchema,
    partyIdParamSchema,
    invoiceIdParamSchema
} = require('../validation/payment.validation');
const {
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
    cancelPaymentHandler,
    getNextPaymentNumberHandler,
    getNextReceiptNumber,
    getUnpaidInvoices,
    getInvoicePaymentHistoryHandler,
    getPaymentPDF
} = require('../controllers/payment.controller');

const router = Router();

// ==========================================
// 1. Customer Advances & Knock-Off Endpoints
// ==========================================
router.get('/advances/:partyId', validate(partyIdParamSchema), getAvailableAdvancesHandler);
router.post(['/:id/apply-advance', '/receipts/:id/apply-advance'], validate(applyCustomerAdvanceSchema), applyCustomerAdvanceHandler);

// ==========================================
// 2. Vendor Payments (OUTWARD)
// ==========================================
router.get('/vendor-payments/summary', validate(queryPaymentsSchema), getVendorPaymentsSummary);
router.get('/vendor-payments/pagination', validate(queryPaymentsSchema), getVendorPaymentsMeta);
router.get('/vendor-payments', validate(queryPaymentsSchema), getAllVendorPayments);
router.post('/vendor-payments', validate(createVendorPaymentSchema), createVendorPayment);

// ==========================================
// 3. Customer Receipts (INWARD) & Summaries
// ==========================================
router.get(['/summary', '/receipts/summary'], validate(queryPaymentsSchema), getReceiptsSummary);
router.get(['/pagination', '/receipts/pagination'], validate(queryPaymentsSchema), getReceiptsMeta);
router.get('/next-number', getNextPaymentNumberHandler);
router.get('/receipts/next-number', getNextReceiptNumber);
router.get(['/unpaid-invoices/:partyId', '/party/:partyId/unpaid-invoices'], validate(partyIdParamSchema), getUnpaidInvoices);
router.get(['/invoice-history/:invoiceId', '/invoices/:invoiceId/history'], validate(invoiceIdParamSchema), getInvoicePaymentHistoryHandler);

// ==========================================
// 4. Common Document PDF & Cancellation
// ==========================================
router.get(['/:id/pdf', '/receipts/:id/pdf', '/vendor-payments/:id/pdf'], validate(paymentIdParamSchema), getPaymentPDF);
router.post(['/:id/cancel', '/receipts/:id/cancel', '/vendor-payments/:id/cancel'], validate(paymentIdParamSchema), cancelPaymentHandler);

// ==========================================
// 5. Core CRUD Operations
// ==========================================
router.get(['/', '/receipts'], validate(queryPaymentsSchema), getAllReceipts);
router.post(['/', '/receipts'], validate(createReceiptSchema), createReceipt);
router.get(['/:id', '/receipts/:id', '/vendor-payments/:id'], validate(paymentIdParamSchema), getPaymentById);

module.exports = router;
