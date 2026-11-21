'use strict';
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');
const archiveFile = path.join(root, 'release-update.tar.gz');
const sshKey = 'C:\\Users\\USER\\.ssh\\howell-inventory-vps';
const vps = 'howelladmin@103.150.227.170';

console.log('1. Building warehouse portal and VPS release bundle...');
execSync('node scripts/build-warehouse-portal.cjs', { cwd: root, stdio: 'inherit' });
execSync('node scripts/build-vps-release.cjs', { cwd: root, stdio: 'inherit' });

console.log('2. Creating compressed archive release-update.tar.gz...');
execSync(`tar -czf "${archiveFile}" -C "${releaseDir}" .`, { cwd: root, stdio: 'inherit' });

console.log('3. Uploading release archive to VPS...');
execSync(`scp -i "${sshKey}" "${archiveFile}" ${vps}:/tmp/release-update.tar.gz`, { stdio: 'inherit' });

console.log('4. Extracting release on VPS at /var/www/howell-inventory/release/ ...');
execSync(`ssh -i "${sshKey}" ${vps} "sudo tar -xzf /tmp/release-update.tar.gz -C /var/www/howell-inventory/release/ && sudo chown -R www-data:www-data /var/www/howell-inventory/release/ && rm -f /tmp/release-update.tar.gz"`, { stdio: 'inherit' });

if (fs.existsSync(archiveFile)) fs.unlinkSync(archiveFile);
console.log('Deployment to VPS complete!');
