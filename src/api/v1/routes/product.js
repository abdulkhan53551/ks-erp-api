const express = require('express')
const router = express.Router();
const productController = require('./../controller/product');

router
    .get('/', productController.getAllProducts)
    .get('/:id', productController.getProduct);

exports.productRoutes = router;