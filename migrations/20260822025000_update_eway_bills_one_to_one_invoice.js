/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Drop redundant is_invoiced column (invoice_id IS NOT NULL determines invoiced status)
    await knex.schema.alterTable('eway_bills', function (table) {
        table.dropColumn('is_invoiced');
    });

    // 2. Add UNIQUE constraint on invoice_id to enforce strict 1:1 relationship
    // (In PostgreSQL, UNIQUE allows multiple NULL values while ensuring non-null invoice_id is unique)
    await knex.raw(`
        ALTER TABLE eway_bills 
        ADD CONSTRAINT unique_eway_bills_invoice_id UNIQUE (invoice_id)
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // 1. Drop UNIQUE constraint on invoice_id
    await knex.raw(`
        ALTER TABLE eway_bills 
        DROP CONSTRAINT IF EXISTS unique_eway_bills_invoice_id
    `);

    // 2. Re-add is_invoiced column
    await knex.schema.alterTable('eway_bills', function (table) {
        table.boolean('is_invoiced').defaultTo(false);
    });
};
