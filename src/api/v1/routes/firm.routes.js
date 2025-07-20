const { Router } = require('express')
const validate = require('../middlewares/validate')
const { createFirmValidationSchema, updateFirmValidationSchema, deleteFirmValidationSchema } = require('../validation/firm.validation')
const { createFirm, getAllFirm, updateFirm, deleteFirm, getFirmType } = require('../controllers/firm.controller')
const router = Router()

// Firm
router.get('/firm-type', getFirmType)
router.get('/', getAllFirm)
router.post('/', validate(createFirmValidationSchema), createFirm)
router.patch('/:id', validate(updateFirmValidationSchema), updateFirm)
router.delete('/:id', validate(deleteFirmValidationSchema), deleteFirm);

module.exports = router