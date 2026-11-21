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
  const cdpPort = 9357;
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

    const pageWs = version[0].webSocketDebuggerUrl;
    const client = new CdpClient(pageWs);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await sleep(2500);

    // Navigate to Gudang
    await client.send('Runtime.evaluate', {
      expression: `
        const btn = [...document.querySelectorAll('button, a')].find(el => el.textContent.includes('Gudang'));
        if (btn) btn.click();
      `
    });
    await sleep(2000);

    // Click "Cetak surat jalan" with wait
    let clickOk = false;
    for (let i = 0; i < 10; i++) {
      const res = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Cetak surat jalan'));
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true
      });
      if (res.result?.value) {
        clickOk = true;
        break;
      }
      await sleep(500);
    }
    console.log('Button clicked:', clickOk);
    await sleep(1000);

    // Check select
    const changeResult = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const select = document.querySelector('#f-paperSize');
          if (select) {
            select.value = 'a4-portrait';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return { value: select.value, text: select.selectedOptions[0]?.text };
          }
          return null;
        })()
      `,
      returnByValue: true
    });
    console.log('Selected A4 option:', changeResult.result?.value);

    // Submit modal
    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('#modalSubmit')?.click()`
    });
    await sleep(1500);

    // Check after submit
    const afterSubmit = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const backdrop = document.querySelector('#modalBackdrop');
          const frames = [...document.querySelectorAll('iframe')].map(f => ({
            id: f.id,
            width: f.style.width,
            height: f.style.height,
            title: f.contentDocument?.title
          }));
          return {
            modalIsOpen: backdrop?.classList.contains('open'),
            frames
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After A4 submit state:', JSON.stringify(afterSubmit.result?.value, null, 2));

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
