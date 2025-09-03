const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits } = require('../controllers/masters.controller')
const { getCityByStateIdValidationSchema } = require('../validation/masters.validation')
const router = Router()

// State & City
router.get('/states', getStates);
router.get('/states/:stateId/cities', validate(getCityByStateIdValidationSchema), getCityByState);

// Payment
router.get('/payment-methods', getPyamentModes);
router.get('/payment-statuses', getPyamentStatuses);

// GST
router.get('/gst-slabs', getGstSlabs);

// items
router.get('/product-units', getProductUnits);

module.exports = router