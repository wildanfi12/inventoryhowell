'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
process.umask(0o077);

// Keep the default separate from Howell StockFlow's existing port (3001).
const port = Number(process.env.PORT || 3103);
const host = process.env.HOST || '127.0.0.1';
const dbPath = path.resolve(process.env.HOWELL_DB_PATH || path.join(__dirname, 'data', 'howell-inventory.sqlite'));
const maxBodyBytes = 12 * 1024 * 1024;
const authUser = process.env.HOWELL_API_USER || '';
const authPassword = process.env.HOWELL_API_PASSWORD || '';
const warehouseUser = process.env.HOWELL_WAREHOUSE_USER || '';
const warehousePassword = process.env.HOWELL_WAREHOUSE_PASSWORD || '';
const publicPortals = process.env.HOWELL_PUBLIC_PORTALS === 'true';

if (!authUser || !authPassword || !warehouseUser || !warehousePassword || authUser === warehouseUser) {
  console.error('Admin and warehouse API credentials are required and must use different usernames.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dbPath);
fs.chmodSync(dbPath, 0o600);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS inventory_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    revision INTEGER NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inventory_state_audit (
    revision INTEGER PRIMARY KEY,
    changed_at TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    payload_sha256 TEXT NOT NULL
  );
`);

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function authorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    if (publicPortals) {
      const hostname = String(req.headers.host || '').split(':')[0].toLowerCase();
      if (hostname === 'inventory.howellcable.site') return { role: 'admin', username: 'public-admin' };
      if (hostname === 'gudang.inventory.howellcable.site') return { role: 'warehouse', username: 'public-warehouse' };
    }
    return false;
  }
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const split = decoded.indexOf(':');
  if (split < 1) return false;
  const user = Buffer.from(decoded.slice(0, split));
  const password = Buffer.from(decoded.slice(split + 1));
  const username = decoded.slice(0, split);
  for (const account of [
    { role: 'admin', user: authUser, password: authPassword },
    { role: 'warehouse', user: warehouseUser, password: warehousePassword }
  ]) {
    const expectedUser = Buffer.from(account.user);
    const expectedPassword = Buffer.from(account.password);
    if (user.length === expectedUser.length && password.length === expectedPassword.length &&
        crypto.timingSafeEqual(user, expectedUser) && crypto.timingSafeEqual(password, expectedPassword)) {
      return { role: account.role, username };
    }
  }
  return null;
}

const warehouseProductKeys = new Set(['sku','barcode','name','spec','category','brand','uom','stock','stockSource','sourceSheet','sourceRow']);
const warehouseStoreKeys = new Set(['code','name','network','region','address','contact','phone','capacity','agreementStatus','effectiveDate','source']);
const warehouseOrderKeys = new Set(['id','date','eta','store','items','status','recipient','grn','customerName','responsible','shipTo','dispatches','dispatchNumber','dispatchDate','stockDispatched','warehouseReviewNote','warehouseReviewedAt','approvedAt']);
const safeFields = (row, keys) => Object.fromEntries(Object.entries(row || {}).filter(([key]) => keys.has(key)));
const warehouseProjection = state => ({
  demo: false, seedVersion: state.seedVersion,
  products: state.products.map(product => Object.fromEntries(Object.entries(product).filter(([key]) => warehouseProductKeys.has(key)))),
  stores: state.stores.map(store => Object.fromEntries(Object.entries(store).filter(([key]) => warehouseStoreKeys.has(key)))),
  shipments: state.shipments.map(order => ({
    ...safeFields(order, warehouseOrderKeys),
    items: order.items.map(item => ({...safeFields(item, new Set(['sku','qty','orderedQty','dispatchedQty','receivedQty','barcodeSnapshot'])),receipts:(item.receipts||[]).map(receipt=>safeFields(receipt,new Set(['qty','date','grn'])))})),
    dispatches: (order.dispatches || []).map(dispatch => safeFields(dispatch, new Set(['number','date','sender','driver','recipient','note','warehouse','items'])).items
      ? { ...safeFields(dispatch, new Set(['number','date','sender','driver','recipient','note','warehouse'])), items: (dispatch.items || []).map(item => safeFields(item, new Set(['sku','qty']))) }
      : safeFields(dispatch, new Set(['number','date','sender','driver','recipient','note','warehouse'])))
  })),
  sales: [], invoices: [],
  returns: state.returns.map(row => ({...safeFields(row,new Set(['id','date','store','sku','qty','reason','condition','note','status','receivedQty','receipts'])),receipts:(row.receipts||[]).map(item=>safeFields(item,new Set(['qty','condition','receivedBy','date','note'])))})),
  branchStock: [],
  counts: state.counts.filter(row => row.level === 'Gudang pusat' || !row.level).map(row => safeFields(row,new Set(['sku','physical','previous','date','source','actor','updatedAt']))),
  countHistory: state.countHistory.filter(row => row.level === 'Gudang pusat').map(row => safeFields(row,new Set(['level','sku','physical','previous','delta','date','at','archivedAt','source','actor']))),
  audit: []
});

function mergeWarehouseState(current, candidate, username) {
  if (!validState(candidate)) return null;
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const whole = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0;
  if (candidate.products.length !== current.products.length) return null;
  const products = current.products.map(old => {
    const next = candidate.products.find(row => row.sku === old.sku);
    if (!next || Object.keys(next).some(key => !['sku','barcode','name','spec','category','brand','uom','stock','stockSource','sourceSheet','sourceRow'].includes(key))) return null;
    if (old.stock != null && (next.stock == null || next.stock === undefined)) return null;
    if (next.stock !== null && next.stock !== undefined && (!Number.isSafeInteger(Number(next.stock)) || Number(next.stock) < 0)) return null;
    if (next.stockSource && !['Bizgo','Gudang'].includes(next.stockSource)) return null;
    const clean = { ...old, stock: next.stock, stockSource: next.stockSource };
    return clean;
  });
  if (products.some(row => !row)) return null;
  if (candidate.shipments.length !== current.shipments.length) return null;
  const shipments = current.shipments.map(old => {
    const next = candidate.shipments.find(row => row.id === old.id);
    const itemKeys=new Set(['sku','qty','orderedQty','dispatchedQty','receivedQty','barcodeSnapshot','receipts']);
    const publicItems = old.items.map(item => ({...safeFields(item,new Set(['sku','qty','orderedQty','dispatchedQty','receivedQty','barcodeSnapshot'])),receipts:(item.receipts||[]).map(receipt=>safeFields(receipt,new Set(['qty','date','grn'])))}));
    if (!next || Object.keys(next).some(key => !warehouseOrderKeys.has(key)) || next.items.some(item=>Object.keys(item).some(key=>!itemKeys.has(key))) || !equal(next.items.map(({dispatchedQty, ...item}) => item), publicItems.map(({dispatchedQty, ...item}) => item))) return null;
    if (next.items.length !== old.items.length || !Array.isArray(next.dispatches)) return null;
    const protectedOld = Object.fromEntries(Object.entries(old).filter(([key]) => warehouseOrderKeys.has(key))); const protectedNext = { ...next };
    for (const key of ['status','warehouseReviewNote','warehouseReviewedAt','approvedAt','dispatches','dispatchNumber','dispatchDate','stockDispatched','items']) { delete protectedOld[key]; delete protectedNext[key]; }
    if (!equal(protectedOld, protectedNext)) return null;
    if (!['Draft','Menunggu verifikasi','Disetujui','Tidak disetujui','Ditangguhkan','Partial','Dikirim'].includes(next.status)) return null;
    return { ...old, status: next.status, warehouseReviewNote: next.warehouseReviewNote, warehouseReviewedAt: next.warehouseReviewedAt, approvedAt: next.approvedAt, dispatches: next.dispatches, dispatchNumber: next.dispatchNumber, dispatchDate: next.dispatchDate, stockDispatched: next.stockDispatched, items: old.items.map(item => ({...item, dispatchedQty: next.items.find(candidateItem => candidateItem.sku === item.sku)?.dispatchedQty})) };
  });
  if (shipments.some(row => !row)) return null;
  const mutableKeys = ['products','shipments','counts','countHistory','audit','returns'];
  const visible = warehouseProjection(current);
  const nonmutableKeys = Object.keys(current).filter(key => !mutableKeys.includes(key));
  if (nonmutableKeys.some(key => !equal(candidate[key], visible[key]))) return null;
  if (candidate.returns.length !== current.returns.length || candidate.branchStock.length !== 0 || candidate.audit.length > 20) return null;
  const returns = current.returns.map(old => {
    const next = candidate.returns.find(row => row.id === old.id);
    if (!next) return null;
    const returnKeys=new Set(['id','date','store','sku','qty','reason','condition','note','status','receivedQty','receipts']);
    const before = safeFields(old,returnKeys), after = { ...next };
    for (const key of ['status','receivedQty','receipts']) { delete before[key]; delete after[key]; }
    if (!equal(before, after) || !['Menunggu konfirmasi cabang','Dalam perjalanan','Partial','Diterima'].includes(next.status) || !whole(next.receivedQty || 0) || Number(next.receivedQty || 0) < Number(old.receivedQty || 0) || Number(next.receivedQty || 0) > Number(old.qty || 0) || !Array.isArray(next.receipts) || next.receipts.length < (old.receipts||[]).length) return null;
    const oldReceipts=old.receipts||[], added=next.receipts.slice(oldReceipts.length);
    if (!oldReceipts.every((receipt,index)=>equal(safeFields(receipt,new Set(['qty','condition','receivedBy','date','note'])),next.receipts[index])) || added.some(receipt=>Object.keys(receipt).some(key=>!['qty','condition','receivedBy','date','note'].includes(key))||!whole(receipt.qty)||Number(receipt.qty)<1||!String(receipt.receivedBy||'').trim()) || added.reduce((sum,receipt)=>sum+Number(receipt.qty),0)!==Number(next.receivedQty||0)-Number(old.receivedQty||0)) return null;
    if (!added.length && next.status!==old.status) return null;
    if (added.length && next.status!==(Number(next.receivedQty)===Number(old.qty)?'Diterima':'Partial')) return null;
    return { ...old, status: next.status, receivedQty: next.receivedQty, receipts: next.receipts.map(receipt=>({...receipt,receivedBy:username})) };
  });
  if (returns.some(row => !row)) return null;
  // Warehouse stock changes must be backed by a dispatch, a verified physical count,
  // or a received re-sellable return. This prevents arbitrary balance overwrites.
  const stockDeltas = new Map();
  for (const old of current.products) {
    const next=products.find(row=>row.sku===old.sku);
    if ((next.stock??null)!==(old.stock??null) || next.stockSource!==old.stockSource) stockDeltas.set(old.sku,{before:old.stock??null,after:next.stock??null,delta:(old.stock==null||next.stock==null)?null:Number(next.stock)-Number(old.stock)});
  }
  const dispatched = new Map();
  const seenDispatchNumbers=new Set(current.shipments.flatMap(order=>(order.dispatches||[]).map(entry=>String(entry.number||'').toLowerCase())));
  for (const old of current.shipments) {
    const next=shipments.find(row=>row.id===old.id);
    const dispatchKeys=new Set(['number','date','sender','driver','recipient','note','warehouse','items']);
    const oldDispatches=(old.dispatches||[]).map(entry=>({...safeFields(entry,new Set(['number','date','sender','driver','recipient','note','warehouse'])),items:(entry.items||[]).map(item=>safeFields(item,new Set(['sku','qty'])))})), newDispatches=next.dispatches||[];
    if (newDispatches.length<oldDispatches.length || !oldDispatches.every((entry,index)=>equal(entry,newDispatches[index])) || newDispatches.some(entry=>Object.keys(entry).some(key=>!dispatchKeys.has(key)))) return null;
    const newRows=newDispatches.slice(oldDispatches.length);
    if (newRows.length>1) return null;
    const orderDispatched=new Map();
    for (const dispatch of newRows) {
      const dispatchNumber=String(dispatch.number||'').toLowerCase();
      if (!dispatchNumber || seenDispatchNumbers.has(dispatchNumber) || !dispatch.date || !dispatch.sender || !dispatch.driver || !dispatch.recipient || !Array.isArray(dispatch.items) || !dispatch.items.length) return null;
      seenDispatchNumbers.add(dispatchNumber);
      for (const line of dispatch.items) {
        if (!whole(line.qty)||Number(line.qty)<1||!old.items.some(item=>item.sku===line.sku)) return null;
        orderDispatched.set(line.sku,(orderDispatched.get(line.sku)||0)+Number(line.qty));
        dispatched.set(line.sku,(dispatched.get(line.sku)||0)+Number(line.qty));
      }
    }
    for (const oldItem of old.items) {
      const nextItem=next.items.find(item=>item.sku===oldItem.sku), delta=Number(nextItem.dispatchedQty||0)-Number(oldItem.dispatchedQty||0);
      if (!whole(nextItem.dispatchedQty||0)||delta<0||delta>(Number(oldItem.orderedQty??oldItem.qty)-Number(oldItem.dispatchedQty||0))) return null;
      if (delta!==(orderDispatched.get(oldItem.sku)||0)) return null;
    }
    const changedStatus=next.status!==old.status;
    if (!changedStatus && !newRows.length && ['warehouseReviewNote','warehouseReviewedAt','approvedAt','dispatchNumber','dispatchDate','stockDispatched'].some(key=>!equal(next[key],old[key]))) return null;
    if (newRows.length) {
      const fullyDispatched=next.items.every(item=>Number(item.dispatchedQty||0)>=Number(item.orderedQty??item.qty));
      if (next.status!==(fullyDispatched?'Dikirim':'Partial') || next.dispatchNumber!==newRows.at(-1).number || next.dispatchDate!==newRows.at(-1).date || next.stockDispatched!==true) return null;
    } else if (changedStatus && !['Disetujui','Tidak disetujui','Ditangguhkan'].includes(next.status)) return null;
    if (changedStatus && (!next.warehouseReviewedAt || (next.status==='Disetujui'&&!next.approvedAt))) return null;
    if (changedStatus && next.status==='Disetujui' && old.dispatches?.length) return null;
    if (changedStatus && next.status==='Tidak disetujui' && old.dispatches?.length) return null;
    if (changedStatus && next.status==='Ditangguhkan' && old.dispatches?.length) return null;
  }
  const newHistory = candidate.countHistory.filter(row=>!current.countHistory.some(old=>equal(safeFields(old,new Set(['level','sku','physical','previous','delta','date','at','archivedAt','source','actor'])),row)));
  const latestCountBySku = new Map();
  for (const row of newHistory) {
    const allowedHistoryKeys=['level','sku','physical','previous','delta','date','at','archivedAt','source','actor'];
    if (Object.keys(row).some(key=>!allowedHistoryKeys.includes(key)) || row.level!=='Gudang pusat' || !products.some(product=>product.sku===row.sku) || !whole(row.physical) || (row.previous!=null&&!whole(row.previous)) || !['Bizgo','Gudang'].includes(row.source) || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date||''))) return null;
    const expectedDelta=row.previous==null?null:Number(row.physical)-Number(row.previous);
    if ((row.delta??null)!==expectedDelta || (row.previous==null&&row.archivedAt)) return null;
    if (latestCountBySku.has(row.sku)) return null;
    latestCountBySku.set(row.sku,row);
  }
  if (candidate.countHistory.length < visible.countHistory.length || !visible.countHistory.every(old=>candidate.countHistory.some(row=>equal(old,row)))) return null;
  const countsBySku=new Map();
  for (const row of candidate.counts) {
    if (!row || Object.keys(row).some(key=>!['sku','physical','previous','date','source','actor','updatedAt'].includes(key)) || countsBySku.has(row.sku) || !products.some(product=>product.sku===row.sku) || !whole(row.physical) || !['Bizgo','Gudang'].includes(row.source) || !String(row.actor||'').trim()) return null;
    const currentRow=current.counts.find(item=>item.sku===row.sku);
    const isNewCount=latestCountBySku.has(row.sku),product=products.find(product=>product.sku===row.sku);
    if (currentRow && !isNewCount && !equal(currentRow,row)) return null;
    if (!currentRow && !isNewCount) return null;
    if (isNewCount && (Number(product.stock)!==Number(row.physical) || product.stockSource!==row.source || (row.previous??null)!==(currentRow?.physical??null))) return null;
    if (isNewCount) {
      const history=latestCountBySku.get(row.sku);
      if (!history || history.physical!==row.physical || history.source!==row.source || (history.previous??null)!==(row.previous??null) || history.date!==row.date) return null;
    }
    countsBySku.set(row.sku,{...row,actor:isNewCount?username:(currentRow?.actor||row.actor)});
  }
  for (const oldRow of current.counts) if (!countsBySku.has(oldRow.sku)) return null;
  for (const [sku, change] of stockDeltas) {
    const fromDispatch=dispatched.get(sku)||0;
    const fromReturn=returns.reduce((sum,row,index)=>sum+(row.sku===sku ? (row.receipts||[]).slice((current.returns[index].receipts||[]).length).reduce((s,r)=>s+(r.condition==='Re-sellable'?Number(r.qty):0),0):0),0);
    const count=latestCountBySku.get(sku);
    if (count) {
      if (count.physical!==change.after || (count.previous??null)!==change.before || fromDispatch || fromReturn) return null;
      if (!countsBySku.has(sku)) return null;
    } else if (change.delta!==fromReturn-fromDispatch) return null;
  }
  for (const [sku,qty] of dispatched) {
    const change=stockDeltas.get(sku), oldStock=current.products.find(p=>p.sku===sku)?.stock;
    if (!change || oldStock==null || change.delta!==-qty) return null;
  }
  for (const sku of latestCountBySku.keys()) if (!stockDeltas.has(sku)) return null;
  const warehouseEvents=[];
  for(const old of current.shipments){const next=shipments.find(row=>row.id===old.id);if(next.status!==old.status)warehouseEvents.push({action:'warehouse-status',entity:'purchase-order',entityId:old.id});if((next.dispatches||[]).length>(old.dispatches||[]).length)warehouseEvents.push({action:'dispatch',entity:'purchase-order',entityId:old.id});}
  for(const old of current.returns){const next=returns.find(row=>row.id===old.id);if((next.receipts||[]).length>(old.receipts||[]).length)warehouseEvents.push({action:'receive',entity:'return',entityId:old.id});}
  const now=new Date().toISOString();
  const safeAudit=warehouseEvents.map(event=>({id:crypto.randomUUID(),...event,actor:username,at:now,details:{}}));
  const trustedHistory=candidate.countHistory.map(row=>newHistory.includes(row)?{...row,actor:username}:row);
  const merged = { ...current, products, shipments, returns, counts: [...countsBySku.values()], countHistory: [...current.countHistory.filter(row => row.level !== 'Gudang pusat'), ...trustedHistory], audit: [...current.audit,...safeAudit] };
  return merged;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error('Payload melebihi batas 12 MB.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON tidak valid.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function validState(state) {
  const arrays = ['products', 'stores', 'shipments', 'sales', 'invoices', 'returns', 'branchStock', 'counts', 'countHistory', 'audit'];
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (arrays.some(key => !Array.isArray(state[key]))) return false;
  if (state.products.some(x => !x || typeof x.sku !== 'string' || !x.sku.trim())) return false;
  if (state.stores.some(x => !x || typeof x.code !== 'string' || !x.code.trim())) return false;
  if (state.shipments.some(x => !x || typeof x.id !== 'string' || !Array.isArray(x.items))) return false;
  const unique = (rows, field) => new Set(rows.map(x => x[field])).size === rows.length;
  return unique(state.products, 'sku') && unique(state.stores, 'code') && unique(state.shipments, 'id');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });
  if (!url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
  const account = authorized(req);
  if (!account) {
    res.writeHead(401, { 'www-authenticate': 'Basic realm="Howell Inventory", charset="UTF-8"', 'cache-control': 'no-store' });
    return res.end('Authentication required');
  }
  if (url.pathname !== '/api/state') return json(res, 404, { error: 'Not found' });

  if (req.method === 'GET') {
    const row = db.prepare('SELECT revision, payload, updated_at AS updatedAt FROM inventory_state WHERE singleton = 1').get();
    if (!row) return json(res, 200, { revision: 0, state: null });
    try { const state = JSON.parse(row.payload); return json(res, 200, { revision: row.revision, updatedAt: row.updatedAt, state: account.role === 'warehouse' ? warehouseProjection(state) : state }); }
    catch (error) { console.error('Database payload tidak dapat dibaca:', error); return json(res, 500, { error: 'Data server tidak dapat dibaca.' }); }
  }

  if (req.method === 'PUT') {
    const match = String(req.headers['if-match'] || '').match(/^"?(\d+)"?$/);
    if (!match) return json(res, 428, { error: 'If-Match revision wajib disertakan.' });
    const expectedRevision = Number(match[1]);
    let body;
    try { body = await readBody(req); }
    catch (error) { return json(res, error.status || 400, { error: error.message || 'Request tidak dapat dibaca.' }); }
    if (!validState(body.state)) return json(res, 422, { error: 'Struktur atau identitas data tidak valid.' });
    const updatedAt = new Date().toISOString();
    const updatedBy = `${account.role}:${account.username}`.slice(0, 100);
    try {
      db.exec('BEGIN IMMEDIATE');
      const current = db.prepare('SELECT revision FROM inventory_state WHERE singleton = 1').get();
      const currentRevision = current?.revision || 0;
      if (currentRevision !== expectedRevision) {
        db.exec('ROLLBACK');
        return json(res, 409, { error: 'Data telah berubah di perangkat lain.', revision: currentRevision });
      }
      const currentRow = db.prepare('SELECT payload FROM inventory_state WHERE singleton = 1').get();
      const currentState = currentRow ? JSON.parse(currentRow.payload) : null;
      const nextState = account.role === 'warehouse' ? (currentState && mergeWarehouseState(currentState, body.state, account.username)) : body.state;
      if (!nextState) { db.exec('ROLLBACK'); return json(res, 403, { error: 'Akun gudang hanya dapat mengubah stok, opname, keputusan PO, surat jalan, dan riwayatnya.' }); }
      const payload = JSON.stringify(nextState);
      const digest = crypto.createHash('sha256').update(payload).digest('hex');
      const nextRevision = currentRevision + 1;
      db.prepare(`INSERT INTO inventory_state(singleton, revision, payload, updated_at, updated_by)
        VALUES(1, ?, ?, ?, ?) ON CONFLICT(singleton) DO UPDATE SET
        revision=excluded.revision, payload=excluded.payload, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
        .run(nextRevision, payload, updatedAt, updatedBy);
      db.prepare('INSERT INTO inventory_state_audit(revision, changed_at, changed_by, payload_sha256) VALUES(?, ?, ?, ?)')
        .run(nextRevision, updatedAt, updatedBy, digest);
      db.exec('COMMIT');
      return json(res, 200, { revision: nextRevision, updatedAt });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('Gagal menyimpan state Inventory:', error);
      return json(res, 500, { error: 'Database gagal menyimpan perubahan.' });
    }
  }
  res.setHeader('allow', 'GET, PUT');
  return json(res, 405, { error: 'Method not allowed' });
});

server.listen(port, host, () => console.log(`Howell Inventory API listening on http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { db.close(); process.exit(0); });
});
