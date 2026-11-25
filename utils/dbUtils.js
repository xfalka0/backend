/**
 * Runs a callback inside a dedicated PostgreSQL client transaction when pool.connect is available.
 * Never runs BEGIN/COMMIT/ROLLBACK across separate pool connections.
 */
async function withTransaction(db, fn) {
    if (db.pool && typeof db.pool.connect === 'function') {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw err;
        } finally {
            client.release();
        }
    }

    await db.query('BEGIN');
    try {
        const result = await fn(db);
        await db.query('COMMIT');
        return result;
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch (_) {}
        throw err;
    }
}

module.exports = { withTransaction };
