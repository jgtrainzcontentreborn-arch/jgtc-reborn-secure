# JGTC REBORN — Tahap 4: Pembayaran Manual

## Yang ditambahkan
- Pengaturan rekening bank/e-wallet dan instruksi pembayaran oleh admin utama melalui callable Cloud Function.
- Halaman pembayaran berdasarkan pesanan; pelanggan mengunggah bukti JPG/PNG/PDF maksimal 5 MB.
- Bukti masuk ke Firebase Storage pada `payment-proofs/{uid}/{orderId}/...`; klien tidak dapat membaca atau menghapus file.
- Callable `submitPaymentProof` memvalidasi pemilik pesanan, status, konfigurasi pembayaran, metadata, tipe, dan ukuran file.
- Panel admin menampilkan pembayaran menunggu verifikasi dengan URL bukti sementara (signed URL 15 menit).
- Admin dapat menyetujui atau menolak pembayaran. Persetujuan menandai order paid dan membuat dokumen `ownerships`; penolakan mengembalikan order ke `awaiting_payment` agar bukti dapat dikirim ulang.
- Riwayat pembelian menampilkan aksi bayar, status verifikasi, dan akses download setelah lunas.
- `getOrderDownloads` memeriksa kepemilikan order dan status lunas. File privat menggunakan signed URL 10 menit; tautan eksternal HTTPS dari katalog tetap didukung.

## Deploy
1. Pastikan `firebase-config.js` tetap menunjuk project Firebase yang benar dan UID admin utama tidak berubah.
2. Di Firebase Console, aktifkan Firebase Storage dan pastikan bucket project sudah dibuat.
3. Dari root proyek jalankan `npm install -g firebase-tools` bila CLI belum tersedia, lalu `firebase login` dan `firebase use jgtc-reborn`.
4. Deploy backend: `cd functions && npm install && cd .. && firebase deploy --only functions`.
5. Deploy aturan Firestore dan Storage: `firebase deploy --only firestore:rules,storage`.
6. Pada katalog admin, produk dapat memakai `url` untuk tautan download eksternal HTTPS. Untuk file privat, unggah file melalui Firebase Console ke folder `product-files/`, lalu isi field `Path file privat Firebase Storage` pada form produk admin dengan path relatif yang tepat (misalnya `product-files/rute-daop8.zip`). Jangan membuat file privat dapat dibaca publik.
7. Login sebagai admin, buka Panel Admin → Pengaturan pembayaran, isi nama bank/e-wallet, nomor rekening, atas nama, instruksi, lalu aktifkan pembayaran.
8. Uji dengan akun pelanggan terpisah: buat pesanan, unggah bukti, login admin untuk menyetujui/menolak, lalu cek riwayat dan akses download.

## Catatan keamanan dan operasional
- Rules tidak mengizinkan klien menulis dokumen `orders`, `payments`, `ownerships`, `notifications`, atau `admin_logs`. Semua perubahan transaksi dilakukan Admin SDK melalui callable functions.
- Admin utama tetap UID `wkPmVZUdYFdO0P3McTiimxtHbg03`.
- Jangan pernah mengirim service-account key ke browser atau memasukkannya ke ZIP publik.
- Signed URL bersifat sementara. Tautan eksternal yang tersimpan di `addons.url` harus berupa HTTPS dan memang ditujukan sebagai link download.
- Jika query riwayat pesanan meminta composite index, ikuti tautan pembuatan index yang ditampilkan Firebase Console (kombinasi `userId` + `createdAt`).
- Pengaturan rekening hanya boleh diubah admin. Uji deployment pada project staging bila tersedia sebelum menerapkan ke produksi.

## Status pengujian paket
Pemeriksaan sintaks JavaScript dan struktur konfigurasi dapat dilakukan lokal. Deployment, upload Storage, callable functions, dan transfer nyata tetap harus diuji pada project Firebase pemilik website; paket ini tidak mengklaim telah mengakses atau mengubah project produksi.
