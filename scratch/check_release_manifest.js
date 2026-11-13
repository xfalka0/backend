const fs = require('fs');
const manifest = fs.readFileSync('d:/dating/backend/mobile-app/android/app/src/main/AndroidManifest.xml', 'utf8');
const buildGradle = fs.readFileSync('d:/dating/backend/mobile-app/android/app/build.gradle', 'utf8');
const packageJson = fs.readFileSync('d:/dating/backend/mobile-app/package.json', 'utf8');

console.log('--- PERMISSIONS ---');
const perms = manifest.match(/<uses-permission[^>]+>/g) || [];
perms.forEach(p => console.log(p));

console.log('\n--- CLEARTEXT TRAFFIC ---');
const ct = manifest.match(/android:usesCleartextTraffic=\"([^\"]+)\"/);
console.log('usesCleartextTraffic:', ct ? ct[1] : 'not specified (false by default)');

console.log('\n--- SDK VERSIONS ---');
buildGradle.split('\n').filter(l => l.includes('SdkVersion')).forEach(l => console.log(l.trim()));

console.log('\n--- BILLING / PURCHASES IN PACKAGE.JSON ---');
const pkg = JSON.parse(packageJson);
Object.entries(pkg.dependencies || {}).filter(([k]) => k.includes('billing') || k.includes('purchase') || k.includes('iap')).forEach(([k, v]) => {
  console.log(k, ':', v);
});

