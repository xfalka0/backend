const { execSync } = require('child_process');
const fs = require('fs');

try {
    const buf = execSync('adb -s 127.0.0.1:21503 exec-out run-as com.fivachat.app cat databases/RKStorage');
    fs.writeFileSync('backend/scratch/RKStorage.db', buf);
    const text = buf.toString('latin1');
    console.log('Size:', buf.length);
    const m = text.match(/\{[^{}]*?"id":\s*(\d+)[^{}]*?\}/g);
    if (m) {
        m.forEach(x => console.log('Match:', x));
    } else {
        console.log('No direct match');
    }
} catch (e) {
    console.error(e.message);
}

