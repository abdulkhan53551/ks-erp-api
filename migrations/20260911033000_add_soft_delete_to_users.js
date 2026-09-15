/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasDeletedAt = await knex.schema.hasColumn('users', 'deleted_at');
    const hasDeletedBy = await knex.schema.hasColumn('users', 'deleted_by');

    await knex.schema.alterTable('users', (table) => {
        if (!hasDeletedAt) {
            table.timestamp('deleted_at').nullable();
        }
        if (!hasDeletedBy) {
            table.integer('deleted_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        }
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasDeletedAt = await knex.schema.hasColumn('users', 'deleted_at');
    const hasDeletedBy = await knex.schema.hasColumn('users', 'deleted_by');

    await knex.schema.alterTable('users', (table) => {
        if (hasDeletedBy) {
            table.dropColumn('deleted_by');
        }
        if (hasDeletedAt) {
            table.dropColumn('deleted_at');
        }
    });
};
