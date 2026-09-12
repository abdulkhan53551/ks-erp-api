/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Safely rename address_types to address_types_archive if it exists
    const hasAddressTypes = await knex.schema.hasTable('address_types');
    const hasArchive = await knex.schema.hasTable('address_types_archive');

    if (hasAddressTypes && !hasArchive) {
        await knex.schema.renameTable('address_types', 'address_types_archive');
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasAddressTypes = await knex.schema.hasTable('address_types');
    const hasArchive = await knex.schema.hasTable('address_types_archive');

    if (hasArchive && !hasAddressTypes) {
        await knex.schema.renameTable('address_types_archive', 'address_types');
    }
};
