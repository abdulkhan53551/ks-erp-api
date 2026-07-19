const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { getContext } = require("../helpers/requestContext");

// Fetch all firms with their addresses and bank accounts
const fetchAllFirm = async (query) => {
    const { page = 1, pageSize = 10, search = '' } = query;
    const { userId = 0 } = getContext();

    const baseQuery = db('firms AS F')
        .select(
            'F.id as firm_id',
            'F.logo_url',
            'F.firm_name',
            'F.trade_name',
            'F.gstin',
            'F.firm_type',
            'C.name AS city',
            'S.name AS state',
            'UC.pincode',
            'UC.phone_number',
            'FBA.account_number',
            'FBA.ifsc_code',
            'FBA.bank_name',
            'FBA.branch_name',
            db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS created_by`),
            'F.created_at',
            'F.updated_at',
        )
        .join('user_contacts AS UC', function () {
            this.on('F.id', '=', 'UC.entity_id')
                .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
        })
        .leftJoin('firm_bank_accounts AS FBA', 'F.id', 'FBA.firm_id')
        .leftJoin('city AS C', 'UC.city_id', 'C.id')
        .leftJoin('state AS S', 'UC.state_id', 'S.id')
        .leftJoin('users AS u', 'F.created_by', 'u.id')
        .where('F.is_active', true)
        .andWhere('F.created_by', userId)  // Show only firms created by the user

    // if (search) {
    //     baseQuery.andWhere('f.firm_name', 'ilike', `%${search}%`);
    // }

    baseQuery.orderBy('F.id', 'desc');

    const firms = await fetchPageData({ baseQuery, page, pageSize });

    return firms;
}

// Fetch firm meta data for pagination
const fetchFirmMeta = async (query) => {
    const { page = 1, pageSize = 10, search = '' } = query;
    const { userId = 0 } = getContext();

    const baseQuery = db('firms AS F')
        .join('user_contacts AS UC', function () {
            this.on('F.id', '=', 'UC.entity_id')
                .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
        })
        .leftJoin('firm_bank_accounts AS FBA', 'F.id', 'FBA.firm_id')
        .where('F.is_active', true)
        .andWhere('F.created_by', userId)

    // if (search) {
    //     baseQuery.andWhere('f.firm_name', 'ilike', `%${search}%`);
    // }

    const result = await buildPagination({ baseQuery, page, pageSize });

    return result;
}

// Check if firm exists with GSTIN
const fetchFirmById = async (id = 0) => {
    const query = db('firms AS F')
        .select(
            'F.id as firm_id',
            'F.firm_name',
            'F.trade_name',
            'F.logo_url',
            'F.gstin',
            'F.firm_type',
            'F.business_activity',
            'F.pan_number',
            'F.cin_number',
            'F.tan_number',
            'F.invoice_prefix',
            'F.invoice_start_number',
            'F.notes_footer',
            'UC.id as firm_address_id',
            'UC.email',
            'UC.phone_number',
            'UC.website',
            'UC.address_line1',
            'UC.city_id',
            'UC.state_id',
            'UC.pincode',
            'FBA.id as firm_bank_account_id',
            'FBA.upi_id',
            'FBA.account_holder_name',
            'FBA.account_number',
            'FBA.ifsc_code',
            'FBA.bank_name',
            'FBA.branch_name',
            'FBA.account_type'
        )
        .leftJoin('user_contacts AS UC', function () {
            this.on('F.id', '=', 'UC.entity_id')
                .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
        })
        .leftJoin('firm_bank_accounts AS FBA', 'F.id', 'FBA.firm_id')
        .where('F.id', id)
        .first();

    const exists = await query
    return exists;
};

// Check if firm exists with GSTIN
const isFirmExistWithGst = async (gstin, firmId = 0) => {
    const query = db('firms').where({ gstin, is_active: true });

    if (firmId) {
        query.andWhereNot('id', firmId); // exclude this firmId if provided
    }

    const exists = await query.first();
    return exists;
};

// Check if firm exists with name and phone number
const isFirmExistWithNameAndPhone = async (firmName, phoneNumber, firmId = 0) => {
    const query = db('user_contacts AS UC')
        .join('firms AS F', function () {
            this.on('F.id', '=', 'UC.entity_id')
                .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
        })
        .where('F.firm_name', firmName)
        .where('UC.phone_number', phoneNumber)
        .where('F.is_active', true)
        .whereNull('F.gstin');

    if (firmId) {
        query.andWhereNot('F.id', firmId); // Exclude firmId if provided
    }

    const exists = await query.first();
    return exists;
};


// Insert a new firm
const insertFirm = async (data) => {
    try {
        const query = db('firms').insert(data).returning('id');
        const [{ id }] = await query
        return id || null;
    } catch (error) {
        throw new Error('Failed to fetch firms');
    }
}

// Update firm by ID
const updateFirmById = async (id, data) => {
    const updatedCount = await db('firms').update(data).where({ id });
    return updatedCount > 0; // true if update was successful
};

// Delete firm by ID
const deleteFirmtById = async (id, isPermanentDelete) => {
    if (isPermanentDelete) {
        const result = await db('firms')
            .where({ id: id })
            .del();
        return result > 0;
    }

    const result = await db('firms')
        .update({ is_active: false })
        .where({ id: id });
    return result > 0;
}

// Insert address for a firm
const insertAddress = async (data) => {
    const query = db('user_contacts').insert(data).returning('id');
    const [{ id }] = await query
    return id || null;
}

// Update address by entity type and ID
const updateAddressByEntity = async (id, addressData) => {
    const updatedCount = await db('user_contacts')
        .update(addressData)
        .where({ id: id });
    return updatedCount > 0;
};

// Delete address by ID
const deleteAddressByFirmId = async (firmId, isPermanentDelete) => {
    if (isPermanentDelete) {
        const result = await db('user_contacts')
            .where({ entity_type: 'firm', entity_id: firmId })
            .del();
        return result > 0;
    }

    const result = await db('user_contacts')
        .where({ entity_type: 'firm', entity_id: firmId })
        .update({ is_active: false });
    return result > 0;
}

// Insert bank account for a firm
const insertBankAccount = async (data) => {
    const query = db('firm_bank_accounts').insert(data).returning('id');
    const [{ id }] = await query
    return id || null;
}

// Update bank account by firm ID
const updateBankAccountByFirmId = async (id, bankData) => {
    return await db('firm_bank_accounts')
        .update(bankData)
        .where({ id: id });
};

// Delete bank account by ID
const deleteBankAccountByFirmId = async (firmId, isPermanentDelete) => {
    if (isPermanentDelete) {
        const result = await db('firm_bank_accounts')
            .where({ firm_id: firmId })
            .del();

        return result > 0;
    }

    const result = await db('firm_bank_accounts')
        .where({ firm_id: firmId })
        .update({ is_active: false });

    return result > 0;
}

// Fetch firm types from the database
const fetchFirmTypes = async () => {
    const enumLabels = await db('pg_enum as e')
        .select('e.enumlabel')
        .join('pg_type as t', 't.oid', 'e.enumtypid')
        .where('t.typname', 'entity_type_enum');

    const values = enumLabels.map(row => row.enumlabel);

    return values;
}

module.exports = {
    fetchAllFirm,
    fetchFirmMeta,
    fetchFirmById,
    isFirmExistWithGst,
    isFirmExistWithNameAndPhone,
    insertFirm,
    updateFirmById,
    deleteFirmtById,
    insertAddress,
    updateAddressByEntity,
    deleteAddressByFirmId,
    insertBankAccount,
    updateBankAccountByFirmId,
    deleteBankAccountByFirmId,
    fetchFirmTypes
};
