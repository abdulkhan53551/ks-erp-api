const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
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
router.get('/advances/:partyId', checkPermission('payments', 'read'), validate(partyIdParamSchema), getAvailableAdvancesHandler);
router.post(['/:id/apply-advance', '/receipts/:id/apply-advance'], checkPermission('payments', 'create'), validate(applyCustomerAdvanceSchema), applyCustomerAdvanceHandler);

// ==========================================
// 2. Vendor Payments (OUTWARD)
// ==========================================
router.get('/vendor-payments/summary', checkPermission('payments', 'read'), validate(queryPaymentsSchema), getVendorPaymentsSummary);
router.get('/vendor-payments/pagination', checkPermission('payments', 'read'), validate(queryPaymentsSchema), getVendorPaymentsMeta);
router.get('/vendor-payments', checkPermission('payments', 'read'), validate(queryPaymentsSchema), getAllVendorPayments);
router.post('/vendor-payments', checkPermission('payments', 'create'), validate(createVendorPaymentSchema), createVendorPayment);

// ==========================================
// 3. Customer Receipts (INWARD) & Summaries
// ==========================================
router.get(['/summary', '/receipts/summary'], checkPermission('payments', 'read'), validate(queryPaymentsSchema), getReceiptsSummary);
router.get(['/pagination', '/receipts/pagination'], checkPermission('payments', 'read'), validate(queryPaymentsSchema), getReceiptsMeta);
router.get('/next-number', checkPermission('payments', 'read'), getNextPaymentNumberHandler);
router.get('/receipts/next-number', checkPermission('payments', 'read'), getNextReceiptNumber);
router.get(['/unpaid-invoices/:partyId', '/party/:partyId/unpaid-invoices'], checkPermission('payments', 'read'), validate(partyIdParamSchema), getUnpaidInvoices);
router.get(['/invoice-history/:invoiceId', '/invoices/:invoiceId/history'], checkPermission('payments', 'read'), validate(invoiceIdParamSchema), getInvoicePaymentHistoryHandler);

// ==========================================
// 4. Common Document PDF & Cancellation
// ==========================================
router.get(['/:id/pdf', '/receipts/:id/pdf', '/vendor-payments/:id/pdf'], checkPermission('payments', 'print'), validate(paymentIdParamSchema), getPaymentPDF);
router.post(['/:id/cancel', '/receipts/:id/cancel', '/vendor-payments/:id/cancel'], checkPermission('payments', 'delete'), validate(paymentIdParamSchema), cancelPaymentHandler);

// ==========================================
// 5. Core CRUD Operations
// ==========================================
router.get(['/', '/receipts'], checkPermission('payments', 'read'), validate(queryPaymentsSchema), getAllReceipts);
router.post(['/', '/receipts'], checkPermission('payments', 'create'), validate(createReceiptSchema), createReceipt);
router.get(['/:id', '/receipts/:id', '/vendor-payments/:id'], checkPermission('payments', 'read'), validate(paymentIdParamSchema), getPaymentById);

module.exports = router;
