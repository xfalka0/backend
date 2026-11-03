const fs = require('fs');
const xml = fs.readFileSync('C:/Users/Falka/.gemini/antigravity/brain/24e72801-fa7a-4312-9a2c-17dd2977caff/window_dump.xml', 'utf8');
const regex = /text="([^"]*)"[^>]*bounds="([^"]*)"/g;
let match;
while ((match = regex.exec(xml)) !== null) {
    if (match[1]) console.log(match[1], '-->', match[2]);
}

