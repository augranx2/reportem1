# Catatan Perubahan — EM Viable Dashboard

## ⚠️ Langkah wajib setelah update

1. **Deploy ulang website** (Vercel akan build otomatis setelah push).
2. **Tempel ulang `Code.gs`** ke Apps Script, lalu
   *Deploy → Manage deployments → edit (pensil) → New version → Deploy*.
   URL `/exec` tidak berubah, jadi `public/config.js` tidak perlu disentuh.
3. Isi konstanta **`REPORT_EM_TGL_BERLAKU`** di `Code.gs` (baris ~100) dengan
   tanggal berlaku formulir FM.QC.062/R3, mis. `"1 Maret 2024"`. Selama masih
   kosong, kolom "Tgl Berlaku" pada cetakan tetap menampilkan `-`.
4. (Opsional) Tambahkan Environment Variable **`GEMINI_MODEL`** di Vercel kalau
   ingin mengunci model tertentu.

---

## 0. Data pengujian sekarang wajib login

Sebelumnya seluruh data bisa dibaca **tanpa akun sama sekali** — bukan hanya di
tampilan web ("mode publik"), tapi juga dengan membuka URL `/exec` Apps Script
langsung dengan parameter yang benar. Sekarang:

- **Di server (`Code.gs`)**: setiap aksi baca wajib membawa token sesi yang masih
  berlaku. Tanpa token, server menjawab
  *"Silakan masuk terlebih dahulu untuk melihat data pengujian."* Ini pengamanan
  yang sesungguhnya — memblokir di sisi tampilan saja tidak cukup karena API-nya
  masih bisa dipanggil langsung.
- **Yang tetap publik**: `statusIndex` (ringkasan status untuk **Dashboard
  Global** — tidak memuat satu pun angka hasil pengujian, nama ruangan, atau
  tanggal sampling), `whoami` (memvalidasi token tersimpan), dan `verify` —
  halaman hasil scan QR tetap bisa dibuka siapa saja dan hanya menampilkan info
  tanda tangan.
- **Di website**: Dashboard Global tetap bisa dilihat tanpa login. Begitu masuk
  ke detail fasilitas, pengunjung tanpa akun melihat layar **"Masuk untuk
  melihat detail fasilitas"**. Banner "mode publik" yang lama sudah tidak
  berlaku lagi.

> ⚠️ Perubahan ini hanya aktif setelah `Code.gs` ditempel ulang dan
> **di-deploy versi baru** di Apps Script.

## 1. Teks pemuatan data

Kata "spreadsheet" dihapus dari seluruh teks yang dilihat pengguna — itu detail
teknis internal yang tidak perlu diketahui pemakai.

| Sebelum | Sesudah |
|---|---|
| Memuat data dari spreadsheet... | **Memuat data…** |
| Gagal memuat data dari spreadsheet: … | Gagal memuat data: … |
| Gagal memuat status dari spreadsheet: … | Gagal memuat status fasilitas: … |
| Memuat sesi... / Memuat... | Memuat sesi… / Memuat… |

## 2. Unduh Audit Trail

Halaman **Riwayat Aktivitas** sekarang punya:

- Tombol **Unduh CSV** — muncul untuk **Administrator** dan seluruh akun
  **departemen QA**. File diberi nama `Audit_Trail_EM_Viable_<tanggal>.csv`,
  memakai BOM UTF-8 + penanda `sep=,` supaya langsung rapi saat dibuka di Excel
  versi Indonesia maupun Inggris.
- **Kotak pencarian** (nama, aksi, fasilitas, bulan, detail). Yang terunduh
  mengikuti hasil pencarian, jadi bisa mengekspor per orang atau per fasilitas.
- Batas riwayat di server dinaikkan dari **300 → 2000** catatan agar unduhan
  cukup panjang untuk keperluan audit/inspeksi.

## 3. Tujuh temuan yang diperbaiki

### 3.1 Pusat Notifikasi kini berfungsi
Sidebar dan lonceng di header sudah lama punya UI notifikasi lengkap, tapi tidak
ada yang mengirim datanya, dan menu "Pusat Notifikasi" justru nyasar ke halaman
fasilitas. Sekarang:

- Fungsi `buildNotifications()` menyusun daftar dari status seluruh fasilitas.
- Ada halaman **Pusat Notifikasi** tersendiri; tiap item bisa diklik langsung ke
  fasilitas terkait.
- **Periode notifikasi mengikuti pemilih bulan di header.** Ganti bulan ke Juli,
  maka temuan Juli yang muncul. Mengklik notifikasi membuka fasilitas **dan**
  periodenya sekaligus.
- **Bulan yang masih berjalan diperlakukan khusus.** Untuk bulan berjalan, item
  "belum ada data" dan pengingat Pengkajian EM tidak ditampilkan — samplingnya
  memang belum selesai, jadi kalau ditampilkan hanya jadi peringatan palsu tiap
  awal bulan. Temuan nyata (Alert/Action/Melebihi Syarat) tetap muncul. Sebagai
  gantinya, saat bulan berjalan yang dipilih, **periode sebelumnya ikut
  dievaluasi penuh** sehingga pengingat "bulan lalu belum lengkap" tetap sampai
  tanpa perlu ganti bulan dulu. Tiap item diberi label periodenya masing-masing.
- Isi notifikasi: hasil melebihi Syarat (merah), hasil mencapai Action/Alert
  Limit (kuning), belum ada data, serta pengingat khusus QA/Administrator soal
  Pengkajian EM yang belum disusun / belum final.
- `getStatusIndex_` di `Code.gs` diperkaya dengan `hasReport`, `finalApproved`,
  dan `formulirQCComplete` untuk menopang notifikasi tersebut.

### 3.2 Kelas Tailwind v4 di project v3
`shadow-xs`, `shadow-2xs`, `backdrop-blur-xs`, `py-0.2` diganti padanan v3 yang
benar; `animate-fade-in` dan `scrollbar-thin` dihapus karena keyframes/plugin-nya
memang tidak pernah ada. Sebelumnya kelas-kelas ini tidak menghasilkan style
apa pun.

### 3.3 Status Dashboard vs halaman detail bisa berbeda
`levelFor_` di `Code.gs` memakai `Number()` polos sehingga nilai `"<1"` menjadi
`NaN` dan dianggap "belum diuji". Ditambahkan `parseNumericValue_()` yang
logikanya sama persis dengan sisi website.

### 3.4 Risiko data tertimpa saat menyimpan
`saveEntries_` menghapus lalu menulis ulang seluruh baris bulan terkait. Kalau
dua orang menyimpan bersamaan, salah satu bisa menimpa pekerjaan yang lain.
Sekarang `saveEntries_` dan `saveReport_` dibungkus **`LockService`** (tunggu
maksimal 20 detik) plus `SpreadsheetApp.flush()`. Kalau sedang terkunci, muncul
pesan yang jelas untuk mencoba lagi.

### 3.5 Pelanggaran Rules of Hooks
Pengecekan `/verify` dulu berupa *early return* di dalam `App()`, membuat semua
hook di bawahnya menjadi hook bersyarat. Sekarang dipisah: `Root()` yang memilih
antara `<VerifyPage />` dan `<App />`.

### 3.6 Duplikasi tabel LIMITS
Tabel Persyaratan/Alert/Action beserta helper-nya (`parseNumericValue`,
`getStatus`, `displayValue`, `fullDateID`, `monthLabel`, dll.) dulu ditulis ulang
di `App.jsx` **dan** `narrativeGenerator.js`. Sekarang dipusatkan di
**`src/limits.js`** dan di-import keduanya. `App.jsx` menyusut ±150 baris, dan
ikon lucide yang tidak terpakai (24 buah) ikut dibersihkan.

> `Code.gs` tetap punya salinan sendiri karena Apps Script berjalan terpisah dan
> tidak bisa meng-import file ini — sudah diberi komentar pengingat di kedua
> file kalau angka limit diubah.

### 3.7 Perbaikan kecil
- **Tgl Berlaku formulir QC** tidak lagi hardcode string kosong; kini datang dari
  konstanta `REPORT_EM_TGL_BERLAKU` di `Code.gs` (lihat langkah wajib no. 3).
- **Tindak Lanjut** dan **Rekomendasi Akhir** — dua kolom yang sudah lama
  tersimpan di tab `Laporan_Narasi` tapi tidak pernah punya tempat di layar —
  sekarang bisa diisi QA dan ikut tercetak. (`kesanUmum` dan `observasiKritis`
  sengaja tidak ditampilkan tapi tetap ikut tersimpan agar data lama tidak
  hilang. Bilang saja kalau mau kolom ini dihapus atau ditampilkan juga.)
- **`config.js` di root dihapus** — hanya `public/config.js` yang benar-benar
  dipakai Vite. Komentarnya juga diperbaiki dari "Netlify" ke Vercel.
- **`randomHex_`** tidak lagi memakai `Math.random()` (tidak aman untuk salt
  password & token sesi), diganti sumber entropi `Utilities.getUuid()`.
- **Model Gemini** `gemini-3.6-flash` tidak ada di katalog Gemini API, jadi setiap
  permintaan pasti gagal dan website selalu jatuh ke narasi non-AI. Kini model
  bisa diatur lewat env `GEMINI_MODEL`, dengan urutan cadangan otomatis
  `gemini-3-flash-preview` → `gemini-2.5-flash` bila model utama 404/403.

---

## Yang belum disentuh (silakan bilang kalau mau dikerjakan)

- Hash password masih SHA-256 satu putaran. Memperkuatnya (iterasi berulang)
  akan membuat semua password lama tidak cocok, jadi butuh strategi migrasi
  tersendiri.
- Tab `Sessions` dan `Audit_Log` tumbuh tanpa batas dan dipindai penuh setiap
  permintaan. Untuk jangka panjang perlu pembersihan sesi kedaluwarsa terjadwal.
- Nomor halaman saat mencetak (`@page { @bottom-right }`) tidak didukung Chrome,
  jadi tetap tidak muncul.
