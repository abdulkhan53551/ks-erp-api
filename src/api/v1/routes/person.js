const express = require('express')
const router = express.Router();
const personController = require('../controllers/person');

router.get('/', personController.getPerson);
router.post('/', personController.addPerson);
router.get('/:id', personController.getPersonByID);

exports.personRoutes = router;