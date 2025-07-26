/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('invoice_items', function (table) {
        table.increments('id').primary();
        table.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE');

        table.string('description').notNullable(); // Item name or description
        table.string('hsn_sac_code').nullable();
        table.decimal('qty', 12, 2).notNullable();
        table.integer('gst_unit_id').unsigned().references('id').inTable('gst_units').onDelete('SET NULL'); // Nos, pcs, kg, etc.
        table.decimal('rate', 12, 2).notNullable();
        table.decimal('discount_percent', 5, 2).defaultTo(0); // per-item %
        table.decimal('discount_amount', 12, 2).defaultTo(0); // optional

        table.decimal('taxable_amount', 12, 2).notNullable();
        // 🔽 Add this line to link to gst_slabs
        table.integer('gst_slab_id').unsigned().notNullable().references('id').inTable('gst_slabs').onDelete('RESTRICT');
        table.decimal('cgst', 12, 2).defaultTo(0);
        table.decimal('sgst', 12, 2).defaultTo(0);
        table.decimal('igst', 12, 2).defaultTo(0);
        table.decimal('total', 12, 2).notNullable();

        table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true); // adds created_at and updated_at
        table.boolean('is_active').notNullable().defaultTo(true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    return knex.schema.dropTableIfExists('invoice_items');
};
