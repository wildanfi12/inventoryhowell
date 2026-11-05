# Howell Inventory

Prototype web untuk alur manajemen gudang konsinyasi retail multi-cabang. UI dan field mengikuti spesifikasi Howell; angka dan cabang awal adalah data sintetis untuk demo.

Identitas visual memakai light mode dengan latar abu-abu sangat lembut, panel putih, teks charcoal, dan kuning Howell `#F4C63D` sebagai aksen aktif. Sidebar terbuka secara default dan dapat diciutkan ke ikon. UI memakai Apple system font stack dengan fallback Segoe UI/system sans-serif. Dashboard merangkum stok pusat, stok cabang, barang dalam perjalanan, SKU menipis, transaksi terbaru, serta grafik penjualan dari laporan tersimpan. Aset lokal memuat logo Howell; foto produk belum tersedia.

Katalog dari `MASTER DRAFT 2026 10(1).xlsx` tertanam di halaman Master Produk: 10 sheet, 383 baris sumber, dan 1.916 sel terisi. Nilai sel dan susunan kolom sumber dipertahankan, termasuk baris pemisah kategori, header berulang, kolom tanpa judul, dan SKU duplikat. Workbook tidak memuat stok, sehingga data katalog ini tidak digunakan sebagai saldo stok operasional.

## Menjalankan

Buka `index.html` di browser modern. Tidak membutuhkan instalasi, server, atau akun. Gunakan menu samping untuk berpindah modul. Data yang Anda tambah tersimpan di `localStorage` pada browser/perangkat tersebut.

Jalankan smoke checks dengan Node.js: `node tests/howell-smoke-test.cjs`.

## Fitur prototype

- Dashboard, master produk, cabang retail, pengiriman multi-SKU/GRN, stok pusat dan stok cabang, riwayat opname, laporan penjualan, invoice/pembayaran parsial, retur dengan verifikasi penerimaan, pusat laporan, dan ekspor CSV/JSON.
- Formula stok cabang: saldo awal + barang diterima - penjualan - retur/cacat.
- Sales report menolak nomor duplikat, memvalidasi stok/diskon/periode, mengurangi stok cabang satu kali, dan menyimpan snapshot SRP/margin.
- Penerimaan DO mencatat jumlah kumulatif per SKU dan hanya menambah stok cabang sebesar selisih baru; penolakan mengembalikan unit ke gudang pusat.
- Retur menunggu verifikasi gudang; hanya kuantitas yang benar-benar diterima dengan kondisi Re-sellable menambah stok tersedia pusat.
- Pembayaran menolak nominal nol/negatif dan kelebihan bayar; status invoice dihitung dari saldo dan jatuh tempo.
- Perubahan transaksi baru disimpan dalam audit log lokal yang dapat dilihat di Pengaturan.
- Banner menandai data demo. Menu Pengaturan menyediakan cadangan data JSON dan reset ke data awal.

## Batasan

Prototype ini berjalan lokal di browser dan bukan sistem produksi. Belum ada backend/database bersama, login/role, upload berkas sungguhan, koneksi POS, sinkronisasi antar cabang, workflow approval, migrasi database, atau deployment. Data demo disimpan di localStorage dan audit log dapat diedit lewat developer tools; jangan gunakan data produksi. Aturan komisi, diskon, pajak, jatuh tempo, dan pembulatan perlu disahkan dari spesifikasi bisnis sebelum implementasi backend.

PROMPT.md menyimpan brief yang digunakan untuk membangun versi prototype sebelumnya.
