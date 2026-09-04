/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Add address columns to party_branches
    if (await knex.schema.hasTable('party_branches')) {
        await knex.schema.alterTable('party_branches', function (table) {
            table.string('address', 500).nullable();
            table.integer('city_id').nullable().references('id').inTable('city').onDelete('SET NULL');
            table.string('pincode', 10).nullable();
            table.string('country', 50).defaultTo('India');
        });
    }

    // 2. Safe Backfill: Copy address data from party_addresses into party_branches
    if (await knex.schema.hasTable('party_addresses')) {
        // A. Copy where branch_id is explicitly set, prioritizing BILLING address (address_type_id = 1)
        await knex.raw(`
            UPDATE party_branches pb
            SET 
                address = pa.address,
                city_id = pa.city_id,
                pincode = pa.pincode,
                country = COALESCE(pa.country, 'India')
            FROM (
                SELECT DISTINCT ON (branch_id)
                    branch_id,
                    address,
                    city_id,
                    pincode,
                    country
                FROM party_addresses
                WHERE branch_id IS NOT NULL AND is_active = true
                ORDER BY branch_id, (CASE WHEN address_type_id = 1 THEN 0 ELSE 1 END), id ASC
            ) pa
            WHERE pb.id = pa.branch_id;
        `);

        // B. Fallback for any addresses that had branch_id IS NULL: map to party's Head Office branch
        await knex.raw(`
            UPDATE party_branches pb
            SET 
                address = COALESCE(pb.address, pa.address),
                city_id = COALESCE(pb.city_id, pa.city_id),
                pincode = COALESCE(pb.pincode, pa.pincode),
                country = COALESCE(pb.country, pa.country, 'India')
            FROM (
                SELECT DISTINCT ON (party_id)
                    party_id,
                    address,
                    city_id,
                    pincode,
                    country
                FROM party_addresses
                WHERE branch_id IS NULL AND is_active = true
                ORDER BY party_id, (CASE WHEN address_type_id = 1 THEN 0 ELSE 1 END), id ASC
            ) pa
            WHERE pb.party_id = pa.party_id 
              AND pb.is_head_office = true
              AND pb.address IS NULL;
        `);

        // 3. Rename party_addresses to party_addresses_archive as a safe historical backup
        await knex.schema.renameTable('party_addresses', 'party_addresses_archive');
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (await knex.schema.hasTable('party_addresses_archive')) {
        await knex.schema.renameTable('party_addresses_archive', 'party_addresses');
    }

    if (await knex.schema.hasTable('party_branches')) {
        await knex.schema.alterTable('party_branches', function (table) {
            table.dropColumn('country');
            table.dropColumn('pincode');
            table.dropColumn('city_id');
            table.dropColumn('address');
        });
    }
};
