/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('payment_statuses').del();
  await knex('payment_statuses').insert([
    { code: 'PENDING', label: 'Pending', created_by: 1, updated_by: 1 },
    { code: 'PAID', label: 'Paid', created_by: 1, updated_by: 1 },
    { code: 'PARTIAL', label: 'Partially Paid', created_by: 1, updated_by: 1 },
    { code: 'FAILED', label: 'Failed', created_by: 1, updated_by: 1 },
    { code: 'CANCELLED', label: 'Cancelled', created_by: 1, updated_by: 1 },
    { code: 'REFUNDED', label: 'Refunded', created_by: 1, updated_by: 1 },
  ]);
};
