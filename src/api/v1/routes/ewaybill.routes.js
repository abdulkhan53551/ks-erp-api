const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getEwayBillMeta, getEwayBillById, getEwayBillByInvoiceId, createEwayBill, updateEwayBill, deleteEwayBill, restoreEwayBill, bulkDeleteEwayBills, bulkRestoreEwayBills, getAllEwayBill } = require('../controllers/ewayBill.controller')
const { getEWayBillByIdValidationSchema, getEWayBillsByInvoiceValidationSchema, createEWayBillValidationSchema, updateEWayBillValidationSchema, deleteEWayBillValidationSchema, restoreEWayBillValidationSchema, bulkDeleteEWayBillsValidationSchema, bulkRestoreEWayBillsValidationSchema } = require('../validation/ewaybill.validation')
const router = Router()

// Eway Bill
router.get('/pagination', getEwayBillMeta);
router.get('/', getAllEwayBill);
router.post('/bulk-delete', validate(bulkDeleteEWayBillsValidationSchema), bulkDeleteEwayBills);
router.patch('/bulk-restore', validate(bulkRestoreEWayBillsValidationSchema), bulkRestoreEwayBills);
router.get('/invoice/:invoiceId', validate(getEWayBillsByInvoiceValidationSchema), getEwayBillByInvoiceId);
router.get('/:id', validate(getEWayBillByIdValidationSchema), getEwayBillById);
router.post('/', validate(createEWayBillValidationSchema), createEwayBill);
router.patch('/:id', validate(updateEWayBillValidationSchema), updateEwayBill);
router.patch('/:id/restore', validate(restoreEWayBillValidationSchema), restoreEwayBill);
router.delete('/:id', validate(deleteEWayBillValidationSchema), deleteEwayBill);

module.exports = router