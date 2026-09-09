// Vercel Serverless Function: /api/generate-narrative
// Menerima data ringkasan EM Viable dari website, memanggil Gemini API
// (Google AI Studio) untuk menyusun narasi, dan mengembalikan hasilnya.
//
// PENTING: GEMINI_API_KEY diambil dari Environment Variable di Vercel,
// BUKAN ditulis langsung di file ini. Ini supaya API key tidak ikut ter-upload
// ke GitHub/repo publik (kalau repo-nya publik, siapa pun bisa mencuri
// dan memakai API key tersebut atas biaya Anda).
//
// Cara set di Vercel:
// 1. Buka project di dashboard Vercel -> Settings -> Environment Variables
// 2. Tambahkan: Name = GEMINI_API_KEY, Value = (API key Gemini Anda)
// 3. Pilih semua environment (Production, Preview, Development), lalu Save
// 4. Redeploy project agar env var terbaca

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "GEMINI_API_KEY belum diset di Environment Variables Vercel. Buka Settings > Environment Variables lalu tambahkan GEMINI_API_KEY, kemudian redeploy.",
    });
    return;
  }

  let payload;
  try {
    payload = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    res.status(400).json({ error: "Body request tidak valid" });
    return;
  }

  const { facilityLabel, monthLabel, classes, stats, prevSummary } = payload;

  const prompt = `Anda adalah QA Apoteker berpengalaman di industri farmasi Indonesia yang menyusun bagian pembahasan untuk dokumen resmi "Pengkajian Trend Data Environment Monitoring (EM) Viable" (No. Formulir QA.FM.156), mengacu pada Standar CPOB tahun 2024 dan 2025 yang berlaku.
Fasilitas: ${facilityLabel}
Periode: ${monthLabel}
Ringkasan kesimpulan bulan sebelumnya: ${prevSummary || "Tidak ada data bulan sebelumnya."}
Data ringkasan per kelas ruangan — untuk tiap parameter (settle/contact/air) berisi limit Alert/Action/Syarat, nilai tertinggi (lokasi + tanggal), dan apakah seluruh hasil <1 CFU; juga daftar titik yang mencapai Alert/Action/Melebihi Syarat:
${JSON.stringify(stats, null, 2)}

Tulis narasi Bahasa Indonesia formal ala dokumen QA farmasi (gaya umum yang mudah dipahami, bukan bahasa akademis berat), mengacu HANYA pada data di atas — jangan mengarang angka, lokasi, atau tanggal yang tidak ada di data. Untuk tiap kelas, ikuti struktur berikut PERSIS (gunakan judul sub-bagian ini apa adanya, masing-masing diikuti baris baru lalu isinya, dan pisahkan tiap sub-bagian dengan baris kosong):

<1-2 kalimat pembuka menjelaskan fungsi/peran kelas ruangan tersebut>

Hasil dan Tren Settle Plate
<sebutkan nilai tertinggi berikut lokasi & tanggal, bandingkan dengan Alert Limit dan Action Limit>

Hasil dan Tren Contact Plate
<sama seperti di atas untuk parameter contact plate>

Hasil dan Tren Air Sampler
<sama seperti di atas untuk parameter air sampler>

Kesimpulan
<1-2 kalimat kesimpulan kelas ini — gunakan kata "terkendali", JANGAN gunakan istilah "state of control" atau istilah Inggris lain yang tidak perlu>

(Lewati sub-bagian untuk parameter yang tidak ada datanya di kelas tersebut, mis. Kelas A/E tidak selalu punya ketiga parameter.)

KETENTUAN PENTING soal istilah dan tingkat tindak lanjut. Ada TIGA tingkat, jangan dicampur:
1. Mencapai ALERT LIMIT (masih di bawah Action Limit) — kondisi masih AMAN dan NORMAL. JANGAN sebut "penyimpangan", jangan sebut "OOT", dan JANGAN sarankan tindakan apa pun yang berat: tidak perlu investigasi, tidak perlu CAPA, tidak perlu sampling ulang. Cukup nyatakan bahwa nilai tersebut menjadi informasi awal yang dikoordinasikan di internal QC dan dipantau pada periode berikutnya.
2. Melampaui ACTION LIMIT tetapi MASIH DI BAWAH batas Syarat (spesifikasi) — sebut sebagai "Out of Trend (OOT)". Ini BUKAN penyimpangan. Penanganannya: pengambilan sampel ulang segera pada titik terkait, disertai investigasi ringan bila diperlukan. Boleh menyinggung peninjauan efektivitas sanitasi/higiene personel pada area terkait.
3. MELAMPAUI batas Syarat (spesifikasi) — barulah disebut tidak memenuhi syarat (TMS) dan dikategorikan sebagai "penyimpangan". Penanganannya: proses pada area terkait dihentikan sementara, dilakukan investigasi beserta tindakan perbaikan, kemudian pengambilan sampel ulang sampai diperoleh hasil yang memenuhi syarat.
Gunakan field "kategori" pada tiap item "breaches" untuk menentukan tingkat mana yang berlaku. Kata "penyimpangan" HANYA untuk tingkat 3.

KETENTUAN soal SAMPLING ULANG: tiap temuan membawa field "statusTindakLanjut" dan "tindakLanjut". Wajib patuhi ini:
- "tidak perlu" (hanya Alert Limit): jangan bahas sampling ulang sama sekali untuk temuan itu.
- "selesai": sampling ulang SUDAH dilakukan dan hasilnya sudah memenuhi syarat. Tulis dalam bentuk lampau — sebutkan tanggal dan nilai hasil sampling ulangnya, lalu nyatakan temuan tersebut telah selesai ditindaklanjuti. JANGAN menyuruh melakukan sampling ulang lagi untuk temuan ini.
- "masih di luar batas": sampling ulang sudah dilakukan tapi hasilnya masih di luar batas. Sarankan investigasi lanjutan beserta tindakan perbaikan.
- "belum ditindaklanjuti": barulah sarankan pengambilan sampel ulang sesegera mungkin.

PENTING soal STRUKTUR: seluruh pembahasan temuan — OOT maupun penyimpangan, termasuk hasil sampling ulangnya — ditulis MENYATU di dalam pembahasan parameter masing-masing (Settle Plate / Contact Plate / Air Sampler). JANGAN membuat bagian terpisah bernama "Tindak Lanjut", "Rekomendasi", atau sejenisnya.

Bila SELURUH temuan yang wajib ditindaklanjuti sudah berstatus "selesai", kesimpulan akhir harus menyatakan bahwa kondisi lingkungan telah kembali terkendali setelah sampling ulang, bukan bahwa fasilitas masih memerlukan tindak lanjut.

Untuk "kesimpulanUmum": tulis ringkasan akhir seluruh kelas pada periode ini (bukan per-kelas lagi, tapi rekap singkat tiap kelas digabung jadi satu narasi mengalir, 5-8 kalimat/beberapa paragraf pendek), kaitkan dengan kondisi bulan sebelumnya bila relevan, gunakan kata "terkendali" (bukan "state of control"), terapkan ketentuan istilah "penyimpangan" di atas secara konsisten, dan DIAKHIRI dengan pernyataan tegas apakah fasilitas ini memenuhi persyaratan Standar CPOB tahun 2024 dan 2025 yang berlaku serta status kualifikasi lingkungan periode ini.

Balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan struktur persis:
{
  "perKelas": { "<KODE_KELAS>": "narasi lengkap kelas ini mengikuti struktur di atas", ... satu entri untuk tiap kelas berikut: ${(classes || []).join(", ")} },
  "kesimpulanUmum": "ringkasan akhir seluruh kelas sesuai ketentuan di atas"
}`;

  // Nama model sebelumnya ditulis "gemini-3.6-flash" — nama itu tidak ada di
  // katalog Gemini API, jadi setiap permintaan pasti gagal 404 dan website
  // selalu jatuh ke narasi otomatis non-AI. Sekarang model bisa diatur lewat
  // Environment Variable GEMINI_MODEL di Vercel, dan kalau model utama tidak
  // tersedia, kode akan mencoba daftar cadangan di bawah secara berurutan.
  const models = [
    process.env.GEMINI_MODEL,
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
  ].filter(Boolean);

  async function callGemini(model) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Gemini API error (HTTP ${res.status}) pada model "${model}": ${errText}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  try {
    let data = null;
    let lastErr = null;
    for (const model of models) {
      try {
        data = await callGemini(model);
        break;
      } catch (err) {
        lastErr = err;
        // 404 = model tidak dikenal, 403 = tidak punya akses ke model itu.
        // Selain itu (kuota habis, error jaringan) tidak ada gunanya mencoba
        // model lain, jadi langsung dilempar.
        if (err.status !== 404 && err.status !== 403) throw err;
      }
    }
    if (!data) throw lastErr || new Error("Tidak ada model Gemini yang bisa dipakai.");
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleanText = text
      .replace(/^```json\n?/i, "")
      .replace(/^```\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanText);

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
