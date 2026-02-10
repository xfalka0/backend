const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
    cloud_name: 'dqnmw4mru',
    api_key: '761886164599834',
    api_secret: 'VsHSmd7WVpg9Cum2RY4baMHaU30'
});

async function runDiagnostics() {
    console.log('--- CLOUDINARY DIAGNOSTICS ---\n');

    // 1. Connection Test (Ping)
    console.log('1. Testing Connection (Ping)...');
    try {
        const ping = await cloudinary.api.ping();
        console.log('✅ Connection OK:', ping);
    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
    }

    // 2. Admin API Test (Usage Details)
    console.log('\n2. Testing Admin API (Account Usage)...');
    try {
        const usage = await cloudinary.api.usage();
        console.log('✅ Admin API OK. Account Status:', usage.plan || 'Unknown');
        console.log('   Credits Used:', usage.credits?.usage || 0);
    } catch (e) {
        console.error('❌ Admin API Failed:', e.message);
        console.error('   Hint: If this fails, API Key might not have Admin rights.');
    }

    // 3. Upload Test (Root Folder)
    console.log('\n3. Testing Upload API (Root Folder)...');
    const dummyPath = path.join(__dirname, 'diag_test.txt');
    fs.writeFileSync(dummyPath, 'Diagnostics Test');

    try {
        const upload = await cloudinary.uploader.upload(dummyPath, {
            resource_type: 'auto',
            public_id: 'diag_test_' + Date.now()
        });
        console.log('✅ Upload Success:', upload.secure_url);

        // Cleanup cloud file
        await cloudinary.uploader.destroy(upload.public_id);
    } catch (e) {
        console.error('❌ Upload Failed:', e.message);
        if (e.http_code) console.error('   HTTP Code:', e.http_code);
    } finally {
        try { fs.unlinkSync(dummyPath); } catch (e) { }
    }

    console.log('\n--- END DIAGNOSTICS ---');
}

runDiagnostics();
