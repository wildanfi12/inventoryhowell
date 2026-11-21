'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsPath = path.join(root, 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. Add missing translations to I18N
const idExtra = `      "field_payment_terms": "Termin pembayaran",
      "field_agreement_status": "Status perjanjian",
      "field_uom": "Satuan unit (UOM)",
      "field_status": "Status",
      "field_store_type": "Tipe toko",
      "field_paperclip_branch": "Cabang Paperclip",
      "field_return_reason": "Alasan retur",
      "field_item_condition": "Kondisi barang",
      "field_other_store_name": "Nama toko / cabang lain",
      "select_placeholder": "Pilih...",
      "opt_monthly": "Bulanan",
      "opt_14_days": "14 hari",
      "opt_biweekly": "Bi-weekly (2 minggu)",
      "opt_agreement_needed": "Perlu perjanjian",
      "opt_active": "Aktif",
      "opt_suspended": "Ditangguhkan",
      "opt_terminated": "Berakhir",
      "opt_pcs": "Pcs",
      "opt_set": "Set",
      "opt_box": "Box",
      "opt_pack": "Pack",\n`;

const enExtra = `      "field_payment_terms": "Payment Terms",
      "field_agreement_status": "Agreement Status",
      "field_uom": "Unit of Measure (UOM)",
      "field_status": "Status",
      "field_store_type": "Store Type",
      "field_paperclip_branch": "Paperclip Branch",
      "field_return_reason": "Return Reason",
      "field_item_condition": "Item Condition",
      "field_other_store_name": "Other Store Name",
      "select_placeholder": "Select...",
      "opt_monthly": "Monthly",
      "opt_14_days": "14 Days",
      "opt_biweekly": "Bi-weekly (14 days)",
      "opt_agreement_needed": "Agreement Needed",
      "opt_active": "Active",
      "opt_suspended": "Suspended",
      "opt_terminated": "Terminated",
      "opt_pcs": "Pcs",
      "opt_set": "Set",
      "opt_box": "Box",
      "opt_pack": "Pack",\n`;

const zhExtra = `      "field_payment_terms": "结算账期",
      "field_agreement_status": "协议合作状态",
      "field_uom": "计量单位 (UOM)",
      "field_status": "状态",
      "field_store_type": "门店类型",
      "field_paperclip_branch": "Paperclip 网点",
      "field_return_reason": "退货原因",
      "field_item_condition": "商品状况",
      "field_other_store_name": "其他门店名称",
      "select_placeholder": "请选择...",
      "opt_monthly": "按月结算",
      "opt_14_days": "14天账期",
      "opt_biweekly": "双周结算",
      "opt_agreement_needed": "需签署协议",
      "opt_active": "合作中 (正常)",
      "opt_suspended": "已暂停",
      "opt_terminated": "已终止",
      "opt_pcs": "件 (Pcs)",
      "opt_set": "套 (Set)",
      "opt_box": "盒 (Box)",
      "opt_pack": "包 (Pack)",\n`;

// Inject into I18N.id before "field_branch_code"
if (!appJs.includes('"field_payment_terms"')) {
  appJs = appJs.replace('"field_branch_code": "Kode cabang",', idExtra + '      "field_branch_code": "Kode cabang",');
  appJs = appJs.replace('"field_branch_code": "Branch Code",', enExtra + '      "field_branch_code": "Branch Code",');
  appJs = appJs.replace('"field_branch_code": "网点代码",', zhExtra + '      "field_branch_code": "网点代码",');
}

// 2. Replace openModal with fixed implementation
const oldOpenModalStart = 'function openModal(title, fields, submit, initialValues = {}) {';
const oldOpenModalEnd = '  function closeModal(){';
const startIdx = appJs.indexOf(oldOpenModalStart);
const endIdx = appJs.indexOf(oldOpenModalEnd);

if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not locate openModal block in app.js');
}

const newOpenModal = `function openModal(title, fields, submit, initialValues = {}) {
    $('#modalSubmit').style.display = '';
    modalMode = { submit, initialValues };

    // 1. Translate title
    let trTitle = title;
    const cleanTitle = String(title || '').trim().toLowerCase();
    const modalTitleMap = {
      'pilih ukuran kertas': 'print_modal_title',
      'siapkan barang untuk surat jalan': 'modal_prepare_waybill',
      'edit purchase order': 'modal_edit_po',
      'buat purchase order': 'modal_create_po',
      'buat invoice periode': 'modal_create_period_invoice',
      'konfirmasi retur dikirim': 'modal_confirm_return_sent',
      'edit produk': 'modal_edit_product',
      'tambah produk': 'modal_add_product',
      'edit cabang': 'modal_edit_branch',
      'tambah cabang': 'modal_add_branch',
      'buat pengiriman konsinyasi': 'modal_create_consignment',
      'konfirmasi penerimaan & grn': 'modal_confirm_grn',
      'catat rekonsiliasi penjualan': 'modal_record_recon',
      'buat tagihan konsinyasi': 'modal_create_invoice',
      'catat pembayaran tagihan': 'modal_record_payment',
      'catat retur / penarikan': 'modal_record_return',
      'opname awal stok cabang': 'modal_branch_initial_count',
      'opname stok cabang': 'modal_branch_stocktake',
      'perbarui stok': 'modal_update_stock',
      'mulai opname stok': 'modal_start_stocktake',
      'verifikasi penerimaan retur': 'modal_verify_return',
      'perbarui status purchase order': 'modal_update_po_status'
    };
    if (modalTitleMap[cleanTitle]) {
      trTitle = t(modalTitleMap[cleanTitle], title);
    } else if (cleanTitle.startsWith('ubah status pengiriman & penjualan')) {
      const parts = title.split('·');
      trTitle = t('modal_change_status_title', 'Ubah status pengiriman & penjualan') + (parts[1] ? ' · ' + parts[1].trim() : '');
    } else if (cleanTitle.startsWith('perbarui stok')) {
      const parts = title.split('·');
      trTitle = t('modal_update_stock_title', 'Perbarui stok') + (parts[1] ? ' · ' + parts[1].trim() : '');
    } else if (cleanTitle.startsWith('edit produk')) {
      const parts = title.split('·');
      trTitle = t('modal_edit_product', 'Edit produk') + (parts[1] ? ' · ' + parts[1].trim() : '');
    }

    $('#modalTitle').textContent = trTitle;
    $('#modalClose').textContent = t('close', 'Tutup');
    $('#modalCancel').textContent = t('cancel', 'Batal');
    if ($('#modalEyebrow')) {
      if (cleanTitle.includes('cetak') || cleanTitle.includes('kertas') || cleanTitle.includes('print')) {
        $('#modalEyebrow').textContent = t('print_modal_eyebrow', 'PILIHAN CETAK');
      } else if (cleanTitle.includes('surat jalan') || cleanTitle.includes('pengeluaran')) {
        $('#modalEyebrow').textContent = t('wh_dispatch_eyebrow', 'PENGELUARAN GUDANG');
      } else if (cleanTitle.includes('status')) {
        $('#modalEyebrow').textContent = t('update_status_eyebrow', 'PERBARUI STATUS');
      } else {
        $('#modalEyebrow').textContent = t('form_eyebrow', 'FORMULIR');
      }
    }
    if ($('#modalSubmit')) {
      if (cleanTitle.includes('cetak') || cleanTitle.includes('kertas') || cleanTitle.includes('print')) {
        $('#modalSubmit').textContent = t('print_waybill', 'Cetak surat jalan');
      } else if (cleanTitle.includes('ajukan') || cleanTitle.includes('submit')) {
        $('#modalSubmit').textContent = t('btn_submit_po', 'Ajukan');
      } else if (cleanTitle.includes('surat jalan')) {
        $('#modalSubmit').textContent = t('prepare_waybill', 'Buat surat jalan');
      } else if (cleanTitle.includes('edit') || cleanTitle.includes('perbarui')) {
        $('#modalSubmit').textContent = t('save_changes', 'Simpan perubahan');
      } else {
        $('#modalSubmit').textContent = t('save_data', 'Simpan data');
      }
    }

    // 2. Comprehensive Field Label & Option Translation Map
    const fieldLabelMap = {
      'nomor invoice': 'field_invoice_no',
      'catatan invoice': 'field_invoice_notes',
      'referensi surat jalan retur': 'field_return_waybill_ref',
      'catatan': 'field_notes',
      'catatan status (opsional)': 'field_status_notes_opt',
      'kode sku': 'field_sku_code',
      'barcode retail / ean': 'field_barcode',
      'nama produk': 'field_prod_name',
      'spesifikasi / varian': 'field_spec_variant',
      'kategori': 'field_category',
      'brand': 'field_brand',
      'hpp (rp)': 'field_hpp_val',
      'hpp + 10% (rp)': 'field_hpp_plus',
      'harga srp / het (rp)': 'field_srp_val',
      'margin retail (%)': 'field_retail_margin',
      'saldo stok awal': 'field_initial_stock_bal',
      'stok pusat awal': 'field_central_initial_stock',
      'kode cabang': 'field_branch_code',
      'kode cabang / kode cabang': 'field_branch_code',
      'nama cabang': 'field_branch_name',
      'jaringan retail': 'field_retail_network',
      'region / wilayah': 'field_region',
      'alamat lengkap': 'field_full_address',
      'alamat pengiriman': 'field_shipping_address',
      'alamat': 'field_full_address',
      'narahubung': 'field_contact_person',
      'pic toko': 'field_store_pic',
      'nomor telepon': 'field_phone_no',
      'no. telepon': 'field_phone_short',
      'telepon': 'field_phone_short',
      'email operasional': 'field_operational_email',
      'termin pembayaran': 'field_payment_terms',
      'term': 'field_payment_terms',
      'porsi howell (%)': 'field_howell_share',
      'porsi paperclip (%)': 'field_paperclip_share_pct',
      'porsi paperclip (rp)': 'field_paperclip_share_val',
      'tanggal mulai berlaku': 'field_effective_date',
      'status perjanjian': 'field_agreement_status',
      'agreementstatus': 'field_agreement_status',
      'kapasitas maksimal rak': 'field_max_shelf_cap',
      'nomor po konsinyasi': 'field_po_num',
      'kuantitas kirim': 'field_dispatch_qty',
      'catatan pengiriman': 'field_dispatch_notes',
      'nama penerima': 'field_recipient_name',
      'nomor / referensi bukti grn': 'field_grn_ref',
      'jumlah unit diterima (parsial)': 'field_partial_units_received',
      'nomor rekonsiliasi': 'field_recon_no',
      'stok awal periode': 'field_period_opening_stock',
      'stok masuk periode': 'field_period_inbound_stock',
      'retur terkonfirmasi periode': 'field_period_confirmed_returns',
      'stok fisik akhir': 'field_period_ending_physical',
      'diskon retail (rp)': 'field_retail_discount_val',
      'catatan / referensi laporan cabang': 'field_branch_report_ref',
      'nomor tagihan': 'field_billing_no',
      'total omset bersih (rp)': 'field_net_turnover',
      'komisi / margin retail (%)': 'field_retail_commission_pct',
      'referensi laporan sales': 'field_sales_report_ref',
      'jumlah pembayaran (rp)': 'field_payment_val',
      'referensi / bukti transfer': 'field_payment_ref',
      'sisa net payout': 'field_remaining_net_payout',
      'nomor berita acara rma': 'field_rma_no',
      'nama cabang / pelanggan': 'field_branch_cust_name',
      'kuantitas ditarik': 'field_withdrawn_qty',
      'catatan kondisi barang': 'field_item_condition_notes',
      'jumlah fisik hasil hitung': 'field_physical_counted_qty',
      'catatan opname': 'field_stocktake_notes',
      'nama petugas yang memperbarui stok': 'field_operator_name',
      'nomor surat jalan / do': 'field_waybill_do_no',
      'jumlah benar-benar diterima': 'field_actual_received_qty',
      'petugas gudang': 'field_wh_officer',
      'catatan pemeriksaan': 'field_inspection_notes',
      'ukuran kertas': 'field_paper_size',
      'satuan unit': 'field_uom',
      'satuan unit (uom)': 'field_uom',
      'uom': 'field_uom',
      'status': 'field_status',
      'tipe toko': 'field_store_type',
      'storetype': 'field_store_type',
      'cabang paperclip': 'field_paperclip_branch',
      'storebranch': 'field_paperclip_branch',
      'alasan retur': 'field_return_reason',
      'reason': 'field_return_reason',
      'kondisi barang': 'field_item_condition',
      'condition': 'field_item_condition',
      'nama toko / cabang lain': 'field_other_store_name',
      'otherstore': 'field_other_store_name'
    };

    const hintMap = {
      'id unik produk di gudang pusat': 'hint_unique_sku',
      'untuk status partial, masukkan unit yang diterima.': 'hint_partial_units',
      'gunakan stok akhir periode sebelumnya atau hasil opname.': 'hint_recon_opening',
      'jumlah unit yang sudah diterima cabang pada periode ini.': 'hint_recon_inbound'
    };

    const translateFieldLabel = (raw) => {
      if (!raw) return '';
      const clean = String(raw).trim().toLowerCase();
      const k = fieldLabelMap[clean];
      return k ? t(k, raw) : raw;
    };

    const translateOptionLabel = (val, raw) => {
      if (!raw) return raw;
      if (raw.includes('Continuous Form')) return t('paper_continuous', 'Continuous Form · 9,5 × 5,5 inci');
      if (raw.includes('A4') || raw.includes('Faktur')) return t('paper_a4', 'A4 (210 × 297 mm)');
      const optMap = {
        'bulanan': 'opt_monthly',
        '14 hari': 'opt_14_days',
        'bi-weekly': 'opt_biweekly',
        'perlu perjanjian': 'opt_agreement_needed',
        'aktif': 'opt_active',
        'ditangguhkan': 'opt_suspended',
        'berakhir': 'opt_terminated',
        'pcs': 'opt_pcs',
        'set': 'opt_set',
        'box': 'opt_box',
        'pack': 'opt_pack'
      };
      const clean = String(raw).trim().toLowerCase();
      if (optMap[clean]) return t(optMap[clean], raw);
      return translateStatus(raw);
    };

    $('#modalFields').innerHTML = '<div class="field-grid">' + fields.map(f => {
      const fieldName = f.name || '';
      let rawLabel = f.label;
      if (!rawLabel) {
        const fn = String(fieldName).toLowerCase();
        if (fn === 'term') rawLabel = 'Termin pembayaran';
        else if (fn === 'agreementstatus') rawLabel = 'Status perjanjian';
        else if (fn === 'uom') rawLabel = 'Satuan unit';
        else if (fn === 'store') rawLabel = 'Cabang retail';
        else if (fn === 'sku' || fn.startsWith('sku')) rawLabel = 'Produk / SKU';
        else if (fn === 'status') rawLabel = 'Status';
        else if (fn === 'storetype') rawLabel = 'Tipe toko';
        else if (fn === 'storebranch') rawLabel = 'Cabang Paperclip';
        else if (fn === 'reason') rawLabel = 'Alasan retur';
        else if (fn === 'condition') rawLabel = 'Kondisi barang';
        else if (fn === 'papersize') rawLabel = 'Ukuran kertas';
        else if (fn === 'otherstore') rawLabel = 'Nama toko / cabang lain';
        else rawLabel = fieldName;
      }
      const label = translateFieldLabel(rawLabel);
      const hint = f.hint ? (hintMap[String(f.hint).trim().toLowerCase()] ? t(hintMap[String(f.hint).trim().toLowerCase()], f.hint) : f.hint) : '';
      const required = f.required !== false;
      const isFull = f.full || f.type === 'textarea';
      const val = initialValues[f.name] ?? f.value ?? '';

      if (f.type === 'select') {
        const items = f.items || f.options || [];
        const opts = items.map(i => {
          const itemVal = typeof i === 'object' ? i.value : i;
          const itemLabel = typeof i === 'object' ? (i.label || i.value) : i;
          const trLabel = translateOptionLabel(itemVal, itemLabel);
          const sel = String(itemVal) === String(val) ? ' selected' : '';
          return '<option value="' + esc(itemVal) + '"' + sel + '>' + esc(trLabel) + '</option>';
        }).join('');
        return '<div class="field ' + (isFull ? 'full' : '') + '"><label for="f-' + f.name + '">' + esc(label) + (required ? ' *' : '') + '</label><select id="f-' + f.name + '" name="' + f.name + '" ' + (required ? 'required' : '') + '>' + opts + '</select>' + (hint ? '<small class="hint">' + esc(hint) + '</small>' : '') + '</div>';
      }
      if (f.type === 'textarea') {
        return '<div class="field ' + (isFull ? 'full' : '') + '"><label for="f-' + f.name + '">' + esc(label) + (required ? ' *' : '') + '</label><textarea id="f-' + f.name + '" name="' + f.name + '" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || '') + '" ' + (required ? 'required' : '') + '>' + esc(val) + '</textarea>' + (hint ? '<small class="hint">' + esc(hint) + '</small>' : '') + '</div>';
      }
      return '<div class="field ' + (isFull ? 'full' : '') + '"><label for="f-' + f.name + '">' + esc(label) + (required ? ' *' : '') + '</label><input type="' + (f.type || 'text') + '" id="f-' + f.name + '" name="' + f.name + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '" ' + (f.step ? 'step="' + f.step + '"' : '') + ' ' + (f.min != null ? 'min="' + f.min + '"' : '') + ' ' + (f.max != null ? 'max="' + f.max + '"' : '') + ' ' + (required ? 'required' : '') + ' />' + (hint ? '<small class="hint">' + esc(hint) + '</small>' : '') + '</div>';
    }).join('') + '</div>';

    Object.entries(initialValues).forEach(([k, v]) => {
      let el = $('#f-' + k) || document.getElementById('f-' + k);
      if (el) el.value = v;
    });
    enhanceProductSelects($('#modalFields'));
    $('#modalBackdrop').classList.add('open');
    setTimeout(() => $('#modalFields input:not([readonly]),#modalFields select')?.focus(), 40);
  }
`;

appJs = appJs.substring(0, startIdx) + newOpenModal + appJs.substring(endIdx);

// 3. Clean up 'Kode cabang / Kode cabang' in action === 'add-store' / 'edit-store'
appJs = appJs.replace(
  "text('code','Kode cabang / Kode cabang')",
  "text('code','Kode cabang')"
);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Updated app.js successfully!');

// 4. Update theme-light.css
const themeCssPath = path.join(root, 'theme-light.css');
let themeCss = fs.readFileSync(themeCssPath, 'utf8');

const modalCssBlock = `
/* ==========================================================================
   MODAL SCROLLABILITY & FIT OPTIMIZATION
   Ensures modal dialogs (Edit Cabang, Edit Produk, etc.) never overflow
   the screen viewport and action buttons (Simpan/Batal) are always accessible.
   ========================================================================== */
.modal-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1200 !important;
  display: none;
  align-items: center !important;
  justify-content: center !important;
  padding: clamp(10px, 2.5vh, 24px) 16px !important;
  background: rgba(18, 20, 23, 0.55) !important;
  overflow-y: auto !important;
  box-sizing: border-box !important;
}

.modal-backdrop.open {
  display: flex !important;
}

.modal {
  width: min(680px, calc(100vw - 32px)) !important;
  max-width: min(680px, calc(100vw - 32px)) !important;
  max-height: min(92vh, 860px) !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  border-radius: 12px !important;
  box-sizing: border-box !important;
}

.modal > header {
  flex: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 16px 20px !important;
  border-bottom: 1px solid #eceef0 !important;
  background: #fff !important;
}

.modal form, #modalForm {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  padding: 18px 20px !important;
  box-sizing: border-box !important;
}

.modal-fields {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding-right: 6px !important;
  margin-right: -4px !important;
}

.modal-actions {
  flex: none !important;
  display: flex !important;
  justify-content: flex-end !important;
  gap: 10px !important;
  margin-top: 14px !important;
  padding-top: 14px !important;
  border-top: 1px solid #eceef0 !important;
  background: #fff !important;
}

.field-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 12px 14px !important;
}

.field.full {
  grid-column: 1 / -1 !important;
}

@media (max-width: 600px) {
  .field-grid {
    grid-template-columns: 1fr !important;
  }
  .modal {
    width: calc(100vw - 20px) !important;
    max-width: calc(100vw - 20px) !important;
    max-height: calc(100dvh - 20px) !important;
  }
}
`;

if (!themeCss.includes('MODAL SCROLLABILITY & FIT OPTIMIZATION')) {
  themeCss += modalCssBlock;
  fs.writeFileSync(themeCssPath, themeCss, 'utf8');
  console.log('Updated theme-light.css successfully!');
}

// 5. Update styles.css
const stylesCssPath = path.join(root, 'styles.css');
let stylesCss = fs.readFileSync(stylesCssPath, 'utf8');
if (!stylesCss.includes('MODAL SCROLLABILITY & FIT OPTIMIZATION')) {
  stylesCss += modalCssBlock;
  fs.writeFileSync(stylesCssPath, stylesCss, 'utf8');
  console.log('Updated styles.css successfully!');
}

// 6. Bump cache versions in index.html
const indexHtmlPath = path.join(root, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
indexHtml = indexHtml.replace(/styles\.css\?v=[^"]+/g, 'styles.css?v=20261121-modal-fix-v4');
indexHtml = indexHtml.replace(/theme-light\.css\?v=[^"]+/g, 'theme-light.css?v=20261121-modal-fix-v4');
indexHtml = indexHtml.replace(/app\.js\?v=[^"]+/g, 'app.js?v=20261121-modal-fix-v4');
fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');

console.log('Updated index.html cache versions to 20261121-modal-fix-v4');
