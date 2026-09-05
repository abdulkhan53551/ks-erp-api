const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits, getAllContactRoles, getContactRolesMeta, createContactRole, getContactRoleById, updateContactRole, deleteContactRole, restoreContactRole, bulkDeleteContactRoles, bulkRestoreContactRoles } = require('../controllers/masters.controller')
const { getCityByStateIdValidationSchema, createContactRoleSchema, getContactRoleSchema, updateContactRoleSchema, deleteContactRoleSchema, restoreContactRoleSchema, bulkDeleteContactRolesSchema, bulkRestoreContactRolesSchema } = require('../validation/masters.validation')
const router = Router()

// State & City
router.get('/states', getStates);
router.get('/states/:stateId/cities', validate(getCityByStateIdValidationSchema), getCityByState);

// Payment
router.get('/payment-methods', getPyamentModes);
router.get('/payment-statuses', getPyamentStatuses);

// GST
router.get('/gst-slabs', getGstSlabs);

// items
router.get('/product-units', getProductUnits);

// Contact Roles
router.get('/contact-roles/pagination', getContactRolesMeta);
router.get('/contact-roles', getAllContactRoles);
router.post('/contact-roles/bulk-delete', validate(bulkDeleteContactRolesSchema), bulkDeleteContactRoles);
router.patch('/contact-roles/bulk-restore', validate(bulkRestoreContactRolesSchema), bulkRestoreContactRoles);
router.post('/contact-roles', validate(createContactRoleSchema), createContactRole);
router.get('/contact-roles/:id', validate(getContactRoleSchema), getContactRoleById);
router.patch('/contact-roles/:id/restore', validate(restoreContactRoleSchema), restoreContactRole);
router.patch('/contact-roles/:id', validate(updateContactRoleSchema), updateContactRole);
router.delete('/contact-roles/:id', validate(deleteContactRoleSchema), deleteContactRole);

module.exports = router