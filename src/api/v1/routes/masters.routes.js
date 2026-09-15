const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits, getAllContactRoles, getContactRolesMeta, createContactRole, getContactRoleById, updateContactRole, deleteContactRole, restoreContactRole, bulkDeleteContactRoles, bulkRestoreContactRoles } = require('../controllers/masters.controller');
const { getCityByStateIdValidationSchema, createContactRoleSchema, getContactRoleSchema, updateContactRoleSchema, deleteContactRoleSchema, restoreContactRoleSchema, bulkDeleteContactRolesSchema, bulkRestoreContactRolesSchema } = require('../validation/masters.validation');
const router = Router();

// State & City dropdowns (Masters: Read)
router.get('/states', checkPermission('masters', 'read'), getStates);
router.get('/states/:stateId/cities', checkPermission('masters', 'read'), validate(getCityByStateIdValidationSchema), getCityByState);

// Payment
router.get('/payment-methods', checkPermission('masters', 'read'), getPyamentModes);
router.get('/payment-statuses', checkPermission('masters', 'read'), getPyamentStatuses);

// GST
router.get('/gst-slabs', checkPermission('masters', 'read'), getGstSlabs);

// items
router.get('/product-units', checkPermission('masters', 'read'), getProductUnits);

// Contact Roles
router.get('/contact-roles/pagination', checkPermission('masters', 'read'), getContactRolesMeta);
router.get('/contact-roles', checkPermission('masters', 'read'), getAllContactRoles);
router.post('/contact-roles/bulk-delete', checkPermission('masters', 'delete'), validate(bulkDeleteContactRolesSchema), bulkDeleteContactRoles);
router.patch('/contact-roles/bulk-restore', checkPermission('masters', 'update'), validate(bulkRestoreContactRolesSchema), bulkRestoreContactRoles);
router.post('/contact-roles', checkPermission('masters', 'create'), validate(createContactRoleSchema), createContactRole);
router.get('/contact-roles/:id', checkPermission('masters', 'read'), validate(getContactRoleSchema), getContactRoleById);
router.patch('/contact-roles/:id/restore', checkPermission('masters', 'update'), validate(restoreContactRoleSchema), restoreContactRole);
router.patch('/contact-roles/:id', checkPermission('masters', 'update'), validate(updateContactRoleSchema), updateContactRole);
router.delete('/contact-roles/:id', checkPermission('masters', 'delete'), validate(deleteContactRoleSchema), deleteContactRole);

module.exports = router;