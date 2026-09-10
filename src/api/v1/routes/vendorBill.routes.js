const { Router } = require('express');
const validate = require('../middlewares/validate');
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
router.get('/summary', validate(queryVendorBillsSchema), getVendorBillsSummaryHandler);
router.get('/pagination', validate(queryVendorBillsSchema), getVendorBillsMetaHandler);
router.get('/unpaid/:partyId', validate(vendorPartyIdParamSchema), getUnpaidVendorBillsHandler);

// CRUD
router.get('/', validate(queryVendorBillsSchema), getAllVendorBillsHandler);
router.post('/', validate(createVendorBillSchema), createVendorBillHandler);
router.get('/:id', validate(vendorBillIdParamSchema), getVendorBillByIdHandler);
router.put('/:id', validate(updateVendorBillSchema), updateVendorBillHandler);
router.delete('/:id', validate(vendorBillIdParamSchema), deleteVendorBillHandler);

module.exports = router;
