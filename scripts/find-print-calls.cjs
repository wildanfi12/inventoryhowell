const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');
const lines = code.split('\n');
lines.forEach((l, i) => {
  if (l.includes('openWaybillPrintOptions') || l.includes('printWaybill(')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
