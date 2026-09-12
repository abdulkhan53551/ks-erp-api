const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getInvoiceMeta, getAllInvoice, getInvoiceById, createInvoice, updateInvoice, deleteInvoice, restoreInvoice, bulkDeleteInvoices, bulkRestoreInvoices, getInvoicePdf, getNextInvoiceNumber } = require('../controllers/invoice.controller')
const { getInvoiceByIdValidationSchema, createInvoiceValidationSchema, updateInvoiceValidationSchema, deleteInvoiceValidationSchema, restoreInvoiceValidationSchema, bulkDeleteInvoicesValidationSchema, bulkRestoreInvoicesValidationSchema, queryInvoicesSchema } = require('../validation/invoice.validation')
const router = Router()

// Invoice
router.get('/next-invoice-number', getNextInvoiceNumber);
router.get('/pagination', validate(queryInvoicesSchema), getInvoiceMeta);
router.get('/', validate(queryInvoicesSchema), getAllInvoice);
router.post('/', validate(createInvoiceValidationSchema), createInvoice);
router.post('/bulk-delete', validate(bulkDeleteInvoicesValidationSchema), bulkDeleteInvoices);
router.patch('/bulk-restore', validate(bulkRestoreInvoicesValidationSchema), bulkRestoreInvoices);
router.get('/:id/pdf', validate(getInvoiceByIdValidationSchema), getInvoicePdf);
router.get('/:id', validate(getInvoiceByIdValidationSchema), getInvoiceById);
router.patch('/:id', validate(updateInvoiceValidationSchema), updateInvoice);
router.patch('/:id/restore', validate(restoreInvoiceValidationSchema), restoreInvoice);
router.delete('/:id', validate(deleteInvoiceValidationSchema), deleteInvoice);

module.exports = router