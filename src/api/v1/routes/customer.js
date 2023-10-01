const express = require('express')
const router = express.Router();
const customerController = require('../controller/customer');

router.get('/', customerController.getCustomer);
router.get('/:id', customerController.getCustomerByID);
router.post('/', customerController.addCustomer);

exports.customerRoutes = router;