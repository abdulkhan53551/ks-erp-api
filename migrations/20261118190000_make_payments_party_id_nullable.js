/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (await knex.schema.hasTable('payments')) {
        const hasPartyId = await knex.schema.hasColumn('payments', 'party_id');
        if (hasPartyId) {
            // Drop NOT NULL constraint so direct walk-in / unlinked invoices can be settled
            await knex.raw('ALTER TABLE payments ALTER COLUMN party_id DROP NOT NULL');
        }

        const hasCustomerName = await knex.schema.hasColumn('payments', 'customer_name');
        if (!hasCustomerName) {
            // Add customer_name snapshot for direct walk-in customer receipts (no index per instruction)
            await knex.schema.alterTable('payments', function (table) {
                table.string('customer_name', 255).nullable();
            });
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('payments')) {
        const hasCustomerName = await knex.schema.hasColumn('payments', 'customer_name');
        if (hasCustomerName) {
            await knex.schema.alterTable('payments', function (table) {
                table.dropColumn('customer_name');
            });
        }

        const hasPartyId = await knex.schema.hasColumn('payments', 'party_id');
        if (hasPartyId) {
            await knex.raw('ALTER TABLE payments ALTER COLUMN party_id SET NOT NULL');
        }
    }
};
