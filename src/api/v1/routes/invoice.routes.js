const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getInvoiceMeta, getAllInvoice, getInvoiceById, createInvoice, updateInvoice, deleteInvoice, getInvoicePdf, getNextInvoiceNumber } = require('../controllers/invoice.controller')
const { getInvoiceByIdValidationSchema, createInvoiceValidationSchema, updateInvoiceValidationSchema, deleteInvoiceValidationSchema } = require('../validation/invoice.validation')
const router = Router()

// Invoice
router.get('/next-invoice-number', getNextInvoiceNumber);
router.get('/pagination', getInvoiceMeta);
router.get('/', getAllInvoice);
router.post('/', validate(createInvoiceValidationSchema), createInvoice);
router.get('/:id/pdf', validate(getInvoiceByIdValidationSchema), getInvoicePdf);
router.get('/:id', validate(getInvoiceByIdValidationSchema), getInvoiceById);
router.patch('/:id', validate(updateInvoiceValidationSchema), updateInvoice);
router.delete('/:id', validate(deleteInvoiceValidationSchema), deleteInvoice);

module.exports = router