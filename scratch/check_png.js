const fs = require('fs');
const path = 'D:/dating/backend/mobile-app/assets/fiva_profile_banner.png';

try {
    const buffer = fs.readFileSync(path);
    console.log('File size:', buffer.length, 'bytes');
    console.log('First 8 bytes:', buffer.slice(0, 8));
    
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    
    console.log('Is PNG:', isPng);
    console.log('Is JPG:', isJpg);
} catch (err) {
    console.error('Error:', err.message);
}
