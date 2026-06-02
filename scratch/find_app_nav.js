const fs = require('fs');

const content = fs.readFileSync('c:/Users/Falka/Desktop/dating/backend/mobile-app/App.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('Agency') || line.includes('Application') || line.includes('Dashboard')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
