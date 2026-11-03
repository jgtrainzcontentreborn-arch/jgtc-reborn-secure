# JGTC REBORN — Tahap 6

Tahap 6 menambahkan dashboard akun pelanggan, pusat notifikasi, ringkasan analitik penjualan admin, dan perbaikan impor katalog besar. Semua fitur Tahap 1–5 dipertahankan.

## Fitur Tahap 6 (paket ini)

### Dashboard pelanggan
- Ringkasan jumlah pesanan terbaru, jumlah kepemilikan produk, dan notifikasi belum dibaca.
- Daftar maksimal 10 pesanan terbaru.
- Daftar maksimal 30 notifikasi terbaru.
- Tombol tandai notifikasi sebagai telah dibaca. Backend hanya mengubah notifikasi milik UID yang sedang login.
- Daftar produk yang dimiliki beserta versi rute saat ini.

### Analitik admin
- Total pendapatan dari pesanan lunas, jumlah pesanan lunas, pesanan menunggu proses, dan rata-rata nilai pesanan.
- Rincian pendapatan harian dari maksimal 500 pesanan terbaru.
- Hanya callable backend dengan UID admin utama yang dapat membaca statistik.

### Perbaikan teknis
- Impor katalog dipecah menjadi batch 450 dokumen (Firestore membatasi 500 operasi per batch).
- Validasi input impor berupa array maksimal 5.000 objek.
- Indeks Firestore komposit untuk riwayat pesanan dan notifikasi.

## Deployment

1. Backup project Firebase dan pastikan project aktif adalah project JGTC REBORN.
2. Jangan mengganti UID admin utama di `functions/index.js`, `firebase-config.js`, atau `firestore.rules`.
3. Jalankan dari root proyek:

   ```bash
   firebase login
   firebase use <PROJECT_ID_FIREBASE_JGTC>
   cd functions
   npm install
   cd ..
   firebase deploy --only functions,firestore:rules,firestore:indexes,storage
   ```

4. Tunggu pembuatan indeks selesai di Firebase Console. Query dashboard dapat gagal sementara indeks masih berstatus Building.
5. Login sebagai pelanggan dan buka **Akun Pembeli** untuk memeriksa dashboard dan notifikasi.
6. Login sebagai admin utama dan buka **Panel Admin** untuk memeriksa analitik penjualan.
7. Uji dengan dua akun pelanggan: akun A tidak boleh dapat membaca atau menandai notifikasi milik akun B.
8. Uji alur update rute: admin membuat opsi versi dan harga; akun yang belum memiliki rute tidak boleh checkout; akun pemilik rute dengan versi yang sesuai dapat menambahkan update ke keranjang, checkout, mengunggah bukti, dan menerima versi baru setelah pembayaran disetujui.
9. Uji keranjang update rute saja (tanpa produk lain), keranjang campuran, update yang dinonaktifkan, serta perubahan versi kepemilikan sebelum pembayaran disetujui. Harga dan kelayakan harus tetap divalidasi oleh Cloud Functions.
10. Uji impor katalog dengan lebih dari 500 item di project staging/emulator terlebih dahulu.

## Catatan statistik

Statistik admin dihitung dari maksimal 500 pesanan terbaru, bukan seluruh arsip transaksi tanpa batas. Untuk toko dengan volume lebih besar, tahap lanjutan sebaiknya memakai agregasi harian/bulanan yang diperbarui secara backend.

## Belum termasuk dalam paket ini

Voucher/kode promo belum diaktifkan. Modul tersebut membutuhkan pengelolaan masa berlaku, kuota pemakaian, batas per pelanggan, kombinasi diskon, dan validasi transaksi atomik di backend. Fitur ini sengaja tidak dibuat hanya di browser agar nominal pesanan tidak dapat dimanipulasi.

## Batas pengujian

Pemeriksaan `node --check` memastikan sintaks JavaScript, tetapi bukan pengujian terhadap Firebase produksi. Deploy dan uji callable, indeks, Authentication, Firestore Rules, Storage, serta alur transaksi pada project staging sebelum dipublikasikan.
