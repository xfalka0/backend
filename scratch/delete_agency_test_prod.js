const { Client } = require('c:/Users/Falka/Desktop/dating/backend/node_modules/pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        await client.query('BEGIN');

        const agencyId = 'TEST';
        const ownerId = '591';

        console.log(`Deleting agency '${agencyId}' owned by owner '${ownerId}'...`);

        // 1. Unlink users from agency
        const unlinkUsersRes = await client.query('UPDATE users SET agency_id = NULL WHERE agency_id = $1', [agencyId]);
        console.log(`Unlinked users: ${unlinkUsersRes.rowCount}`);

        // 2. Delete invitations associated with this agency
        const deleteInvitesRes = await client.query('DELETE FROM agency_invitations WHERE agency_id = $1', [agencyId]);
        console.log(`Deleted invitations: ${deleteInvitesRes.rowCount}`);

        // 3. Delete payouts associated with this agency
        const deletePayoutsRes = await client.query('DELETE FROM agency_payouts WHERE agency_id = $1', [agencyId]);
        console.log(`Deleted payouts: ${deletePayoutsRes.rowCount}`);

        // 4. Delete commission logs associated with this agency
        const deleteLogsRes = await client.query('DELETE FROM commission_logs WHERE agency_id = $1', [agencyId]);
        console.log(`Deleted commission logs: ${deleteLogsRes.rowCount}`);

        // 5. Delete the agency itself
        const deleteAgencyRes = await client.query('DELETE FROM agencies WHERE id = $1', [agencyId]);
        console.log(`Deleted agency row: ${deleteAgencyRes.rowCount}`);

        // 6. Reset owner status for user 591
        const resetOwnerRes = await client.query('UPDATE users SET is_agency_owner = false WHERE id = $1', [ownerId]);
        console.log(`Reset owner status for user ${ownerId}: ${resetOwnerRes.rowCount}`);

        await client.query('COMMIT');
        console.log('Transaction committed successfully! Agency deleted and owner status reset.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during execution:', err);
    } finally {
        await client.end();
    }
}

run();
