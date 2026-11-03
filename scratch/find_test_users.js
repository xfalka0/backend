const { Client } = require('../node_modules/pg');
const client = new Client({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    // 1. Male
    const male = await client.query("SELECT id, name, email, gender, role, balance, vip_level, is_vip, onboarding_completed FROM users WHERE gender = 'erkek' AND role = 'user' AND onboarding_completed = true LIMIT 3");
    // 2. Female
    const female = await client.query("SELECT id, name, email, gender, role, balance, vip_level, is_vip, onboarding_completed FROM users WHERE gender = 'kadin' AND role = 'user' AND onboarding_completed = true LIMIT 3");
    // 3. New / Not completed onboarding
    const newAccount = await client.query("SELECT id, name, email, gender, role, balance, vip_level, is_vip, onboarding_completed FROM users WHERE onboarding_completed = false LIMIT 3");
    // 4. Premium (vip_level > 0 or is_vip = true)
    const premium = await client.query("SELECT id, name, email, gender, role, balance, vip_level, is_vip, onboarding_completed FROM users WHERE (vip_level > 0 OR is_vip = true) AND role = 'user' LIMIT 3");
    // 5. Zero balance
    const zeroBal = await client.query("SELECT id, name, email, gender, role, balance, vip_level, is_vip, onboarding_completed FROM users WHERE balance = 0 AND role = 'user' AND onboarding_completed = true LIMIT 3");
    // 6. Not set gender
    const notSetGender = await client.query("SELECT id, name, email, gender, role, balance, vip_level, is_vip, onboarding_completed FROM users WHERE gender NOT IN ('erkek', 'kadin', 'coin_bayisi') OR gender IS NULL LIMIT 3");

    console.log('MALE:', JSON.stringify(male.rows, null, 2));
    console.log('FEMALE:', JSON.stringify(female.rows, null, 2));
    console.log('NEW:', JSON.stringify(newAccount.rows, null, 2));
    console.log('PREMIUM:', JSON.stringify(premium.rows, null, 2));
    console.log('ZERO_BAL:', JSON.stringify(zeroBal.rows, null, 2));
    console.log('NOT_SET_GENDER:', JSON.stringify(notSetGender.rows, null, 2));
    await client.end();
}
check().catch(console.error);

