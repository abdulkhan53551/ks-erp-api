// dbTransaction.js

const { db } = require("../database");

async function dbTransaction(req, res, next) {
    const trx = await db.transaction(); // start a transaction
    req.trx = trx; // attach it to request

    res.on('finish', async () => {
        // Commit if request succeeded
        if (res.statusCode < 400) {
            try {
                await trx.commit();
            } catch (error) {
                console.error('Transaction commit error:', error);
            }
        } else {
            // Rollback if request failed
            try {
                await trx.rollback();
            } catch (error) {
                console.error('Transaction rollback error:', error);
            }
        }
    });

    res.on('close', async () => {
        if (!trx.isCompleted()) {
            try {
                await trx.rollback();
            } catch (error) {
                console.error('Transaction close rollback error:', error);
            }
        }
    });

    next();
}

module.exports = dbTransaction;