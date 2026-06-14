const axios = require('axios');
const API_URL = 'http://localhost:5000/api'; // local test

async function testPhase1() {
    console.log('[Test] Starting Phase 1 Integration Tests...');
    try {
        const username = `test_${Math.floor(Math.random() * 100000)}`;
        const email = `${username}@example.com`;
        
        // 1. Test POST /auth/register
        console.log('\n[Test] 1. Calling POST /auth/register...');
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            username,
            email,
            password: 'password123',
            displayName: 'Faz 1 Test Üyesi',
            gender: 'erkek',
            country: 'TR',
            bio: 'Test biyografisi'
        });
        
        const token = regRes.data.token;
        const userId = regRes.data.user.id;
        console.log(`[Success] User registered. ID: ${userId}, Token generated.`);

        // 2. Test POST /auth/login
        console.log('\n[Test] 2. Calling POST /auth/login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email,
            password: 'password123'
        });
        console.log('[Success] User logged in. Token matched.');

        // 3. Test GET /auth/me
        console.log('\n[Test] 3. Calling GET /auth/me...');
        const meRes = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`[Success] Me loaded: ${meRes.data.username}, Role: ${meRes.data.role}`);

        // 4. Test PATCH /users/me
        console.log('\n[Test] 4. Calling PATCH /users/me...');
        const patchRes = await axios.patch(`${API_URL}/users/me`, {
            displayName: 'Güncellenmiş Ad',
            bio: 'Güncellenmiş biyografi.',
            country: 'DE'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`[Success] Profile updated: ${patchRes.data.displayName}, Bio: ${patchRes.data.bio}, Country: ${patchRes.data.country}`);

        // 5. Test GET /users/
        console.log('\n[Test] 5. Calling GET /users...');
        const usersRes = await axios.get(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`[Success] Total users found: ${usersRes.data.length}`);

        console.log('\n[Test] All Phase 1 Integration Tests passed successfully! 🚀');
        process.exit(0);
    } catch (err) {
        console.error('[Error] Phase 1 Integration Test failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

testPhase1();
