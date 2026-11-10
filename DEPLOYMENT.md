# Kesiapan VPS Howell Inventory

## Status saat ini

**Belum siap untuk operasional produksi multi-pengguna.** Proyek ini berupa aplikasi statis HTML, CSS, dan JavaScript. Transaksi disimpan di `localStorage` pada browser yang digunakan. Server VPS hanya akan menyajikan file; server tidak menerima atau menyimpan perubahan aplikasi.

Artinya, dua petugas bisa melihat saldo berbeda, data hilang saat penyimpanan browser dibersihkan, dan instalasi ulang browser/perangkat tidak memulihkan data. Login, pembatasan peran, dan audit yang tidak bisa diubah pengguna juga belum tersedia.

## Yang aman dilakukan sekarang

- Pasang sebagai demo atau pratinjau internal.
- Gunakan satu browser/perangkat uji dengan data non-produksi.
- Ekspor cadangan JSON sebelum migrasi, reset, atau uji coba yang berisiko.
- Pulihkan file cadangan JSON hanya dari Pengaturan aplikasi Howell Inventory; pemulihan mengganti data browser aktif setelah membuat salinan lokal.
- Aktifkan HTTPS dan batasi akses pratinjau dengan autentikasi pada reverse proxy bila situs dapat dijangkau publik.

## Wajib sebelum operasional

1. Tetapkan backend API dan database bersama. Simpan produk, PO, pengeluaran, surat jalan, GRN, opname, penjualan, retur, dan pembayaran di server.
2. Terapkan login, sesi aman, peran dan hak akses (misalnya admin, approver, gudang, cabang, keuangan), serta pencatatan pengguna pada setiap perubahan.
3. Pindahkan pengurangan stok dan pembuatan surat jalan ke transaksi database atomik. Cegah dua petugas mengeluarkan stok yang sama secara bersamaan dan cegah nomor PO/surat jalan ganda.
4. Simpan audit trail di server yang mencatat pengguna, waktu, nilai sebelum/sesudah, dan referensi transaksi.
5. Buat backup otomatis terenkripsi, kebijakan retensi, dan uji pemulihan. Backup JSON yang diunduh manual bukan backup server.
6. Migrasikan data lokal melalui proses impor yang memeriksa duplikasi, saldo, SKU, dan total sebelum mengganti data produksi. Rekonsiliasi stok fisik terlebih dahulu.
7. Simpan rahasia konfigurasi di environment server, bukan di file publik. Terapkan HTTPS, pembatasan akses admin, pembaruan OS, firewall, dan pemantauan log.
8. Verifikasi alur PO → persetujuan → pengeluaran parsial/berulang → surat jalan → GRN → opname → rekonsiliasi → invoice → pembayaran, termasuk pemulihan setelah kegagalan.

## Checklist penyajian file statis

Jika hanya untuk demo, sajikan folder ini lewat Nginx/Apache sebagai static site, arahkan DNS domain ke VPS, pasang sertifikat HTTPS, dan lindungi pratinjau dari akses publik yang tidak diinginkan. Sertakan seluruh file `assets/` dan pertahankan nama jalur relatif. Tidak ada service API atau database yang dapat dijalankan dari repo ini saat ini.

Setelah backend tersedia, dokumentasikan variabel environment, proses migrasi database, health check, backup, restore, rollback rilis, dan prosedur rotasi kredensial sebelum membuka akses operasional.
