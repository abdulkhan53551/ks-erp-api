/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (await knex.schema.hasTable('invoices')) {
        const hasCol = await knex.schema.hasColumn('invoices', 'payment_mode_id');
        if (hasCol) {
            // Drop NOT NULL constraint so unpaid/pending invoices can be created without requiring an upfront payment mode
            await knex.raw('ALTER TABLE invoices ALTER COLUMN payment_mode_id DROP NOT NULL');
            // Drop default 0 constraint because 0 does not exist in payment_modes foreign key
            await knex.raw('ALTER TABLE invoices ALTER COLUMN payment_mode_id DROP DEFAULT');
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('invoices')) {
        const hasCol = await knex.schema.hasColumn('invoices', 'payment_mode_id');
        if (hasCol) {
            await knex.raw('ALTER TABLE invoices ALTER COLUMN payment_mode_id SET DEFAULT 0');
            await knex.raw('ALTER TABLE invoices ALTER COLUMN payment_mode_id SET NOT NULL');
        }
    }
};

