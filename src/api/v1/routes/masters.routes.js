const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits, getAllAddressTypes, createAddressType, getAddressTypeById, updateAddressType, deleteAddressType, getAllContactRoles, createContactRole, getContactRoleById, updateContactRole, deleteContactRole } = require('../controllers/masters.controller')
const { getCityByStateIdValidationSchema, getAddressTypeSchema, deleteAddressTypeSchema, createAddressTypeSchema, updateAddressTypeSchema, createContactRoleSchema, getContactRoleSchema, updateContactRoleSchema, deleteContactRoleSchema } = require('../validation/masters.validation')
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
router.get('/address-types', getAllAddressTypes);
router.post('/address-types', validate(createAddressTypeSchema), createAddressType);
router.get('/address-types/:id', validate(getAddressTypeSchema), getAddressTypeById);
router.patch('/address-types/:id', validate(updateAddressTypeSchema), updateAddressType);
router.delete('/address-types/:id', validate(deleteAddressTypeSchema), deleteAddressType);

// Contact Roles
router.get('/contact-roles', getAllContactRoles);
router.post('/contact-roles', validate(createContactRoleSchema), createContactRole);
router.get('/contact-roles/:id', validate(getContactRoleSchema), getContactRoleById);
router.patch('/contact-roles/:id', validate(updateContactRoleSchema), updateContactRole);
router.delete('/contact-roles/:id', validate(deleteContactRoleSchema), deleteContactRole);

module.exports = router