const { Router } = require('express')
const validate = require('../middlewares/validate')
const { createFirmValidationSchema, updateFirmValidationSchema, deleteFirmValidationSchema } = require('../validation/firm.validation')
const { createFirm, getAllFirm, updateFirm, deleteFirm } = require('../controllers/firm.controller')
const router = Router()

// Firm
router.get('/firm', getAllFirm)
router.post('/firm', validate(createFirmValidationSchema), createFirm)
router.patch('/firm/:id', validate(updateFirmValidationSchema), updateFirm)
router.delete('/firm/:id', validate(deleteFirmValidationSchema), deleteFirm);

module.exports = router