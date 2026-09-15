const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const { 
    getPurchaseOrderMeta, 
    getPurchaseOrderById, 
    getPurchaseOrderByInvoiceId, 
    createPurchaseOrder, 
    updatePurchaseOrder, 
    deletePurchaseOrder, 
    restorePurchaseOrder, 
    bulkDeletePurchaseOrders, 
    bulkRestorePurchaseOrders, 
    getAllPurchaseOrder 
} = require('../controllers/purchaseOrder.controller');
const { 
    getPurchaseOrderByIdValidationSchema, 
    getPurchaseOrdersByInvoiceIdValidationSchema, 
    createPurchaseOrderValidationSchema, 
    updatePurchaseOrderValidationSchema, 
    deletePurchaseOrderValidationSchema, 
    restorePurchaseOrderValidationSchema, 
    bulkDeletePurchaseOrdersValidationSchema, 
    bulkRestorePurchaseOrdersValidationSchema 
} = require('../validation/purchaseOrder.validation');

const router = Router();

// Purchase Order routes guarded by Casbin in-memory RBAC
router.get('/pagination', checkPermission('purchase-orders', 'read'), getPurchaseOrderMeta);
router.get('/', checkPermission('purchase-orders', 'read'), getAllPurchaseOrder);
router.post('/bulk-delete', checkPermission('purchase-orders', 'delete'), validate(bulkDeletePurchaseOrdersValidationSchema), bulkDeletePurchaseOrders);
router.patch('/bulk-restore', checkPermission('purchase-orders', 'update'), validate(bulkRestorePurchaseOrdersValidationSchema), bulkRestorePurchaseOrders);
router.get('/invoice/:invoiceId', checkPermission('purchase-orders', 'read'), validate(getPurchaseOrdersByInvoiceIdValidationSchema), getPurchaseOrderByInvoiceId);
router.get('/:id', checkPermission('purchase-orders', 'read'), validate(getPurchaseOrderByIdValidationSchema), getPurchaseOrderById);
router.post('/', checkPermission('purchase-orders', 'create'), validate(createPurchaseOrderValidationSchema), createPurchaseOrder);
router.patch('/:id', checkPermission('purchase-orders', 'update'), validate(updatePurchaseOrderValidationSchema), updatePurchaseOrder);
router.patch('/:id/restore', checkPermission('purchase-orders', 'update'), validate(restorePurchaseOrderValidationSchema), restorePurchaseOrder);
router.delete('/:id', checkPermission('purchase-orders', 'delete'), validate(deletePurchaseOrderValidationSchema), deletePurchaseOrder);

module.exports = router;