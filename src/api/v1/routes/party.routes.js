const { Router } = require('express')
const validate = require('../middlewares/validate')
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits } = require('../controllers/masters.controller')
const { getCityByStateIdValidationSchema } = require('../validation/masters.validation')
const { createPartyTypeSchema, getPartyTypeSchema, updatePartyTypeSchema, deletePartyTypeSchema, createPartySchema, updatePartySchema, getPartySchema, deletePartySchema, restorePartySchema, bulkDeletePartiesSchema, bulkRestorePartiesSchema, createPartyContactSchema, getPartyContactSchema, updatePartyContactSchema, deletePartyContactSchema, createPartyBankAccountSchema, getPartyBankAccountSchema, updatePartyBankAccountSchema, deletePartyBankAccountSchema, createPartyRolesSchema, getPartyRolesSchema, updatePartyRolesSchema, deletePartyRolesSchema, restorePartyRolesSchema, bulkDeletePartyRolesSchema, bulkRestorePartyRolesSchema, searchPartiesSchema, getPartyDetailsSchema, createPartyBranchSchema, getPartyBranchSchema, updatePartyBranchSchema, deletePartyBranchSchema, setDefaultPartyBranchSchema } = require('../validation/parties.validation')
const { getAllPartyRoles, getPartyRolesMeta, createPartyRole, getPartyRoleById, updatePartyRole, deletePartyRole, restorePartyRole, bulkDeletePartyRoles, bulkRestorePartyRoles, getAllParties, createParty, getPartyById, updateParty, deleteParty, restoreParty, bulkDeleteParties, bulkRestoreParties, getPartyMeta, getAllPartyContacts, getPartyContactById, createPartyContact, updatePartyContact, deletePartyContact, getAllPartyBankAccounts, createPartyBankAccount, getPartyBankAccountById, updatePartyBankAccount, deletePartyBankAccount, searchParties, getPartyDetails, getAllPartyBranches, getPartyBranchById, createPartyBranch, updatePartyBranch, deletePartyBranch, setDefaultPartyBranch } = require('../controllers/parties.controller')
const router = Router()

// Party Roles
router.get('/party-roles/pagination', getPartyRolesMeta);
router.get('/party-roles', getAllPartyRoles);
router.post('/party-roles/bulk-delete', validate(bulkDeletePartyRolesSchema), bulkDeletePartyRoles);
router.patch('/party-roles/bulk-restore', validate(bulkRestorePartyRolesSchema), bulkRestorePartyRoles);
router.post('/party-roles', validate(createPartyRolesSchema), createPartyRole);
router.get('/party-roles/:id', validate(getPartyRolesSchema), getPartyRoleById);
router.patch('/party-roles/:id/restore', validate(restorePartyRolesSchema), restorePartyRole);
router.patch('/party-roles/:id', validate(updatePartyRolesSchema), updatePartyRole);
router.delete('/party-roles/:id', validate(deletePartyRolesSchema), deletePartyRole);

// Party
router.get('/pagination', getPartyMeta);
router.get('/search', validate(searchPartiesSchema), searchParties);
router.get('/:partyId/details', validate(getPartyDetailsSchema),getPartyDetails);
router.get('/', getAllParties);
router.post('/', validate(createPartySchema), createParty);
router.post('/bulk-delete', validate(bulkDeletePartiesSchema), bulkDeleteParties);
router.patch('/bulk-restore', validate(bulkRestorePartiesSchema), bulkRestoreParties);
router.get('/:id', validate(getPartySchema), getPartyById);
router.patch('/:id', validate(updatePartySchema), updateParty);
router.patch('/:id/restore', validate(restorePartySchema), restoreParty);
router.delete('/:id', validate(deletePartySchema), deleteParty);

// Party Branch
router.get('/:partyId/branches', getAllPartyBranches);
router.post('/:partyId/branches', validate(createPartyBranchSchema), createPartyBranch);
router.get('/:partyId/branches/:id', validate(getPartyBranchSchema), getPartyBranchById);
router.patch('/:partyId/branches/:id/set-default', validate(setDefaultPartyBranchSchema), setDefaultPartyBranch);
router.patch('/:partyId/branches/:id', validate(updatePartyBranchSchema), updatePartyBranch);
router.delete('/:partyId/branches/:id', validate(deletePartyBranchSchema), deletePartyBranch);

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

module.exports = router