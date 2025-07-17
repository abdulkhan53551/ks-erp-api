const { db } = require("../database");

// Check if firm exists with GST
const isFirmExistWithGst = async (gstin) => {
    const exists = await db('firms')
        .where({ gstin: gstin })
        .first();
    return exists;
}

// Check if firm exists with name and phone number
const isFirmExistWithNameAndPhone = async (firmName, phoneNumber) => {
    const exists = await db('user_contacts AS UC')
        .join('firms AS F', function () {
            this.on('F.id', '=', 'UC.entity_id')
                .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
        })
        .where('F.firm_name', firmName)
        .where('UC.phone_number', phoneNumber)
        .whereNull('F.gstin')
        .first();
    return exists;
}

// Insert a new firm
const insertFirm = async (data) => {
    const query = db('firms').insert(data).returning('id');

    const [{ id }] = await query

    return id || null;
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
        .where({ id: id })
        .update({ is_active: false });

    return result > 0;
}

// Insert address for a firm
const insertAddress = async (data) => {
    const query = db('user_contacts').insert(data).returning('id');

    const [{ id }] = await query

    return id || null;
}

// Update address by entity type and ID
const updateAddressByEntity = async (entityType, entityId, addressData) => {
    const updatedCount = await db('addresses')
        .update(addressData)
        .where({ entity_type: entityType, entity_id: entityId });
    return updatedCount > 0;
};

// Delete address by ID
const deleteAddressById = async (id, isPermanentDelete) => {
    if (isPermanentDelete) {
        const result = await db('addresses')
            .where({ id: id })
            .del();

        return result > 0;
    }

    const result = await db('addresses')
        .where({ id: id })
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
const updateBankAccountByFirmId = async (firmId, bankData) => {
    return await db('bank_accounts')
        .update(bankData)
        .where({ firm_id: firmId });
};

// Delete bank account by ID
const deleteBankAccountById = async (id, isPermanentDelete) => {
    if (isPermanentDelete) {
        const result = await db('bank_accounts')
            .where({ id: id })
            .del();

        return result > 0;
    }

    const result = await db('bank_accounts')
        .where({ id: id })
        .update({ is_active: false });

    return result > 0;
}

// Create ABAC policy
const deleteAbacPolicy = async (sub, obj, act, condition) => {
    // Add policy to casbin_abac_policy table
    const query = await db('casbin_abac_policy')
        .where({ sub, obj, act })
        .andWhereRaw('conditions = ?::jsonb', [JSON.stringify(condition || {})])
        .del();

    const id = await query

    return id;
}

module.exports = {
    isFirmExistWithGst,
    isFirmExistWithNameAndPhone,
    insertFirm,
    updateFirmById,
    deleteFirmtById,
    insertAddress,
    updateAddressByEntity,
    deleteAddressById,
    insertBankAccount,
    updateBankAccountByFirmId,
    deleteBankAccountById,
    deleteAbacPolicy,
};
