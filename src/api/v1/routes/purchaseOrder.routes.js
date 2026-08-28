const { Router } = require('express')
const validate = require('../middlewares/validate');
const { getPurchaseOrderMeta, getPurchaseOrderById, getPurchaseOrderByInvoiceId, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, restorePurchaseOrder, bulkDeletePurchaseOrders, bulkRestorePurchaseOrders, getAllPurchaseOrder } = require('../controllers/purchaseOrder.controller');
const { getPurchaseOrderByIdValidationSchema, getPurchaseOrdersByInvoiceIdValidationSchema, createPurchaseOrderValidationSchema, updatePurchaseOrderValidationSchema, deletePurchaseOrderValidationSchema, restorePurchaseOrderValidationSchema, bulkDeletePurchaseOrdersValidationSchema, bulkRestorePurchaseOrdersValidationSchema } = require('../validation/purchaseOrder.validation');
const router = Router()

// Purchase Order
router.get('/pagination', getPurchaseOrderMeta);
router.get('/', getAllPurchaseOrder);
router.post('/bulk-delete', validate(bulkDeletePurchaseOrdersValidationSchema), bulkDeletePurchaseOrders);
router.patch('/bulk-restore', validate(bulkRestorePurchaseOrdersValidationSchema), bulkRestorePurchaseOrders);
router.get('/invoice/:invoiceId', validate(getPurchaseOrdersByInvoiceIdValidationSchema), getPurchaseOrderByInvoiceId);
router.get('/:id', validate(getPurchaseOrderByIdValidationSchema), getPurchaseOrderById);
router.post('/', validate(createPurchaseOrderValidationSchema), createPurchaseOrder);
router.patch('/:id', validate(updatePurchaseOrderValidationSchema), updatePurchaseOrder);
router.patch('/:id/restore', validate(restorePurchaseOrderValidationSchema), restorePurchaseOrder);
router.delete('/:id', validate(deletePurchaseOrderValidationSchema), deletePurchaseOrder);

module.exports = router