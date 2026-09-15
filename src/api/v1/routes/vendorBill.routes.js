const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const {
    createVendorBillSchema,
    updateVendorBillSchema,
    queryVendorBillsSchema,
    vendorBillIdParamSchema,
    vendorPartyIdParamSchema
} = require('../validation/vendorBill.validation');
const {
    createVendorBillHandler,
    getAllVendorBillsHandler,
    getVendorBillsMetaHandler,
    getVendorBillsSummaryHandler,
    getVendorBillByIdHandler,
    updateVendorBillHandler,
    deleteVendorBillHandler,
    getUnpaidVendorBillsHandler
} = require('../controllers/vendorBill.controller');

const router = Router();

// Summary & Metadata
router.get('/summary', checkPermission('vendor-bills', 'read'), validate(queryVendorBillsSchema), getVendorBillsSummaryHandler);
router.get('/pagination', checkPermission('vendor-bills', 'read'), validate(queryVendorBillsSchema), getVendorBillsMetaHandler);
router.get('/unpaid/:partyId', checkPermission('vendor-bills', 'read'), validate(vendorPartyIdParamSchema), getUnpaidVendorBillsHandler);

// CRUD
router.get('/', checkPermission('vendor-bills', 'read'), validate(queryVendorBillsSchema), getAllVendorBillsHandler);
router.post('/', checkPermission('vendor-bills', 'create'), validate(createVendorBillSchema), createVendorBillHandler);
router.get('/:id', checkPermission('vendor-bills', 'read'), validate(vendorBillIdParamSchema), getVendorBillByIdHandler);
router.put('/:id', checkPermission('vendor-bills', 'update'), validate(updateVendorBillSchema), updateVendorBillHandler);
router.delete('/:id', checkPermission('vendor-bills', 'delete'), validate(vendorBillIdParamSchema), deleteVendorBillHandler);

module.exports = router;
