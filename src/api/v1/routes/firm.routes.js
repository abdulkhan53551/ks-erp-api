const { Router } = require('express')
const validate = require('../middlewares/validate')
const { createFirmValidationSchema, updateFirmValidationSchema, deleteFirmValidationSchema, getFirmByIdValidationSchema } = require('../validation/firm.validation')
const { createFirm, getAllFirm, updateFirm, deleteFirm, getFirmType, getFirmById } = require('../controllers/firm.controller')
const router = Router()

// Firm
router.get('/firm-type', getFirmType);
router.get('/', getAllFirm);
router.get('/:id', validate(getFirmByIdValidationSchema), getFirmById);
router.post('/', validate(createFirmValidationSchema), createFirm);
router.patch('/:id', validate(updateFirmValidationSchema), updateFirm);
router.delete('/:id', validate(deleteFirmValidationSchema), deleteFirm);

module.exports = router