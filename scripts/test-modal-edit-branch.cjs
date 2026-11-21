'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');
const artifactDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\47f9ee7d-2113-4f3a-87e6-44500dd3548c';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempProfile = path.join(require('os').tmpdir(), 'chrome-cdp-profile-' + Date.now());

function startStaticServer(dir, port) {
  const https = require('https');
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      const proxyReq = https.request('https://inventory.howellcable.site' + req.url, {
        method: req.method,
        headers: { ...req.headers, host: 'inventory.howellcable.site' }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      req.pipe(proxyReq);
      return;
    }

    let reqPath = req.url.split('?')[0].split('#')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(dir, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch(e){} }
}

async function run() {
  const staticPort = 8093;
  const cdpPort = 9343;
  const staticServer = await startStaticServer(releaseDir, staticPort);
  console.log(`Static server running on http://127.0.0.1:${staticPort}`);

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=1440,900',
    `http://127.0.0.1:${staticPort}/#stores`
  ]);

  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        await fetchJson(`http://127.0.0.1:${cdpPort}/json/version`);
        connected = true;
        break;
      } catch (e) {}
    }
    if (!connected) throw new Error('Chrome did not open remote debugging port in time');

    const list = await fetchJson(`http://127.0.0.1:${cdpPort}/json/list`);
    const pageTarget = list.find(t => t.type === 'page');
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting for stores page render...');
    await sleep(2500);

    console.log('Navigating to stores page...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('button[data-page="stores"]');
        if (btn) btn.click();
      `
    });
    await sleep(2000);

    // Open paperclip dropdown then click edit-store button
    console.log('Triggering Edit button for store 31...');
    const clickRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          // Set syncReady for local test
          if (typeof syncReady !== 'undefined') syncReady = true;
          window.syncReady = true;

          const toggle = document.getElementById('paperclipBranchesToggle');
          if (toggle) toggle.click();
          const btn = document.querySelector('button[data-action="edit-store"][data-id="31"]') || document.querySelector('button[data-action="edit-store"]');
          if (btn) {
            btn.click();
            return { clicked: true, id: btn.dataset.id };
          }
          return { clicked: false };
        })()
      `
    });
    console.log('Click result:', clickRes.result.value);

    await sleep(1000);

    // Inspect modal state
    const inspectRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const backdrop = document.getElementById('modalBackdrop');
          const modal = backdrop ? backdrop.querySelector('.modal') : null;
          const modalRect = modal ? modal.getBoundingClientRect() : null;
          const fieldsContainer = document.getElementById('modalFields');
          const grid = fieldsContainer ? fieldsContainer.querySelector('.field-grid') : null;
          const fields = fieldsContainer ? Array.from(fieldsContainer.querySelectorAll('.field')).map(f => {
            const label = f.querySelector('label')?.textContent.trim();
            const input = f.querySelector('input, select, textarea');
            const type = input?.tagName.toLowerCase();
            const id = input?.id;
            const name = input?.name;
            const val = input?.value;
            const readOnly = input?.readOnly;
            const options = type === 'select' ? Array.from(input.options).map(o => ({ value: o.value, text: o.textContent.trim(), selected: o.selected })) : null;
            return { label, type, id, name, val, readOnly, isFull: f.classList.contains('full'), options };
          }) : [];

          const submitBtn = document.getElementById('modalSubmit');
          const cancelBtn = document.getElementById('modalCancel');
          const submitRect = submitBtn ? submitBtn.getBoundingClientRect() : null;
          const cancelRect = cancelBtn ? cancelBtn.getBoundingClientRect() : null;

          return {
            isOpen: backdrop?.classList.contains('open'),
            title: document.getElementById('modalTitle')?.textContent.trim(),
            hasGrid: !!grid,
            modalRect: modalRect ? {
              top: modalRect.top,
              bottom: modalRect.bottom,
              height: modalRect.height,
              width: modalRect.width,
              windowHeight: window.innerHeight,
              fitsInWindow: modalRect.bottom <= window.innerHeight
            } : null,
            submitBtn: submitRect ? {
              text: submitBtn.textContent.trim(),
              top: submitRect.top,
              bottom: submitRect.bottom,
              fitsInWindow: submitRect.bottom <= window.innerHeight
            } : null,
            cancelBtn: cancelRect ? {
              text: cancelBtn.textContent.trim(),
              top: cancelRect.top,
              bottom: cancelRect.bottom,
              fitsInWindow: cancelRect.bottom <= window.innerHeight
            } : null,
            fieldCount: fields.length,
            fields
          };
        })()
      `
    });

    console.log('Modal inspection:');
    console.log(JSON.stringify(inspectRes.result.value, null, 2));

    // Capture screenshot of the opened modal
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'test-modal-edit-branch.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved test-modal-edit-branch.png');

    cdp.close();
  } finally {
    chrome.kill('SIGKILL');
    staticServer.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
