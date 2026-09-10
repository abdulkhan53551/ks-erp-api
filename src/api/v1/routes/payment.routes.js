const { Router } = require('express');
const validate = require('../middlewares/validate');
const {
    createReceiptSchema,
    queryReceiptsSchema,
    receiptIdParamSchema,
    partyIdParamSchema,
    invoiceIdParamSchema
} = require('../validation/payment.validation');
const {
    createReceipt,
    getAllReceipts,
    getReceiptsMeta,
    getReceiptsSummary,
    getReceiptById,
    cancelReceiptHandler,
    getNextReceiptNumber,
    getUnpaidInvoices,
    getInvoicePaymentHistoryHandler,
    getReceiptPDF
} = require('../controllers/payment.controller');

const router = Router();

// Summary Metrics across filtered receipts (decoupled from pagination)
router.get(['/summary', '/receipts/summary'], validate(queryReceiptsSchema), getReceiptsSummary);

// Metadata & Helpers
router.get(['/pagination', '/receipts/pagination'], validate(queryReceiptsSchema), getReceiptsMeta);
router.get(['/next-number', '/receipts/next-number'], getNextReceiptNumber);
router.get(['/unpaid-invoices/:partyId', '/party/:partyId/unpaid-invoices'], validate(partyIdParamSchema), getUnpaidInvoices);
router.get(['/invoice-history/:invoiceId', '/invoices/:invoiceId/history'], validate(invoiceIdParamSchema), getInvoicePaymentHistoryHandler);

// Receipt PDF
router.get(['/:id/pdf', '/receipts/:id/pdf'], validate(receiptIdParamSchema), getReceiptPDF);

// Receipt Actions
router.post(['/:id/cancel', '/receipts/:id/cancel'], validate(receiptIdParamSchema), cancelReceiptHandler);

// Core CRUD (Supports both /payments and /payments/receipts)
router.get(['/', '/receipts'], validate(queryReceiptsSchema), getAllReceipts);
router.post(['/', '/receipts'], validate(createReceiptSchema), createReceipt);
router.get(['/:id', '/receipts/:id'], validate(receiptIdParamSchema), getReceiptById);

module.exports = router;
