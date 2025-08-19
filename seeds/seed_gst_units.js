/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  await knex.transaction(async trx => {
    await knex('item_units').del();

    await knex('item_units').insert([
      { uqc: 'PCS', description: 'Pieces', created_by: 1, updated_by: 1 },
      { uqc: 'NOS', description: 'Numbers', created_by: 1, updated_by: 1 },
      { uqc: 'KGS', description: 'Kilograms', created_by: 1, updated_by: 1 },
      { uqc: 'GMS', description: 'Grams', created_by: 1, updated_by: 1 },
      { uqc: 'LTR', description: 'Litres', created_by: 1, updated_by: 1 },
      { uqc: 'ML', description: 'Millilitres', created_by: 1, updated_by: 1 },
      { uqc: 'MTR', description: 'Meters', created_by: 1, updated_by: 1 },
      { uqc: 'CMT', description: 'Centimeters', created_by: 1, updated_by: 1 },
      { uqc: 'SQM', description: 'Square Meters', created_by: 1, updated_by: 1 },
      { uqc: 'SQF', description: 'Square Feet', created_by: 1, updated_by: 1 },
      { uqc: 'DOZ', description: 'Dozens', created_by: 1, updated_by: 1 },
      { uqc: 'BGS', description: 'Bags', created_by: 1, updated_by: 1 },
      { uqc: 'BTL', description: 'Bottles', created_by: 1, updated_by: 1 },
      { uqc: 'BOX', description: 'Box', created_by: 1, updated_by: 1 },
      { uqc: 'CAN', description: 'Cans', created_by: 1, updated_by: 1 },
      { uqc: 'CRT', description: 'Cartons', created_by: 1, updated_by: 1 },
      { uqc: 'DRM', description: 'Drums', created_by: 1, updated_by: 1 },
      { uqc: 'JAR', description: 'Jars', created_by: 1, updated_by: 1 },
      { uqc: 'PKT', description: 'Packets', created_by: 1, updated_by: 1 },
      { uqc: 'QTL', description: 'Quintals', created_by: 1, updated_by: 1 },
      { uqc: 'SET', description: 'Sets', created_by: 1, updated_by: 1 },
      { uqc: 'TBS', description: 'Tablets', created_by: 1, updated_by: 1 },
      { uqc: 'TGM', description: 'Ten Grams', created_by: 1, updated_by: 1 },
      { uqc: 'TIN', description: 'Tins', created_by: 1, updated_by: 1 },
      { uqc: 'TUB', description: 'Tubes', created_by: 1, updated_by: 1 },
      { uqc: 'ROL', description: 'Rolls', created_by: 1, updated_by: 1 },
      { uqc: 'UOM', description: 'Unit of Measurement', created_by: 1, updated_by: 1 },
      { uqc: 'MLT', description: 'Millilitre', created_by: 1, updated_by: 1 },
      { uqc: 'MGS', description: 'Milligrams', created_by: 1, updated_by: 1 },
      { uqc: 'CBM', description: 'Cubic Meter', created_by: 1, updated_by: 1 }
    ]);

  });
};
