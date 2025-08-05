const { Router } = require('express')
const validate = require('../middlewares/validate');
const { getPurchaseOrderMeta, getPurchaseOrderById, getPurchaseOrderByInvoiceId, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } = require('../controllers/purchaseOrder.controller');
const { getPurchaseOrderByIdValidationSchema, getPurchaseOrdersByInvoiceIdValidationSchema, createPurchaseOrderValidationSchema, updatePurchaseOrderValidationSchema, deletePurchaseOrderValidationSchema } = require('../validation/purchaseOrder.validation');
const router = Router()

// Purchase Order
router.get('/pagination', getPurchaseOrderMeta);
router.get('/:id', validate(getPurchaseOrderByIdValidationSchema), getPurchaseOrderById);
router.get('/invoice/:id', validate(getPurchaseOrdersByInvoiceIdValidationSchema), getPurchaseOrderByInvoiceId);
router.post('/', validate(createPurchaseOrderValidationSchema), createPurchaseOrder);
router.patch('/:id', validate(updatePurchaseOrderValidationSchema), updatePurchaseOrder);
router.delete('/:id', validate(deletePurchaseOrderValidationSchema), deletePurchaseOrder);

module.exports = router