const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');
const { 
    getInvoiceMeta, 
    getAllInvoice, 
    getInvoiceById, 
    createInvoice, 
    updateInvoice, 
    deleteInvoice, 
    restoreInvoice, 
    bulkDeleteInvoices, 
    bulkRestoreInvoices, 
    getInvoicePdf, 
    getNextInvoiceNumber 
} = require('../controllers/invoice.controller');
const { 
    getInvoiceByIdValidationSchema, 
    createInvoiceValidationSchema, 
    updateInvoiceValidationSchema, 
    deleteInvoiceValidationSchema, 
    restoreInvoiceValidationSchema, 
    bulkDeleteInvoicesValidationSchema, 
    bulkRestoreInvoicesValidationSchema, 
    queryInvoicesSchema 
} = require('../validation/invoice.validation');

const router = Router();

// Invoice routes guarded by Casbin in-memory RBAC
router.get('/next-invoice-number', checkPermission('invoices', 'read'), getNextInvoiceNumber);
router.get('/pagination', checkPermission('invoices', 'read'), validate(queryInvoicesSchema), getInvoiceMeta);
router.get('/', checkPermission('invoices', 'read'), validate(queryInvoicesSchema), getAllInvoice);
router.post('/', requireFirmContext, checkPermission('invoices', 'create'), validate(createInvoiceValidationSchema), createInvoice);
router.post('/bulk-delete', requireFirmContext, checkPermission('invoices', 'delete'), validate(bulkDeleteInvoicesValidationSchema), bulkDeleteInvoices);
router.patch('/bulk-restore', requireFirmContext, checkPermission('invoices', 'update'), validate(bulkRestoreInvoicesValidationSchema), bulkRestoreInvoices);
router.get('/:id/pdf', checkPermission('invoices', 'print'), validate(getInvoiceByIdValidationSchema), getInvoicePdf);
router.get('/:id', checkPermission('invoices', 'read'), validate(getInvoiceByIdValidationSchema), getInvoiceById);
router.patch('/:id', requireFirmContext, checkPermission('invoices', 'update'), validate(updateInvoiceValidationSchema), updateInvoice);
router.patch('/:id/restore', requireFirmContext, checkPermission('invoices', 'update'), validate(restoreInvoiceValidationSchema), restoreInvoice);
router.delete('/:id', requireFirmContext, checkPermission('invoices', 'delete'), validate(deleteInvoiceValidationSchema), deleteInvoice);

module.exports = router;