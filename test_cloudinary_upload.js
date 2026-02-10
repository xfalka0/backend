const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Credentials from server.js
cloudinary.config({
    cloud_name: 'dqnmw4mru',
    api_key: '644785478383289',
    api_secret: 'k2V8dVOkZg7d1Y6u6_nqF9fwo8I'
});

console.log('Testing Cloudinary Upload...');

// Create a dummy file
const dummyFilePath = path.join(__dirname, 'test_image.txt');
fs.writeFileSync(dummyFilePath, 'This is a test file to verify cloudinary upload.');

cloudinary.uploader.upload(dummyFilePath, {
    // No options
}, (error, result) => {
    // Delete dummy file
    try { fs.unlinkSync(dummyFilePath); } catch (e) { }

    if (error) {
        console.error('❌ Upload Failed:', error);
        console.error('Error Details:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Upload Success:', result.secure_url);
    }
});
