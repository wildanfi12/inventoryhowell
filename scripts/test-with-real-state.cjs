'use strict';
const fs = require('fs');
const https = require('https');
const vm = require('vm');

https.get('https://inventory.howellcable.site/api/state', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const remote = JSON.parse(body);
    const serverState = remote.state;
    console.log('Fetched server state. Products:', serverState.products.length, 'Shipments:', serverState.shipments.length);

    // Now test in browser environment with headless Chrome connected to production!
    testWithBrowser();
  });
}).on('error', console.error);

async function testWithBrowser() {
  const { spawn } = require('child_process');
  const path = require('path');
  const http = require('http');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9231;
  const tempProfile = path.join(require('os').tmpdir(), 'chrome-cdp-profile-' + Date.now());

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tempProfile}`,
    'about:blank'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);

  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  const versionInfo = await fetchJson(`http://127.0.0.1:${cdpPort}/json/version`);
  const WebSocket = global.WebSocket;
  const ws = new WebSocket(versionInfo.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[PROD CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[PROD EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description || '');
    }
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      callbacks.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  await send('Target.setDiscoverTargets', { discover: true });
  const targets = await fetchJson(`http://127.0.0.1:${cdpPort}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page');

  const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => pageWs.onopen = r);

  let pageId = 1;
  const pageCallbacks = new Map();
  pageWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[PROD CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[PROD EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description || '');
    }
    if (msg.id && pageCallbacks.has(msg.id)) {
      const cb = pageCallbacks.get(msg.id);
      pageCallbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
  };

  function sendPage(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = pageId++;
      pageCallbacks.set(reqId, { resolve, reject });
      pageWs.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  async function evaluate(expr) {
    const res = await sendPage('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error('Eval error: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  await sendPage('Page.enable');
  await sendPage('Runtime.enable');
  console.log('\nNavigating to production: https://inventory.howellcable.site/');
  await sendPage('Page.navigate', { url: 'https://inventory.howellcable.site/' });
  await sleep(4000);

  const pages = ['dashboard', 'products', 'stores', 'shipments', 'warehouse', 'inventory', 'sales', 'returns', 'reports', 'settings'];

  for (const p of pages) {
    console.log(`\n--- Checking LIVE page: ${p} ---`);
    await evaluate(`
      document.querySelector('.nav-item[data-page="${p}"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    `);
    await sleep(800);

    const status = await evaluate(`
      (() => {
        const errorEl = document.querySelector('.page-error');
        const heading = document.querySelector('h1')?.textContent;
        return {
          hasError: Boolean(errorEl),
          errorText: errorEl ? errorEl.textContent.trim() : null,
          heading
        };
      })()
    `);
    console.log(`Page ${p} status:`, status);
  }

  chromeProc.kill();
  process.exit(0);
}
