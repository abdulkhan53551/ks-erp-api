const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');
const { 
    getInvoiceChallansByInvoiceId, 
    getInvoiceChallanById, 
    createInvoiceChallan, 
    updateInvoiceChallan, 
    deleteInvoiceChallan, 
    restoreInvoiceChallan, 
    bulkDeleteInvoiceChallans, 
    bulkRestoreInvoiceChallans, 
    getInvoiceChallanMeta, 
    getAllInvoiceChallans 
} = require('../controllers/invoiceChallan.controller');
const { 
    getInvoiceChallanByIdValidationSchema, 
    getInvoiceChallansByInvoiceIdValidationSchema, 
    createInvoiceChallanValidationSchema, 
    updateInvoiceChallanValidationSchema, 
    deleteInvoiceChallanValidationSchema, 
    restoreInvoiceChallanValidationSchema, 
    bulkDeleteInvoiceChallansValidationSchema, 
    bulkRestoreInvoiceChallansValidationSchema 
} = require('../validation/invoiceChallan.validation');

const router = Router();

// Enforce firm context on all mutations in this module
router.use(requireFirmContext);

// Invoice Challan routes guarded by Casbin in-memory RBAC
router.get('/pagination', checkPermission('challans', 'read'), getInvoiceChallanMeta);
router.get('/', checkPermission('challans', 'read'), getAllInvoiceChallans);
router.post('/bulk-delete', checkPermission('challans', 'delete'), validate(bulkDeleteInvoiceChallansValidationSchema), bulkDeleteInvoiceChallans);
router.patch('/bulk-restore', checkPermission('challans', 'delete'), validate(bulkRestoreInvoiceChallansValidationSchema), bulkRestoreInvoiceChallans);
router.get('/invoice/:invoiceId', checkPermission('challans', 'read'), validate(getInvoiceChallansByInvoiceIdValidationSchema), getInvoiceChallansByInvoiceId);
router.get('/:id', checkPermission('challans', 'read'), validate(getInvoiceChallanByIdValidationSchema), getInvoiceChallanById);
router.post('/', checkPermission('challans', 'create'), validate(createInvoiceChallanValidationSchema), createInvoiceChallan);
router.patch('/:id', checkPermission('challans', 'update'), validate(updateInvoiceChallanValidationSchema), updateInvoiceChallan);
router.patch('/:id/restore', checkPermission('challans', 'delete'), validate(restoreInvoiceChallanValidationSchema), restoreInvoiceChallan);
router.delete('/:id', checkPermission('challans', 'delete'), validate(deleteInvoiceChallanValidationSchema), deleteInvoiceChallan);

module.exports = router;