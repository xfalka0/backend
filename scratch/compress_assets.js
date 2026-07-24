const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch (e) {
        console.log('Installing sharp locally...');
        execSync('npm install --no-save sharp', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        sharp = require('sharp');
    }

    const assetsDir = path.join(__dirname, '../mobile-app/assets');

    function getAllFiles(dirPath, arrayOfFiles = []) {
        const files = fs.readdirSync(dirPath);
        files.forEach((file) => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                getAllFiles(fullPath, arrayOfFiles);
            } else {
                if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
                    arrayOfFiles.push(fullPath);
                }
            }
        });
        return arrayOfFiles;
    }

    const files = getAllFiles(assetsDir);
    let totalSaved = 0;

    for (const filePath of files) {
        const stats = fs.statSync(filePath);
        const originalSize = stats.size;

        if (originalSize < 200 * 1024) continue; // Skip files smaller than 200KB

        const tempFile = filePath + '.tmp';

        try {
            // Compress PNG / JPG images
            if (filePath.endsWith('.png')) {
                // If it's a huge photo/banner/profile image, resize max width to 1080 and compress png quality
                const meta = await sharp(filePath).metadata();
                let pipeline = sharp(filePath);
                if (meta.width && meta.width > 1080) {
                    pipeline = pipeline.resize({ width: 1080, withoutEnlargement: true });
                }
                await pipeline
                    .png({ quality: 80, compressionLevel: 9, palette: true })
                    .toFile(tempFile);
            } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
                const meta = await sharp(filePath).metadata();
                let pipeline = sharp(filePath);
                if (meta.width && meta.width > 1080) {
                    pipeline = pipeline.resize({ width: 1080, withoutEnlargement: true });
                }
                await pipeline
                    .jpeg({ quality: 80 })
                    .toFile(tempFile);
            }

            const newSize = fs.statSync(tempFile).size;
            if (newSize < originalSize) {
                fs.renameSync(tempFile, filePath);
                const saved = originalSize - newSize;
                totalSaved += saved;
                console.log(`[COMPRESSED] ${path.basename(filePath)}: ${(originalSize/1024/1024).toFixed(2)}MB -> ${(newSize/1024/1024).toFixed(2)}MB (Saved ${(saved/1024/1024).toFixed(2)}MB)`);
            } else {
                fs.unlinkSync(tempFile);
            }
        } catch (err) {
            console.error(`Error processing ${path.basename(filePath)}:`, err.message);
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    }

    console.log(`\n🎉 TOTAL SPACE SAVED IN ASSETS: ${(totalSaved / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
