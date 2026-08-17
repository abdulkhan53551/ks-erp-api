const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits } = require('../controllers/masters.controller')
const { getCityByStateIdValidationSchema } = require('../validation/masters.validation')
const { createPartyTypeSchema, getPartyTypeSchema, updatePartyTypeSchema, deletePartyTypeSchema, createPartySchema, updatePartySchema, getPartySchema, deletePartySchema, createPartyAddressSchema, getPartyAddressSchema, updatePartyAddressSchema, deletePartyAddressSchema, createPartyContactSchema, getPartyContactSchema, updatePartyContactSchema, deletePartyContactSchema, createPartyBankAccountSchema, getPartyBankAccountSchema, updatePartyBankAccountSchema, deletePartyBankAccountSchema, createPartyRolesSchema, getPartyRolesSchema, updatePartyRolesSchema, deletePartyRolesSchema, insertPartyRoleMappingsSchema, getPartyRolesMappingSchema, searchPartiesSchema, getPartyDetailsSchema } = require('../validation/parties.validation')
const { getAllPartyRoles, createPartyRole, getPartyRoleById, updatePartyRole, deletePartyRole, getAllParties, createParty, getPartyById, updateParty, deleteParty, getPartyMeta, getAllPartyAddresses, createPartyAddress, getPartyAddressById, updatePartyAddress, deletePartyAddress, getAllPartyContacts, getPartyContactById, createPartyContact, updatePartyContact, deletePartyContact, getAllPartyBankAccounts, createPartyBankAccount, getPartyBankAccountById, updatePartyBankAccount, deletePartyBankAccount, createPartyRoleMapping, getPartyRoles, getPartyRoleMapping, searchParties, getPartyDetails } = require('../controllers/parties.controller')
const router = Router()

// Party Roles
router.get('/party-roles', getAllPartyRoles);
router.post('/party-roles', validate(createPartyRolesSchema), createPartyRole);
router.get('/party-roles/:id', validate(getPartyRolesSchema), getPartyRoleById);
router.patch('/party-roles/:id', validate(updatePartyRolesSchema), updatePartyRole);
router.delete('/party-roles/:id', validate(deletePartyRolesSchema), deletePartyRole);

// Party
router.get('/pagination', getPartyMeta);
router.get('/search', validate(searchPartiesSchema), searchParties);
router.get('/:partyId/details', validate(getPartyDetailsSchema),getPartyDetails);
router.get('/', getAllParties);
router.post('/', validate(createPartySchema), createParty);
router.get('/:id', validate(getPartySchema), getPartyById);
router.patch('/:id', validate(updatePartySchema), updateParty);
router.delete('/:id', validate(deletePartySchema), deleteParty);

// Party Address
router.get('/:partyId/addresses', getAllPartyAddresses);
router.post('/:partyId/addresses', validate(createPartyAddressSchema), createPartyAddress);
router.get('/:partyId/addresses/:id', validate(getPartyAddressSchema), getPartyAddressById);
router.patch('/:partyId/addresses/:id', validate(updatePartyAddressSchema), updatePartyAddress);
router.delete('/:partyId/addresses/:id', validate(deletePartyAddressSchema), deletePartyAddress);

// Party Contact
router.get('/:partyId/contacts', getAllPartyContacts);
router.post('/:partyId/contacts', validate(createPartyContactSchema), createPartyContact);
router.get('/:partyId/contacts/:id', validate(getPartyContactSchema), getPartyContactById);
router.patch('/:partyId/contacts/:id', validate(updatePartyContactSchema), updatePartyContact);
router.delete('/:partyId/contacts/:id', validate(deletePartyContactSchema), deletePartyContact);

// Party Bank Account
router.get('/:partyId/bank-accounts', getAllPartyBankAccounts);
router.post('/:partyId/bank-accounts', validate(createPartyBankAccountSchema), createPartyBankAccount);
router.get('/:partyId/bank-accounts/:id', validate(getPartyBankAccountSchema), getPartyBankAccountById);
router.patch('/:partyId/bank-accounts/:id', validate(updatePartyBankAccountSchema), updatePartyBankAccount);
router.delete('/:partyId/bank-accounts/:id', validate(deletePartyBankAccountSchema), deletePartyBankAccount);

// Party Role Mapping
router.get('/:partyId/roles', validate(getPartyRolesMappingSchema), getPartyRoleMapping);
router.patch('/:partyId/roles', validate(insertPartyRoleMappingsSchema), createPartyRoleMapping);


module.exports = router