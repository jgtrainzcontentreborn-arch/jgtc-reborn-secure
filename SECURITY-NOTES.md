# Catatan audit keamanan awal

## Perubahan dalam paket

1. Aturan admin diperiksa di sisi Firestore melalui UID yang sudah tampak di HTML/Rules yang diberikan.
2. Koleksi katalog (`routes`, `payware`, `scenarios`, `freeware`, `tutorials`) dapat dibaca publik; hanya admin yang dapat menulis.
3. Pengaturan yang diperlukan UI publik (`payment`, `content`, `theme`, `form`) dapat dibaca publik dan hanya admin yang dapat menulis. `settings/admin` tetap admin-only.
4. `orders` dapat dibuat publik hanya dengan field yang ditentukan, nominal positif, dan status awal tetap `Menunggu Verifikasi`. Membaca, memperbarui, atau menghapus pesanan dibatasi untuk admin.
5. Semua path lain ditolak secara default.

## Batasan yang belum diselesaikan oleh Rules saja

- `nominalTransfer` masih nilai yang dikirim browser; Rules tidak dapat memastikan nilai cocok dengan harga produk terkini kecuali desain data/validasi dibuat lebih kuat.
- Endpoint publik untuk membuat pesanan berpotensi disalahgunakan untuk spam. Pertimbangkan Firebase App Check, backend/Cloud Functions, dan kontrol laju yang sesuai.
- UID admin hardcoded di rules adalah pengamanan yang lebih kuat daripada pemeriksaan HTML, tetapi custom claims yang dikelola dari lingkungan tepercaya lebih fleksibel untuk peran admin.
- Penggunaan `innerHTML` dalam HTML perlu audit XSS terpisah. File HTML dipertahankan tanpa modifikasi dalam paket ini agar tidak mengubah perilaku UI tanpa pengujian.
- Pastikan dokumen `settings/payment`, `settings/content`, `settings/theme`, dan `settings/form` tidak memuat data rahasia. Aturan publik dapat membaca semua field pada dokumen tersebut.

## Checklist uji manual

- [ ] Tanpa login: baca `routes` → ALLOW
- [ ] Tanpa login: baca `orders` → DENY
- [ ] Tanpa login: baca `settings/admin` → DENY
- [ ] Tanpa login: ubah `routes` → DENY
- [ ] Tanpa login: ubah `settings/payment` → DENY
- [ ] Tanpa login: buat pesanan dengan field valid/status awal → ALLOW
- [ ] Tanpa login: buat pesanan dengan status `LUNAS` → DENY
- [ ] Tanpa login: tambah field tak dikenal ke pesanan → DENY
- [ ] Admin yang sah: kelola katalog dan pesanan → ALLOW
- [ ] Pengguna login non-admin: operasi admin → DENY

Jangan tandai paket sebagai telah lulus audit penuh sebelum seluruh checklist diuji.
