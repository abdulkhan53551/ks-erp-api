/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  try {
    const data = [
      // GOODS
      {
        description: '0% GST on essential goods (e.g., salt, unbranded food grains)',
        gst_rate: 0.00,
        cgst_rate: 0.00,
        sgst_rate: 0.00,
        igst_rate: 0.00,
        cess_rate: 0.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      },
      {
        description: '5% GST on essential goods (e.g., footwear, edible oil)',
        gst_rate: 5.00,
        cgst_rate: 2.50,
        sgst_rate: 2.50,
        igst_rate: 5.00,
        cess_rate: 0.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      },
      {
        description: '12% GST on processed food, tooth powder, etc.',
        gst_rate: 12.00,
        cgst_rate: 6.00,
        sgst_rate: 6.00,
        igst_rate: 12.00,
        cess_rate: 0.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      },
      {
        description: '18% GST on general goods (e.g., computer parts, furniture)',
        gst_rate: 18.00,
        cgst_rate: 9.00,
        sgst_rate: 9.00,
        igst_rate: 18.00,
        cess_rate: 0.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      },
      {
        description: '28% GST on luxury/sin goods (e.g., AC, refrigerator)',
        gst_rate: 28.00,
        cgst_rate: 14.00,
        sgst_rate: 14.00,
        igst_rate: 28.00,
        cess_rate: 0.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      },

      // GOODS WITH CESS
      {
        description: '28% GST + 15% cess on luxury cars',
        gst_rate: 28.00,
        cgst_rate: 14.00,
        sgst_rate: 14.00,
        igst_rate: 28.00,
        cess_rate: 15.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      },
      {
        description: '28% GST + 12% cess on aerated drinks',
        gst_rate: 28.00,
        cgst_rate: 14.00,
        sgst_rate: 14.00,
        igst_rate: 28.00,
        cess_rate: 12.00,
        is_service: false,
        effective_from: '2017-07-01',
        effective_to: null,
        created_by: 1,
        updated_by: 1
      }
    ]

    await knex.transaction(async trx => {
      // Step 1: Clear the table (if you want a clean slate)
      await trx('gst_slabs').del();

      // Step 2: Insert data
      await trx('gst_slabs').insert(data);

      console.log('✅ GST slabs seeded successfully.');
    });
  } catch (err) {
    console.error('❌ Failed to seed gst slabs:', err.message);
  }
};
