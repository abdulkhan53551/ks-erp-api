const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const { createFirmValidationSchema, updateFirmValidationSchema, deleteFirmValidationSchema, getFirmByIdValidationSchema } = require('../validation/firm.validation');
const { createFirm, getAllFirm, updateFirm, deleteFirm, restoreFirm, getFirmType, getFirmById, getFirmMeta, deleteFirmLogo, uploadFirmLogo } = require('../controllers/firm.controller');
const { getFirmBranches, getFirmBranchById, createFirmBranch, updateFirmBranch, deleteFirmBranch } = require('../controllers/firmBranch.controller');
const upload = require('../middlewares/multer.middleware');
const router = Router();

// Firm routes guarded by Casbin in-memory RBAC
router.get('/firm-type', checkPermission('firms', 'read'), getFirmType);
router.get('/firm-pagination', checkPermission('firms', 'read'), getFirmMeta);
router.get('/', checkPermission('firms', 'read'), getAllFirm);
router.get('/:id', checkPermission('firms', 'read'), validate(getFirmByIdValidationSchema), getFirmById);
router.post('/', checkPermission('firms', 'create'), validate(createFirmValidationSchema), createFirm);
router.patch('/:id/restore', checkPermission('firms', 'update'), restoreFirm);
router.patch('/:id', checkPermission('firms', 'update'), validate(updateFirmValidationSchema), updateFirm);
router.delete('/:id', checkPermission('firms', 'delete'), validate(deleteFirmValidationSchema), deleteFirm);
router.post("/:id/logo", checkPermission('firms', 'update'), upload.fields([
    { name: "logo", maxCount: 1 }
]), uploadFirmLogo);

// Firm Branches routes
router.get('/:firmId/branches', checkPermission('firms', 'read'), getFirmBranches);
router.post('/:firmId/branches', checkPermission('firms', 'create'), createFirmBranch);
router.get('/:firmId/branches/:branchId', checkPermission('firms', 'read'), getFirmBranchById);
router.put('/:firmId/branches/:branchId', checkPermission('firms', 'update'), updateFirmBranch);
router.delete('/:firmId/branches/:branchId', checkPermission('firms', 'delete'), deleteFirmBranch);

module.exports = router;