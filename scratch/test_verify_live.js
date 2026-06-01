const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const MALE_NAMES_ARRAY = [
    'abdurrahman', 'abdullah', 'abdulkadir', 'abdulkerim', 'adabi', 'adem', 'adnan', 'afsin', 'affiliate', 'akin', 'ahmet', 'ali', 'alper', 'alperen', 'anil', 'arda', 'arif', 'atilla', 'aziz', 'ayhan', 'aykut', 'baris', 'batuhan', 'bayram', 'behcet', 'berat', 'berk', 'berkay', 'bekir', 'bora', 'bulent', 'burak', 'cafer', 'cagatay', 'cavit', 'celal', 'cem', 'cemal', 'cevat', 'cihan', 'cengiz', 'cumali', 'davut', 'dogan', 'dogukan', 'dundar', 'ekrem', 'emir', 'emircan', 'emrah', 'emre', 'enes', 'enver', 'eray', 'ercan', 'erdem', 'erdogan', 'eren', 'erhan', 'erol', 'ersin', 'faruk', 'fatih', 'ferhat', 'fikret', 'fuat', 'furkan'
];

async function run() {
    console.log('--- VERIFYING DISCOVERY FEED ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // 1. Simulate the discovery query for a male user (targetGender = kadin)
        const targetGender = 'kadin';
        const userId = 592; // Batuhan
        
        let whereClause = `WHERE (LOWER(u.gender) = $1 OR u.gender = 'coin_bayisi') AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')`;
        const patterns = MALE_NAMES_ARRAY.map(name => `%${name}%`);
        whereClause += ` AND NOT (translate(LOWER(COALESCE(u.display_name, '') || ' ' || COALESCE(u.name, '') || ' ' || COALESCE(u.username, '')), 'çğıöşüİ', 'cgiosui') ILIKE ANY($3))`;
        
        const queryParams = [targetGender, userId, patterns];

        const query = `
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, 
                u.gender, 
                u.age, 
                u.role,
                o.category
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            ${whereClause}
              AND u.id != $2
              AND u.account_status = 'active'
            ORDER BY u.created_at DESC
        `;

        const res = await client.query(query, queryParams);
        console.log(`Found ${res.rows.length} female profiles in Batuhan's discovery feed:`);
        console.table(res.rows);

        // Check specifically if user 591 is in the output
        const hasSudenur = res.rows.some(r => r.id === 591);
        if (hasSudenur) {
            console.log('🎉 SUCCESS: Sudenur (591) is now fully visible in Batuhan\'s discovery feed!');
        } else {
            console.log('❌ FAILURE: Sudenur is still not appearing. Checking her user profile state...');
            const profile = await client.query('SELECT * FROM users WHERE id = 591');
            console.log(profile.rows[0]);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
