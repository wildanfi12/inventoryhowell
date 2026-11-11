'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.HOWELL_WAREHOUSE_OUT || path.join(root, 'warehouse'));
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const sourceContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/howell-source-data.js'), 'utf8'), sourceContext);
const source = sourceContext.window.HOWELL_SOURCE_DATA;
const productFields = ['sku','barcode','name','spec','category','brand','uom','stock','sourceSheet','sourceRow'];
const branchFields = ['code','name','network','region','address','contact','phone','capacity','source'];
const safe = {
  sources: source.sources,
  products: source.products.map(item => Object.fromEntries(productFields.filter(key => item[key] !== undefined).map(key => [key, item[key]]))),
  paperclipBranches: source.paperclipBranches.map(item => Object.fromEntries(branchFields.filter(key => item[key] !== undefined).map(key => [key, item[key]])))
};
fs.writeFileSync(path.join(out, 'assets/howell-warehouse-data.js'), `window.HOWELL_SOURCE_DATA=${JSON.stringify(safe)};\n`);
fs.copyFileSync(path.join(root,'warehouse','index.html'),path.join(out,'index.html'));
for (const file of ['styles.css','theme-light.css','app.js']) fs.copyFileSync(path.join(root,file),path.join(out,file));
for (const file of ['howell-mark-color.png','product-image-map.js']) fs.copyFileSync(path.join(root,'assets',file),path.join(out,'assets',file));
fs.cpSync(path.join(root,'assets','product-images'),path.join(out,'assets','product-images'),{recursive:true});
fs.writeFileSync(path.join(out,'assets/howell-runtime-config.js'), `window.HOWELL_SHARED_DATABASE=true;window.HOWELL_PORTAL_ROLE='warehouse';\n`);
console.log(`Generated warehouse portal: ${safe.products.length} products, ${safe.paperclipBranches.length} branches; no pricing fields or workbook/pricelist files copied.`);
