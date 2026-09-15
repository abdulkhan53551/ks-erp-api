const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
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
router.post('/', checkPermission('invoices', 'create'), validate(createInvoiceValidationSchema), createInvoice);
router.post('/bulk-delete', checkPermission('invoices', 'delete'), validate(bulkDeleteInvoicesValidationSchema), bulkDeleteInvoices);
router.patch('/bulk-restore', checkPermission('invoices', 'update'), validate(bulkRestoreInvoicesValidationSchema), bulkRestoreInvoices);
router.get('/:id/pdf', checkPermission('invoices', 'print'), validate(getInvoiceByIdValidationSchema), getInvoicePdf);
router.get('/:id', checkPermission('invoices', 'read'), validate(getInvoiceByIdValidationSchema), getInvoiceById);
router.patch('/:id', checkPermission('invoices', 'update'), validate(updateInvoiceValidationSchema), updateInvoice);
router.patch('/:id/restore', checkPermission('invoices', 'update'), validate(restoreInvoiceValidationSchema), restoreInvoice);
router.delete('/:id', checkPermission('invoices', 'delete'), validate(deleteInvoiceValidationSchema), deleteInvoice);

module.exports = router;