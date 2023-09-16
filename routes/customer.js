const express = require('express')
const router = express.Router();
const customerController = require('../controller/customer');

router.get('/', customerController.getPerson);
// router.post('/', customerController.addPerson);
// router.get('/:id', customerController.getPersonByID);

exports.customerRoutes = router;