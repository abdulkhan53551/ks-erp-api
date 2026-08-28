const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits, getAllAddressTypes, getAddressTypesMeta, createAddressType, getAddressTypeById, updateAddressType, deleteAddressType, restoreAddressType, bulkDeleteAddressTypes, bulkRestoreAddressTypes, getAllContactRoles, getContactRolesMeta, createContactRole, getContactRoleById, updateContactRole, deleteContactRole, restoreContactRole, bulkDeleteContactRoles, bulkRestoreContactRoles } = require('../controllers/masters.controller')
const { getCityByStateIdValidationSchema, getAddressTypeSchema, deleteAddressTypeSchema, restoreAddressTypeSchema, bulkDeleteAddressTypesSchema, bulkRestoreAddressTypesSchema, createAddressTypeSchema, updateAddressTypeSchema, createContactRoleSchema, getContactRoleSchema, updateContactRoleSchema, deleteContactRoleSchema, restoreContactRoleSchema, bulkDeleteContactRolesSchema, bulkRestoreContactRolesSchema } = require('../validation/masters.validation')
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

// Address Types
router.get('/address-types/pagination', getAddressTypesMeta);
router.get('/address-types', getAllAddressTypes);
router.post('/address-types/bulk-delete', validate(bulkDeleteAddressTypesSchema), bulkDeleteAddressTypes);
router.patch('/address-types/bulk-restore', validate(bulkRestoreAddressTypesSchema), bulkRestoreAddressTypes);
router.post('/address-types', validate(createAddressTypeSchema), createAddressType);
router.get('/address-types/:id', validate(getAddressTypeSchema), getAddressTypeById);
router.patch('/address-types/:id/restore', validate(restoreAddressTypeSchema), restoreAddressType);
router.patch('/address-types/:id', validate(updateAddressTypeSchema), updateAddressType);
router.delete('/address-types/:id', validate(deleteAddressTypeSchema), deleteAddressType);

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