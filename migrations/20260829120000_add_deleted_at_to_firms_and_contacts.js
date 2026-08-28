/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const tables = ['firms', 'firm_bank_accounts', 'user_contacts'];

    for (const tableName of tables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            const hasDeletedAt = await knex.schema.hasColumn(tableName, 'deleted_at');
            const hasDeletedBy = await knex.schema.hasColumn(tableName, 'deleted_by');

            await knex.schema.alterTable(tableName, (table) => {
                if (!hasDeletedAt) {
                    table.timestamp('deleted_at').nullable();
                }
                if (!hasDeletedBy) {
                    table.integer('deleted_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
                }
            });
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const tables = ['firms', 'firm_bank_accounts', 'user_contacts'];

    for (const tableName of tables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            await knex.schema.alterTable(tableName, (table) => {
                table.dropColumn('deleted_by');
                table.dropColumn('deleted_at');
            });
        }
    }
};
