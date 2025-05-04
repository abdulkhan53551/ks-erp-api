const { db } = require("../database");
const { logQuery } = require("../helpers/logQuery");

/**
 * Inserts a new user into the database.
 */
async function createUser(data) {
    const query = db('users')
        .insert(data)
        .returning(['id', 'first_name', 'last_name', 'email', 'user_name']);

        logQuery(query)

    const [user] = await query

    return user;
}

module.exports = {
    createUser,
};
