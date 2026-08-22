/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Drop redundant is_invoiced column (invoice_id IS NOT NULL determines invoiced status)
    await knex.schema.alterTable('invoice_challans', function (table) {
        table.dropColumn('is_invoiced');
    });

    // 2. Add index on invoice_id for fast lookups in one-to-many relationship
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_invoice_challans_invoice_id 
        ON invoice_challans (invoice_id)
    `);

    // 3. Drop redundant composite unique constraint on (id, invoice_id) if it exists
    await knex.raw(`
        ALTER TABLE invoice_challans 
        DROP CONSTRAINT IF EXISTS unique_id_invoice
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // 1. Drop index on invoice_id
    await knex.raw(`
        DROP INDEX IF EXISTS idx_invoice_challans_invoice_id
    `);

    // 2. Re-create composite unique constraint on (id, invoice_id)
    await knex.schema.alterTable('invoice_challans', function (table) {
        table.boolean('is_invoiced').defaultTo(false);
        table.unique(['id', 'invoice_id'], {
            indexName: 'unique_id_invoice'
        });
    });
};
