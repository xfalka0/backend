const fs = require('fs');

const content = fs.readFileSync('c:/Users/Falka/Desktop/dating/backend/mobile-app/src/screens/ProfileScreen.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('Ajans') || line.includes('agency') || line.includes('Agency')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
