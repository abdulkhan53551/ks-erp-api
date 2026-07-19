const { Router } = require('express')
const validate = require('../middlewares/validate')
const { createFirmValidationSchema, updateFirmValidationSchema, deleteFirmValidationSchema, getFirmByIdValidationSchema } = require('../validation/firm.validation')
const { createFirm, getAllFirm, updateFirm, deleteFirm, getFirmType, getFirmById, getFirmMeta, deleteFirmLogo, uploadFirmLogo } = require('../controllers/firm.controller')
const upload = require('../middlewares/multer.middleware')
const router = Router()

// Firm
router.get('/firm-type', getFirmType);
router.get('/firm-pagination', getFirmMeta);
router.get('/', getAllFirm);
router.get('/:id', validate(getFirmByIdValidationSchema), getFirmById);
router.post('/', validate(createFirmValidationSchema), createFirm);
router.patch('/:id', validate(updateFirmValidationSchema), updateFirm);
router.delete('/:id', validate(deleteFirmValidationSchema), deleteFirm);
router.post("/:id/logo", upload.fields([
    { name: "logo", maxCount: 1 }
]), uploadFirmLogo);
// router.delete("/:id/logo", deleteFirmLogo);

module.exports = router