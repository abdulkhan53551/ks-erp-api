/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex("address_types").del();

  await knex("address_types").insert([
    { code: "BILLING", name: "Billing Address", },
    { code: "SHIPPING", name: "Shipping Address", },
    { code: "FACTORY", name: "Factory Address", },
    { code: "WAREHOUSE", name: "Warehouse Address", },
  ]);
};
