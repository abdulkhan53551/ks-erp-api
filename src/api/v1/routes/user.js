const express = require('express')
const router = express.Router();
const userController = require('../controllers/user');

router
    .get('/', userController.getAllUsers)
    .get('/:id', userController.getUser);

exports.userRoutes = router;