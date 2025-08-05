const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getEwayBillMeta, getEwayBillById, getEwayBillByInvoiceId, createEwayBill, updateEwayBill, deleteEwayBill } = require('../controllers/ewayBill.controller')
const { getEWayBillByIdValidationSchema, getEWayBillsByInvoiceValidationSchema, createEWayBillValidationSchema, updateEWayBillValidationSchema, deleteEWayBillValidationSchema } = require('../validation/ewaybill.validation')
const router = Router()

// Eway Bill
router.get('/pagination', getEwayBillMeta);
router.get('/:id', validate(getEWayBillByIdValidationSchema), getEwayBillById);
router.get('/invoice/:id', validate(getEWayBillsByInvoiceValidationSchema), getEwayBillByInvoiceId);
router.post('/', validate(createEWayBillValidationSchema), createEwayBill);
router.patch('/:id', validate(updateEWayBillValidationSchema), updateEwayBill);
router.delete('/:id', validate(deleteEWayBillValidationSchema), deleteEwayBill);

module.exports = router