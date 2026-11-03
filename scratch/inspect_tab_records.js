const path = require('path');
require('../node_modules/dotenv').config({ path: path.join(__dirname, '../.env') });
const request = require('../node_modules/supertest');
const jwt = require('../node_modules/jsonwebtoken');
const { app } = require('../server');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'falka_super_secret_2024_key_change_me';
const maleToken = jwt.sign({ id: 'c2004884-a53f-4bb0-8f6b-014b039427dc', role: 'user', gender: 'erkek' }, SECRET);

async function testTabs() {
    const tabs = ['recommended', 'online', 'new', 'popular'];
    for (const t of tabs) {
        const res = await request(app)
            .get(`/api/discovery?tab=${t}&limit=20`)
            .set('Authorization', `Bearer ${maleToken}`);

        const list = res.body?.data || [];
        console.log(`\n=== SEKME: ${t.toUpperCase()} (Toplam: ${list.length}) ===`);
        console.table(list.map(u => ({
            id: u.id.substring(0, 8),
            name: u.name,
            gender: u.gender,
            is_online: u.is_online,
            vip_level: u.vip_level,
            rating: u.rating,
            created_at: u.created_at ? u.created_at.substring(0, 10) : null
        })));
    }
    await db.pool.end();
}
testTabs().catch(console.error);

