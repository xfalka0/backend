const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/Falka/Desktop/dating/backend/.env' });

const config = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  }
  : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dating',
    password: process.env.DB_PASSWORD || '123',
    port: process.env.DB_PORT || 5432,
    ssl: false
  };

const client = new Client(config);

async function runTest() {
    try {
        await client.connect();
        
        // Find a female user to query as a male user (or vice versa)
        const userRes = await client.query("SELECT id, gender, display_name FROM users LIMIT 5");
        console.log("Sample Users in DB:");
        console.log(userRes.rows);

        if (userRes.rows.length === 0) {
            console.log("No users found in database!");
            return;
        }

        const userId = userRes.rows[0]?.id;
        const userGender = (userRes.rows[0]?.gender || 'erkek').toLowerCase();
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';

        console.log(`\nTesting discovery query for user ${userId} (${userGender}) looking for ${targetGender}...`);

        for (let page = 1; page <= 3; page++) {
            const limitNum = 2;
            const offset = (page - 1) * limitNum;

            let whereClause = `WHERE (u.gender = $1 OR u.gender = 'coin_bayisi') AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')`;
            let orderByClause = 'ORDER BY (EXISTS(SELECT 1 FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW())) DESC, o.is_online DESC NULLS LAST, u.created_at DESC, u.id DESC';

            const query = `
                SELECT 
                    u.id, 
                    COALESCE(u.display_name, u.username) as name, 
                    u.avatar_url, 
                    u.gender, 
                    u.age, 
                    u.vip_level, 
                    u.job,
                    u.relationship,
                    u.zodiac,
                    u.interests,
                    u.role,
                    o.category, 
                    o.rating, 
                    o.is_online, 
                    COALESCE(o.bio, u.bio) as bio, 
                    o.photos,
                    CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator,
                    EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story,
                    EXISTS(SELECT 1 FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW()) as is_boosted
                FROM users u
                LEFT JOIN operators o ON u.id = o.user_id
                ${whereClause}
                  AND u.id != $2
                  AND u.account_status = 'active'
                ${orderByClause}
                LIMIT $3 OFFSET $4
            `;

            const queryParams = [targetGender, userId, limitNum, offset];
            console.log(`\n--- Page ${page} (Limit ${limitNum}, Offset ${offset}) ---`);
            const res = await client.query(query, queryParams);
            console.log(`Fetched ${res.rows.length} rows`);
            res.rows.forEach(r => {
                console.log(`- ID: ${r.id}, Name: ${r.name}, Gender: ${r.gender}`);
            });
        }

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await client.end();
    }
}

runTest();
