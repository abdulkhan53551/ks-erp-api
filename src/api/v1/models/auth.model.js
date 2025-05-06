const { db } = require("../database");
const { logQuery } = require("../helpers/logQuery");

/**
 * Inserts a new user into the database.
 */
async function createUser(data) {
    const query = db('users')
        .insert(data)
        .returning(['id', 'first_name', 'last_name', 'email', 'user_name']);

    const [user] = await query

    return user;
}

// Deletes a refresh token from the database based on user ID and hashed token.
async function deleteRefreshTokenByUserIDAndToken(userId, hashedToken) {
    const deletedCount = await db('refresh_tokens')
        .where({ user_id: userId, token_hash: hashedToken })
        .delete();

    const wasDeleted = deletedCount > 0;
    return wasDeleted;
}

// Deletes all refresh tokens associated with a user ID.
async function deleteRefreshTokenByUserID(userId) {
    const deletedCount = await db('refresh_tokens')
        .where({ user_id: userId })
        .delete();

    const wasDeleted = deletedCount > 0;
    return wasDeleted;
}

module.exports = {
    createUser,
    deleteRefreshTokenByUserIDAndToken,
    deleteRefreshTokenByUserID
};
