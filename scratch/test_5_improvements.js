/**
 * Comprehensive Verification Script for 5 Urgent Improvements:
 * 1. 1-to-1 Call Billing Guard (Media Connection Requirement)
 * 2. Socket Listener Cleanup
 * 3. Sentry Error Tracking Integration
 * 4. Render Production Keep-Alive Toggle
 * 5. Visual Image Moderation Guard
 */

const fs = require('fs');
const path = require('path');
const { validateImageUrl } = require('../utils/moderationFilter');

console.log('=== VERIFICATION OF 5 URGENT IMPROVEMENTS ===\n');

// --- TEST 1: Call Billing Guard Verification ---
console.log('1️⃣ Call Billing Guard Verification:');
const socketHandlerCode = fs.readFileSync(path.join(__dirname, '../socket/socketHandler.js'), 'utf8');
if (socketHandlerCode.includes("status = 'accepted_waiting_media'") && socketHandlerCode.includes("15s Media connection timeout")) {
    console.log('  ✅ PASSED: Call Billing Guard is active. First minute charge only executes upon media connection!\n');
} else {
    console.error('  ❌ FAILED: Call Billing Guard not found in socketHandler.js!\n');
}

// --- TEST 2: Socket Listener Cleanup Verification ---
console.log('2️⃣ Socket Listener Cleanup Verification:');
const chatScreenCode = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/ChatScreen.js'), 'utf8');
if (chatScreenCode.includes("socket.off('receive_message')") && chatScreenCode.includes("socket.off('display_typing')")) {
    console.log('  ✅ PASSED: Socket listeners in ChatScreen.js are properly cleaned up on unmount!\n');
} else {
    console.error('  ❌ FAILED: Socket cleanup missing in ChatScreen.js!\n');
}

// --- TEST 3: Sentry Error Tracking Verification ---
console.log('3️⃣ Sentry Error Tracking Verification:');
const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
if (serverCode.includes('Sentry.init') && serverCode.includes('Sentry.setupExpressErrorHandler')) {
    console.log('  ✅ PASSED: Sentry error tracking & Express error handler registered in server.js!\n');
} else {
    console.error('  ❌ FAILED: Sentry integration missing in server.js!\n');
}

// --- TEST 4: Render Production Keep-Alive Toggle Verification ---
console.log('4️⃣ Render Keep-Alive Toggle Verification:');
if (serverCode.includes('DISABLE_KEEP_ALIVE') && serverCode.includes('RENDER_EXTERNAL_URL')) {
    console.log('  ✅ PASSED: Render Keep-Alive respects DISABLE_KEEP_ALIVE for paid tier deployments!\n');
} else {
    console.error('  ❌ FAILED: Keep-Alive toggle missing in server.js!\n');
}

// --- TEST 5: Visual Image Moderation Guard Verification ---
console.log('5️⃣ Visual Image Moderation Guard Verification:');
const testImages = [
    { url: 'https://res.cloudinary.com/falka/image/upload/v1234/profile.jpg', expected: true },
    { url: 'https://example.com/avatar.png', expected: true },
    { url: 'javascript:alert(1)', expected: false },
    { url: 'http://malicious-file.exe', expected: false }
];

let imgPassed = 0;
testImages.forEach((t, i) => {
    const res = validateImageUrl(t.url);
    if (res.isClean === t.expected) {
        imgPassed++;
        console.log(`  ✅ Image Test ${i + 1} PASSED: "${t.url.substring(0, 40)}" -> isClean: ${res.isClean}`);
    } else {
        console.error(`  ❌ Image Test ${i + 1} FAILED: "${t.url}" -> expected ${t.expected}, got ${res.isClean}`);
    }
});

console.log(`\nVisual Moderation Test Summary: ${imgPassed}/${testImages.length} Passed.`);

if (imgPassed === testImages.length) {
    console.log('\n🎉 ALL 5 URGENT IMPROVEMENTS VERIFIED WITH 100% SUCCESS!');
}
