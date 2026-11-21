'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Update app.js
let appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const oldTarget = `openModal(t('print_modal_title', 'Pilih ukuran kertas'),[{name:'paperSize',label:t('col_paper_size', 'Ukuran kertas'),type:'select',required:true,items:[{value:'continuous',label:t('paper_continuous', 'Continuous Form · 9,5 × 5,5 inci')},{value:'a4-portrait',label:t('paper_a4', 'Kertas A4 (Faktur standar)')}]}],values=>{const paperSize=values.paperSize==='a4-portrait'?'a4-portrait':'continuous';`;
const newTarget = `openModal(t('print_modal_title', 'Pilih ukuran kertas'),[{name:'paperSize',label:t('col_paper_size', 'Ukuran kertas'),type:'select',required:true,items:[{value:'continuous',label:t('paper_continuous', 'Continuous Form · 9,5 × 5,5 inci')},{value:'a4-portrait',label:t('paper_a4', 'Kertas A4 (Faktur standar)')}]}],values=>{closeModal();const paperSize=values.paperSize==='a4-portrait'?'a4-portrait':'continuous';`;

if (!appJs.includes(oldTarget)) {
  console.error('Could not find oldTarget in app.js!');
  process.exit(1);
}
appJs = appJs.replace(oldTarget, newTarget);
fs.writeFileSync(path.join(root, 'app.js'), appJs, 'utf8');
console.log('Updated app.js successfully with closeModal().');

// 2. Bump versions in index.html and warehouse/index.html
const oldVer = '20261121-modal-fix-v4';
const newVer = '20261121-modal-fix-v5';

['index.html', 'warehouse/index.html'].forEach(rel => {
  const file = path.join(root, rel);
  let content = fs.readFileSync(file, 'utf8');
  content = content.replaceAll(oldVer, newVer);
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Bumped version in ${rel} to ${newVer}`);
});
