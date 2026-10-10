const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');
const {
    createReceiptSchema,
    createVendorPaymentSchema,
    applyCustomerAdvanceSchema,
    queryPaymentsSchema,
    paymentIdParamSchema,
    partyIdParamSchema,
    invoiceIdParamSchema,
    deletePaymentSchema,
    restorePaymentSchema,
    bulkDeletePaymentsSchema,
    bulkRestorePaymentsSchema
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
    deletePaymentController,
    restorePaymentController,
    bulkDeletePaymentsController,
    bulkRestorePaymentsController,
    getNextPaymentNumberHandler,
    getNextReceiptNumber,
    getUnpaidInvoices,
    getInvoicePaymentHistoryHandler,
    getPaymentPDF
} = require('../controllers/payment.controller');

const router = Router();

// Enforce firm context on all mutations in this module
router.use(requireFirmContext);

// ==========================================
// 1. Bulk Operations (Recycle Bin / Delete / Restore)
// ==========================================
router.post(['/bulk-delete', '/receipts/bulk-delete', '/vendor-payments/bulk-delete'], checkPermission('payments', 'delete'), validate(bulkDeletePaymentsSchema), bulkDeletePaymentsController);
router.patch(['/bulk-restore', '/receipts/bulk-restore', '/vendor-payments/bulk-restore'], checkPermission('payments', 'delete'), validate(bulkRestorePaymentsSchema), bulkRestorePaymentsController);

// ==========================================
// 2. Customer Advances & Knock-Off Endpoints
// ==========================================
router.get('/advances/:partyId', checkPermission('payments', 'read'), validate(partyIdParamSchema), getAvailableAdvancesHandler);
router.post(['/:id/apply-advance', '/receipts/:id/apply-advance'], checkPermission('payments', 'create'), validate(applyCustomerAdvanceSchema), applyCustomerAdvanceHandler);

// ==========================================
// 3. Vendor Payments (OUTWARD)
// ==========================================
router.get('/vendor-payments/summary', checkPermission('payments', 'read'), validate(queryPaymentsSchema), getVendorPaymentsSummary);
router.get('/vendor-payments/pagination', checkPermission('payments', 'read'), validate(queryPaymentsSchema), getVendorPaymentsMeta);
router.get('/vendor-payments', checkPermission('payments', 'read'), validate(queryPaymentsSchema), getAllVendorPayments);
router.post('/vendor-payments', checkPermission('payments', 'create'), validate(createVendorPaymentSchema), createVendorPayment);

// ==========================================
// 4. Customer Receipts (INWARD) & Summaries
// ==========================================
router.get(['/summary', '/receipts/summary'], checkPermission('payments', 'read'), validate(queryPaymentsSchema), getReceiptsSummary);
router.get(['/pagination', '/receipts/pagination'], checkPermission('payments', 'read'), validate(queryPaymentsSchema), getReceiptsMeta);
router.get('/next-number', checkPermission('payments', 'read'), getNextPaymentNumberHandler);
router.get('/receipts/next-number', checkPermission('payments', 'read'), getNextReceiptNumber);
router.get(['/unpaid-invoices/:partyId', '/party/:partyId/unpaid-invoices'], checkPermission('payments', 'read'), validate(partyIdParamSchema), getUnpaidInvoices);
router.get(['/invoice-history/:invoiceId', '/invoices/:invoiceId/history'], checkPermission('payments', 'read'), validate(invoiceIdParamSchema), getInvoicePaymentHistoryHandler);

// ==========================================
// 5. Common Document PDF, Cancellation, Restore & Delete
// ==========================================
router.get(['/:id/pdf', '/receipts/:id/pdf', '/vendor-payments/:id/pdf'], checkPermission('payments', 'print'), validate(paymentIdParamSchema), getPaymentPDF);
router.post(['/:id/cancel', '/receipts/:id/cancel', '/vendor-payments/:id/cancel'], checkPermission('payments', 'delete'), validate(paymentIdParamSchema), cancelPaymentHandler);
router.patch(['/:id/restore', '/receipts/:id/restore', '/vendor-payments/:id/restore'], checkPermission('payments', 'delete'), validate(restorePaymentSchema), restorePaymentController);
router.delete(['/:id', '/receipts/:id', '/vendor-payments/:id'], checkPermission('payments', 'delete'), validate(deletePaymentSchema), deletePaymentController);

// ==========================================
// 6. Core CRUD Operations
// ==========================================
router.get(['/', '/receipts'], checkPermission('payments', 'read'), validate(queryPaymentsSchema), getAllReceipts);
router.post(['/', '/receipts'], checkPermission('payments', 'create'), validate(createReceiptSchema), createReceipt);
router.get(['/:id', '/receipts/:id', '/vendor-payments/:id'], checkPermission('payments', 'read'), validate(paymentIdParamSchema), getPaymentById);

module.exports = router;
