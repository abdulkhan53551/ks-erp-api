const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');
const { 
    getInvoiceMeta, 
    getInvoiceSummary,
    getAllInvoice, 
    getInvoiceById, 
    createInvoice, 
    updateInvoice, 
    deleteInvoice, 
    restoreInvoice, 
    cancelInvoice,
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
    queryInvoicesSchema,
    cancelInvoiceValidationSchema
} = require('../validation/invoice.validation');

const router = Router();

// Enforce firm context perimeter defense (mutations & sequence generation strictly required)
router.use(requireFirmContext);

// Invoice routes guarded by Casbin in-memory RBAC
router.get('/next-invoice-number', checkPermission('invoices', 'read'), getNextInvoiceNumber);
router.get('/pagination', checkPermission('invoices', 'read'), validate(queryInvoicesSchema), getInvoiceMeta);
router.get('/summary', checkPermission('invoices', 'read'), validate(queryInvoicesSchema), getInvoiceSummary);
router.get('/', checkPermission('invoices', 'read'), validate(queryInvoicesSchema), getAllInvoice);
router.post('/', checkPermission('invoices', 'create'), validate(createInvoiceValidationSchema), createInvoice);
router.post('/bulk-delete', checkPermission('invoices', 'delete'), validate(bulkDeleteInvoicesValidationSchema), bulkDeleteInvoices);
router.patch('/bulk-restore', checkPermission('invoices', 'delete'), validate(bulkRestoreInvoicesValidationSchema), bulkRestoreInvoices);
router.get('/:id/pdf', checkPermission('invoices', 'print'), validate(getInvoiceByIdValidationSchema), getInvoicePdf);
router.get('/:id', checkPermission('invoices', 'read'), validate(getInvoiceByIdValidationSchema), getInvoiceById);
router.patch('/:id', checkPermission('invoices', 'update'), validate(updateInvoiceValidationSchema), updateInvoice);
router.patch('/:id/cancel', checkPermission('invoices', 'update'), validate(cancelInvoiceValidationSchema), cancelInvoice);
router.patch('/:id/restore', checkPermission('invoices', 'delete'), validate(restoreInvoiceValidationSchema), restoreInvoice);
router.delete('/:id', checkPermission('invoices', 'delete'), validate(deleteInvoiceValidationSchema), deleteInvoice);

module.exports = router;