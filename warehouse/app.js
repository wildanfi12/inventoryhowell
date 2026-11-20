(() => {
  const KEY='howell-inventory-v1';
  const sourceRaw=window.HOWELL_SOURCE_DATA||{};
  const source={products:(Array.isArray(sourceRaw.products)?sourceRaw.products:[]).filter(x=>x&&typeof x==='object'),paperclipBranches:(Array.isArray(sourceRaw.paperclipBranches)?sourceRaw.paperclipBranches:[]).filter(x=>x&&typeof x==='object')};
  // Keep the shared catalog name consistent across the main and warehouse portals.
  const hw05=source.products.find(item=>item&&item.sku==='HW05');
  if(hw05)hw05.name=String(hw05.name||'').replace(/\s+WHITE$/i,'');
  const initial={products:source.products.map(x=>({...x,stock:null,stockSource:null})),stores:source.paperclipBranches.map(x=>({...x,agreementStatus:'Perlu perjanjian',effectiveDate:''})),shipments:[],sales:[],invoices:[],returns:[],branchStock:[],counts:[],countHistory:[],audit:[],demo:false,seedVersion:2};
  const demoIds={shipments:new Set(['DO-HWL-20261102-001','DO-HWL-20261101-003']),sales:new Set(['SR-PPR-20261101','SR-EC-20261029','SR-PPR-20261025']),invoices:new Set(['INV-HWL-2026-1108','INV-HWL-2026-1105','INV-HWL-2026-1031']),returns:new Set(['RMA-HWL-2026-014']),products:new Set(['ACC-HOU-001','ACC-HOU-002','CAB-HOU-014','AUD-HOU-003','CAB-HOU-021','ACC-HOU-011']),stores:new Set(['STR-PPR-005','STR-PPR-002','STR-ELC-008','STR-PPR-009'])};
  let legacy=null,recoveryNotice='';try{const raw=localStorage.getItem(KEY);if(raw!==null){try{legacy=JSON.parse(raw)}catch(error){console.error('Data Howell lama tidak valid:',error);try{localStorage.setItem(KEY+'-recovery-latest',raw);recoveryNotice='Data browser tidak dapat dibaca; salinan pemulihan lokal sudah dibuat.'}catch{recoveryNotice='Data browser tidak dapat dibaca dan ruang penyimpanan tidak cukup untuk membuat salinan pemulihan.'}}}}catch(error){console.error('Penyimpanan browser tidak tersedia:',error);recoveryNotice='Penyimpanan browser tidak tersedia; perubahan mungkin tidak dapat disimpan.'}
  let data=structuredClone(initial);
  if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)){
    ['products','stores','shipments','sales','invoices','returns','branchStock','counts','countHistory','audit'].forEach(key=>{legacy[key]=Array.isArray(legacy[key])?legacy[key].filter(x=>x&&typeof x==='object'):[]});
    legacy.shipments.forEach(x=>{x.items=Array.isArray(x.items)?x.items.filter(i=>i&&typeof i==='object'):[]});
    try{if(!localStorage.getItem(KEY+'-recovery-latest'))localStorage.setItem(KEY+'-recovery-latest',JSON.stringify(legacy))}catch{}
    const shipments=(Array.isArray(legacy.shipments)?legacy.shipments:[]).filter(x=>x&&typeof x==='object'&&!demoIds.shipments.has(x.id));
    const sales=(Array.isArray(legacy.sales)?legacy.sales:[]).filter(x=>x&&typeof x==='object'&&!demoIds.sales.has(x.id));
    const invoices=(Array.isArray(legacy.invoices)?legacy.invoices:[]).filter(x=>x&&typeof x==='object'&&!demoIds.invoices.has(x.id));
    const returns=(Array.isArray(legacy.returns)?legacy.returns:[]).filter(x=>x&&typeof x==='object'&&!demoIds.returns.has(x.id));
    const demoTransactionIds=new Set([...demoIds.shipments,...demoIds.sales,...demoIds.invoices,...demoIds.returns]);
    const audit=(legacy.audit||[]).filter(entry=>!demoTransactionIds.has(entry.entityId));
    const branchStock=(legacy.branchStock||[]).filter(x=>!(['STR-PPR-005|ACC-HOU-001','STR-PPR-005|ACC-HOU-002','STR-ELC-008|CAB-HOU-014','STR-PPR-002|AUD-HOU-003'].includes(x.store+'|'+x.sku)));
    const referencedSkus=new Set([...shipments.flatMap(x=>(x.items||[]).map(i=>i.sku)),...sales.map(x=>x.sku),...returns.map(x=>x.sku),...branchStock.map(x=>x.sku),...(legacy.counts||[]).map(x=>x.sku)]);
    const referencedStores=new Set([...shipments.map(x=>x.store),...sales.map(x=>x.store),...invoices.map(x=>x.store),...returns.map(x=>x.store),...branchStock.map(x=>x.store)]);
    const extraProducts=(legacy.products||[]).filter(x=>!source.products.some(y=>y.sku===x.sku)&&(!demoIds.products.has(x.sku)||referencedSkus.has(x.sku)));
    const extraStores=(legacy.stores||[]).filter(x=>!source.paperclipBranches.some(y=>y.code===x.code)&&(!demoIds.stores.has(x.code)||referencedStores.has(x.code)));
    const keepStores=extraStores.filter(x=>referencedStores.has(x.code));
    const keepProducts=extraProducts.filter(x=>referencedSkus.has(x.sku));
    const importedProducts=source.products.map(src=>{const old=(legacy.products||[]).find(x=>x.sku===src.sku),count=(legacy.counts||[]).find(x=>x.sku===src.sku);return{...src,barcode:old?.barcode||src.barcode,brand:old?.brand||src.brand,stock:count?.physical??(legacy.seedVersion>=2&&old?.stock!=null?old.stock:null),stockSource:old?.stockSource||count?.source||null}});const normalizedExtraStores=extraStores.map(x=>({...x,term:x.term||'Bulanan',supplierShare:x.supplierShare??65,storeShare:x.storeShare??35,effectiveDate:x.effectiveDate||'',agreementStatus:x.agreementStatus||'Perlu perjanjian'}));const importedStores=source.paperclipBranches.map(src=>{const old=(legacy.stores||[]).find(x=>x.code===src.code);return old?{...src,...old,code:src.code,network:old.network||src.network,region:old.region||src.region,term:old.term||src.term,supplierShare:old.supplierShare??src.supplierShare,storeShare:old.storeShare??src.storeShare,effectiveDate:old.effectiveDate||'',agreementStatus:old.agreementStatus||'Perlu perjanjian'}:src});data={...data,products:[...importedProducts,...extraProducts],stores:[...importedStores,...normalizedExtraStores],shipments,sales:sales.map(x=>({...x,status:x.status||'Disetujui'})),invoices,returns,branchStock:branchStock.filter(x=>data.stores.some(y=>y.code===x.store)||keepStores.some(y=>y.code===x.store)),counts:(legacy.counts||[]),countHistory:(legacy.countHistory||[]),audit,demo:false,seedVersion:2};
  }
  try{localStorage.setItem(KEY,JSON.stringify(data))}catch(error){console.warn('Data Howell gagal disimpan di cache browser saat aplikasi dimulai:',error);}
  const pageNames = {
    get dashboard() { return t('menu_dashboard', 'Ringkasan'); },
    get inventory() { return t('menu_inventory', 'Stok & Opname'); },
    get warehouse() { return t('menu_warehouse', 'Gudang'); },
    get 'sales-history'() { return t('menu_history', 'Riwayat'); },
    get products() { return t('menu_products', 'Master Produk'); },
    get stores() { return t('menu_stores', 'Cabang Retail'); },
    get shipments() { return t('menu_shipments', 'Purchase Order'); },
    get sales() { return t('menu_history', 'Riwayat'); },
    get invoices() { return t('menu_invoices', 'Tagihan & Pembayaran'); },
    get returns() { return t('menu_returns', 'Retur'); },
    get reports() { return t('menu_reports', 'Laporan'); },
    get settings() { return t('menu_settings', 'Pengaturan'); }
  };
  const portalRole=window.HOWELL_PORTAL_ROLE||'admin';
  const allowedPages=portalRole==='warehouse'?new Set(['warehouse','sales-history','inventory','returns']):null;
  // === MULTI-LANGUAGE SYSTEM (ID / EN / ZH) ===
  const I18N = {
    id: {
      // Nav & Sections
      nav_main: 'UTAMA',
      nav_operations: 'OPERASIONAL',
      menu_dashboard: 'Ringkasan',
      menu_products: 'Master Produk',
      menu_stores: 'Cabang Retail',
      menu_shipments: 'Purchase Order',
      menu_warehouse: 'Gudang',
      menu_inventory: 'Stok & Opname',
      menu_history: 'Riwayat',
      menu_returns: 'Retur',
      menu_reports: 'Laporan',
      menu_settings: 'Pengaturan',
      menu_invoices: 'Tagihan & Pembayaran',

      // Topbar
      search_placeholder: 'Cari produk, SKU, transaksi…',
      search_btn: 'Cari',
      scan_btn: 'Pindai',
      period_week: 'Minggu ini',
      period_month: 'Bulan ini',
      notification: 'Notifikasi',
      role_admin: 'Administrator',
      role_warehouse: 'Operator Gudang',
      no_notifications: 'Tidak ada notifikasi baru.',
      lang_changed: 'Bahasa diubah ke Bahasa Indonesia',

      // Common actions
      export_excel: 'Ekspor Excel',
      add_product: 'Tambah produk',
      add_store: 'Tambah cabang',
      create_po: 'Buat Purchase Order',
      record_recon: 'Catat rekonsiliasi',
      start_stocktake: 'Mulai opname gudang',
      branch_stocktake: 'Opname cabang',
      scan_ean13: 'Pindai EAN-13',
      view_all: 'Lihat semua',
      save_data: 'Simpan data',
      cancel: 'Batal',
      close: 'Tutup',
      edit: 'Edit',
      delete: 'Hapus',
      print_waybill: 'Cetak surat jalan',
      view_sales: 'Lihat di Riwayat',
      sku_details: 'Rincian SKU',
      change_status: 'Ubah status',
      mark_sold: 'Selesai terjual (Done)',
      all_categories: 'Semua kategori',
      all_statuses: 'Semua status',
      empty_data: 'Belum ada data',

      // Riwayat Page
      history_title: 'Riwayat',
      history_subtitle: 'Riwayat surat jalan selesai terjual dari gudang serta rekonsiliasi fisik per cabang dan SKU.',
      history_tab_sold: 'Surat Jalan Terjual',
      history_tab_sku: 'Rekonsiliasi SKU',
      history_tab_all: 'Semua Transaksi',
      history_kpi_net: 'OMSET BERSIH TERCATAT',
      history_kpi_units: 'UNIT TERJUAL',
      history_kpi_waybills: 'SURAT JALAN SELESAI',
      history_kpi_pending: 'MENUNGGU PERSETUJUAN',
      history_sub_recon: 'Rekonsiliasi tersimpan',
      history_sub_approved: 'Hanya laporan disetujui',
      history_sub_confirmed: 'Barang keluar terkonfirmasi',
      history_sub_review: 'Perlu ditinjau sebelum tutup periode',
      history_banner: 'Barang terjual = stok awal periode + stok masuk − stok fisik akhir − retur terkonfirmasi. Harga retail dan bagi hasil disimpan sebagai snapshot pada saat laporan dibuat.',

      // Gudang Page
      warehouse_title: 'Gudang',
      warehouse_subtitle: 'Pengelolaan penerimaan, pengeluaran surat jalan, dan stok opname gudang pusat.',
      warehouse_po_heading: 'Purchase Order untuk gudang',
      warehouse_po_sub: 'PO yang dibuat langsung tercatat di sini. Atur statusnya; surat jalan tersedia setelah PO disetujui.',
      warehouse_history_heading: 'Riwayat surat jalan',
      warehouse_history_sub: 'Pengeluaran terbaru yang sudah disimpan dari Gudang.',

      // Dashboard
      dash_title: 'Ringkasan',
      dash_kpi_total_stock: 'TOTAL STOK',
      dash_kpi_in_transit: 'DALAM PENGIRIMAN',
      dash_kpi_branches: 'TOTAL CABANG',
      dash_kpi_total_sales: 'TOTAL PENJUALAN',
      dash_posisi_stok: 'Posisi persediaan',
      dash_need_attention: 'PERLU PERHATIAN',
      dash_low_stock: 'Stok menipis',
      dash_recent_trans: 'Transaksi terbaru',
      dash_sales_perf: 'Performa penjualan',
      dash_center_wh: 'Gudang pusat',
      dash_branch: 'Cabang',
      dash_shipment: 'Pengiriman',
      dash_overview: 'HOWELL INVENTORY OVERVIEW',

      // Master Produk
      products_title: 'Master Produk',
      products_sub: 'Katalog dari seluruh sheet master, dipasangkan dengan pricelist B2B Howell.',

      // Cabang Retail
      stores_title: 'Cabang Retail',
      stores_sub: 'Kelola jaringan toko konsinyasi yang menerima produk Howell.',

      // Shipments / PO
      shipments_title: 'Purchase Order',
      shipments_sub: 'Daftar pesanan barang ke cabang retail konsinyasi.',

      // Inventory
      inventory_title: 'Stok & Opname',
      inventory_sub: 'Lakukan opname fisik gudang pusat dan bandingkan saldo cabang.',

      // Reports
      reports_title: 'Laporan',
      reports_sub: 'Ringkasan inventori, cabang, distribusi, penjualan, dan rekonsiliasi dari data tersimpan.',

      // Returns
      returns_title: 'Retur Barang',
      returns_sub: 'Kelola retur barang rusak atau klaim dari cabang retail.',

      // Settings
      settings_title: 'Pengaturan',
      settings_sub: 'Kelola data Howell Inventory dan status sinkronisasi server.',

      // Table Columns
      col_waybill_no: 'NOMOR SURAT JALAN',
      col_po_no: 'NOMOR PO',
      col_customer: 'CUSTOMER',
      col_date: 'TANGGAL',
      col_qty_out: 'QUANTITY KELUAR',
      col_po_status: 'STATUS PO',
      col_actions: 'TINDAKAN & DOKUMEN',
      col_recon_no: 'NOMOR REKONSILIASI',
      col_branch: 'CABANG',
      col_period: 'PERIODE',
      col_sku_prod: 'SKU & PRODUK',
      col_calc_details: 'RINCIAN HITUNG UNIT',
      col_gross_sales: 'PENJUALAN KOTOR',
      col_retail_discount: 'DISKON RETAIL',
      col_net_sales: 'PENJUALAN BERSIH',
      col_status: 'STATUS',
      col_product: 'PRODUK',
      col_sku: 'SKU',
      col_category: 'KATEGORI',
      col_hpp: 'HPP+10%',
      col_srp: 'SRP / HET',
      col_store_share: 'Porsi Paperclip',
      col_central_stock: 'Stok pusat',
      col_address: 'ALAMAT PENGIRIMAN',
      col_pic: 'PENANGGUNG JAWAB',
      col_po_no_pic: 'NOMOR PO / PENANGGUNG JAWAB',
      col_customer_date: 'CUSTOMER / TANGGAL PO',
      col_prod_qty: 'PRODUK DAN QUANTITY',

      // Statuses
      st_approved: 'Disetujui',
      st_sold: 'Selesai terjual',
      st_shipped: 'Dikirim',
      st_received: 'Diterima',
      st_in_progress: 'Dalam proses',
      st_pending: 'Pending',
      st_rejected: 'Tidak disetujui',
      st_suspended: 'Ditangguhkan',
      st_available: 'Tersedia',
      st_low: 'Stok Menipis',
      st_uncounted: 'Belum opname',
      st_draft: 'Draft',
      st_partial: 'Sebagian (Partial)',
      col_invoice_no: "Nomor tagihan",
      col_retail_branch: "Cabang retail",
      col_invoice_date: "Tanggal tagihan",
      col_due_date: "Jatuh tempo",
      col_retail_commission: "Komisi retail",
      col_net_to_howell: "Pembayaran bersih ke Howell",
      col_payment_received: "Pembayaran masuk",
      col_total: "Total",
      col_notes: "Catatan",
      search_data: "Cari data...",
      empty_subtitle: "Tambahkan data untuk mulai melacak aktivitas.",
      history_waybills_sub: "Pengeluaran terbaru yang sudah selesai terjual dari Gudang.",
      approve_recon: "Setujui rekonsiliasi",
      create_invoice: "Buat invoice periode",
      unit_suffix: " unit",
      sj_suffix: " SJ",
      btn_shipments: "Buka Purchase Order",
      btn_inventory: "Buka Stok & Opname",
      po_active: "PO berjalan",
      po_active_sub: "Masih memiliki quantity yang belum keluar",
      po_ready: "PO siap dikirim",
      po_ready_sub: "Sudah disetujui dan dapat dibuatkan surat jalan",
      po_outstanding: "Unit belum keluar",
      po_outstanding_sub: "Sisa quantity pada PO yang berjalan",
      wh_sold_units_sub: "unit selesai terjual",
    },
    en: {
      // Nav & Sections
      nav_main: 'MAIN',
      nav_operations: 'OPERATIONS',
      menu_dashboard: 'Dashboard',
      menu_products: 'Master Products',
      menu_stores: 'Retail Branches',
      menu_shipments: 'Purchase Order',
      menu_warehouse: 'Warehouse',
      menu_inventory: 'Stock & Opname',
      menu_history: 'History',
      menu_returns: 'Returns',
      menu_reports: 'Reports',
      menu_settings: 'Settings',
      menu_invoices: 'Billing & Invoices',

      // Topbar
      search_placeholder: 'Search products, SKU, transactions…',
      search_btn: 'Search',
      scan_btn: 'Scan',
      period_week: 'This week',
      period_month: 'This month',
      notification: 'Notifications',
      role_admin: 'Administrator',
      role_warehouse: 'Warehouse Operator',
      no_notifications: 'No new notifications.',
      lang_changed: 'Language changed to English',

      // Common actions
      export_excel: 'Export Excel',
      add_product: 'Add product',
      add_store: 'Add branch',
      create_po: 'Create Purchase Order',
      record_recon: 'Record reconciliation',
      start_stocktake: 'Start warehouse count',
      branch_stocktake: 'Branch count',
      scan_ean13: 'Scan EAN-13',
      view_all: 'View all',
      save_data: 'Save data',
      cancel: 'Cancel',
      close: 'Close',
      edit: 'Edit',
      delete: 'Delete',
      print_waybill: 'Print waybill',
      view_sales: 'View in History',
      sku_details: 'SKU details',
      change_status: 'Change status',
      mark_sold: 'Mark sold (Done)',
      all_categories: 'All categories',
      all_statuses: 'All statuses',
      empty_data: 'No data available',

      // Riwayat Page
      history_title: 'History',
      history_subtitle: 'History of sold waybills dispatched from warehouse and physical reconciliation per branch & SKU.',
      history_tab_sold: 'Sold Waybills',
      history_tab_sku: 'SKU Reconciliation',
      history_tab_all: 'All Transactions',
      history_kpi_net: 'RECORDED NET REVENUE',
      history_kpi_units: 'UNITS SOLD',
      history_kpi_waybills: 'COMPLETED WAYBILLS',
      history_kpi_pending: 'PENDING APPROVAL',
      history_sub_recon: 'Saved reconciliation',
      history_sub_approved: 'Approved reports only',
      history_sub_confirmed: 'Confirmed dispatched goods',
      history_sub_review: 'Review needed before period close',
      history_banner: 'Sold goods = initial period stock + incoming stock − final physical stock − confirmed returns. Retail price and revenue shares are saved as snapshot when report is created.',

      // Gudang Page
      warehouse_title: 'Warehouse',
      warehouse_subtitle: 'Management of receipts, waybill dispatch, and central warehouse stock opname.',
      warehouse_po_heading: 'Purchase Orders for warehouse',
      warehouse_po_sub: 'Created POs are recorded here immediately. Set status; waybills are available once PO is approved.',
      warehouse_history_heading: 'Waybill history',
      warehouse_history_sub: 'Recent dispatches saved from Warehouse.',

      // Dashboard
      dash_title: 'Dashboard',
      dash_kpi_total_stock: 'TOTAL STOCK',
      dash_kpi_in_transit: 'IN TRANSIT',
      dash_kpi_branches: 'TOTAL BRANCHES',
      dash_kpi_total_sales: 'TOTAL SALES',
      dash_posisi_stok: 'Inventory position',
      dash_need_attention: 'NEEDS ATTENTION',
      dash_low_stock: 'Low stock',
      dash_recent_trans: 'Recent transactions',
      dash_sales_perf: 'Sales performance',
      dash_center_wh: 'Central warehouse',
      dash_branch: 'Branch',
      dash_shipment: 'Dispatch',
      dash_overview: 'HOWELL INVENTORY OVERVIEW',

      // Master Produk
      products_title: 'Master Products',
      products_sub: 'Catalog from master sheets paired with Howell B2B pricelist.',

      // Cabang Retail
      stores_title: 'Retail Branches',
      stores_sub: 'Manage consignment retail stores carrying Howell products.',

      // Shipments / PO
      shipments_title: 'Purchase Order',
      shipments_sub: 'List of purchase orders to consignment retail branches.',

      // Inventory
      inventory_title: 'Stock & Stocktake',
      inventory_sub: 'Perform physical stocktake for central warehouse and compare branch balances.',

      // Reports
      reports_title: 'Reports',
      reports_sub: 'Summary of inventory, branches, distribution, sales, and reconciliation from saved data.',

      // Returns
      returns_title: 'Returns',
      returns_sub: 'Manage damaged returns or claims from retail stores.',

      // Settings
      settings_title: 'Settings',
      settings_sub: 'Manage Howell Inventory data and server synchronization status.',

      // Table Columns
      col_waybill_no: 'WAYBILL NUMBER',
      col_po_no: 'PO NUMBER',
      col_customer: 'CUSTOMER',
      col_date: 'DATE',
      col_qty_out: 'DISPATCHED QTY',
      col_po_status: 'PO STATUS',
      col_actions: 'ACTIONS & DOCUMENTS',
      col_recon_no: 'RECONCILIATION NO',
      col_branch: 'BRANCH',
      col_period: 'PERIOD',
      col_sku_prod: 'SKU & PRODUCT',
      col_calc_details: 'CALCULATION DETAILS',
      col_gross_sales: 'GROSS SALES',
      col_retail_discount: 'RETAIL DISCOUNT',
      col_net_sales: 'NET SALES',
      col_status: 'STATUS',
      col_product: 'PRODUCT',
      col_sku: 'SKU',
      col_category: 'CATEGORY',
      col_hpp: 'COST+10%',
      col_srp: 'SRP / RETAIL',
      col_store_share: 'Paperclip Share',
      col_central_stock: 'Central stock',
      col_address: 'SHIPPING ADDRESS',
      col_pic: 'PERSON IN CHARGE',
      col_po_no_pic: 'PO NUMBER / PIC',
      col_customer_date: 'CUSTOMER / PO DATE',
      col_prod_qty: 'PRODUCTS AND QUANTITY',

      // Statuses
      st_approved: 'Approved',
      st_sold: 'Sold (Done)',
      st_shipped: 'Shipped',
      st_received: 'Received',
      st_in_progress: 'In Progress',
      st_pending: 'Pending',
      st_rejected: 'Rejected',
      st_suspended: 'Suspended',
      st_available: 'In Stock',
      st_low: 'Low Stock',
      st_uncounted: 'Uncounted',
      st_draft: 'Draft',
      st_partial: 'Partial',
      col_invoice_no: "Invoice No",
      col_retail_branch: "Retail Branch",
      col_invoice_date: "Invoice Date",
      col_due_date: "Due Date",
      col_retail_commission: "Retail Commission",
      col_net_to_howell: "Net to Howell",
      col_payment_received: "Payment Received",
      col_total: "Total",
      col_notes: "Notes",
      search_data: "Search data...",
      empty_subtitle: "Add data to start tracking activity.",
      history_waybills_sub: "Recent dispatches marked as sold from Warehouse.",
      approve_recon: "Approve reconciliation",
      create_invoice: "Create period invoice",
      unit_suffix: " units",
      sj_suffix: " Waybills",
      btn_shipments: "Open Purchase Orders",
      btn_inventory: "Open Stock & Stocktake",
      po_active: "Active POs",
      po_active_sub: "Has remaining quantity to be dispatched",
      po_ready: "Ready for Dispatch",
      po_ready_sub: "Approved and ready for waybill creation",
      po_outstanding: "Units Pending Dispatch",
      po_outstanding_sub: "Remaining quantity across active POs",
      wh_sold_units_sub: "units marked as sold",
    },
    zh: {
      // Nav & Sections
      nav_main: '主要',
      nav_operations: '运营管理',
      menu_dashboard: '概览',
      menu_products: '产品主数据',
      menu_stores: '零售网点',
      menu_shipments: '采购订单',
      menu_warehouse: '仓库管理',
      menu_inventory: '库存与盘点',
      menu_history: '销售历史',
      menu_returns: '退货管理',
      menu_reports: '报表分析',
      menu_settings: '系统设置',
      menu_invoices: '账单与付款',

      // Topbar
      search_placeholder: '搜索产品、SKU、交易…',
      search_btn: '搜索',
      scan_btn: '扫码',
      period_week: '本周',
      period_month: '本月',
      notification: '通知',
      role_admin: '系统管理员',
      role_warehouse: '仓库操作员',
      no_notifications: '暂无新通知。',
      lang_changed: '语言已切换为中文 (Mandarin)',

      // Common actions
      export_excel: '导出 Excel',
      add_product: '新增产品',
      add_store: '新增门店',
      create_po: '创建采购订单',
      record_recon: '记录对账',
      start_stocktake: '开始仓库盘点',
      branch_stocktake: '门店盘点',
      scan_ean13: '扫描 EAN-13',
      view_all: '查看全部',
      save_data: '保存数据',
      cancel: '取消',
      close: '关闭',
      edit: '编辑',
      delete: '删除',
      print_waybill: '打印出库运单',
      view_sales: '在历史中查看',
      sku_details: 'SKU 详情',
      change_status: '修改状态',
      mark_sold: '确认售出 (Done)',
      all_categories: '全部类别',
      all_statuses: '全部状态',
      empty_data: '暂无数据',

      // Riwayat Page
      history_title: '销售与出库历史',
      history_subtitle: '已完成售出的出库运单及各门店与SKU的实物对账记录。',
      history_tab_sold: '已售出库单',
      history_tab_sku: 'SKU 对账明细',
      history_tab_all: '全部交易',
      history_kpi_net: '已记录净营业额',
      history_kpi_units: '已售出数量',
      history_kpi_waybills: '已完成运单',
      history_kpi_pending: '等待审批',
      history_sub_recon: '已保存对账',
      history_sub_approved: '仅已批准报告',
      history_sub_confirmed: '已确认出库商品',
      history_sub_review: '结账前需审核',
      history_banner: '已售商品 = 期初库存 + 入库 − 期末实物库存 − 确认退货。零售价与分成比例在生成报告时保存为快照。',

      // Gudang Page
      warehouse_title: '仓库管理',
      warehouse_subtitle: '中心仓库入库、出库运单签发及库存实物盘点管理。',
      warehouse_po_heading: '仓库采购订单处理',
      warehouse_po_sub: '新建采购订单将直接显示在此处。审核通过后即可创建出库运单。',
      warehouse_history_heading: '出库运单历史',
      warehouse_history_sub: '中心仓库近期保存的出库单记录。',

      // Dashboard
      dash_title: '概览',
      dash_kpi_total_stock: '总库存',
      dash_kpi_in_transit: '运输在途',
      dash_kpi_branches: '合作门店总数',
      dash_kpi_total_sales: '总销售额',
      dash_posisi_stok: '库存分布状况',
      dash_need_attention: '需关注事项',
      dash_low_stock: '库存紧张',
      dash_recent_trans: '最新交易记录',
      dash_sales_perf: '销售业绩趋势',
      dash_center_wh: '中心仓库',
      dash_branch: '门店',
      dash_shipment: '出库发货',
      dash_overview: 'HOWELL INVENTORY OVERVIEW',

      // Master Produk
      products_title: '产品主数据',
      products_sub: '来自主表的产品目录，对应 Howell B2B 价格清单。',

      // Cabang Retail
      stores_title: '零售网点',
      stores_sub: '管理销售 Howell 产品的代销门店网络。',

      // Shipments / PO
      shipments_title: '采购订单',
      shipments_sub: '发往代销零售门店的采购订单列表。',

      // Inventory
      inventory_title: '库存与盘点',
      inventory_sub: '执行中心仓库实物盘点并核对门店账面余额。',

      // Reports
      reports_title: '报表分析',
      reports_sub: '基于系统保存数据的库存、门店、配送、销售及对账统计分析。',

      // Returns
      returns_title: '退货管理',
      returns_sub: '管理来自零售门店的破损退货或退货申请。',

      // Settings
      settings_title: '系统设置',
      settings_sub: '管理 Howell Inventory 数据与服务器同步状态。',

      // Table Columns
      col_waybill_no: '出库运单号',
      col_po_no: '采购订单号',
      col_customer: '客户 / 目标门店',
      col_date: '日期',
      col_qty_out: '出库数量',
      col_po_status: '订单状态',
      col_actions: '操作与单据',
      col_recon_no: '对账单编号',
      col_branch: '门店',
      col_period: '结算周期',
      col_sku_prod: 'SKU 与产品名称',
      col_calc_details: '核算明细',
      col_gross_sales: '销售总额',
      col_retail_discount: '零售折扣',
      col_net_sales: '净销售额',
      col_status: '状态',
      col_product: '产品',
      col_sku: 'SKU',
      col_category: '产品分类',
      col_hpp: '成本价+10%',
      col_srp: '建议零售价 (HET)',
      col_store_share: '门店分成比例',
      col_central_stock: '中心仓库库存',
      col_address: '送货地址',
      col_pic: '负责人',
      col_po_no_pic: '采购订单 / 负责人',
      col_customer_date: '客户 / 订单日期',
      col_prod_qty: '产品与出库数量',

      // Statuses
      st_approved: '已批准',
      st_sold: '已售出 (Done)',
      st_shipped: '已发货',
      st_received: '已收货',
      st_in_progress: '处理中',
      st_pending: '待处理',
      st_rejected: '已拒绝',
      st_suspended: '已暂停',
      st_available: '库存充足',
      st_low: '库存告急',
      st_uncounted: '尚未盘点',
      st_draft: '草稿',
      st_partial: '部分处理',
      col_invoice_no: "账单编号",
      col_retail_branch: "零售网点",
      col_invoice_date: "账单日期",
      col_due_date: "到期日",
      col_retail_commission: "零售分成",
      col_net_to_howell: "Howell 净结算",
      col_payment_received: "实收金额",
      col_total: "合计",
      col_notes: "备注",
      search_data: "搜索数据...",
      empty_subtitle: "添加数据以开始跟踪业务。",
      history_waybills_sub: "中心仓库最新确认已售出的出库单。",
      approve_recon: "批准对账",
      create_invoice: "创建周期账单",
      unit_suffix: " 件",
      sj_suffix: " 张运单",
      btn_shipments: "查看采购订单",
      btn_inventory: "查看库存与盘点",
      po_active: "在途采购订单",
      po_active_sub: "仍有尚未发运出库的数量",
      po_ready: "待发运订单",
      po_ready_sub: "已批准并可创建出库单",
      po_outstanding: "待出库数量",
      po_outstanding_sub: "在途订单剩余待发运数量",
      wh_sold_units_sub: "件商品已确认售出",
    }
  };

  let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('howell-lang')) || 'id';

  function t(key, fallback = '') {
    return I18N[currentLang]?.[key] || I18N['id']?.[key] || fallback || key;
  }

  function translateStatus(s) {
    if (!s) return '';
    const map = {
      'Disetujui': t('st_approved', 'Disetujui'),
      'Selesai terjual': t('st_sold', 'Selesai terjual'),
      'Done': t('st_sold', 'Done'),
      'Terjual': t('st_sold', 'Terjual'),
      'Dikirim': t('st_shipped', 'Dikirim'),
      'Received': t('st_received', 'Diterima'),
      'Diterima': t('st_received', 'Diterima'),
      'In Transit': t('st_shipped', 'In Transit'),
      'Dalam proses': t('st_in_progress', 'Dalam proses'),
      'Proses': t('st_in_progress', 'Proses'),
      'Pending': t('st_pending', 'Pending'),
      'Tidak disetujui': t('st_rejected', 'Tidak disetujui'),
      'Ditangguhkan': t('st_suspended', 'Ditangguhkan'),
      'Tersedia': t('st_available', 'Tersedia'),
      'Stok Menipis': t('st_low', 'Stok Menipis'),
      'Belum opname': t('st_uncounted', 'Belum opname'),
      'Draft': t('st_draft', 'Draft'),
      'Partial': t('st_partial', 'Partial')
    };
    return map[s] || s;
  }

  function setLanguage(lang) {
    if (!['id', 'en', 'zh'].includes(lang)) lang = 'id';
    currentLang = lang;
    try { localStorage.setItem('howell-lang', lang); } catch (e) {}
    updateDomLanguage();
    render();
    toast(t('lang_changed', 'Bahasa diperbarui.'));
  }

  function updateDomLanguage() {
    // 1. Language selector UI
    const codeEl = $('#langCurrentCode');
    if (codeEl) codeEl.textContent = currentLang.toUpperCase();
    $$('.top-lang-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });

    // 2. Sidebar Navigation Items
    const navTitles = {
      dashboard: t('menu_dashboard', 'Ringkasan'),
      products: t('menu_products', 'Master Produk'),
      stores: t('menu_stores', 'Cabang Retail'),
      shipments: t('menu_shipments', 'Purchase Order'),
      warehouse: t('menu_warehouse', 'Gudang'),
      inventory: t('menu_inventory', 'Stok & Opname'),
      sales: t('menu_history', 'Riwayat'),
      returns: t('menu_returns', 'Retur'),
      reports: t('menu_reports', 'Laporan'),
      settings: t('menu_settings', 'Pengaturan')
    };

    $$('.nav-item').forEach(btn => {
      const p = btn.dataset.page;
      if (navTitles[p]) {
        btn.setAttribute('title', navTitles[p]);
        btn.setAttribute('aria-label', navTitles[p]);
        const span = btn.querySelector('span');
        if (span) span.textContent = navTitles[p];
      }
    });

    // 3. Sidebar Nav Group Labels
    const navLabels = $$('.nav-label');
    if (navLabels[0]) navLabels[0].textContent = t('nav_main', 'UTAMA');
    if (navLabels[1]) navLabels[1].textContent = t('nav_operations', 'OPERASIONAL');

    // 4. Header Crumb
    const crumb = $('#crumbCurrent');
    if (crumb) crumb.textContent = navTitles[current] || current;

    // 5. Header Search & Scan Controls
    const searchInput = $('#globalSearch');
    if (searchInput) searchInput.setAttribute('placeholder', t('search_placeholder', 'Cari produk, SKU, transaksi…'));
    const searchBtn = $('#globalSearchSubmit');
    if (searchBtn) searchBtn.textContent = t('search_btn', 'Cari');
    const scanSpan = $('#barcodeScanOpen span');
    if (scanSpan) scanSpan.textContent = t('scan_btn', 'Pindai');

    // 6. Header Period Filter
    const optWeek = $('#topPeriod option[value="week"]');
    if (optWeek) optWeek.textContent = t('period_week', 'Minggu ini');
    const optMonth = $('#topPeriod option[value="month"]');
    if (optMonth) optMonth.textContent = t('period_month', 'Bulan ini');

    // 7. Profile Subtitle
    const profRole = $('.top-profile small');
    if (profRole) profRole.textContent = (portalRole === 'warehouse' ? t('role_warehouse', 'Operator Gudang') : t('role_admin', 'Administrator'));
  }

  function initLanguageSwitcher() {
    const wrapper = $('#langWrapper');
    const button = $('#langButton');
    const menu = $('#langMenu');
    if (!wrapper || !button || !menu) return;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.top-lang-item');
      if (item && item.dataset.lang) {
        menu.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        setLanguage(item.dataset.lang);
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        menu.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  let current=portalRole==='warehouse'?'warehouse':'dashboard',query='',statusFilter='Semua status',modalMode=null,chartPeriod='week',stockHistoryLimit=10,stockHistoryQuery='',warehouseDispatchTab='active',salesViewTab='waybills';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const money=n=>'Rp '+Number(n||0).toLocaleString(currentLang==='en'?'en-US':(currentLang==='zh'?'zh-CN':'id-ID'));
  const date=s=>s?new Date(s+'T00:00:00').toLocaleDateString(currentLang==='en'?'en-US':(currentLang==='zh'?'zh-CN':'id-ID'),{day:'2-digit',month:'short',year:'numeric'}):'-';
  const storeName=id=>data.stores.find(x=>x.code===id)?.name||id;
  const prodName=id=>{const name=data.products.find(x=>x.sku===id)?.name||id;return id==='HW05'?String(name).replace(/\s+WHITE$/i,''):name};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const productPhoto=sku=>{const src=window.HOWELL_PRODUCT_IMAGES?.[String(sku??'').trim().toUpperCase()];return src?`<img class="product-photo" src="${esc(src)}" alt="" aria-hidden="true" width="720" height="720" loading="lazy" decoding="async">`:'<span class="product-image-missing">Foto belum tersedia</span>'};
  const inventoryPhoto=p=>{const src=window.HOWELL_PRODUCT_IMAGES?.[String(p.sku??'').trim().toUpperCase()];return src?`<button type="button" class="product-photo-trigger" data-action="preview-product-photo" data-photo-src="${esc(src)}" data-photo-name="${esc(p.name)}" data-photo-sku="${esc(p.sku)}" aria-label="Lihat foto ${esc(p.name)} (${esc(p.sku)})"><img class="product-photo" src="${esc(src)}" alt="" aria-hidden="true" width="720" height="720" loading="lazy" decoding="async"></button>`:'<span class="product-image-missing">Foto belum tersedia</span>'};
  let serverRevision=0,syncReady=false,syncBlocked=false,syncConnecting=false,syncPending=0,syncQueue=Promise.resolve(),syncStatusText='Memeriksa database…',syncStatusTitle='Menghubungkan ke database bersama…',syncErrorDetails='';
  // Do not make the public GitHub Pages site read-only just because it has fetch().
  // Shared API sync is an explicit per-host opt-in configured outside the app bundle.
  // The warehouse portal must never fall back to an empty browser-only stock view.
  // Its role is injected by the portal-specific runtime config, so use that as a
  // fail-safe signal if the shared-database boolean is missing from a stale/mixed release.
  const syncEnabled=(window.HOWELL_SHARED_DATABASE===true||window.HOWELL_PORTAL_ROLE==='warehouse')&&typeof window.fetch==='function'&&window.location?.protocol!=='file:';
  const sharedFetch=(url,options={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);return window.fetch(url,{...options,signal:controller.signal}).finally(()=>clearTimeout(timer));};
  const formatSyncTime=(d=new Date())=>{try{return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return ''}};
  const updateSyncStatus=(text,title,{error=false}={})=>{syncStatusText=text;syncStatusTitle=title||text;const node=$('#syncStatus');if(node){const label=$('#syncStatusText');if(label)label.textContent=text;node.title=syncStatusTitle;node.classList.toggle('sync-error',error||/gagal|konflik|lokal|terputus|tidak tersambung/i.test(text));}};
  const applyServerState=async({preserveLocal=true}={})=>{const response=await sharedFetch('/api/state',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error(response.status===401?'Login VPS diperlukan untuk mengakses database.':`Server merespons ${response.status}.`);const remote=await response.json();serverRevision=Number(remote.revision||0);if(remote.state){if(preserveLocal){try{const previous=localStorage.getItem(KEY);if(previous&&previous!==JSON.stringify(remote.state)){localStorage.setItem(`${KEY}-recovery-latest`,previous);}}catch(error){console.warn('Cadangan lokal tidak dapat ditulis; data server tetap akan dimuat:',error)}}data={...structuredClone(initial),...remote.state};try{localStorage.setItem(KEY,JSON.stringify(data))}catch(error){console.warn('Cache lokal penuh; data tetap dimuat dari database server:',error)}}return remote;};
  const pushServerState=async(snapshot)=>{if(syncBlocked)return false;const response=await sharedFetch('/api/state',{method:'PUT',cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json','if-match':String(serverRevision)},body:JSON.stringify({state:JSON.parse(snapshot)})});if(response.status===409){syncBlocked=true;const local=localStorage.getItem(KEY);try{if(local)localStorage.setItem(`${KEY}-recovery-latest`,local);await applyServerState({preserveLocal:false})}catch(error){console.error('Pembaruan data server setelah konflik gagal:',error);updateSyncStatus('Konflik · cadangan lokal dipertahankan','Cadangan konflik gagal dibuat. Data lokal tidak diganti; unduh cadangan dari Pengaturan.',{error:true});render();toast('Konflik terjadi dan browser gagal membuat salinan lokal. Data lokal dipertahankan; unduh cadangan sebelum memuat ulang.');return false}updateSyncStatus('Konflik data · perlu ditinjau','Perubahan lokal disalin sebagai cadangan; data server dimuat kembali. Periksa konflik sebelum melanjutkan.',{error:true});render();toast('Data berubah di perangkat lain. Perubahan lokal disimpan sebagai cadangan konflik; muat ulang dan tinjau sebelum mengulang.');return false;}if(!response.ok)throw new Error(`Penyimpanan server gagal (${response.status}).`);const result=await response.json();serverRevision=Number(result.revision);return true;};
  const save=()=>{if(syncEnabled&&!syncReady){updateSyncStatus('Database VPS tidak tersambung','Perubahan dinonaktifkan sampai database bersama aktif.',{error:true});return;}const snapshot=JSON.stringify(data);try{localStorage.setItem(KEY,snapshot)}catch(e){}if(!syncEnabled||!syncReady||syncBlocked)return;if(syncPending===0)updateSyncStatus('Menyimpan ke VPS…','Perubahan sedang dikirim ke database VPS.');syncPending++;syncQueue=syncQueue.then(async()=>{try{const saved=await pushServerState(snapshot);syncPending=Math.max(0,syncPending-1);if(saved&&syncPending===0){const syncTime=formatSyncTime();updateSyncStatus(`Database bersama aktif · ${syncTime}`,`Data tersimpan pada database bersama Howell Inventory (Revisi ${serverRevision}).`);}}catch(error){syncPending=Math.max(0,syncPending-1);syncReady=false;updateSyncStatus('Sync gagal · tersimpan lokal',error.message,{error:true});console.error('Sinkronisasi database Howell gagal:',error);toast('Server tidak menerima perubahan. Data lokal tetap dicadangkan; periksa koneksi sebelum melanjutkan transaksi.');}});};
  const connectSharedDatabase=async({quiet=false}={})=>{if(!syncEnabled){updateSyncStatus('Penyimpanan lokal aktif','Aplikasi dibuka sebagai file lokal; database VPS tidak tersambung.');render();return;}if(syncConnecting||syncReady||syncBlocked)return;syncConnecting=true;syncErrorDetails='';updateSyncStatus('Menghubungkan ke database…','Sedang mengambil data terbaru dari database bersama.');render();try{const remote=await applyServerState();if(remote.state){syncReady=true;syncErrorDetails='';if(initializeBizgoOpeningStock()){updateSyncStatus('Menyimpan saldo awal…','Menulis stok 50 unit per SKU, sumber Bizgo, ke database bersama.');const saved=await pushServerState(JSON.stringify(data));if(!saved)throw new Error('Saldo awal belum tersimpan. Periksa status sinkronisasi sebelum melanjutkan.');const syncTime=formatSyncTime();updateSyncStatus(`Stok awal tersimpan · ${syncTime}`,`Semua ${data.products.length} SKU disimpan 50 unit dari Bizgo pada database bersama (Revisi ${serverRevision}).`);toast(`Saldo awal tersimpan: ${data.products.length} SKU × 50 unit · Bizgo · Nick.`);}else{const syncTime=formatSyncTime();updateSyncStatus(`Database bersama aktif · ${syncTime}`,`Data dimuat dari database bersama Howell Inventory (Revisi ${serverRevision}).`);}}else if(portalRole==='warehouse'){throw new Error('Database belum diinisialisasi admin. Minta admin menyiapkan aplikasi utama terlebih dahulu.')}else{syncReady=true;const stockInitialized=initializeBizgoOpeningStock();updateSyncStatus('Menyiapkan database VPS…','Data awal akan ditulis ke database VPS.');const seeded=await pushServerState(JSON.stringify(data));const syncTime=formatSyncTime();if(seeded)updateSyncStatus(stockInitialized?`Stok awal tersimpan · ${syncTime}`:`Database bersama aktif · ${syncTime}`,stockInitialized?`Semua ${data.products.length} SKU disimpan 50 unit dari Bizgo pada database bersama (Revisi ${serverRevision}).`:`Data awal tersimpan pada database bersama Howell Inventory (Revisi ${serverRevision}).`);else if(!syncBlocked)throw new Error('Data awal belum tersimpan di database VPS.');}render();}catch(error){syncReady=false;syncErrorDetails=error.name==='AbortError'?'Koneksi ke database melewati batas 12 detik. Portal akan mencoba kembali otomatis.':error.message;updateSyncStatus('Database VPS tidak tersambung',syncErrorDetails,{error:true});console.error('Database VPS belum tersambung:',error);render();if(!quiet)toast('Database VPS belum tersambung. Portal akan mencoba kembali otomatis.');}finally{syncConnecting=false;}};
  const refreshSharedDatabase=async()=>{if(!syncReady||syncBlocked||syncPending||$('#modalBackdrop')?.classList?.contains('open'))return;try{const currentRevision=serverRevision,response=await sharedFetch('/api/state',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error(`Server merespons ${response.status}.`);const remote=await response.json();const nextRevision=Number(remote.revision||0);if(nextRevision>currentRevision&&remote.state){serverRevision=nextRevision;data={...structuredClone(initial),...remote.state};try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.warn('Cache lokal penuh; data tetap dimuat dari database server:',e)}render();const syncTime=formatSyncTime();updateSyncStatus(`Database bersama aktif · ${syncTime}`,`Data terbaru dari server berhasil dimuat (Revisi ${serverRevision}).`);}}catch(error){console.error('Penyegaran database gagal:',error);}};
  const hasStock=p=>p&&p.stock!=null&&Number.isFinite(Number(p.stock));
  const branchBalance=x=>Number(x.opening||0)+Number(x.incoming||0)+Number(x.adjustment||0)-Number(x.sold||0)-Number(x.returns||0);
  const branchPeriodFigures=(store,sku,start,end)=>{
    const branch=data.branchStock.find(x=>x.store===store&&x.sku===sku),receipts=[];
    data.shipments.filter(x=>x.store===store).forEach(sh=>{const item=(sh.items||[]).find(i=>i.sku===sku);if(!item)return;const events=item.receipts?.length?item.receipts:(Number(item.receivedQty||0)>0?[{qty:Number(item.receivedQty),date:item.receivedAt||sh.date}]:[]);events.forEach(e=>receipts.push({qty:Number(e.qty||0),date:e.date||sh.date}));});
    const sentReturns=data.returns.filter(x=>x.store===store&&x.sku===sku&&x.status!=='Menunggu konfirmasi cabang').map(x=>({qty:Number(x.qty||0),date:x.dispatchDate||x.date}));
    const priorReceipts=receipts.filter(x=>x.date<start).reduce((n,x)=>n+x.qty,0),periodIncoming=receipts.filter(x=>x.date>=start&&x.date<=end).reduce((n,x)=>n+x.qty,0),priorReturns=sentReturns.filter(x=>x.date<start).reduce((n,x)=>n+x.qty,0),periodReturns=sentReturns.filter(x=>x.date>=start&&x.date<=end).reduce((n,x)=>n+x.qty,0),priorAdjustments=(branch?.adjustmentEvents||[]).filter(x=>x.date<start).reduce((n,x)=>n+Number(x.delta||0),0),priorSales=data.sales.filter(x=>x.store===store&&x.sku===sku&&x.status==='Disetujui'&&x.end<start).reduce((n,x)=>n+Number(x.qty||0),0),opening=(branch?Number(branch.opening||0):0)+priorReceipts+priorAdjustments-priorSales-priorReturns;
    return{opening,incoming:periodIncoming,returns:periodReturns,branch};
  };
  const recordAudit=(action,entity,entityId,details={},actor='HC')=>{data.audit.push({id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,action,entity,entityId,actor,at:new Date().toISOString(),details});};
  const initializeBizgoOpeningStock=()=>{if(portalRole!=='admin'||!Array.isArray(data.products)||data.products.length!==initial.products.length||!data.products.length||!Array.isArray(data.counts)||data.counts.length!==0||!data.products.every(product=>product.stock==null))return false;const date=jakartaDate(new Date()),at=new Date().toISOString();data.countHistory||=[];for(const product of data.products){product.stock=50;product.stockSource='Bizgo';const count={level:'Gudang pusat',sku:product.sku,physical:50,previous:null,delta:null,date,at,source:'Bizgo',actor:'Nick'};data.counts.push({...count,updatedAt:at});data.countHistory.unshift(count);}recordAudit('stock-opening-import','warehouse','all-sku',{quantity:50,source:'Bizgo',count:data.products.length},'Nick');data.demo=false;return true;};
  const wholeQty=value=>Number.isInteger(Number(value))&&Number(value)>=0;
  const invoicePayout=x=>Math.round(Number(x.netSales||0)*(1-Number(x.margin||0)/100));
  const invoiceStatus=x=>Number(x.paid||0)>=invoicePayout(x)?'Paid':x.due<today?'Overdue':Number(x.paid||0)>0?'Partial':'Unpaid';
  const pill=(label,tone)=>`<span class="pill ${tone}">${esc(label)}</span>`;
  const statusPill=s=>pill(translateStatus(s),({'Disetujui':'blue','Menunggu verifikasi':'amber','Menunggu persetujuan':'amber','Menunggu konfirmasi cabang':'amber','Tidak disetujui':'red','Ditangguhkan':'amber','Dalam perjalanan':'blue','Dikirim':'blue','Draft':'gray','Paid':'green','Received':'green','Diterima':'green','In Transit':'blue','Partial':'amber','Unpaid':'red','Overdue':'red','Rejected':'red','Pending':'amber','Repairable':'amber','Scrap/Musnah':'red','Re-sellable':'green','Selesai terjual':'green','Done':'green','Terjual':'green','Dalam proses':'blue','Proses':'blue','Pending':'amber'}[s]||'gray'));
  const button=(label,action,cls='btn-light')=>`<button class="btn ${cls} btn-small" data-action="${action}">${label}</button>`;
  function orderedQty(item){return Number(item?.orderedQty??item?.qty??0)}
  function dispatchedQty(order,item){return Number(item?.dispatchedQty??(order?.stockDispatched?item?.qty:0))}
  function demoBanner(){return data.demo?`<div class="demo-banner"><span class="demo-tag">DEMO</span><span><b>Data pratinjau.</b> Angka dan nama pada halaman ini hanya contoh dan tersimpan di browser ini.</span><button data-action="dismiss-demo">Sembunyikan</button></div>`:''}
  function heading(title, sub, actions='') {
    const headingMap = {
      'Riwayat': { title: t('history_title', 'Riwayat'), sub: t('history_subtitle', sub) },
      'Gudang': { title: t('warehouse_title', 'Gudang'), sub: t('warehouse_subtitle', sub) },
      'Ringkasan': { title: t('dash_title', 'Ringkasan'), sub: t('dash_subtitle', sub) },
      'Master Produk': { title: t('products_title', 'Master Produk'), sub: t('products_sub', sub) },
      'Cabang Retail': { title: t('stores_title', 'Cabang Retail'), sub: t('stores_sub', sub) },
      'Purchase Order': { title: t('shipments_title', 'Purchase Order'), sub: t('shipments_sub', sub) },
      'Stok & Opname': { title: t('inventory_title', 'Stok & Opname'), sub: t('inventory_sub', sub) },
      'Retur Barang': { title: t('returns_title', 'Retur Barang'), sub: t('returns_sub', sub) },
      'Laporan': { title: t('reports_title', 'Laporan'), sub: t('reports_sub', sub) },
      'Pengaturan': { title: t('settings_title', 'Pengaturan'), sub: t('settings_sub', sub) },
      'Tagihan & Pembayaran': { title: t('menu_invoices', 'Tagihan & Pembayaran'), sub: sub }
    };
    const mapped = headingMap[title];
    const trTitle = mapped ? mapped.title : title;
    const trSub = mapped ? mapped.sub : sub;

    let trActions = actions || '';
    if (trActions) {
      trActions = trActions
        .replace(/>Ekspor Excel</g, '>' + t('export_excel', 'Ekspor Excel') + '<')
        .replace(/>Ekspor CSV</g, '>' + t('export_excel', 'Ekspor CSV') + '<')
        .replace(/>Ekspor</g, '>' + t('export_excel', 'Ekspor') + '<')
        .replace(/>Tambah produk</g, '>' + t('add_product', 'Tambah produk') + '<')
        .replace(/>Tambah cabang</g, '>' + t('add_store', 'Tambah cabang') + '<')
        .replace(/>Buat Purchase Order</g, '>' + t('create_po', 'Buat Purchase Order') + '<')
        .replace(/>Catat rekonsiliasi</g, '>' + t('record_recon', 'Catat rekonsiliasi') + '<')
        .replace(/>Mulai opname gudang</g, '>' + t('start_stocktake', 'Mulai opname gudang') + '<')
        .replace(/>Opname cabang</g, '>' + t('branch_stocktake', 'Opname cabang') + '<')
        .replace(/>Pindai EAN-13</g, '>' + t('scan_ean13', 'Pindai EAN-13') + '<');
    }

    return '<div class="page-heading"><div><span class="eyebrow">HOWELL INVENTORY / ' + esc(trTitle.toUpperCase()) + '</span><h1>' + esc(trTitle) + '</h1><p>' + trSub + '</p></div><div class="heading-actions">' + trActions + '</div></div>';
  }
  function kpi(label,value,note){return `<article class="card kpi-card"><div class="kpi-top">${label}</div><div class="kpi-value">${value}</div><div class="kpi-foot">${note}</div></article>`}
  function chart(){let end=new Date(),monthly=chartPeriod==='month',start=monthly?new Date(end.getFullYear(),end.getMonth()-5,1):new Date(end);if(!monthly)start.setDate(end.getDate()-41);let bins=Array.from({length:6},(_,i)=>({start:monthly?new Date(start.getFullYear(),start.getMonth()+i,1):new Date(start.getFullYear(),start.getMonth(),start.getDate()+i*7),value:0}));data.sales.filter(s=>!s.status||s.status==='Disetujui').forEach(s=>{let d=new Date((s.end||s.start)+'T00:00:00');let i=monthly?(d.getFullYear()-start.getFullYear())*12+d.getMonth()-start.getMonth():Math.floor((d-start)/(7*86400000));if(i>=0&&i<6)bins[i].value+=Number(s.net||0)});let max=Math.max(...bins.map(x=>x.value));if(!max)return `<div class="chart-empty">Belum cukup data penjualan untuk menampilkan tren.</div>`;let points=bins.map((b,i)=>({x:48+i*62,y:154-(b.value/max)*112,label:b.start.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})})),line=points.map(p=>`${p.x},${p.y}`).join(' '),area=`48,164 ${line} 358,164`;return `<div class="chart-summary"><strong>${money(bins.reduce((n,b)=>n+b.value,0))}</strong><span>penjualan bersih · 6 minggu</span></div><div class="chart-wrap"><svg viewBox="0 0 380 190" preserveAspectRatio="none" role="img" aria-label="Penjualan bersih mingguan berdasarkan laporan tersimpan"><line class="chart-grid" x1="42" y1="40" x2="366" y2="40"/><line class="chart-grid" x1="42" y1="94" x2="366" y2="94"/><line class="chart-grid" x1="42" y1="148" x2="366" y2="148"/><text class="chart-label" x="0" y="43">${money(max).replace('Rp ','')}</text><text class="chart-label" x="0" y="97">${money(max/2).replace('Rp ','')}</text><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}" fill="none"/>${points.map((p,i)=>`<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="3"/><text class="chart-label" x="${p.x-17}" y="181">${p.label}</text>`).join('')}</svg></div><div class="chart-legend"><span><i class="legend-dot"></i>Penjualan bersih aktual</span></div>`}
  function stockInfographic(){
    const known=data.products.filter(p=>p.stock!=null&&Number.isFinite(Number(p.stock)));
    if(!known.length)return `<section class="stock-infographic card" aria-label="Status opname"><div class="stock-info-head"><div><span class="eyebrow">GUDANG PUSAT</span><h2>Komposisi stok</h2><p>Catat saldo awal melalui opname untuk melihat distribusi stok.</p></div><div class="stock-info-total"><strong>—</strong><span>belum diopname</span></div></div><div class="excel-source-note">Saldo stok belum tersedia di file master. Lakukan opname fisik sebelum membuat pengiriman.</div><div class="stock-info-foot"><span>${data.products.length} SKU menunggu opname awal</span><button class="text-action" data-page="inventory">Mulai opname</button></div></section>`;
    const groups=[...new Set(known.map(p=>p.category||'Lainnya'))].map(category=>{const items=known.filter(p=>(p.category||'Lainnya')===category),units=items.reduce((n,p)=>n+Number(p.stock),0);return{category,units,sku:items.length}}).sort((a,b)=>b.units-a.units),total=groups.reduce((n,g)=>n+g.units,0),swatches=['#EDAE49','#4A5057','#9BA2AA','#D7DADF','#75634A'];
    return `<section class="stock-infographic card" aria-label="Infografik komposisi stok"><div class="stock-info-head"><div><span class="eyebrow">GUDANG PUSAT</span><h2>Komposisi stok</h2><p>Distribusi unit berdasarkan kategori produk</p></div><div class="stock-info-total"><strong>${total.toLocaleString('id-ID')}</strong><span>unit tersedia</span></div></div><div class="stock-stack" role="group" aria-label="Komposisi unit per kategori">${groups.map((g,i)=>{const percent=total?g.units/total*100:0;return `<button class="stock-segment" style="width:${percent}%;--segment-color:${swatches[i%swatches.length]}" title="${esc(g.category)}: ${g.units} unit (${percent.toFixed(1)}%)" aria-label="${esc(g.category)}: ${g.units} unit, ${percent.toFixed(1)} persen" data-action="show-category" data-id="${esc(g.category)}"></button>`}).join('')}</div><div class="stock-info-legend">${groups.map((g,i)=>{const pct=total?g.units/total*100:0;return `<button class="stock-legend-item" data-action="show-category" data-id="${esc(g.category)}"><i style="--segment-color:${swatches[i%swatches.length]}"></i><span>${esc(g.category)}<small>${g.sku} SKU · ${g.units} unit</small></span><b>${pct.toFixed(0)}%</b></button>`}).join('')}</div><div class="stock-info-foot"><span>Tekan kategori untuk melihat daftar SKU</span><span>${groups.length} kategori</span></div></section>`
  }
  function recent(){let events=[...data.shipments.slice(0,2).map(x=>({type:'PENGIRIMAN',tone:'shipment',title:x.id,desc:`${storeName(x.store)} · ${x.items.reduce((a,b)=>a+b.qty,0)} unit`,time:x.date})),...data.sales.filter(x=>!x.status||x.status==='Disetujui').slice(0,2).map(x=>({type:'PENJUALAN',tone:'sale',title:'Laporan penjualan diterima',desc:`${storeName(x.store)} · ${money(x.net)}`,time:x.end})),...data.returns.slice(0,1).map(x=>({type:'RETUR',tone:'return',title:x.id,desc:`${prodName(x.sku)} · ${x.qty} unit`,time:x.date}))].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,4);return events.map(e=>`<div class="activity"><span class="activity-marker ${e.tone}" aria-hidden="true"></span><div class="activity-main"><small class="activity-type">${e.type}</small><strong>${esc(e.title)}</strong><small>${esc(e.desc)}</small></div><time>${date(e.time)}</time></div>`).join('')}
  function dashboard(){
    const known=data.products.filter(p=>p.stock!=null&&Number.isFinite(Number(p.stock))),center=known.reduce((n,p)=>n+Number(p.stock),0),branch=data.branchStock.reduce((n,x)=>n+Math.max(0,branchBalance(x)),0),dispatch=data.shipments.filter(x=>['Dikirim','In Transit','Partial'].includes(x.status)).reduce((n,po)=>n+po.items.reduce((a,item)=>a+Math.max(0,dispatchedQty(po,item)-Number(item.receivedQty||0)),0),0),total=center+branch+dispatch,discrepancies=data.counts.filter(x=>x.physical!=null&&data.products.find(p=>p.sku===x.sku)?.stock!=null&&Number(x.physical)!==Number(data.products.find(p=>p.sku===x.sku)?.stock)).length,low=known.filter(p=>Number(p.stock)<10).sort((a,b)=>a.stock-b.stock),products=[...(known.length?known:data.products)].filter(p=>!p.priceConflict).sort((a,b)=>{const sA=a.stock!=null&&Number.isFinite(Number(a.stock))?Number(a.stock):Infinity,sB=b.stock!=null&&Number.isFinite(Number(b.stock))?Number(b.stock):Infinity;if(sA!==sB)return sA-sB;const pDiff=Number(Boolean(window.HOWELL_PRODUCT_IMAGES?.[b.sku]))-Number(Boolean(window.HOWELL_PRODUCT_IMAGES?.[a.sku]));if(pDiff!==0)return pDiff;return(a.name||'').localeCompare(b.name||'')}).slice(0,3),transactions=[...data.shipments.flatMap(s=>s.items.map(i=>({id:s.id,product:prodName(i.sku),branch:storeName(s.store),type:'Pengiriman',qty:i.qty,date:s.date,status:s.status}))),...data.sales.map(s=>({id:s.id,product:prodName(s.sku),branch:storeName(s.store),type:'Laporan penjualan',qty:s.qty,date:s.end,status:s.status||'Disetujui'})),...data.returns.map(x=>({id:x.id,product:prodName(x.sku),branch:storeName(x.store),type:'Retur barang',qty:x.qty,date:x.date,status:x.status}))].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6),segmentTotal=Math.max(1,total),pct=n=>`${(n/segmentTotal*100).toFixed(1)}%`,stockValue=known.length?total.toLocaleString('id-ID'):'—';
    return `${demoBanner()}<section class="ware-dashboard"><div class="dash-left"><div class="dash-kpis">${kpi('TOTAL STOK',stockValue,known.length?`${known.length} SKU sudah diopname`:`${data.products.length} SKU · opname awal belum dilakukan`)}${kpi('DALAM PENGIRIMAN',dispatch.toLocaleString('id-ID'),`${data.shipments.filter(s=>['Dikirim','In Transit','Partial'].includes(s.status)).length} surat jalan aktif`)}${kpi('TOTAL CABANG',data.stores.length,'Cabang terdaftar')}${kpi('TOTAL PENJUALAN',money(data.sales.filter(s=>s.status==='Disetujui').reduce((n,s)=>n+Number(s.net||0),0)),'Akumulasi laporan tersimpan')}</div><article class="card capacity-card"><div class="card-topline"><div><small>HOWELL INVENTORY OVERVIEW</small><h2>Posisi persediaan</h2></div><button class="subtle-icon" data-action="go-inventory" aria-label="Buka stok">•••</button></div><div class="capacity-total"><strong>${stockValue}</strong><span>${known.length?'unit dalam jaringan':'saldo awal belum dicatat'}</span></div>${known.length?`<div class="capacity-bar" role="img" aria-label="Gudang pusat ${pct(center)}, cabang ${pct(branch)}, perjalanan ${pct(dispatch)}"><i class="bar-center" style="width:${pct(center)}"></i><i class="bar-branch" style="width:${pct(branch)}"></i><i class="bar-dispatch" style="width:${pct(dispatch)}"></i></div><div class="capacity-legend"><span><i class="center-dot"></i>Gudang pusat <b>${center.toLocaleString('id-ID')}</b></span><span><i class="branch-dot"></i>Cabang <b>${branch.toLocaleString('id-ID')}</b></span><span><i class="dispatch-dot"></i>Pengiriman <b>${dispatch.toLocaleString('id-ID')}</b></span></div>`:`<div class="excel-source-note">Jumlah stok tidak ada pada workbook. Lakukan opname fisik untuk memulai saldo.</div>`}<div class="insight-box"><small>INVENTORY INSIGHT</small><strong>${known.length?(low.length?`${low.length} SKU membutuhkan perhatian`:'Persediaan terpantau'):'Opname awal diperlukan'}</strong><p>${discrepancies?`${discrepancies} selisih opname tercatat. Tinjau perbedaan stok.`:known.length?'Pantau alokasi stok pusat dan cabang dari satu ringkasan.':'Data produk dan cabang sudah dimuat; saldo stok menunggu hasil hitung fisik.'}</p><button class="btn btn-dark" data-action="go-inventory">${known.length?'Lihat stok':'Mulai opname'}</button></div><div class="capacity-reminder"><span>${known.length?'Opname belum dicatat':'SKU menunggu opname'}</span><b>${data.products.length-known.length} SKU</b></div></article></div><div class="dash-center"><section class="product-showcase"><div class="section-heading"><div><small>MASTER PRODUK</small><h2>Produk Howell</h2></div><button class="text-action" data-page="products">Lihat semua</button></div><div class="product-card-row">${products.map(p=>`<button class="product-card" data-action="edit-product" data-id="${esc(p.sku)}"><span class="product-card-meta"><span>${esc(p.category)}</span><span>${esc(p.sku)}</span></span><span class="product-art">${productPhoto(p.sku)}</span><strong>${esc(p.name)}</strong><small>${p.priceReady?money(p.srp)+' SRP':'Harga belum tersedia'}${p.stock!=null?` · <b style="color:#d97706;font-weight:700">Stok ${Number(p.stock)} ${esc(p.uom||'unit')}</b>`:''}</small></button>`).join('')}</div></section><article class="card low-stock-card"><div class="section-heading"><div><small>PERLU PERHATIAN</small><h2>Stok menipis <span>${known.length?low.length:'—'}</span></h2></div><button class="text-action" data-action="view-low-stock">Lihat stok rendah</button></div><p class="threshold-note">Penanda saat ini: stok di bawah 10 unit</p>${known.length?(low.length?`<div class="low-stock-list">${low.slice(0,4).map(p=>`<button class="low-stock-row" data-action="edit-product" data-id="${esc(p.sku)}"><span class="low-stock-mark"></span><span><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category)}</small></span><b>${p.stock} ${esc(p.uom)}</b></button>`).join('')}</div>`:'<div class="chart-empty">Tidak ada SKU di bawah ambang 10 unit.</div>'):'<div class="chart-empty">Hasil stok rendah muncul setelah opname awal.</div>'}</article></div><article class="card sales-card"><div class="section-heading"><div><small>ANALITIK PENJUALAN</small><h2>Performa penjualan</h2></div><button class="text-action" data-page="sales">Laporan</button></div><div class="sales-switch"><span>Penjualan bersih</span><span>Unit terjual</span></div>${chart()}</article><article class="card transaction-card"><div class="section-heading"><div><small>AKTIVITAS GUDANG</small><h2>Transaksi terbaru</h2></div><button class="text-action" data-page="reports">Buka laporan</button></div>${table(['Nomor transaksi','Produk / aktivitas','Cabang','Jenis','Kuantitas','Tanggal','Status'],transactions.map(t=>`<tr><td><span class="sku">${esc(t.id)}</span></td><td><strong>${esc(t.product)}</strong></td><td>${esc(t.branch)}</td><td>${esc(t.type)}</td><td>${t.qty} unit</td><td>${date(t.date)}</td><td>${statusPill(t.status)}</td></tr>`),'Belum ada transaksi')}</article></section>`
  }
  const colKeyMap = {
    'nomor surat jalan': 'col_waybill_no',
    'customer': 'col_customer',
    'quantity keluar': 'col_qty_out',
    'status po': 'col_po_status',
    'tindakan & dokumen': 'col_actions',
    'nomor rekonsiliasi': 'col_recon_no',
    'cabang': 'col_branch',
    'periode': 'col_period',
    'sku & produk': 'col_sku_prod',
    'rincian hitung unit': 'col_calc_details',
    'penjualan kotor': 'col_gross_sales',
    'diskon retail': 'col_retail_discount',
    'penjualan bersih': 'col_net_sales',
    'status': 'col_status',
    'tindakan': 'col_actions',
    'produk': 'col_product',
    'sku': 'col_sku',
    'kategori': 'col_category',
    'hpp': 'col_hpp',
    'het': 'col_srp',
    'share toko': 'col_store_share',
    'gudang pusat': 'col_central_stock',
    'alamat': 'col_address',
    'pic': 'col_pic',
    'po / pic': 'col_po_no_pic',
    'customer / tanggal': 'col_customer_date',
    'produk & jumlah kirim': 'col_prod_qty',
    'total': 'col_total',
    'catatan': 'col_notes',
    'nomor tagihan': 'col_invoice_no',
    'cabang retail': 'col_retail_branch',
    'tanggal tagihan': 'col_invoice_date',
    'jatuh tempo': 'col_due_date',
    'komisi retail': 'col_retail_commission',
    'pembayaran bersih ke howell': 'col_net_to_howell',
    'pembayaran masuk': 'col_payment_received',
    'validasi / tindakan': 'col_actions'
  };

  function table(headers, rows, empty = t('empty_data', 'Belum ada data untuk ditampilkan.'), className = '') {
    const trHeaders = headers.map(h => {
      const clean = String(h).trim().toLowerCase();
      const k = colKeyMap[clean];
      return k ? t(k, h) : h;
    });
    return '<div class="table-wrap"><table' + (className ? ' class="' + esc(className) + '"' : '') + '><thead><tr>' +
      trHeaders.map(h => '<th>' + h + '</th>').join('') +
      '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + headers.length + '"><div class="empty-state"><strong>' + empty + '</strong><span>' + t('empty_subtitle', 'Tambahkan data untuk mulai melacak aktivitas.') + '</span></div></td></tr>') +
      '</tbody></table></div>';
  }

  function toolbar(extra='') {
    let trExtra = extra || '';
    if (trExtra) {
      trExtra = trExtra
        .replace(/>Semua kategori</g, '>' + t('all_categories', 'Semua kategori') + '<')
        .replace(/>Semua status</g, '>' + t('all_statuses', 'Semua status') + '<');
    }
    return '<div class="table-toolbar"><div class="toolbar-left"><div class="search"><svg class="table-search-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.6"></circle><path d="m10.2 10.2 3.1 3.1"></path></svg><input id="tableSearch" type="search" aria-label="' + esc(t('search_data', 'Cari data')) + '" placeholder="' + esc(t('search_data', 'Cari data...')) + '" value="' + esc(query) + '" /></div>' + trExtra + '</div><div class="toolbar-right"><button class="btn btn-light btn-small" data-action="export">' + t('export_excel', 'Ekspor Excel') + '</button></div></div>';
  }
  function recordSalesFromPo(po){
    data.sales ||= [];
    data.sales = data.sales.filter(s => s.sourcePo !== po.id);
    const customerName = po.customerName || storeName(po.store) || 'PT. Jingga Unggul Lohjinawi';
    const saleDate = po.dispatchDate || po.date || today;
    const dispatchNum = (po.dispatches && po.dispatches[0]?.number) || po.dispatchNumber || `SJ-${po.id}`;

    (po.items || []).forEach(item => {
      const qty = Number(dispatchedQty(po, item)) || Number(item.qty) || 0;
      if (qty <= 0) return;
      const product = data.products.find(p => p.sku === item.sku);
      const srp = Number(item.srpSnapshot || product?.srp || product?.basePrice || 0);
      const gross = srp * qty;
      const discount = 0;
      const net = gross - discount;
      const storeObj = data.stores.find(x => x.code === po.store);
      const howellShare = Number(storeObj?.supplierShare ?? 65);
      const storeShare = Number(storeObj?.storeShare ?? 35);

      const saleRecord = {
        id: `SLS-${po.id}-${item.sku}`,
        store: po.store || customerName,
        customerName: customerName,
        start: saleDate,
        end: saleDate,
        sku: item.sku,
        qty: qty,
        openingSnapshot: null,
        incomingSnapshot: null,
        returnSnapshot: null,
        physicalSnapshot: null,
        gross: gross,
        discount: discount,
        net: net,
        srpSnapshot: srp,
        howellShareSnapshot: howellShare,
        storeShareSnapshot: storeShare,
        status: 'Disetujui',
        sourcePo: po.id,
        sourceDispatch: dispatchNum,
        note: `Penjualan dari Surat Jalan ${dispatchNum} (PO ${po.id}) · Selesai terjual`
      };
      data.sales.unshift(saleRecord);
    });
  }
  function removeSalesFromPo(poId){
    if (!Array.isArray(data.sales)) return;
    data.sales = data.sales.filter(s => s.sourcePo !== poId);
  }

    function salesHistory(){
    const orders=Array.isArray(data.shipments)?data.shipments:[];
    const dispatchesOf=po=>Array.isArray(po?.dispatches)?po.dispatches:[];
    const isSoldPo=po=>['Selesai terjual','Done','Terjual'].includes(po?.status);
    const allDispatches=orders.flatMap(po=>dispatchesOf(po).map((dispatch,index)=>({po,dispatch,index}))).sort((a,b)=>(b.dispatch.date||'').localeCompare(a.dispatch.date||''));
    const soldDispatches=allDispatches.filter(x=>isSoldPo(x.po));
    const totalSoldUnits=soldDispatches.reduce((sum,x)=>sum+(Array.isArray(x.dispatch.items)?x.dispatch.items:[]).reduce((n,item)=>n+Number(item.qty||0),0),0);
    const uniqueCustomers=new Set(soldDispatches.map(x=>x.po.customerName||storeName(x.po.store)).filter(Boolean));
    const avgUnits=soldDispatches.length?Math.round(totalSoldUnits/soldDispatches.length):0;

    const rows=soldDispatches.map(({po,dispatch,index})=>{
      const actionButtons='<div class="po-actions warehouse-dispatch-actions">'+
        '<button type="button" class="btn btn-light btn-small waybill-print-action" data-action="print-waybill" data-dispatch-index="' + index + '" data-id="' + esc(po.id) + '">' + t('print_waybill', 'Cetak surat jalan') + '</button>'+
        (portalRole==='admin'?'<button type="button" class="btn btn-light btn-small" data-page="sales" title="Buka transaksi di menu Riwayat">' + t('view_sales', 'Lihat di Riwayat') + '</button>':'')+
        '<button type="button" class="btn btn-light btn-small" data-action="update-po-dispatch-status" data-id="' + esc(po.id) + '">' + t('change_status', 'Ubah status') + '</button>'+
      '</div>';
      return '<tr><td><strong>'+esc(dispatch.number||'—')+'</strong><div class="panel-subtitle">PO '+esc(po.id)+' · '+date(dispatch.date)+'</div></td><td><strong>'+esc(po.customerName||storeName(po.store))+'</strong></td><td>'+(Array.isArray(dispatch.items)?dispatch.items:[]).reduce((n,item)=>n+Number(item.qty||0),0).toLocaleString('id-ID')+' unit</td><td>'+statusPill(po.status)+'</td><td>'+actionButtons+'</td></tr>';
    });

    return heading('Riwayat','Daftar surat jalan dan pengeluaran barang gudang yang telah selesai terjual.',
      '<button class="btn btn-light" data-page="warehouse">Buka Gudang</button>'+
      (portalRole==='admin'?'<button class="btn btn-light" data-page="sales">Buka Laporan Penjualan</button>':'')
    )+demoBanner()+
    '<div class="section-grid warehouse-kpis">'+
      '<article class="card mini-card"><small>Surat Jalan Terjual</small><strong>'+soldDispatches.length+' SJ</strong><span>Status selesai terjual</span></article>'+
      '<article class="card mini-card"><small>Total Unit Terjual</small><strong>'+totalSoldUnits.toLocaleString('id-ID')+'</strong><span>Akumulasi barang keluar</span></article>'+
      '<article class="card mini-card"><small>Customer Terlayani</small><strong>'+uniqueCustomers.size+'</strong><span>Customer & cabang tujuan</span></article>'+
      '<article class="card mini-card"><small>Rata-rata per Surat Jalan</small><strong>'+avgUnits.toLocaleString('id-ID')+' unit</strong><span>Kuantitas per pengiriman</span></article>'+
    '</div>'+
    '<article class="card table-card warehouse-dispatches">'+
      toolbar('<select class="filter-select" id="salesHistoryCustomerFilter"><option>Semua customer</option>'+[...uniqueCustomers].map(c=>'<option>'+esc(c)+'</option>').join('')+'</select>')+
      table(['Nomor surat jalan','Customer','Quantity keluar','Status PO','Tindakan & Dokumen'],rows,'Belum ada riwayat penjualan dari gudang.')+
    '</article>';
  }

function warehouse(){
    const orders=Array.isArray(data.shipments)?data.shipments:[];
    const itemsOf=po=>Array.isArray(po?.items)?po.items:[];
    const dispatchesOf=po=>Array.isArray(po?.dispatches)?po.dispatches:[];
    const activeStatuses=['Draft','Menunggu verifikasi','Disetujui','Partial','Tidak disetujui','Ditangguhkan'];
    const queue=orders.filter(po=>activeStatuses.includes(po.status)&&itemsOf(po).some(item=>orderedQty(item)>dispatchedQty(po,item)));
    const ready=queue.filter(po=>['Disetujui','Partial'].includes(po.status));
    const activeQueue=queue.filter(po=>!['Tidak disetujui','Ditangguhkan'].includes(po.status));
    const outstanding=activeQueue.reduce((n,po)=>n+itemsOf(po).reduce((a,item)=>a+Math.max(0,orderedQty(item)-dispatchedQty(po,item)),0),0);
    const queueRows=queue.map(po=>{const pending=itemsOf(po).filter(item=>orderedQty(item)>dispatchedQty(po,item)),details=pending.map(item=>{const product=data.products.find(x=>x.sku===item.sku),ordered=orderedQty(item),sent=dispatchedQty(po,item),remaining=Math.max(0,ordered-sent);return '<div class="warehouse-queue-item"><span class="warehouse-product"><strong>'+esc(product?.name||item.sku)+'</strong><small>'+esc(item.sku)+'</small></span><span><small>Qty PO</small><b>'+ordered.toLocaleString('id-ID')+'</b></span><span><small>Sudah keluar</small><b>'+sent.toLocaleString('id-ID')+'</b></span><span><small>Sisa PO</small><b>'+remaining.toLocaleString('id-ID')+'</b></span></div>'}).join('');const statusAction='<button class="btn btn-light btn-small" data-action="update-warehouse-po-status" data-id="' + esc(po.id) + '">' + t('change_status', 'Ubah status') + '</button>';const dispatchAction=['Disetujui','Partial'].includes(po.status)?'<button class="btn btn-primary btn-small" data-action="dispatch-po" data-id="'+esc(po.id)+'">'+(dispatchesOf(po).length?'Buat surat jalan berikutnya':'Buat surat jalan')+'</button>':'';const action='<div class="po-actions warehouse-po-actions">'+statusAction+dispatchAction+'</div>';return '<tr><td><strong>'+esc(po.id)+'</strong><div class="panel-subtitle">'+esc(po.responsible||'')+'</div></td><td><strong>'+esc(po.customerName||storeName(po.store))+'</strong><div class="panel-subtitle">'+date(po.date)+'</div></td><td>'+esc(po.shipTo||'Alamat belum diisi')+'</td><td>'+details+'</td><td>'+statusPill(po.status)+'</td><td>'+action+'</td></tr>'});

    const isSoldPo=po=>['Selesai terjual','Done','Terjual'].includes(po?.status);
    const allDispatches=orders.flatMap(po=>dispatchesOf(po).map((dispatch,index)=>({po,dispatch,index}))).sort((a,b)=>(b.dispatch.date||'').localeCompare(a.dispatch.date||''));
    const soldDispatches=allDispatches.filter(x=>isSoldPo(x.po));
    const activeDispatches=allDispatches.filter(x=>!isSoldPo(x.po));
    const totalSoldUnits=soldDispatches.reduce((sum,x)=>sum+(Array.isArray(x.dispatch.items)?x.dispatch.items:[]).reduce((n,item)=>n+Number(item.qty||0),0),0);

    const dispatchedRows=allDispatches.map(({po,dispatch,index})=>{
      const isSold=isSoldPo(po);
      const actionButtons='<div class="po-actions warehouse-dispatch-actions">'+
        '<button type="button" class="btn btn-light btn-small waybill-print-action" data-action="print-waybill" data-dispatch-index="' + index + '" data-id="' + esc(po.id) + '">' + t('print_waybill', 'Cetak surat jalan') + '</button>'+
        (isSold
          ?'<button type="button" class="btn btn-light btn-small" data-page="sales" title="Buka transaksi di menu Riwayat">' + t('view_sales', 'Lihat di Riwayat') + '</button><button type="button" class="btn btn-light btn-small" data-action="update-po-dispatch-status" data-id="'+esc(po.id)+'">' + t('change_status', 'Ubah status') + '</button>'
          :'<button type="button" class="btn btn-primary btn-small" data-action="mark-po-sold" data-id="' + esc(po.id) + '" title="Tandai pesanan selesai terjual dan catat ke menu Riwayat">' + t('mark_sold', 'Selesai terjual (Done)') + '</button><button type="button" class="btn btn-light btn-small" data-action="update-po-dispatch-status" data-id="' + esc(po.id) + '" title="Ubah status pengiriman">' + t('change_status', 'Ubah status') + '</button>'
        )+'</div>';
      return '<tr><td><strong>'+esc(dispatch.number||'—')+'</strong><div class="panel-subtitle">PO '+esc(po.id)+' · '+date(dispatch.date)+'</div></td><td><strong>'+esc(po.customerName||storeName(po.store))+'</strong></td><td>'+(Array.isArray(dispatch.items)?dispatch.items:[]).reduce((n,item)=>n+Number(item.qty||0),0).toLocaleString('id-ID')+' unit</td><td>'+statusPill(po.status)+'</td><td>'+actionButtons+'</td></tr>';
    });

    const queueGuide=queue.length?'':`<div class="warehouse-guidance"><div><strong>Belum ada PO untuk diproses</strong><p>PO yang sudah dibuat oleh tim admin/marketing akan muncul di sini setelah tersimpan di database bersama.</p></div>${portalRole==='admin'?'<button class="btn btn-light btn-small" data-page="shipments">Buka Purchase Order</button>':''}</div>`;

    return heading('Gudang','Proses PO yang disetujui, catat barang keluar, dan buat surat jalan.',
      '<button class="btn btn-light" data-page="sales-history">Riwayat ('+soldDispatches.length+')</button><button class="btn btn-light" data-page="inventory">Buka Stok & Opname</button>'
    )+demoBanner()+
    '<div class="section-grid warehouse-kpis">'+
      '<article class="card mini-card"><small>' + t('po_active', 'PO berjalan') + '</small><strong>' + activeQueue.length + '</strong><span>' + t('po_active_sub', 'Masih memiliki quantity yang belum keluar') + '</span></article>' +
      '<article class="card mini-card"><small>' + t('po_ready', 'PO siap dikirim') + '</small><strong>' + ready.length + '</strong><span>' + t('po_ready_sub', 'Sudah disetujui dan dapat dibuatkan surat jalan') + '</span></article>' +
      '<article class="card mini-card"><small>' + t('po_outstanding', 'Unit belum keluar') + '</small><strong>' + outstanding.toLocaleString(currentLang === 'en' ? 'en-US' : (currentLang === 'zh' ? 'zh-CN' : 'id-ID')) + '</strong><span>' + t('po_outstanding_sub', 'Sisa quantity pada PO yang berjalan') + '</span></article>' +
      '<article class="card mini-card warehouse-kpi-sold" data-page="sales-history" style="cursor:pointer" title="Buka menu Riwayat"><small>' + t('menu_history', 'Riwayat') + '</small><strong>' + soldDispatches.length + t('sj_suffix', ' SJ') + '</strong><span>' + totalSoldUnits.toLocaleString(currentLang === 'en' ? 'en-US' : (currentLang === 'zh' ? 'zh-CN' : 'id-ID')) + ' ' + t('wh_sold_units_sub', 'unit selesai terjual') + '</span></article>'+
    '</div>'+
    queueGuide+
    '<article class="card table-card warehouse-queue"><div class="table-toolbar"><div><div class="panel-title">Purchase Order untuk gudang</div><div class="panel-subtitle">PO yang dibuat langsung tercatat di sini. Atur statusnya; surat jalan tersedia setelah PO disetujui.</div></div></div>'+table(['Nomor PO / penanggung jawab','Customer / tanggal PO','Alamat pengiriman','Produk dan quantity','Status','Tindakan'],queueRows,'Belum ada PO yang masih memiliki quantity untuk diproses.')+'</article>'+
    '<article class="card table-card warehouse-dispatches"><div class="table-toolbar"><div><div class="panel-title">Riwayat surat jalan</div><div class="panel-subtitle">Pengeluaran terbaru yang sudah disimpan dari Gudang.</div></div></div>'+table(['Nomor surat jalan','Customer','Quantity keluar','Status PO','Tindakan & Dokumen'],dispatchedRows,'Belum ada surat jalan.')+'</article>';
  }
  function inventory(){
    if (syncEnabled && !syncReady && syncConnecting) {
      return heading('Stok & Opname','Pantau persediaan gudang pusat dan catat saldo stok.')+
        '<div class="section-grid"><article class="card mini-card"><small>Total unit di gudang</small><strong>Memuat…</strong><span>Menghubungkan ke database VPS</span></article><article class="card mini-card"><small>SKU terverifikasi</small><strong>Memuat…</strong><span>Menghubungkan ke database VPS</span></article><article class="card mini-card"><small>Status koneksi</small><strong>Sinkronisasi</strong><span>Mengambil saldo stok terbaru</span></article></div>'+
        '<article class="card table-card inventory-table-card"><div class="empty-state" style="padding:48px 20px"><strong>Menghubungkan ke database bersama…</strong><span>Saldo stok sedang disinkronkan dari server VPS.</span></div></article>';
    }
    if (syncEnabled && !syncReady && syncErrorDetails) {
      return heading('Stok & Opname','Pantau persediaan gudang pusat dan catat saldo stok.')+
        '<div class="section-grid"><article class="card mini-card"><small>Total unit di gudang</small><strong>—</strong><span>Koneksi terputus</span></article><article class="card mini-card"><small>Status koneksi</small><strong style="color:var(--red,#c53030)">Tidak tersambung</strong><span>Periksa koneksi jaringan atau service VPS</span></article></div>'+
        '<article class="card table-card inventory-table-card"><div class="empty-state" style="padding:48px 20px"><strong style="color:var(--red,#c53030)">Database VPS tidak tersambung</strong><span style="margin:8px 0 16px">'+esc(syncErrorDetails)+'</span><button type="button" class="btn btn-primary" data-action="retry-db-sync">Hubungkan ulang</button></div></article>';
    }
    const known=data.products.filter(p=>p.stock!=null&&Number.isFinite(Number(p.stock))),low=known.filter(p=>Number(p.stock)<10),categoryOf=p=>String(p.category||'Tanpa kategori');
    const categories=[...new Set(data.products.map(categoryOf))].sort((a,b)=>a.localeCompare(b,'id-ID'));
    const headers=['Produk & spesifikasi','SKU','Kategori','Stok tersedia','Tindakan'];
    const categorySections=categories.map(category=>{
      const products=data.products.filter(p=>categoryOf(p)===category),verified=products.filter(p=>p.stock!=null&&Number.isFinite(Number(p.stock))).length;
      const rows=products.map(p=>{const knownStock=p.stock!=null&&Number.isFinite(Number(p.stock)),stock=knownStock?Number(p.stock):null;return '<tr><td><div class="product-name"><span class="product-thumbnail">'+inventoryPhoto(p)+'</span><div><strong>'+esc(p.name)+'</strong><div class="panel-subtitle">'+esc(p.spec)+'</div></div></div></td><td><span class="sku">'+esc(p.sku)+'</span></td><td>'+esc(categoryOf(p))+'</td><td>'+(knownStock?'<strong>'+stock.toLocaleString('id-ID')+' '+esc(p.uom)+'</strong><small class="stock-source">Sumber: '+esc(p.stockSource||data.counts.find(x=>x.sku===p.sku)?.source||'Belum dicatat')+'</small>':pill('Belum diverifikasi','gray'))+'</td><td><button class="link-btn" data-action="count" data-id="'+esc(p.sku)+'">Perbarui stok</button></td></tr>'});
      return '<details class="inventory-category" data-inventory-category="'+esc(category)+'"><summary class="inventory-category-summary"><div class="inventory-category-title"><strong>'+esc(category)+'</strong><small>'+products.length.toLocaleString('id-ID')+' SKU · '+verified.toLocaleString('id-ID')+' sudah diverifikasi</small></div><div class="inventory-category-meta"><b>'+products.length.toLocaleString('id-ID')+' produk</b><span class="inventory-category-toggle" aria-hidden="true"></span></div></summary>'+table(headers,rows,'Belum ada produk dalam kategori ini.')+'</details>';
    }).join('');
    const categoryOptions=categories.map(category=>'<option>'+esc(category)+'</option>').join('');
    const accordionControls='<div class="inventory-category-controls"><button type="button" class="btn btn-light btn-small" id="inventoryExpandAll">Buka semua</button><button type="button" class="btn btn-light btn-small" id="inventoryCollapseAll">Ringkas semua</button></div>';
    const inventoryActions='<button class="btn btn-light" data-action="barcode-scan">Pindai EAN-13</button>'+(portalRole==='warehouse'?'<button class="btn btn-primary" data-action="count">Mulai opname gudang</button>':'<button class="btn btn-light" data-action="export">Ekspor stok</button><button class="btn btn-light" data-action="start-branch-count">Opname cabang</button><button class="btn btn-primary" data-action="count">Mulai opname gudang</button>');
    return heading('Stok & Opname','Pantau persediaan gudang pusat dan catat saldo stok.',inventoryActions)+'<div class="excel-source-note">'+known.length+' dari '+data.products.length+' SKU sudah memiliki saldo opname. Data master dan pricelist tidak memuat jumlah stok.</div><div class="section-grid"><article class="card mini-card"><small>Total unit di gudang</small><strong>'+(known.length?known.reduce((a,p)=>a+Number(p.stock),0).toLocaleString('id-ID'):'—')+'</strong><span>'+(known.length?'Stok hasil opname':'Belum ada saldo hasil hitung')+'</span></article><article class="card mini-card"><small>SKU stok rendah</small><strong>'+(known.length?low.length:'—')+'</strong><span>'+(known.length?'Perlu dijadwalkan pengiriman':'Tersedia setelah opname')+'</span></article><article class="card mini-card"><small>Cabang terpantau</small><strong>'+data.stores.length+'</strong><span>Daftar Paperclip dari dokumen sumber</span></article></div><article class="card table-card inventory-table-card">'+toolbar('<select class="filter-select" id="categoryFilter"><option>Semua kategori</option>'+categoryOptions+'</select>'+accordionControls)+'<div class="inventory-categories" id="inventoryCategories">'+(categorySections||'<div class="empty-state"><strong>Belum ada produk.</strong></div>')+'</div></article>';
  }
  function formatSourceCurrency(value,header=''){if(value==null||value===''||!/(harga|price|srp|hpp|omzet)/i.test(String(header)))return value??'';const raw=String(value).trim();const numeric=typeof value==='number'?value:Number(raw.replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'));if(!Number.isFinite(numeric))return value;return 'Rp.'+Math.round(numeric).toLocaleString('id-ID')}
  function importedExcelCatalog(){const book=window.HOWELL_MASTER_DRAFT;if(!book)return '';const sheets=book.sheets||[];return `<article class="card table-card excel-catalog"><div class="excel-catalog-head"><div><span class="eyebrow">SUMBER EXCEL · ${esc(book.sourceFile)}</span><h2>Data katalog dari semua sheet</h2><p>${book.sheetCount} sheet · ${book.dataRowCount} baris tersimpan · ${book.nonEmptyCellCount} sel terisi. Baris judul kategori juga dipertahankan.</p></div><label class="excel-search-label">Cari seluruh sheet<input id="excelSearch" type="search" placeholder="Cari SKU, produk, harga…" /></label></div><div class="excel-source-note">Workbook ini berisi data katalog dan harga. Tidak ada kolom stok, jadi angka stok operasional belum diisi dari file ini.</div><div class="excel-sheets">${sheets.map((sheet,index)=>{const columns=(sheet.columns||[]).filter(col=>String(col).toUpperCase()!=='F'),headers=columns.map(col=>sheet.headers[col]||`Kolom ${col} (tanpa judul)`),rows=(sheet.records||[]).map(record=>`<tr class="excel-record">${columns.map(col=>{const cell=record.cells[col],value=formatSourceCurrency(cell?.value??'',sheet.headers?.[col]||'');return `<td data-search-value="${esc(cell?.value??'')}"${cell?.formula?` title="Formula Excel: ${esc(cell.formula)}"`:''}>${esc(value)}</td>`}).join('')}</tr>`).join('');return `<details class="excel-sheet" data-excel-sheet="${esc(sheet.name.toLowerCase())}" ${index===0?'open':''}><summary><span><strong>${esc(sheet.title||sheet.name)}</strong><small>${esc(sheet.name)} · ${sheet.dataRowCount} baris · ${sheet.skuCount} SKU</small></span><b>${sheet.dataRowCount}</b></summary><div class="table-wrap"><table><thead><tr>${headers.map((header,i)=>`<th title="Kolom ${esc(columns[i])}">${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${columns.length}">Tidak ada baris data.</td></tr>`}</tbody></table></div></details>`}).join('')}</div></article>`}
  function importedB2BPriceList(){const book=window.HOWELL_SOURCE_DATA?.priceList;if(!book)return '';const columns=(book.headers||[]).map((header,index)=>({header,index})).filter(column=>column.index!==5),rows=(book.rows||[]).map(row=>'<tr class="excel-record"><td>'+row.excelRow+'</td>'+columns.map(({header,index})=>{const value=formatSourceCurrency(row.values[index]??'',header),formula=row.formulas[index];return '<td data-search-value="'+esc(row.values[index]??'')+'"'+(formula?' title="Formula Excel: '+esc(formula)+'"':'')+'>'+esc(value)+'</td>'}).join('')+'</tr>').join('');return '<article class="card table-card excel-catalog"><div class="excel-catalog-head"><div><span class="eyebrow">SUMBER EXCEL · '+esc(book.sourceFile)+'</span><h2>Pricelist B2B lengkap</h2><p>'+esc(book.sheet)+' · '+book.sheetRows+' baris lembar · '+book.nonEmptyRows+' baris berisi data · '+book.productRows+' baris harga</p></div><label class="excel-search-label">Cari pricelist<input id="priceListSearch" type="search" placeholder="Cari SKU, nama, harga…" /></label></div><div class="excel-source-note">Isi lembar sumber ditampilkan bersama nomor baris Excel. Baris judul, header berulang, rumus, dan kolom kosong dipertahankan agar dapat dicocokkan kembali dengan workbook asli.</div><details class="excel-sheet" data-price-list open><summary><span><strong>'+esc(book.sheet)+'</strong><small>'+esc(book.sourceFile)+' · '+book.rows.length+' baris sumber tersimpan</small></span><b>'+book.rows.length+'</b></summary><div class="table-wrap"><table><thead><tr><th>Baris Excel</th>'+columns.map(({header,index})=>'<th title="Kolom '+String.fromCharCode(65+index)+'">'+esc(header||('Kolom '+String.fromCharCode(65+index)+' (tanpa judul)'))+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></details></article>'}
  function products(){
    const rows=data.products.map(p=>`<tr><td><div class="product-name"><span class="product-thumbnail">${productPhoto(p.sku)}</span><div><strong>${esc(p.name)}</strong><div class="panel-subtitle">${esc(p.spec)}</div></div></div></td><td><span class="sku">${esc(p.sku)}</span>${p.priceConflict?` ${pill('SKU perlu diklarifikasi','amber')}`:''}</td><td>${esc(p.category)}${p.brand?' · '+esc(p.brand):''}</td><td>${p.hpp==null?'—':money(p.hpp)}</td><td>${p.srp==null||!p.priceReady?pill('Harga belum tersedia','amber'):money(p.srp)}</td><td>${p.margin==null?'—':p.margin+'%'}</td><td>${p.stock==null?'Belum diopname':Number(p.stock).toLocaleString('id-ID')+' '+esc(p.uom)}</td><td><button class="link-btn" data-action="edit-product" data-id="${esc(p.sku)}">Edit</button></td></tr>`);
    const noPrice=data.products.filter(p=>!p.priceReady&&!p.priceConflict).length,conflicts=data.products.filter(p=>p.priceConflict).length;
    return `${heading('Master Produk','Katalog dari seluruh sheet master, dipasangkan dengan pricelist B2B Howell.',`<button class="btn btn-light" data-action="export">Ekspor Excel</button><button class="btn btn-primary" data-action="add-product">Tambah produk</button>`)}${importedExcelCatalog()}${importedB2BPriceList()}<article class="card table-card"><div class="panel-title">Produk operasional</div><div class="panel-subtitle">${data.products.length} SKU unik. Nilai harga dan stok mengikuti sumber yang tersedia; item tanpa harga atau SKU ganda tidak dapat dipakai untuk laporan penjualan.</div><div class="excel-source-note">Pembagian B2B: 65% Howell dan 35% Paperclip. ${noPrice} SKU belum memiliki SRP valid; ${conflicts} SKU memiliki varian berbeda pada sumber dan perlu klarifikasi sebelum dijual.</div>${toolbar(`<select class="filter-select" id="categoryFilter"><option>Semua kategori</option>${[...new Set(data.products.map(p=>p.category))].map(x=>`<option>${esc(x)}</option>`).join('')}</select>`)}${table(['Produk','SKU','Kategori','HPP+10%','SRP / HET','Porsi Paperclip','Stok pusat','Tindakan'],rows)}</article>`
  }
  function exportBranches(){const headers=['Kode cabang','Nama cabang','Jaringan','Wilayah','Alamat','Narahubung','Telepon','Email','Termin','Porsi Howell (%)','Porsi Paperclip (%)','Tanggal berlaku','Status kerja sama','Kapasitas rak'];const rows=data.stores.map(x=>[x.code,x.name,x.network,x.region,x.address,x.contact,x.phone,x.email,x.term,x.supplierShare,x.storeShare,x.effectiveDate,x.agreementStatus,x.capacity]);downloadExcelWorkbook('howell-cabang-paperclip-'+today+'.xlsx',[{name:'Cabang Retail',rows:[headers,...rows]}],[headers,...rows]);toast('Daftar cabang berhasil diekspor ke Excel.')}
  function stores(){const branches=data.stores.filter(x=>!x.network||x.network.toLocaleLowerCase('id-ID')==='paperclip').sort((a,b)=>a.name.localeCompare(b.name,'id-ID'));const rows=branches.map(x=>`<div class="paperclip-branch-row" data-branch-search="${esc((x.code+' '+x.name+' '+(x.region||'')).toLocaleLowerCase('id-ID'))}"><span class="paperclip-branch-code">${esc(x.code)}</span><span class="paperclip-branch-info"><strong>${esc(x.name)}</strong><small>${esc(x.region||'Wilayah belum tersedia')}</small></span><span class="paperclip-branch-status">${pill(x.agreementStatus||'Perlu perjanjian',x.agreementStatus==='Aktif'?'green':'gray')}</span><button type="button" class="btn btn-light btn-small" data-action="edit-store" data-id="${esc(x.code)}">Edit</button></div>`).join('');return `${heading('Cabang Retail','Kelola jaringan toko konsinyasi yang menerima produk Howell.',`<button class="btn btn-light" data-action="export-branches">Ekspor Excel</button><button class="btn btn-primary" data-action="add-store">Tambah cabang</button>`)}<section class="paperclip-network"><button type="button" id="paperclipBranchesToggle" class="card paperclip-selector" data-action="open-paperclip-branches" aria-expanded="false" aria-controls="paperclipBranchesPanel"><span class="paperclip-selector-copy"><small class="eyebrow">JARINGAN RETAIL</small><strong>Paperclip</strong><span class="panel-subtitle">Daftar cabang Paperclip yang terdaftar</span></span><span class="paperclip-selector-trailing"><span class="pill gray">${branches.length} cabang</span><span class="paperclip-chevron" aria-hidden="true">⌄</span></span></button><div id="paperclipBranchesPanel" class="paperclip-branches-panel" aria-hidden="true" inert><div class="paperclip-branches-inner"><div class="paperclip-branches-tools"><label><span class="sr-only">Cari cabang Paperclip</span><input id="paperclipBranchSearch" type="search" placeholder="Cari nama cabang, kode, atau wilayah…"></label><span>${branches.length} cabang</span></div><div class="paperclip-branches-list" id="paperclipBranchList">${rows||'<p class="paperclip-empty">Belum ada cabang Paperclip.</p>'}</div><div class="paperclip-branches-footer">Cabang ${branches.length} · Kelola detail melalui tombol Edit.</div></div></div></section>`;}
  function closePaperclipPopup(){const panel=document.querySelector('#paperclipBranchesPanel'),button=document.querySelector('#paperclipBranchesToggle');if(!panel||!button)return;panel.classList.remove('is-open');panel.setAttribute('aria-hidden','true');panel.setAttribute('inert','');button.setAttribute('aria-expanded','false')}
  function openPaperclipBranches(){const panel=document.querySelector('#paperclipBranchesPanel'),button=document.querySelector('#paperclipBranchesToggle');if(!panel||!button)return;if(panel.classList.contains('is-open')){closePaperclipPopup();return}panel.removeAttribute('inert');panel.setAttribute('aria-hidden','false');panel.classList.add('is-open');button.setAttribute('aria-expanded','true')}
  function openPurchaseOrderEditor(existing=null,{readyForDispatch=false,warehouseMode=false}={}){if(existing&&((existing.dispatches||[]).length||(existing.items||[]).some(item=>dispatchedQty(existing,item)>0)||['Dikirim','In Transit','Diterima','Received'].includes(existing.status)))return toast('PO yang sudah memiliki Surat Jalan tidak dapat diedit. Hapus PO jika ingin membatalkan pengiriman dan memulihkan stok.');const products=data.products,storesList=data.stores.filter(x=>x.network==='Paperclip'||!x.network),nextId=()=>`PO-HWL-${today.replaceAll('-','')}-${String(data.shipments.filter(x=>(x.id||'').includes(today.replaceAll('-',''))).length+1).padStart(3,'0')}`;let serial=0;openModal(existing?'Edit Purchase Order':'Buat Purchase Order',[],values=>{const unfinished=[...$('#poLineBody').querySelectorAll('[data-po-line]')].find(row=>row.querySelector('[data-product-search]').value.trim()&&!row.querySelector('[data-po-sku]').value);if(unfinished){toast('Pilih produk dari hasil pencarian atau hapus baris yang belum selesai.');unfinished.querySelector('[data-product-search]').focus();return}const lines=[...$('#poLineBody').querySelectorAll('[data-po-line]')].map(row=>({sku:values['poSku'+row.dataset.poLine],qty:Number(values['poQty'+row.dataset.poLine])})).filter(x=>x.sku);const id=String(values.poNumber||'').trim(),store=data.stores.find(x=>x.code===values.poStore);if(!id||data.shipments.some(x=>x.id.toLowerCase()===id.toLowerCase()&&x.id!==existing?.id))return toast('Nomor PO wajib dan harus unik.');if(!store)return toast('Pilih cabang retail terlebih dahulu.');if(!String(values.poResponsible||'').trim())return toast('Nama penanggung jawab wajib diisi.');if(!values.poDate)return toast('Tanggal Purchase Order wajib diisi.');if(!lines.length||lines.some(x=>!x.sku||!Number.isSafeInteger(x.qty)||x.qty<1))return toast('Pilih produk dan isi kuantitas minimal satu untuk setiap baris.');if(new Set(lines.map(x=>x.sku)).size!==lines.length)return toast('Produk duplikat. Gunakan tombol salin untuk menduplikasi baris lalu pilih SKU berbeda.');const items=lines.map(line=>{const p=data.products.find(x=>x.sku===line.sku);return{sku:p.sku,qty:line.qty,orderedQty:line.qty,dispatchedQty:0,receivedQty:0,barcodeSnapshot:p.barcode||'',hppSnapshot:Number(p.hpp),srpSnapshot:Number(p.srp),storeShareSnapshot:Number(store.storeShare??35)}});const row={...(existing||{}),id,date:values.poDate,eta:values.poDate,store:store.code,customerName:String(values.poCustomerName||'').trim()||store.name,shipTo:values.poAddress.trim(),responsible:values.poResponsible.trim(),items,status:readyForDispatch?'Disetujui':'Draft',recipient:'',grn:'',stockDispatched:false,dispatches:existing?.dispatches||[],createdAt:existing?.createdAt||new Date().toISOString()};if(existing&&!readyForDispatch){delete row.approvedAt;delete row.warehouseReviewedAt;delete row.warehouseReviewNote;}if(existing){data.shipments[data.shipments.findIndex(x=>x.id===existing.id)]=row;recordAudit(readyForDispatch?'approve':'update','purchase-order',id,{status:row.status,store:row.store,items:items.map(x=>({sku:x.sku,qty:x.qty})),shipTo:row.shipTo})}else{data.shipments.unshift(row);recordAudit('create','purchase-order',id,{store:row.store,items:items.map(x=>({sku:x.sku,qty:x.qty})),shipTo:row.shipTo})}data.demo=false;save();closeModal();render();toast(readyForDispatch?'PO diperbarui dan siap dibuatkan surat jalan':existing?'Purchase Order diperbarui':'Purchase Order tersimpan sebagai draft')},{poNumber:existing?.id||nextId(),poDate:existing?.date||today,poStore:existing?.store||storesList[0]?.code||'',poResponsible:existing?.responsible||'Howell Cable',poAddress:existing?.shipTo||''});$('#modalBackdrop').classList.add('po-editor-backdrop');if(!existing&&!readyForDispatch){$('#modalBackdrop').classList.add('po-create-workspace');$('#modalClose').textContent='Kembali ke Purchase Order';$('#modalClose').setAttribute('aria-label','Kembali ke Purchase Order');$('#modalCancel').textContent='Batal';}$('#modalEyebrow').textContent=existing?'EDIT PURCHASE ORDER':'PURCHASE ORDER BARU';$('#modalTitle').textContent=existing?'Edit Purchase Order':'Buat Purchase Order';$('#modalSubmit').textContent=readyForDispatch?'Simpan & siapkan surat jalan':'Simpan PO';const branchOptions=storesList.map(x=>`<option value="${esc(x.code)}">${esc(x.name)} · ${esc(x.code)}</option>`).join('');$('#modalFields').innerHTML=`<div class="po-editor${warehouseMode?' warehouse-mode':''}"><div class="po-header-grid"><label>Nomor PO<input name="poNumber" id="poNumber" value="${esc(existing?.id||nextId())}" required></label><label>Tanggal PO<input type="date" name="poDate" id="poDate" value="${esc(existing?.date||today)}" required></label><label>Penanggung jawab<input name="poResponsible" id="poResponsible" value="${esc(existing?.responsible||'Howell Cable')}" required></label><label>Cabang retail / customer<select name="poStore" id="poStore" required>${branchOptions}</select></label><label>Nama perusahaan<input name="poCustomerName" id="poCustomerName" value="${esc(existing?.customerName||data.stores.find(x=>x.code===(existing?.store||storesList[0]?.code))?.name||'')}" required></label><label class="po-address-field">Ship to address<input name="poAddress" id="poAddress" value="${esc(existing?.shipTo||data.stores.find(x=>x.code===(existing?.store||storesList[0]?.code))?.address||'')}" placeholder="Alamat tujuan pengantaran"></label></div><div class="po-details-heading"><div><small>RINCIAN PURCHASE ORDER</small><h3>Produk dan kuantitas</h3></div><button type="button" class="btn btn-light btn-small" id="poAddLine">+ Tambah baris</button></div><div class="po-table-wrap"><table class="po-detail-table"><thead><tr><th>Action</th><th>No</th><th>Product</th><th>SKU</th>${warehouseMode?'':'<th>Harga / produk</th><th>Harga SRP</th>'}<th>Quantity</th>${warehouseMode?'':'<th>Total harga omzet</th><th>Margin toko</th>'}</tr></thead><tbody id="poLineBody"></tbody></table></div>${warehouseMode?'':'<div class="po-summary"><span><small>Total quantity</small><strong id="poTotalQty">0 unit</strong></span><span><small>Total harga omzet</small><strong id="poTotalOmzet">Rp 0</strong></span><span><small>Margin toko</small><strong id="poTotalMargin">Rp 0</strong></span></div>'}<p class="po-editor-note">${warehouseMode?'Detail harga dan margin tidak ditampilkan pada proses gudang. Surat jalan dibuat setelah PO disimpan.':'Harga dan margin diambil dari pricelist B2B yang tersedia. Jumlah stok gudang akan diperiksa saat barang disiapkan untuk surat jalan.'}</p></div>`;const body=$('#poLineBody');const refresh=()=>{let totalQty=0,totalOmzet=0,totalMargin=0;body.querySelectorAll('[data-po-line]').forEach((row,index)=>{row.querySelector('[data-po-no]').textContent=String(index+1);const sku=row.querySelector('[data-po-sku]').value,product=data.products.find(p=>p.sku===sku),sourceProduct=initial.products.find(p=>p.sku===sku),priceProduct=product?{...product,hpp:product.hpp==null||product.hpp===''||!Number.isFinite(Number(product.hpp))?sourceProduct?.hpp:Number(product.hpp),srp:product.srp==null||product.srp===''||!Number.isFinite(Number(product.srp))?sourceProduct?.srp:Number(product.srp)}:sourceProduct,qty=Number(row.querySelector('input[type=number]').value||0),share=Number(data.stores.find(s=>s.code===$('#poStore').value)?.storeShare??35),gross=priceProduct?Number(priceProduct.srp)*qty:0,margin=gross*share/100;row.querySelector('[data-po-sku-label]').textContent=product?.sku||'—';const hppCell=row.querySelector('[data-po-hpp]'),srpCell=row.querySelector('[data-po-srp]'),grossCell=row.querySelector('[data-po-gross]'),marginCell=row.querySelector('[data-po-margin]');if(hppCell)hppCell.textContent=priceProduct?money(priceProduct.hpp):'—';if(srpCell)srpCell.textContent=priceProduct?money(priceProduct.srp):'—';if(grossCell)grossCell.textContent=priceProduct?money(gross):'—';if(marginCell)marginCell.textContent=priceProduct?`${share}% · ${money(margin)}`:'—';totalQty+=qty;totalOmzet+=gross;totalMargin+=margin});const totalQtyEl=$('#poTotalQty'),totalOmzetEl=$('#poTotalOmzet'),totalMarginEl=$('#poTotalMargin');if(totalQtyEl)totalQtyEl.textContent=totalQty.toLocaleString('id-ID')+' unit';if(totalOmzetEl)totalOmzetEl.textContent=money(totalOmzet);if(totalMarginEl)totalMarginEl.textContent=money(totalMargin)};const productOptionsFor=(row,search=row?.querySelector('[data-product-search]'))=>{const id=search?.getAttribute('aria-controls');return(id&&document.getElementById(id))||row?.querySelector('[data-product-options]')};const setProduct=(row,sku)=>{if(!row)return;const product=products.find(p=>p.sku===sku),search=row.querySelector('[data-product-search]'),value=row.querySelector('[data-po-sku]'),list=productOptionsFor(row,search);value.value=product?.sku||'';search.value=product?`${product.name} · ${product.sku}`:'';list.style.display='none';list.removeAttribute('data-portaled');row.querySelector('.po-product-picker').append(list);search.setAttribute('aria-expanded','false');refresh()};const showProductOptions=(row,query='')=>{const search=row?.querySelector('[data-product-search]'),list=productOptionsFor(row,search);if(!search||!list)return;const term=String(query??'').trim().toLocaleLowerCase('id-ID'),tokens=term.split(/\s+/).filter(Boolean),matches=products.filter(p=>{const haystack=[p.sku,p.name,p.barcode,p.category,p.spec].filter(Boolean).join(' ').toLocaleLowerCase('id-ID');return tokens.every(token=>haystack.includes(token))});list._searchOwner=search;list.innerHTML=matches.length?matches.map(p=>`<button type="button" class="po-product-option" role="option" data-product-sku="${esc(p.sku)}"><span>${esc(p.name)}</span><small>${esc(p.sku)}</small></button>`).join(''):'<span class="po-product-empty">Produk tidak ditemukan.</span>';if(list.parentElement!==document.body){document.body.append(list);list.setAttribute('data-portaled','true')}const rect=search.getBoundingClientRect(),viewportWidth=document.documentElement.clientWidth||window.innerWidth,viewportHeight=window.innerHeight,margin=12,gap=6,maxAllowedHeight=Math.max(0,Math.min(260,viewportHeight-margin*2)),width=Math.max(0,Math.min(Math.max(rect.width,300),viewportWidth-margin*2)),left=Math.max(margin,Math.min(rect.left,viewportWidth-width-margin)),availableBelow=Math.max(0,viewportHeight-rect.bottom-gap-margin),availableAbove=Math.max(0,rect.top-gap-margin),openAbove=availableBelow<Math.min(180,maxAllowedHeight)&&availableAbove>availableBelow,maxHeight=Math.min(maxAllowedHeight,openAbove?availableAbove:availableBelow),top=openAbove?rect.top-gap-maxHeight:rect.bottom+gap;list.style.left=`${left}px`;list.style.top=`${top}px`;list.style.width=`${width}px`;list.style.setProperty('max-height',String(maxHeight)+'px','important');list.style.display='block';search.setAttribute('aria-expanded','true')};const addLine=(sku='',qty=1)=>{const key=String(serial++),tr=document.createElement('tr');tr.dataset.poLine=key;tr.innerHTML=`<td><div class="po-row-actions"><button type="button" data-row-action="add" title="Tambah baris">Tambah</button><button type="button" data-row-action="copy" title="Salin baris">Salin</button><button type="button" data-row-action="delete" title="Hapus baris">Hapus</button></div></td><td data-po-no></td><td><div class="po-product-picker"><div class="po-product-search-control"><input type="search" data-product-search autocomplete="off" placeholder="Cari nama produk atau SKU…" aria-label="Cari produk berdasarkan nama atau SKU" aria-autocomplete="list" aria-expanded="false" aria-controls="poProductOptions${key}"><button type="button" class="po-product-search-button" data-product-search-action aria-label="Cari produk">Cari</button></div><input type="hidden" name="poSku${key}" data-po-sku><div class="po-product-options" id="poProductOptions${key}" data-product-options role="listbox" style="display:none"></div></div></td><td data-po-sku-label>—</td>${warehouseMode?'':'<td data-po-hpp>—</td><td data-po-srp>—</td>'}<td><input type="number" name="poQty${key}" min="1" step="1" value="${qty}" required></td>${warehouseMode?'':'<td data-po-gross>—</td><td data-po-margin>—</td>'}`;body.append(tr);const search=tr.querySelector('[data-product-search]'),searchButton=tr.querySelector('[data-product-search-action]');searchButton.addEventListener('mousedown',e=>e.preventDefault());searchButton.addEventListener('click',()=>showProductOptions(tr,search.value));search.addEventListener('focus',()=>showProductOptions(tr,search.value===`${products.find(p=>p.sku===tr.querySelector('[data-po-sku]').value)?.name} · ${tr.querySelector('[data-po-sku]').value}`?'':search.value));search.addEventListener('input',()=>{tr.querySelector('[data-po-sku]').value='';refresh();showProductOptions(tr,search.value)});tr.querySelector('[data-product-options]').addEventListener('mousedown',e=>{if(e.target.closest('[data-product-sku]'))e.preventDefault()});tr.querySelector('[data-product-options]').addEventListener('click',e=>{const option=e.target.closest('[data-product-sku]');if(option)setProduct(tr,option.dataset.productSku)});search.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const list=productOptionsFor(tr,search);if(list){list.style.display='none';if(list.dataset.portaled){tr.querySelector('.po-product-picker').append(list);list.removeAttribute('data-portaled')}}search.setAttribute('aria-expanded','false');}else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();showProductOptions(tr,search.value)}});tr.querySelector('input[type=number]').addEventListener('input',refresh);if(sku)setProduct(tr,sku);refresh()};body.addEventListener('click',e=>{const option=e.target.closest('[data-product-sku]');if(option){const row=option.closest('[data-po-line]');if(row)setProduct(row,option.dataset.productSku);return}const button=e.target.closest('[data-row-action]');if(!button)return;e.preventDefault();e.stopPropagation();const row=button.closest('[data-po-line]');if(button.dataset.rowAction==='copy')addLine(row.querySelector('[data-po-sku]').value,row.querySelector('input[type=number]').value);else if(button.dataset.rowAction==='add')addLine();else{productOptionsFor(row)?.remove();row.remove();if(!body.querySelector('[data-po-line]'))addLine();refresh()}});$('#poAddLine').onclick=()=>addLine();$('#poStore').value=existing?.store||storesList[0]?.code||'';const syncBranch=(forceAddress=false)=>{const branch=data.stores.find(x=>x.code===$('#poStore').value);if(forceAddress||!$('#poCustomerName').value)$('#poCustomerName').value=branch?.name||'';if(forceAddress||!existing||!$('#poAddress').value)$('#poAddress').value=branch?.address||'';refresh()};$('#poStore').addEventListener('change',()=>syncBranch(true));body.addEventListener('focusout',e=>{const row=e.target.closest('[data-po-line]');if(!row)return;setTimeout(()=>{if(!row.contains(document.activeElement)){const search=row.querySelector('[data-product-search]'),list=productOptionsFor(row,search);if(list){list.style.display='none';if(list.dataset.portaled){row.querySelector('.po-product-picker').append(list);list.removeAttribute('data-portaled')}}search.setAttribute('aria-expanded','false')}},120)});syncBranch();if(existing?.items?.length)existing.items.forEach(x=>addLine(x.sku,orderedQty(x)));else addLine();const lineWrap=$(".po-table-wrap");if(lineWrap)lineWrap.scrollLeft=0}
    function createWaybillPrintFrame(paperSize='continuous'){
    const frame=document.createElement('iframe');
    frame.title='Cetak surat jalan';
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;left:-10000px;top:0;width:'+(paperSize==='a4-portrait'?'210mm':'241.3mm')+';height:'+(paperSize==='a4-portrait'?'297mm':'139.7mm')+';border:0';
    document.body.appendChild(frame);
    return frame;
  }
  function openPurchaseOrderDispatch(po){
    const branch=data.stores.find(x=>x.code===po.store);
    const pending=(Array.isArray(po?.items)?po.items:[]).map(item=>({item,product:data.products.find(x=>x.sku===item.sku),remaining:Math.max(0,orderedQty(item)-dispatchedQty(po,item))})).filter(row=>row.remaining>0),stockShortages=pending.filter(row=>!hasStock(row.product)||Number(row.product.stock)<row.remaining);
    if(!pending.length)return toast('Seluruh kuantitas PO sudah dibuatkan surat jalan.');
    if(po.date&&today<po.date)return toast('Tanggal surat jalan tidak boleh sebelum tanggal PO.');
    const existingNumbers=new Set(data.shipments.flatMap(order=>[...(Array.isArray(order.dispatches)?order.dispatches.map(entry=>entry.number):[]),order.dispatchNumber]).filter(Boolean).map(value=>String(value).toLowerCase()));
    const prefix='SJ-HNI-'+today.replaceAll('-','')+'-';
    const prefixKey=prefix.toLowerCase(),highestSequence=[...existingNumbers].reduce((max,value)=>{if(!value.startsWith(prefixKey))return max;const parsed=Number(value.slice(prefixKey.length));return Number.isSafeInteger(parsed)?Math.max(max,parsed):max;},0);let sequence=highestSequence+1,dispatchNumber=prefix+String(sequence).padStart(3,'0');
    while(existingNumbers.has(dispatchNumber.toLowerCase())){sequence++;dispatchNumber=prefix+String(sequence).padStart(3,'0');}
    openModal('Siapkan barang untuk surat jalan',[],values=>{
      const driver=String(values.driver||'').trim(),recipient=String(values.recipient||'').trim(),note=String(values.note||'').trim();
      if(!driver)return toast('Nama pengantar wajib diisi.');if(!recipient)return toast('Nama penerima / PIC wajib diisi.');
      const lines=[];
      for(let i=0;i<pending.length;i++){
        const qty=Number(values['dispatchQty'+i]||0),row=pending[i];
        if(!Number.isSafeInteger(qty)||qty<0||qty>row.remaining)return toast('Quantity keluar untuk '+row.item.sku+' harus antara 0 dan sisa PO ('+row.remaining+').');
        if(qty>(hasStock(row.product)?Number(row.product.stock):0)){const available=hasStock(row.product)?Number(row.product.stock).toLocaleString('id-ID'):'belum diopname';return toast('Stok SKU '+row.item.sku+' tidak cukup: dibutuhkan '+qty.toLocaleString('id-ID')+' unit, tersedia '+available+'. Surat jalan tidak disimpan.')}
        if(qty>0)lines.push({sku:row.item.sku,qty:qty});
      }
      if(!lines.length)return toast('Masukkan quantity keluar minimal satu produk.');
      const beforeDispatch=structuredClone(data);
      lines.forEach(line=>{const item=po.items.find(value=>value.sku===line.sku),product=data.products.find(value=>value.sku===line.sku);product.stock-=line.qty;item.dispatchedQty=dispatchedQty(po,item)+line.qty;item.receivedQty=Number(item.receivedQty||0);});
      const dispatch={number:dispatchNumber,date:today,sender:po.responsible||'Howell Cable',driver:driver,recipient:recipient,note:note,warehouse:'Gudang Pusat Howell',items:lines};
      po.dispatches||=[];po.dispatches.push(dispatch);po.dispatchNumber=dispatchNumber;po.dispatchDate=today;po.stockDispatched=true;po.status=po.items.every(item=>dispatchedQty(po,item)>=orderedQty(item))?'Dikirim':'Partial';
      recordAudit('dispatch','purchase-order',po.id,{dispatchNumber:dispatchNumber,date:today,items:lines,sender:dispatch.sender,driver:driver,recipient:recipient,warehouse:dispatch.warehouse});
      const printSnapshot={po:structuredClone(po),dispatch:structuredClone(dispatch),branch:branch?structuredClone(branch):null,products:lines.map(line=>{const product=data.products.find(x=>x.sku===line.sku);return product?structuredClone(product):{sku:line.sku}})};
      data.demo=false;save();closeModal();
      const dispatchIndex=po.dispatches.length-1;
      const finishDispatch=()=>{
        if(syncEnabled&&(!syncReady||syncBlocked)){
          for(const key of Object.keys(data))delete data[key];
          Object.assign(data,beforeDispatch);
          save();
          render();
          return toast('VPS gagal menyimpan. Stok dikembalikan dan Surat Jalan tidak dicetak.');
        }
        render();
        openWaybillPrintOptions(po.id,dispatchIndex,null,printSnapshot);
        toast('Surat jalan tersimpan dan siap dicetak.');
      };
      if(syncEnabled)syncQueue.then(finishDispatch);else finishDispatch();
    });
    $('#modalBackdrop').classList.add('dispatch-editor-backdrop');
    $('#modalEyebrow').textContent='PENGELUARAN GUDANG';
    $('#modalSubmit').textContent='Buat surat jalan';
    $('#modalFields').innerHTML='<div class="dispatch-editor"><div class="dispatch-header-summary"><span><small>Purchase Order</small><strong>'+esc(po.id)+'</strong></span><span><small>Cabang tujuan</small><strong>'+esc(po.customerName||branch?.name||po.store)+'</strong></span><span><small>Ship to</small><strong>'+esc(po.shipTo||branch?.address||'Alamat belum diisi')+'</strong></span><span><small>Nomor surat jalan · '+date(today)+'</small><strong>'+esc(dispatchNumber)+'</strong></span></div><div class="dispatch-meta-grid"><label>Pengantar<input name="driver" value="Anam" autocomplete="name" required></label><label>Penerima / PIC<input name="recipient" value="Mika Pasaribu" autocomplete="name" required></label><label>Catatan surat jalan (opsional)<input name="note" placeholder="Contoh: kondisi kemasan atau instruksi penerimaan"></label></div><p id="dispatchStockWarning" role="status" aria-live="polite" style="display:none"></p><div class="po-table-wrap"><table class="po-dispatch-table"><thead><tr><th>Produk</th><th>SKU</th><th>Qty PO</th><th>Sudah keluar</th><th>Sisa PO</th><th>Quantity keluar</th></tr></thead><tbody>'+pending.map((row,i)=>'<tr><td data-label="Produk"><strong>'+esc(row.product?.name||row.item.sku)+'</strong></td><td data-label="SKU">'+esc(row.item.sku)+'</td><td data-label="Qty PO">'+orderedQty(row.item)+'</td><td data-label="Sudah keluar">'+dispatchedQty(po,row.item)+'</td><td data-label="Sisa PO">'+row.remaining+'</td><td data-label="Quantity keluar"><input type="number" name="dispatchQty'+i+'" min="0" max="'+row.remaining+'" value="'+row.remaining+'" required></td></tr>').join('')+'</tbody></table></div><p class="po-editor-note">Stok pusat berkurang sesuai quantity yang keluar. Surat jalan akan langsung dicetak setelah tersimpan.</p></div>';
    const dispatchTableWrap=$('.po-table-wrap');if(dispatchTableWrap)dispatchTableWrap.scrollLeft=0;if(stockShortages.length){const stockWarning=$('#dispatchStockWarning'),submit=$('#modalSubmit'),details=stockShortages.map(row=>{const available=hasStock(row.product)?Number(row.product.stock).toLocaleString('id-ID'):'belum diopname';return row.item.sku+' (diminta '+row.remaining+', stok tersedia '+available+')'}).join('; ');stockWarning.textContent='Surat jalan belum dapat dibuat karena stok gudang kurang: '+details+'. Lakukan opname atau pulihkan stok terlebih dahulu.';stockWarning.style.cssText='display:block;margin:10px 0;padding:10px 12px;border:1px solid #D4A91E;border-radius:8px;background:#FFF2BF;color:#17191C;font-size:12px;line-height:1.5';submit.disabled=true;submit.title='Stok gudang tidak cukup untuk seluruh sisa PO.';}
  }
  function openWaybillPrintOptions(id,dispatchIndex=null,printFrame=null,printSnapshot=null){
    openModal('Pilih ukuran kertas',[{name:'paperSize',label:'Ukuran kertas',type:'select',required:true,items:[{value:'continuous',label:'Continuous Form · 9,5 × 5,5 inci'},{value:'a4-portrait',label:'A4 · Potret (21 × 29,7 cm)'}]}],values=>{const paperSize=values.paperSize==='a4-portrait'?'a4-portrait':'continuous';if(printFrame){printFrame.style.width=paperSize==='a4-portrait'?'210mm':'241.3mm';printFrame.style.height=paperSize==='a4-portrait'?'297mm':'139.7mm'}printWaybill(id,dispatchIndex,printFrame,printSnapshot,paperSize)},{paperSize:'continuous'});$('#modalEyebrow').textContent='PILIHAN CETAK';$('#modalTitle').textContent='Pilih ukuran kertas';$('#modalSubmit').textContent='Cetak surat jalan';
  }
  function printWaybill(id,dispatchIndex=null,printFrame=null,printSnapshot=null,paperSize='continuous'){
    const po=printSnapshot?.po||data.shipments.find(x=>x.id===id);if(!po||String(po.id)!==String(id)){printFrame?.remove();return toast('Identitas PO untuk cetak tidak cocok. Surat jalan dibatalkan.');}
    const dispatch=printSnapshot?.dispatch||(dispatchIndex!==null?(po.dispatches||[])[dispatchIndex]:(po.dispatches||[]).at(-1)||{number:po.dispatchNumber||po.id,date:po.dispatchDate||po.date,sender:po.responsible||'Howell Cable',driver:po.driver||'',recipient:po.recipient||'',warehouse:'Gudang Pusat Howell',items:po.items.map(x=>({sku:x.sku,qty:dispatchedQty(po,x)}))});
    dispatch.number=String(dispatch.number||po.id||'').replace(/^SJ-HWL-/i,'SJ-HNI-');
    if(!dispatch?.items?.length){printFrame?.remove();return toast('Surat jalan belum dibuat.');}
    const branch=printSnapshot?.branch||data.stores.find(x=>x.code===po.store),products=printSnapshot?.products||data.products,logoUrl=new URL('assets/howell-logo-color.png',window.location.href).href,isA4Portrait=paperSize==='a4-portrait';
    const itemCount=(dispatch?.items||[]).length;
    const isCompact=itemCount>=8&&itemCount<=11,isDense=itemCount>=12&&itemCount<=16,isUltraDense=itemCount>=17&&itemCount<=22,isExtreme=itemCount>=23;
    const dynFont=isExtreme?'5.8pt':isUltraDense?'6.8pt':isDense?'7.5pt':isCompact?'8.4pt':'9.2pt';
    const dynBrandTitle=isExtreme?'7.5pt':isUltraDense?'8.5pt':isDense?'9pt':isCompact?'9.5pt':'10pt';
    const dynDocTitle=isExtreme?'8pt':isUltraDense?'8.5pt':isDense?'9pt':isCompact?'9.8pt':'10.5pt';
    const dynLineH=isExtreme?'0.98':isUltraDense?'1.02':isDense?'1.04':isCompact?'1.08':'1.12';
    const dynCellPad=isExtreme?'0.08mm 0.5mm':isUltraDense?'0.15mm 0.8mm':isDense?'0.2mm 1mm':isCompact?'0.3mm 1.2mm':'0.4mm 1.5mm';
    const dynSigSpace=isExtreme?'2.5mm':isUltraDense?'3.5mm':isDense?'4.5mm':isCompact?'5.5mm':'7mm';
    const dynMetaGap=isExtreme?'0.05mm 1mm':isUltraDense?'0.1mm 1.5mm':isDense?'0.15mm 1.5mm':isCompact?'0.2mm 2mm':'0.3mm 2mm';
    const dynRemarksPad=isExtreme?'0.1mm 0.8mm':isUltraDense?'0.15mm 1mm':isDense?'0.2mm 1mm':'0.3mm 1.5mm';

    const paperOverrides=isA4Portrait
      ? `@page{size:A4 portrait;margin:10mm}@media screen{body{width:210mm;min-height:297mm;padding:10mm}}
         .items th:nth-child(1),.items td:nth-child(1){width:6%!important;text-align:center!important}
         .items th:nth-child(2){width:19%!important;text-align:center!important}
         .items td:nth-child(2){width:19%!important;text-align:left!important;padding-left:2mm!important}
         .items th:nth-child(3){width:49%!important;text-align:center!important}
         .items td:nth-child(3){width:49%!important;text-align:left!important;padding-left:2mm!important}
         .items th:nth-child(4),.items td:nth-child(4){width:13%!important;text-align:center!important}
         .items th:nth-child(5),.items td:nth-child(5){width:13%!important;text-align:center!important}`
      : `@page{size:9.5in 5.5in;margin:0}@media print,screen{
           *,*::before,*::after,html,body{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif!important;font-size:${dynFont}!important;font-weight:700!important;color:#000!important;line-height:${dynLineH}!important}
           html,body{width:176mm!important;max-width:176mm!important;max-height:133mm!important;margin:2mm 0 0 3mm!important;padding:0!important;background:#fff!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
           .watermark{display:none!important}
           .brand{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;padding-bottom:0.3mm!important;border-bottom:1.2px solid #000!important;gap:3mm!important;width:176mm!important}
           .brand-copy{flex:1 1 auto;min-width:0}
           .brand-copy strong{display:block!important;font-size:${dynBrandTitle}!important;font-weight:700!important;line-height:1.1!important}
           .brand-copy span{display:block!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .brand-copy small{display:block!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .doc-number{text-align:right!important;width:72mm!important;flex-shrink:0!important;white-space:nowrap!important}
           .doc-number small{display:block!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .doc-number strong{display:block!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important;margin:0.2mm 0!important}
           .document-title{margin:0.3mm 0!important;padding:0.2mm 0!important;border-bottom:1.2px solid #000!important;text-align:center!important;width:176mm!important}
           .document-title h1{margin:0!important;font-size:${dynDocTitle}!important;font-weight:700!important;letter-spacing:0.04em!important;line-height:1.1!important}
           .document-title p{margin:0.2mm 0 0!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .meta{display:grid!important;grid-template-columns:48% 52%!important;gap:0.3mm 3mm!important;margin-bottom:0.3mm!important;width:176mm!important}
           .meta-group{display:grid!important;grid-template-columns:minmax(30mm,auto) 1fr!important;gap:${dynMetaGap}!important;align-content:start!important;min-width:0!important}
           .meta-group h2{grid-column:1/-1!important;margin:0 0 1px!important;padding-bottom:1px!important;border-bottom:1px solid #000!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .meta-group span{font-size:${dynFont}!important;font-weight:700!important;white-space:nowrap!important;line-height:1.1!important}
           .meta-group strong{font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important;word-break:break-word!important;overflow-wrap:break-word!important}
           .table-wrap{width:176mm!important}
           .items{width:176mm!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0.3mm 0!important}
           .items th,.items td{border:1.2px solid #000!important;padding:${dynCellPad}!important;vertical-align:middle!important;font-size:${dynFont}!important;font-weight:700!important;word-break:break-word!important;line-height:1.1!important}
           .items th{background:#f0f0f0!important;text-align:center!important}
           .items th:nth-child(1),.items td:nth-child(1){width:6%!important;text-align:center!important}
           .items th:nth-child(2){width:20%!important;text-align:center!important}
           .items td:nth-child(2){width:20%!important;text-align:left!important;padding-left:2mm!important}
           .items th:nth-child(3){width:48%!important;text-align:center!important}
           .items td:nth-child(3){width:48%!important;text-align:left!important;padding-left:2mm!important}
           .items th:nth-child(4),.items td:nth-child(4){width:13%!important;text-align:center!important}
           .items th:nth-child(5),.items td:nth-child(5){width:13%!important;text-align:center!important}
           .items td strong,.items td small{font-size:${dynFont}!important;font-weight:700!important;color:#000!important}
           .remarks{width:176mm!important;min-height:2mm!important;margin-top:0.3mm!important;margin-bottom:0.2mm!important;padding:${dynRemarksPad}!important;border:1px solid #000!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .remarks strong{display:inline-block!important;margin-right:4px!important;font-size:${dynFont}!important;font-weight:700!important}
           .acknowledgement{width:176mm!important;margin:0.2mm 0 0.3mm!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important;word-break:break-word!important}
           .signatures{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:6mm!important;width:176mm!important;margin:0.5mm 0 0!important;text-align:center!important}
           .signature{display:flex!important;flex-direction:column!important;align-items:center!important}
           .signature .role{margin:0!important;font-size:${dynFont}!important;font-weight:700!important;line-height:1.1!important}
           .signature .space{height:${dynSigSpace}!important}
           .signature .line{border-top:1.2px solid #000!important;width:80%!important;height:0!important;margin:0 auto!important}
           !important;font-weight:700!important;text-align:left!important;line-height:1.1!important}
         }@media print{
           html,body{width:176mm!important;max-width:176mm!important;max-height:133mm!important;margin:2mm 0 0 3mm!important;overflow:hidden!important}
           body{break-inside:avoid!important;page-break-inside:avoid!important}
           .brand,.document-title,.meta,.remarks,.acknowledgement,.signatures{break-inside:avoid!important;page-break-inside:avoid!important}
           .items thead{display:table-header-group!important}
           .items tr{break-inside:avoid!important;page-break-inside:avoid!important}
         }`;

    const rows=dispatch.items.map((item,index)=>{
      const product=products.find(x=>x.sku===item.sku);
      const rawSize=String(product?.spec||'').trim(),sizeDisplay=/\d+(?:[.,]\d+)?\s*(?:mm|cm|m(?:eter|eters|etre|metres)?|inch(?:es)?|in|ft|feet)(?:\b|$)/i.test(rawSize)?rawSize:'—';
      const nameSource=String(product?.name||item.sku),lengthMatch=sizeDisplay.match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m(?:eter|eters|etre|metres)?|inch(?:es)?|in|ft|feet)\b/i),lengthValue=lengthMatch?.[1].replace(/[.,]/g,'[.,]'),lengthUnit=lengthMatch?.[2].toLowerCase(),lengthUnitPattern=lengthUnit==='mm'?'mm':lengthUnit==='cm'?'cm':lengthUnit==='m'||lengthUnit?.startsWith('meter')||lengthUnit==='metre'||lengthUnit==='metres'?'m(?:eter|eters|etre|metres)?':lengthUnit==='inch'||lengthUnit==='in'?'(?:inch(?:es)?|in)':lengthUnit==='ft'||lengthUnit==='feet'?'(?:ft|feet)':null;
      const nameDisplay=lengthMatch?nameSource.replace(new RegExp('\\s*\\(?\\s*'+lengthValue+'\\s*(?:'+lengthUnitPattern+')\\s*\\)?','ig'),'').replace(/\s*-\s*CM\s*$/i,'').replace(/\s*-\s*$/,'').replace(/\s{2,}/g,' ').trim():nameSource;
      return `<tr><td class="num">${index+1}</td><td>${esc(item.sku)}</td><td><strong>${esc(nameDisplay)}</strong></td><td class="spec">${esc(sizeDisplay)}</td><td class="qty">${Number(item.qty||0).toLocaleString('id-ID')}</td></tr>`;
    }).join('');

    const frame=printFrame||createWaybillPrintFrame(paperSize),w=frame.contentWindow;if(!w){frame.remove();return toast('Frame cetak surat jalan gagal disiapkan.');}
    const originalPageTitle=document.title,pdfTitle=('Surat Jalan '+String(dispatch.number||po.id)).replace(/[\\/:*?"<>|]+/g,'-').trim();

    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Surat Jalan ${esc(dispatch.number||po.id)}</title><style>
      @page{size:21cm 14.8cm;margin:4mm}*{box-sizing:border-box}body{margin:0;color:#202328;font:8pt/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.brand{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px;padding:0 0 12px;border-bottom:2px solid #25282b}.brand-main{display:flex;align-items:center;gap:18px;min-width:0}.brand img{display:block;width:126px;max-height:39px;object-fit:contain;object-position:left center}.brand-copy{display:grid;gap:2px}.brand-copy strong{font-size:15pt;line-height:1.2}.brand-copy span{font-size:10pt;font-weight:600}.brand-copy small{color:#59616a;font-size:9pt}.doc-number{text-align:right;min-width:180px}.doc-number small,.doc-number strong{display:block}.doc-number small{color:#59616a;font-size:9pt}.doc-number strong{margin:3px 0;font-size:12pt}.document-title{margin:5px 0 6px;padding:4px 0;border-bottom:1px solid #8b9095;text-align:center}.document-title h1{margin:0;font-size:16pt;line-height:1.25;letter-spacing:.035em}.document-title p{margin:3px 0 0;color:#59616a;font-size:9.5pt}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 14px;margin:0 0 7px}.meta-group{display:grid;grid-template-columns:minmax(94px,34%) minmax(0,1fr);gap:2px 5px;align-content:start}.meta-group h2{grid-column:1/-1;margin:0 0 3px;padding-bottom:4px;border-bottom:1px solid #d8dce0;font-size:7.5pt;letter-spacing:.045em}.meta-group span{color:#59616a;font-size:7pt}.meta-group strong{font-size:7.5pt;font-weight:600;overflow-wrap:anywhere}.meta-group:nth-child(n+3){padding-top:1px}.items{width:100%;border-collapse:collapse;table-layout:fixed;break-inside:auto}.items thead{display:table-header-group}.items tr{break-inside:avoid}.items th,.items td{padding:1.5mm 1mm;border:1px solid #7d8389;text-align:center;vertical-align:middle}.items th{background:#f0f1ef;font-size:7pt;font-weight:700}.items .num{width:34px;text-align:center}.items th:nth-child(1),.items td:nth-child(1){width:6%!important;text-align:center!important}.items th:nth-child(2){width:19%!important;text-align:center!important}.items td:nth-child(2){width:19%!important;text-align:left!important;padding-left:2mm!important}.items th:nth-child(3){width:49%!important;text-align:center!important}.items td:nth-child(3){width:49%!important;text-align:left!important;padding-left:2mm!important}.items th:nth-child(4),.items td:nth-child(4){width:13%!important;text-align:center!important}.items th:nth-child(5),.items td:nth-child(5){width:13%!important;text-align:center!important}.items td strong,.items td small{display:block}.items td strong{font-size:7.5pt}.items td small{margin-top:1px;color:#59616a;font-size:6.5pt}.items .qty{text-align:center;font-variant-numeric:tabular-nums}.remarks{min-height:8mm;margin-top:4mm;padding:2mm;border:1px solid #7d8389;break-inside:avoid}.remarks strong{display:block;margin-bottom:2px;font-size:7pt;letter-spacing:.03em}.remarks span{white-space:pre-wrap}.acknowledgement{margin:3mm 0 0;color:#454b52;font-size:7pt}.signatures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12mm;max-width:180mm;margin:8mm auto 0;text-align:center;break-inside:avoid}.signature{min-width:0}.signature .role{min-height:4mm;margin:0;font-size:7.5pt;font-weight:600}.signature .space{height:14mm}.signature .line{border-top:1.2px solid #555;height:0;margin:0 auto;width:80%}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.remarks,.signatures{break-inside:avoid}}@media screen{body{width:210mm;min-height:148mm;margin:20px auto;padding:5mm;background:#fff;box-shadow:0 2px 18px #0002}}
      ${paperOverrides}</style></head><body><header class="brand"><div class="brand-main"><div class="brand-copy"><strong>PT Howell Niaga Indonesia</strong><span>Gudang Pusat</span><small>Dokumen pengeluaran barang konsinyasi</small></div></div><div class="doc-number"><small>Nomor Surat Jalan</small><strong>${esc(dispatch.number||'—')}</strong><small style="margin-top:3px">Tanggal: ${date(dispatch.date)}</small></div></header><section class="document-title"><h1>SURAT JALAN BARANG</h1><p>Pengiriman Purchase Order Retail</p></section><section class="meta"><div class="meta-group"><h2>DATA PENGIRIM</h2><span>Perusahaan</span><strong>PT Howell Niaga Indonesia</strong><span>Gudang</span><strong>${esc(dispatch.warehouse||'Gudang Pusat Howell')}</strong><span>Penanggung jawab</span><strong>${esc(dispatch.sender||'—')}</strong><span>Nomor PO</span><strong>${esc(po.id)}</strong><span>Tanggal PO</span><strong>${date(po.date)}</strong></div><div class="meta-group"><h2>DATA PENERIMA</h2><span>Nama perusahaan</span><strong>PT JINGGA UNGGUL LOHJINAWI</strong><span>Cabang / customer</span><strong>${esc(po.customerName||storeName(po.store))}</strong><span>Alamat tujuan</span><strong>${esc(po.shipTo||branch?.address||'—')}</strong><span>Penerima / PIC</span><strong>${esc(dispatch.recipient||'Mika Pasaribu')}</strong><span>Kontak cabang</span><strong>${esc(branch?.phone||'—')}</strong></div></section><div class="table-wrap">${isA4Portrait?`<div class="watermark" aria-hidden="true"><img src="${esc(logoUrl)}" alt=""></div>`:""}<table class="items"><thead><tr><th>No</th><th>SKU</th><th>Nama Barang</th><th>Ukuran</th><th>QTY</th></tr></thead><tbody>${rows}</tbody></table></div><section class="remarks"><strong>CATATAN</strong><span>${esc(dispatch.note||'')}</span></section><p class="acknowledgement">Barang di atas diserahkan untuk pengiriman sesuai Purchase Order. Penerima dapat mencatat kondisi atau kekurangan barang pada kolom catatan.</p><section class="signatures"><div class="signature"><p class="role">Warehouse</p><div class="space"></div><div class="line"></div></div><div class="signature"><p class="role">Pengantar</p><div class="space"></div><div class="line"></div></div><div class="signature"><p class="role">Penerima</p><div class="space"></div><div class="line"></div></div></section><script>(function(){var maxH=133.2*96/25.4;var curH=document.body.scrollHeight;if(curH>maxH){var factor=(maxH/curH)*0.99;document.body.style.transform='scale('+factor+')';document.body.style.transformOrigin='top center';}})();</script></body></html>`);
    w.document.close();
    const cleanupPrintFrame=()=>{if(frame.isConnected)frame.remove()};
    w.addEventListener('afterprint',()=>setTimeout(cleanupPrintFrame,100),{once:true});
    setTimeout(cleanupPrintFrame,120000);
    let pageTitleRestored=false;const restorePageTitle=()=>{if(pageTitleRestored)return;pageTitleRestored=true;if(document.title===pdfTitle)document.title=originalPageTitle};
    window.addEventListener('afterprint',restorePageTitle,{once:true});w.addEventListener('afterprint',restorePageTitle,{once:true});
    const printWhenReady=()=>{
      const images=[...w.document.images];
      Promise.all(images.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});setTimeout(resolve,2500)}))).then(()=>setTimeout(()=>{if(!w.closed){w.document.title=pdfTitle;document.title=pdfTitle;w.focus();w.print();setTimeout(restorePageTitle,120000)}},150));
    };
    if(w.document.readyState==='complete')printWhenReady();else w.addEventListener('load',printWhenReady,{once:true});
  }
  function shipments(){
    const dispatchedTotal=data.shipments.filter(po=>po.status!=='Rejected').reduce((sum,po)=>sum+po.items.reduce((n,item)=>n+dispatchedQty(po,item),0),0);
    const rows=data.shipments.map(po=>{
      const qty=po.items.reduce((n,item)=>n+orderedQty(item),0),gross=po.items.reduce((n,item)=>n+Number(item.srpSnapshot||0)*orderedQty(item),0),dispatches=po.dispatches||[];
      const actionButtons=[];
      if(po.status==='Draft')actionButtons.push('<button class="link-btn" data-action="submit-po" data-id="'+esc(po.id)+'">Ajukan</button>');
      else if(po.status==='Menunggu verifikasi')actionButtons.push('<button class="link-btn" data-action="approve-po" data-id="'+esc(po.id)+'">Setujui PO</button>');
      else if(['Disetujui','Partial'].includes(po.status)&&po.items.some(item=>orderedQty(item)>dispatchedQty(po,item)))actionButtons.push('<button class="link-btn" data-page="warehouse">Proses di Gudang</button>');
      else if(['Tidak disetujui','Ditangguhkan'].includes(po.status)&&po.items.some(item=>orderedQty(item)>dispatchedQty(po,item)))actionButtons.push('<button class="link-btn" data-page="warehouse">Kelola status di Gudang</button>');
      const hasWaybill=dispatches.length>0||po.items.some(item=>dispatchedQty(po,item)>0),canEdit=portalRole==='admin'&&!hasWaybill&&!['Dikirim','In Transit','Diterima','Received'].includes(po.status),editBlockReason=hasWaybill?'PO sudah memiliki Surat Jalan. Hapus PO untuk membatalkan dan memulihkan stok.':'Status PO ini tidak dapat diedit.';
      if(portalRole==='admin')actionButtons.push(canEdit?'<button type="button" class="btn btn-light btn-small" data-action="edit-purchase-order" data-id="'+esc(po.id)+'" title="Buka formulir untuk mengubah PO">Edit</button>':'<button type="button" class="btn btn-light btn-small po-edit-disabled" data-action="edit-purchase-order-locked" data-id="'+esc(po.id)+'" aria-disabled="true" title="Klik untuk melihat alasan">Edit terkunci</button>');
      if(portalRole==='admin')actionButtons.push('<button class="btn btn-danger btn-small" data-action="delete-purchase-order" data-id="'+esc(po.id)+'">Hapus PO</button>');
      if(['Selesai terjual','Done','Terjual'].includes(po.status)){
        actionButtons.push('<button class="link-btn" data-page="sales" title="Buka transaksi di menu Riwayat">' + t('view_sales', 'Lihat di Riwayat') + '</button>');
        actionButtons.push('<button class="link-btn" data-action="update-po-dispatch-status" data-id="'+esc(po.id)+'">' + t('change_status', 'Ubah status') + '</button>');
      } else if(['Dikirim','In Transit','Dalam proses','Pending'].includes(po.status)){
        actionButtons.push('<button class="btn btn-primary btn-small" data-action="mark-po-sold" data-id="'+esc(po.id)+'" title="Tandai pesanan selesai terjual & otomatis masuk ke Riwayat">Selesai terjual</button>');
        actionButtons.push('<button class="link-btn" data-action="update-po-dispatch-status" data-id="'+esc(po.id)+'">' + t('change_status', 'Ubah status') + '</button>');
      }
      const actions=actionButtons.length?'<div class="po-actions">'+actionButtons.join('')+'</div>':'';
      const details=po.items.map(item=>{const product=data.products.find(x=>x.sku===item.sku);return '<div class="po-product-summary"><span><strong>'+esc(product?.name||item.sku)+'</strong><small>'+esc(item.sku)+'</small></span><span>'+orderedQty(item)+' unit<small>'+money(Number(item.srpSnapshot||0)*orderedQty(item))+'</small></span></div>'}).join('');
      return '<tr><td><strong>'+esc(po.id)+'</strong><div class="panel-subtitle">'+esc(po.responsible||'')+'</div></td><td><strong>'+esc(po.customerName||storeName(po.store))+'</strong><div class="panel-subtitle">'+date(po.date)+'</div></td><td>'+esc(po.shipTo||'—')+'</td><td><div class="po-product-list">'+details+'</div><div class="panel-subtitle">'+qty.toLocaleString('id-ID')+' unit · omzet SRP '+money(gross)+'</div></td><td>'+statusPill(po.status)+'</td><td>'+actions+'</td></tr>'
    });
    return heading('Purchase Order','Kelola PO cabang, pengeluaran stok gudang, dan surat jalan B2B.', '<button class="btn btn-light" data-action="export">Ekspor Excel</button><button class="btn btn-primary" data-action="add-purchase-order">Buat Purchase Order</button>')+demoBanner()+'<div class="section-grid"><article class="card mini-card"><small>Purchase Order</small><strong>'+data.shipments.length+'</strong><span>Seluruh PO tersimpan</span></article><article class="card mini-card"><small>Menunggu tindakan</small><strong>'+data.shipments.filter(x=>['Draft','Menunggu verifikasi','Disetujui','Partial','Tidak disetujui','Ditangguhkan'].includes(x.status)).length+'</strong><span>Persetujuan, penangguhan, atau sisa kirim</span></article><article class="card mini-card"><small>Unit keluar gudang</small><strong>'+dispatchedTotal.toLocaleString('id-ID')+'</strong><span>Jumlah aktual pada surat jalan</span></article></div><article class="card table-card">'+toolbar('<select class="filter-select" id="statusFilter"><option>Semua status</option><option>Draft</option><option>Menunggu verifikasi</option><option>Disetujui</option><option>Dikirim</option><option>Partial</option><option>Received</option><option>Rejected</option></select>')+table(['Nomor PO / penanggung jawab','Customer / tanggal PO','Ship to address','Rincian Purchase Order','Status','Tindakan'],rows,'Belum ada Purchase Order. Buat PO untuk memulai proses gudang.','po-list-table')+'</article>'
  }
        function sales(){
    const isApproved=s=>!s.status||s.status==='Disetujui'||s.status==='Selesai terjual';
    const total=data.sales.filter(isApproved).reduce((a,x)=>a+Number(x.net||0),0);
    const totalUnits=data.sales.filter(isApproved).reduce((a,x)=>a+Number(x.qty||0),0);
    const pendingCount=data.sales.filter(x=>x.status==='Menunggu persetujuan').length;

    // Riwayat Penjualan (Surat Jalan Selesai Terjual dari Gudang)
    const orders=Array.isArray(data.shipments)?data.shipments:[];
    const dispatchesOf=po=>Array.isArray(po?.dispatches)?po.dispatches:[];
    const isSoldPo=po=>['Selesai terjual','Done','Terjual'].includes(po?.status);
    const allDispatches=orders.flatMap(po=>dispatchesOf(po).map((dispatch,index)=>({po,dispatch,index}))).sort((a,b)=>(b.dispatch.date||'').localeCompare(a.dispatch.date||''));
    const soldDispatches=allDispatches.filter(x=>isSoldPo(x.po));

    const waybillRows=soldDispatches.map(({po,dispatch,index})=>{
      const qty=(Array.isArray(dispatch.items)?dispatch.items:[]).reduce((n,item)=>n+Number(item.qty||0),0);
      const actionButtons='<div class="po-actions warehouse-dispatch-actions">'+
        '<button type="button" class="btn btn-light btn-small waybill-print-action" data-action="print-waybill" data-dispatch-index="' + index + '" data-id="' + esc(po.id) + '">' + t('print_waybill', 'Cetak surat jalan') + '</button>'+
        '<button type="button" class="btn btn-light btn-small" data-action="update-po-dispatch-status" data-id="'+esc(po.id)+'">' + t('change_status', 'Ubah status') + '</button>'+
      '</div>';
      return '<tr>'+
        '<td><strong>'+esc(dispatch.number||'—')+'</strong><div class="panel-subtitle">PO '+esc(po.id)+' · '+date(dispatch.date)+'</div></td>'+
        '<td><strong>'+esc(po.customerName||storeName(po.store))+'</strong></td>'+
        '<td>' + qty.toLocaleString(currentLang === 'en' ? 'en-US' : (currentLang === 'zh' ? 'zh-CN' : 'id-ID')) + t('unit_suffix', ' unit') + '</td>'+
        '<td>'+statusPill(po.status)+'</td>'+
        '<td>'+actionButtons+'</td>'+
      '</tr>';
    });

    const periodKey=x=>`${x.store}|${x.start}|${x.end}`;
    const invoiceKeys=new Set(data.invoices.map(x=>x.periodKey).filter(Boolean));
    const skuRows=data.sales.map(x=>{
      const same=data.sales.filter(y=>periodKey(y)===periodKey(x));
      const approved=same.every(isApproved);
      const hasInvoice=invoiceKeys.has(periodKey(x));
      let action=x.status==='Menunggu persetujuan'?`<button class="link-btn" data-action="approve-sale" data-id="${esc(x.id)}">Setujui rekonsiliasi</button>`:approved&&!hasInvoice?`<button class="link-btn" data-action="create-period-invoice" data-id="${esc(x.id)}">Buat invoice periode</button>`:hasInvoice?`Invoice ${esc(data.invoices.find(i=>i.periodKey===periodKey(x))?.id||'dibuat')}`:(x.sourcePo?'<span class="pill green">Selesai</span>':'—');
      const unitDetails=(x.openingSnapshot!=null&&x.incomingSnapshot!=null)?`${Number(x.openingSnapshot||0)} + ${Number(x.incomingSnapshot||0)} − ${Number(x.physicalSnapshot||0)} − ${Number(x.returnSnapshot||0)} = <strong>${Number(x.qty||0)}</strong> unit`:`<strong>${Number(x.qty||0)}</strong> unit terjual${x.sourcePo?`<div class="panel-subtitle">PO ${esc(x.sourcePo)}${x.sourceDispatch?' · '+esc(x.sourceDispatch):''}</div>`:''}`;
      return `<tr><td><span class="sku">${esc(x.id)}</span></td><td><strong>${esc(storeName(x.store))}</strong></td><td>${date(x.start)}${x.end&&x.end!==x.start?' – '+date(x.end):''}</td><td>${esc(prodName(x.sku))}<div class="panel-subtitle">${esc(x.sku)}</div></td><td>${unitDetails}</td><td>${money(x.gross)}</td><td>${money(x.discount)}</td><td><strong>${money(x.net)}</strong></td><td>${statusPill(x.status||'Disetujui')}</td><td>${action}</td></tr>`;
    });

    return heading('Riwayat','Riwayat surat jalan selesai terjual dari gudang serta rekonsiliasi fisik per cabang dan SKU.','<button class="btn btn-light" data-action="export">Ekspor Excel</button><button class="btn btn-primary" data-action="add-sale">Catat rekonsiliasi</button>')+
      demoBanner()+
      '<div class="section-grid warehouse-kpis">'+
        '<article class="card mini-card"><small>' + t('history_kpi_net', 'Omset bersih tercatat') + '</small><strong>' + money(total) + '</strong><span>' + t('history_sub_recon', 'Rekonsiliasi tersimpan') + '</span></article>' +
        '<article class="card mini-card"><small>' + t('history_kpi_units', 'Unit terjual') + '</small><strong>' + totalUnits.toLocaleString(currentLang === 'en' ? 'en-US' : (currentLang === 'zh' ? 'zh-CN' : 'id-ID')) + '</strong><span>' + t('history_sub_approved', 'Hanya laporan disetujui') + '</span></article>' +
        '<article class="card mini-card"><small>' + t('history_kpi_waybills', 'Surat jalan selesai') + '</small><strong>' + soldDispatches.length + t('sj_suffix', ' SJ') + '</strong><span>' + t('history_sub_confirmed', 'Barang keluar terkonfirmasi') + '</span></article>' +
        '<article class="card mini-card"><small>' + t('history_kpi_pending', 'Menunggu persetujuan') + '</small><strong>' + pendingCount + '</strong><span>' + t('history_sub_review', 'Perlu ditinjau sebelum tutup periode') + '</span></article>'+
      '</div>'+
      '<article class="card table-card">'+
        '<div class="table-toolbar"><div><div class="panel-title">' + t('warehouse_history_heading', 'Riwayat surat jalan') + '</div><div class="panel-subtitle">' + t('history_waybills_sub', 'Pengeluaran terbaru yang sudah selesai terjual dari Gudang.') + '</div></div></div>'+
        table(['Nomor surat jalan','Customer','Quantity keluar','Status PO','Tindakan & Dokumen'],waybillRows,'Belum ada surat jalan yang selesai terjual.','warehouse-dispatches-table')+
      '</article>'+
      '<div class="excel-source-note">' + t('history_banner', 'Barang terjual = stok awal periode + stok masuk − stok fisik akhir − retur terkonfirmasi. Harga retail dan bagi hasil disimpan sebagai snapshot pada saat laporan dibuat.') + '</div>'+
      '<article class="card table-card">'+
        toolbar()+
        table(['Nomor rekonsiliasi','Cabang','Periode','SKU & produk','Rincian hitung unit','Penjualan kotor','Diskon retail','Penjualan bersih','Status','Tindakan'],skuRows)+
      '</article>';
  }
  function invoices(){let due=data.invoices.reduce((a,x)=>a+Math.max(0,x.netSales*(1-x.margin/100)-x.paid),0);let rows=data.invoices.map(x=>{let payout=Math.round(x.netSales*(1-x.margin/100));let status=invoiceStatus(x);return `<tr><td><span class="sku">${esc(x.id)}</span></td><td><strong>${esc(storeName(x.store))}</strong>${x.start?`<div class="panel-subtitle">${date(x.start)} – ${date(x.end)}</div>`:''}</td><td>${date(x.date)}</td><td>${date(x.due)}</td><td>${money(x.netSales)}</td><td>${money(Math.round(x.netSales*x.margin/100))}<div class="panel-subtitle">${x.margin}%</div></td><td class="invoice-total">${money(payout)}</td><td>${statusPill(status)}</td><td>${x.paid?money(x.paid):'—'}</td><td>${x.status!=='Paid'?`<button class="link-btn" data-action="record-payment" data-id="${esc(x.id)}">Catat pembayaran</button>`:esc(x.proof||'Lunas')}</td></tr>`});return `${heading('Tagihan & Pembayaran','Tagihan terbentuk dari rekonsiliasi penjualan yang sudah disetujui.',`<button class="btn btn-light" data-action="export">Ekspor</button>`)}${demoBanner()}<div class="section-grid"><article class="card mini-card"><small>Sisa tagihan ke Howell</small><strong>${money(due)}</strong><span>Sisa tagihan yang belum lunas</span></article><article class="card mini-card"><small>Invoice belum lunas</small><strong>${data.invoices.filter(x=>x.status!=='Paid').length}</strong><span>Termasuk pembayaran sebagian</span></article><article class="card mini-card"><small>Invoice lunas</small><strong>${data.invoices.filter(x=>x.status==='Paid').length}</strong><span>Sudah direkonsiliasi</span></article></div><article class="card table-card">${toolbar(`<select class="filter-select" id="statusFilter"><option>Semua status</option><option>Unpaid</option><option>Overdue</option><option>Partial</option><option>Paid</option></select>`)}${table(['Nomor tagihan','Cabang retail','Tanggal tagihan','Jatuh tempo','Penjualan bersih','Komisi retail','Pembayaran bersih ke Howell','Status','Pembayaran masuk','Validasi / tindakan'],rows)}</article>`}
  function returns(){const rows=data.returns.map(x=>`<tr><td><span class="sku">${esc(x.id)}</span></td><td>${date(x.date)}</td><td><strong>${esc(storeName(x.store))}</strong></td><td>${esc(prodName(x.sku))}<div class="panel-subtitle">${esc(x.sku)}</div></td><td>${Number(x.receivedQty||0)} / ${x.qty} unit</td><td>${pill(({'Slow Moving':'Pergerakan lambat','Damaged':'Barang rusak','Expired':'Kedaluwarsa','Store Closing':'Toko tutup'}[x.reason]||x.reason),({'Damaged':'red','Expired':'amber','Slow Moving':'blue','Store Closing':'gray'}[x.reason]||'gray'))}</td><td>${statusPill(({'Re-sellable':'Layak jual','Repairable':'Perlu perbaikan','Scrap/Musnah':'Rusak / dimusnahkan'}[x.condition]||x.condition))}</td><td>${statusPill(x.status)}</td><td>—</td></tr>`);const actions=portalRole==='warehouse'?'':'<button class="btn btn-light" data-action="export">Ekspor</button><button class="btn btn-primary" data-action="add-return">Catat retur</button>';const description=portalRole==='warehouse'?'Periksa retur yang dikirim cabang dan catat penerimaan barang di gudang.':'Retur mengurangi stok cabang setelah dikirim; stok pusat bertambah setelah barang diperiksa di gudang.';return `${heading('Retur & Penarikan',description,actions)}<article class="card table-card">${toolbar()}${table(['Nomor RMA','Tanggal','Cabang','SKU & produk','Diterima / diminta','Alasan retur','Kondisi rencana','Status','Tindakan'],rows)}</article>`}
  function settings(){return `${heading('Pengaturan','Kelola data Howell Inventory dan status sinkronisasi server.','')}<article class="card panel" role="note" style="max-width:720px;margin-bottom:14px;border-left:4px solid #F4C63D!important"><div class="panel-title">Status kesiapan VPS</div><p class="panel-subtitle" style="line-height:1.8">${syncReady&&!syncBlocked?"API database bersama berhasil tersambung. Perubahan baru akan tersimpan di server setelah sinkronisasi selesai.":"API database belum tersambung. Perubahan hanya tersimpan lokal; jangan masukkan transaksi operasional sebelum status VPS aktif."}</p></article><article class="card panel" style="max-width:720px"><div class="panel-title">Data aplikasi</div><p class="panel-subtitle" style="line-height:1.8">${syncReady&&!syncBlocked?"Data utama dimuat dan disimpan di database VPS. Server memakai revisi data untuk menolak perubahan yang dibuat dari salinan lama.":"Aplikasi tetap menampilkan data lokal sampai API VPS tersambung. Jangan menganggap data tersinkron sebelum status server aktif."}</p><div class="activity" style="margin-top:12px"><div class="activity-main"><strong>Status data</strong><small>${syncReady&&!syncBlocked?"Database bersama aktif":"Database bersama belum tersambung"}. ${data.products.length} SKU · ${data.stores.length} cabang · ${data.shipments.length} PO.</small></div></div><div style="display:flex;gap:9px;margin-top:14px"><button class="btn btn-light" data-action="export">Cadangkan data JSON</button><label class="btn btn-light" for="backupImportInput">Pulihkan cadangan JSON</label><input id="backupImportInput" type="file" accept="application/json,.json" hidden>${localStorage.getItem(`${KEY}-recovery-latest`)?'<button class="btn btn-light" data-action="download-recovery">Unduh cadangan konflik lokal</button>':''}<button class="btn btn-danger" data-action="reset-demo">Pulihkan data sumber</button></div></article><article class="card panel" style="max-width:720px;margin-top:14px"><div class="panel-title">Skema stok cabang</div><p class="panel-subtitle" style="line-height:1.8">Saldo stok akhir dihitung per cabang dan SKU: stok awal + penerimaan barang − penjualan − retur/cacat. Opname membandingkan stok sistem dengan jumlah fisik untuk menampilkan selisih stok.</p></article>`}
  function reports(){
    const categories=[...new Set(data.products.map(x=>x.category||'Lainnya'))].map(category=>{const rows=data.products.filter(x=>(x.category||'Lainnya')===category),known=rows.filter(hasStock),quantity=known.reduce((n,x)=>n+Number(x.stock),0),display=known.length===rows.length?quantity.toLocaleString('id-ID')+' unit':known.length?quantity.toLocaleString('id-ID')+' unit · '+(rows.length-known.length)+' SKU belum diopname':'Belum diopname';return '<tr><td><strong>'+esc(category)+'</strong></td><td>'+rows.length+'</td><td>'+display+'</td></tr>';});
    const branchRows=data.branchStock.map(x=>{const system=branchBalance(x),delta=x.lastShrinkage??(x.physical==null?null:Number(x.physical)-system);return '<tr><td>'+esc(storeName(x.store))+'</td><td>'+esc(x.sku)+'</td><td>'+system+'</td><td>'+(x.physical==null?'—':x.physical)+'</td><td>'+(delta==null?'—':(delta>0?'+':'')+delta)+'</td></tr>';});
    const salesRows=[...new Set(data.sales.map(x=>x.store))].map(store=>{const rows=data.sales.filter(x=>x.store===store&&(!x.status||x.status==='Disetujui'));return '<tr><td>'+esc(storeName(store))+'</td><td>'+rows.reduce((n,x)=>n+Number(x.qty||0),0)+'</td><td>'+money(rows.reduce((n,x)=>n+Number(x.net||0),0))+'</td></tr>';});
    const statuses=['Draft','Menunggu verifikasi','Disetujui','Dikirim','Received','Partial','Rejected'].map(status=>'<tr><td>'+statusPill(status)+'</td><td>'+data.shipments.filter(x=>x.status===status).length+'</td></tr>');
    const invoicesList=['Unpaid','Overdue','Partial','Paid'].map(status=>{const rows=data.invoices.filter(x=>invoiceStatus(x)===status);return '<tr><td>'+statusPill(status)+'</td><td>'+rows.length+'</td><td>'+money(rows.reduce((n,x)=>n+Math.max(0,invoicePayout(x)-Number(x.paid||0)),0))+'</td></tr>';});
    const panel=(title,headers,rows)=>'<article class="card table-card"><div class="table-toolbar"><div class="panel-title">'+title+'</div></div>'+table(headers,rows)+'</article>';
    return heading('Laporan','Ringkasan inventori, cabang, distribusi, penjualan, dan rekonsiliasi dari data tersimpan.','<button class="btn btn-light" data-action="export">Ekspor</button>')+demoBanner()+'<div class="section-grid">'+panel('Produk per kategori',['Kategori','SKU','Stok pusat'],categories)+panel('Status distribusi',['Status DO','Jumlah'],statuses)+panel('Stok konsinyasi cabang',['Cabang','SKU','Stok sistem','Fisik','Selisih'],branchRows)+panel('Penjualan per cabang',['Cabang','Unit terjual','Penjualan bersih'],salesRows)+panel('Status rekonsiliasi',['Status invoice','Jumlah','Sisa payout'],invoicesList)+'</div>';
  }
  // Apply catalog corrections at the final render boundary as well as during
  // initialisation. The shared API can replace the in-memory catalog after
  // startup, so a startup-only correction would reintroduce legacy labels.
  function normalizeCatalogNames(){
    if(!Array.isArray(data.products))return;
    for(const product of data.products){
      if(product?.sku==='HW05')product.name=String(product.name||'').replace(/\s+WHITE$/i,'').trim();
    }
  }
  function normalizeRuntimeData(){
    if(!data || typeof data!=='object')data={};
    const arrayKeys=['products','stores','shipments','sales','invoices','returns','branchStock','counts','countHistory','audit'];
    arrayKeys.forEach(key=>{if(!Array.isArray(data[key]))data[key]=[]});
    data.shipments=data.shipments.filter(Boolean).map(po=>({...po,items:Array.isArray(po.items)?po.items:[],dispatches:Array.isArray(po.dispatches)?po.dispatches:[]}));
  }
  function render(){
    updateDomLanguage();
    normalizeRuntimeData();
    normalizeCatalogNames();
    let map={dashboard,inventory,warehouse,'sales-history':salesHistory,products,stores,shipments,sales,invoices,returns,reports,settings};
    try{$('#pageContent').innerHTML=map[current]()}catch(error){console.error(`Halaman ${pageNames[current]||current} gagal dimuat:`,error);$('#pageContent').innerHTML=`<section class="card page-error" role="alert"><strong>Halaman ${esc(pageNames[current]||current)} belum dapat dimuat.</strong><p>Terjadi kesalahan saat menyiapkan data halaman. Muat ulang aplikasi atau buka halaman lain, lalu coba kembali.</p><button class="btn btn-light btn-small" data-action="reload-page">Coba lagi</button></section>`}
    if(current==='inventory'&&portalRole!=='warehouse'){
      let rows=data.branchStock.map(x=>{let system=branchBalance(x),delta=x.physical==null?null:(x.lastShrinkage??(x.physical-system));return `<tr><td><strong>${esc(storeName(x.store))}</strong><div class="panel-subtitle">${esc(x.store)}</div></td><td>${esc(prodName(x.sku))}<div class="panel-subtitle">${esc(x.sku)}</div></td><td>${x.opening}</td><td>${x.incoming}</td><td>${x.sold}</td><td>${x.returns}</td><td><strong>${system}</strong></td><td>${x.physical==null?'—':x.physical}</td><td>${delta==null?'—':`${delta>0?'+':''}${delta}`}</td><td><button class="link-btn" data-action="count-branch" data-id="${esc(x.store+'|'+x.sku)}">Opname</button></td></tr>`});
      let section=document.createElement('article');section.className='card table-card';section.style.marginTop='15px';section.innerHTML=`<div class="table-toolbar"><div><div class="panel-title">Stok konsinyasi per cabang</div><div class="panel-subtitle">Stok akhir sistem = saldo awal + masuk − terjual − retur/cacat</div></div></div>${table(['Cabang retail','Produk & SKU','Saldo awal','Masuk','Terjual','Retur / cacat','Stok akhir sistem','Fisik','Shrinkage','Tindakan'],rows)}`;$('#pageContent').append(section);
    }
    $('#crumbCurrent').textContent=pageNames[current];
    $$('.nav-item').forEach(x=>{
      x.classList.toggle('active', x.dataset.page === current);
    });
    const lowStockBadge=$('#lowStockBadge');if(lowStockBadge){const count=data.products.filter(p=>hasStock(p)&&p.stock<10).length;lowStockBadge.textContent=count;lowStockBadge.hidden=count===0}const invoiceBadge=$('#invoiceBadge');if(invoiceBadge){const count=data.invoices.filter(i=>i.status!=='Paid').length;invoiceBadge.textContent=count;invoiceBadge.hidden=count===0}bindDynamic();
  }
  function runGlobalSearch(){const input=$('#globalSearch'),raw=input.value.trim();if(!raw)return toast('Masukkan kata kunci pencarian.');const term=raw.toLocaleLowerCase('id-ID'),tokens=term.split(/\s+/).filter(Boolean),matches=values=>tokens.every(token=>String(values??'').toLocaleLowerCase('id-ID').includes(token)),excelCatalogMatch=(window.HOWELL_MASTER_DRAFT?.sheets||[]).some(sheet=>(sheet.records||[]).some(record=>{const columns=(sheet.columns||Object.keys(record.cells||{})).filter(col=>String(col).toUpperCase()!=='F'||String(sheet.headers?.[col]??'').trim());return matches(columns.map(col=>record.cells?.[col]?.value).join(' '))})),priceListMatch=(window.HOWELL_SOURCE_DATA?.priceList?.rows||[]).some(row=>matches((row.values||[]).join(' '))),product=data.products.find(item=>matches([item.name,item.sku,item.barcode,item.category,item.spec].join(' '))),store=data.stores.find(item=>matches([item.name,item.code,item.network,item.region].join(' '))),shipment=data.shipments.find(item=>matches([item.id,item.status,storeName(item.store),item.shipTo].join(' '))),sale=data.sales.find(item=>matches([item.id,item.status,storeName(item.store),prodName(item.sku)].join(' '))),invoice=data.invoices.find(item=>matches([item.id,item.status,storeName(item.store)].join(' '))),ret=data.returns.find(item=>matches([item.id,item.status,storeName(item.store),prodName(item.sku)].join(' ')));if(!(product||excelCatalogMatch||priceListMatch||store||shipment||sale||invoice||ret)){toast('Tidak ada data yang cocok dengan kata kunci tersebut.');return}const target=product||excelCatalogMatch||priceListMatch?'products':store?'stores':shipment?'shipments':sale?'sales':invoice?'invoices':'returns';go(target);query=term;setTimeout(()=>{const tableInput=$('#tableSearch');if(tableInput){tableInput.value=term;tableInput.dispatchEvent(new Event('input'));tableInput.focus()}const catalogInput=$('#excelSearch');if(catalogInput){catalogInput.value=term;catalogInput.dispatchEvent(new Event('input'))}const priceInput=$('#priceListSearch');if(priceInput){priceInput.value=term;priceInput.dispatchEvent(new Event('input'))}},0)}
  function bindDynamic(){
    const search=$('#tableSearch'),category=$('#categoryFilter'),status=$('#statusFilter');
    const applyTableFilters=()=>{
      const tokens=String(search?.value||'').trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
      const categoryValue=category?.value||'Semua kategori',statusValue=status?.value||'Semua status';
      $$('tbody tr').forEach(row=>{
        const text=row.textContent.toLocaleLowerCase('id-ID');
        const matchesText=tokens.every(token=>text.includes(token));
        const matchesCategory=categoryValue==='Semua kategori'||row.textContent.includes(categoryValue);
        const matchesStatus=statusValue==='Semua status'||row.textContent.includes(statusValue);
        row.style.display=matchesText&&matchesCategory&&matchesStatus?'':'none';
      });
      $$('.inventory-category').forEach(section=>{const visible=[...section.querySelectorAll('tbody tr')].some(row=>row.style.display!=='none');section.hidden=!visible;if(visible&&(tokens.length>0||categoryValue!=='Semua kategori'))section.open=true});
      query=tokens.join(' ');
    };
    search?.addEventListener('input',applyTableFilters);
    category?.addEventListener('change',applyTableFilters);
    status?.addEventListener('change',applyTableFilters);
    $('#inventoryExpandAll')?.addEventListener('click',()=>$$('.inventory-category').filter(section=>!section.hidden).forEach(section=>{section.open=true}));
    $('#inventoryCollapseAll')?.addEventListener('click',()=>$$('.inventory-category').forEach(section=>{section.open=false}));
    const matchesTokens=(text,term)=>term.split(/\s+/).filter(Boolean).every(token=>text.includes(token));
    const excelSearch=$('#excelSearch');
    excelSearch?.addEventListener('input',()=>{
      const term=excelSearch.value.trim().toLocaleLowerCase('id-ID');
      $$('.excel-sheet').forEach(sheet=>{
        const rows=[...sheet.querySelectorAll('.excel-record')];let matches=0;
        rows.forEach(row=>{const show=!term||matchesTokens((row.textContent+' '+[...row.querySelectorAll('[data-search-value]')].map(cell=>cell.dataset.searchValue).join(' ')).toLocaleLowerCase('id-ID'),term);row.style.display=show?'':'none';if(show)matches++});
        sheet.hidden=Boolean(term)&&matches===0;if(term&&matches)sheet.open=true;
      });
    });
    const priceSearch=$('#priceListSearch');
    priceSearch?.addEventListener('input',()=>{
      const term=priceSearch.value.trim().toLocaleLowerCase('id-ID'),sheet=$('[data-price-list]');if(!sheet)return;
      let matches=0;sheet.querySelectorAll('.excel-record').forEach(row=>{const show=!term||matchesTokens(row.textContent.toLocaleLowerCase('id-ID'),term);row.style.display=show?'':'none';if(show)matches++});
      if(term&&matches)sheet.open=true;
    });
  }
  const select=(name,items,required=true)=>({name,type:'select',items,required});
  const text=(name,label,opts={})=>({name,label,type:opts.type||'text',placeholder:opts.placeholder||'',required:opts.required!==false,full:!!opts.full,options:opts.options||[],hint:opts.hint||''});
  const number=(name,label,opts={})=>({name,label,type:'number',placeholder:opts.placeholder||'0',required:opts.required!==false,full:!!opts.full,min:opts.min??0,step:opts.step||'1',hint:opts.hint||''});
  const datefield=(name,label)=>text(name,label,{type:'date'});
  function enhanceProductSelects(root){if(!root?.querySelectorAll)return;root.querySelectorAll('select[name]').forEach(select=>{if(!/^sku\d*$/i.test(select.name)||select.dataset.searchEnhanced)return;select.dataset.searchEnhanced='true';const required=select.required;select.required=false;select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.classList.add('searchable-product-value');const field=select.closest('.field'),label=field?.querySelector('label'),wrap=document.createElement('div');wrap.className='searchable-product-select';const input=document.createElement('input');input.type='search';input.className='searchable-product-input';input.placeholder='Cari nama produk atau SKU…';input.autocomplete='off';input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-label',label?.textContent?.replace('*','').trim()+' — cari nama produk atau SKU');input.required=required;const list=document.createElement('div');list.className='searchable-product-options';list.setAttribute('role','listbox');list.style.display='none';if(select.value){const chosen=select.selectedOptions[0];input.value=chosen?.textContent.trim()||''}const control=document.createElement('div');control.className='searchable-product-control';const searchButton=document.createElement('button');searchButton.type='button';searchButton.className='searchable-product-button';searchButton.textContent='Cari';searchButton.setAttribute('aria-label','Cari produk berdasarkan nama atau SKU');control.append(input,searchButton);select.parentNode.insertBefore(wrap,select);wrap.append(control,select,list);if(label)label.htmlFor=input.id='search-'+select.name+'-'+Math.random().toString(36).slice(2,7);const close=()=>{list.style.display='none';input.setAttribute('aria-expanded','false');if(list.dataset.portaled){wrap.append(list);list.removeAttribute('data-portaled')}};const open=()=>{list._searchOwner=input;const query=input.value.trim().toLocaleLowerCase('id-ID'),tokens=query.split(/\s+/).filter(Boolean),options=[...select.options].filter(option=>option.value&&tokens.every(token=>option.textContent.toLocaleLowerCase('id-ID').includes(token)));list.replaceChildren();if(options.length){options.forEach(option=>{const button=document.createElement('button');button.type='button';button.className='searchable-product-option';button.setAttribute('role','option');button.dataset.value=option.value;button.textContent=option.textContent.trim();list.append(button)})}else{const empty=document.createElement('span');empty.className='searchable-product-empty';empty.textContent='Produk tidak ditemukan.';list.append(empty)}if(list.parentElement!==document.body){document.body.append(list);list.dataset.portaled='true'}const rect=input.getBoundingClientRect(),width=Math.min(Math.max(rect.width,300),window.innerWidth-24),maxHeight=Math.min(280,window.innerHeight-24),top=window.innerHeight-rect.bottom<maxHeight&&rect.top>maxHeight?Math.max(12,rect.top-maxHeight-6):Math.min(window.innerHeight-maxHeight-12,rect.bottom+6);list.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+'px';list.style.top=top+'px';list.style.width=width+'px';list.style.maxHeight=maxHeight+'px';list.style.display='block';input.setAttribute('aria-expanded','true')};searchButton.addEventListener('mousedown',event=>event.preventDefault());searchButton.addEventListener('click',open);input.addEventListener('focus',()=>{input.select();open()});input.addEventListener('input',()=>{select.value='';open()});input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}else if(event.key==='Enter'&&list.style.display!=='none'){const option=list.querySelector('[data-value]');if(option){event.preventDefault();select.value=option.dataset.value;input.value=option.textContent;select.dispatchEvent(new Event('change',{bubbles:true}));close()}}});list.addEventListener('mousedown',event=>{if(event.target.closest('[data-value]'))event.preventDefault()});list.addEventListener('click',event=>{const option=event.target.closest('[data-value]');if(!option)return;select.value=option.dataset.value;input.value=option.textContent;select.dispatchEvent(new Event('change',{bubbles:true}));close()});input.addEventListener('blur',()=>setTimeout(()=>{if(!wrap.contains(document.activeElement))close()},140))})}
  function openModal(title,fields,submit,initialValues={}){$('#modalSubmit').style.display='';modalMode={submit,initialValues};$('#modalTitle').textContent=title;$('#modalFields').innerHTML=`<div class="field-grid">${fields.map(f=>`<div class="field ${f.full?'full':''}"><label for="f-${f.name}">${esc(f.label||f.name)}${f.required?' *':''}</label>${f.type==='select'?`<select id="f-${f.name}" name="${f.name}" ${f.required?'required':''}><option value="">Pilih...</option>${f.items.map(i=>`<option value="${esc(i.value)}">${esc(i.label)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea id="f-${f.name}" name="${f.name}" placeholder="${esc(f.placeholder)}" ${f.required?'required':''}></textarea>`:`<input id="f-${f.name}" name="${f.name}" type="${f.type}" placeholder="${esc(f.placeholder)}" ${f.required?'required':''} ${f.type==='number'?`min="${f.min}" step="${f.step}"`:''}/>`}${f.hint?`<div class="hint">${esc(f.hint)}</div>`:''}</div>`).join('')}</div>`;Object.entries(initialValues).forEach(([k,v])=>{let el=$(`#f-${k}`);if(el)el.value=v});enhanceProductSelects($('#modalFields'));$('#modalBackdrop').classList.add('open');setTimeout(()=>$('#modalFields input,#modalFields select')?.focus(),40)}
  function closeModal(){document.querySelectorAll('.po-product-options[data-portaled],.searchable-product-options[data-portaled]').forEach(list=>list.remove());$('#modalBackdrop').classList.remove('open','po-editor-backdrop','dispatch-editor-backdrop','po-create-workspace');$('#modalClose').textContent='Tutup';$('#modalClose').setAttribute('aria-label','Tutup');modalMode=null;clearEditorRoute()}
  function closeSearchDropdowns(target=null){document.querySelectorAll('.po-product-options[data-portaled],.searchable-product-options[data-portaled]').forEach(list=>{const owner=list._searchOwner,wrapper=owner?.closest('.po-product-picker,.searchable-product-select');if(target&&((owner&&(owner===target||owner.contains(target)))||list.contains(target)))return;list.style.display='none';owner?.setAttribute('aria-expanded','false');if(wrapper&&list.parentElement===document.body){wrapper.append(list);list.removeAttribute('data-portaled')}})}
  document.addEventListener('pointerdown',event=>closeSearchDropdowns(event.target),true);
  if(typeof window.addEventListener==='function'){window.addEventListener('resize',()=>closeSearchDropdowns());window.addEventListener('scroll',()=>closeSearchDropdowns(),{passive:true});}
  const jakartaDate=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta'}).format(d);
  const today=jakartaDate(new Date()),plus=(d)=>jakartaDate(new Date(Date.now()+d*86400000));
  function doAction(action,id,control=null){if(syncEnabled&&(!syncReady||syncBlocked)&&!['export','export-branches','open-paperclip-branches','close-paperclip-popup','show-category','print-waybill','reload-page','retry-db-sync'].includes(action))return toast(syncBlocked?'Sinkronisasi terkunci karena konflik data. Muat ulang dan tinjau data server sebelum melanjutkan.':'Database VPS belum siap. Perubahan dinonaktifkan agar tidak hanya tersimpan di browser.');let p=data.products.find(x=>x.sku===id),s=data.stores.find(x=>x.code===id),inv=data.invoices.find(x=>x.id===id);
    if(action==='open-paperclip-branches'){openPaperclipBranches();return}if(action==='close-paperclip-popup'){closePaperclipPopup();return}if(action==='export-branches'){exportBranches();return}if(action==='show-category'){go('products');let filter=$('#categoryFilter');if(filter){filter.value=id;filter.dispatchEvent(new Event('change'))}return}
    if(action==='approve-sale'){const sale=data.sales.find(x=>x.id===id);if(!sale||sale.status!=='Menunggu persetujuan')return toast('Rekonsiliasi tidak tersedia untuk disetujui.');const branch=data.branchStock.find(x=>x.store===sale.store&&x.sku===sale.sku),available=branch?branchBalance(branch):0;if(Number(sale.qty)>available)return toast('Stok sistem tidak mencukupi; tinjau stok cabang sebelum menyetujui.');if(!confirm(`Setujui ${sale.id}? ${sale.qty} unit akan dikunci sebagai penjualan periode ini.`))return;sale.status='Disetujui';sale.approvedAt=new Date().toISOString();if(branch)branch.sold+=Number(sale.qty);recordAudit('approve','sales-reconciliation',sale.id,{qty:sale.qty,opening:sale.openingSnapshot,incoming:sale.incomingSnapshot,physical:sale.physicalSnapshot,returns:sale.returnSnapshot,net:sale.net});data.demo=false;save();render();toast('Rekonsiliasi disetujui; stok cabang diperbarui.');return;}
    if(action==='create-period-invoice'){const sale=data.sales.find(x=>x.id===id);if(!sale||sale.status!=='Disetujui')return toast('Setujui rekonsiliasi sebelum membuat invoice.');const key=`${sale.store}|${sale.start}|${sale.end}`,periodSales=data.sales.filter(x=>`${x.store}|${x.start}|${x.end}`===key);if(periodSales.some(x=>x.status!=='Disetujui'))return toast('Setujui seluruh baris rekonsiliasi cabang pada periode ini terlebih dahulu.');if(data.invoices.some(x=>x.periodKey===key))return toast('Invoice untuk periode ini sudah dibuat.');const idDefault=`INV-${sale.store}-${sale.end.replaceAll('-','')}`;openModal('Buat invoice periode',[text('id','Nomor invoice'),datefield('date','Tanggal terbit'),datefield('due','Jatuh tempo'),text('note','Catatan invoice',{required:false,full:true})],v=>{if(!String(v.id||'').trim()||data.invoices.some(x=>x.id.toLowerCase()===String(v.id).trim().toLowerCase()))return toast('Nomor invoice wajib diisi dan harus unik.');if(v.due<v.date)return toast('Jatuh tempo tidak boleh sebelum tanggal terbit.');const netSales=periodSales.reduce((n,x)=>n+Number(x.net||0),0),margin=Number(periodSales[0].storeShareSnapshot??data.stores.find(x=>x.code===sale.store)?.storeShare??35),row={id:v.id.trim(),store:sale.store,date:v.date,due:v.due,periodKey:key,start:sale.start,end:sale.end,sourceSales:periodSales.map(x=>x.id),netSales,margin,paid:0,status:'Unpaid',paidDate:'',proof:'',note:v.note||''};data.invoices.unshift(row);periodSales.forEach(x=>x.invoiceId=row.id);recordAudit('create','invoice',row.id,{period:key,sales:row.sourceSales,netSales,howellPayout:invoicePayout(row),shareSnapshot:100-margin});data.demo=false;save();closeModal();go('invoices');toast('Invoice periode dibuat dari rekonsiliasi yang disetujui.')},{id:idDefault,date:today,due:''});return;}
    if(action==='confirm-return-dispatch'){const row=data.returns.find(x=>x.id===id);if(!row||row.status!=='Menunggu konfirmasi cabang')return toast('Retur ini tidak menunggu konfirmasi cabang.');const branch=data.branchStock.find(x=>x.store===row.store&&x.sku===row.sku),available=branch?branchBalance(branch):0;openModal('Konfirmasi retur dikirim',[text('reference','Referensi surat jalan retur'),datefield('dispatchDate','Tanggal dikirim'),text('note','Catatan',{required:false,full:true})],v=>{if(!v.reference.trim())return toast('Referensi pengiriman retur wajib diisi.');if(!branch||Number(row.qty)>available)return toast('Stok cabang tidak cukup untuk mengonfirmasi retur ini.');branch.returns+=Number(row.qty);row.dispatchReference=v.reference.trim();row.dispatchDate=v.dispatchDate;row.status='Dalam perjalanan';recordAudit('dispatch','return',id,{qty:row.qty,reference:row.dispatchReference,date:row.dispatchDate});data.demo=false;save();closeModal();render();toast('Retur dikirim; stok cabang dikurangi.')},{dispatchDate:today});return;}
    if(action==='add-purchase-order'){openEditorRoute('purchase-order/new');openPurchaseOrderEditor();return}
     if(action==='edit-purchase-order-locked'){const po=data.shipments.find(x=>x.id===id);if(!po)return toast('Purchase Order tidak ditemukan.');const hasWaybill=(po.dispatches||[]).length>0||po.items.some(item=>dispatchedQty(po,item)>0);return toast(hasWaybill?'PO sudah memiliki Surat Jalan. Hapus PO untuk membatalkan dan memulihkan stok.':'Status PO ini tidak dapat diedit.')}
     if(action==='edit-purchase-order'){const po=data.shipments.find(x=>x.id===id);if(!po)return toast('Purchase Order tidak ditemukan.');openEditorRoute(`purchase-order/${encodeURIComponent(id)}`);openPurchaseOrderEditor(po);return}
     if(action==='continue-purchase-order'){const po=data.shipments.find(x=>x.id===id);if(!po||po.status!=='Draft')return toast('PO ini sudah tidak berstatus draft.');openEditorRoute(`purchase-order/${encodeURIComponent(id)}`);openPurchaseOrderEditor(po,{readyForDispatch:true,warehouseMode:true});return}
    if(action==='mark-po-sold'){
      const po=data.shipments.find(x=>x.id===id);
      if(!po)return toast('Purchase Order tidak ditemukan.');
      const prev=po.status;
      po.status='Selesai terjual';
      recordSalesFromPo(po);
      recordAudit('status-change','purchase-order',po.id,{previousStatus:prev,status:'Selesai terjual',autoSalesRecorded:true});
      data.demo=false;save();render();
      toast(`PO ${po.id} ditandai Selesai Terjual! Data tercatat otomatis di menu Riwayat.`);
      return;
    }
    if(action==='update-po-dispatch-status'){
      const po=data.shipments.find(x=>x.id===id);
      if(!po)return toast('Purchase Order tidak ditemukan.');
      openModal(`Ubah status pengiriman & penjualan · ${po.id}`, [
        {
          name: 'status',
          type: 'select',
          label: 'Status pesanan / pengiriman',
          required: true,
          items: [
            { value: 'Selesai terjual', label: 'Selesai terjual (Done) · Otomatis masuk ke Riwayat' },
            { value: 'Dalam proses', label: 'Dalam proses · Pengiriman / display toko' },
            { value: 'Pending', label: 'Pending · Menunggu konfirmasi toko' },
            { value: 'Dikirim', label: 'Dikirim · Barang keluar dari gudang' }
          ]
        },
        text('note', 'Catatan status (opsional)', { required: false, full: true })
      ], values => {
        const next=values.status;
        const prev=po.status;
        po.status=next;
        if(values.note)po.dispatchStatusNote=String(values.note).trim();
        if(['Selesai terjual','Done','Terjual'].includes(next)){
          recordSalesFromPo(po);
          toast(`PO ${po.id} ditandai Selesai Terjual! Data telah otomatis tampil di menu Riwayat.`);
        }else{
          removeSalesFromPo(po.id);
          toast(`Status PO ${po.id} diubah menjadi ${next}.`);
        }
        recordAudit('status-change','purchase-order',po.id,{previousStatus:prev,status:next,note:values.note});
        data.demo=false;save();closeModal();render();
      }, {
        status: ['Selesai terjual','Done','Terjual'].includes(po.status)?'Selesai terjual':(['Dalam proses','Pending'].includes(po.status)?po.status:'Dikirim'),
        note: po.dispatchStatusNote||''
      });
      return;
    }
    if(action==='update-warehouse-po-status'){if(current!=='warehouse')return toast('Status PO hanya dapat diperbarui dari halaman Gudang.');const po=data.shipments.find(x=>x.id===id);if(!po)return toast('Purchase Order tidak ditemukan.');if(!po.items.some(item=>orderedQty(item)>dispatchedQty(po,item)))return toast('Tidak ada sisa quantity pada PO ini.');openModal('Perbarui status Purchase Order',[{name:'warehouseStatus',type:'select',label:'Status PO',required:true,items:[{value:'Disetujui',label:'Disetujui · dapat dibuatkan surat jalan'},{value:'Dalam proses',label:'Dalam proses · pengiriman / display toko'},{value:'Pending',label:'Pending · menunggu konfirmasi'},{value:'Selesai terjual',label:'Selesai terjual (Done) · Masuk ke Penjualan'},{value:'Tidak disetujui',label:'Tidak disetujui'},{value:'Ditangguhkan',label:'Ditangguhkan'}]},{name:'warehouseNote',label:'Catatan keputusan',type:'textarea',placeholder:'Alasan atau catatan (opsional)',required:false,full:true}],values=>{const next=values.warehouseStatus;if(!['Disetujui','Dalam proses','Pending','Selesai terjual','Tidak disetujui','Ditangguhkan'].includes(next))return toast('Pilih status Purchase Order yang valid.');if(next==='Disetujui'&&!String(po.shipTo||'').trim())return toast('Lengkapi alamat pengiriman pada Purchase Order sebelum menyetujui.');if(next==='Tidak disetujui'&&po.dispatches?.length)return toast('PO yang sudah memiliki surat jalan tidak dapat ditolak.');const previous=po.status;po.status=next;po.warehouseReviewNote=String(values.warehouseNote||'').trim();po.warehouseReviewedAt=new Date().toISOString();if(next==='Disetujui')po.approvedAt=po.warehouseReviewedAt;if(next==='Selesai terjual'){recordSalesFromPo(po);}else if(previous==='Selesai terjual'){removeSalesFromPo(po.id);}recordAudit('warehouse-status','purchase-order',po.id,{previousStatus:previous,status:next,note:po.warehouseReviewNote});data.demo=false;save();closeModal();render();toast('Status PO diperbarui.');},{warehouseStatus:['Selesai terjual','Dalam proses','Pending','Tidak disetujui','Ditangguhkan'].includes(po.status)?po.status:'Disetujui',warehouseNote:po.warehouseReviewNote||''});return;}
     if(action==='print-waybill'){if(current!=='warehouse'&&current!=='sales'&&current!=='sales-history')return toast('Surat jalan hanya dapat dicetak dari halaman Gudang atau Penjualan.');const dispatchIndex=control?.dataset.dispatchIndex;openWaybillPrintOptions(id,dispatchIndex==null?null:Number(dispatchIndex));return}
     if(action==='delete-purchase-order'){
      if(portalRole!=='admin')return toast('Penghapusan Purchase Order hanya tersedia untuk admin.');
      const poIndex=data.shipments.findIndex(item=>item.id===id),po=data.shipments[poIndex];
      if(!po)return toast('Purchase Order tidak ditemukan.');
       const hasConfirmedReceipt=['Received','Diterima'].includes(po.status)||(po.items||[]).some(item=>Number(item.receivedQty||0)>0||(item.receipts||[]).some(receipt=>Number(receipt.qty||0)>0));
       if(hasConfirmedReceipt)return toast('PO tidak dapat dihapus karena penerimaan cabang sudah tercatat. Koreksi penerimaan dan stok cabang terlebih dahulu agar histori tetap sesuai.');
      const restorePlan=(po.items||[]).map(item=>({sku:item.sku,qty:dispatchedQty(po,item)})).filter(line=>line.qty>0);
      const unavailable=restorePlan.find(line=>{const product=data.products.find(item=>item.sku===line.sku);return !product||!hasStock(product)});
      if(unavailable)return toast('PO tidak dihapus: stok '+unavailable.sku+' belum tersedia untuk dipulihkan.');
      const totalDispatched=restorePlan.reduce((sum,line)=>sum+line.qty,0),dispatchNumbers=(po.dispatches||[]).map(entry=>entry.number).filter(Boolean);
      if(!confirm('Hapus PO '+po.id+' dan seluruh Surat Jalan terkait? '+totalDispatched+' unit yang pernah keluar akan dikembalikan ke stok gudang, dan PO ini hilang dari menu Gudang.'))return;
      restorePlan.forEach(line=>{const product=data.products.find(item=>item.sku===line.sku);product.stock=Number(product.stock)+line.qty;});
      data.shipments.splice(poIndex,1);
      recordAudit('delete','purchase-order',po.id,{status:po.status,dispatchNumbers:dispatchNumbers,restoredStock:restorePlan});
      data.demo=false;save();render();
      toast(totalDispatched?'PO dihapus; stok gudang dipulihkan '+totalDispatched+' unit.':'PO dihapus dari Purchase Order dan antrean Gudang.');
      return;
    }
    if(['submit-po','approve-po','dispatch-po'].includes(action)){
      const po=data.shipments.find(x=>x.id===id);if(!po)return toast('PO tidak ditemukan.');
      if(action==='submit-po'){if(po.status!=='Draft')return toast('PO ini sudah diajukan atau diproses.');if(!String(po.shipTo||'').trim())return toast('Lengkapi alamat pengiriman pada PO sebelum diajukan.');po.status='Menunggu verifikasi';recordAudit('submit','consignment-po',id,{status:po.status});}
      if(action==='approve-po'){if(po.status!=='Menunggu verifikasi')return toast('Hanya PO menunggu verifikasi yang dapat disetujui.');po.status='Disetujui';po.approvedAt=new Date().toISOString();recordAudit('approve','consignment-po',id,{status:po.status});}
      if(action==='dispatch-po'){if(current!=='warehouse')return toast('Surat jalan hanya dapat dibuat dari halaman Gudang.');if(!['Disetujui','Partial'].includes(po.status))return toast('PO harus disetujui sebelum barang dikeluarkan.');openPurchaseOrderDispatch(po);openEditorRoute(`surat-jalan/${encodeURIComponent(id)}`);return;}
      data.demo=false;save();render();toast(action==='dispatch-po'?'PO dikirim; saldo gudang diperbarui.':'Status PO diperbarui.');return;
    }
    if(action==='dismiss-demo'){data.demo=false;save();render();return}
    if(action==='go-sales')return go('sales');if(action==='go-shipments')return go('shipments');if(action==='go-inventory')return go('inventory');if(action==='view-low-stock'){go('inventory');$$('tbody tr').forEach(row=>{if(!row.querySelector('.qty-low'))row.style.display='none'});return}
    if(action==='add-product'||action==='edit-product'){let edit=action==='edit-product';openModal(edit?'Edit produk':'Tambah produk',[text('sku','Kode SKU',{hint:'ID unik produk di gudang pusat'}),text('barcode','Barcode retail / EAN',{required:false}),text('name','Nama produk'),text('spec','Spesifikasi / varian',{full:true}),text('category','Kategori'),text('brand','Brand'),select('uom',['Pcs','Set','Box','Pack'].map(x=>({value:x,label:x}))),number('hpp','HPP (Rp)'),number('srp','Harga SRP / HET (Rp)'),number('margin','Margin retail (%)',{step:'0.1'}),number('stock','Saldo stok awal')],v=>{let row={...(edit?p:{}),...v,hpp:+v.hpp,srp:+v.srp,margin:+v.margin,stock:edit?p.stock:+v.stock};if(edit){data.products[data.products.findIndex(x=>x.sku===id)]=row}else data.products.unshift(row);data.demo=false;save();closeModal();render();toast(edit?'Produk diperbarui':'Produk ditambahkan')},edit?{...p}:{});if(edit)$('#f-sku').readOnly=true;return}
    if(action==='add-store'||action==='edit-store'){let edit=action==='edit-store';openModal(edit?'Edit cabang':'Tambah cabang',[text('code','Kode cabang / Kode cabang'),text('name','Nama cabang'),text('network','Jaringan retail'),text('region','Region / wilayah'),text('address','Alamat lengkap',{full:true,required:false}),text('contact','Narahubung',{required:false}),text('phone','Nomor telepon',{required:false}),text('email','Email operasional',{type:'email',required:false}),select('term',['Bulanan','14 hari','Bi-weekly'].map(x=>({value:x,label:x}))),number('supplierShare','Porsi Howell (%)',{min:0,max:100}),number('storeShare','Porsi Paperclip (%)',{min:0,max:100}),text('effectiveDate','Tanggal mulai berlaku',{type:'date',required:false}),select('agreementStatus',['Perlu perjanjian','Aktif','Ditangguhkan','Berakhir'].map(x=>({value:x,label:x}))),number('capacity','Kapasitas maksimal rak',{required:false})],v=>{let row={...v,capacity:v.capacity===''?null:+v.capacity,supplierShare:+v.supplierShare,storeShare:+v.storeShare};if(edit)data.stores[data.stores.findIndex(x=>x.code===id)]=row;else data.stores.unshift(row);data.demo=false;save();closeModal();render();toast(edit?'Cabang diperbarui':'Cabang ditambahkan')},edit?{...s}:{term:'Bulanan',supplierShare:65,storeShare:35,agreementStatus:'Perlu perjanjian'});if(edit)$('#f-code').readOnly=true;return}
    if(action==='add-shipment'){openModal('Buat pengiriman konsinyasi',[text('id','Nomor PO konsinyasi'),datefield('date','Tanggal pengiriman'),datefield('eta','Estimasi tiba'),select('store',data.stores.map(x=>({value:x.code,label:x.name}))),select('sku',data.products.map(x=>({value:x.sku,label:`${x.sku} · ${x.name}`}))),number('qty','Kuantitas kirim',{min:1}),text('notes','Catatan pengiriman',{required:false,full:true})],v=>{let pr=data.products.find(x=>x.sku===v.sku);if(!pr){toast('SKU tidak ditemukan.');return}data.shipments.unshift({id:v.id,date:v.date,eta:v.eta,store:v.store,items:[{sku:v.sku,qty:+v.qty,receivedQty:0,srpSnapshot:pr?.priceReady?Number(pr.srp):null}],status:'Draft',recipient:'',grn:'',notes:v.notes});data.demo=false;save();closeModal();go('shipments');toast('PO tersimpan sebagai draft; stok belum berubah')});return}
    if(action==='receive-shipment'){let sh=data.shipments.find(x=>x.id===id);openModal('Konfirmasi penerimaan & GRN',[text('recipient','Nama penerima'),text('grn','Nomor / referensi bukti GRN'),select('status',['Received','Partial','Rejected'].map(x=>({value:x,label:x}))),number('receivedQty','Jumlah unit diterima (parsial)',{required:false,min:0,hint:'Untuk status Partial, masukkan unit yang diterima.'})],v=>{sh.recipient=v.recipient;sh.grn=v.grn;sh.status=v.status;if(v.status==='Rejected')sh.items.forEach(i=>{let pr=data.products.find(p=>p.sku===i.sku);if(pr)pr.stock+=i.qty});else sh.items.forEach(i=>{let qty=v.status==='Partial'?Math.min(i.qty,Number(v.receivedQty||0)):i.qty;if(qty){let row=data.branchStock.find(b=>b.store===sh.store&&b.sku===i.sku);if(!row){row={store:sh.store,sku:i.sku,opening:0,incoming:0,adjustment:0,sold:0,returns:0,physical:null};data.branchStock.push(row)}row.incoming+=qty}});data.demo=false;save();closeModal();render();toast('Status dan stok cabang diperbarui')});return}
    if(action==='add-sale'){openModal('Catat rekonsiliasi penjualan',[text('id','Nomor rekonsiliasi'),select('store',data.stores.map(x=>({value:x.code,label:x.name}))),datefield('start','Awal periode'),datefield('end','Akhir periode'),select('sku',data.products.filter(x=>x.priceReady&&!x.priceConflict).map(x=>({value:x.sku,label:`${x.sku} · ${x.name}`}))),number('opening','Stok awal periode',{min:0,hint:'Gunakan stok akhir periode sebelumnya atau hasil opname.'}),number('incoming','Stok masuk periode',{min:0,hint:'Jumlah unit yang sudah diterima cabang pada periode ini.'}),number('returnQty','Retur terkonfirmasi periode',{min:0}),number('physical','Stok fisik akhir',{min:0}),number('discount','Diskon retail (Rp)'),text('note','Catatan / referensi laporan cabang',{required:false,full:true})],v=>{let pr=data.products.find(x=>x.sku===v.sku),qty=Number(v.opening)+Number(v.incoming)-Number(v.physical)-Number(v.returnQty),gross=Number(pr.srp)*qty,net=gross-Number(v.discount),store=data.stores.find(x=>x.code===v.store);data.sales.unshift({id:v.id,store:v.store,start:v.start,end:v.end,sku:v.sku,openingSnapshot:Number(v.opening),incomingSnapshot:Number(v.incoming),returnSnapshot:Number(v.returnQty),physicalSnapshot:Number(v.physical),qty,discount:Number(v.discount),gross,net,srpSnapshot:Number(pr.srp),howellShareSnapshot:Number(store?.supplierShare??65),storeShareSnapshot:Number(store?.storeShare??35),status:'Menunggu persetujuan',note:v.note||''});data.demo=false;save();closeModal();go('sales');toast('Rekonsiliasi tersimpan untuk ditinjau; stok belum berubah')});return}
    if(action==='add-invoice'){openModal('Buat tagihan konsinyasi',[text('id','Nomor tagihan'),select('store',data.stores.map(x=>({value:x.code,label:x.name}))),datefield('date','Tanggal tagihan'),datefield('due','Tanggal jatuh tempo'),number('netSales','Total omset bersih (Rp)'),number('margin','Komisi / margin retail (%)',{step:'0.1'}),text('ref','Referensi laporan sales',{required:false,full:true})],v=>{data.invoices.unshift({...v,netSales:+v.netSales,margin:+v.margin,paid:0,status:'Unpaid',paidDate:'',proof:''});data.demo=false;save();closeModal();render();toast('Invoice dibuat')});return}
    if(action==='record-payment'){let payout=Math.round(inv.netSales*(1-inv.margin/100));openModal('Catat pembayaran tagihan',[text('amount','Jumlah pembayaran (Rp)',{type:'number',placeholder:'0'}),datefield('paidDate','Tanggal pembayaran'),text('proof','Referensi / bukti transfer',{required:false}),text('remaining','Sisa net payout', {required:false})],v=>{inv.paid=Math.min(payout,inv.paid+(+v.amount));inv.paidDate=v.paidDate;inv.proof=v.proof;inv.status=inv.paid>=payout?'Paid':'Partial';data.demo=false;save();closeModal();render();toast(inv.status==='Paid'?'Invoice lunas':'Pembayaran parsial tercatat')},{remaining:money(Math.max(0,payout-inv.paid))});return}
    if(action==='add-return'){const paperclipStores=data.stores.filter(x=>!x.network||x.network.toLocaleLowerCase('id-ID')==='paperclip');openModal('Catat retur / penarikan',[text('id','Nomor berita acara RMA'),datefield('date','Tanggal retur'),select('storeType',[{value:'paperclip',label:'Paperclip'},{value:'other',label:'Lainnya'}]),select('storeBranch',paperclipStores.map(x=>({value:x.code,label:x.name})),false),text('otherStore','Nama cabang / pelanggan',{required:false,placeholder:'Ketik nama cabang atau pelanggan'}),select('sku',data.products.map(x=>({value:x.sku,label:`${x.sku} · ${x.name}`}))),number('qty','Kuantitas ditarik',{min:1}),select('reason',[{value:'Slow Moving',label:'Pergerakan lambat'},{value:'Damaged',label:'Barang rusak'},{value:'Expired',label:'Kedaluwarsa'},{value:'Store Closing',label:'Toko tutup'}]),select('condition',[{value:'Re-sellable',label:'Layak jual'},{value:'Repairable',label:'Perlu perbaikan'},{value:'Scrap/Musnah',label:'Rusak / dimusnahkan'}]),text('note','Catatan kondisi barang',{required:false,full:true})],v=>{const store=v.storeType==='other'?String(v.otherStore||'').trim():v.storeBranch;if(!store)return toast(v.storeType==='other'?'Masukkan nama cabang atau pelanggan.':'Pilih cabang Paperclip.');v.store=store;delete v.storeType;delete v.storeBranch;delete v.otherStore;let branch=data.branchStock.find(x=>x.store===v.store&&x.sku===v.sku);if(!branch){branch={store:v.store,sku:v.sku,opening:0,incoming:0,adjustment:0,sold:0,returns:0,physical:null};data.branchStock.push(branch)}data.returns.unshift({...v,qty:+v.qty,status:'Menunggu konfirmasi cabang',receivedQty:0,receipts:[]});data.demo=false;save();closeModal();render();toast('Permintaan retur tercatat; stok belum berubah sampai cabang mengonfirmasi pengiriman.')});const type=$('#f-storeType'),branchField=$('#f-storeBranch')?.closest('.field'),otherField=$('#f-otherStore')?.closest('.field'),branchSelect=$('#f-storeBranch'),otherInput=$('#f-otherStore');const syncReturnStoreFields=()=>{const paperclip=type?.value==='paperclip';if(branchField)branchField.hidden=!paperclip;if(branchSelect)branchSelect.required=paperclip;if(otherField)otherField.hidden=type?.value!=='other';if(otherInput)otherInput.required=type?.value==='other'};type?.addEventListener('change',syncReturnStoreFields);syncReturnStoreFields();return}
    if(action==='start-branch-count'){openModal('Opname awal stok cabang',[select('store',data.stores.map(x=>({value:x.code,label:x.name}))),select('sku',data.products.filter(x=>!x.priceConflict).map(x=>({value:x.sku,label:`${x.sku} · ${x.name}`}))),number('physical','Jumlah fisik hasil hitung',{min:0}),text('note','Catatan opname',{required:false,full:true})],v=>{let row=data.branchStock.find(x=>x.store===v.store&&x.sku===v.sku);if(!row){row={store:v.store,sku:v.sku,opening:0,incoming:0,adjustment:0,sold:0,returns:0,physical:null,adjustmentEvents:[]};data.branchStock.push(row)}const previous=branchBalance(row),delta=Number(v.physical)-previous;if(row.physical==null&&Number(row.incoming||0)===0&&Number(row.sold||0)===0&&Number(row.returns||0)===0){row.opening=Number(v.physical);row.openingDate=today;row.adjustment=0}else{row.adjustment=Number(row.adjustment||0)+delta;row.adjustmentEvents ||= [];row.adjustmentEvents.push({delta,date:today,note:v.note||''})}row.physical=Number(v.physical);row.lastShrinkage=delta;row.countDate=today;row.note=v.note||'';recordAudit('stocktake','branch',v.store+'|'+v.sku,{previous,physical:Number(v.physical),delta,note:v.note||''});data.demo=false;save();closeModal();render();toast('Opname cabang tersimpan; saldo awal disesuaikan.')});return;}
    if(action==='count-branch'){let [store,sku]=id.split('|'),branch=data.branchStock.find(x=>x.store===store&&x.sku===sku);if(!branch){branch={store,sku,opening:0,incoming:0,sold:0,returns:0,physical:null};data.branchStock.push(branch)}let system=branchBalance(branch);openModal('Opname stok cabang',[number('physical','Jumlah fisik hasil hitung',{min:0}),text('note','Catatan opname',{required:false,full:true})],v=>{let delta=+v.physical-system;if(branch.physical==null&&Number(branch.incoming||0)===0&&Number(branch.sold||0)===0&&Number(branch.returns||0)===0){branch.opening=+v.physical;branch.openingDate=today;branch.adjustment=0;branch.adjustmentEvents ||= []}else{branch.adjustment=Number(branch.adjustment||0)+delta;branch.adjustmentEvents ||= [];branch.adjustmentEvents.push({delta,date:today,note:v.note||''})}branch.physical=+v.physical;branch.lastShrinkage=delta;branch.countDate=today;branch.note=v.note;data.demo=false;save();closeModal();render();toast(`Opname tersimpan · selisih ${delta>0?'+':''}${delta} unit`)});return}
    if(action==='count'){let target=p;openModal(target?'Perbarui stok · '+target.name:'Mulai opname stok',[...(target?[]:[select('sku',data.products.map(x=>({value:x.sku,label:x.sku+' · '+x.name})))]),number('physical',target&&hasStock(target)?'Jumlah stok baru (saat ini '+Number(target.stock)+' unit)':'Jumlah stok hasil hitung',{min:0}),text('actor','Nama petugas yang memperbarui stok',{placeholder:'Masukkan nama lengkap petugas'}),{name:'source',label:'Sumber',type:'select',items:[{value:'Bizgo',label:'Bizgo'},{value:'Gudang',label:'Gudang'}],required:true}],v=>{let pr=target||data.products.find(x=>x.sku===v.sku);const actor=String(v.actor||'').trim(),source=String(v.source||'').trim();if(!actor)return toast('Nama petugas wajib diisi agar perubahan dapat ditelusuri.');if(!['Bizgo','Gudang'].includes(source))return toast('Pilih sumber stok Bizgo atau Gudang.');const previous=hasStock(pr)?Number(pr.stock):null,physical=Number(v.physical),at=new Date().toISOString(),delta=previous==null?null:physical-previous;data.countHistory||=[];data.countHistory.unshift({level:'Gudang pusat',sku:pr.sku,previous,physical,delta,date:today,at,source,actor});const c={sku:pr.sku,physical,previous,date:today,source,actor,updatedAt:at};pr.stock=physical;pr.stockSource=source;data.counts=data.counts.filter(x=>x.sku!==pr.sku);data.counts.unshift(c);recordAudit('stock-update','warehouse',pr.sku,{previous,physical,delta,source},actor);data.demo=false;save();closeModal();render();toast(previous==null?'Saldo awal opname tersimpan':'Stok diperbarui · perubahan '+(delta>0?'+':'')+delta+' unit')},{physical:target&&hasStock(target)?Number(target.stock):'',source:target?.stockSource||data.counts.find(x=>x.sku===target?.sku)?.source||''});return}
    if(action==='retry-db-sync'){connectSharedDatabase();return}
    if(action==='download-recovery')return downloadRecovery();if(action==='export')return exportData();if(action==='reset-demo'){if(confirm('Pulihkan data awal dari sumber? Semua transaksi lokal dan cabang tambahan akan dihapus.')){data=structuredClone(initial);save();go('dashboard');toast('Data sumber dipulihkan')}return}
  }
  function go(next){
    if(next==='invoices'){next='sales';}
    if(next==='warehouse-sales'){next='warehouse';warehouseDispatchTab='sold';}
    if(next==='sales-history'&&portalRole==='admin'){next='sales';salesViewTab='waybills';}
    if(allowedPages&&!allowedPages.has(next)){toast('Menu ini tidak tersedia pada Portal Gudang.');return}
    current=next;query='';render();$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show');window.scrollTo(0,0);
  }
  function openEditorRoute(route){history.pushState({howellRoute:route},'',`${location.pathname}#${route}`)}
  function clearEditorRoute(){if(location.hash)history.replaceState({},'',location.pathname+location.search)}
  function closeEditorRoute(){if(location.hash)history.back();else closeModal()}
  window.addEventListener('popstate',()=>{if($('#modalBackdrop')?.classList.contains('open')){closeModal();render()}});
  // Nama perusahaan pada PO boleh disesuaikan tanpa mengubah master cabang.
  // Field lama masih dipakai untuk kompatibilitas data, jadi aktifkan saat fokus
  // dan salin nilainya ke snapshot PO tepat sebelum handler submit berjalan.
  document.addEventListener('focusin',event=>{const input=event.target;if(input?.id==='poCustomerName'){input.readOnly=false;input.removeAttribute('readonly');input.name='poCustomerName'}},true);
  document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement)||!form.querySelector('#poCustomerName'))return;const input=form.querySelector('#poCustomerName'),storeCode=form.querySelector('#poStore')?.value,store=data.stores.find(item=>item.code===storeCode);if(!store||!input.value.trim())return;const previous=store.name;store.name=input.value.trim();queueMicrotask(()=>{store.name=previous})},true);
  function toast(msg){let t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
  function downloadRecovery(){const raw=localStorage.getItem(`${KEY}-recovery-latest`);if(!raw)return toast('Tidak ada cadangan pemulihan lokal.');try{const blob=new Blob([raw],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`howell-recovery-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('Cadangan konflik diunduh.')}catch(error){toast(error.message)}}
  
  function cleanExcelVal(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    return s.replace(/[\u2014\u2013\u2012\u2015]/g, '-')
            .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u00A0]/g, ' ')
            .replace(/â‚¬"/g, '-');
  }

  function downloadExcelWorkbook(filename, sheets, fallbackCsvRows) {
    const sanitizeVal = cleanExcelVal;

    // Use XLSX if available for real multi-sheet .xlsx
    if (typeof window !== 'undefined' && window.XLSX) {
      try {
        const XLSX = window.XLSX;
        const wb = XLSX.utils.book_new();
        const sheetList = Array.isArray(sheets) ? sheets : [sheets];

        sheetList.forEach(sheetDef => {
          const sheetName = (sheetDef.name || 'Sheet1').slice(0, 31).replace(/[\\\/?*:\[\]]/g, ' ');
          const cleanRows = (sheetDef.rows || []).map(r => r.map(sanitizeVal));
          const ws = XLSX.utils.aoa_to_sheet(cleanRows);

          // Calculate auto column widths
          const colWidths = [];
          cleanRows.forEach(row => {
            row.forEach((cell, cIdx) => {
              const len = cell != null ? String(cell).length : 0;
              colWidths[cIdx] = Math.max(colWidths[cIdx] || 10, len + 4);
            });
          });
          ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w, 12), 65) }));

          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const baseName = filename.replace(/\.(csv|xlsx)$/i, '');
        XLSX.writeFile(wb, baseName + '.xlsx');
        return;
      } catch (err) {
        console.warn('XLSX export failed, using clean CSV fallback:', err);
      }
    }

    // CSV Fallback
    const rows = fallbackCsvRows || (Array.isArray(sheets) ? sheets[0]?.rows : sheets?.rows) || [];
    const escapeCsvCell = (val) => {
      const s = sanitizeVal(val);
      if (typeof s === 'number') return s;
      return '"' + String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    };
    const content = '\uFEFF' + rows.map(r => r.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.xlsx$/i, '') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadExcelCsv(filename, rows, sheetName = 'Data') {
    return downloadExcelWorkbook(filename, [{ name: sheetName, rows: rows }], rows);
  }

  function exportReportsData(){
    // Sheet 1: Produk per Kategori
    const catRows = [
      ['Kategori Produk', 'Jumlah SKU', 'Total Stok Pusat (Unit)']
    ];
    const categories = [...new Set(data.products.map(x => x.category || 'Lainnya'))];
    categories.forEach(cat => {
      const prods = data.products.filter(x => (x.category || 'Lainnya') === cat);
      const known = prods.filter(hasStock);
      const qty = known.reduce((n, x) => n + Number(x.stock), 0);
      catRows.push([cat, prods.length, qty]);
    });

    // Sheet 2: Status Distribusi PO
    const poRows = [
      ['Status Purchase Order', 'Jumlah PO']
    ];
    ['Draft', 'Menunggu verifikasi', 'Disetujui', 'Dikirim', 'Received', 'Partial', 'Rejected'].forEach(st => {
      const count = data.shipments.filter(x => x.status === st).length;
      poRows.push([st, count]);
    });

    // Sheet 3: Stok Cabang Konsinyasi
    const stockRows = [
      ['Cabang Retail', 'Kode SKU', 'Nama Produk', 'Stok Sistem (Unit)', 'Fisik Opname (Unit)', 'Selisih / Shrinkage (Unit)']
    ];
    data.branchStock.forEach(x => {
      const system = branchBalance(x);
      const delta = x.lastShrinkage ?? (x.physical == null ? null : Number(x.physical) - system);
      stockRows.push([
        storeName(x.store),
        x.sku,
        prodName(x.sku),
        Number(system || 0),
        x.physical == null ? '-' : Number(x.physical),
        delta == null ? '-' : Number(delta)
      ]);
    });

    // Sheet 4: Penjualan per Cabang
    const salesRows = [
      ['Cabang Retail', 'Total Unit Terjual', 'Penjualan Bersih (Rp)']
    ];
    const stores = [...new Set(data.sales.map(x => x.store))];
    stores.forEach(st => {
      const sRows = data.sales.filter(x => x.store === st && (!x.status || x.status === 'Disetujui'));
      const u = sRows.reduce((n, x) => n + Number(x.qty || 0), 0);
      const net = sRows.reduce((n, x) => n + Number(x.net || 0), 0);
      salesRows.push([storeName(st), u, net]);
    });

    // Sheet 5: Status Tagihan & Invoice
    const invRows = [
      ['Status Invoice', 'Jumlah Invoice', 'Sisa Tagihan / Payout (Rp)']
    ];
    ['Unpaid', 'Overdue', 'Partial', 'Paid'].forEach(st => {
      const invs = data.invoices.filter(x => invoiceStatus(x) === st);
      const due = invs.reduce((n, x) => n + Math.max(0, invoicePayout(x) - Number(x.paid || 0)), 0);
      invRows.push([st, invs.length, due]);
    });

    const sheets = [
      { name: 'Produk per Kategori', rows: catRows },
      { name: 'Status Distribusi PO', rows: poRows },
      { name: 'Stok Cabang Konsinyasi', rows: stockRows },
      { name: 'Penjualan Cabang', rows: salesRows },
      { name: 'Status Tagihan Invoice', rows: invRows }
    ];

    const fallbackRows = [
      ['LAPORAN INVENTORI & OPERASIONAL HOWELL', 'Tanggal: ' + today],
      [],
      ['=== 1. PRODUK PER KATEGORI ==='],
      ...catRows,
      [],
      ['=== 2. STATUS DISTRIBUSI PO ==='],
      ...poRows,
      [],
      ['=== 3. STOK CABANG KONSINYASI ==='],
      ...stockRows,
      [],
      ['=== 4. PENJUALAN CABANG ==='],
      ...salesRows,
      [],
      ['=== 5. STATUS TAGIHAN INVOICE ==='],
      ...invRows
    ];

    downloadExcelWorkbook('howell-laporan-' + today + '.xlsx', sheets, fallbackRows);
    toast('Laporan lengkap berhasil diekspor ke Excel.');
  }

  function exportProductsData(){
    const rows = [
      ['Kode SKU', 'Barcode', 'Nama Produk', 'Kategori', 'Brand', 'Satuan (UOM)', 'HPP Dasar (Rp)', 'HPP + 10% (Rp)', 'SRP / HET (Rp)', 'Porsi Howell 65% (Rp)', 'Porsi Paperclip 35% (Rp)', 'Stok Pusat (Unit)', 'Status Stok']
    ];
    data.products.forEach(p => {
      const hpp = Number(p.hpp || p.basePrice || 0);
      const hpp10 = Math.round(hpp * 1.1);
      const srp = Number(p.srp || 0);
      const howellShare = Math.round(srp * 0.65);
      const storeShare = Math.round(srp * 0.35);
      const stockVal = p.stock == null ? '-' : Number(p.stock);
      const status = p.stock == null ? 'Belum opname' : p.stock < 10 ? 'Stok Menipis' : 'Tersedia';
      rows.push([
        p.sku || '',
        p.barcode || '',
        p.name || '',
        p.category || '',
        p.brand || 'Howell',
        p.uom || 'Unit',
        hpp,
        hpp10,
        srp,
        howellShare,
        storeShare,
        stockVal,
        status
      ]);
    });
    downloadExcelWorkbook('howell-master-produk-' + today + '.xlsx', [{ name: 'Master Produk', rows: rows }], rows);
    toast('Master produk berhasil diekspor ke Excel.');
  }

  function exportWarehouseData(){
    const orders = Array.isArray(data.shipments) ? data.shipments : [];
    const dispatchesOf = po => Array.isArray(po?.dispatches) ? po.dispatches : [];
    const allDispatches = orders.flatMap(po => dispatchesOf(po).map((dispatch, index) => ({ po, dispatch, index })))
      .sort((a, b) => (b.dispatch.date || '').localeCompare(a.dispatch.date || ''));

    // Sheet 1: Riwayat Surat Jalan Gudang
    const sjRows = [
      [
        'Nomor Surat Jalan',
        'Nomor PO',
        'Tanggal Pengiriman',
        'Customer / Cabang Tujuan',
        'Total Quantity Keluar (Unit)',
        'Status PO',
        'Rincian Produk & SKU'
      ]
    ];

    allDispatches.forEach(({ po, dispatch }) => {
      const items = Array.isArray(dispatch.items) ? dispatch.items : [];
      const totalQty = items.reduce((n, it) => n + Number(it.qty || 0), 0);
      const itemDetails = items.map(it => it.sku + ' (' + it.qty + ' unit)').join('; ');
      sjRows.push([
        dispatch.number || '-',
        po.id || '-',
        dispatch.date || '',
        po.customerName || storeName(po.store),
        Number(totalQty),
        po.status || 'Dikirim',
        itemDetails
      ]);
    });

    // Sheet 2: Purchase Order Proses Gudang
    const poRows = [
      [
        'Nomor PO',
        'Customer / Cabang',
        'Tanggal PO',
        'Alamat Pengiriman',
        'Total Qty Dipesan (Unit)',
        'Total Qty Keluar (Unit)',
        'Sisa Belum Keluar (Unit)',
        'Status PO'
      ]
    ];

    orders.forEach(po => {
      const items = Array.isArray(po.items) ? po.items : [];
      const ordered = items.reduce((a, it) => a + orderedQty(it), 0);
      const dispatched = items.reduce((a, it) => a + dispatchedQty(po, it), 0);
      const remaining = Math.max(0, ordered - dispatched);
      poRows.push([
        po.id || '',
        po.customerName || storeName(po.store),
        po.date || '',
        po.shipTo || '',
        Number(ordered),
        Number(dispatched),
        Number(remaining),
        po.status || ''
      ]);
    });

    const sheets = [
      { name: 'Surat Jalan Gudang', rows: sjRows },
      { name: 'Purchase Order Gudang', rows: poRows }
    ];

    const fallbackRows = [
      ['=== RIWAYAT SURAT JALAN GUDANG ==='],
      ...sjRows,
      [],
      ['=== PURCHASE ORDER PROSES GUDANG ==='],
      ...poRows
    ];

    downloadExcelWorkbook('howell-gudang-surat-jalan-' + today + '.xlsx', sheets, fallbackRows);
    toast('Data gudang berhasil diekspor ke Excel.');
  }

  function exportSalesHistoryData(){
    const orders = Array.isArray(data.shipments) ? data.shipments : [];
    const dispatchesOf = po => Array.isArray(po?.dispatches) ? po.dispatches : [];
    const isSoldPo = po => ['Selesai terjual', 'Done', 'Terjual'].includes(po?.status);
    const soldDispatches = orders.flatMap(po => dispatchesOf(po).map((dispatch, index) => ({ po, dispatch, index })))
      .filter(x => isSoldPo(x.po))
      .sort((a, b) => (b.dispatch.date || '').localeCompare(a.dispatch.date || ''));

    // Sheet 1: Riwayat Surat Jalan Selesai Terjual
    const sjRows = [
      [
        'Nomor Surat Jalan',
        'Nomor PO',
        'Tanggal',
        'Customer / Cabang',
        'Quantity Keluar (Unit)',
        'Status'
      ]
    ];

    soldDispatches.forEach(({ po, dispatch }) => {
      const qty = (Array.isArray(dispatch.items) ? dispatch.items : []).reduce((n, it) => n + Number(it.qty || 0), 0);
      sjRows.push([
        dispatch.number || '-',
        po.id || '-',
        dispatch.date || '',
        po.customerName || storeName(po.store),
        Number(qty),
        po.status || 'Selesai terjual'
      ]);
    });

    // Sheet 2: Rekonsiliasi Penjualan per Cabang & SKU
    const recRows = [
      [
        'Nomor Rekonsiliasi',
        'Cabang',
        'Periode Mulai',
        'Periode Selesai',
        'Kode SKU',
        'Nama Produk',
        'Stok Awal',
        'Stok Masuk',
        'Fisik Akhir',
        'Retur',
        'Unit Terjual',
        'Penjualan Kotor (Rp)',
        'Diskon Retail (Rp)',
        'Penjualan Bersih (Rp)',
        'Status Rekonsiliasi'
      ]
    ];

    data.sales.forEach(x => {
      recRows.push([
        x.id || '',
        storeName(x.store),
        x.start || '',
        x.end || x.start || '',
        x.sku || '',
        prodName(x.sku),
        x.openingSnapshot != null ? Number(x.openingSnapshot) : 0,
        x.incomingSnapshot != null ? Number(x.incomingSnapshot) : 0,
        x.physicalSnapshot != null ? Number(x.physicalSnapshot) : 0,
        x.returnSnapshot != null ? Number(x.returnSnapshot) : 0,
        Number(x.qty || 0),
        Number(x.gross || 0),
        Number(x.discount || 0),
        Number(x.net || 0),
        x.status || 'Disetujui'
      ]);
    });

    const sheets = [
      { name: 'Surat Jalan Terjual', rows: sjRows },
      { name: 'Rekonsiliasi SKU', rows: recRows }
    ];

    const fallbackRows = [
      ['=== RIWAYAT SURAT JALAN SELESAI TERJUAL ==='],
      ...sjRows,
      [],
      ['=== REKONSILIASI PENJUALAN PER CABANG & SKU ==='],
      ...recRows
    ];

    downloadExcelWorkbook('howell-riwayat-penjualan-' + today + '.xlsx', sheets, fallbackRows);
    toast('Data riwayat berhasil diekspor ke Excel.');
  }

  function exportShipmentsData(){
    const rows = [
      ['Nomor PO', 'Customer / Cabang', 'Tanggal PO', 'Estimasi Tiba (ETA)', 'Alamat Pengiriman', 'Penanggung Jawab', 'Rincian Produk & Qty', 'Total Unit Dipesan', 'Total Unit Keluar', 'Status PO']
    ];
    data.shipments.forEach(po => {
      const items = Array.isArray(po.items) ? po.items : [];
      const ordered = items.reduce((a, it) => a + orderedQty(it), 0);
      const dispatched = items.reduce((a, it) => a + dispatchedQty(po, it), 0);
      const itemDetails = items.map(it => it.sku + ' (' + (it.qty || 0) + ' ordered)').join('; ');
      rows.push([
        po.id || '',
        po.customerName || storeName(po.store),
        po.date || '',
        po.eta || '',
        po.shipTo || '',
        po.pic || '',
        itemDetails,
        Number(ordered),
        Number(dispatched),
        po.status || ''
      ]);
    });
    downloadExcelWorkbook('howell-purchase-order-' + today + '.xlsx', [{ name: 'Purchase Order', rows: rows }], rows);
    toast('Data Purchase Order berhasil diekspor ke Excel.');
  }

  function exportInventoryData(){
    const rows = [
      ['Kode SKU', 'Barcode', 'Nama Produk', 'Kategori', 'Satuan', 'Stok Gudang Pusat (Unit)', 'Fisik Opname Terakhir', 'Selisih Opname', 'Status Stok']
    ];
    data.products.forEach(p => {
      const lastCount = (data.counts || []).find(c => c.sku === p.sku);
      const stock = p.stock == null ? '-' : Number(p.stock);
      const phys = lastCount?.physical == null ? '-' : Number(lastCount.physical);
      const diff = (p.stock != null && lastCount?.physical != null) ? (Number(lastCount.physical) - Number(p.stock)) : '-';
      const status = p.stock == null ? 'Belum opname' : p.stock < 10 ? 'Stok Menipis' : 'Tersedia';
      rows.push([
        p.sku || '',
        p.barcode || '',
        p.name || '',
        p.category || '',
        p.uom || 'Unit',
        stock,
        phys,
        diff,
        status
      ]);
    });
    downloadExcelWorkbook('howell-stok-inventori-' + today + '.xlsx', [{ name: 'Stok Inventori', rows: rows }], rows);
    toast('Data stok inventori berhasil diekspor ke Excel.');
  }

  function exportInvoicesData(){
    const rows = [
      ['Nomor Invoice', 'Cabang Retail', 'Periode Rekonsiliasi', 'Jatuh Tempo', 'Penjualan Kotor (Rp)', 'Bagi Hasil Retail (Rp)', 'Tagihan Bersih (Rp)', 'Jumlah Terbayar (Rp)', 'Sisa Payout (Rp)', 'Status Tagihan']
    ];
    data.invoices.forEach(inv => {
      const gross = Number(inv.gross || 0);
      const fee = Number(inv.fee || 0);
      const net = invoicePayout(inv);
      const paid = Number(inv.paid || 0);
      const balance = Math.max(0, net - paid);
      rows.push([
        inv.id || '',
        storeName(inv.store),
        inv.period || '',
        inv.due || '',
        gross,
        fee,
        net,
        paid,
        balance,
        invoiceStatus(inv)
      ]);
    });
    downloadExcelWorkbook('howell-tagihan-invoice-' + today + '.xlsx', [{ name: 'Tagihan & Invoice', rows: rows }], rows);
    toast('Data tagihan berhasil diekspor ke Excel.');
  }

  function exportReturnsData(){
    const rows = [
      ['Nomor Retur (RMA)', 'Cabang Asal', 'Tanggal Retur', 'Kode SKU', 'Nama Produk', 'Jumlah Retur (Unit)', 'Alasan Retur', 'Status Retur']
    ];
    data.returns.forEach(ret => {
      rows.push([
        ret.id || '',
        storeName(ret.store),
        ret.date || '',
        ret.sku || '',
        prodName(ret.sku),
        Number(ret.qty || 0),
        ret.reason || 'Klaim rusak / tidak laku',
        ret.status || 'Pending'
      ]);
    });
    downloadExcelWorkbook('howell-retur-barang-' + today + '.xlsx', [{ name: 'Retur Barang', rows: rows }], rows);
    toast('Data retur barang berhasil diekspor ke Excel.');
  }

  function exportTableFallback(){
    const table = $('#pageContent table');
    if (!table) {
      downloadExcelWorkbook('howell-' + current + '-' + today + '.xlsx', [{ name: current, rows: [['Data kosong']] }]);
      toast('File ekspor berhasil dibuat.');
      return;
    }
    const rows = [];
    [...table.rows].forEach(tr => {
      const cells = [...tr.cells].map(c => c.innerText.replace(/\r?\n/g, ' ').trim());
      rows.push(cells);
    });
    downloadExcelWorkbook('howell-' + current + '-' + today + '.xlsx', [{ name: current, rows: rows }], rows);
    toast('Data tabel berhasil diekspor ke Excel.');
  }

  function exportData(){
    if(current==='reports') return exportReportsData();
    if(current==='products') return exportProductsData();
    if(current==='warehouse') return exportWarehouseData();
    if(current==='sales'||current==='sales-history') return exportSalesHistoryData();
    if(current==='shipments') return exportShipmentsData();
    if(current==='inventory') return exportInventoryData();
    if(current==='stores') return exportBranches();
    if(current==='invoices') return exportInvoicesData();
    if(current==='returns') return exportReturnsData();
    if(current==='settings'){
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'howell-backup-' + today + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Cadangan JSON berhasil dibuat.');
      return;
    }
    if(current==='dashboard'){
      const rows = [
        ['Indikator Operasional', 'Nilai'],
        ['Total SKU Produk', data.products.length],
        ['Total Cabang Retail', data.stores.length],
        ['Total Purchase Order', data.shipments.length],
        ['Surat Jalan Disimpan', data.shipments.flatMap(po => Array.isArray(po.dispatches) ? po.dispatches : []).length],
        ['Total Transaksi Penjualan', data.sales.length],
        ['Total Tagihan Invoice', data.invoices.length],
        ['Total Retur Barang', data.returns.length]
      ];
      downloadExcelWorkbook('howell-ringkasan-dashboard-' + today + '.xlsx', [{ name: 'Ringkasan Operasional', rows: rows }], rows);
      toast('Ringkasan dashboard berhasil diekspor ke Excel.');
      return;
    }
    return exportTableFallback();
  }

  let activeAction=null;
  const doActionBeforeSafety=doAction;
  doAction=function(action,id){
    if(portalRole==='warehouse'&&!new Set(['dispatch-po','update-warehouse-po-status','count','confirm-return-receipt','print-waybill','reload-page','retry-db-sync','mark-po-sold','update-po-dispatch-status']).has(action))return toast('Aksi ini tidak tersedia pada Portal Gudang.');
    if(action==='confirm-return-receipt')return confirmReturnReceipt(id);
    activeAction={action,id};
    try{return doActionBeforeSafety(action,id)}finally{activeAction=null}
  };
  const openModalBeforeSafety=openModal;
  openModal=function(title,fields,submit,initialValues={}){
    const context=activeAction?{...activeAction}:null;
    if(context?.action==='add-shipment'){
      const products=data.products.map(x=>({value:x.sku,label:x.sku+' · '+x.name}));
      fields=[text('id','Nomor surat jalan / DO'),datefield('date','Tanggal pengiriman'),datefield('eta','Estimasi tiba'),select('store',data.stores.map(x=>({value:x.code,label:x.name})))];
      for(let i=1;i<=4;i++){fields.push(select('sku'+i,products,i===1));fields.push(number('qty'+i,'Kuantitas SKU '+i,{min:1,required:i===1}));}
      fields.push(text('notes','Catatan pengiriman',{required:false,full:true}));
    }
    if(context?.action==='edit-product')fields=fields.filter(f=>f.name!=='stock');
    if(context?.action==='receive-shipment'){
      const shipment=data.shipments.find(x=>x.id===context.id);
      if(shipment){
        fields=[text('recipient','Nama penerima'),text('grn','Nomor / referensi bukti GRN'),select('status',['Received','Partial','Rejected'].map(x=>({value:x,label:x})))];
        shipment.items.forEach((item,index)=>{const name='received'+index,product=data.products.find(x=>x.sku===item.sku);fields.push(number(name,'Kumulatif diterima · '+(product?.name||item.sku)+' ('+Number(item.receivedQty||0)+' / '+dispatchedQty(shipment,item)+')',{min:0,required:false}));initialValues={...initialValues,[name]:Number(item.receivedQty||0)};});
      }
    }
    const safeSubmit=values=>{
      const before=structuredClone(data),action=context?.action,id=context?.id;
      const fail=message=>{toast(message);return false};
      if(action==='add-product'||action==='edit-product'){
        const sku=String(values.sku||'').trim(),barcode=String(values.barcode||'').trim(),current=data.products.find(x=>x.sku===id);
        if(!sku||data.products.some(x=>x.sku.toLowerCase()===sku.toLowerCase()&&x.sku!==id))return fail('Kode SKU wajib diisi dan harus unik.');
        if(barcode&&data.products.some(x=>x.barcode===barcode&&x.sku!==id))return fail('Barcode sudah digunakan oleh produk lain.');
        if(!current&&(!wholeQty(values.stock)||Number(values.stock)<0))return fail('Stok awal harus berupa bilangan bulat nol atau lebih.');
        if(![values.hpp,values.srp,values.margin].every(v=>Number.isFinite(Number(v))&&Number(v)>=0)||Number(values.margin)>100)return fail('Periksa HPP, SRP, dan margin (0–100%).');
        if(current)values.stock=current.stock;
      }
      if(action==='add-store'||action==='edit-store'){
        const code=String(values.code||'').trim();
        if(!code||data.stores.some(x=>x.code.toLowerCase()===code.toLowerCase()&&x.code!==id))return fail('Store ID wajib diisi dan harus unik.');
        if(values.capacity!==''&&!wholeQty(values.capacity))return fail('Kapasitas rak harus berupa bilangan bulat nol atau lebih.');if(![values.supplierShare,values.storeShare].every(v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100)||Number(values.supplierShare)+Number(values.storeShare)!==100)return fail('Porsi Howell dan Paperclip harus berjumlah tepat 100%.');
      }
      if(action==='add-shipment'){
        const lines=[];for(let i=1;i<=4;i++){const sku=String(values['sku'+i]||'').trim(),qty=Number(values['qty'+i]);if(sku)lines.push({sku,qty});}
        values.sku=lines[0]?.sku||values.sku;values.qty=lines[0]?.qty||values.qty;
        if(!lines.length)return fail('Tambahkan minimal satu SKU ke surat jalan.');
        if(new Set(lines.map(x=>x.sku)).size!==lines.length)return fail('SKU yang sama hanya boleh muncul satu kali dalam surat jalan.');
        if(!values.id.trim()||data.shipments.some(x=>x.id.toLowerCase()===values.id.trim().toLowerCase()))return fail('Nomor DO wajib diisi dan harus unik.');
        if(!data.stores.some(x=>x.code===values.store))return fail('Pilih cabang yang valid.');
        for(const line of lines){const product=data.products.find(x=>x.sku===line.sku);if(!product)return fail('SKU tidak ditemukan.');if(product.priceConflict)return fail('SKU '+line.sku+' memiliki varian sumber yang berbeda. Klarifikasi SKU sebelum transaksi.');if(!wholeQty(line.qty)||line.qty<1)return fail('Kuantitas '+line.sku+' harus bilangan bulat positif. Saldo akan diperiksa saat PO dikirim.');}
        if(values.eta<values.date)return fail('Estimasi tiba tidak boleh sebelum tanggal pengiriman.');
      }
      if(action==='receive-shipment'){
        const shipment=data.shipments.find(x=>x.id===id);
        if(!shipment||!['Dikirim','In Transit','Partial'].includes(shipment.status)||!values.recipient.trim()||!values.grn.trim())return fail('PO harus berstatus dikirim dan penerima serta referensi GRN wajib diisi.');
        const targets=shipment.items.map((item,index)=>values.status==='Received'?dispatchedQty(shipment,item):values.status==='Rejected'?0:Number(values['received'+index]));
        const prior=shipment.items.map(x=>Number(x.receivedQty||0));
        if(targets.some((target,index)=>!wholeQty(target)||target<prior[index]||target>dispatchedQty(shipment,shipment.items[index])))return fail('Jumlah kumulatif diterima per SKU tidak valid.');
        if(values.status==='Partial'&&(!targets.some((target,index)=>target>prior[index])||targets.every((target,index)=>target===dispatchedQty(shipment,shipment.items[index]))))return fail('Untuk Partial, jumlah harus bertambah dan setidaknya satu SKU masih tersisa.');
        if(values.status==='Rejected'&&prior.some(x=>x>0))return fail('DO yang sudah memiliki penerimaan tidak dapat ditolak seluruhnya.');
        values._receivedTargets=targets;
      }
      if(action==='add-sale'){
        const report=String(values.id||'').trim(),opening=Number(values.opening),incoming=Number(values.incoming),returns=Number(values.returnQty),physical=Number(values.physical),qty=opening+incoming-physical-returns,discount=Number(values.discount),product=data.products.find(x=>x.sku===values.sku),samePeriod=data.sales.some(x=>x.store===values.store&&x.sku===values.sku&&x.start===values.start&&x.end===values.end);
        if(!report||data.sales.some(x=>x.id.toLowerCase()===report.toLowerCase()))return fail('Nomor rekonsiliasi wajib diisi dan harus unik.');
        if(samePeriod)return fail('SKU dan periode ini sudah memiliki rekonsiliasi. Gunakan koreksi tercatat bila ada perubahan.');
        if(!data.stores.some(x=>x.code===values.store)||!product)return fail('Pilih cabang dan SKU yang valid.');
        if(product.priceConflict)return fail('SKU ini memiliki varian sumber yang berbeda dan belum boleh dijual.');if(!product.priceReady||!Number(product.srp))return fail('Harga jual SKU belum tersedia pada pricelist B2B.');
        if(![opening,incoming,returns,physical].every(wholeQty))return fail('Stok awal, masuk, retur, dan fisik harus bilangan bulat non-negatif.');
        if(!wholeQty(qty))return fail('Hasil rekonsiliasi negatif atau tidak bulat. Periksa stok awal, penerimaan, retur, dan stok fisik.');
        const figures=branchPeriodFigures(values.store,values.sku,values.start,values.end),available=figures.branch?branchBalance(figures.branch):0;
        if(figures.branch?.openingDate&&values.start<figures.branch.openingDate)return fail('Stok awal untuk periode ini mendahului opname pertama cabang. Pilih periode setelah opname atau catat saldo awal yang valid.');
        if(opening!==figures.opening)return fail('Stok awal periode tidak cocok dengan saldo dan transaksi tersimpan ('+figures.opening+' unit). Periksa hasil opname sebelumnya.');
        if(incoming!==figures.incoming)return fail('Stok masuk periode harus sama dengan unit penerimaan GRN yang tercatat ('+figures.incoming+' unit).');
        if(returns!==figures.returns)return fail('Retur periode harus sama dengan jumlah retur yang dikirim cabang pada sistem ('+figures.returns+' unit).');
        if(data.invoices.some(x=>x.periodKey===`${values.store}|${values.start}|${values.end}`))return fail('Periode ini sudah ditutup dengan invoice. Gunakan koreksi tercatat untuk perubahan.');
        if(qty>available)return fail('Hasil terjual melebihi stok sistem cabang ('+available+' unit). Tinjau opname dan penerimaan terlebih dahulu.');
        const gross=Number(product.srp)*qty;if(!Number.isFinite(discount)||discount<0||discount>gross)return fail('Diskon harus nol atau lebih dan tidak boleh melebihi penjualan kotor.');
        if(values.end<values.start)return fail('Akhir periode tidak boleh sebelum awal periode.');
      }
      if(action==='add-invoice'){
        if(!values.id.trim()||data.invoices.some(x=>x.id.toLowerCase()===values.id.trim().toLowerCase()))return fail('Nomor invoice wajib diisi dan harus unik.');
        if(!Number.isFinite(Number(values.netSales))||Number(values.netSales)<0||!Number.isFinite(Number(values.margin))||Number(values.margin)<0||Number(values.margin)>100)return fail('Periksa nilai penjualan dan margin (0–100%).');
        if(values.due<values.date)return fail('Jatuh tempo tidak boleh sebelum tanggal invoice.');
      }
      if(action==='record-payment'){
        const invoice=data.invoices.find(x=>x.id===id),amount=Number(values.amount),balance=invoice?Math.max(0,invoicePayout(invoice)-Number(invoice.paid||0)):0;
        if(!invoice||!wholeQty(amount)||amount<1||amount>balance)return fail('Pembayaran harus positif dan tidak boleh melebihi sisa tagihan ('+money(balance)+').');
        if(!values.paidDate||!String(values.proof||'').trim())return fail('Tanggal dan referensi pembayaran wajib diisi.');
      }
      if(action==='add-return'){
        const rma=String(values.id||'').trim(),qty=Number(values.qty),product=data.products.find(x=>x.sku===values.sku),branch=data.branchStock.find(x=>x.store===values.store&&x.sku===values.sku);
        const available=branch?branchBalance(branch):0;
        if(!rma||data.returns.some(x=>x.id.toLowerCase()===rma.toLowerCase()))return fail('Nomor RMA wajib diisi dan harus unik.');
        if(!data.stores.some(x=>x.code===values.store)||!product)return fail('Pilih cabang dan SKU yang valid.');
        if(!branch||!wholeQty(qty)||qty<1||qty>available)return fail('Kuantitas retur melebihi stok cabang yang tersedia ('+available+' unit).');
      }
      if(action==='receive-shipment'){
        const shipment=data.shipments.find(x=>x.id===id);
        if(values.status==='Rejected'){shipment.items.forEach(item=>{const product=data.products.find(x=>x.sku===item.sku);if(product&&shipment.stockDispatched&&hasStock(product))product.stock+=dispatchedQty(shipment,item);item.receivedQty=0;});}
        else shipment.items.forEach((item,index)=>{const target=values._receivedTargets[index],delta=target-Number(item.receivedQty||0);item.receivedQty=target;if(delta>0){item.receipts ||= [];item.receipts.push({qty:delta,date:today,grn:values.grn});let row=data.branchStock.find(x=>x.store===shipment.store&&x.sku===item.sku);if(!row){row={store:shipment.store,sku:item.sku,opening:0,incoming:0,adjustment:0,sold:0,returns:0,physical:null};data.branchStock.push(row);}row.incoming+=delta;}});
        shipment.status=values.status==='Received'&&shipment.items.some(item=>Number(item.receivedQty||0)<dispatchedQty(shipment,item)||dispatchedQty(shipment,item)<orderedQty(item))?'Partial':values.status;shipment.recipient=values.recipient.trim();shipment.grn=values.grn.trim();data.demo=false;recordAudit('receive','shipment',shipment.id,{status:shipment.status,grn:shipment.grn,items:shipment.items.map(x=>({sku:x.sku,shipped:x.qty,received:x.receivedQty||0}))});save();closeModal();render();toast(shipment.status==='Rejected'?'Pengiriman ditolak; stok dikembalikan ke gudang.':'Penerimaan tersimpan dan jumlah kumulatif diperbarui.');return;
      }
      submit(values);
      if(action==='add-return'){
        data.products.forEach(p=>{const prior=before.products.find(x=>x.sku===p.sku);if(prior)p.stock=prior.stock});
        const row=data.returns.find(x=>x.id===String(values.id).trim());if(row){row.status='Menunggu konfirmasi cabang';row.receivedQty=0;row.receipts=[];}
        recordAudit('create','return',values.id,{store:values.store,sku:values.sku,qty:Number(values.qty),status:'Menunggu konfirmasi cabang'});
        save();render();
      }else if(action==='record-payment'){
        const invoice=data.invoices.find(x=>x.id===id);invoice.payments ||= [];invoice.payments.push({amount:Number(values.amount),date:values.paidDate,proof:String(values.proof).trim(),recordedAt:new Date().toISOString()});invoice.status=invoiceStatus(invoice);
        recordAudit('payment','invoice',id,{amount:Number(values.amount),date:values.paidDate,proof:String(values.proof).trim()});save();render();
      }else if(action==='add-sale'){
        const sale=data.sales.find(x=>x.id===String(values.id).trim());
        recordAudit('create','sales-reconciliation',values.id,{store:values.store,sku:values.sku,opening:sale?.openingSnapshot,incoming:sale?.incomingSnapshot,physical:sale?.physicalSnapshot,returns:sale?.returnSnapshot,qty:sale?.qty,gross:sale?.gross,discount:Number(values.discount),net:sale?.net,status:sale?.status});save();
      }else if(action==='add-shipment'){
        const shipment=data.shipments.find(x=>x.id===String(values.id).trim()),lines=[];for(let i=1;i<=4;i++){if(values['sku'+i])lines.push({sku:values['sku'+i],qty:Number(values['qty'+i])});}
        if(shipment){shipment.items=lines.map(x=>{const product=data.products.find(p=>p.sku===x.sku);return{sku:x.sku,qty:x.qty,receivedQty:0,srpSnapshot:product?.priceReady?Number(product.srp):null}});for(const line of lines.slice(1)){const product=data.products.find(x=>x.sku===line.sku);}recordAudit('create','shipment',shipment.id,{store:shipment.store,items:lines});save();render();}
      }else if(action==='count'||action==='count-branch'){
        data.countHistory ||= [];
        if(action==='count'){const sku=values.sku||id,old=before.counts.find(x=>x.sku===sku);if(old)data.countHistory.push({level:'Gudang pusat',...old,archivedAt:new Date().toISOString()});recordAudit('stocktake','warehouse',sku,{physical:Number(values.physical),note:values.note||''});}
        else {const parts=String(id||'').split('|'),old=before.branchStock.find(x=>x.store===parts[0]&&x.sku===parts[1]);if(old&&old.physical!=null)data.countHistory.push({level:'Cabang',...old,archivedAt:new Date().toISOString()});recordAudit('stocktake','branch',id,{physical:Number(values.physical),note:values.note||''});}
        save();
      }else if(action==='add-product'||action==='edit-product'||action==='add-store'||action==='edit-store'||action==='add-invoice'){
        recordAudit(action.startsWith('edit')?'update':'create',action.includes('product')?'product':action.includes('store')?'branch':action.includes('shipment')?'shipment':'invoice',values.id||values.sku||values.code,{});
        save();
      }
    };
    if(context?.action==='confirm-return-receipt'){
      const row=data.returns.find(x=>x.id===context.id);if(!row||!['Dalam perjalanan','Partial'].includes(row.status))return toast('Retur harus dikirim cabang sebelum diperiksa gudang.');const already=Number(row?.receivedQty||0),remaining=Number(row?.qty||0)-already;
      initialValues={...initialValues,qty:1};
      fields=[number('qty','Jumlah benar-benar diterima',{min:1}),select('condition',[{value:'Re-sellable',label:'Layak jual'},{value:'Repairable',label:'Perlu perbaikan'},{value:'Scrap/Musnah',label:'Rusak / dimusnahkan'}]),text('receivedBy','Petugas gudang'),text('note','Catatan pemeriksaan',{required:false,full:true})];
    }
    return openModalBeforeSafety(title,fields,values=>{
      if(context?.action==='confirm-return-receipt'){
        const row=data.returns.find(x=>x.id===context.id);if(!row)return toast('RMA tidak ditemukan.');
        const qty=Number(values.qty),already=Number(row.receivedQty||0),remaining=Number(row.qty)-already;
        if(!wholeQty(qty)||qty<1||qty>remaining)return toast('Jumlah diterima harus positif dan tidak melebihi sisa RMA ('+remaining+' unit).');
        if(!String(values.receivedBy||'').trim())return toast('Petugas penerima wajib diisi.');
        row.receivedQty=already+qty;row.receipts ||= [];row.receipts.push({qty,condition:values.condition,receivedBy:values.receivedBy.trim(),date:today,note:values.note||''});
        if(values.condition==='Re-sellable'){const product=data.products.find(x=>x.sku===row.sku);if(product&&hasStock(product))product.stock+=qty;}
        row.status=row.receivedQty===Number(row.qty)?'Diterima':'Partial';
        recordAudit('receive','return',row.id,{qty,condition:values.condition,receivedBy:values.receivedBy.trim(),totalReceived:row.receivedQty,requested:row.qty});
        data.demo=false;save();closeModal();render();toast(values.condition==='Re-sellable'?(hasStock(data.products.find(x=>x.sku===row.sku))?'Barang layak jual diterima; stok pusat diperbarui.':'Barang diterima. Opname gudang diperlukan untuk memastikan saldo pusat.'):'Penerimaan dicatat; barang belum masuk ke stok tersedia.');return;
      }
      safeSubmit(values)
    },initialValues);
  };
  function exportStockHistoryCsv(entries){
    const headers=['Tanggal & Waktu','Nama Produk','Kode SKU','Saldo Sebelumnya','Saldo Sesudah','Perubahan Unit','Petugas','Keterangan Sumber'];
    const rows=[headers];
    (entries || []).forEach(entry=>{
      const product=data.products.find(p=>p.sku===entry.sku);
      const when=entry.at||entry.archivedAt||entry.date;
      const formattedDate=when?new Date(when).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'-';
      const delta=entry.delta??(entry.previous==null?null:Number(entry.physical)-Number(entry.previous));
      const deltaVal=delta==null?0:Number(delta);
      rows.push([
        formattedDate,
        product?.name||entry.sku||'-',
        entry.sku||'-',
        entry.previous==null?0:Number(entry.previous),
        entry.physical==null?0:Number(entry.physical),
        deltaVal,
        entry.actor||'Nama petugas belum tercatat',
        entry.source||'Belum dicatat'
      ]);
    });
    downloadExcelWorkbook('riwayat-perubahan-stok-'+today+'.xlsx',[{name:'Riwayat Perubahan Stok',rows}],rows);
    toast('Riwayat perubahan stok berhasil diekspor ke Excel.');
  }

  function renderStockHistoryPanel(){
    const container=$('#pageContent');
    if(!container)return;
    const allEntries=(data.countHistory||[]).filter(x=>!x.level||x.level==='Gudang pusat').sort((a,b)=>{
      const tA=new Date(a.at||a.archivedAt||a.date||0).getTime();
      const tB=new Date(b.at||b.archivedAt||b.date||0).getTime();
      return (tB||0)-(tA||0);
    });
    const panel=document.createElement('article');
    panel.className='card table-card stock-history-card';
    panel.id='stockHistoryPanel';

    const getFilteredEntries=()=>{
      const q=String(stockHistoryQuery||'').trim().toLocaleLowerCase('id-ID');
      const tokens=q.split(/\s+/).filter(Boolean);
      return tokens.length?allEntries.filter(entry=>{
        const product=data.products.find(p=>p.sku===entry.sku);
        const when=entry.at||entry.archivedAt||entry.date;
        const formattedDate=when?new Date(when).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'';
        const text=[
          entry.sku,
          product?.name||'',
          product?.spec||'',
          entry.actor||'',
          entry.source||'',
          entry.date||'',
          formattedDate
        ].join(' ').toLocaleLowerCase('id-ID');
        return tokens.every(token=>text.includes(token));
      }):allEntries;
    };

    const updateTable=()=>{
      const filtered=getFilteredEntries();
      const isAll=stockHistoryLimit==='all';
      const limitNum=isAll?filtered.length:(Number(stockHistoryLimit)||10);
      const displayed=filtered.slice(0,limitNum);
      const q=String(stockHistoryQuery||'').trim();

      const subtitleEl=panel.querySelector('#stockHistorySubtitle');
      if(subtitleEl){
        if(q){
          subtitleEl.textContent=`Menemukan ${filtered.length.toLocaleString('id-ID')} riwayat untuk "${q}" (menampilkan ${displayed.length.toLocaleString('id-ID')}) · Gudang pusat`;
        }else if(isAll){
          subtitleEl.textContent=`Menampilkan semua ${allEntries.length.toLocaleString('id-ID')} riwayat perubahan stok · Gudang pusat`;
        }else{
          subtitleEl.textContent=`Menampilkan ${displayed.length.toLocaleString('id-ID')} dari ${allEntries.length.toLocaleString('id-ID')} riwayat perubahan terbaru (tampilan dipersempit) · Gudang pusat`;
        }
      }

      const toggleBtn=panel.querySelector('#stockHistoryToggleAll');
      if(toggleBtn){
        if(isAll){
          toggleBtn.textContent='Persempit ke 10';
          toggleBtn.title='Persempit tampilan riwayat ke 10 data terbaru';
        }else{
          toggleBtn.textContent=`Lihat semua (${allEntries.length.toLocaleString('id-ID')})`;
          toggleBtn.title='Tampilkan seluruh catatan riwayat perubahan stok';
        }
      }

      const selectLimit=panel.querySelector('#stockHistoryLimit');
      if(selectLimit&&selectLimit.value!==String(stockHistoryLimit)){
        selectLimit.value=String(stockHistoryLimit);
      }

      const rows=displayed.map(entry=>{
        const product=data.products.find(p=>p.sku===entry.sku);
        const when=entry.at||entry.archivedAt||entry.date;
        const delta=entry.delta??(entry.previous==null?null:Number(entry.physical)-Number(entry.previous));
        const deltaHtml=delta==null?'<span class="panel-subtitle">—</span>':(delta>0?`<strong style="color:var(--green,#177245)">+${delta.toLocaleString('id-ID')} unit</strong>`:(delta<0?`<strong style="color:var(--red,#c53030)">${delta.toLocaleString('id-ID')} unit</strong>`:'<span class="panel-subtitle">0 unit</span>'));
        return `<tr>
          <td>${esc(when?new Date(when).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'—')}</td>
          <td><strong>${esc(product?.name||entry.sku||'—')}</strong><div class="panel-subtitle">${esc(entry.sku||'')}</div></td>
          <td>${entry.previous==null?'<span class="panel-subtitle">Saldo awal</span>':Number(entry.previous).toLocaleString('id-ID')+' unit'}</td>
          <td><strong>${Number(entry.physical??0).toLocaleString('id-ID')} unit</strong></td>
          <td>${deltaHtml}</td>
          <td>${esc(entry.actor||'Nama petugas belum tercatat')}</td>
          <td><span class="sku">${esc(entry.source||'Belum dicatat')}</span></td>
        </tr>`;
      });

      const bodyEl=panel.querySelector('#stockHistoryBody');
      if(bodyEl){
        bodyEl.innerHTML=rows.length?rows.join(''):`<tr><td colspan="7"><div class="empty-state"><strong>Tidak ada riwayat perubahan yang cocok</strong><span>Coba kata kunci pencarian lain atau tampilkan semua data.</span></div></td></tr>`;
      }
    };

    const isAll=stockHistoryLimit==='all';
    panel.innerHTML=`<div class="table-toolbar stock-history-toolbar">
      <div>
        <div class="panel-title">Riwayat perubahan stok gudang</div>
        <div class="panel-subtitle" id="stockHistorySubtitle">Memuat riwayat perubahan stok…</div>
      </div>
      <div class="toolbar-right stock-history-actions">
        <div class="search stock-history-search">
          <svg class="table-search-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.6"></circle><path d="m10.2 10.2 3.1 3.1"></path></svg>
          <input id="stockHistorySearch" type="search" placeholder="Cari SKU, produk, petugas..." value="${esc(stockHistoryQuery)}" aria-label="Cari riwayat perubahan stok" />
        </div>
        <select id="stockHistoryLimit" class="filter-select" aria-label="Jumlah riwayat yang ditampilkan">
          <option value="10"${stockHistoryLimit===10?' selected':''}>10 data (Persempit)</option>
          <option value="25"${stockHistoryLimit===25?' selected':''}>25 data</option>
          <option value="50"${stockHistoryLimit===50?' selected':''}>50 data</option>
          <option value="100"${stockHistoryLimit===100?' selected':''}>100 data</option>
          <option value="all"${stockHistoryLimit==='all'?' selected':''}>Semua data (${allEntries.length.toLocaleString('id-ID')})</option>
        </select>
        <button type="button" class="btn btn-light btn-small" id="stockHistoryToggleAll">${isAll?'Persempit ke 10':`Lihat semua (${allEntries.length.toLocaleString('id-ID')})`}</button>
        <button type="button" class="btn btn-light btn-small" id="stockHistoryExport" title="Ekspor riwayat perubahan stok ke Excel">Ekspor Excel</button>
      </div>
    </div>
    <div class="table-wrap stock-history-wrap">
      <table class="stock-history-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Produk / SKU</th>
            <th>Saldo sebelum</th>
            <th>Saldo sesudah</th>
            <th>Perubahan</th>
            <th>Petugas</th>
            <th>Sumber</th>
          </tr>
        </thead>
        <tbody id="stockHistoryBody"></tbody>
      </table>
    </div>`;

    container.append(panel);
    updateTable();

    const searchInput=panel.querySelector('#stockHistorySearch');
    searchInput?.addEventListener('input',e=>{
      stockHistoryQuery=e.target.value;
      updateTable();
    });

    const limitSelect=panel.querySelector('#stockHistoryLimit');
    limitSelect?.addEventListener('change',e=>{
      stockHistoryLimit=e.target.value==='all'?'all':Number(e.target.value);
      updateTable();
    });

    const toggleBtn=panel.querySelector('#stockHistoryToggleAll');
    toggleBtn?.addEventListener('click',()=>{
      stockHistoryLimit=(stockHistoryLimit==='all'?10:'all');
      updateTable();
    });

    const exportBtn=panel.querySelector('#stockHistoryExport');
    exportBtn?.addEventListener('click',()=>{
      exportStockHistoryCsv(getFilteredEntries());
    });
  }

  const renderBeforeStatus=render;
  render=function(){
    data.invoices.forEach(x=>x.status=invoiceStatus(x));
    renderBeforeStatus();
    if(current==='inventory'){
      renderStockHistoryPanel();
    }
    if(current==='settings'){
      const rows=data.audit.slice(-12).reverse().map(x=>'<tr><td>'+esc(new Date(x.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))+'</td><td>'+esc(x.actor)+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.entity)+' · '+esc(x.entityId)+'</td><td>'+esc(JSON.stringify(x.details||{}))+'</td></tr>');
      const panel=document.createElement('article');panel.className='card table-card';panel.style.marginTop='15px';panel.innerHTML='<div class="table-toolbar"><div><div class="panel-title">Riwayat perubahan lokal</div><div class="panel-subtitle">Catatan transaksi yang tersimpan di browser ini · '+data.audit.length+' entri</div></div></div>'+table(['Waktu','Aktor','Aksi','Objek','Rincian'],rows,'Belum ada catatan audit.');$('#pageContent').append(panel);
    }
    if(current==='returns'){
      const header=$('#pageContent thead tr');if(header&&!header.textContent.includes('Tindakan'))header.insertAdjacentHTML('beforeend','<th>Tindakan</th>');
      data.returns.forEach(x=>{const row=$$('#pageContent tbody tr').find(tr=>tr.textContent.includes(x.id));if(!row)return;const received=x.status==='Diterima'?Number(x.qty):Number(x.receivedQty||0);if(row.cells[4])row.cells[4].textContent=received+' / '+x.qty+' unit';if(x.status==='Menunggu konfirmasi cabang'){row.lastElementChild.innerHTML=portalRole==='warehouse'?'<span class=\"panel-subtitle\">Menunggu pengiriman cabang</span>':'<button class=\"link-btn\" data-action=\"confirm-return-dispatch\" data-id=\"'+esc(x.id)+'\">Konfirmasi dikirim</button>'}else if(['Dalam perjalanan','Partial'].includes(x.status)){row.lastElementChild.innerHTML=portalRole==='warehouse'?'<button class=\"link-btn\" data-action=\"confirm-return-receipt\" data-id=\"'+esc(x.id)+'\">Verifikasi terima</button>':'<span class=\"panel-subtitle\">Menunggu verifikasi gudang</span>'}else row.lastElementChild.textContent='—'});
    }
  };
  function confirmReturnReceipt(id){
    activeAction={action:'confirm-return-receipt',id};
    try{openModal('Verifikasi penerimaan retur',[],()=>{},{})}finally{activeAction=null}
  }
  chart=function(){
    const end=new Date(today+'T00:00:00+07:00'),starts=[],monthly=chartPeriod==='month';
    for(let i=5;i>=0;i--){const d=new Date(end);if(monthly){d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-i);}else d.setUTCDate(d.getUTCDate()-i*7);starts.push(jakartaDate(d));}
    const values=starts.map(start=>{if(monthly){const month=start.slice(0,7);return data.sales.filter(s=>(!s.status||s.status==='Disetujui')&&(s.end||s.start||'').slice(0,7)===month).reduce((n,s)=>n+Number(s.net||0),0)}const next=new Date(start+'T00:00:00+07:00');next.setUTCDate(next.getUTCDate()+7);const stop=jakartaDate(next);return data.sales.filter(s=>(!s.status||s.status==='Disetujui')&&s.end>=start&&s.end<stop).reduce((n,s)=>n+Number(s.net||0),0)});
    const max=Math.max(...values,0),scale=max||1,pts=values.map((v,i)=>({x:48+i*125,y:170-v/scale*122}));
    const path=pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),area=path+' L'+pts[5].x+' 184 L'+pts[0].x+' 184 Z';
    const labels=starts.map(s=>new Date(s+'T00:00:00+07:00').toLocaleDateString('id-ID',monthly?{month:'short',timeZone:'Asia/Jakarta'}:{day:'2-digit',month:'short',timeZone:'Asia/Jakarta'}));
    const dots=pts.map(p=>'<circle class="chart-dot" cx="'+p.x+'" cy="'+p.y+'" r="3"/>').join('');
    return '<div class="chart-wrap"><svg viewBox="0 0 700 220" preserveAspectRatio="none" role="img" aria-label="Penjualan bersih enam '+(monthly?'bulan':'minggu')+' terakhir"><line class="chart-grid" x1="38" y1="43" x2="695" y2="43"/><line class="chart-grid" x1="38" y1="88" x2="695" y2="88"/><line class="chart-grid" x1="38" y1="133" x2="695" y2="133"/><line class="chart-grid" x1="38" y1="178" x2="695" y2="178"/><text class="chart-label" x="0" y="39">'+(max?money(max):'Rp 0')+'</text><text class="chart-label" x="0" y="182">Rp 0</text>'+(values.some(Boolean)?'<path class="chart-area" d="'+area+'"/><path class="chart-line" d="'+path+'"/>'+dots:'<text class="chart-label" x="235" y="105">Belum ada penjualan pada enam '+(monthly?'bulan':'minggu')+' ini</text>')+labels.map((label,i)=>'<text class="chart-label" x="'+(pts[i].x-18)+'" y="210">'+label+'</text>').join('')+'</svg></div><div class="chart-legend"><span><i class="legend-dot"></i>Penjualan bersih · '+(monthly?'6 bulan':'6 minggu')+'</span></div>';
  };
  function previewProductPhoto(trigger){let dialog=$('#productPhotoViewer');if(!dialog){dialog=document.createElement('dialog');dialog.id='productPhotoViewer';dialog.className='product-photo-viewer';dialog.setAttribute('aria-label','Pratinjau foto produk');dialog.innerHTML='<form method="dialog"><button class="product-photo-viewer-close" aria-label="Tutup pratinjau">×</button></form><figure><img alt=""><figcaption></figcaption></figure>';document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})}const image=dialog.querySelector('img'),caption=dialog.querySelector('figcaption');image.src=trigger.dataset.photoSrc;image.alt=`${trigger.dataset.photoName||'Foto produk'} · ${trigger.dataset.photoSku||''}`;caption.textContent=`${trigger.dataset.photoName||'Produk'} · SKU ${trigger.dataset.photoSku||'—'}`;if(!dialog.open)dialog.showModal()}
  document.addEventListener('click',e=>{if(e.target.id==='paperclipPopup'){closePaperclipPopup();return}const photo=e.target.closest('[data-action="preview-product-photo"]');if(photo){e.preventDefault();previewProductPhoto(photo);return}const warehouseTab=e.target.closest('[data-warehouse-tab]');
    if(warehouseTab){
      e.preventDefault();
      warehouseDispatchTab=warehouseTab.dataset.warehouseTab;
      if(current!=='warehouse') go('warehouse');
      else {
        render();
        const target=document.querySelector('.warehouse-dispatches');
        if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
      }
      return;
    }
    const salesTabEl=e.target.closest('[data-sales-tab]');
    if(salesTabEl){
      e.preventDefault();
      salesViewTab=salesTabEl.dataset.salesTab;
      render();
      return;
    }
    const scrollToReconciliation=e.target.closest('[data-action="scroll-to-sku-reconciliation"]');
    if(scrollToReconciliation){
      e.preventDefault();
      if(salesViewTab==='waybills'){
        salesViewTab='all';
        render();
      }
      const target=document.querySelector('.sales-sku-reconciliation')||document.querySelector('.excel-source-note');
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
      if(scrollToReconciliation.dataset.poId){
        const searchInput=document.querySelector('#tableSearch');
        if(searchInput){
          searchInput.value=scrollToReconciliation.dataset.poId;
          searchInput.dispatchEvent(new Event('input'));
        }
      }
      return;
    }
    let nav=e.target.closest('[data-page]');
    if(nav){
      try{
        if(nav.dataset.warehouseTab){
          warehouseDispatchTab=nav.dataset.warehouseTab;
        }
        go(nav.dataset.page);
      }catch(error){
        console.error(`Navigasi ${nav.dataset.page} gagal:`,error);
        toast('Halaman gagal dibuka. Muat ulang aplikasi lalu coba kembali.');
      }
      return;
    }let el=e.target.closest('[data-action]');if(el){if(el.dataset.action==='reload-page'){render();return}if(el.dataset.action==='print-waybill'&&el.dataset.dispatchIndex!==undefined){if(current!=='warehouse'&&current!=='sales'&&current!=='sales-history')return toast('Surat jalan hanya dapat dicetak dari halaman Gudang atau Penjualan.');openWaybillPrintOptions(el.dataset.id,Number(el.dataset.dispatchIndex));return}if(el.dataset.action==='edit-store'){closePaperclipPopup();if($('#modalBackdrop').classList.contains('open'))closeModal()}doAction(el.dataset.action,el.dataset.id,el);return}});
  document.addEventListener('input',e=>{if(e.target.id!=='paperclipBranchSearch')return;const term=e.target.value.trim().toLocaleLowerCase('id-ID');document.querySelectorAll('#paperclipBranchList .paperclip-branch-row').forEach(row=>{row.hidden=!row.dataset.branchSearch.includes(term)})});
  document.addEventListener('change',async e=>{const input=e.target;if(input.id!=='backupImportInput')return;const file=input.files?.[0];if(!file)return;try{if(file.size>20*1024*1024)throw new Error('Backup terlalu besar');const restored=JSON.parse(await file.text()),keys=['products','stores','shipments','sales','invoices','returns','branchStock','counts','countHistory','audit'];if(!restored||keys.some(key=>!Array.isArray(restored[key]))||restored.products.some(x=>!x||typeof x.sku!=='string')||restored.stores.some(x=>!x||typeof x.code!=='string')||restored.shipments.some(x=>!x||typeof x.id!=='string'||!Array.isArray(x.items)))throw new Error('Invalid Howell backup');if(!confirm(`Pulihkan ${restored.products.length} SKU, ${restored.stores.length} cabang, dan ${restored.shipments.length} PO dari file ini? Data lokal saat ini akan diganti; salinan lokal akan dibuat terlebih dahulu.`))return;const old=localStorage.getItem(KEY);if(old)localStorage.setItem(KEY+'-pre-restore-'+Date.now(),old);localStorage.setItem(KEY,JSON.stringify(restored));data={...structuredClone(initial),...restored};render();toast('Cadangan berhasil dipulihkan.')}catch(error){console.error('Pemulihan cadangan gagal:',error);toast('Cadangan tidak dapat dipulihkan. Periksa format JSON dan ruang penyimpanan browser.')}finally{input.value=''}});
  initLanguageSwitcher();
  $('#modalClose').onclick=closeModal;$('#modalCancel').onclick=closeModal;$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop')&&!e.currentTarget.classList.contains('po-create-workspace'))closeModal()});$('#modalForm').addEventListener('submit',e=>{e.preventDefault();if(syncEnabled&&(!syncReady||syncBlocked))return toast(syncBlocked?'Sinkronisasi terkunci karena konflik data. Muat ulang dan tinjau data server sebelum melanjutkan.':'Database VPS belum siap. Perubahan dinonaktifkan agar tidak hanya tersimpan di browser.');if(!modalMode)return;const missing=[...(e.currentTarget.querySelectorAll?.('.searchable-product-select')||[])].find(w=>w.querySelector('input').required&&!w.querySelector('select').value);if(missing){toast('Pilih produk dari hasil pencarian nama atau SKU.');missing.querySelector('input').focus();return}let values=Object.fromEntries(new FormData(e.currentTarget).entries());modalMode.submit(values)});$('#menuToggle').onclick=()=>{$('#sidebar').classList.add('open');$('#overlay').classList.add('show')};$('#closeMenu').onclick=$('#overlay').onclick=()=>{$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show')};$('#notificationButton').onclick=()=>toast('Tidak ada notifikasi baru.');// filterButton replaced with language switcher$('#globalSearchSubmit').addEventListener('click',runGlobalSearch);$('#globalSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runGlobalSearch()}});$('#topPeriod').addEventListener('change',e=>{chartPeriod=e.currentTarget.value;if(current==='dashboard')render()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closePaperclipPopup()}});
  function removeUntitledColumn(){document.querySelectorAll('.excel-catalog table').forEach(table=>{const header=[...table.querySelectorAll('thead th')].findIndex(cell=>/^Kolom F(?:\s*\(tanpa judul\))?$/i.test(cell.textContent.trim())||cell.title==='Kolom F');if(header<0)return;table.querySelectorAll('tr').forEach(row=>{if(row.children[header])row.children[header].remove()})})}
  new MutationObserver(removeUntitledColumn).observe($('#pageContent'),{childList:true,subtree:true});removeUntitledColumn();
  let barcodeCameraStream=null,barcodeCameraFrame=null;
  function normalizeBarcode(value){return String(value||'').replace(/\D/g,'')}
  function validEan13(value){const code=normalizeBarcode(value);if(!/^\d{13}$/.test(code))return false;let total=0;for(let index=0;index<12;index++)total+=Number(code[index])*(index%2?3:1);return(10-total%10)%10===Number(code[12])}
  function stopBarcodeCamera(){if(barcodeCameraFrame)cancelAnimationFrame(barcodeCameraFrame);barcodeCameraFrame=null;if(barcodeCameraStream)barcodeCameraStream.getTracks().forEach(track=>track.stop());barcodeCameraStream=null;const video=$('#barcodeScannerVideo');if(video){video.pause();video.srcObject=null}}
  function openBarcodeScanner(){const dialog=$('#barcodeScanner');if(!dialog)return;const input=$('#barcodeScannerInput'),status=$('#barcodeScannerStatus');stopBarcodeCamera();input.value='';status.textContent='Siapkan scanner USB atau ketik 13 digit barcode produk.';status.classList.remove('is-error');if(!dialog.open)dialog.showModal();setTimeout(()=>input.focus(),80)}
  function findBarcodeProduct(code){const needle=normalizeBarcode(code);return data.products.find(product=>normalizeBarcode(product.barcode)===needle)||source.products.find(product=>normalizeBarcode(product.barcode)===needle)}
  function lookupBarcode(){const input=$('#barcodeScannerInput'),status=$('#barcodeScannerStatus'),code=normalizeBarcode(input.value);if(!validEan13(code)){status.textContent='Masukkan barcode EAN-13 yang valid (13 digit).';status.classList.add('is-error');input.focus();return}const product=findBarcodeProduct(code);if(!product){status.textContent='Barcode tidak ditemukan di katalog produk Howell.';status.classList.add('is-error');return}stopBarcodeCamera();$('#barcodeScanner').close();go('inventory');setTimeout(()=>{const search=$('#tableSearch');if(search){search.value=product.sku;search.dispatchEvent(new Event('input'));const row=[...document.querySelectorAll('tbody tr')].find(item=>item.textContent.includes(product.sku));row?.scrollIntoView({block:'center',behavior:'smooth'})}toast(`${product.sku} · ${product.name} ditemukan.`)},60)}
  async function startBarcodeCamera(){const status=$('#barcodeScannerStatus'),video=$('#barcodeScannerVideo');if(!('BarcodeDetector'in window)||!navigator.mediaDevices?.getUserMedia){status.textContent='Kamera scanner belum didukung browser ini. Gunakan scanner USB atau masukkan kode EAN-13.';status.classList.add('is-error');return}try{stopBarcodeCamera();barcodeCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});video.srcObject=barcodeCameraStream;await video.play();status.textContent='Arahkan kamera ke barcode EAN-13.';status.classList.remove('is-error');const detector=new BarcodeDetector({formats:['ean_13']});const read=async()=>{if(!barcodeCameraStream)return;try{const result=await detector.detect(video),code=result[0]?.rawValue;if(code){$('#barcodeScannerInput').value=code;lookupBarcode();return}}catch(error){console.warn('Pembacaan barcode kamera gagal:',error)}barcodeCameraFrame=requestAnimationFrame(read)};barcodeCameraFrame=requestAnimationFrame(read)}catch(error){status.textContent='Kamera tidak dapat diakses. Periksa izin kamera lalu coba lagi.';status.classList.add('is-error')}}
  $('#barcodeScanOpen')?.addEventListener('click',openBarcodeScanner);$('#barcodeScannerLookup')?.addEventListener('click',lookupBarcode);$('#barcodeScannerInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookupBarcode()}});$('#barcodeCameraStart')?.addEventListener('click',startBarcodeCamera);$('#barcodeScanner')?.addEventListener('close',stopBarcodeCamera);$('#barcodeScanner')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
  document.addEventListener('click',event=>{const trigger=event.target.closest('[data-action="barcode-scan"]');if(trigger){event.preventDefault();openBarcodeScanner()}});
  $('#barcodeCameraStart')?.addEventListener('click',()=>{let attempts=0;const reveal=()=>{if(barcodeCameraStream){$('#barcodeCameraFrame').hidden=false;return}if(++attempts<12)setTimeout(reveal,200)};setTimeout(reveal,80)});$('#barcodeScanner')?.addEventListener('close',()=>{$('#barcodeCameraFrame').hidden=true});
  // Purchase Order memakai nama perusahaan jaringan, bukan nama cabang, pada field yang tampil ke pengguna.
  const poCompanyObserver=new MutationObserver(()=>{
    const fields=$('#modalFields');
    if(!fields||!fields.querySelector('.po-editor'))return;
    const labels=[...fields.querySelectorAll('label')];
    const branchLabel=labels.find(item=>item.textContent.trim().startsWith('Cabang retail / customer'));
    const label=labels.find(item=>item.textContent.trim().startsWith('Nama customer'));
    const input=fields.querySelector('#poCustomerName');
    if(branchLabel)branchLabel.childNodes[0].nodeValue='Cabang retail';
    if(!label||!input)return;
    label.childNodes[0].nodeValue='Nama perusahaan';
    // Nama perusahaan adalah data PO yang boleh disesuaikan; jangan dibuat
    // read-only seperti snapshot nama cabang.
    input.readOnly=false;
    input.removeAttribute('readonly');
    input.name='poCustomerName';
    const branch=data.stores.find(item=>item.code===$('#poStore')?.value);
    const company=branch?.network||'Paperclip';
    // Jangan menimpa teks yang sedang diedit pengguna ketika observer
    // terpanggil karena perubahan DOM lain di dalam form.
    if(document.activeElement!==input && input.value!==company)input.value=company;
  });
  poCompanyObserver.observe(document.body,{childList:true,subtree:true});
  const sidebarToggle=$('#sidebarToggle'),sidebar=$('#sidebar');
  sidebarToggle.addEventListener('click',()=>{const collapsed=sidebar.classList.toggle('collapsed');sidebarToggle.setAttribute('aria-expanded',String(!collapsed));sidebarToggle.setAttribute('aria-label',collapsed?'Perluas menu':'Ciutkan menu');sidebarToggle.title=collapsed?'Perluas menu':'Ciutkan menu'});
  if(syncEnabled){render();connectSharedDatabase().then(()=>{if(recoveryNotice)toast(recoveryNotice)});window.addEventListener('focus',()=>syncReady?refreshSharedDatabase():connectSharedDatabase({quiet:true}));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(syncReady)refreshSharedDatabase();else connectSharedDatabase({quiet:true})}});setInterval(()=>syncReady?refreshSharedDatabase():connectSharedDatabase({quiet:true}),15000);}else{connectSharedDatabase();if(recoveryNotice)toast(recoveryNotice)}
})();

