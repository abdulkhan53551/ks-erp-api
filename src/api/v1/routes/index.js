const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes')
const firmRoutes = require('./firm.routes')
const invoiceChallanRoutes = require('./invoiceChallan.routes')
const purchaseOrderRoutes = require('./purchaseOrder.routes')
const ewaybillRoutes = require('./ewaybill.routes')
const invoiceRoutes = require('./invoice.routes')
const mastersRoutes = require('./masters.routes')
const userRoutes = require('./user.routes')
const demoRoutes = require('./demo.routes')
const partyRoutes = require('./party.routes')
const { productRoutes } = require('./product');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { db } = require('../database');

// const { customerRoutes } = require('./customer');
// const { personRoutes } = require('./person');
// const { productRoutes } = require('./product');
// const { userRoutes } = require('./user');


// 🔓 Public routes (no auth needed)
router.use('/auth', authRoutes)
router.get('/test', async (req, res) => {
    const result = await db.raw("SELECT current_database(), current_user, version();");
    console.log(result.rows);
    return res.send("OK");
});

// 🔐 Protected routes (require valid access token)
router.use(verifyAccessToken);

router.use('/users', userRoutes)
router.use('/demo', demoRoutes)
router.use('/products', productRoutes)
router.use('/firm', firmRoutes)
router.use('/masters', mastersRoutes)
router.use('/invoice-challan', invoiceChallanRoutes)
router.use('/purchase-order', purchaseOrderRoutes)
router.use('/ewaybill', ewaybillRoutes)
router.use('/invoice', invoiceRoutes)
router.use('/invoice', invoiceRoutes)
router.use('/parties', partyRoutes)

module.exports = router;
// exports.products = productRoutes;
// exports.users = userRoutes;
// exports.persons = personRoutes;
// exports.customers = customerRoutes;