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
  const cdpPort = 9355;
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=1440,900',
    'https://inventory.howellcable.site/'
  ]);

  try {
    let version = null;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      try {
        version = await fetchJson(`http://127.0.0.1:${cdpPort}/json/list`);
        if (version && version.length > 0) break;
      } catch (e) {}
    }

    if (!version || version.length === 0) {
      throw new Error('Chrome did not initialize CDP');
    }

    const pageWs = version[0].webSocketDebuggerUrl;
    const client = new CdpClient(pageWs);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Waiting for page load...');
    await sleep(2500);

    // Setup window.print mock to track prints without blocking
    await client.send('Runtime.evaluate', {
      expression: `
        window.__printedDocs = [];
        window.__originalPrint = window.print;
        window.print = function() {
          window.__printedDocs.push({ time: Date.now(), title: document.title });
        };
      `
    });

    // Navigate to warehouse (Gudang)
    console.log('Navigating to Gudang...');
    await client.send('Runtime.evaluate', {
      expression: `
        const btn = [...document.querySelectorAll('button, a')].find(el => el.textContent.includes('Gudang'));
        if (btn) btn.click();
      `
    });
    await sleep(1500);

    // Click "Cetak surat jalan" on the first row
    console.log('Clicking "Cetak surat jalan"...');
    const openResult = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Cetak surat jalan'));
          if (btn) {
            btn.click();
            return { clicked: true, text: btn.textContent };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true
    });
    console.log('Open modal click result:', openResult.result?.value);
    await sleep(800);

    // Verify modal state and options
    const modalState = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const backdrop = document.querySelector('#modalBackdrop');
          const title = document.querySelector('#modalTitle')?.textContent;
          const select = document.querySelector('#f-paperSize');
          const submitBtn = document.querySelector('#modalSubmit');
          const opts = select ? [...select.options].map(o => ({ value: o.value, text: o.text, selected: o.selected })) : [];
          return {
            isOpen: backdrop?.classList.contains('open'),
            title,
            hasSelect: !!select,
            selectedValue: select?.value,
            optionsCount: opts.length,
            options: opts,
            submitText: submitBtn?.textContent
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Modal State before submission:', JSON.stringify(modalState.result?.value, null, 2));

    // Capture screenshot of modal open with select options
    const shot1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'live-print-modal-verified.png'), Buffer.from(shot1.data, 'base64'));
    console.log('Saved screenshot: live-print-modal-verified.png');

    // Click modal submit button "Cetak surat jalan"
    console.log('Submitting modal: clicking submit button...');
    const submitResult = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const submitBtn = document.querySelector('#modalSubmit');
          if (submitBtn) {
            submitBtn.click();
            return { clicked: true, text: submitBtn.textContent };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true
    });
    console.log('Submit click result:', submitResult.result?.value);
    await sleep(1500);

    // Check modal closed and frame creation
    const afterSubmitState = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const backdrop = document.querySelector('#modalBackdrop');
          const frames = [...document.querySelectorAll('iframe')].map(f => ({
            id: f.id,
            width: f.style.width,
            height: f.style.height,
            hasDoc: !!f.contentDocument,
            title: f.contentDocument?.title
          }));
          return {
            modalIsOpen: backdrop?.classList.contains('open'),
            framesCount: frames.length,
            frames
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After submit state:', JSON.stringify(afterSubmitState.result?.value, null, 2));

    const shot2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'live-after-print-submit.png'), Buffer.from(shot2.data, 'base64'));
    console.log('Saved screenshot: live-after-print-submit.png');

    client.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
