const express = require('express')
const router = express.Router();
const userController = require('../controller/user');

router
    .get('/', userController.getAllUsers)
    .get('/:id', userController.getUser);

exports.userRoutes = router;