# JGTC REBORN — Tahap 5: Penjualan Rute dan Update / Perpanjang Rute

Tahap 5 dibangun di atas paket Tahap 4. File dan alur katalog, akun pembeli, keranjang produk, checkout, pembayaran manual, verifikasi admin, serta riwayat pembelian tetap dipertahankan.

## Fitur baru

### Pembeli
- Menu **Update / Perpanjang Rute**.
- Daftar pilihan update yang diaktifkan admin.
- Status apakah akun sudah memiliki rute dasar.
- Pemeriksaan versi rute yang dimiliki terhadap versi prasyarat update.
- Menambahkan update rute ke keranjang bersama produk biasa.
- Checkout satu pesanan untuk produk dan/atau update rute.
- Riwayat transaksi tetap menggunakan koleksi `orders` yang sama.
- Setelah pembayaran update disetujui, versi kepemilikan rute dinaikkan dan akses download update tersedia.

### Admin utama
- Form untuk memilih rute Indonesia, versi baru, versi sebelumnya yang wajib dimiliki, harga, deskripsi, tautan HTTPS, atau path Firebase Storage.
- Mengaktifkan, mengedit, dan menonaktifkan pilihan update.
- Menonaktifkan update tidak menghapus dokumen, agar referensi pesanan lama tetap aman.

## Struktur data

Koleksi baru: `route_updates/{routeUpdateId}`

Field utama:
- `routeAddonId`: ID dokumen pada koleksi `addons` untuk rute dasarnya.
- `version`: versi tujuan setelah update.
- `requiredPreviousVersion`: versi kepemilikan yang harus dimiliki pembeli.
- `price`: harga dalam integer Rupiah.
- `description`: catatan perubahan.
- `active`: status ketersediaan.
- `downloadPath`: path privat opsional, harus di bawah `product-files/`.
- `url`: tautan download eksternal opsional, HTTPS saja.
- `createdAt`, `updatedAt`, `updatedBy`.

Dokumen `orders` tetap menggunakan koleksi Tahap 3/4 yang sama. Item biasa memiliki `type: addon`; item pembaruan rute memiliki `type: route_update`, `routeUpdateId`, `addonId`, versi tujuan, versi prasyarat, harga, dan snapshot informasi download.

Koleksi `ownerships` tetap digunakan. Setelah pembelian rute disetujui, sistem menyimpan `currentVersion`. Setelah update disetujui, `currentVersion` dinaikkan dan riwayat update ditambahkan. Dokumen kepemilikan lama yang belum memiliki `currentVersion` menggunakan field baru `routeVersion` pada dokumen `addons` sebagai fallback. Field `version` yang sudah ada tetap berarti kompatibilitas Trainz (misalnya TRS19/TRS22), bukan versi rilis rute.

## Keamanan

- Harga, status aktif, identitas rute, kepemilikan, dan versi prasyarat divalidasi ulang di Cloud Functions.
- Browser tidak dapat menulis langsung ke `route_updates`, `orders`, `payments`, atau `ownerships`.
- Pelanggan harus memiliki dokumen ownership rute yang sesuai sebelum membeli update.
- Persetujuan pembayaran memeriksa ulang versi ownership dalam transaksi Firestore agar dua update berurutan tidak disetujui untuk versi dasar yang sudah berubah.
- Akses download update tetap mensyaratkan pembayaran lunas dan pemilik pesanan yang sama.
- File privat di Firebase Storage diberikan melalui signed URL sementara; tautan eksternal hanya menerima HTTPS.
- Admin utama tetap UID lama: `wkPmVZUdYFdO0P3McTiimxtHbg03`.

## Cara deploy

1. Buat backup proyek Firebase dan unduh salinan Firestore/Storage penting sebelum deployment.
2. Ekstrak ZIP Tahap 5 dan pastikan `firebase-config.js` tetap menunjuk ke project Firebase JGTC REBORN yang benar.
3. Pastikan Firebase Authentication, Firestore, Functions, dan Storage sudah aktif.
4. Dari folder root proyek jalankan:

   ```bash
   firebase login
   firebase use <PROJECT_ID_FIREBASE_JGTC>
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

5. Deploy rules yang sudah ada:

   ```bash
   firebase deploy --only firestore:rules,storage
   ```

6. Login dengan akun admin utama, buka **Panel Admin → Manajemen update / perpanjang rute**.
7. Pastikan katalog memiliki produk dengan kategori persis `Rute Indonesia`, bukan data contoh.
8. Buat pilihan update, misalnya rute `Rute A`, versi baru `2.0`, versi sebelumnya `1.0`, harga `50000`.
9. Pada Panel Admin → form produk, isi field baru **Versi rute / produk** (`routeVersion`) untuk setiap rute yang dijual. Field **Versi Trainz / kompatibilitas** (`version`) tetap diisi seperti sebelumnya. Pastikan `routeVersion` cocok dengan versi awal yang dimiliki pelanggan. Field `version` tetap dipakai untuk kompatibilitas Trainz, bukan nomor versi rilis rute.
10. Pastikan download update sudah tersedia pada `product-files/` (privat) atau tautan HTTPS resmi. Masukkan path/URL tersebut ke pilihan update.
11. Uji menggunakan akun pelanggan yang telah memiliki rute dan dokumen `ownerships`.
12. Buat pesanan update, unggah bukti transfer, lalu setujui pembayaran dari akun admin. Pastikan `currentVersion` berubah dan tombol akses download muncul pada riwayat pembelian.

## Catatan migrasi kepemilikan lama

Pembelian yang disetujui sebelum Tahap 5 mungkin memiliki dokumen `ownerships` tanpa `currentVersion`. Sistem mencoba menggunakan `addons.version` sebagai versi dasar. Sebelum menjual update untuk rute lama, pastikan field `routeVersion` pada dokumen rute di katalog sudah terisi benar. Jika versi ownership lama berbeda dari versi katalog, lakukan penyesuaian data melalui Admin SDK / prosedur migrasi terkontrol, bukan dari browser pelanggan.

## Pengujian yang wajib dilakukan

- Pelanggan tanpa rute tidak dapat membeli update.
- Pelanggan dengan versi yang salah tidak dapat membeli update.
- Harga yang diubah di browser/localStorage tidak mengubah harga pesanan server.
- Update nonaktif tidak dapat dibeli meskipun ID masih tersimpan di keranjang.
- Pesanan update tetap memakai pembayaran manual Tahap 4.
- Pembayaran ditolak tidak mengubah versi ownership.
- Pembayaran disetujui mengubah versi ownership satu kali.
- Download update tidak tersedia sebelum pembayaran disetujui.
- Pelanggan tidak dapat membaca pesanan atau ownership pelanggan lain.

## Batas pengujian paket

Pemeriksaan sintaks lokal tidak menggantikan pengujian pada project Firebase pemilik website. ZIP ini belum dideploy ke Firebase produksi dan tidak mengklaim transaksi, upload, atau download nyata telah diuji.
