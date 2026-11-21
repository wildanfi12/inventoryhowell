const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');
const start = code.indexOf('function printWaybill(');
console.log(code.substring(start + 19500, start + 24000));
