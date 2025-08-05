const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getInvoiceChallansByInvoiceId, getInvoiceChallanById, createInvoiceChallan, updateInvoiceChallan, deleteInvoiceChallan, getInvoiceChallanMeta } = require('../controllers/invoiceChallan.controller')
const { getInvoiceChallanByIdValidationSchema, getInvoiceChallansByInvoiceIdValidationSchema, createInvoiceChallanValidationSchema, updateInvoiceChallanValidationSchema, deleteInvoiceChallanValidationSchema } = require('../validation/invoiceChallan.validation')
const router = Router()

// Invoice Challan
router.get('/pagination', getInvoiceChallanMeta);
router.get('/:id', validate(getInvoiceChallanByIdValidationSchema), getInvoiceChallanById);
router.get('/invoice/:id', validate(getInvoiceChallansByInvoiceIdValidationSchema), getInvoiceChallansByInvoiceId);
router.post('/', validate(createInvoiceChallanValidationSchema), createInvoiceChallan);
router.patch('/:id', validate(updateInvoiceChallanValidationSchema), updateInvoiceChallan);
router.delete('/:id', validate(deleteInvoiceChallanValidationSchema), deleteInvoiceChallan);

module.exports = router