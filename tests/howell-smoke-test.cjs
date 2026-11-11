const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const localAppPath = path.resolve(__dirname, '../app.js');
const appPath = process.argv[2] || (fs.existsSync(localAppPath) ? localAppPath : path.resolve(__dirname, '../outputs/Howell-Inventory/app.js'));
const appSource = fs.readFileSync(appPath, 'utf8');

function boot() {
  const listeners = {};
  const values = {};
  const makeElement = () => ({
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(name, fn) { this['on'+name] = fn; },
    querySelector(){ return null; },
    append(){},
    insertAdjacentHTML(){},
    focus(){},
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    value: '',
    lastElementChild: { innerHTML: '', textContent: '' }
  });
  const elements = new Map();
  const getElement = selector => {
    if (selector.startsWith('#pageContent .')) return null;
    if (selector === '#modalFields input,#modalFields select') return makeElement();
    if (!elements.has(selector)) elements.set(selector, makeElement());
    return elements.get(selector);
  };
  const document = {
    querySelector: getElement,
    querySelectorAll: () => [],
    createElement: () => makeElement(),
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  const localStorage = {
    getItem(key) { return values[key] || null; },
    setItem(key, value) { values[key] = value; }
  };
  class FormDataMock {
    constructor(form) { this.form = form; }
    entries() { return Object.entries(this.form.values); }
  }
  class MutationObserverMock {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  const sandbox = {
    document, localStorage, FormData: FormDataMock, MutationObserver: MutationObserverMock, structuredClone,
    Date, Intl, Math, Number, String, Object, Array, Map, Set, Event: class Event {},
    window: { scrollTo(){} }, setTimeout, clearTimeout, console
  };
  vm.runInNewContext(appSource, sandbox, { timeout: 3000 });
  const state = () => JSON.parse(values['howell-inventory-v1']);
  function click(action, id) {
    listeners.click({ target: { closest(selector) {
      if (selector === '[data-page]') return null;
      if (selector === '[data-action]') return { dataset: { action, id } };
      return null;
    } } });
  }
  function openPage(page) {
    listeners.click({ target: { closest(selector) {
      if (selector === '[data-page]') return { dataset: { page } };
      return null;
    } } });
  }
  function submit(formValues) {
    const form = getElement('#modalForm');
    assert.equal(typeof form.onsubmit, 'function', 'modal submit handler exists');
    form.onsubmit({ preventDefault(){}, currentTarget: { values: formValues } });
  }
  click('dismiss-demo');
  return { click, openPage, submit, state, elements };
}

{
  const app = boot();
  const before = app.state();
  app.click('add-sale');
  app.submit({id:'SR-PPR-20261101',store:'STR-PPR-005',start:'2026-11-08',end:'2026-11-08',sku:'ACC-HOU-001',qty:'1',discount:'0'});
  const after = app.state();
  assert.equal(after.sales.length, before.sales.length, 'duplicate sales report is rejected');
  assert.equal(after.invoices.length, before.invoices.length, 'duplicate report does not create another invoice');
}

{
  const app = boot();
  const before = app.state();
  app.click('add-sale');
  app.submit({id:'SR-NEW-001',store:'STR-PPR-005',start:'2026-11-08',end:'2026-11-08',sku:'ACC-HOU-001',qty:'2',discount:'0'});
  const after = app.state();
  assert.equal(after.sales.length, before.sales.length + 1, 'new sales report is stored');
  assert.equal(after.invoices.length, before.invoices.length + 1, 'sales report creates one invoice');
  assert.equal(after.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-001').sold, 20, 'branch stock is reduced once');
  assert.equal(after.sales[0].gross, 298000, 'gross sales equal quantity times SRP snapshot');
  assert.equal(after.sales[0].net, 298000, 'net sales subtract the recorded discount');
  const branch=after.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-001');
  assert.equal(branch.opening+branch.incoming-branch.sold-branch.returns,20,'branch stock follows the documented ending-stock formula');
  assert.equal(after.audit.filter(x=>x.entity==='sales-report').length, 1, 'sales report has an audit entry');
}

{
  const app = boot();
  const before = app.state();
  app.click('add-return');
  app.submit({id:'RMA-NEW-001',date:'2026-11-08',store:'STR-PPR-005',sku:'ACC-HOU-001',qty:'2',reason:'Slow Moving',condition:'Re-sellable',note:''});
  const after = app.state();
  assert.equal(after.products.find(x=>x.sku==='ACC-HOU-001').stock, before.products.find(x=>x.sku==='ACC-HOU-001').stock, 'return request does not increase central stock');
  assert.equal(after.returns[0].status, 'Menunggu penerimaan', 'return awaits warehouse receipt');
  app.click('confirm-return-receipt','RMA-NEW-001');
  app.submit({qty:'2',condition:'Re-sellable',receivedBy:'Warehouse staff',note:''});
  const received=app.state();
  assert.equal(received.products.find(x=>x.sku==='ACC-HOU-001').stock, before.products.find(x=>x.sku==='ACC-HOU-001').stock+2, 'verified resellable receipt increases central stock');
  assert.equal(received.returns[0].status, 'Diterima', 'return closes after receipt');
}

{
  const app = boot();
  app.click('add-shipment');
  app.submit({id:'DO-NEW-001',date:'2026-11-08',eta:'2026-11-10',store:'STR-PPR-005',sku1:'ACC-HOU-001',qty1:'2',sku2:'ACC-HOU-002',qty2:'3',sku3:'',qty3:'',sku4:'',qty4:'',notes:''});
  const after = app.state();
  const shipment = after.shipments.find(x=>x.id==='DO-NEW-001');
  assert.deepEqual(shipment.items.map(x=>x.qty), [2,3], 'delivery order stores multiple SKU lines');
  assert.equal(after.products.find(x=>x.sku==='ACC-HOU-001').stock, 126, 'first line is deducted from central stock');
  assert.equal(after.products.find(x=>x.sku==='ACC-HOU-002').stock, 73, 'additional line is deducted from central stock');
}

{
  const app = boot();
  app.click('add-shipment');
  app.submit({id:'DO-PARTIAL-001',date:'2026-11-08',eta:'2026-11-10',store:'STR-PPR-005',sku1:'ACC-HOU-001',qty1:'20',sku2:'ACC-HOU-002',qty2:'15',sku3:'',qty3:'',sku4:'',qty4:'',notes:''});
  app.click('receive-shipment','DO-PARTIAL-001');
  app.submit({recipient:'Staff',grn:'GRN-TEST-1',status:'Partial',received0:'10',received1:'7'});
  const first = app.state();
  const incoming1 = first.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-001').incoming;
  const incoming1b = first.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-002').incoming;
  app.click('receive-shipment','DO-PARTIAL-001');
  app.submit({recipient:'Staff',grn:'GRN-TEST-1',status:'Partial',received0:'14',received1:'7'});
  const second = app.state();
  const incoming2 = second.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-001').incoming;
  app.click('receive-shipment','DO-PARTIAL-001');
  app.submit({recipient:'Staff',grn:'GRN-TEST-1',status:'Received'});
  const final = app.state();
  const incomingFinal = final.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-001').incoming;
  const incomingFinal2 = final.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-002').incoming;
  assert.equal(incoming1, 34, 'first partial confirmation increases incoming once');
  assert.equal(incoming1b, 7, 'partial receipt tracks each SKU independently');
  assert.equal(incoming2, 38, 'cumulative confirmation adds only the newly received quantity');
  assert.equal(incomingFinal, 44, 'final receipt adds only the outstanding quantity');
  assert.equal(incomingFinal2, 15, 'all items on a multi-SKU DO are received correctly');
}

{
  const app = boot();
  const before = app.state();
  app.click('record-payment','INV-HWL-2026-1108');
  app.submit({amount:'99999999',paidDate:'2026-11-08',proof:'TRF-TEST',remaining:''});
  const after = app.state();
  assert.equal(after.invoices.find(x=>x.id==='INV-HWL-2026-1108').paid, before.invoices.find(x=>x.id==='INV-HWL-2026-1108').paid, 'overpayment is rejected');
}

{
  const app = boot();
  app.click('record-payment','INV-HWL-2026-1108');
  app.submit({amount:'500000',paidDate:'2026-11-08',proof:'TRF-TEST',remaining:''});
  const after=app.state(),invoice=after.invoices.find(x=>x.id==='INV-HWL-2026-1108');
  assert.equal(invoice.paid,500000,'valid partial payment is recorded');
  assert.equal(invoice.payments.length,1,'payment history is appended');
  assert.equal(invoice.status,'Partial','invoice status follows its remaining balance');
  assert.equal(invoice.netSales*(1-invoice.margin/100),2049600,'principal payout follows the existing invoice formula');
}

{
  const app=boot();
  app.openPage('reports');
  assert(app.elements.get('#pageContent').innerHTML.includes('Produk per kategori'),'reports page renders actual inventory summary');
  assert(app.elements.get('#pageContent').innerHTML.includes('Penjualan bersih'),'reports page includes sales summary');
}

{
  const app=boot();
  app.click('count-branch','STR-PPR-005|ACC-HOU-001');
  app.submit({physical:'25',note:'cycle count'});
  app.click('count-branch','STR-PPR-005|ACC-HOU-001');
  app.submit({physical:'24',note:'second count'});
  const after=app.state(),branch=after.branchStock.find(x=>x.store==='STR-PPR-005'&&x.sku==='ACC-HOU-001');
  assert.equal(branch.physical,24,'latest physical count is stored separately');
  assert.equal(branch.opening+branch.incoming-branch.sold-branch.returns,22,'opname does not overwrite system stock');
  assert.equal(after.countHistory.length,2,'previous physical counts are retained in stocktake history');
  assert.equal(after.countHistory[1].physical,25,'the first new count is retained after the next count');
}

console.log('Howell business-flow smoke checks passed (9 scenarios).');
