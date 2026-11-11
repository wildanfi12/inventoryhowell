# Howell Inventory

Prototype aplikasi operasional konsinyasi Howell. Antarmuka, navigasi, warna, dan tata letak yang sudah ada dipertahankan. Pembaruan ini mengisi modul dengan data sumber yang diberikan dan menata alur operasional tanpa menganggap contoh lama sebagai data nyata.

## Data sumber yang dimuat

- `MASTER DRAFT 2026 10(1).xlsx`: seluruh 10 sheet, semua baris dan sel sumber dipertahankan untuk penelusuran. Katalog operasional memuat 362 SKU unik dari 363 baris produk; SKU ganda tetap ditandai agar varian tidak tercampur.
- `PRICELIST B2B TERBARU.xlsx`: seluruh 441 baris berisi dari sheet `PRODUCT LIST`, termasuk baris judul, header berulang, kolom kosong, nomor baris, dan rumus yang tersedia. Data harga dipasangkan ke SKU; harga yang belum valid dan SKU ambigu ditandai dan tidak dapat dipakai pada rekonsiliasi penjualan.
- `Daftar cabang toko Paperclip (1).pdf`: 19 cabang beserta kode dan wilayah yang tercantum. Dokumen tidak memuat kontak, alamat lengkap, kapasitas rak, tanggal berlaku, atau bukti perjanjian; bidang yang tidak ada dibiarkan kosong dan status perjanjian ditandai perlu dilengkapi.
- `Rancangan User Interface.pdf`: dipakai sebagai referensi alur modul. Tampilan website yang sudah ada tidak dirombak.

Harga operasional memakai nilai `HPP+10%` dan `PEMBULATAN` dari pricelist jika tersedia. Pembagian Howell 65% / Paperclip 35% dipakai sebagai nilai awal sesuai spesifikasi yang tersedia dan dapat diedit per cabang. Nilai ini bukan pengganti persetujuan perjanjian cabang.

## Foto produk

Foto dicocokkan ke SKU dari nama file. Nama SKU yang persis selalu didahulukan; nama pasangan dan rentang hanya dipakai untuk SKU yang belum memiliki foto tersendiri. Sebanyak 194 dari 362 SKU memiliki pasangan foto yang ditemukan. Foto web disimpan sebagai JPEG 720 × 720 yang dioptimalkan di `assets/product-images/`; sumber PNG tetap lokal di `assets/Foto Produk/` dan tidak dimuat oleh halaman. Kecocokan dan SKU tanpa foto tercatat di [product-image-audit.json](assets/product-image-audit.json).

## Alur operasional

1. Catat opname awal gudang pusat sebelum barang dikeluarkan; data stok dikelola pada halaman Stok & Opname.
2. Buat PO langsung dengan memilih cabang retail. PO langsung muncul di halaman Gudang dengan statusnya; setelah diajukan dan disetujui, catat surat jalan. Stok pusat baru berkurang ketika barang benar-benar dikirim.
3. Konfirmasi penerimaan menggunakan nama penerima dan referensi GRN; penerimaan parsial dicatat per SKU dan dapat dilanjutkan.
4. Catat opname cabang. Rekonsiliasi penjualan menghitung stok awal + barang diterima − retur terkonfirmasi − stok fisik akhir.
5. Tinjau dan setujui laporan per SKU. Invoice periode hanya dapat dibuat setelah seluruh laporan periode cabang disetujui.
6. Catat pembayaran sebagian atau penuh dengan tanggal dan referensi.
7. Retur mengurangi saldo cabang setelah cabang mengonfirmasi pengiriman, lalu menambah stok pusat hanya setelah gudang menerima dan menyatakan barang layak jual.

Pengaturan menyediakan ekspor JSON dan pemulihan dari file cadangan. Saat API VPS aktif, audit aplikasi ikut tersimpan di state database; catatan itu belum setara dengan audit transaksi yang tidak dapat diubah.

## Menjalankan

Buka `index.html` untuk pratinjau lokal. Portal gudang lokal tersedia di `warehouse/index.html`. Untuk VPS, jalankan `node scripts/build-vps-release.cjs`; hasilnya memuat aplikasi utama dan gudang di folder `release/` serta mengaktifkan koneksi API bersama hanya pada hasil build. Jalankan `node server.cjs` dengan Node.js 24+ dan variabel `HOWELL_API_USER`, `HOWELL_API_PASSWORD`, `HOWELL_WAREHOUSE_USER`, `HOWELL_WAREHOUSE_PASSWORD`, dan `HOWELL_DB_PATH`. Jangan expose port API secara publik; gunakan Nginx dan HTTPS. Lihat [DEPLOYMENT.md](DEPLOYMENT.md).

URL yang disiapkan pada konfigurasi Nginx: `https://inventory.howellcable.site/` untuk admin/marketing dan `https://gudang.inventory.howellcable.site/` untuk Gudang, Stok & Opname, dan Retur. Kedua alamat menggunakan endpoint dan file database SQLite yang sama, tetapi login gudang menerima data yang sudah disaring oleh server.

## Batasan

Integrasi server dan kedua portal sudah disiapkan di kode, tetapi belum dipasang ke VPS dan belum diuji untuk produksi. Database memakai snapshot bersama dengan penolakan revisi lama, belum model tabel transaksi domain. Backup offsite, pemulihan bencana, dan uji penerimaan dengan dua akun perlu diselesaikan sebelum operasional. Stok awal workbook tetap “belum diopname” sampai dihitung dan dicatat. Tanggal efektif dan bukti perjanjian dapat dilengkapi untuk administrasi cabang, tetapi bukan syarat untuk mengajukan PO.

## Sebelum digunakan di VPS

Lihat [DEPLOYMENT.md](DEPLOYMENT.md). Perubahan lokal ini belum dipush dan tidak ada perubahan dilakukan pada VPS atau DNS. Sebelum pemakaian resmi, konfigurasi server, HTTPS, dua kredensial, migrasi state, backup/restore, dan verifikasi akses lintas peran harus disiapkan.
