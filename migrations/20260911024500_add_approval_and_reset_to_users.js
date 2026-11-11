/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('users', function (table) {
        // Allow role_id to be nullable for self-registered users pending role assignment
        table.integer('role_id').unsigned().nullable().alter();

        // Registration approval state
        table.string('approval_status', 20).notNullable().defaultTo('PENDING'); // PENDING, APPROVED, REJECTED

        // Password reset operational columns
        table.string('reset_status', 20).nullable().defaultTo(null); // PENDING, APPROVED, null
        table.string('reset_token_hash', 64).nullable();
        table.timestamp('reset_token_expires_at').nullable();
    });

    // Mark existing active users as APPROVED
    await knex('users').where({ is_active: true }).update({ approval_status: 'APPROVED' });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('users', function (table) {
        table.dropColumn('approval_status');
        table.dropColumn('reset_status');
        table.dropColumn('reset_token_hash');
        table.dropColumn('reset_token_expires_at');
        table.integer('role_id').unsigned().notNullable().alter();
    });
};
