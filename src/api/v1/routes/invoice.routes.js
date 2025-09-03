const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getInvoiceMeta, getAllInvoice, getInvoiceById, createInvoice, updateInvoice, deleteInvoice, getInvoicePdf } = require('../controllers/invoice.controller')
const { getInvoiceByIdValidationSchema, createInvoiceValidationSchema, updateInvoiceValidationSchema, deleteInvoiceValidationSchema } = require('../validation/invoice.validation')
const router = Router()

// Invoice
router.get('/pagination', getInvoiceMeta);
router.get('/', getAllInvoice);
router.get('/:id', validate(getInvoiceByIdValidationSchema), getInvoiceById);
router.post('/', validate(createInvoiceValidationSchema), createInvoice);
router.patch('/:id', validate(updateInvoiceValidationSchema), updateInvoice);
router.delete('/:id', validate(deleteInvoiceValidationSchema), deleteInvoice);
router.get('/:id/pdf', validate(getInvoiceByIdValidationSchema), getInvoicePdf);

module.exports = router