const express = require('express')
const router = express.Router();
const productController = require('../controllers/product');

router
    .get('/', productController.getAllProducts)
    .get('/:id', productController.getProduct);

exports.productRoutes = router;