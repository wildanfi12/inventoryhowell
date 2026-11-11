const { chromium } = require('playwright');
const targets = [
  {name:'utama', url:'https://inventory.howellcable.site/', pages:['Master Produk','Cabang Retail','Purchase Order','Stok & Opname','Retur Barang']},
  {name:'gudang', url:'https://gudang.inventory.howellcable.site/', pages:['Stok & Opname','Retur Barang']}
];
(async()=>{
  const browser=await chromium.launch({headless:true}); const out=[];
  for(const target of targets){
    const page=await browser.newPage({viewport:{width:1440,height:900}}); const errors=[]; const pageErrors=[];
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(target.url,{waitUntil:'networkidle',timeout:45000});
    const initial=await page.title(); const nav=[];
    for(const label of target.pages){
      const item=page.getByText(label,{exact:true}).first(); const exists=await item.count()>0; let clicked=false, content='';
      if(exists){await item.click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(250); clicked=true; content=(await page.locator('body').innerText()).slice(0,160)}
      nav.push({label,exists,clicked,content});
    }
    const search=page.locator('input').first(); let searchWorked=false;
    if(await search.count()){await search.fill('kabel'); await page.waitForTimeout(300); searchWorked=true}
    let opened=0, closed=0; const buttons=page.locator('button'); const n=Math.min(await buttons.count(),40);
    for(let i=0;i<n;i++){
      const b=buttons.nth(i); const t=(await b.innerText().catch(()=>'' )).trim().toLowerCase();
      if(/detail|lihat|buat|tambah|opname|perbarui|retur|cabang|filter/.test(t)){
        await b.click({timeout:1200}).catch(()=>{}); await page.waitForTimeout(150);
        const popup=page.locator('[role="dialog"],.modal,[data-modal]').first();
        if(await popup.count() && await popup.isVisible().catch(()=>false)){opened++; const close=popup.getByText(/tutup|close|batal/i).first(); if(await close.count()){await close.click().catch(()=>{}); await page.waitForTimeout(100); if(!(await popup.isVisible().catch(()=>false)))closed++}}
      }
    }
    out.push({target:target.name,title:initial,nav,searchWorked,popupsOpened:opened,popupsClosed:closed,consoleErrors:errors,pageErrors}); await page.close();
  }
  await browser.close(); console.log(JSON.stringify(out,null,2)); process.exit(out.some(x=>x.pageErrors.length)?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
