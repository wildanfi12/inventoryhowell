# Prompt pembangunan aplikasi Howell Inventory

Salin prompt ini ke coding agent atau developer yang akan membangun versi produksi. Spesifikasi data di bawah berasal dari dokumen kebutuhan gudang konsinyasi; arahan teknis dan UX adalah kriteria implementasi.

```text
Bangun aplikasi web production-ready bernama Howell Inventory untuk mengelola gudang pusat/principal dan konsinyasi retail multi-cabang. Bahasa UI utama Indonesia, zona waktu Asia/Jakarta, mata uang IDR. Jadikan spesifikasi modul dan field berikut sebagai persyaratan produk wajib. Jangan mengarang data bisnis atau mengisi angka demo sebagai data produksi. Jika data belum tersedia, gunakan empty state dan siapkan impor data.

IDENTITAS VISUAL
- Gunakan warna kuning Howell **#EDAE49** secara hemat sebagai warna brand untuk aksi utama, fokus/seleksi, grafik, dan peringatan. Gunakan latar terang netral, permukaan putih, teks charcoal, serta warna status semantik yang jelas; jangan mewarnai bidang besar kuning.
- Hindari susunan dashboard SaaS generik, kartu berulang, dan ikon dekoratif berlebihan. Gunakan interface operasional Howell yang tenang, rapih, dan mudah dipindai: tipografi sans-serif yang terbaca, garis pemisah halus, komposisi section yang jelas, dan hierarki yang terasa dirancang khusus untuk inventori.
- Kelompokkan navigasi vertikal gelap dengan jelas menjadi Utama (Ringkasan, Stok, Produk, Cabang), Operasional (Pengiriman, Penjualan, Tagihan, Retur), dan Preferensi; sorot pilihan aktif memakai kuning Howell dan jadikan drawer pada layar sempit.
- Buat dashboard asimetris dengan panel pembuka kuning bermerek Howell dan simbol pusaran sebagai elemen visual, ringkasan operasi di panel gelap, metrik, tren, aktivitas, serta perhatian stok. Hindari tata letak kartu berulang yang terasa seperti template.
- Dashboard harus memuat pintasan aksi utama (buat surat jalan, catat penjualan, mulai opname) yang langsung membuka alur terkait; tambahkan hover, fokus keyboard, transisi ringan, dan umpan balik yang jelas.
- Gunakan satu keluarga sans-serif UI yang mudah dibaca dengan skala konsisten untuk judul, tabel, label, dan angka. Prioritaskan stack Apple system `-apple-system, BlinkMacSystemFont, SF Pro Text/Display` dengan fallback Segoe UI/system sans-serif. Body 14-16px, tabel minimal 12-13px, metadata tidak kurang dari 11px pada desktop. Hindari ketergantungan font eksternal.
- Sertakan infografik inventori yang dihitung dari data aktual, misalnya komposisi unit per kategori dengan label, jumlah SKU, persentase, kontras yang jelas, dan target interaktif yang bisa dipakai dengan mouse maupun keyboard.
- Gunakan aset logo Howell yang disediakan pada folder assets. Pilih versi full-color untuk permukaan terang dan versi putih untuk latar gelap. Pertahankan proporsi logo dan jangan menggambar ulang atau memodifikasi bentuknya.
- Gunakan logo putih pada menu gelap dan logo berwarna pada permukaan kuning/putih yang sesuai. Pertahankan proporsi logo.

TUJUAN DAN PENGGUNA
- Menyediakan satu sumber data untuk master produk, jaringan cabang, distribusi, stok konsinyasi per SKU per cabang, penjualan, rekonsiliasi invoice, pembayaran, retur, dan audit stok.
- Peran minimum: Administrator, Operasional Gudang, Keuangan, dan Viewer. Terapkan hak akses sesuai tugas; perubahan finansial dan koreksi stok harus menyimpan siapa, kapan, nilai sebelum/sesudah, dan alasan.
- Stok di cabang tetap milik principal sampai terjual. Jangan menghitung pengiriman keluar sebagai penjualan.

MODUL DAN FIELD WAJIB
1. Master Produk: SKU/Item Code unik; Barcode Retail/EAN; nama produk dan spesifikasi/varian; kategori; brand; satuan dasar (Pcs, Set, Box, Pack); HPP; harga jual rujukan SRP/HET; persentase margin/komisi retail; status aktif.
2. Master Cabang Retail: Store ID unik; nama cabang dan jaringan; alamat lengkap; region/zona logistik; contact person/store manager; telepon; email operasional; billing term (mis. 14 hari, bi-weekly, bulanan); kapasitas rak.
3. Pengiriman konsinyasi/DO: nomor surat jalan; tanggal kirim; estimasi tiba; cabang tujuan; daftar SKU dan kuantitas; status In Transit, Received, Partial, atau Rejected; nama penerima; bukti GRN signed sebagai lampiran. Penerimaan parsial wajib menyimpan kuantitas diterima per baris SKU dan membuat pergerakan stok dengan idempotency agar konfirmasi ulang tidak menggandakan stok.
4. Stok & opname cabang: saldo awal per SKU/cabang/periode; penerimaan/replenishment; sales-out; retur/cacat; stok akhir sistem dihitung Saldo Awal + Masuk - Terjual - Retur/Cacat; hasil opname fisik; shrinkage = Fisik - Sistem. Simpan histori adjustment, pembuat, waktu, alasan, dan persetujuan bila perlu. Bedakan stok gudang pusat dari stok titipan di cabang.
5. Laporan penjualan/POS: Sales Report ID; cabang; periode mulai/akhir; kuantitas terjual per SKU; gross sales = qty x SRP (simpan harga saat transaksi sebagai snapshot); diskon promo retail dengan jejak persetujuan; net sales = gross - diskon resmi. Dukung input manual dan impor CSV/XLSX dengan preview, validasi SKU/cabang/periode, deteksi duplikat, laporan error, dan rekonsiliasi tanpa mengubah histori lama.
6. Rekonsiliasi & finansial: invoice konsinyasi; referensi sales report/periode; net sales; margin retail; hak retail/komisi; net payout principal = net sales - hak retail; jatuh tempo sesuai termin cabang; status Unpaid, Overdue, Partial, Paid; pembayaran dapat dicicil dan menyimpan tanggal serta bukti transfer. Hitung status Overdue dari tanggal jatuh tempo dan saldo, jangan jadikan status manual sumber kebenaran. Semua kalkulasi dapat dilacak per baris SKU dan dibulatkan secara konsisten.
7. Retur/pull-out: RMA ID; cabang; tanggal; SKU; alasan Slow Moving, Damaged, Expired, Store Closing; kuantitas ditarik; kondisi Re-sellable, Repairable, Scrap/Musnah; penerimaan gudang dan pergerakan stok sesuai kondisi. Cegah retur melebihi stok tersedia cabang.

LAYAR
- Dashboard ringkas dengan filter tanggal/cabang, penjualan bersih, unit terjual, stok rendah, pengiriman dalam perjalanan, invoice jatuh tempo, dan aktivitas terakhir. Metrik harus dihitung dari data aktual.
- Stok Gudang Pusat dan Stok Konsinyasi per Cabang dengan pencarian, filter, drill-down kartu SKU, nilai formula, dan opname.
- CRUD master produk dan cabang; daftar/pembuatan/detail DO; input/unggah sales; invoice dan pembayaran; RMA; laporan dan pengaturan.
- Detail setiap dokumen menunjukkan status/timeline, baris item, perhitungan, lampiran, dan audit log.
- Ekspor CSV/XLSX untuk tabel utama; impor menyediakan template dan hasil validasi yang dapat diunduh.

KUALITAS DAN KEAMANAN
- UI responsif desktop/tablet/mobile, navigasi aksesibel, label form jelas, validasi inline, konfirmasi untuk tindakan penting, status loading/error/empty yang nyata.
- Backend API dan database relasional dengan foreign key, unique key, transaksi atomik, soft-delete untuk master, audit log append-only, pagination, pencarian, filter, serta indeks untuk SKU, cabang, tanggal, dan nomor dokumen.
- Gunakan decimal untuk nominal, integer untuk kuantitas, ISO date untuk tanggal. Simpan snapshot SRP/margin pada sales/invoice agar perubahan master tidak mengubah histori.
- Otentikasi dan role-based access; validasi server-side; file GRN/bukti transfer disimpan privat dengan tipe/ukuran file tervalidasi; jangan expose rahasia di frontend.
- Jangan mengklaim integrasi POS, sinkronisasi real-time lintas toko, atau keamanan production sebelum benar-benar diimplementasikan dan dikonfigurasi.
- Berikan migrasi database, contoh .env tanpa secret, README setup lokal/deploy, dokumentasi skema API, serta strategi backup/restore.
- Sertakan data demo sintetis hanya di lingkungan demo, beri label demo secara jelas, dan sediakan mekanisme reset. Impor data pengguna nanti tanpa kehilangan audit trail.

SEBELUM IMPLEMENTASI
- Ajukan daftar asumsi terbuka terkait aturan margin (basis net/gross), diskon yang ditanggung principal vs toko, cut-off periode, pajak, perlakuan barang rusak/kedaluwarsa, multi-gudang, nomor dokumen, dan approval pembayaran. Jangan tetapkan kebijakan finansial tersebut diam-diam.
- Gunakan struktur kode modular dan dokumentasikan keputusan. Selesaikan alur end-to-end: master -> DO -> GRN -> saldo cabang -> sales report -> invoice -> pembayaran; serta retur -> pemeriksaan kondisi -> saldo stok.
```

Prompt ini menjadi brief implementasi. Prototype pada folder ini adalah contoh alur UI lokal; backend, autentikasi, sinkronisasi antar pengguna, dan koneksi POS belum dibuat.
