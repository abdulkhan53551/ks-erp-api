/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('payment_modes').del()
  await knex('payment_modes').insert([
    { code: 'CASH', label: 'Cash', created_by: 1, updated_by: 1 },
    { code: 'UPI', label: 'UPI / QR Code', created_by: 1, updated_by: 1 },
    { code: 'NEFT', label: 'Bank Transfer (NEFT/IMPS/RTGS)', created_by: 1, updated_by: 1 },
    { code: 'CHEQUE', label: 'Cheque', created_by: 1, updated_by: 1 },
    { code: 'CARD', label: 'Credit/Debit Card', created_by: 1, updated_by: 1 },
    { code: 'NB', label: 'Net Banking', created_by: 1, updated_by: 1 },
    { code: 'WALLET', label: 'Wallet (PhonePe/Paytm/etc)', created_by: 1, updated_by: 1 },
    { code: 'OTHERS', label: 'Other', created_by: 1, updated_by: 1 },
  ]);
};
