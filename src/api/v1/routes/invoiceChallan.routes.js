const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getInvoiceChallansByInvoiceId, getInvoiceChallanById, createInvoiceChallan, updateInvoiceChallan, deleteInvoiceChallan, restoreInvoiceChallan, bulkDeleteInvoiceChallans, bulkRestoreInvoiceChallans, getInvoiceChallanMeta, getAllInvoiceChallans } = require('../controllers/invoiceChallan.controller')
const { getInvoiceChallanByIdValidationSchema, getInvoiceChallansByInvoiceIdValidationSchema, createInvoiceChallanValidationSchema, updateInvoiceChallanValidationSchema, deleteInvoiceChallanValidationSchema, restoreInvoiceChallanValidationSchema, bulkDeleteInvoiceChallansValidationSchema, bulkRestoreInvoiceChallansValidationSchema } = require('../validation/invoiceChallan.validation')
const router = Router()

// Invoice Challan
router.get('/pagination', getInvoiceChallanMeta);
router.get('/', getAllInvoiceChallans);
router.post('/bulk-delete', validate(bulkDeleteInvoiceChallansValidationSchema), bulkDeleteInvoiceChallans);
router.patch('/bulk-restore', validate(bulkRestoreInvoiceChallansValidationSchema), bulkRestoreInvoiceChallans);
router.get('/invoice/:invoiceId', validate(getInvoiceChallansByInvoiceIdValidationSchema), getInvoiceChallansByInvoiceId);
router.get('/:id', validate(getInvoiceChallanByIdValidationSchema), getInvoiceChallanById);
router.post('/', validate(createInvoiceChallanValidationSchema), createInvoiceChallan);
router.patch('/:id', validate(updateInvoiceChallanValidationSchema), updateInvoiceChallan);
router.patch('/:id/restore', validate(restoreInvoiceChallanValidationSchema), restoreInvoiceChallan);
router.delete('/:id', validate(deleteInvoiceChallanValidationSchema), deleteInvoiceChallan);

module.exports = router