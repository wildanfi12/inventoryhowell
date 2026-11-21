const fs = require('fs');
['index.html', 'warehouse/index.html'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/(\.js|\.css)\?v=[a-zA-Z0-9_\-\.]+/g);
  console.log(f, matches);
});
