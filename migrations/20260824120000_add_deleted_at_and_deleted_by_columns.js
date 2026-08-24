/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const tables = [
        'parties',
        'party_addresses',
        'party_contacts',
        'party_bank_accounts',
        'party_role_mapping',
        'invoices',
        'invoice_items',
        'invoice_contacts',
        'purchase_order_invoices',
        'invoice_challans',
        'eway_bills',
        'purchase_orders',
        'party_roles',
        'contact_roles',
        'address_types'
    ];

    for (const tableName of tables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            await knex.schema.alterTable(tableName, (table) => {
                table.timestamp('deleted_at').nullable();
                table.integer('deleted_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
            });
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const tables = [
        'parties',
        'party_addresses',
        'party_contacts',
        'party_bank_accounts',
        'party_role_mapping',
        'invoices',
        'invoice_items',
        'invoice_contacts',
        'purchase_order_invoices',
        'invoice_challans',
        'eway_bills',
        'purchase_orders',
        'party_roles',
        'contact_roles',
        'address_types'
    ];

    for (const tableName of tables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            await knex.schema.alterTable(tableName, (table) => {
                table.dropColumn('deleted_by');
                table.dropColumn('deleted_at');
            });
        }
    }
};
