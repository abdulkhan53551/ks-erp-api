const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes')
const firmRoutes = require('./firm.routes')
const invoiceChallan = require('./invoiceChallan.routes')
const purchaseOrder = require('./purchaseOrder.routes')
const ewaybill = require('./ewaybill.routes')
const userRoutes = require('./user.routes')
const demoRoutes = require('./demo.routes')
const { productRoutes } = require('./product');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

// const { customerRoutes } = require('./customer');
// const { personRoutes } = require('./person');
// const { productRoutes } = require('./product');
// const { userRoutes } = require('./user');


// 🔓 Public routes (no auth needed)
router.use('/auth', authRoutes)
router.use('/firm', firmRoutes)
router.use('/invoice-challan', invoiceChallan)
router.use('/purchase-order', purchaseOrder)
router.use('/ewaybill', ewaybill)

// 🔐 Protected routes (require valid access token)
router.use(verifyAccessToken);

router.use('/users', userRoutes)
router.use('/demo', demoRoutes)
router.use('/products', productRoutes)

module.exports = router;
// exports.products = productRoutes;
// exports.users = userRoutes;
// exports.persons = personRoutes;
// exports.customers = customerRoutes;