# JGTC REBORN — paket website dan keamanan Firebase

Paket ini mempertahankan HTML JGTC REBORN yang diberikan, termasuk identitas visual dan struktur koleksi Firestore. `index.html` sengaja disalin tanpa perubahan untuk menghindari perubahan UI atau perilaku aplikasi yang tidak diuji.

## Isi paket

- `index.html` — website JGTC REBORN dari file yang diunggah.
- `firestore.rules` — aturan Firestore untuk katalog publik, pengaturan toko, pesanan, dan akses admin.
- `firebase.json` — konfigurasi Firebase CLI untuk Rules dan emulator.
- `.gitignore` — mencegah file kredensial lokal masuk ke Git.
- `SECURITY-NOTES.md` — catatan audit dan prosedur pengujian.

## Penting sebelum produksi

**Jangan langsung menerapkan Rules ke database produksi tanpa pengujian.** Cadangan data tetap disimpan. Rules tidak menghapus dokumen, tetapi aturan yang tidak cocok dapat membuat fungsi website gagal.

Aturan pada paket ini mengizinkan publik membaca dokumen `settings/payment`, `settings/content`, `settings/theme`, dan `settings/form` karena HTML memuat pengaturan tersebut untuk tampilan publik. Pastikan dokumen-dokumen itu hanya berisi informasi yang memang boleh dilihat pengunjung. Dokumen `settings/admin` hanya dapat dibaca admin.

Aturan mengizinkan pengunjung membuat pesanan dengan status awal `Menunggu Verifikasi`; pengunjung tidak dapat membaca, mengubah, atau menghapus pesanan. Validasi harga terhadap katalog tepercaya dan mitigasi spam yang kuat memerlukan desain backend tambahan; Rules saja tidak dapat membuktikan nominal transfer benar-benar dibayar.

## Uji sebelum menerapkan

1. Simpan paket ini dan pertahankan cadangan Firestore yang sudah dibuat.
2. Instal Node.js LTS dan Firebase CLI.
3. Di folder proyek, jalankan `firebase login` lalu `firebase use jgtc-store-62ca6`.
4. Jalankan `firebase emulators:start --only firestore` untuk uji lokal. Untuk pengujian aturan yang otomatis, tambahkan Firebase Rules Unit Testing (`@firebase/rules-unit-testing`) sebelum produksi.
5. Uji bahwa publik dapat membaca katalog dan pengaturan publik; publik ditolak saat membaca `orders`, mengubah katalog/settings, mengubah/menghapus pesanan, atau membaca `settings/admin`; dan admin yang benar dapat mengelola data.
6. Setelah hasil tes benar dan website diuji, baru terapkan Rules melalui proses deployment yang Anda pahami, misalnya `firebase deploy --only firestore:rules`.

## GitHub Pages

Untuk publikasi statis, unggah `index.html` ke repository GitHub dan aktifkan GitHub Pages melalui Settings → Pages. File `firestore.rules` perlu dikelola terpisah dan tidak otomatis diterapkan hanya karena diunggah ke GitHub Pages.

## Catatan konfigurasi

Firebase web config dan UID admin yang ada di HTML bukan rahasia server. Keamanan akses data bergantung pada Firestore Rules dan konfigurasi Firebase. Jangan pernah memasukkan private key service account ke HTML, repository publik, atau file yang diunduh pengunjung.
