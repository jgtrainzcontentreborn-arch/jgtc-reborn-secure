# JGTC REBORN — Audit dan Fondasi Implementasi Tahap 1

## Keputusan produk
- Pembayaran: transfer manual, bukti pembayaran, verifikasi admin tunggal.
- Download: akses file privat dan tautan eksternal per produk.
- Akun: email/password dan Google.
- Admin: satu UID admin utama.
- Desain: pertahankan identitas dan layout yang ada; penyempurnaan visual dilakukan bertahap.
- Teknologi: HTML, CSS, JavaScript, Firebase Authentication, Cloud Firestore; Firebase Storage/Cloud Functions ditambahkan ketika modul terkait dikerjakan.

## Hasil audit source code ZIP

### Struktur yang ditemukan
- `index.html`: shell halaman, navigasi, hero, footer, pemuatan SDK Firebase compat 10.14.1.
- `styles.css`: seluruh styling dan responsivitas.
- `script.js`: router hash, katalog, pencarian/filter, halaman informasi, panel admin, impor/ekspor JSON.
- `firebase-config.js`: konfigurasi web Firebase dan UID admin.
- `firebase-bridge.js`: login admin email/password, listener auth, sinkronisasi katalog `addons`, CRUD dan impor katalog.
- `firestore.rules`: aturan katalog publik dan tulis admin.
- `data/katalog-contoh.json` dan `assets/*`: data contoh dan aset visual.

### Fitur lama yang harus dipertahankan
1. Halaman muka, kategori Rute Indonesia, Session Freeware, Session Payware, Konten Freeware.
2. Pencarian global, filter katalog, halaman tips, alat bantu KUID, pembaruan, dan kontak.
3. Panel admin katalog: tambah, edit, hapus, impor dan ekspor JSON.
4. Koleksi Firestore `addons` dengan document ID katalog yang sudah ada.
5. Fallback katalog lokal untuk preview ketika Firebase belum aktif.

### Temuan teknis dan risiko yang harus ditangani
1. `firebase-config.js` sudah berisi konfigurasi web dan UID admin. Konfigurasi web Firebase memang berada di frontend; proteksi utama harus melalui Security Rules. Jangan pernah menaruh service-account private key di frontend.
2. UID admin ditulis di dua tempat (`firebase-config.js` dan `firestore.rules`). Keduanya wajib tetap sama. Jangan mengganti UID tanpa memastikan akun Authentication yang benar.
3. Firebase bridge saat ini hanya menyediakan login admin email/password; belum ada alur akun pembeli, Google provider, profil pengguna, pesanan, atau pembayaran.
4. Link katalog `url` saat ini ditampilkan langsung pada kartu publik. Produk berbayar tidak boleh terus menggunakan pola tautan publik ini ketika sistem pembelian aktif. Akses berbayar perlu dialihkan ke pemeriksaan kepemilikan dan URL/file terbatas.
5. Fungsi impor katalog memakai satu Firestore batch tanpa membatasi jumlah dokumen. Firestore membatasi jumlah operasi per batch; impor besar perlu dipecah dan diberi validasi.
6. `save()` dan `remove()` memeriksa status admin di browser, tetapi keamanan sebenarnya tetap harus berada pada Firestore Rules.
7. Belum ada konfigurasi Firebase Storage atau Cloud Functions dalam ZIP. Keduanya diperlukan untuk file privat dan validasi transaksi tepercaya.
8. README/PETUNJUK-FIREBASE perlu diselaraskan: file konfigurasi yang dikirim telah berisi nilai proyek, tetapi status aktifnya tetap harus diuji pada Firebase Console dan browser.

## Arsitektur target

### Koleksi Firestore
- `addons/{addonId}` — katalog lama; dipertahankan.
- `users/{uid}` — profil pelanggan, role `customer`; role admin tetap ditentukan oleh UID admin utama.
- `orders/{orderId}` — snapshot item, harga server, pemilik, status, waktu, dan ringkasan pesanan.
- `payments/{paymentId}` — metode manual, referensi pesanan, bukti transfer, status verifikasi, dan catatan admin.
- `route_updates/{updateId}` — versi update, addon/rute terkait, harga, syarat versi asal, catatan perubahan, status publikasi.
- `ownerships/{ownershipId}` — hak kepemilikan produk dan versi rute pelanggan.
- `notifications/{notificationId}` — notifikasi per pengguna/admin.
- `coupons/{couponId}` — kode promo, masa berlaku, batas penggunaan, aturan diskon.
- `settings/{settingId}` — konfigurasi publik/nonrahasia toko.
- `admin_logs/{logId}` — audit tindakan penting admin.

### Alur keamanan transaksi
- Harga katalog dan update dibaca sebagai informasi; total final dihitung ulang di backend dari dokumen produk/update, bukan dipercaya dari browser.
- Pembuatan pesanan dan perubahan status sensitif diproses melalui Cloud Functions/backend tepercaya.
- Bukti transfer disimpan di Storage dengan aturan akses terbatas; admin dapat memeriksa, pelanggan hanya dapat melihat bukti miliknya.
- Kepemilikan (`ownerships`) hanya dibuat setelah admin mengonfirmasi pembayaran atau backend menerima konfirmasi pembayaran sah.
- Link unduhan eksternal tetap dapat dipakai untuk produk tertentu, tetapi harus diberikan setelah pemeriksaan ownership. Untuk file privat, gunakan Storage Rules dan URL unduhan terbatas.

## Pekerjaan Tahap 1
1. Audit seluruh file dan petakan fitur lama.
2. Tetapkan skema koleksi dan tanggung jawab setiap modul.
3. Perketat baseline Firestore Rules: katalog lama tetap publik, hanya admin dapat mengubah katalog, profil pelanggan hanya dapat dikelola pemiliknya, dan koleksi transaksi yang belum memiliki backend tetap tertutup.
4. Siapkan checklist pengujian regresi dan keamanan.
5. Jangan migrasi atau menghapus dokumen `addons`.

## Status Tahap 1
- Audit struktur dan source code: selesai.
- Pemetaan fitur lama: selesai.
- Rancangan koleksi target: selesai.
- Baseline Firestore Rules: disiapkan dalam `firestore.rules`.
- Uji langsung ke Firebase project: belum dilakukan dari paket lokal; perlu diuji di Firebase Console/emulator sebelum aturan dipublikasikan.
- UI akun/transaksi/update rute: bukan bagian Tahap 1; dikerjakan pada tahap implementasi berikutnya.

## Checklist sebelum menerapkan rules
- Pastikan UID admin pada `firebase-config.js` sama dengan UID dalam `firestore.rules`.
- Jalankan rules di Firebase Emulator/Rules Playground terlebih dahulu.
- Uji baca katalog tanpa login.
- Uji tambah/edit/hapus katalog dengan admin.
- Uji penolakan tulis katalog oleh pengunjung.
- Uji profil: pelanggan A tidak dapat membaca/mengubah profil pelanggan B dan tidak dapat mengubah role.
- Jangan mengaktifkan akses `orders`, `payments`, `ownerships`, atau `route_updates` sebelum backend dan validasinya siap.
