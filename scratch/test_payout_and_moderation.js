/**
 * Verification Test Script for Payout & Content Moderation Filter
 */

const { validateProfileText } = require('../utils/moderationFilter');

console.log('=== TEST 1: Moderation Filter Verification ===');

const testCases = [
    { input: 'Merhaba ben sohbet etmek istiyorum', expectedClean: true },
    { input: 'Bana 0555 123 45 67 numarasından ulaşabilirsiniz', expectedClean: false },
    { input: 'Instagram adresim: instagram.com/falkasoftware', expectedClean: false },
    { input: 'Whatsapp 0 5 3 2 1 1 1 2 2 3 3', expectedClean: false },
    { input: 'Müzik dinlemeyi ve gezmeyi severim.', expectedClean: true }
];

let passedCount = 0;
testCases.forEach((tc, idx) => {
    const result = validateProfileText(tc.input);
    const passed = result.isClean === tc.expectedClean;
    if (passed) {
        console.log(`✅ Test ${idx + 1} PASSED: "${tc.input.substring(0, 35)}..." -> isClean: ${result.isClean}`);
        passedCount++;
    } else {
        console.error(`❌ Test ${idx + 1} FAILED: "${tc.input}" -> expected ${tc.expectedClean}, got ${result.isClean}`);
    }
});

console.log(`\nModeration Filter Test Summary: ${passedCount}/${testCases.length} Passed.`);

console.log('\n=== TEST 2: Checking Server File Syntax ===');
try {
    const fs = require('fs');
    const serverCode = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    
    const requiredEndpoints = [
        '/api/operators/payout-request',
        '/api/operators/payout-history',
        '/api/admin/payout-requests',
        '/api/inventory/me',
        '/api/inventory/equip',
        '/api/inventory/purchase'
    ];

    let missing = 0;
    requiredEndpoints.forEach(ep => {
        if (serverCode.includes(ep)) {
            console.log(`✅ Endpoint registered: ${ep}`);
        } else {
            console.error(`❌ Endpoint missing: ${ep}`);
            missing++;
        }
    });

    if (missing === 0) {
        console.log('\n✅ All new endpoints successfully registered in server.js!');
    }
} catch (e) {
    console.error('Syntax/File check error:', e.message);
}
