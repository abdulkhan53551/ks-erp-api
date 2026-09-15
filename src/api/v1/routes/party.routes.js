const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const { getStates, getCityByState, getPyamentModes, getPyamentStatuses, getGstSlabs, getProductUnits } = require('../controllers/masters.controller');
const { getCityByStateIdValidationSchema } = require('../validation/masters.validation');
const { 
    createPartyTypeSchema, getPartyTypeSchema, updatePartyTypeSchema, deletePartyTypeSchema, 
    createPartySchema, updatePartySchema, getPartySchema, deletePartySchema, restorePartySchema, 
    bulkDeletePartiesSchema, bulkRestorePartiesSchema, createPartyContactSchema, getPartyContactSchema, 
    updatePartyContactSchema, deletePartyContactSchema, createPartyBankAccountSchema, getPartyBankAccountSchema, 
    updatePartyBankAccountSchema, deletePartyBankAccountSchema, createPartyRolesSchema, getPartyRolesSchema, 
    updatePartyRolesSchema, deletePartyRolesSchema, restorePartyRolesSchema, bulkDeletePartyRolesSchema, 
    bulkRestorePartyRolesSchema, searchPartiesSchema, getPartyDetailsSchema, createPartyBranchSchema, 
    getPartyBranchSchema, updatePartyBranchSchema, deletePartyBranchSchema, setDefaultPartyBranchSchema 
} = require('../validation/parties.validation');
const { 
    getAllPartyRoles, getPartyRolesMeta, createPartyRole, getPartyRoleById, updatePartyRole, 
    deletePartyRole, restorePartyRole, bulkDeletePartyRoles, bulkRestorePartyRoles, 
    getAllParties, createParty, getPartyById, updateParty, deleteParty, restoreParty, 
    bulkDeleteParties, bulkRestoreParties, getPartyMeta, getAllPartyContacts, getPartyContactById, 
    createPartyContact, updatePartyContact, deletePartyContact, getAllPartyBankAccounts, 
    createPartyBankAccount, getPartyBankAccountById, updatePartyBankAccount, deletePartyBankAccount, 
    searchParties, getPartyDetails, getAllPartyBranches, getPartyBranchById, createPartyBranch, 
    updatePartyBranch, deletePartyBranch, setDefaultPartyBranch 
} = require('../controllers/parties.controller');

const router = Router();

// Party Roles
router.get('/party-roles/pagination', checkPermission('parties', 'read'), getPartyRolesMeta);
router.get('/party-roles', checkPermission('parties', 'read'), getAllPartyRoles);
router.post('/party-roles/bulk-delete', checkPermission('parties', 'delete'), validate(bulkDeletePartyRolesSchema), bulkDeletePartyRoles);
router.patch('/party-roles/bulk-restore', checkPermission('parties', 'update'), validate(bulkRestorePartyRolesSchema), bulkRestorePartyRoles);
router.post('/party-roles', checkPermission('parties', 'create'), validate(createPartyRolesSchema), createPartyRole);
router.get('/party-roles/:id', checkPermission('parties', 'read'), validate(getPartyRolesSchema), getPartyRoleById);
router.patch('/party-roles/:id/restore', checkPermission('parties', 'update'), validate(restorePartyRolesSchema), restorePartyRole);
router.patch('/party-roles/:id', checkPermission('parties', 'update'), validate(updatePartyRolesSchema), updatePartyRole);
router.delete('/party-roles/:id', checkPermission('parties', 'delete'), validate(deletePartyRolesSchema), deletePartyRole);

// Party
router.get('/pagination', checkPermission('parties', 'read'), getPartyMeta);
router.get('/search', checkPermission('parties', 'read'), validate(searchPartiesSchema), searchParties);
router.get('/:partyId/details', checkPermission('parties', 'read'), validate(getPartyDetailsSchema), getPartyDetails);
router.get('/', checkPermission('parties', 'read'), getAllParties);
router.post('/', checkPermission('parties', 'create'), validate(createPartySchema), createParty);
router.post('/bulk-delete', checkPermission('parties', 'delete'), validate(bulkDeletePartiesSchema), bulkDeleteParties);
router.patch('/bulk-restore', checkPermission('parties', 'update'), validate(bulkRestorePartiesSchema), bulkRestoreParties);
router.get('/:id', checkPermission('parties', 'read'), validate(getPartySchema), getPartyById);
router.patch('/:id', checkPermission('parties', 'update'), validate(updatePartySchema), updateParty);
router.patch('/:id/restore', checkPermission('parties', 'update'), validate(restorePartySchema), restoreParty);
router.delete('/:id', checkPermission('parties', 'delete'), validate(deletePartySchema), deleteParty);

// Party Branch
router.get('/:partyId/branches', checkPermission('parties', 'read'), getAllPartyBranches);
router.post('/:partyId/branches', checkPermission('parties', 'create'), validate(createPartyBranchSchema), createPartyBranch);
router.get('/:partyId/branches/:id', checkPermission('parties', 'read'), validate(getPartyBranchSchema), getPartyBranchById);
router.patch('/:partyId/branches/:id/set-default', checkPermission('parties', 'update'), validate(setDefaultPartyBranchSchema), setDefaultPartyBranch);
router.patch('/:partyId/branches/:id', checkPermission('parties', 'update'), validate(updatePartyBranchSchema), updatePartyBranch);
router.delete('/:partyId/branches/:id', checkPermission('parties', 'delete'), validate(deletePartyBranchSchema), deletePartyBranch);

// Party Contact
router.get('/:partyId/contacts', checkPermission('parties', 'read'), getAllPartyContacts);
router.post('/:partyId/contacts', checkPermission('parties', 'create'), validate(createPartyContactSchema), createPartyContact);
router.get('/:partyId/contacts/:id', checkPermission('parties', 'read'), validate(getPartyContactSchema), getPartyContactById);
router.patch('/:partyId/contacts/:id', checkPermission('parties', 'update'), validate(updatePartyContactSchema), updatePartyContact);
router.delete('/:partyId/contacts/:id', checkPermission('parties', 'delete'), validate(deletePartyContactSchema), deletePartyContact);

// Party Bank Account
router.get('/:partyId/bank-accounts', checkPermission('parties', 'read'), getAllPartyBankAccounts);
router.post('/:partyId/bank-accounts', checkPermission('parties', 'create'), validate(createPartyBankAccountSchema), createPartyBankAccount);
router.get('/:partyId/bank-accounts/:id', checkPermission('parties', 'read'), validate(getPartyBankAccountSchema), getPartyBankAccountById);
router.patch('/:partyId/bank-accounts/:id', checkPermission('parties', 'update'), validate(updatePartyBankAccountSchema), updatePartyBankAccount);
router.delete('/:partyId/bank-accounts/:id', checkPermission('parties', 'delete'), validate(deletePartyBankAccountSchema), deletePartyBankAccount);

module.exports = router;