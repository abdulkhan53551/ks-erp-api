const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission, requireFirmContext } = require('../middlewares/authorize.middleware');
const {
    getAllQuotations,
    getQuotationMeta,
    getNextQuotationNumber,
    getQuotationById,
    createQuotation,
    updateQuotationController,
    createQuotationRevisionController,
    approveQuotationController,
    deleteQuotationController,
    restoreQuotationController,
    bulkDeleteQuotationsController,
    bulkRestoreQuotationsController,
    getQuotationPdfController
} = require('../controllers/quotation.controller');
const {
    getQuotationByIdSchema,
    queryQuotationsSchema,
    createQuotationSchema,
    createQuotationRevisionSchema,
    updateQuotationSchema,
    approveQuotationSchema,
    bulkDeleteQuotationsSchema
} = require('../validation/quotation.validation');

const router = Router();

// Quotation routes guarded by Casbin RBAC & Firm Context
router.get('/next-quotation-number', checkPermission('quotations', 'read'), getNextQuotationNumber);
router.get('/pagination', checkPermission('quotations', 'read'), validate(queryQuotationsSchema), getQuotationMeta);
router.get('/', checkPermission('quotations', 'read'), validate(queryQuotationsSchema), getAllQuotations);

router.post('/', requireFirmContext, checkPermission('quotations', 'create'), validate(createQuotationSchema), createQuotation);
router.post('/bulk-delete', requireFirmContext, checkPermission('quotations', 'delete'), validate(bulkDeleteQuotationsSchema), bulkDeleteQuotationsController);
router.patch('/bulk-restore', requireFirmContext, checkPermission('quotations', 'delete'), validate(bulkDeleteQuotationsSchema), bulkRestoreQuotationsController);

router.get('/:id/pdf', checkPermission('quotations', 'print'), validate(getQuotationByIdSchema), getQuotationPdfController);
router.get('/:id', checkPermission('quotations', 'read'), validate(getQuotationByIdSchema), getQuotationById);

router.patch('/:id', requireFirmContext, checkPermission('quotations', 'update'), validate(updateQuotationSchema), updateQuotationController);
router.post('/:id/revisions', requireFirmContext, checkPermission('quotations', 'create'), validate(createQuotationRevisionSchema), createQuotationRevisionController);
router.patch('/:id/approve', requireFirmContext, checkPermission('quotations', 'approve'), validate(approveQuotationSchema), approveQuotationController);

router.patch('/:id/restore', requireFirmContext, checkPermission('quotations', 'delete'), validate(getQuotationByIdSchema), restoreQuotationController);
router.delete('/:id', requireFirmContext, checkPermission('quotations', 'delete'), validate(getQuotationByIdSchema), deleteQuotationController);

module.exports = router;
