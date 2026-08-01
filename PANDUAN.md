# Catatan Kinerja Guru — SMP Al Hikmah IIBS Batu
### Versi realtime: React + Firebase (Firestore + Authentication)

Kepala Sekolah mencatat dan menilai kinerja guru; setiap guru login dan melihat
laporan kinerjanya **sendiri**, diperbarui **realtime** setiap kali Anda
menyimpan penilaian baru. Akses guru ke data guru lain ditolak oleh server
(Firestore Security Rules), bukan sekadar disembunyikan di tampilan.

---

## A. Siapkan Project Firebase (± 10 menit, gratis)

1. **https://console.firebase.google.com** → login Gmail pribadi → **Add project**
   → nama bebas, mis. `kinerja-guru-alhikmah`.
2. **Build → Authentication** → *Get started* → tab **Sign-in method** →
   aktifkan **Email/Password**.
3. **Build → Firestore Database** → *Create database* → lokasi
   **asia-southeast2 (Jakarta)** → mulai **production mode**.
4. **Project settings** (ikon gerigi) → **General** → *Your apps* → ikon
   web **`</>`** → daftarkan app → salin objek **firebaseConfig**.

## B. Isi Konfigurasi

Buka **`src/firebase.js`**, ganti semua `ISI_...` dengan nilai dari
firebaseConfig Anda.

## C. Pasang Security Rules (WAJIB)

Salin seluruh isi **`firestore.rules`** → Firebase Console →
**Firestore Database → Rules** → tempel → **Publish**.
Tanpa ini database tertutup total (production mode) dan aplikasi tak bisa
membaca apa pun.

## D. Buat Akun Admin Pertama

1. Console → **Authentication → Users → Add user** → isi email & password
   Anda → catat **User UID**.
2. Console → **Firestore Database → Data** → **Start collection** →
   ID: `users` → Document ID: **tempel UID tadi** → tambahkan field:
   - `peran` (string): `admin`
   - `nama` (string): nama Anda
3. Login pertama memakai email & password ini.

## E. Jalankan Lokal (uji coba)

Prasyarat: Node.js 18+.

```bash
npm install
npm run dev
```

Buka http://localhost:5173, login admin, isi data guru pertama.

## F. Publish Agar Diakses Guru

### Vercel (gratis, tercepat)
1. Unggah folder ini ke repository **GitHub**.
2. **vercel.com** → login GitHub → **Add New → Project** → pilih repo →
   Vite terdeteksi otomatis → **Deploy**.
3. Dapat URL, mis. `https://kinerja-guru.vercel.app` — bagikan ke guru.
4. **Wajib:** Firebase Console → **Authentication → Settings →
   Authorized domains** → **Add domain** → masukkan domain Vercel Anda.
   Tanpa ini, login dari situs live ditolak.

Setiap push ke GitHub akan otomatis ter-deploy ulang. Data tidak ikut
hosting — data hidup di Firebase, sehingga selalu terkini dari perangkat
mana pun.

### Alternatif — Firebase Hosting
```bash
npm run build
npx firebase-tools login
npx firebase-tools init hosting   # public dir: dist, SPA: yes
npx firebase-tools deploy
```

## G. Operasional Sehari-hari

**Membuat akun guru:** login admin → tab **Akun & Token** → *Buat Akun Guru*
→ pilih nama, isi email & password awal (min. 6 karakter) → sampaikan ke
guru dan sarankan segera ganti password lewat "Lupa password" di halaman
masuk.

**Yang dilihat guru:** setelah login, langsung laporan kinerjanya sendiri —
skor total, grafik radar, rincian tugas dan penilaiannya — dengan penanda
realtime di bagian atas. Setiap kali Anda mengubah penilaian tugas atau
menambah catatan kinerja untuknya, angka di layar guru berubah **otomatis
tanpa refresh**, karena keduanya membaca koleksi Firestore yang sama lewat
`onSnapshot`.

**Reset password guru:** tab Akun → *Kirim Reset Password*.

**Menghapus guru:** menghapus dari tab Data Guru otomatis membersihkan
seluruh tugas, catatan, dan peran akunnya di Firestore. Akun di
**Authentication** perlu dinonaktifkan/dihapus manual dari Console (SDK
sisi klien tidak diizinkan menghapus akun orang lain).

**Backup:** Firestore bisa diekspor dari Console; untuk rekap rutin pakai
tombol **Ekspor CSV** di tab Laporan.

## H. Batas Paket Gratis (Spark)

Kuota harian Firestore: 50.000 baca, 20.000 tulis — jauh melebihi kebutuhan
sekolah dengan puluhan guru. Email/password Authentication tidak berbayar.
Vercel gratis untuk skala ini.

## I. Struktur Proyek

```
├── index.html
├── package.json
├── vite.config.js
├── firestore.rules        ← tempel ke Firebase Console → Rules
├── PANDUAN.md              ← file ini
└── src/
    ├── main.jsx            ← titik masuk React
    ├── firebase.js         ← ISI KONFIGURASI ANDA DI SINI
    ├── api.js              ← lapisan Firestore & Auth (realtime)
    └── App.jsx             ← seluruh antarmuka aplikasi
```
