/**
 * Verification Test for Agora Hybrid Token Provider
 */

const { AgoraRtcProvider } = require('../utils/rtcProvider');

async function runTest() {
    console.log('=== TEST: Agora Hybrid Token Provider ===');
    const agoraProvider = new AgoraRtcProvider();

    try {
        // Test 1: Numeric UID
        const token1 = await agoraProvider.createJoinToken(12345, 'room_100', 'host');
        console.log('✅ Test 1 (Numeric UID 12345): Token generated successfully. Length:', token1.length);

        // Test 2: String Account UID (UUID)
        const token2 = await agoraProvider.createJoinToken('usr_uuid_abc_99', 'room_100', 'host');
        console.log('✅ Test 2 (String Account UUID): Token generated successfully. Length:', token2.length);

        // Test 3: Fallback 0
        const token3 = await agoraProvider.createJoinToken(null, 'room_100', 'audience');
        console.log('✅ Test 3 (Fallback Wildcard 0): Token generated successfully. Length:', token3.length);

        console.log('\n🎉 ALL AGORA HYBRID TOKEN TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('❌ Agora Token Test Failed:', err.message);
        process.exit(1);
    }
}

runTest();
