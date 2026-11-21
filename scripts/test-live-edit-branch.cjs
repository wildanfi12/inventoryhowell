'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const artifactDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\47f9ee7d-2113-4f3a-87e6-44500dd3548c';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempProfile = path.join(require('os').tmpdir(), 'chrome-cdp-profile-' + Date.now());

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
  const cdpPort = 9348;
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=1440,900',
    'https://inventory.howellcable.site/'
  ]);

  try {
    await sleep(2500);
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

    console.log('Waiting for live site to load...');
    await sleep(3500);

    console.log('Navigating to Cabang Retail page...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('button[data-page="stores"]');
        if (btn) btn.click();
      `
    });
    await sleep(2000);

    console.log('Opening Edit modal for store 31 on live server...');
    const triggerRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const toggle = document.getElementById('paperclipBranchesToggle');
          if (toggle) toggle.click();
          const btn = document.querySelector('button[data-action="edit-store"][data-id="31"]');
          if (btn) {
            btn.click();
            return { clicked: true, id: btn.dataset.id };
          }
          return { clicked: false };
        })()
      `
    });
    console.log('Click result on live server:', triggerRes.result.value);
    await sleep(1500);

    const inspectRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const backdrop = document.getElementById('modalBackdrop');
          const modal = backdrop ? backdrop.querySelector('.modal') : null;
          const modalRect = modal ? modal.getBoundingClientRect() : null;
          const fields = Array.from(document.querySelectorAll('#modalFields .field')).map(f => {
            const label = f.querySelector('label')?.textContent.trim();
            const input = f.querySelector('input, select, textarea');
            const type = input?.tagName.toLowerCase();
            const id = input?.id;
            const val = input?.value;
            const options = type === 'select' ? Array.from(input.options).map(o => ({ text: o.textContent.trim(), val: o.value, selected: o.selected })) : null;
            return { label, type, id, val, options, isFull: f.classList.contains('full') };
          });

          const submitBtn = document.getElementById('modalSubmit');
          const cancelBtn = document.getElementById('modalCancel');
          const submitRect = submitBtn ? submitBtn.getBoundingClientRect() : null;

          return {
            isOpen: backdrop?.classList.contains('open'),
            title: document.getElementById('modalTitle')?.textContent.trim(),
            modalRect: modalRect ? {
              top: modalRect.top,
              bottom: modalRect.bottom,
              height: modalRect.height,
              fitsInWindow: modalRect.bottom <= window.innerHeight
            } : null,
            submitBtn: submitRect ? {
              text: submitBtn.textContent.trim(),
              top: submitRect.top,
              bottom: submitRect.bottom,
              fitsInWindow: submitRect.bottom <= window.innerHeight
            } : null,
            fieldCount: fields.length,
            fields
          };
        })()
      `
    });

    console.log('Live inspection result:');
    console.log(JSON.stringify(inspectRes.result.value, null, 2));

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'live-verified-edit-branch.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved live-verified-edit-branch.png');

    cdp.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
