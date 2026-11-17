const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes')
const firmRoutes = require('./firm.routes')
const invoiceChallanRoutes = require('./invoiceChallan.routes')
const purchaseOrderRoutes = require('./purchaseOrder.routes')
const ewaybillRoutes = require('./ewaybill.routes')
const invoiceRoutes = require('./invoice.routes');
const quotationRoutes = require('./quotation.routes');
const proformaInvoiceRoutes = require('./proformaInvoice.routes');
const mastersRoutes = require('./masters.routes');
const userRoutes = require('./user.routes');
const partyRoutes = require('./party.routes');
const uploadRoutes = require('./upload.routes');
const attachmentRoutes = require('./attachment.routes');
const productRoutes = require('./product.routes');
const paymentRoutes = require('./payment.routes');
const vendorBillRoutes = require('./vendorBill.routes');
const rolePermissionRoutes = require('./rolePermission.routes');
const employeeRoutes = require('./employee.routes');
const shiftRoutes = require('./shift.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leave.routes');
const payrollRoutes = require('./payroll.routes');
const advanceRoutes = require('./advance.routes');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

// 🔓 Public routes (no auth needed)
router.use('/auth', authRoutes);

// 🔐 Protected routes (require valid access token)
router.use(verifyAccessToken);

router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/firm', firmRoutes);
router.use('/masters', mastersRoutes);
router.use('/invoice-challan', invoiceChallanRoutes);
router.use('/purchase-order', purchaseOrderRoutes);
router.use('/ewaybill', ewaybillRoutes);
router.use('/invoice', invoiceRoutes);
router.use('/quotations', quotationRoutes);
router.use('/proforma-invoices', proformaInvoiceRoutes);
router.use('/parties', partyRoutes);
router.use('/uploads', uploadRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/payments', paymentRoutes);
router.use('/vendor-bills', vendorBillRoutes);
router.use('/admin', rolePermissionRoutes);
router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/payroll', payrollRoutes);
router.use('/advances', advanceRoutes);

module.exports = router;