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

// Fetch all address types
const fetchAllAddressTypes = async () => {
    try {
        const addressTypes = await db('address_types')
            .select('id', 'code', 'name', 'description')
            .where('is_active', true)
            .orderBy('name', 'asc');

        return addressTypes;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching address types.'
        });
    }
};

// Fetch address type pagination
const fetchAddressTypesMeta = async (query) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = ''
        } = query;

        const baseQuery = db('address_types')
            .select('id', 'code', 'name', 'description')
            .where('is_active', true);

        if (search) {
            baseQuery.where(function () {
                this.where('code', 'ILIKE', `%${search}%`)
                    .orWhere('name', 'ILIKE', `%${search}%`)
                    .orWhere('description', 'ILIKE', `%${search}%`);
            });
        }

        baseQuery.orderBy('name', 'asc');

        const result = await buildPagination({
            baseQuery,
            page,
            pageSize
        });

        return result;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching address types.'
        });
    }
};

// Fetch address type by ID
const fetchAddressTypeById = async (addressTypeId) => {
    try {
        const addressType = await db('address_types')
            .select('id', 'code', 'name', 'description')
            .where({ id: addressTypeId, is_active: true })
            .first();

        return addressType;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching address type.'
        });
    }
};

// Check if address type code already exists
const checkAddressTypeCodeExists = async (typeCode) => {
    try {
        const addressType = await db('address_types')
            .where({ code: typeCode.toUpperCase() })
            .first();

        return !!addressType;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while checking address type code.'
        });
    }
};

// Insert address type
const insertAddressType = async (addressType) => {
    try {
        const [addressTypeId] = await db('address_types')
            .insert(addressType)
            .returning('id');

        return addressTypeId?.id || addressTypeId;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating address type.'
        });
    }
};

// Update address type
const updateAddressTypeById = async (id, addressType) => {
    try {
        const updatedRows = await db('address_types')
            .where({ id, is_active: true })
            .update(addressType);

        return updatedRows ? id : null;
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new ApiError({
                statusCode: 409,
                message: 'This address type code already exists.',
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating address type data.',
        });
    }
};

// Delete address type
const deleteAddressTypeMaster = async (addressTypeId, isPermanentDelete) => {
    try {
        if (isPermanentDelete) {
            return await db('address_types')
                .where({ id: addressTypeId })
                .del();
        }

        return await db('address_types')
            .where({ id: addressTypeId })
            .update({
                is_active: false
            });

    } catch (error) {
        if (error.code === '23503') {
            throw new ApiError({
                statusCode: 409,
                message: 'Address type cannot be deleted because it is already in use.'
            });
        }

        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting address type.'
        });
    }
};


// Fetch all contact roles
const getAllContactRolesModel = async () => {
    try {
        return await db('contact_roles')
            .select(
                'id',
                'code',
                'name',
                'description',
                'is_active'
            )
            .where('is_active', true)
            .orderBy('id', 'desc');

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching contact roles.'
        });
    }
};

// Fetch contact roles with pagination and search
const fetchContactRolesMeta = async (query) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = ''
        } = query;

        const baseQuery = db('contact_roles')
            .where('is_active', true)
            .select(
                'id',
                'code',
                'name',
                'description'
            );

        if (search) {
            baseQuery.where(function () {
                this.where('code', 'ILIKE', `%${search}%`)
                    .orWhere('name', 'ILIKE', `%${search}%`)
                    .orWhere('description', 'ILIKE', `%${search}%`);
            });
        }

        baseQuery.orderBy('name', 'asc');

        const result = await buildPagination({
            baseQuery,
            page,
            pageSize
        });

        return result;

    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching contact roles.'
        });
    }
};


// Fetch contact role by ID
const getContactRoleByIdModel = async (id) => {
    try {
        const contactRole = await db('contact_roles')
            .select(
                'id',
                'code',
                'name',
                'description',
                'is_active'
            )
            .where('id', id)
            .andWhere('is_active', true)
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
    try {
        const [contactRoleId] = await db('contact_roles')
            .insert(data)
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
const deleteContactRoleMaster = async (contactRoleId, isPermanentDelete) => {
    try {
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

module.exports = {
    fetchPaymentStatuses,
    fetchPaymentModes,
    fetchGSTSlabs,
    fetchProductUnits,
    fetchStates,
    fetchCities,
    fetchAllCities,
    fetchAllAddressTypes,
    fetchAddressTypesMeta,
    fetchAddressTypeById,
    checkAddressTypeCodeExists,
    insertAddressType,
    updateAddressTypeById,
    deleteAddressTypeMaster,
    getAllContactRolesModel,
    fetchContactRolesMeta,
    getContactRoleByIdModel,
    insertContactRole,
    updateContactRoleById,
    deleteContactRoleMaster
};
