# JGTC REBORN — Paket Lanjutan Tahap 6

Paket ini melanjutkan source Tahap 5 dengan dashboard pelanggan, notifikasi akun, analitik penjualan admin, serta impor katalog bertahap. Katalog `addons`, Firebase Authentication, pembayaran manual, Cloud Functions, Storage, ownership, dan fitur update rute tetap dipertahankan.

## Fitur Tahap 6
- Dashboard pelanggan: pesanan terbaru, produk dimiliki, notifikasi, dan status versi rute.
- Tandai notifikasi sebagai telah dibaca melalui callable yang memverifikasi pemilik.
- Dashboard analitik admin untuk pendapatan dan status transaksi (maksimal 500 pesanan terbaru).
- Impor katalog diproses dalam batch 450 dokumen agar tidak melewati batas Firestore.
- Penyederhanaan handler keranjang update rute agar satu klik hanya diproses sekali; keranjang update rute tunggal maupun campuran tetap didukung.
- Indeks komposit untuk riwayat pesanan dan notifikasi.

## File penting
- `index.html`, `styles.css`, `script.js`: antarmuka.
- `firebase-bridge.js`: penghubung Firebase dan callable.
- `functions/index.js`: validasi transaksi dan callable backend.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`: aturan dan indeks Firebase.
- `TAHAP-6-PETUNJUK-DEPLOY.md`: panduan deployment dan pengujian.

## Mulai
Ikuti `TAHAP-6-PETUNJUK-DEPLOY.md`. Gunakan project ID Firebase yang sama dengan website aktif. Jangan mengganti UID admin utama atau menghapus koleksi lama.

Catatan: voucher/kode promo belum termasuk dalam paket Tahap 6 ini; direncanakan sebagai modul lanjutan dengan validasi atomik backend.
