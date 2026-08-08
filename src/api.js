const API_URL = window.EM_VIABLE_CONFIG?.API_URL || "";

if (!API_URL) {
  console.warn("EM_VIABLE_CONFIG.API_URL belum diisi — cek file public/config.js");
}

async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  if (!res.ok) throw new Error(`Gagal memuat data (HTTP ${res.status})`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiPost(body) {
  // PENTING: jangan set header "Content-Type: application/json" di sini.
  // Kalau di-set, browser akan mengirim "preflight" request (OPTIONS) lebih
  // dulu, dan Google Apps Script web app tidak bisa menjawab preflight itu,
  // sehingga permintaan akan gagal karena CORS. Membiarkan body sebagai
  // string tanpa header khusus membuat browser mengirimnya sebagai
  // "simple request" yang langsung diterima Apps Script.
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gagal menyimpan data (HTTP ${res.status})`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export function fetchMaster(facility) {
  return apiGet({ action: "master", facility }).then((d) => d.rooms || []);
}

export function fetchEntries(facility, month) {
  return apiGet({ action: "entries", facility, month }).then((d) => d.entries || []);
}

export function saveEntries(facility, month, entries, token) {
  return apiPost({ action: "saveEntries", facility, month, entries, token });
}

export function fetchReport(facility, month, token) {
  const params = { action: "report", facility, month };
  if (token) params.token = token;
  return apiGet(params);
}

export function saveReport(facility, month, narrative, token) {
  return apiPost({ action: "saveReport", facility, month, narrative, token });
}

export function approveDikaji(facility, month, token) {
  return apiPost({ action: "approveDikaji", facility, month, token });
}

export function approveMengetahui(facility, month, token) {
  return apiPost({ action: "approveMengetahui", facility, month, token });
}

export function fetchStatusIndex(month) {
  return apiGet({ action: "statusIndex", month }).then((d) => d.status || {});
}

export function fetchActivityLog(token, { month, facility } = {}) {
  const params = { action: "activityLog", token };
  if (month) params.month = month;
  if (facility) params.facility = facility;
  return apiGet(params).then((d) => d.logs || []);
}

// --- AUTH ---
export function login(username, password) {
  return apiPost({ action: "login", username, password });
}

export function logout(token) {
  return apiPost({ action: "logout", token }).catch(() => {});
}

export function whoami(token) {
  return apiGet({ action: "whoami", token });
}

export function fetchReportEM(facility, tanggal, token) {
  const params = { action: "reportEM", facility, tanggal };
  if (token) params.token = token;
  return apiGet(params);
}

// Dipakai khusus halaman publik /verify (scan QR) — tetap bisa diakses tanpa
// login, tapi cuma mengembalikan info tanda tangan, bukan isi narasi/formulir.
export function fetchVerify(type, facility, period, slot) {
  const params = type === "report"
    ? { action: "verify", type, facility, tanggal: period, slot }
    : { action: "verify", type, facility, month: period, slot };
  return apiGet(params);
}

export function saveReportEM(facility, tanggal, noKontrolMedia, tanggalPembacaan, token) {
  return apiPost({ action: "saveReportEM", facility, tanggal, noKontrolMedia, tanggalPembacaan, token });
}

export function approveReportEM(facility, tanggal, token) {
  return apiPost({ action: "approveReportEM", facility, tanggal, token });
}

// Vercel Serverless Function (bukan Apps Script) — jalan di domain website sendiri,
// jadi tidak perlu urusan CORS seperti panggilan ke Apps Script di atas.
export async function generateNarrative({ facilityLabel, monthLabel, classes, stats, prevSummary }) {
  const res = await fetch("/api/generate-narrative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facilityLabel, monthLabel, classes, stats, prevSummary }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
