const fs = require('fs');

const content = fs.readFileSync('c:/Users/Falka/Desktop/dating/backend/web-admin/src/pages/AgencyPayouts.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('Hakediş Öde') || line.includes('operators.map') || line.includes('Ajans Adı') || line.includes('Referans Kodu')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
