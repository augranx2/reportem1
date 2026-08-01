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

Untuk "kesimpulanUmum": tulis ringkasan akhir seluruh kelas pada periode ini (bukan per-kelas lagi, tapi rekap singkat tiap kelas digabung jadi satu narasi mengalir, 5-8 kalimat/beberapa paragraf pendek), kaitkan dengan kondisi bulan sebelumnya bila relevan, gunakan kata "terkendali" (bukan "state of control"), dan DIAKHIRI dengan pernyataan tegas apakah fasilitas ini memenuhi persyaratan Standar CPOB tahun 2024 dan 2025 yang berlaku serta status kualifikasi lingkungan periode ini.

Balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan struktur persis:
{
  "perKelas": { "<KODE_KELAS>": "narasi lengkap kelas ini mengikuti struktur di atas", ... satu entri untuk tiap kelas berikut: ${(classes || []).join(", ")} },
  "kesimpulanUmum": "ringkasan akhir seluruh kelas sesuai ketentuan di atas"
}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error (HTTP ${geminiRes.status}): ${errText}`);
    }

    const data = await geminiRes.json();
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
