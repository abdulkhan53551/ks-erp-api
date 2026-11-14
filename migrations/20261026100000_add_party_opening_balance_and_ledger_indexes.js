/**
 * Migration: Add party opening balance columns and composite indexes for ledger queries.
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Add opening balance fields to 'parties' table
  if (await knex.schema.hasTable('parties')) {
    const hasOpeningBal = await knex.schema.hasColumn('parties', 'opening_balance');
    const hasOpeningType = await knex.schema.hasColumn('parties', 'opening_balance_type');
    const hasOpeningDate = await knex.schema.hasColumn('parties', 'opening_balance_date');

    await knex.schema.alterTable('parties', function (table) {
      if (!hasOpeningBal) {
        table.decimal('opening_balance', 14, 2).defaultTo(0.00);
      }
      if (!hasOpeningType) {
        table.string('opening_balance_type', 10).defaultTo('Dr'); // 'Dr' (Debit/Receivable) | 'Cr' (Credit/Payable)
      }
      if (!hasOpeningDate) {
        table.date('opening_balance_date').nullable();
      }
    });
  }

  // 2. High-performance composite indexes for Ledger queries
  // Invoices (Sales)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_invoices_party_ledger 
    ON invoices(party_id, invoice_date) 
    WHERE deleted_at IS NULL;
  `);

  // Payments (Receipts & Outward)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_payments_party_ledger 
    ON payments(party_id, payment_date, payment_type) 
    WHERE deleted_at IS NULL;
  `);

  // Vendor Bills (Purchases)
  if (await knex.schema.hasTable('vendor_bills')) {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_vendor_bills_party_ledger 
      ON vendor_bills(party_id, bill_date) 
      WHERE deleted_at IS NULL;
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_invoices_party_ledger');
  await knex.raw('DROP INDEX IF EXISTS idx_payments_party_ledger');
  await knex.raw('DROP INDEX IF EXISTS idx_vendor_bills_party_ledger');

  if (await knex.schema.hasTable('parties')) {
    await knex.schema.alterTable('parties', function (table) {
      table.dropColumn('opening_balance');
      table.dropColumn('opening_balance_type');
      table.dropColumn('opening_balance_date');
    });
  }
};
