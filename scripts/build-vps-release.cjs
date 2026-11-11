'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const release = path.join(root, 'release');
if (path.resolve(release) !== path.join(root, 'release')) throw new Error('Release output path failed safety check.');
if (fs.existsSync(release)) fs.rmSync(release, { recursive: true, force: true });
fs.mkdirSync(path.join(release, 'assets'), { recursive: true });
for (const file of ['index.html','styles.css','theme-light.css','app.js']) fs.copyFileSync(path.join(root,file),path.join(release,file));
for (const file of ['howell-source-data.js','master-draft-2026-10.js','product-image-map.js','howell-logo-color.png','howell-logo-white.png','howell-mark-color.png','howell-mark-white.png']) {
  const source=path.join(root,'assets',file);
  if (fs.existsSync(source)) fs.copyFileSync(source,path.join(release,'assets',file));
}
fs.cpSync(path.join(root,'assets','product-images'),path.join(release,'assets','product-images'),{recursive:true});
fs.writeFileSync(path.join(release,'assets','howell-runtime-config.js'),"window.HOWELL_SHARED_DATABASE=true;window.HOWELL_PORTAL_ROLE='admin';\n");
const built=spawnSync(process.execPath,[path.join(root,'scripts','build-warehouse-portal.cjs')],{
  cwd:root,stdio:'inherit',env:{...process.env,HOWELL_WAREHOUSE_OUT:path.join(release,'warehouse')}
});
if (built.status!==0) throw new Error('Warehouse portal build failed.');
console.log(`VPS release ready at ${release}. Admin and warehouse portals use the shared API; publish this directory only after server, TLS, auth, backup, and data migration are configured.`);
