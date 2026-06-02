const fs = require('fs');

const content = fs.readFileSync('c:/Users/Falka/Desktop/dating/backend/mobile-app/src/screens/ProfileScreen.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('/auth/me') || line.includes('sync') || line.includes('fetchUser')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
