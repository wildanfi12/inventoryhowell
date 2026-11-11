# Howell Inventory: database VPS dan status deployment

## Yang tersedia di kode ini

- `server.cjs` menyediakan API Node.js 24+ dan SQLite untuk snapshot state bersama.
- Database memakai SQLite WAL, file mode privat, transaksi tulis, audit revisi/hash, dan optimistic concurrency (`If-Match`). Dua browser yang mengubah revisi lama tidak akan saling menimpa tanpa diketahui; permintaan kedua ditolak sebagai konflik.
- Aplikasi mengambil state dari `/api/state`, mengirim perubahan ke server, memperbarui data saat server berubah, serta menunjukkan status koneksi. Sinkronisasi hanya aktif bila `window.HOWELL_SHARED_DATABASE = true` pada `assets/howell-runtime-config.js`. Default GitHub Pages tetap memakai browser storage agar tidak terkunci ketika API VPS belum siap.
- Bila database masih kosong, browser pertama yang berhasil tersambung menginisialisasinya dari data yang sedang dibuka. State lokal sebelumnya disimpan sebagai salinan pemulihan sebelum diganti oleh state server.
- Default API memerlukan HTTP Basic Authentication dengan akun admin dan gudang terpisah. Untuk fase pembaruan sementara, `HOWELL_PUBLIC_PORTALS=true` membuka kedua host tanpa prompt password: host utama diberi peran admin, sedangkan host gudang tetap dibatasi ke proyeksi dan mutasi gudang di server. Dalam mode ini siapa pun yang mengetahui URL dapat melihat/mengubah data admin dari host utama; matikan mode publik dan aktifkan kembali autentikasi sebelum mengisi data sensitif atau memakai operasi produksi.
- `scripts/build-vps-release.cjs` membuat folder `release/` untuk VPS: portal utama di root dan portal gudang terpisah di `/warehouse/`. Frontend kedua portal mengarah ke `/api/state` yang sama.
- Akun API `HOWELL_API_*` memberi akses admin penuh. Akun `HOWELL_WAREHOUSE_*` mendapat proyeksi allowlist tanpa pricelist, nota/harga PO, penjualan, invoice, laporan finansial, atau stok cabang terperinci. Server juga membatasi mutasi stok ke opname, pengeluaran PO lewat surat jalan, dan penerimaan retur serta mencatat username autentikasi sebagai pelaku.
- Portal gudang hanya menampilkan menu Gudang, Stok & Opname, dan Retur. Host usulan: `gudang.inventory.howellcable.site`; situs utama: `inventory.howellcable.site`.

## Status operasional

**Kode sudah dipush ke GitHub (`main`) dan rilis sudah dipasang pada VPS `103.150.227.170`.** Service API aktif pada `127.0.0.1:3103`; health check lokal berhasil, dan endpoint state menolak akses tanpa autentikasi. Rilis statis berada di `/var/www/howell-inventory/release`, dengan API di `/opt/howell-inventory/server.cjs` dan SQLite di `/var/lib/howell-inventory/inventory.sqlite`.

**Belum live untuk pengguna.** DNS `inventory.howellcable.site` masih mengarah ke GitHub Pages dan DNS `gudang.inventory.howellcable.site` belum diarahkan ke VPS. Nginx hanya menyiapkan jalur ACME challenge dan mengembalikan HTTP 503 untuk halaman lain; belum ada akses aplikasi melalui HTTP. Sertifikat HTTPS untuk kedua host belum diterbitkan. Setelah DNS diarahkan, terbitkan sertifikat TLS, aktifkan virtual host HTTPS pada contoh konfigurasi, lalu uji kedua akun.

Database di VPS masih kosong dan menunggu inisialisasi admin. Saat host utama diarahkan ke VPS, login admin pertama dari browser sumber data resmi akan mengirim data lokal browser tersebut ke database bersama. Pastikan data browser itu yang benar dan unduh cadangannya sebelum login pertama. Jangan inisialisasi dari akun gudang.

**Belum boleh dianggap siap produksi.** Saat portal dibuka tanpa password, host utama terbuka untuk siapa pun yang mengetahui URL dan tidak ada identitas pengguna yang terverifikasi. Walau host gudang tetap dibatasi di API, operasi tetap tidak memiliki identitas individu. Penyimpanan operasional masih berupa satu snapshot JSON dalam SQLite, bukan tabel transaksi domain. Belum ada backup otomatis teruji, pemulihan bencana, atau uji penerimaan end-to-end di VPS. Kembalikan autentikasi sebelum data sensitif/transaksi produksi dan siapkan backup/restore serta audit identitas pengguna.

Jangan buka aplikasi ini untuk operasi bersama, atau memasukkan data produksi, sebelum kekurangan tersebut ditangani. Menyimpan ke SQLite VPS saja belum cukup untuk menjamin konsistensi semua alur operasional.

## Prasyarat sebelum VPS dipakai

1. VPS memakai Node.js 24 atau lebih baru (`node:sqlite`), Nginx, service account khusus, dan `/var/lib/howell-inventory` dengan izin hanya untuk service. Jalankan `node scripts/build-vps-release.cjs`, lalu salin hasil `release/` ke `/var/www/howell-inventory/release/`.
2. Arahkan DNS `inventory.howellcable.site` dan `gudang.inventory.howellcable.site` ke VPS. Pertahankan DNS lama sampai VPS, HTTPS, dan uji staging berhasil. Terbitkan sertifikat HTTPS untuk kedua host sebelum mengaktifkan konfigurasi TLS Nginx.
3. Untuk akses terlindungi, buat dua pasangan kredensial berbeda. Nginx `howell-inventory.htpasswd` hanya berisi akun admin; `howell-warehouse.htpasswd` hanya akun gudang. Samakan nama pengguna dan kata sandi masing-masing dengan environment API. Simpan `inventory.env` di `/etc/howell-inventory/` bermode `0600`, jangan masukkan rahasia ke Git. Jangan aktifkan `HOWELL_PUBLIC_PORTALS=true` untuk data produksi.
4. Migrasikan state dari browser yang menjadi sumber data resmi. Bila database kosong, browser pertama yang terhubung menjadi sumber inisialisasi. Cadangkan JSON dari aplikasi dan tinjau jumlah SKU, stok, PO, serta riwayat sebelum migrasi.
5. Pastikan Nginx memisahkan `root` kedua host. Kedua host boleh meneruskan `/api/` ke service yang sama. Dalam mode autentikasi, API menentukan peran dari kredensial; dalam mode publik sementara, API menentukan peran dari host secara tepat.
6. Migrasikan state resmi hanya sekali dengan akun admin. Cadangkan JSON sumber, hitung SKU/stok/PO/retur, lalu pastikan akun gudang tidak dapat mengambil data finansial sebelum mengundang operator.
7. Siapkan backup terenkripsi di luar VPS, retensi, pemantauan disk, dan uji restore. Jangan anggap audit hash snapshot sebagai audit transaksi yang tidak dapat diubah.
8. Uji dengan dua browser/perangkat dan dua akun: akses halaman, pencarian SKU, opname sumber Bizgo/Gudang, keputusan PO, surat jalan bertahap, stok tidak cukup, retur, konflik revisi, cetak PDF, ekspor admin, pemulihan backup, dan pemulihan layanan.

## File konfigurasi contoh

- `deployment/howell-inventory-api.service` — unit systemd untuk service terpisah.
- `deployment/nginx-howell-inventory.conf.example` — dua virtual host dengan reverse proxy ke satu API. Pasang hanya setelah kedua DNS dan sertifikat TLS siap.
- `deployment/inventory.env.example` — nama variabel; buat file rahasia terpisah di `/etc/howell-inventory/inventory.env` dengan mode `0600`.

Jangan salin konfigurasi Nginx contoh ke situs `stockflow.howellcable.site`; situs itu dan service Howell lain harus tetap terpisah.

## Prosedur Deploy, Rollback, dan Health Check

### 1. Build Bundle Rilis
Jalankan di repositori:
```bash
node scripts/build-warehouse-portal.cjs
node scripts/build-vps-release.cjs
```
Folder `release/` akan berisi:
- Portal Utama (Admin): `release/`
- Portal Gudang (Warehouse): `release/warehouse/`

### 2. Backup Sebelum Deploy (di VPS)
Sebelum memasang rilis baru, buat cadangan folder rilis aktif dan database SQLite:
```bash
sudo cp -r /var/www/howell-inventory/release /var/www/howell-inventory/release-backup-$(date +%Y%m%d%H%M%S)
sudo cp /var/lib/howell-inventory/inventory.sqlite /var/lib/howell-inventory/inventory.sqlite.bak-$(date +%Y%m%d%H%M%S)
```

### 3. Deploy ke VPS
Unggah isi folder `release/` ke `/var/www/howell-inventory/release/`, kemudian pastikan izin kepemilikan file web:
```bash
sudo chown -R www-data:www-data /var/www/howell-inventory/release/
```
Jika ada perubahan pada `server.cjs`, salin ke `/opt/howell-inventory/server.cjs` dan restart service:
```bash
sudo systemctl restart howell-inventory-api.service
```

### 4. Health Check
Periksa status service dan endpoint API:
- Status systemd:
  ```bash
  sudo systemctl status howell-inventory-api.service
  ```
- Endpoint Health:
  - Internal VPS: `curl -sS http://127.0.0.1:3103/api/health`
  - Portal Utama: `curl -sS https://inventory.howellcable.site/api/health`
  - Portal Gudang: `curl -sS https://gudang.inventory.howellcable.site/api/health`
- Endpoint State:
  - `curl -sS https://inventory.howellcable.site/api/state`
  - `curl -sS https://gudang.inventory.howellcable.site/api/state`

### 5. Prosedur Rollback
Jika rilis baru mengalami kendala:
1. Kembalikan folder rilis sebelumnya:
   ```bash
   sudo rm -rf /var/www/howell-inventory/release
   sudo cp -r /var/www/howell-inventory/release-backup-<TIMESTAMP> /var/www/howell-inventory/release
   sudo chown -R www-data:www-data /var/www/howell-inventory/release/
   ```
2. (Bila diperlukan pemulihan database) Kembalikan snapshot database:
   ```bash
   sudo systemctl stop howell-inventory-api.service
   sudo cp /var/lib/howell-inventory/inventory.sqlite.bak-<TIMESTAMP> /var/lib/howell-inventory/inventory.sqlite
   sudo systemctl start howell-inventory-api.service
   ```
3. Lakukan verifikasi ulang dengan health check.

