// =============================================================================
// SUMBER TUNGGAL (single source of truth) untuk tabel Persyaratan/Alert/Action
// dan helper turunannya.
//
// Sebelumnya konstanta LIMITS + helper parseNumericValue/getStatus/displayValue
// ditulis ulang di App.jsx DAN di narrativeGenerator.js, sehingga kalau angka
// limit berubah harus diedit di banyak tempat dan rawan tidak sinkron.
// Sekarang semuanya dipusatkan di file ini.
//
// CATATAN: Code.gs (Google Apps Script) tidak bisa meng-import file ini karena
// jalan di lingkungan terpisah. Kalau angka LIMITS di bawah diubah, salin juga
// perubahannya ke konstanta LIMITS di Code.gs.
// =============================================================================

export const CLASS_ORDER = ["E", "D", "C", "B", "A"];

export const PARAM_DEFS = [
  { key: "settle", label: "Cawan Papar (Settle Plate)", short: "Settle Plate" },
  { key: "contact", label: "Cawan Kontak (Contact Plate)", short: "Contact Plate" },
  { key: "air", label: "Air Sampler", short: "Air Sampler" },
];

export const LIMITS = [
  { parameter: "settle", kelas: "E", syarat: 200, alert: 88, action: 119 },
  { parameter: "settle", kelas: "D", syarat: 100, alert: 70, action: 95 },
  { parameter: "contact", kelas: "D", syarat: 50, alert: 9, action: 13 },
  { parameter: "air", kelas: "D", syarat: 200, alert: 138, action: 176 },
  { parameter: "settle", kelas: "C", syarat: 50, alert: 13, action: 18 },
  { parameter: "contact", kelas: "C", syarat: 25, alert: 14, action: 20 },
  { parameter: "air", kelas: "C", syarat: 100, alert: 51, action: 68 },
  { parameter: "settle", kelas: "B", syarat: 5, alert: 2, action: 3 },
  { parameter: "contact", kelas: "B", syarat: 5, alert: 2, action: 3 },
  { parameter: "air", kelas: "B", syarat: 10, alert: 5, action: 7 },
  { parameter: "settle", kelas: "A", syarat: 1, alert: 1, action: 1, lessThan: true },
  { parameter: "contact", kelas: "A", syarat: 1, alert: 1, action: 1, lessThan: true },
  { parameter: "air", kelas: "A", syarat: 1, alert: 1, action: 1, lessThan: true },
];

export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Istilah mengikuti pembagian tindak lanjut yang berlaku:
// - Alert Limit  : masih aman/normal, cukup dikoordinasikan internal QC.
// - Action Limit : OOT (Out of Trend) — perlu sampling ulang segera dan bila
//                  perlu investigasi ringan, tetapi BUKAN penyimpangan karena
//                  masih di bawah batas Syarat.
// - > Syarat     : penyimpangan (TMS) — proses dihentikan sementara,
//                  investigasi, perbaikan, lalu sampling ulang sampai MS.
export const LEVEL_LABEL = {
  0: "N/A",
  1: "Terkendali",
  2: "Alert",
  3: "OOT",
  4: "Penyimpangan (TMS)",
};

// Batas level yang mewajibkan sampling ulang. Alert Limit (level 2) sengaja
// TIDAK termasuk — nilai di rentang itu masih dianggap aman.
export const RESAMPLE_LEVEL = 3;

// Warna per level status — dipakai badge tabel, titik grafik, dan pill status.
export const LEVEL_STYLE = {
  0: { color: "#64748b", bg: "#f1f5f9", dot: "#52525b" },
  1: { color: "#15803d", bg: "#dcfce7", dot: "#22c55e" },
  2: { color: "#b45309", bg: "#fef3c7", dot: "#f59e0b" },
  3: { color: "#c2410c", bg: "#ffedd5", dot: "#f97316" },
  4: { color: "#b91c1c", bg: "#fee2e2", dot: "#ef4444" },
};

export function getLimit(parameter, kelas) {
  return LIMITS.find((l) => l.parameter === parameter && l.kelas === kelas) || null;
}

// Menerima angka biasa ("12") maupun notasi kurang-dari ("<1", "< 1").
// "<1" dianggap sedikit di bawah 1 supaya lolos pengecekan `v < 1`.
export function parseNumericValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const str = String(rawValue).trim();
  const lessThanMatch = str.match(/^<\s*([\d.]+)$/);
  if (lessThanMatch) {
    const n = Number(lessThanMatch[1]);
    return Number.isNaN(n) ? null : n - 0.001;
  }
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

// Level saja (0-4), tanpa label/warna — dipakai internal & oleh generator narasi.
export function getStatusLevel(rawValue, parameter, kelas) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return 0;
  if (rawValue === null || rawValue === undefined || rawValue === "") return 0;
  const v = parseNumericValue(rawValue);
  if (v === null) return 0;
  if (limit.lessThan) return v < 1 ? 1 : 4;
  if (v < limit.alert) return 1;
  if (v < limit.action) return 2;
  if (v < limit.syarat) return 3;
  return 4;
}

// Versi lengkap: level + label + warna.
export function getStatus(rawValue, parameter, kelas) {
  const limit = getLimit(parameter, kelas);
  const belumDiuji =
    !limit || rawValue === null || rawValue === undefined || rawValue === "";
  const level = getStatusLevel(rawValue, parameter, kelas);
  const label = level === 0
    ? (!limit ? "N/A" : belumDiuji ? "Belum diuji" : "N/A")
    : LEVEL_LABEL[level];
  return { level, label, ...LEVEL_STYLE[level] };
}

export function displayValue(rawValue, kelas, parameter) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return "N/A";
  if (rawValue === null || rawValue === undefined || rawValue === "") return "-";
  const str = String(rawValue).trim();
  if (/^<\s*[\d.]+$/.test(str)) return str.replace(/\s+/g, "");
  if (limit.lessThan && Number(rawValue) < 1) return "<1";
  return String(rawValue);
}

export function shortDate(iso) {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-");
  return `${d}/${m}`;
}

export function fullDateID(iso) {
  if (!iso) return "-";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_ID[Number(m) - 1] || m} ${y}`;
}

export function monthLabel(monthKey) {
  if (!monthKey) return "";
  const [y, m] = String(monthKey).split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

export function prevMonthKey(monthKey) {
  const [y, m] = String(monthKey).split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// =============================================================================
// UJI ULANG / RE-SAMPLING
// =============================================================================
// Ketika sebuah titik melampaui Alert/Action Limit atau batas Syarat, tindak
// lanjutnya adalah pengambilan sampel ulang (bisa di hari yang sama, bisa di
// hari berikutnya dalam waktu sesegera mungkin). Hasil uji ulang itu dicatat
// sebagai baris tersendiri yang MENUNJUK ke sampling aslinya, bukan menimpa
// atau menghapus nilai aslinya — data asli harus tetap terlihat agar jejak
// penyimpangan dan tindak lanjutnya bisa ditelusuri saat inspeksi.
//
// Sebuah penyimpangan dinyatakan SELESAI (closed) bila hasil uji ulang TERAKHIR
// untuk parameter yang sama sudah kembali terkendali. Kalau uji ulang masih
// menyimpang, penyimpangan tetap terbuka dan uji ulang itu sendiri jadi temuan
// baru yang perlu ditindaklanjuti lagi.

export const ENTRY_TYPE = { RUTIN: "rutin", RESAMPLING: "resampling" };

export function isResampling(entry) {
  return entry?.tipe === ENTRY_TYPE.RESAMPLING;
}

function sameRoom(a, b) {
  return a.roomName === b.roomName && a.kelas === b.kelas;
}

// Semua baris uji ulang yang menunjuk ke satu sampling asli, untuk satu
// parameter, diurutkan dari yang paling awal ke paling akhir.
export function resamplesFor(entries, original, paramKey) {
  return (entries || [])
    .filter(
      (e) =>
        isResampling(e) &&
        e.refTanggal &&
        e.refTanggal === original.tanggal &&
        sameRoom(e, original) &&
        e[paramKey] !== null &&
        e[paramKey] !== undefined &&
        e[paramKey] !== ""
    )
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
}

// Status satu parameter pada satu baris, SUDAH memperhitungkan uji ulang.
// - level      : level efektif (yang dipakai untuk warna, notifikasi, dan
//                status keseluruhan fasilitas)
// - originalLevel : level dari nilai aslinya, tetap dilaporkan apa adanya
// - resolved   : true bila penyimpangan sudah ditutup oleh uji ulang
// - resample   : baris uji ulang terakhir yang dipakai sebagai dasar penutupan
export function paramStatus(entries, entry, paramKey) {
  const originalLevel = getStatusLevel(entry[paramKey], paramKey, entry.kelas);
  const base = { level: originalLevel, originalLevel, resolved: false, resample: null, openResample: null };
  if (originalLevel < RESAMPLE_LEVEL || isResampling(entry)) return base;

  const list = resamplesFor(entries, entry, paramKey);
  if (list.length === 0) return base;

  const last = list[list.length - 1];
  const lastLevel = getStatusLevel(last[paramKey], paramKey, last.kelas);
  if (lastLevel <= 1) {
    return { level: 1, originalLevel, resolved: true, resample: last, openResample: null };
  }
  // Uji ulang sudah dilakukan tapi hasilnya masih menyimpang.
  return { ...base, openResample: last };
}

// Level tertinggi satu baris (lintas parameter), sudah memperhitungkan uji ulang.
export function entryEffectiveLevel(entries, entry) {
  let max = 0;
  PARAM_DEFS.forEach((p) => {
    const st = paramStatus(entries, entry, p.key);
    if (st.level > max) max = st.level;
  });
  return max;
}

// Ringkasan seluruh penyimpangan pada satu periode, beserta status tindak
// lanjutnya. Dipakai panel "Tindak Lanjut Penyimpangan" dan generator narasi.
export function deviationSummary(entries) {
  const items = [];
  (entries || []).forEach((entry) => {
    if (isResampling(entry)) return;
    PARAM_DEFS.forEach((p) => {
      const st = paramStatus(entries, entry, p.key);
      if (st.originalLevel < RESAMPLE_LEVEL) return;
      items.push({
        entry,
        paramKey: p.key,
        paramLabel: p.short,
        roomName: entry.roomName,
        kelas: entry.kelas,
        tanggal: entry.tanggal,
        value: entry[p.key],
        originalLevel: st.originalLevel,
        level: st.level,
        resolved: st.resolved,
        resample: st.resample,
        openResample: st.openResample,
      });
    });
  });
  return items.sort(
    (a, b) => b.originalLevel - a.originalLevel || String(a.tanggal).localeCompare(String(b.tanggal))
  );
}
