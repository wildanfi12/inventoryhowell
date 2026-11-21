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
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png'
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

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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
  const staticPort = 8095;
  const cdpPort = 9346;
  const staticServer = await startStaticServer(releaseDir, staticPort);

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=1440,900',
    `http://127.0.0.1:${staticPort}/`
  ]);

  try {
    await sleep(2000);
    const versionInfo = await fetch(`http://127.0.0.1:${cdpPort}/json/version`).then(r => r.json());
    const list = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then(r => r.json());
    const pageTarget = list.find(t => t.type === 'page');
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(2500);

    for (const lang of ['en', 'zh']) {
      console.log(`--- Testing Language: ${lang} ---`);
      // Switch language
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = document.getElementById('langButton');
            if (btn) btn.click();
            const item = document.querySelector('button[data-lang="${lang}"]');
            if (item) item.click();
          })()
        `
      });
      await sleep(1500);

      // Navigate to stores
      await cdp.send('Runtime.evaluate', {
        expression: `
          const btn = document.querySelector('button[data-page="stores"]');
          if (btn) btn.click();
        `
      });
      await sleep(1500);

      // Open edit modal for 31
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const toggle = document.getElementById('paperclipBranchesToggle');
            if (toggle) toggle.click();
            const btn = document.querySelector('button[data-action="edit-store"][data-id="31"]');
            if (btn) btn.click();
          })()
        `
      });
      await sleep(1000);

      // Inspect labels
      const evalRes = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `
          (() => {
            return {
              title: document.getElementById('modalTitle')?.textContent.trim(),
              submit: document.getElementById('modalSubmit')?.textContent.trim(),
              cancel: document.getElementById('modalCancel')?.textContent.trim(),
              labels: Array.from(document.querySelectorAll('#modalFields .field label')).map(l => l.textContent.trim()),
              termOptions: Array.from(document.getElementById('f-term')?.options || []).map(o => o.textContent.trim()),
              agreementOptions: Array.from(document.getElementById('f-agreementStatus')?.options || []).map(o => o.textContent.trim())
            };
          })()
        `
      });
      console.log(`Result for ${lang}:`, evalRes.result.value);

      // Screenshot
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artifactDir, `test-modal-edit-branch-${lang}.png`), Buffer.from(shot.data, 'base64'));

      // Close modal
      await cdp.send('Runtime.evaluate', {
        expression: `
          const close = document.getElementById('modalCancel') || document.getElementById('modalClose');
          if (close) close.click();
        `
      });
      await sleep(500);
    }

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
