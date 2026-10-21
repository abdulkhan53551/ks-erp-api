const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');
const {
    getAllProformaInvoicesController,
    getProformaInvoicePaginationController,
    getNextExpectedProformaNumberController,
    getProformaInvoiceByIdController,
    createProformaInvoiceController,
    updateProformaInvoiceController,
    deleteProformaInvoiceController,
    restoreProformaInvoiceController,
    bulkDeleteProformaInvoicesController,
    bulkRestoreProformaInvoicesController,
    convertProformaToTaxInvoiceController,
    generateProformaInvoicePdfController,
    previewProformaInvoicePdfController
} = require('../controllers/proformaInvoice.controller');
const {
    getProformaInvoiceByIdSchema,
    queryProformaInvoicesSchema,
    createProformaInvoiceSchema,
    updateProformaInvoiceSchema
} = require('../validation/proformaInvoice.validation');

const router = Router();

// Proforma Invoice routes guarded by Casbin RBAC & Firm Context
router.get('/next-number', checkPermission('proforma-invoices', 'read'), getNextExpectedProformaNumberController);
router.get('/pagination', checkPermission('proforma-invoices', 'read'), validate(queryProformaInvoicesSchema), getProformaInvoicePaginationController);
router.get('/', checkPermission('proforma-invoices', 'read'), validate(queryProformaInvoicesSchema), getAllProformaInvoicesController);

router.post('/preview-pdf', checkPermission('proforma-invoices', 'print'), previewProformaInvoicePdfController);
router.post('/bulk-delete', requireFirmContext, checkPermission('proforma-invoices', 'delete'), bulkDeleteProformaInvoicesController);
router.patch('/bulk-restore', requireFirmContext, checkPermission('proforma-invoices', 'delete'), bulkRestoreProformaInvoicesController);

router.post('/', requireFirmContext, checkPermission('proforma-invoices', 'create'), validate(createProformaInvoiceSchema), createProformaInvoiceController);

router.get('/:id/pdf', checkPermission('proforma-invoices', 'print'), validate(getProformaInvoiceByIdSchema), generateProformaInvoicePdfController);
router.get('/:id', checkPermission('proforma-invoices', 'read'), validate(getProformaInvoiceByIdSchema), getProformaInvoiceByIdController);

router.put('/:id', requireFirmContext, checkPermission('proforma-invoices', 'update'), validate(updateProformaInvoiceSchema), updateProformaInvoiceController);
router.patch('/:id/restore', requireFirmContext, checkPermission('proforma-invoices', 'delete'), validate(getProformaInvoiceByIdSchema), restoreProformaInvoiceController);
router.patch('/:id', requireFirmContext, checkPermission('proforma-invoices', 'update'), validate(updateProformaInvoiceSchema), updateProformaInvoiceController);

router.post('/:id/convert-to-invoice', requireFirmContext, checkPermission('proforma-invoices', 'update'), convertProformaToTaxInvoiceController);
router.delete('/:id', requireFirmContext, checkPermission('proforma-invoices', 'delete'), validate(getProformaInvoiceByIdSchema), deleteProformaInvoiceController);

module.exports = router;

