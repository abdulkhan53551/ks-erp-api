const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const { 
    getEwayBillMeta, 
    getEwayBillById, 
    getEwayBillByInvoiceId, 
    createEwayBill, 
    updateEwayBill, 
    deleteEwayBill, 
    restoreEwayBill, 
    bulkDeleteEwayBills, 
    bulkRestoreEwayBills, 
    getAllEwayBill 
} = require('../controllers/ewayBill.controller');
const { 
    getEWayBillByIdValidationSchema, 
    getEWayBillsByInvoiceValidationSchema, 
    createEWayBillValidationSchema, 
    updateEWayBillValidationSchema, 
    deleteEWayBillValidationSchema, 
    restoreEWayBillValidationSchema, 
    bulkDeleteEWayBillsValidationSchema, 
    bulkRestoreEWayBillsValidationSchema 
} = require('../validation/ewaybill.validation');

const router = Router();

// Eway Bill routes guarded by Casbin in-memory RBAC
router.get('/pagination', checkPermission('eway-bills', 'read'), getEwayBillMeta);
router.get('/', checkPermission('eway-bills', 'read'), getAllEwayBill);
router.post('/bulk-delete', checkPermission('eway-bills', 'delete'), validate(bulkDeleteEWayBillsValidationSchema), bulkDeleteEwayBills);
router.patch('/bulk-restore', checkPermission('eway-bills', 'update'), validate(bulkRestoreEWayBillsValidationSchema), bulkRestoreEwayBills);
router.get('/invoice/:invoiceId', checkPermission('eway-bills', 'read'), validate(getEWayBillsByInvoiceValidationSchema), getEwayBillByInvoiceId);
router.get('/:id', checkPermission('eway-bills', 'read'), validate(getEWayBillByIdValidationSchema), getEwayBillById);
router.post('/', checkPermission('eway-bills', 'create'), validate(createEWayBillValidationSchema), createEwayBill);
router.patch('/:id', checkPermission('eway-bills', 'update'), validate(updateEWayBillValidationSchema), updateEwayBill);
router.patch('/:id/restore', checkPermission('eway-bills', 'update'), validate(restoreEWayBillValidationSchema), restoreEwayBill);
router.delete('/:id', checkPermission('eway-bills', 'delete'), validate(deleteEWayBillValidationSchema), deleteEwayBill);

module.exports = router;