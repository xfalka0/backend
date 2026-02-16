const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const targetDirs = [
    path.join(__dirname, 'mobile-app/assets'),
    path.join(__dirname, 'mobile-app/assets/fake_profiles')
];

const processFile = async (filePath) => {
    if (!filePath.endsWith('.png')) return;

    try {
        const metadata = await sharp(filePath).metadata();
        console.log(`Processing ${path.basename(filePath)}: Format is ${metadata.format}`);

        if (metadata.format !== 'png') {
            console.log(`Converting ${path.basename(filePath)} from ${metadata.format} to png...`);
            const buffer = await sharp(filePath).png().toBuffer();
            const tempPath = filePath + '.tmp';
            fs.writeFileSync(tempPath, buffer);

            try {
                fs.unlinkSync(filePath);
                fs.renameSync(tempPath, filePath);
                console.log(`Saved ${path.basename(filePath)} as valid PNG.`);
            } catch (unlinkErr) {
                console.error(`Could not replace ${path.basename(filePath)}:`, unlinkErr.message);
                // Try to keep temp file if original cannot be deleted? 
                // No, just leave it for now.
            }
        } else {
            console.log(`${path.basename(filePath)} is already a valid PNG.`);
        }
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
    }
};

const run = async () => {
    for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isFile()) {
                await processFile(filePath);
            }
        }
    }
};

run();
