# Howell Inventory: database VPS dan status deployment

## Yang tersedia di kode ini

- `server.cjs` menyediakan API Node.js 24+ dan SQLite untuk snapshot state bersama.
- Database memakai SQLite WAL, file mode privat, transaksi tulis, audit revisi/hash, dan optimistic concurrency (`If-Match`). Dua browser yang mengubah revisi lama tidak akan saling menimpa tanpa diketahui; permintaan kedua ditolak sebagai konflik.
- Aplikasi mengambil state dari `/api/state`, mengirim perubahan ke server, memperbarui data saat server berubah, serta menunjukkan status koneksi. Sinkronisasi hanya aktif bila `window.HOWELL_SHARED_DATABASE = true` pada `assets/howell-runtime-config.js`. Default GitHub Pages tetap memakai browser storage agar tidak terkunci ketika API VPS belum siap.
- Bila database masih kosong, browser pertama yang berhasil tersambung menginisialisasinya dari data yang sedang dibuka. State lokal sebelumnya disimpan sebagai salinan pemulihan sebelum diganti oleh state server.
- API memerlukan HTTP Basic Authentication. Konfigurasi contoh Nginx melindungi file website dan API, meneruskan kredensial ke service Node yang hanya bind ke `127.0.0.1`.
- `scripts/build-vps-release.cjs` membuat folder `release/` untuk VPS: portal utama di root dan portal gudang terpisah di `/warehouse/`. Frontend kedua portal mengarah ke `/api/state` yang sama.
- Akun API `HOWELL_API_*` memberi akses admin penuh. Akun `HOWELL_WAREHOUSE_*` mendapat proyeksi allowlist tanpa pricelist, nota/harga PO, penjualan, invoice, laporan finansial, atau stok cabang terperinci. Server juga membatasi mutasi stok ke opname, pengeluaran PO lewat surat jalan, dan penerimaan retur serta mencatat username autentikasi sebagai pelaku.
- Portal gudang hanya menampilkan menu Gudang, Stok & Opname, dan Retur. Host usulan: `gudang.inventory.howellcable.site`; situs utama: `inventory.howellcable.site`.

## Status operasional

**Belum dipasang ke VPS dan belum live.** Perubahan ini hanya ada di checkout lokal; tidak ada commit/push GitHub, perubahan DNS, atau modifikasi layanan VPS.

**Belum dipasang ke VPS dan belum boleh dianggap siap produksi.** Walau API sekarang memisahkan akun admin/gudang dan menerapkan proyeksi serta validasi mutasi di server, penyimpanan operasional masih berupa satu snapshot JSON dalam SQLite, bukan tabel transaksi domain. Belum ada backup otomatis teruji, pemulihan bencana, pembatasan laju login, atau uji penerimaan end-to-end di VPS. Gunakan staging terlebih dulu dan jangan masukkan transaksi produksi sebelum backup/restore serta seluruh alur dua akun diverifikasi.

Jangan buka aplikasi ini untuk operasi bersama, atau memasukkan data produksi, sebelum kekurangan tersebut ditangani. Menyimpan ke SQLite VPS saja belum cukup untuk menjamin konsistensi semua alur operasional.

## Prasyarat sebelum VPS dipakai

1. VPS memakai Node.js 24 atau lebih baru (`node:sqlite`), Nginx, service account khusus, dan `/var/lib/howell-inventory` dengan izin hanya untuk service. Jalankan `node scripts/build-vps-release.cjs`, lalu salin hasil `release/` ke `/var/www/howell-inventory/release/`.
2. Arahkan DNS `inventory.howellcable.site` dan `gudang.inventory.howellcable.site` ke VPS. Pertahankan DNS lama sampai VPS, HTTPS, dan uji staging berhasil. Terbitkan sertifikat HTTPS untuk kedua host sebelum mengaktifkan konfigurasi TLS Nginx.
3. Buat dua pasangan kredensial berbeda. Nginx `howell-inventory.htpasswd` hanya berisi akun admin; `howell-warehouse.htpasswd` hanya akun gudang. Samakan nama pengguna dan kata sandi masing-masing dengan environment API. Simpan `inventory.env` di `/etc/howell-inventory/` bermode `0600`, jangan masukkan rahasia ke Git.
4. Migrasikan state dari browser yang menjadi sumber data resmi. Bila database kosong, browser pertama yang terhubung menjadi sumber inisialisasi. Cadangkan JSON dari aplikasi dan tinjau jumlah SKU, stok, PO, serta riwayat sebelum migrasi.
5. Pastikan Nginx memisahkan `root` dan Basic Auth file untuk kedua host. Kedua host boleh meneruskan `/api/` ke service yang sama; API menentukan peran dari kredensialnya sendiri, jadi jangan memakai ulang akun admin di portal gudang.
6. Migrasikan state resmi hanya sekali dengan akun admin. Cadangkan JSON sumber, hitung SKU/stok/PO/retur, lalu pastikan akun gudang tidak dapat mengambil data finansial sebelum mengundang operator.
7. Siapkan backup terenkripsi di luar VPS, retensi, pemantauan disk, dan uji restore. Jangan anggap audit hash snapshot sebagai audit transaksi yang tidak dapat diubah.
8. Uji dengan dua browser/perangkat dan dua akun: akses halaman, pencarian SKU, opname sumber Bizgo/Gudang, keputusan PO, surat jalan bertahap, stok tidak cukup, retur, konflik revisi, cetak PDF, ekspor admin, pemulihan backup, dan pemulihan layanan.

## File konfigurasi contoh

- `deployment/howell-inventory-api.service` — unit systemd untuk service terpisah.
- `deployment/nginx-howell-inventory.conf.example` — dua virtual host dengan reverse proxy ke satu API dan auth file terpisah. Pasang hanya setelah kedua DNS dan sertifikat TLS siap.
- `deployment/inventory.env.example` — nama variabel; buat file rahasia terpisah di `/etc/howell-inventory/inventory.env` dengan mode `0600`.

Jangan salin konfigurasi Nginx contoh ke situs `stockflow.howellcable.site`; situs itu dan service Howell lain harus tetap terpisah.
