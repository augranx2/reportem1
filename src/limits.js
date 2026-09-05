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

export const LEVEL_LABEL = {
  0: "N/A",
  1: "Terkendali",
  2: "Alert",
  3: "Action",
  4: "Melebihi Syarat",
};

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
