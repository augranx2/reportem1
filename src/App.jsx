import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  ChevronLeft, Plus, Trash2, Printer, Loader2, Sparkles,
  AlertTriangle, CheckCircle2, Building2, LogIn, LogOut, User, History, Lock,
} from "lucide-react";
import {
  fetchMaster, fetchEntries, saveEntries as apiSaveEntries,
  fetchReport, saveReport as apiSaveReport, fetchStatusIndex,
  generateNarrative, approveDikaji as apiApproveDikaji,
  approveMengetahui as apiApproveMengetahui, fetchActivityLog,
  fetchReportEM, saveReportEM as apiSaveReportEM, approveReportEM as apiApproveReportEM, fetchVerify,
} from "./api.js";
import { generateLocalNarrative } from "./narrativeGenerator.js";
import { useAuth, hasAccess } from "./auth.js";

/* ========================================================================= */

const FACILITIES = [
  { key: "nbl", label: "NBL" },
  { key: "betalaktam", label: "Betalaktam" },
  { key: "sefaNonSteril", label: "Sefalosporin Non Steril" },
  { key: "sefaSteril", label: "Sefalosporin Steril" },
  { key: "labMikro", label: "Lab Mikrobiologi" },
];

const CLASS_ORDER = ["E", "D", "C", "B", "A"];

/* ========================================================================= QR VERIFIKASI TANDA TANGAN
   Setiap tanda tangan/approval (Dikaji Oleh, Mengetahui Pengkajian EM,
   Diperiksa oleh & Mengetahui Report Hasil EM) dapat di-scan untuk membuka
   halaman /verify yang mengambil data langsung dari sistem (live), bukan dari
   gambar PDF-nya — supaya PDF yang sudah dicetak tidak bisa dipalsukan datanya.
   Tidak perlu tab/kolom baru di spreadsheet: halaman verifikasi cukup membaca
   ulang data Pengkajian EM / Report Hasil EM yang sudah ada lewat action GET
   publik yang sama (action=report / action=reportEM), yang memang sudah bisa
   diakses tanpa login. */
function buildVerifyUrl(params) {
  const qs = new URLSearchParams(params).toString();
  return `${window.location.origin}/verify?${qs}`;
}

function VerifyQR({ type, facility, period, slot, size = 84 }) {
  const params = type === "report"
    ? { type, facility, tanggal: period, slot }
    : { type, facility, month: period, slot };
  const url = buildVerifyUrl(params);
  return (
    <div className="flex flex-col items-center gap-1">
      <QRCodeSVG value={url} size={size} level="M" bgColor="#ffffff" fgColor="#0f172a" />
      <span className="text-center text-[9px] leading-tight text-slate-400">Scan untuk verifikasi</span>
    </div>
  );
}

const PARAM_DEFS = [
  { key: "settle", label: "Cawan Papar (Settle Plate)", short: "Settle Plate" },
  { key: "contact", label: "Cawan Kontak (Contact Plate)", short: "Contact Plate" },
  { key: "air", label: "Air Sampler", short: "Air Sampler" },
];

const LIMITS = [
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

/* ========================================================================= HELPERS */

function parseNumericValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const str = String(rawValue).trim();
  // Petugas kadang mengetik "<1" atau "< 1" langsung (bukan cuma angka polos).
  // Itu artinya nilai sesungguhnya di bawah 1, jadi diperlakukan sebagai
  // sedikit di bawah 1 (bukan NaN / N/A) supaya tetap kena logika status.
  const lessThanMatch = str.match(/^<\s*([\d.]+)$/);
  if (lessThanMatch) {
    const n = Number(lessThanMatch[1]);
    return Number.isNaN(n) ? null : n - 0.001;
  }
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

function getLimit(parameter, kelas) {
  return LIMITS.find((l) => l.parameter === parameter && l.kelas === kelas) || null;
}

function getStatus(rawValue, parameter, kelas) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return { level: 0, label: "N/A", color: "#64748b", bg: "#f1f5f9" };
  if (rawValue === null || rawValue === undefined || rawValue === "")
    return { level: 0, label: "Belum diuji", color: "#64748b", bg: "#f1f5f9" };
  const v = parseNumericValue(rawValue);
  if (v === null) return { level: 0, label: "N/A", color: "#64748b", bg: "#f1f5f9" };
  if (limit.lessThan) {
    return v < 1
      ? { level: 1, label: "Terkendali", color: "#15803d", bg: "#dcfce7" }
      : { level: 4, label: "Melebihi Syarat", color: "#b91c1c", bg: "#fee2e2" };
  }
  if (v < limit.alert) return { level: 1, label: "Terkendali", color: "#15803d", bg: "#dcfce7" };
  if (v < limit.action) return { level: 2, label: "Alert", color: "#b45309", bg: "#fef3c7" };
  if (v < limit.syarat) return { level: 3, label: "Action", color: "#c2410c", bg: "#ffedd5" };
  return { level: 4, label: "Melebihi Syarat", color: "#b91c1c", bg: "#fee2e2" };
}

function displayValue(rawValue, kelas, parameter) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return "N/A";
  if (rawValue === null || rawValue === undefined || rawValue === "") return "-";
  const str = String(rawValue).trim();
  if (/^<\s*[\d.]+$/.test(str)) return str.replace(/\s+/g, "");
  if (limit.lessThan && Number(rawValue) < 1) return "<1";
  return String(rawValue);
}

function classesInUse(masterRooms, entries) {
  const set = new Set();
  (masterRooms || []).forEach((r) => set.add(r.kelas));
  (entries || []).forEach((e) => set.add(e.kelas));
  return CLASS_ORDER.filter((c) => set.has(c));
}

function facilityOverallLevel(entries) {
  let max = 0;
  (entries || []).forEach((e) => {
    PARAM_DEFS.forEach((p) => {
      const s = getStatus(e[p.key], p.key, e.kelas);
      if (s.level > max) max = s.level;
    });
  });
  return max;
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function monthLabel(monthKey) {
  if (!monthKey) return "";
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const LEVEL_LABEL = { 0: "N/A", 1: "Terkendali", 2: "Alert", 3: "Action", 4: "Melebihi Syarat" };

function buildStatsSummary(classes, entries) {
  const summary = {};
  classes.forEach((k) => {
    const kelasEntries = entries.filter((e) => e.kelas === k);
    const breaches = [];
    let maxLevel = 0;
    const perParam = {};

    PARAM_DEFS.forEach((p) => {
      const limit = getLimit(p.key, k);
      if (!limit) return;
      const points = kelasEntries
        .map((e) => ({ room: e.roomName, tanggal: e.tanggal, raw: e[p.key] }))
        .filter((pt) => pt.raw !== null && pt.raw !== undefined && pt.raw !== "");
      if (points.length === 0) return;

      const numeric = points
        .map((pt) => ({ ...pt, value: parseNumericValue(pt.raw) }))
        .filter((pt) => pt.value !== null);
      const allBelowOne = limit.lessThan && numeric.every((pt) => pt.value < 1);
      const maxVal = numeric.length > 0 ? Math.max(...numeric.map((pt) => pt.value)) : null;
      const topPoints = maxVal === null ? [] : numeric.filter((pt) => pt.value === maxVal).slice(0, 3)
        .map((pt) => ({ room: pt.room, tanggal: pt.tanggal, value: displayValue(pt.raw, k, p.key) }));

      perParam[p.key] = {
        label: p.short, alertLimit: limit.alert, actionLimit: limit.action, syaratLimit: limit.syarat,
        allBelowOne, topValues: topPoints,
      };
    });

    kelasEntries.forEach((e) => {
      PARAM_DEFS.forEach((p) => {
        const limit = getLimit(p.key, k);
        if (!limit) return;
        const s = getStatus(e[p.key], p.key, k);
        if (s.level > maxLevel) maxLevel = s.level;
        if (s.level >= 2) {
          breaches.push({ room: e.roomName, tanggal: e.tanggal, parameter: p.short, value: displayValue(e[p.key], k, p.key), level: LEVEL_LABEL[s.level] });
        }
      });
    });
    summary[k] = { totalTitik: kelasEntries.length, maxLevel: LEVEL_LABEL[maxLevel], perParam, breaches };
  });
  return summary;
}

function shortDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fullDateID(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_ID[Number(m) - 1]} ${y}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyNarrative() {
  return {
    pendahuluan:
      "Environment Monitoring (EM) Viable merupakan bagian kritis dari sistem pengendalian mutu lingkungan pada fasilitas produksi farmasi. Program EM Viable bertujuan untuk memantau dan mengevaluasi tingkat cemaran mikrobiologi di area produksi guna memastikan kondisi lingkungan tetap berada dalam kondisi terkendali sesuai dengan ketentuan Standar CPOB tahun 2024 dan 2025 yang berlaku.",
    perKelas: {},
    kesimpulanUmum: "",
    // Field lama (tidak lagi ditampilkan di UI), tetap disimpan kosong supaya
    // laporan lama yang sudah punya kolom ini di Google Sheet tidak error.
    tindakLanjut: "",
    kesanUmum: "",
    observasiKritis: "",
    rekomendasiAkhir: "",
  };
}

function emptySignoff() {
  return {
    dinilai: { nama: "", jabatan: "QA Staff", tanggal: todayISO() },
    diperiksa: { nama: "", jabatan: "QA Manager", tanggal: "" },
  };
}

/* ========================================================================= UI PIECES */

function StatusPill({ level, hasData }) {
  if (!hasData) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-500">
        Belum ada data
      </span>
    );
  }
  if (level >= 4) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#fee2e2", color: "#b91c1c" }}>
        <AlertTriangle size={13} /> Melebihi Syarat
      </span>
    );
  }
  if (level === 3) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#ffedd5", color: "#c2410c" }}>
        <AlertTriangle size={13} /> Terkendali (Perlu Perhatian)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#dcfce7", color: "#15803d" }}>
      <CheckCircle2 size={13} /> Terkendali
    </span>
  );
}

function Cell({ value, kelas, parameter }) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return <td className="px-3 py-2 text-center text-slate-300 text-sm">N/A</td>;
  const status = getStatus(value, parameter, kelas);
  return (
    <td className="px-3 py-2 text-center">
      <span
        className="inline-block min-w-[2.5rem] rounded px-2 py-0.5 text-sm font-medium"
        style={{ background: status.bg, color: status.color }}
        title={status.label}
      >
        {displayValue(value, kelas, parameter)}
      </span>
    </td>
  );
}

function LegendRow() {
  const items = [
    { label: "Terkendali", bg: "#dcfce7", color: "#15803d" },
    { label: "Alert", bg: "#fef3c7", color: "#b45309" },
    { label: "Action", bg: "#ffedd5", color: "#c2410c" },
    { label: "Melebihi Syarat", bg: "#fee2e2", color: "#b91c1c" },
    { label: "N/A / Belum diuji", bg: "#f1f5f9", color: "#64748b" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: it.bg, border: `1px solid ${it.color}` }} />
          <span className="text-slate-600">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

function ParamChart({ entries, kelas, parameter, paramLabel }) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return null;
  const dateCounts = {};
  entries.forEach((e) => { dateCounts[e.roomName] = (dateCounts[e.roomName] || 0) + 1; });
  // Titik yang jauh di luar batas wajar (kemungkinan besar salah ketik,
  // misalnya angka jutaan) tidak ikut digambar di grafik, supaya skala
  // tetap proporsional terhadap Syarat/Alert/Action. Nilai sesungguhnya
  // tetap benar dan lengkap di tabel breakdown di atas grafik.
  const outlierCutoff = Math.max(limit.syarat * 5, 100);
  let excludedCount = 0;
  const data = entries
    .map((e) => {
      const raw = e[parameter];
      if (raw === null || raw === undefined || raw === "") return null;
      const v = parseNumericValue(raw);
      if (v === null) return null;
      if (v > outlierCutoff) { excludedCount += 1; return null; }
      const label = dateCounts[e.roomName] > 1 ? `${e.roomName} (${shortDate(e.tanggal)})` : e.roomName;
      return { label, value: v };
    })
    .filter(Boolean);
  if (data.length === 0) return null;
  const maxLimit = Math.max(limit.syarat, ...data.map((d) => d.value)) * 1.2;

  return (
    <div className="avoid-break overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-slate-500">{paramLabel} — Kelas {kelas}</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 26, right: 15, left: 15, bottom: 55 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={70} />
          <YAxis domain={[0, maxLimit]} tick={{ fontSize: 11 }} width={35} />
          <Tooltip />
          <ReferenceLine y={limit.syarat} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5 4" label={{ value: "Syarat", fontSize: 10, fill: "#dc2626", position: "insideTopRight" }} />
          <ReferenceLine y={limit.action} stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 4" label={{ value: "Action", fontSize: 10, fill: "#f97316", position: "insideTopRight" }} />
          <ReferenceLine y={limit.alert} stroke="#eab308" strokeWidth={1.5} strokeDasharray="5 4" label={{ value: "Alert", fontSize: 10, fill: "#eab308", position: "insideTopRight" }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#16a34a" }}
            label={{ position: "top", fontSize: 10, fill: "#166534" }}
          />
        </LineChart>
      </ResponsiveContainer>
      {excludedCount > 0 && (
        <p className="mt-1 text-xs italic text-amber-600">
          * {excludedCount} titik data dengan nilai tidak wajar (di luar skala grafik) tidak ditampilkan di sini — cek nilainya di tabel di atas.
        </p>
      )}
    </div>
  );
}

function AutoTextarea({ value, onChange, rows = 3, placeholder, className, readOnly = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  // Kelas seperti border/rounded/focus:* hanya relevan untuk tampilan kotak
  // input yang bisa diklik di layar. Di versi cetak/PDF ini cuma teks biasa,
  // jadi kelas-kelas itu sengaja dibuang supaya tidak ada kotak/warna sisa
  // (mis. dari state :focus) yang muncul di ruang kosong bawah teks saat print.
  const printClassName = (className || "")
    .split(" ")
    .filter((c) => c && !c.startsWith("focus:") && !c.startsWith("border") && !c.startsWith("ring") && c !== "rounded-lg")
    .join(" ");
  return (
    <>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        readOnly={readOnly}
        className={`only-screen ${className} ${readOnly ? "bg-slate-50 text-slate-500" : ""}`}
        style={{ overflow: "hidden", resize: "none" }}
      />
      {/* Versi khusus cetak/PDF: teks biasa, mengikuti lebar halaman print
          sepenuhnya, tidak pernah terpotong seperti kotak <textarea>. */}
      <div className={`only-print whitespace-pre-wrap text-justify border-0 ${printClassName}`}>
        {value || <span className="text-slate-300">-</span>}
      </div>
    </>
  );
}

function ClassSection({ kelas, entries, narrativeText, onNarrativeChange, readOnly = false, showDiscussion = true }) {
  const hasContact = !!getLimit("contact", kelas);
  const hasAir = !!getLimit("air", kelas);
  return (
    <div className="avoid-break rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5">
        <h4 className="text-sm font-bold tracking-wide text-white">KELAS {kelas}</h4>
        <span className="text-xs text-slate-300">{entries.length} titik data</span>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">Belum ada data untuk kelas ini pada bulan yang dipilih.</p>
      ) : (
        <>
          <div className="avoid-break overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">Nama Ruangan</th>
                  <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
                  <th className="px-3 py-2 text-center font-semibold">Cawan Papar</th>
                  {hasContact && <th className="px-3 py-2 text-center font-semibold">Cawan Kontak</th>}
                  {hasAir && <th className="px-3 py-2 text-center font-semibold">Air Sampler</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-700">{e.roomName}</td>
                    <td className="px-3 py-2 text-slate-500">{fullDateID(e.tanggal)}</td>
                    <Cell value={e.settle} kelas={kelas} parameter="settle" />
                    {hasContact && <Cell value={e.contact} kelas={kelas} parameter="contact" />}
                    {hasAir && <Cell value={e.air} kelas={kelas} parameter="air" />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showDiscussion && (
            <div className="flex flex-col gap-4 p-4">
              <ParamChart entries={entries} kelas={kelas} parameter="settle" paramLabel="Settle Plate" />
              {hasContact && <ParamChart entries={entries} kelas={kelas} parameter="contact" paramLabel="Contact Plate" />}
              {hasAir && <ParamChart entries={entries} kelas={kelas} parameter="air" paramLabel="Air Sampler" />}
            </div>
          )}
        </>
      )}
      {showDiscussion && (
      <div className="border-t border-slate-100 p-4 avoid-break">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Hasil, Tren &amp; Kesimpulan Kelas {kelas}
        </label>
        <AutoTextarea
          className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          rows={14}
          value={narrativeText || ""}
          placeholder="Tulis ulasan hasil, tren, dan kesimpulan untuk kelas ini..."
          onChange={(ev) => onNarrativeChange(ev.target.value)}
          readOnly={readOnly}
        />
      </div>
      )}
    </div>
  );
}

/* ========================================================================= ENTRY EDITOR */

function EntryRow({ entry, masterRooms, onChange, onDelete, readOnly = false, canDelete = true }) {
  const isCustom = entry._custom || !masterRooms.some((r) => r.code === entry._sourceCode);

  if (readOnly) {
    return (
      <tr className="border-b border-slate-100 align-top">
        <td className="px-2 py-1.5 text-sm text-slate-600">{fullDateID(entry.tanggal)}</td>
        <td className="px-2 py-1.5 text-sm text-slate-600">{entry.roomName}</td>
        <td className="px-2 py-1.5"><span className="inline-block w-14 rounded bg-slate-100 px-2 py-1 text-center text-sm font-medium text-slate-600">{entry.kelas}</span></td>
        {["settle", "contact", "air"].map((p) => (
          <td key={p} className="px-2 py-1.5 text-center text-sm text-slate-600">{entry[p] === null || entry[p] === undefined || entry[p] === "" ? "-" : entry[p]}</td>
        ))}
        <td className="px-2 py-1.5" />
      </tr>
    );
  }

  const handleRoomPick = (val) => {
    if (val === "__custom__") {
      onChange({ ...entry, _custom: true, _sourceCode: null });
      return;
    }
    const room = masterRooms.find((r) => r.code === val);
    if (room) onChange({ ...entry, _custom: false, _sourceCode: room.code, roomName: room.name, kelas: room.kelas });
  };

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="px-2 py-1.5">
        <input type="date" className="w-36 rounded border border-slate-200 px-2 py-1 text-sm"
          value={entry.tanggal || ""} onChange={(ev) => onChange({ ...entry, tanggal: ev.target.value })}
          onClick={(ev) => ev.currentTarget.showPicker?.()} />
      </td>
      <td className="px-2 py-1.5">
        <select className="w-56 rounded border border-slate-200 px-2 py-1 text-sm"
          value={entry._custom ? "__custom__" : entry._sourceCode || "__custom__"}
          onChange={(ev) => handleRoomPick(ev.target.value)}>
          <option value="__custom__">-- Input manual --</option>
          {CLASS_ORDER.map((k) => {
            const rooms = masterRooms.filter((r) => r.kelas === k);
            if (rooms.length === 0) return null;
            return (
              <optgroup key={k} label={`Kelas ${k}`}>
                {rooms.map((r) => (
                  <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {isCustom && (
          <input type="text" className="mt-1 w-56 rounded border border-slate-200 px-2 py-1 text-sm"
            placeholder="Nama ruangan" value={entry.roomName || ""}
            onChange={(ev) => onChange({ ...entry, roomName: ev.target.value })} />
        )}
      </td>
      <td className="px-2 py-1.5">
        {isCustom ? (
          <select className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
            value={entry.kelas || ""} onChange={(ev) => onChange({ ...entry, kelas: ev.target.value })}>
            <option value="">-</option>
            {CLASS_ORDER.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        ) : (
          <span className="inline-block w-20 rounded bg-slate-100 px-2 py-1 text-center text-sm font-medium text-slate-600">
            {entry.kelas}
          </span>
        )}
      </td>
      {["settle", "contact", "air"].map((p) => (
        <td key={p} className="px-2 py-1.5">
          <input type="text" className="w-20 rounded border border-slate-200 px-2 py-1 text-center text-sm"
            placeholder="-" value={entry[p] === null || entry[p] === undefined ? "" : entry[p]}
            onChange={(ev) => {
              const raw = ev.target.value.trim();
              const val = raw === "-" ? null : raw;
              onChange({ ...entry, [p]: val });
            }} />
        </td>
      ))}
      <td className="px-2 py-1.5 text-center">
        {canDelete && (
          <button onClick={onDelete} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Hapus baris">
            <Trash2 size={15} />
          </button>
        )}
      </td>
    </tr>
  );
}

function EntryEditor({ masterRooms, entries, setEntries, onSave, saving, canInput = false, canDeleteExisting = false, accessNote }) {
  const addRow = () => {
    // Tanggal baris baru ikut tanggal baris paling atas (baris terakhir yang
    // sudah diinput sebelumnya) — bukan selalu tanggal hari ini. Ini menghemat
    // waktu saat input data historis/bulanan dalam jumlah banyak, karena
    // biasanya beberapa baris berturut-turut memang untuk tanggal yang sama.
    const defaultTanggal = entries[0]?.tanggal || todayISO();
    setEntries([{ id: uid(), tanggal: defaultTanggal, roomName: "", kelas: "", settle: "", contact: "", air: "", _custom: true, _sourceCode: null }, ...entries]);
  };
  const isExistingRow = (e) => typeof e.id === "string" && e.id.startsWith("row-");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Input Data Bulanan</h3>
        {canInput ? (
          <div className="flex gap-2">
            <button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Plus size={14} /> Tambah Baris
            </button>
            <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Simpan Data Bulan Ini
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            <Lock size={12} /> {accessNote || "Mode lihat saja"}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {canInput ? 'Belum ada baris. Klik "Tambah Baris" untuk mulai input data ruangan yang disampling bulan ini.' : "Belum ada data untuk bulan ini."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1.5">Tanggal</th><th className="px-2 py-1.5">Ruangan</th><th className="px-2 py-1.5">Kelas</th>
                <th className="px-2 py-1.5">Cawan Papar</th><th className="px-2 py-1.5">Cawan Kontak</th><th className="px-2 py-1.5">Air Sampler</th><th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <EntryRow key={e.id} entry={e} masterRooms={masterRooms}
                  readOnly={!canInput}
                  canDelete={canDeleteExisting || !isExistingRow(e)}
                  onChange={(next) => { const c = entries.slice(); c[idx] = next; setEntries(c); }}
                  onDelete={() => setEntries(entries.filter((_, i) => i !== idx))} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canInput && (
        <p className="mt-2 text-xs text-slate-400">
          Isi "-" untuk titik yang tidak diuji bulan ini. Ruangan yang sama boleh muncul lebih dari satu kali dengan tanggal berbeda (mis. saat requalifikasi).
          {!canDeleteExisting && " Baris yang sudah tersimpan tidak bisa dihapus — hubungi Supervisor/Manager QC untuk menghapus."}
        </p>
      )}
    </div>
  );
}

/* ========================================================================= DASHBOARD */

function Dashboard({ monthKey, setMonthKey, statusIndex, loadingStatus, statusError, onOpen }) {
  const perluCount = FACILITIES.filter((f) => (statusIndex[f.key]?.level || 0) === 3).length;
  const tmsCount = FACILITIES.filter((f) => (statusIndex[f.key]?.level || 0) >= 4).length;
  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-900">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">PT. Rama Emerald Multi Sukses — QA</p>
          <h1 className="text-2xl font-bold text-white">Dashboard EM Viable</h1>
          <p className="mt-1 text-sm text-blue-100">Rekap pengkajian trend Environment Monitoring (EM) Viable per fasilitas</p>
        </div>
      </div>
      <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex justify-end">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Periode</label>
          <input type="month" value={monthKey} onChange={(ev) => setMonthKey(ev.target.value)} onClick={(ev) => ev.currentTarget.showPicker?.()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {statusError && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{statusError}</p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl bg-blue-800 p-4 text-white">
          <p className="text-xs font-medium text-blue-100">Total Fasilitas</p>
          <p className="text-2xl font-bold">{FACILITIES.length}</p>
        </div>
        <div className="rounded-xl bg-emerald-700 p-4 text-white">
          <p className="text-xs font-medium text-emerald-100">Terkendali</p>
          <p className="text-2xl font-bold">{FACILITIES.filter((f) => statusIndex[f.key]?.hasData && (statusIndex[f.key]?.level || 0) < 3).length}</p>
        </div>
        <div className="rounded-xl bg-orange-600 p-4 text-white">
          <p className="text-xs font-medium text-orange-100">Terkendali (Perlu Perhatian)</p>
          <p className="text-2xl font-bold">{perluCount}</p>
        </div>
        <div className="rounded-xl bg-red-700 p-4 text-white">
          <p className="text-xs font-medium text-red-100">Melebihi Syarat</p>
          <p className="text-2xl font-bold">{tmsCount}</p>
        </div>
        <div className="rounded-xl bg-slate-600 p-4 text-white">
          <p className="text-xs font-medium text-slate-200">Belum Ada Data</p>
          <p className="text-2xl font-bold">{FACILITIES.filter((f) => !statusIndex[f.key]?.hasData).length}</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Fasilitas — {monthLabel(monthKey)}</p>
      <div className="space-y-2.5">
        {FACILITIES.map((f) => {
          const st = statusIndex[f.key];
          return (
            <button key={f.key} onClick={() => onOpen(f.key)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Building2 size={19} /></span>
                <div>
                  <p className="font-semibold text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-400">{loadingStatus ? "Memuat..." : st?.hasData ? "Ada data bulan ini" : "Belum ada data bulan ini"}</p>
                </div>
              </div>
              {loadingStatus ? <Loader2 className="animate-spin text-slate-300" size={18} /> : <StatusPill level={st?.level || 0} hasData={!!st?.hasData} />}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/* ========================================================================= FACILITY DETAIL */

/* =========================================================================
   REPORT HASIL EM — form fisik FM.QC.062 yang didigitalkan (khusus QC)
   ========================================================================= */

function keteranganMS(entry) {
  // MS (Memenuhi Syarat) kalau ketiga parameter tidak ada yang melebihi
  // Syarat (level 4 pada skala status). TMS kalau ada satu saja yang lewat.
  let maxLevel = 0;
  PARAM_DEFS.forEach((p) => {
    const s = getStatus(entry[p.key], p.key, entry.kelas);
    if (s.level > maxLevel) maxLevel = s.level;
  });
  return maxLevel >= 4 ? "TMS" : "MS";
}

function ReportEMPanel({ facilityKey, entriesForMonth, monthKey, session, token, locked = false, onBack }) {
  const facility = FACILITIES.find((f) => f.key === facilityKey);
  // Tgl Berlaku FM.QC.062/R3 — sengaja dikosongkan dulu sampai revisi ini
  // disahkan resmi secara fisik di kantor. Isi tanggalnya di sini nanti
  // (mis. "01 September 2026") begitu sudah ditetapkan.
  const tglBerlakuR3 = "";
  const [tanggal, setTanggal] = useState("");
  const [meta, setMeta] = useState(null);
  const [noKontrolMedia, setNoKontrolMedia] = useState("");
  const [tanggalPembacaan, setTanggalPembacaan] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canInput = hasAccess(session, "Staff", "QC") && !locked;
  const canApprove = hasAccess(session, "Supervisor", "QC") && !locked;

  // Tanggal-tanggal yang ada datanya di bulan yang sedang dibuka, supaya
  // gampang dipilih (tidak perlu ingat tanggal persis)
  const availableDates = useMemo(() => {
    const set = new Set(entriesForMonth.map((e) => e.tanggal).filter(Boolean));
    return Array.from(set).sort();
  }, [entriesForMonth]);

  useEffect(() => {
    if (!tanggal && availableDates.length > 0) setTanggal(availableDates[availableDates.length - 1]);
  }, [availableDates, tanggal]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tanggal) return;
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetchReportEM(facilityKey, tanggal, token);
        if (cancelled) return;
        setMeta(res);
        setNoKontrolMedia(res.noKontrolMedia || "");
        setTanggalPembacaan(res.tanggalPembacaan || "");
      } catch (err) {
        if (!cancelled) setErrorMsg("Gagal memuat Report Hasil EM: " + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [facilityKey, tanggal, token]);

  const roomsThisDate = useMemo(
    () => entriesForMonth.filter((e) => e.tanggal === tanggal),
    [entriesForMonth, tanggal]
  );

  async function handleSave() {
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await apiSaveReportEM(facilityKey, tanggal, noKontrolMedia, tanggalPembacaan, token);
      if (res.error) throw new Error(res.error);
      setMeta(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setErrorMsg("");
    try {
      const res = await apiApproveReportEM(facilityKey, tanggal, token);
      if (res.error) throw new Error(res.error);
      setMeta(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setApproving(false);
    }
  }

  const formNo = meta?.formNo || "FM.QC.062/R3";
  const prevFormNo = meta?.prevFormNo || "FM.QC.062/R2";
  const prevTglBerlaku = meta?.prevTglBerlaku || "";
  const analis = meta?.analis || { nama: "", tanggal: "" };
  const diperiksa = meta?.diperiksa || { nama: "", tanggal: "" };
  const isApproved = !!diperiksa?.nama;

  // Lapisan pengaman: walau tombolnya sudah disembunyikan dari yang tidak
  // berhak di halaman sebelumnya, tetap dicek ulang di sini. Formulir QC
  // (FM.QC.062) hanya boleh dilihat oleh akun QC atau QA yang sudah login
  // (QA hanya lihat & cetak, tidak bisa input/approve — dikontrol lewat
  // canInput/canApprove di bawah). Publik tanpa login dan akun Tamu tidak
  // bisa membuka halaman ini sama sekali.
  const allowedHere = session?.role === "Administrator" || session?.departemen === "QC" || session?.departemen === "QA";
  if (!allowedHere) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ChevronLeft size={16} /> Kembali ke Pengkajian EM
        </button>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {session
            ? "Report Hasil EM (FM.QC.062) hanya bisa dilihat oleh akun departemen QC atau QA."
            : "Report Hasil EM (FM.QC.062) hanya bisa dilihat oleh akun yang sudah login (QC/QA)."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 print:max-w-none print:p-0">

      <div className="no-print mb-4 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ChevronLeft size={16} /> Kembali ke Pengkajian EM
        </button>
        <div className="flex items-center gap-2">
          <select value={tanggal} onChange={(ev) => setTanggal(ev.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {availableDates.length === 0 && <option value="">Belum ada data bulan ini</option>}
            {availableDates.map((d) => (
              <option key={d} value={d}>{fullDateID(d)}</option>
            ))}
          </select>
          <button onClick={() => window.print()} disabled={!tanggal} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Printer size={15} /> Cetak / Download PDF
          </button>
        </div>
      </div>

      {errorMsg && <p className="no-print mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMsg}</p>}

      {locked && (
        <p className="no-print mb-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
          <Lock size={12} /> Pengkajian EM bulan ini sudah di-approve final — Formulir QC terkunci, hubungi Administrator kalau perlu perubahan.
        </p>
      )}

      {!tanggal ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Belum ada data pengujian pada bulan ini untuk fasilitas {facility.label}. Input data dulu di halaman Pengkajian EM.
        </p>
      ) : (
        <div className="rounded-xl border border-slate-300 bg-white p-6 print-card">
          <div className="mb-4 flex items-start justify-between border-b border-slate-300 pb-4">
            <div className="flex items-center gap-3">
              <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" className="h-14 w-14 shrink-0 object-contain" />
              <div>
                <p className="text-xs font-semibold text-slate-500">PT. Rama Emerald Multi Sukses</p>
                <h2 className="text-lg font-bold uppercase text-slate-800">Pemantauan Lingkungan Viabel</h2>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>No. : <span className="font-semibold text-slate-700">{formNo}</span></p>
              <p>Tgl Berlaku : {tglBerlakuR3 || "-"}</p>
              <p>Menggantikan No. : {prevFormNo}</p>
              <p>Tgl Berlaku : {prevTglBerlaku}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <p><span className="text-slate-500">Nama Fasilitas</span> : <span className="font-medium">{facility.label}</span></p>
            <p><span className="text-slate-500">Tanggal Pemeriksaan</span> : <span className="font-medium">{fullDateID(tanggal)}</span></p>
            <p className="flex items-center gap-2">
              <span className="text-slate-500">No. Kontrol Media</span> :
              {canInput && !isApproved ? (
                <input type="text" value={noKontrolMedia} onChange={(ev) => setNoKontrolMedia(ev.target.value)}
                  className="only-screen w-40 rounded border border-slate-300 px-2 py-0.5 text-sm" placeholder="mis. A0131032661" />
              ) : (
                <span className="font-medium">{noKontrolMedia || "-"}</span>
              )}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-center">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1.5">No.</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1.5">Nama Ruang</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1.5">Kelas</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1.5">Cawan Papar</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1.5">Cawan Kontak</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1.5">Air Sampler</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1.5">Keterangan</th>
                </tr>
                <tr className="bg-slate-100 text-center">
                  <th className="border border-slate-300 px-2 py-1">Hasil</th><th className="border border-slate-300 px-2 py-1">Syarat</th>
                  <th className="border border-slate-300 px-2 py-1">Hasil</th><th className="border border-slate-300 px-2 py-1">Syarat</th>
                  <th className="border border-slate-300 px-2 py-1">Hasil</th><th className="border border-slate-300 px-2 py-1">Syarat</th>
                </tr>
              </thead>
              <tbody>
                {roomsThisDate.map((e, idx) => {
                  const ket = keteranganMS(e);
                  return (
                    <tr key={e.id || idx}>
                      <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 px-2 py-1">{e.roomName}</td>
                      <td className="border border-slate-300 px-2 py-1 text-center">{e.kelas}</td>
                      {["settle", "contact", "air"].map((p) => {
                        const limit = getLimit(p, e.kelas);
                        return (
                          <Fragment key={p}>
                            <td className="border border-slate-300 px-2 py-1 text-center">{limit ? displayValue(e[p], e.kelas, p) : "-"}</td>
                            <td className="border border-slate-300 px-2 py-1 text-center">{limit ? (limit.lessThan ? "< 1" : limit.syarat) : "-"}</td>
                          </Fragment>
                        );
                      })}
                      <td className={`border border-slate-300 px-2 py-1 text-center font-semibold ${ket === "MS" ? "text-emerald-600" : "text-red-600"}`}>{ket}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-slate-500">Tanggal Pembacaan</span> :
            {canInput && !isApproved ? (
              <input type="date" value={tanggalPembacaan} onChange={(ev) => setTanggalPembacaan(ev.target.value)}
                onClick={(ev) => ev.currentTarget.showPicker?.()}
                className="only-screen rounded border border-slate-300 px-2 py-0.5 text-sm" />
            ) : (
              <span className="font-medium">{tanggalPembacaan ? fullDateID(tanggalPembacaan) : "-"}</span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Diperiksa oleh</p>
              <div className="mb-3 flex h-24 items-center justify-center rounded border border-dashed border-slate-300 print:h-28">
                {analis.nama ? (
                  <VerifyQR type="report" facility={facilityKey} period={tanggal} slot="analis" size={64} />
                ) : (
                  <span className="only-screen text-xs text-slate-300">Ruang tanda tangan</span>
                )}
              </div>
              {analis.nama ? (
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-slate-700">{analis.nama}</p>
                  <p className="text-xs text-slate-400">{analis.tanggal ? fullDateID(analis.tanggal) : ""}</p>
                </div>
              ) : canInput ? (
                <button onClick={handleSave} disabled={saving}
                  className="no-print inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Setujui &amp; Tanda Tangani
                </button>
              ) : (
                <p className="no-print inline-flex items-center gap-1.5 text-xs text-slate-400"><Lock size={12} /> Hanya Staff/Supervisor/Manager QC yang bisa menandatangani</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Mengetahui</p>
              <div className="mb-3 flex h-24 items-center justify-center rounded border border-dashed border-slate-300 print:h-28">
                {diperiksa.nama ? (
                  <VerifyQR type="report" facility={facilityKey} period={tanggal} slot="diperiksa" size={64} />
                ) : (
                  <span className="only-screen text-xs text-slate-300">Ruang tanda tangan</span>
                )}
              </div>
              {diperiksa.nama ? (
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-slate-700">{diperiksa.nama}</p>
                  <p className="text-xs text-slate-400">{diperiksa.tanggal ? fullDateID(diperiksa.tanggal) : ""}</p>
                </div>
              ) : canApprove && analis.nama ? (
                <button onClick={handleApprove} disabled={approving}
                  className="no-print inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Setujui &amp; Tanda Tangani
                </button>
              ) : (
                <p className="no-print inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Lock size={12} /> {!analis.nama ? 'Menunggu "Diperiksa oleh" terlebih dahulu' : "Hanya Supervisor/Manager QC yang bisa menyetujui"}
                </p>
              )}
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">Lampiran No. 2, Protap No. POS.QC.036</p>

          {canInput && analis.nama && !isApproved && (
            <div className="no-print mt-5 flex justify-end">
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null} Simpan Perubahan (No. Kontrol Media / Tgl Pembacaan)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FacilityDetail({ facilityKey, monthKey, setMonthKey, onBack, onSaved, session, token }) {
  const facility = FACILITIES.find((f) => f.key === facilityKey);

  // Input & hapus data mentah: QC (Staff ke atas) ATAU QA (Supervisor ke atas,
  // supaya QA bisa mengintervensi/koreksi kalau ada salah input dari QC)
  const canInputQC = hasAccess(session, "Staff", "QC") || hasAccess(session, "Supervisor", "QA");
  const canDeleteQC = hasAccess(session, "Supervisor", "QC") || hasAccess(session, "Supervisor", "QA");
  const canEditQA = hasAccess(session, "Supervisor", "QA");
  const canApproveFinal = hasAccess(session, "Manager", "QA");
  const isAdmin = session?.role === "Administrator";  // Administrator melihat & bisa akses SEMUA tombol, lintas departemen
  const isQA = isAdmin || session?.departemen === "QA";
  const isQC = isAdmin || session?.departemen === "QC";
  // Grafik & pembahasan/pengkajian QA hanya untuk yang sudah login (Tamu ke
  // atas). Publik tanpa login hanya boleh melihat data hasil pengujian.
  const canViewDiscussion = !!session;
  const [mode, setMode] = useState("pengkajian"); // 'pengkajian' | 'reportEM'

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [masterRooms, setMasterRooms] = useState([]);
  const [entries, setEntries] = useState([]);
  const [narrative, setNarrative] = useState(emptyNarrative());
  const [signoff, setSignoff] = useState(emptySignoff());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [rooms, ent, rep] = await Promise.all([
          fetchMaster(facilityKey),
          fetchEntries(facilityKey, monthKey),
          fetchReport(facilityKey, monthKey, token),
        ]);
        if (cancelled) return;
        setMasterRooms(rooms);
        setEntries(ent.map((e) => ({ ...e, _custom: !rooms.some((r) => r.name === e.roomName && r.kelas === e.kelas) })));
        if (rep.found) {
          setNarrative({ ...emptyNarrative(), ...rep.narrative });
          setSignoff(rep.signoff || emptySignoff());
        } else {
          setNarrative(emptyNarrative());
          setSignoff(emptySignoff());
        }
      } catch (err) {
        if (!cancelled) setLoadError("Gagal memuat data dari spreadsheet: " + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [facilityKey, monthKey, token]);

  // Hanya kelas yang benar-benar ada datanya bulan ini yang ditampilkan &
  // dibahas di laporan — kalau suatu kelas memang berlaku untuk fasilitas
  // ini tapi tidak dimonitor bulan ini, kelas itu tidak usah muncul sama
  // sekali (tidak jadi baris Persyaratan, tidak jadi bagian pembahasan).
  const classes = useMemo(() => {
    const set = new Set(entries.map((e) => e.kelas).filter(Boolean));
    return CLASS_ORDER.filter((c) => set.has(c));
  }, [entries]);
  const grouped = useMemo(() => {
    const g = {};
    classes.forEach((k) => (g[k] = entries.filter((e) => e.kelas === k)));
    return g;
  }, [classes, entries]);
  const persyaratanRows = useMemo(() => LIMITS.filter((l) => classes.includes(l.kelas)), [classes]);
  const overallLevel = facilityOverallLevel(entries);
  // Begitu Pengkajian EM bulan ini sudah di-approve final ("Mengetahui" oleh
  // Manager QA), data mentah, Formulir QC, dan narasi terkunci untuk semua
  // orang kecuali Administrator.
  const isLocked = !isAdmin && !!signoff?.diperiksa?.nama;

  const reloadReport = useCallback(async () => {
    try {
      const rep = await fetchReport(facilityKey, monthKey, token);
      if (rep.found) {
        setNarrative({ ...emptyNarrative(), ...rep.narrative });
        setSignoff(rep.signoff || emptySignoff());
      }
    } catch {
      // biarkan, bukan blocking error
    }
  }, [facilityKey, monthKey, token]);

  const saveEntriesOnly = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      await apiSaveEntries(facilityKey, monthKey, entries, token);
      onSaved && onSaved();
    } catch (err) {
      setSaveError("Gagal menyimpan data: " + err.message);
    } finally {
      setSaving(false);
    }
  }, [facilityKey, monthKey, entries, token, onSaved]);

  const saveNarrativeOnly = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      await apiSaveReport(facilityKey, monthKey, narrative, token);
      onSaved && onSaved();
    } catch (err) {
      setSaveError("Gagal menyimpan narasi: " + err.message);
    } finally {
      setSaving(false);
    }
  }, [facilityKey, monthKey, narrative, token, onSaved]);

  const handleApproveDikaji = useCallback(async () => {
    setApproving(true);
    setSaveError("");
    try {
      await apiApproveDikaji(facilityKey, monthKey, token);
      await reloadReport();
      onSaved && onSaved();
    } catch (err) {
      setSaveError("Gagal menyetujui: " + err.message);
    } finally {
      setApproving(false);
    }
  }, [facilityKey, monthKey, token, reloadReport, onSaved]);

  const handleApproveMengetahui = useCallback(async () => {
    setApproving(true);
    setSaveError("");
    try {
      await apiApproveMengetahui(facilityKey, monthKey, token);
      await reloadReport();
      onSaved && onSaved();
    } catch (err) {
      setSaveError("Gagal menyetujui: " + err.message);
    } finally {
      setApproving(false);
    }
  }, [facilityKey, monthKey, token, reloadReport, onSaved]);

  async function handleGenerateNarrative(useAI = true) {
    setGenerating(true);
    setAiError("");
    const localRes = generateLocalNarrative({
      facilityLabel: facility.label,
      monthLabel: monthLabel(monthKey),
      classes,
      entries,
    });

    if (!useAI) {
      setNarrative((prev) => ({
        ...prev,
        perKelas: { ...prev.perKelas, ...localRes.perKelas },
        kesimpulanUmum: localRes.kesimpulanUmum,
      }));
      setGenerating(false);
      return;
    }

    try {
      const stats = buildStatsSummary(classes, entries);
      let prevSummary = "Tidak ada data bulan sebelumnya.";
      try {
        const prevRep = await fetchReport(facilityKey, prevMonthKey(monthKey), token);
        if (prevRep.found) prevSummary = prevRep.narrative?.kesimpulanUmum || "Ada data bulan sebelumnya, namun tanpa ringkasan tertulis.";
      } catch {
        // biarkan default
      }
      const parsed = await generateNarrative({
        facilityLabel: facility.label,
        monthLabel: monthLabel(monthKey),
        classes,
        stats,
        prevSummary,
      });
      setNarrative((prev) => ({
        ...prev,
        perKelas: { ...prev.perKelas, ...parsed.perKelas },
        kesimpulanUmum: parsed.kesimpulanUmum || localRes.kesimpulanUmum,
      }));
    } catch (err) {
      setNarrative((prev) => ({
        ...prev,
        perKelas: { ...prev.perKelas, ...localRes.perKelas },
        kesimpulanUmum: localRes.kesimpulanUmum,
      }));
      setAiError("AI gagal merespons, dipakai narasi otomatis dari data sebagai gantinya. Detail error: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" size={18} /> Memuat data dari spreadsheet...</div>;
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ChevronLeft size={16} /> Kembali ke Dashboard
        </button>
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
      </div>
    );
  }

  if (mode === "reportEM") {
    return (
      <ReportEMPanel
        facilityKey={facilityKey}
        entriesForMonth={entries}
        monthKey={monthKey}
        session={session}
        token={token}
        locked={isLocked}
        onBack={() => setMode("pengkajian")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ChevronLeft size={16} /> Kembali ke Dashboard
        </button>
        <div className="flex items-center gap-2">
          <input type="month" value={monthKey} onChange={(ev) => setMonthKey(ev.target.value)} onClick={(ev) => ev.currentTarget.showPicker?.()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          {(isQC || isQA) && (
            <button onClick={() => setMode("reportEM")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Printer size={15} /> Report Hasil EM (FM.QC.062)
            </button>
          )}
          {isQA && (
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Printer size={15} /> Download / Print PDF
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 print-card">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-900 px-5 py-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" className="h-12 w-12 shrink-0 object-contain brightness-0 invert" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">PT. Rama Emerald Multi Sukses — QA</p>
                <h2 className="text-xl font-bold text-white">Pengkajian Trend Data Environment Monitoring (EM) Viable</h2>
                <p className="text-sm text-blue-100">
                  Fasilitas: <span className="font-medium text-white">{facility.label}</span> · Periode: <span className="font-medium text-white">{monthLabel(monthKey)}</span>
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-blue-200">
              <p>No. Formulir: QA.FM.156</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between bg-white px-5 py-3">
          <span className="text-xs text-slate-400">Status keseluruhan periode ini</span>
          <StatusPill level={overallLevel} hasData={entries.length > 0} />
        </div>
      </div>

      {saveError && <p className="no-print mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{saveError}</p>}

      {!session && (
        <div className="no-print mb-4 rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          Anda melihat mode publik — hanya data hasil pengujian yang ditampilkan. Login sebagai Tamu untuk melihat grafik &amp; pembahasan/pengkajian lengkap, atau sebagai Staff/Supervisor/Manager untuk mengisi/menyetujui data.
        </div>
      )}

      <div className="no-print mb-5">
        <EntryEditor masterRooms={masterRooms} entries={entries} setEntries={setEntries} onSave={saveEntriesOnly} saving={saving}
          canInput={canInputQC && !isLocked} canDeleteExisting={canDeleteQC && !isLocked}
          accessNote={
            isLocked
              ? "Pengkajian EM bulan ini sudah di-approve final — data terkunci, hubungi Administrator"
              : session ? "Staff/Supervisor/Manager QC atau Supervisor/Manager QA yang bisa mengisi data" : "Login untuk mengisi data"
          } />
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 print-card">
        <h3 className="mb-3 text-sm font-bold text-slate-700">Persyaratan</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Kelas</th>
                <th className="px-3 py-2 text-right">Syarat</th><th className="px-3 py-2 text-right">Alert Limit</th><th className="px-3 py-2 text-right">Action Limit</th>
              </tr>
            </thead>
            <tbody>
              {persyaratanRows.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1.5">{PARAM_DEFS.find((p) => p.key === l.parameter).short}</td>
                  <td className="px-3 py-1.5">{l.kelas}</td>
                  <td className="px-3 py-1.5 text-right">{l.lessThan ? "< 1" : l.syarat}</td>
                  <td className="px-3 py-1.5 text-right">{l.lessThan ? "< 1" : l.alert}</td>
                  <td className="px-3 py-1.5 text-right">{l.lessThan ? "< 1" : l.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><LegendRow /></div>
      </div>

      {canViewDiscussion && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">Pembahasan &amp; Narasi</h3>
          {canEditQA ? (
            <div className="flex gap-2">
              <button onClick={() => handleGenerateNarrative(false)} disabled={generating || entries.length === 0 || isLocked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Buat Narasi dari Data
              </button>
              <button onClick={() => handleGenerateNarrative(true)} disabled={generating || entries.length === 0 || isLocked}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? "Menyusun narasi..." : "Buat Narasi dengan AI"}
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              <Lock size={12} /> Hanya Supervisor/Manager QA yang bisa menyusun narasi
            </span>
          )}
        </div>
      )}
      {canViewDiscussion && isLocked && (
        <p className="no-print mb-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
          <Lock size={12} /> Pengkajian EM bulan ini sudah di-approve final — narasi terkunci, hubungi Administrator kalau perlu perubahan.
        </p>
      )}
      {canViewDiscussion && aiError && <p className="no-print mb-3 text-sm text-red-600">{aiError}</p>}

      {canViewDiscussion && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 print-card">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Pendahuluan</label>
          <AutoTextarea className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            rows={3} value={narrative.pendahuluan} onChange={(ev) => setNarrative({ ...narrative, pendahuluan: ev.target.value })} readOnly={!canEditQA || isLocked} />
        </div>
      )}

      {/* Tabel data hasil pengujian per kelas TETAP tampil untuk publik tanpa
          login. Grafik & narasi pembahasan per kelas dikontrol lewat prop
          showDiscussion di dalam ClassSection (hanya untuk yang sudah login). */}
      <div className="mb-5 space-y-4">
        {classes.map((k) => (
          <ClassSection key={k} kelas={k} entries={grouped[k]} narrativeText={narrative.perKelas[k]}
            onNarrativeChange={(val) => setNarrative({ ...narrative, perKelas: { ...narrative.perKelas, [k]: val } })}
            readOnly={!canEditQA || isLocked} showDiscussion={canViewDiscussion} />
        ))}
      </div>

      {!canViewDiscussion && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          <Lock size={18} className="mx-auto mb-2 text-slate-300" />
          Grafik, pembahasan, dan pengkajian QA hanya bisa dilihat oleh akun yang sudah login (minimal akun Tamu).
        </div>
      )}

      {canViewDiscussion && (
        <>
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 print-card">
            <h3 className="mb-3 text-sm font-bold text-slate-700">Kesimpulan Umum</h3>
            <AutoTextarea className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
              rows={8} value={narrative.kesimpulanUmum} onChange={(ev) => setNarrative({ ...narrative, kesimpulanUmum: ev.target.value })} readOnly={!canEditQA || isLocked} />
          </div>

          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 print-card">
            <h3 className="mb-3 text-sm font-bold text-slate-700">Tanda Tangan</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { field: "dinilai", label: "Dikaji Oleh", canApprove: canEditQA, onApprove: handleApproveDikaji,
                  disabledNote: "Hanya Supervisor/Manager QA yang bisa menyetujui" },
                { field: "diperiksa", label: "Mengetahui", canApprove: canApproveFinal, onApprove: handleApproveMengetahui,
                  disabledNote: signoff.dinilai?.nama ? "Hanya Manager QA yang bisa menyetujui final" : "Menunggu approval \"Dikaji Oleh\" terlebih dahulu" },
              ].map(({ field, label, canApprove, onApprove, disabledNote }) => (
                <div key={field} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <div className="mb-3 flex h-24 items-center justify-center rounded border border-dashed border-slate-300 print:h-28">
                    {signoff[field]?.nama ? (
                      <VerifyQR type="pengkajian" facility={facilityKey} period={monthKey} slot={field} size={68} />
                    ) : (
                      <span className="only-screen text-xs text-slate-300">Ruang tanda tangan</span>
                    )}
                  </div>
                  {signoff[field]?.nama ? (
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-slate-700">{signoff[field].nama}</p>
                      <p className="text-slate-500">{signoff[field].jabatan}</p>
                      <p className="text-xs text-slate-400">{signoff[field].tanggal ? fullDateID(signoff[field].tanggal) : ""}</p>
                    </div>
                  ) : canApprove ? (
                    <button onClick={onApprove} disabled={approving || (field === "diperiksa" && !signoff.dinilai?.nama)}
                      className="no-print inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                      {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Setujui &amp; Tanda Tangani
                    </button>
                  ) : (
                    <p className="no-print inline-flex items-center gap-1.5 text-xs text-slate-400"><Lock size={12} /> {disabledNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canEditQA && !isLocked && (
            <div className="no-print mb-8 flex justify-end">
              <button onClick={saveNarrativeOnly} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null} Simpan Narasi &amp; Pembahasan
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ========================================================================= AUTH UI */

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (ev) => {
    ev.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onLogin(username.trim(), password);
      onClose();
    } catch (err) {
      setError(err.message || "Login gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={18} className="text-blue-700" />
          <h3 className="text-base font-bold text-slate-800">Login EM Viable</h3>
        </div>
        <form onSubmit={submit}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Username</label>
          <input autoFocus type="text" value={username} onChange={(ev) => setUsername(ev.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
          <input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={submitting || !username || !password}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null} Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TopBar({ session, onLoginClick, onLogout, view, setView }) {
  return (
    <div className="no-print border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button onClick={() => setView("dashboard")} className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" className="h-8 w-8 object-contain" />
          EM Viable — PT. Rama Emerald Multi Sukses
        </button>
        <div className="flex items-center gap-2">
          {session && hasAccess(session, "Supervisor") && (
            <button onClick={() => setView("activity")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "activity" ? "bg-slate-800 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
              <History size={14} /> Riwayat Aktivitas
            </button>
          )}
          {session ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex">
                <User size={13} /> {session.nama} · {session.role}{session.departemen ? ` ${session.departemen}` : ""}
              </span>
              <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <LogOut size={14} /> Keluar
              </button>
            </div>
          ) : (
            <button onClick={onLoginClick} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
              <LogIn size={14} /> Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityLogPage({ token, onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchActivityLog(token)
      .then((res) => { if (!cancelled) setLogs(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ChevronLeft size={16} /> Kembali ke Dashboard
      </button>
      <h2 className="mb-4 text-lg font-bold text-slate-800">Riwayat Aktivitas</h2>
      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" size={16} /> Memuat...</div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      ) : logs.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Belum ada aktivitas tercatat.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Aksi</th><th className="px-3 py-2">Fasilitas</th><th className="px-3 py-2">Bulan</th><th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-500">{new Date(l.waktu).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-1.5">{l.nama}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{l.role} {l.departemen}</td>
                  <td className="px-3 py-1.5">{l.aksi}</td>
                  <td className="px-3 py-1.5">{l.fasilitas}</td>
                  <td className="px-3 py-1.5">{l.bulan}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= VERIFIKASI TANDA TANGAN (halaman publik, dibuka lewat scan QR) */

function VerifyPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const type = params.get("type"); // "report" | "pengkajian"
  const facilityKey = params.get("facility");
  const slot = params.get("slot");
  const period = type === "report" ? params.get("tanggal") : params.get("month");
  const facility = FACILITIES.find((f) => f.key === facilityKey);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!type || !facilityKey || !period || !slot || !facility) {
        setErrorMsg("Kode QR tidak lengkap atau tidak dikenali.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetchVerify(type, facilityKey, period, slot);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setErrorMsg(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let signer = null;
  let docLabel = "";
  let periodLabel = "";
  if (data && !data.error) {
    if (type === "report") {
      docLabel = "Report Hasil EM (FM.QC.062)";
      periodLabel = "Tanggal Pemeriksaan: " + fullDateID(period);
      signer = slot === "analis"
        ? { nama: data.analis?.nama, label: "Diperiksa oleh (Analis)", tanggal: data.analis?.tanggal }
        : { nama: data.diperiksa?.nama, label: "Mengetahui (QC)", tanggal: data.diperiksa?.tanggal };
    } else {
      docLabel = "Pengkajian Trend Data EM Viable (QA.FM.156)";
      periodLabel = "Periode: " + monthLabel(period);
      signer = slot === "dinilai"
        ? { nama: data.signoff?.dinilai?.nama, label: "Dikaji Oleh", tanggal: data.signoff?.dinilai?.tanggal, jabatan: data.signoff?.dinilai?.jabatan }
        : { nama: data.signoff?.diperiksa?.nama, label: "Mengetahui (Final)", tanggal: data.signoff?.diperiksa?.tanggal, jabatan: data.signoff?.diperiksa?.jabatan };
    }
  }
  const isValid = !!signer?.nama;
  const [periodLabelKey, periodLabelVal] = periodLabel.split(/:\s(.+)/);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" className="h-14 w-14 object-contain" />
          <h1 className="text-center text-base font-bold text-slate-800">Verifikasi Dokumen EM Viable</h1>
          <p className="text-center text-xs text-slate-500">PT. Rama Emerald Multi Sukses</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="py-4 text-center text-sm text-slate-400">Memeriksa data…</p>
          ) : errorMsg || !facility || data?.error ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <AlertTriangle className="text-red-500" size={28} />
              <p className="text-sm font-semibold text-red-600">Kode tidak valid</p>
              <p className="text-xs text-slate-500">{errorMsg || data?.error || "Dokumen tidak ditemukan di sistem."}</p>
            </div>
          ) : !isValid ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <AlertTriangle className="text-amber-500" size={28} />
              <p className="text-sm font-semibold text-amber-600">Belum ditandatangani</p>
              <p className="text-xs text-slate-500">Slot tanda tangan ini belum disetujui di sistem.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-1 text-center">
              <CheckCircle2 className="text-emerald-600" size={32} />
              <p className="text-sm font-semibold text-emerald-700">Dokumen tercatat sah dalam sistem</p>
              <div className="w-full space-y-1.5 rounded-lg bg-slate-50 p-3 text-left text-sm">
                <p><span className="text-slate-400">Dokumen: </span><span className="font-medium">{docLabel}</span></p>
                <p><span className="text-slate-400">Fasilitas: </span><span className="font-medium">{facility.label}</span></p>
                <p><span className="text-slate-400">{periodLabelKey}: </span><span className="font-medium">{periodLabelVal}</span></p>
                <p><span className="text-slate-400">{signer.label}: </span><span className="font-medium">{signer.nama}</span></p>
                {signer.jabatan && <p><span className="text-slate-400">Jabatan: </span><span className="font-medium">{signer.jabatan}</span></p>}
                <p><span className="text-slate-400">Tanggal disetujui: </span><span className="font-medium">{signer.tanggal ? fullDateID(signer.tanggal) : "-"}</span></p>
              </div>
            </div>
          )}
        </div>

        <p className="mx-auto mt-4 max-w-xs text-center text-[11px] text-slate-400">
          Halaman ini menampilkan data langsung dari sistem EM Viable secara real-time, bukan dari isi file PDF yang di-scan.
        </p>
      </div>
    </div>
  );
}

/* ========================================================================= APP ROOT */

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/verify") {
    return <VerifyPage />;
  }
  const { session, checking, login: doLogin, logout: doLogout } = useAuth();
  // Tombol print sudah disembunyikan dari Tamu/publik, tapi itu tidak
  // mencegah Ctrl+P / File > Print browser. Makanya kita blok juga di level
  // CSS (@media print) di bawah supaya Ctrl+P pun tidak menghasilkan cetakan
  // yang berarti untuk Tamu/publik.
  const canPrint = !!session && session.role !== "Tamu";
  const [showLogin, setShowLogin] = useState(false);
  const [view, setView] = useState("dashboard");
  const [facilityKey, setFacilityKey] = useState(null);
  const [monthKey, setMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statusIndex, setStatusIndex] = useState({});
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  const refreshStatus = useCallback(async (month) => {
    setLoadingStatus(true);
    setStatusError("");
    try {
      const idx = await fetchStatusIndex(month);
      setStatusIndex(idx);
    } catch (err) {
      setStatusError("Gagal memuat status dari spreadsheet: " + err.message);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (view === "dashboard") refreshStatus(monthKey);
  }, [view, monthKey, refreshStatus]);

  // Kalau user logout ketika sedang di halaman Riwayat Aktivitas (yang
  // butuh login Supervisor+), lempar balik ke dashboard.
  useEffect(() => {
    if (view === "activity" && !(session && hasAccess(session, "Supervisor"))) {
      setView("dashboard");
    }
  }, [session, view]);

  if (checking) {
    return <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" size={18} /> Memuat sesi...</div>;
  }

  return (
    <div className={`min-h-full bg-slate-50 ${!canPrint ? "print-blocked" : ""}`}>
      <div className="print-only-notice">
        Dokumen ini tidak bisa dicetak oleh akun Tamu atau publik tanpa login. Hubungi personil QC/QA untuk salinan resmi.
      </div>
      <style>{`
        .only-print { display: none; }
        .print-only-notice { display: none; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          .no-print { display: none !important; }
          .only-screen { display: none !important; }
          .only-print { display: block !important; }
          .print-card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; page-break-inside: avoid; break-inside: avoid; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          /* Ctrl+P / File > Print browser tetap bisa dipicu siapa saja —
             ini mencegah hasil cetakannya berisi apa pun kalau yang login
             Tamu atau publik (tanpa login), walau tombol Print sudah
             disembunyikan dari mereka di layar. */
          .print-blocked > *:not(.print-only-notice) { display: none !important; }
          .print-blocked .print-only-notice {
            display: block !important;
            padding: 5cm 2cm;
            text-align: center;
            font-size: 14px;
            color: #334155;
          }
        }
        @page {
          margin: 1.5cm 1.5cm 2cm 1.5cm;
        }
        @page {
          @bottom-right {
            content: "Halaman " counter(page);
            font-size: 9px;
            color: #64748b;
          }
        }
      `}</style>
      <TopBar session={session} onLoginClick={() => setShowLogin(true)} onLogout={doLogout} view={view} setView={setView} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={doLogin} />}
      {view === "dashboard" ? (
        <Dashboard
          monthKey={monthKey}
          setMonthKey={setMonthKey}
          statusIndex={statusIndex}
          loadingStatus={loadingStatus}
          statusError={statusError}
          onOpen={(key) => { setFacilityKey(key); setView("detail"); }}
        />
      ) : view === "activity" ? (
        <ActivityLogPage token={session?.token} onBack={() => setView("dashboard")} />
      ) : (
        <FacilityDetail
          facilityKey={facilityKey}
          monthKey={monthKey}
          setMonthKey={setMonthKey}
          onBack={() => setView("dashboard")}
          onSaved={() => refreshStatus(monthKey)}
          session={session}
          token={session?.token}
        />
      )}
    </div>
  );
}
