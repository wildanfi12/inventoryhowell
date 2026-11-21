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
  const cdpPort = 9350;
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

    console.log('Navigating to Gudang page...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('button[data-page="warehouse"]');
        if (btn) btn.click();
      `
    });
    await sleep(2000);

    console.log('Clicking Cetak surat jalan on Gudang page...');
    const clickRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const printBtn = document.querySelector('button[data-action="print-waybill"]');
          if (printBtn) {
            printBtn.click();
            return { clicked: true, id: printBtn.dataset.id, dispatchIndex: printBtn.dataset.dispatchIndex };
          }
          return { clicked: false };
        })()
      `
    });
    console.log('Print button click result:', clickRes.result.value);
    await sleep(1500);

    // Inspect modal state
    const modalRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const backdrop = document.getElementById('modalBackdrop');
          const modal = backdrop ? backdrop.querySelector('.modal') : null;
          const select = document.getElementById('f-paperSize');
          const options = select ? Array.from(select.options).map(o => ({ value: o.value, text: o.textContent.trim(), selected: o.selected })) : null;
          const submitBtn = document.getElementById('modalSubmit');
          return {
            isOpen: backdrop?.classList.contains('open'),
            title: document.getElementById('modalTitle')?.textContent.trim(),
            eyebrow: document.getElementById('modalEyebrow')?.textContent.trim(),
            submitText: submitBtn?.textContent.trim(),
            hasSelect: !!select,
            selectValue: select?.value,
            options
          };
        })()
      `
    });
    console.log('Print modal inspection:', JSON.stringify(modalRes.result.value, null, 2));

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'live-print-modal-check.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved live-print-modal-check.png');

    cdp.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
