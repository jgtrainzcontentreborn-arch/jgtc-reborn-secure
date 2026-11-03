# JGTC REBORN — Tahap 3: Sistem Pembelian

## Yang ditambahkan
- Detail produk melalui `#product?id=...`.
- Keranjang lokal browser (ID produk saja; harga selalu dihitung ulang server).
- Checkout untuk pengguna yang login.
- Callable Cloud Function `createOrder` menghitung harga dari Firestore `addons` dan membuat dokumen pesanan.
- Riwayat pembelian dengan query milik pengguna.
- Login/registrasi email-password dan Google untuk mendukung alur pembelian.
- Admin lama tetap menggunakan UID yang sama.

## Konfigurasi Firebase yang wajib
1. Di Firebase Authentication, aktifkan Email/Password dan Google.
2. Tambahkan domain website ke Authentication → Settings → Authorized domains.
3. Pastikan katalog `addons` memiliki harga numerik atau string Rupiah seperti `Rp25.000`, dan status Payware.
4. Pastikan akun admin tetap memiliki UID `wkPmVZUdYFdO0P3McTiimxtHbg03`.
5. Install Firebase CLI, login, lalu dari root proyek jalankan `firebase deploy --only functions:createOrder`.
6. Uji dahulu pada project staging/emulator sebelum produksi.
7. Setelah backend siap, deploy Firestore Rules dari `firestore.rules`. Aturan `orders` mengizinkan pemilik membaca pesanan sendiri; pembuatan/perubahan pesanan hanya melalui Admin SDK Cloud Function.

## Pembayaran manual — belum selesai pada Tahap 3
Tahap ini membuat pesanan berstatus `awaiting_payment`. Instruksi rekening, upload bukti transfer, verifikasi admin, dan pemberian akses download akan dibuat pada modul pembayaran berikutnya. Jangan menandai pesanan lunas secara manual dengan mengubah dokumen Firestore.

## Catatan harga
Harga katalog lama disimpan sebagai string. Fungsi backend hanya menerima digit yang terdapat dalam nilai tersebut. Contoh `Rp25.000` menjadi 25000. Pastikan harga ditulis jelas dan jangan gunakan teks harga yang ambigu.

## Uji penerimaan
- Katalog lama tetap dapat dibuka dan dikelola admin.
- Produk Payware tampil tombol tambah keranjang; freeware tetap memakai tautan resmi.
- Pengunjung tanpa login tidak dapat checkout.
- Harga checkout dihitung ulang oleh Cloud Function dari dokumen `addons`.
- Pelanggan hanya dapat membaca dokumen pesanan miliknya.
- Pengguna tidak dapat membuat atau mengubah pesanan langsung melalui Firestore SDK.
- Uji email/password dan Google sign-in setelah provider diaktifkan.
