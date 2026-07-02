/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex("state").del();

  // Insert fresh data
  await knex("state").insert([
    { id: 1, name: "ANDHRA PRADESH", created_by: 1, updated_by: 1 },
    { id: 2, name: "ASSAM", created_by: 1, updated_by: 1 },
    { id: 3, name: "ARUNACHAL PRADESH", created_by: 1, updated_by: 1 },
    { id: 4, name: "BIHAR", created_by: 1, updated_by: 1 },
    { id: 5, name: "GUJRAT", created_by: 1, updated_by: 1 },
    { id: 6, name: "HARYANA", created_by: 1, updated_by: 1 },
    { id: 7, name: "HIMACHAL PRADESH", created_by: 1, updated_by: 1 },
    { id: 8, name: "JAMMU & KASHMIR", created_by: 1, updated_by: 1 },
    { id: 9, name: "KARNATAKA", created_by: 1, updated_by: 1 },
    { id: 10, name: "KERALA", created_by: 1, updated_by: 1 },
    { id: 11, name: "MADHYA PRADESH", created_by: 1, updated_by: 1 },
    { id: 12, name: "MAHARASHTRA", created_by: 1, updated_by: 1 },
    { id: 13, name: "MANIPUR", created_by: 1, updated_by: 1 },
    { id: 14, name: "MEGHALAYA", created_by: 1, updated_by: 1 },
    { id: 15, name: "MIZORAM", created_by: 1, updated_by: 1 },
    { id: 16, name: "NAGALAND", created_by: 1, updated_by: 1 },
    { id: 17, name: "ORISSA", created_by: 1, updated_by: 1 },
    { id: 18, name: "PUNJAB", created_by: 1, updated_by: 1 },
    { id: 19, name: "RAJASTHAN", created_by: 1, updated_by: 1 },
    { id: 20, name: "SIKKIM", created_by: 1, updated_by: 1 },
    { id: 21, name: "TAMIL NADU", created_by: 1, updated_by: 1 },
    { id: 22, name: "TRIPURA", created_by: 1, updated_by: 1 },
    { id: 23, name: "UTTAR PRADESH", created_by: 1, updated_by: 1 },
    { id: 24, name: "WEST BENGAL", created_by: 1, updated_by: 1 },
    { id: 25, name: "DELHI", created_by: 1, updated_by: 1 },
    { id: 26, name: "GOA", created_by: 1, updated_by: 1 },
    { id: 27, name: "PONDICHERY", created_by: 1, updated_by: 1 },
    { id: 28, name: "LAKSHDWEEP", created_by: 1, updated_by: 1 },
    { id: 29, name: "DAMAN & DIU", created_by: 1, updated_by: 1 },
    { id: 30, name: "DADRA & NAGAR", created_by: 1, updated_by: 1 },
    { id: 31, name: "CHANDIGARH", created_by: 1, updated_by: 1 },
    { id: 32, name: "ANDAMAN & NICOBAR", created_by: 1, updated_by: 1 },
    { id: 33, name: "UTTARANCHAL", created_by: 1, updated_by: 1 },
    { id: 34, name: "JHARKHAND", created_by: 1, updated_by: 1 },
    { id: 35, name: "CHATTISGARH", created_by: 1, updated_by: 1 }
  ]);
};
