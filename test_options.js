const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
    cloud_name: 'dqnmw4mru',
    api_key: '281612529551927',
    api_secret: 'aaDyBAHKc4maMhtKmM0lwwV82V4'
});

const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');
const dummyImagePath = path.join(__dirname, 'test_pixel.gif');
fs.writeFileSync(dummyImagePath, pixel);

async function test() {
    console.log('--- TEST 1: No Options ---');
    try {
        const res1 = await cloudinary.uploader.upload(dummyImagePath);
        console.log('✅ Success:', res1.secure_url);
    } catch (e) {
        console.log('❌ Failed:', e.message);
    }

    console.log('\n--- TEST 2: Folder Only ---');
    try {
        const res2 = await cloudinary.uploader.upload(dummyImagePath, { folder: 'dating_app_uploads' });
        console.log('✅ Success:', res2.secure_url);
    } catch (e) {
        console.log('❌ Failed:', e.message);
    }

    console.log('\n--- TEST 3: Folder + use_filename ---');
    try {
        const res3 = await cloudinary.uploader.upload(dummyImagePath, {
            folder: 'dating_app_uploads',
            use_filename: true
        });
        console.log('✅ Success:', res3.secure_url);
    } catch (e) {
        console.log('❌ Failed:', e.message);
    }

    console.log('\n--- TEST 4: Folder + use_filename + unique_filename=false ---');
    try {
        const res4 = await cloudinary.uploader.upload(dummyImagePath, {
            folder: 'dating_app_uploads',
            use_filename: true,
            unique_filename: false
        });
        console.log('✅ Success:', res4.secure_url);
    } catch (e) {
        console.log('❌ Failed:', e.message);
    }

    try { fs.unlinkSync(dummyImagePath); } catch (e) { }
}

test();
