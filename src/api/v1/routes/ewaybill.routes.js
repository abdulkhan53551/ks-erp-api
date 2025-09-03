const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getEwayBillMeta, getEwayBillById, getEwayBillByInvoiceId, createEwayBill, updateEwayBill, deleteEwayBill, getAllEwayBill } = require('../controllers/ewayBill.controller')
const { getEWayBillByIdValidationSchema, getEWayBillsByInvoiceValidationSchema, createEWayBillValidationSchema, updateEWayBillValidationSchema, deleteEWayBillValidationSchema } = require('../validation/ewaybill.validation')
const router = Router()

// Eway Bill
router.get('/pagination', getEwayBillMeta);
router.get('/', getAllEwayBill);
router.get('/invoice/:invoiceId', validate(getEWayBillsByInvoiceValidationSchema), getEwayBillByInvoiceId);
router.get('/:id', validate(getEWayBillByIdValidationSchema), getEwayBillById);
router.post('/', validate(createEWayBillValidationSchema), createEwayBill);
router.patch('/:id', validate(updateEWayBillValidationSchema), updateEwayBill);
router.delete('/:id', validate(deleteEWayBillValidationSchema), deleteEwayBill);

module.exports = router