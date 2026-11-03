# PETUNJUK FIREBASE — JGTC REBORN

## Kondisi konfigurasi paket
Paket proyek yang diaudit sudah memiliki konfigurasi web Firebase pada `firebase-config.js` dan UID admin utama. Nilai konfigurasi web Firebase boleh berada di frontend; jangan pernah memasukkan service-account private key atau kredensial server ke file website.

Keberadaan konfigurasi di file belum membuktikan bahwa Authentication, Firestore, domain, dan rules di Firebase Console sudah aktif/benar. Periksa project Firebase yang sesuai sebelum publikasi.

## Layanan yang digunakan saat ini
- Firebase Authentication: login admin email/password.
- Cloud Firestore: koleksi `addons` untuk katalog real-time.
- Firebase Storage dan Cloud Functions: belum diintegrasikan pada kode Tahap 1.

## Pemeriksaan project yang sudah ada
1. Buka Firebase Console dan pilih project yang `projectId`-nya sama dengan `firebase-config.js`.
2. Pada Authentication → Sign-in method, pastikan Email/Password aktif untuk login admin yang sudah ada.
3. Pada Authentication → Users, pastikan akun admin memiliki UID yang sama dengan `JGTC_ADMIN_UID` di `firebase-config.js`.
4. Pastikan Cloud Firestore sudah dibuat dan koleksi `addons` berisi katalog produksi yang benar.
5. Pastikan domain hosting website terdaftar pada Authentication → Settings → Authorized domains.
6. Ekspor/cadangkan koleksi katalog sebelum mengubah aturan keamanan.

## Aturan Firestore Tahap 1
File `firestore.rules` pada paket ini adalah baseline yang diperketat:
- `addons`: baca publik, tulis hanya admin utama (mempertahankan perilaku katalog lama).
- `users`: pengguna hanya dapat membaca profilnya sendiri; profil pelanggan hanya dapat dibuat dengan role `customer`; pengguna tidak dapat menaikkan role sendiri.
- `orders`, `payments`, `ownerships`, `route_updates`, `notifications`, `coupons`, `settings`, dan `admin_logs`: tetap ditolak sampai backend dan validasi setiap fitur selesai dibuat.
- Koleksi lain ditolak secara default.

**Penting:** Jangan langsung memublikasikan rules baru ke project produksi tanpa pengujian. Jalankan terlebih dahulu di Firebase Emulator atau Rules Playground. Uji katalog publik, operasi admin, akses profil sendiri, penolakan akses profil orang lain, dan penolakan perubahan role. Jika aplikasi produksi saat ini sudah memakai koleksi lain di luar `addons`, audit penggunaan koleksi tersebut sebelum menerapkan rules baru.

## Uji regresi katalog lama
1. Buka website tanpa login; seluruh kategori dan katalog harus tetap terbaca.
2. Login memakai akun admin utama.
3. Tambahkan satu item uji, edit, lalu hapus item uji tersebut.
4. Uji ekspor dan impor JSON menggunakan file cadangan.
5. Buka website di browser lain; perubahan katalog seharusnya tersinkron.
6. Pastikan pengguna non-admin tidak dapat menulis ke `addons`.

## Tahap berikutnya
Akun pembeli memerlukan pengaktifan Google provider jika opsi login Google akan digunakan. Upload bukti pembayaran dan file download privat memerlukan Firebase Storage Rules. Pembuatan pesanan, validasi harga, konfirmasi pembayaran, dan pemberian kepemilikan perlu Cloud Functions/backend tepercaya. Modul tersebut belum diaktifkan pada Tahap 1 agar tidak membuka akses data transaksi sebelum validasinya siap.
