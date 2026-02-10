const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
    cloud_name: 'dqnmw4mru',
    api_key: '281612529551927',
    api_secret: 'aaDyBAHKc4maMhtKmM0lwwV82V4'
});

console.log('Testing Cloudinary Upload with Real Image...');

// Create a small clear 1x1 GIF
const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');
const dummyImagePath = path.join(__dirname, 'test_pixel.gif');
fs.writeFileSync(dummyImagePath, pixel);

cloudinary.uploader.upload(dummyImagePath, {
    folder: 'dating_app_uploads',
    use_filename: true,
    unique_filename: false,
}, (error, result) => {
    // Clean up
    try { fs.unlinkSync(dummyImagePath); } catch (e) { }

    if (error) {
        console.error('❌ Upload Failed:', error);
    } else {
        console.log('✅ Upload Success:', result.secure_url);
    }
});
