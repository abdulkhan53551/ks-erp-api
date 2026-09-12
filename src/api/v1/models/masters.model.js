const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { ApiError } = require("../services/ApiError");

// Fetch payment statuses
const fetchPaymentStatuses = async () => {
    try {
        const paymentStatus = await db('payment_statuses')
            .select('id', 'code', 'label')
            .where({ is_active: true })
            .orderBy('code', 'asc');

        return paymentStatus;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching payment status.',
        });
    }
};

// Fetch payment modes
const fetchPaymentModes = async () => {
    try {
        const paymentMode = await db('payment_modes')
            .select('id', 'code', 'label')
            .where({ is_active: true })
            .orderBy('code', 'asc');

        return paymentMode;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching payment modes.',
        });
    }
};

// Fetch GST slabs
const fetchGSTSlabs = async () => {
    try {
        const gstSlab = await db('gst_slabs')
            .select('id', 'gst_rate', 'description', 'cgst_rate', 'sgst_rate', 'igst_rate')
            .where({ is_active: true })
            .orderBy('gst_rate', 'asc');

        return gstSlab;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching gst slabs.',
        });
    }
};

// Fetch item units
const fetchProductUnits = async () => {
    try {
        // Note: Maps to `item_units` table in DB
        const productUnit = await db('item_units')
            .select('id', 'uqc', 'description')
            .where({ is_active: true })
            .orderBy('uqc', 'asc');

        return productUnit;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching product units.',
        });
    }
};

// Fetch all states
const fetchStates = async () => {
    try {
        const states = await db('state')
            .select('id', 'name')
            .where({ is_active: true })
            .orderBy('name', 'asc');

        return states;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching states.',
        });
    }
};

// Fetch cities by state ID
const fetchCities = async (stateId) => {
    try {
        const cities = await db('city')
            .select('id', 'name')
            .where({ state_id: stateId, is_active: true })
            .orderBy('name', 'asc');

        return cities;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching cities of given state.',
        });
    }
};

// Fetch all cities
const fetchAllCities = async (stateId) => {
    try {
        const cities = await db('city')
            .select('id', 'name')
            .where({ is_active: true })
            .orderBy('name', 'asc');

        return cities;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching cities.',
        });
    }
};



// Fetch all contact roles
const getAllContactRolesModel = async (query = {}) => {
    try {
        const { page = 1, pageSize = 10, search = '', trash = false } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('contact_roles AS cr')
            .select(
                'cr.id',
                'cr.code',
                'cr.name',
                'cr.description',
                'cr.is_active',
                'cr.created_at',
                'cr.updated_at',
                'cr.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('users AS du', 'cr.deleted_by', 'du.id')
            .where('cr.is_active', !isTrash);

        if (search) {
            baseQuery.where(function () {
                this.where('cr.code', 'ILIKE', `%${search}%`)
                    .orWhere('cr.name', 'ILIKE', `%${search}%`)
                    .orWhere('cr.description', 'ILIKE', `%${search}%`);
            });
        }

        if (isTrash) {
            baseQuery.orderBy('cr.deleted_at', 'desc');
        } else {
            baseQuery.orderBy('cr.name', 'asc');
        }

        return await fetchPageData({ baseQuery, page, pageSize });

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching contact roles.'
        });
    }
};

// Fetch contact roles with pagination and search
const fetchContactRolesMeta = async (query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            trash = false
        } = query;
        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('contact_roles AS cr')
            .where('cr.is_active', !isTrash);

        if (search) {
            baseQuery.where(function () {
                this.where('cr.code', 'ILIKE', `%${search}%`)
                    .orWhere('cr.name', 'ILIKE', `%${search}%`)
                    .orWhere('cr.description', 'ILIKE', `%${search}%`);
            });
        }

        const result = await buildPagination({
            baseQuery,
            page,
            pageSize
        });

        return result;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching contact roles meta data.'
        });
    }
};

// Fetch contact role by ID
const getContactRoleByIdModel = async (id) => {
    try {
        const contactRole = await db('contact_roles AS cr')
            .select(
                'cr.id',
                'cr.code',
                'cr.name',
                'cr.description',
                'cr.is_active',
                'cr.created_at',
                'cr.updated_at',
                'cr.deleted_at',
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by`)
            )
            .leftJoin('users AS du', 'cr.deleted_by', 'du.id')
            .where({ 'cr.id': id, 'cr.is_active': true })
            .first();

        return contactRole || null;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching contact role.'
        });
    }
};

// Insert contact role
const insertContactRole = async (data) => {
    // Check if code already exists in active or trash
    const existing = await db('contact_roles')
        .select('id', 'code', 'is_active')
        .where('code', data.code.toUpperCase())
        .first();

    if (existing) {
        if (existing.is_active) {
            throw new ApiError({
                statusCode: 409,
                message: `Contact role code '${data.code}' already exists.`
            });
        } else {
            throw new ApiError({
                statusCode: 409,
                message: `Contact role code '${data.code}' is currently in the Trash. Please restore it from the Recycle Bin or use a different code.`
            });
        }
    }

    try {
        const [contactRoleId] = await db('contact_roles')
            .insert(data)
            .returning('id');

        return contactRoleId?.id || contactRoleId;

    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This contact role already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating contact role.'
        });
    }
};

// Update contact role by ID
const updateContactRoleById = async (id, data) => {
    try {
        const [contactRoleId] = await db('contact_roles')
            .where({ id, is_active: true })
            .update(data)
            .returning('id');

        return contactRoleId?.id || contactRoleId;

    } catch (error) {
        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'This contact role already exists.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating contact role.'
        });
    }
};

// Delete contact role by ID
const deleteContactRoleMaster = async (contactRoleId, isPermanentDelete = false) => {
    try {
        const activeUsage = await db('party_contacts as pc')
            .join('parties as p', 'pc.party_id', 'p.id')
            .where('pc.contact_role_id', contactRoleId)
            .andWhere('pc.is_active', true)
            .andWhere('p.is_active', true)
            .first();

        if (activeUsage) {
            throw new ApiError({
                statusCode: 409,
                message: 'Cannot delete Contact Role because it is in use by active contacts.'
            });
        }

        if (isPermanentDelete) {
            return await db('contact_roles')
                .where({ id: contactRoleId })
                .del();
        }

        return await db('contact_roles')
            .where({ id: contactRoleId })
            .update({
                is_active: false
            });

    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Contact role cannot be deleted because it is already in use.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting contact role.'
        });
    }
};

// Bulk delete contact roles
const bulkDeleteContactRoles = async (contactRoleIds = [], isPermanentDelete = false) => {
    if (!contactRoleIds.length) return 0;
    try {
        const activeUsage = await db('party_contacts as pc')
            .join('parties as p', 'pc.party_id', 'p.id')
            .join('contact_roles as cr', 'pc.contact_role_id', 'cr.id')
            .select('cr.name')
            .whereIn('pc.contact_role_id', contactRoleIds)
            .andWhere('pc.is_active', true)
            .andWhere('p.is_active', true)
            .first();

        if (activeUsage) {
            throw new ApiError({
                statusCode: 409,
                message: `Cannot delete Contact Role '${activeUsage.name}' because it is in use by active contacts.`
            });
        }

        if (isPermanentDelete) {
            return await db('contact_roles').whereIn('id', contactRoleIds).del();
        }

        return await db('contact_roles')
            .whereIn('id', contactRoleIds)
            .update({ is_active: false });
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting contact roles.'
        });
    }
};

// Restore contact role by ID
const restoreContactRoleById = async (contactRoleId) => {
    try {
        const role = await db('contact_roles')
            .where({ id: contactRoleId, is_active: false })
            .first();

        if (!role) {
            throw new ApiError({
                statusCode: 404,
                message: 'Contact role not found in Trash or already active.'
            });
        }

        const affectedRows = await db('contact_roles')
            .where({ id: contactRoleId })
            .update({ is_active: true });

        return affectedRows > 0;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring contact role.'
        });
    }
};

// Bulk restore contact roles
const bulkRestoreContactRoles = async (contactRoleIds = []) => {
    if (!contactRoleIds.length) return 0;
    try {
        const affectedRows = await db('contact_roles')
            .whereIn('id', contactRoleIds)
            .andWhere({ is_active: false })
            .update({ is_active: true });

        return affectedRows;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring contact roles.'
        });
    }
};

module.exports = {
    fetchPaymentStatuses,
    fetchPaymentModes,
    fetchGSTSlabs,
    fetchProductUnits,
    fetchStates,
    fetchCities,
    fetchAllCities,
    getAllContactRolesModel,
    fetchContactRolesMeta,
    getContactRoleByIdModel,
    insertContactRole,
    updateContactRoleById,
    deleteContactRoleMaster,
    bulkDeleteContactRoles,
    restoreContactRoleById,
    bulkRestoreContactRoles
};
