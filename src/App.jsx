import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  LogIn,
  LogOut,
  User,
  Loader2,
  Building2,
  ChevronLeft,
  Lock,
  History,
  Save,
  FileCheck2,
  ClipboardList,
  Printer,
  Sparkles,
  Calendar,
  Trash2,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  KeyRound,
  LayoutDashboard,
  Menu,
  X,
  ShieldCheck,
  Activity,
  Layers,
  ArrowLeft,
  Boxes,
  Download,
  FlaskConical,
  Microscope,
  Stethoscope,
  Warehouse,
  PackageCheck,
  Map,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Bell,
  AlertOctagon,
  Clock,
  FileText,
  Thermometer,
  Droplets,
  Gauge,
  FileSpreadsheet,
} from "lucide-react";
import {
  fetchMaster,
  fetchEntries,
  saveEntries as apiSaveEntries,
  fetchReport,
  saveReport as apiSaveReport,
  fetchStatusIndex,
  approveDikaji as apiApproveDikaji,
  approveMengetahui as apiApproveMengetahui,
  fetchActivityLog,
  fetchVerify,
  generateNarrative,
  fetchFormulirBulanan,
  approveKepalaBagian as apiApproveKepalaBagian,
  approveManagerQAFormulir as apiApproveManagerQAFormulir,
  approveOpr as apiApproveOpr,
  approveSpv as apiApproveSpv,
  approveDay as apiApproveDay,
} from "./api.js";
import { useAuth, hasAccess, hasFacilityAccess } from "./auth.js";
import {
  buildFacilityStats,
  generateLocalNarrative,
  fullDateID,
  monthLabelID,
} from "./narrativeGenerator.js";

/* =========================================================================
   1. ERROR BOUNDARY
   ========================================================================= */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Critical Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white font-sans">
          <div className="max-w-md w-full bg-zinc-900 rounded-3xl p-8 border border-rose-900/50 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-800 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Terjadi Kesalahan Aplikasi</h2>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              Sistem mendeteksi error pada komponen antarmuka:
            </p>
            <div className="text-left bg-black/80 p-3.5 rounded-xl border border-zinc-800 text-[11px] font-mono text-rose-300 overflow-x-auto max-h-36">
              {String(this.state.error?.message || this.state.error)}
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
                className="px-5 py-2.5 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold transition shadow-md"
              >
                Muat Ulang Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =========================================================================
   2. MASTER FASILITAS & GRUP
   ========================================================================= */
const FACILITIES = [
  { key: "nblProduksi", label: "NBL Produksi", department: "Produksi", group: "nbl" },
  { key: "nblKemasan", label: "NBL Kemasan", department: "Kemasan", altDepartment: "Produksi", group: "nbl" },
  { key: "gbbNbl", label: "GBB NBL", department: "GBB", altDepartment: "PPIC", group: "nbl" },

  { key: "blProduksi", label: "BL Produksi", department: "Produksi", group: "bl" },
  { key: "blKemasan", label: "BL Kemasan", department: "Kemasan", altDepartment: "Produksi", group: "bl" },
  { key: "gbbBl", label: "GBB BL", department: "GBB", altDepartment: "PPIC", group: "bl" },

  { key: "sefaNonSterilProduksi", label: "Sefa Non Steril Produksi", department: "Produksi", group: "sefaNonSteril" },
  { key: "sefaNonSterilKemasan", label: "Sefa Non Steril Kemasan", department: "Kemasan", altDepartment: "Produksi", group: "sefaNonSteril" },
  { key: "gbbSefa", label: "GBB SEFA", department: "GBB", altDepartment: "PPIC", group: "sefaNonSteril" },

  { key: "sefaSterilProduksi", label: "Sefa Steril Produksi", department: "Produksi", group: "sefaSteril" },
  { key: "sefaSterilKemasan", label: "Sefa Steril Kemasan", department: "Kemasan", altDepartment: "Produksi", group: "sefaSteril" },

  { key: "qc", label: "Laboratorium QC", department: "QC", group: "qc" },
  { key: "rnd", label: "Research and Development (RND)", department: "RND", group: "rnd" },
  { key: "pkrt", label: "Perbekalan Kesehatan Rumah Tangga (PKRT)", department: "PKRT", altDepartment: "Produksi", group: "pkrt" },
  { key: "alkes", label: "Alat Kesehatan (Alkes)", department: "PKRT", altDepartment: "Produksi", group: "alkes" },
  { key: "gbj", label: "Gudang Barang Jadi (GBJ)", department: "GBJ", altDepartment: "PPIC", group: "gbj" },
  { key: "gbk", label: "Gudang Bahan Kemas (GBK)", department: "GBK", altDepartment: "PPIC", group: "gbk" },
];

const GROUPS = [
  { key: "nbl", title: "Nonbetalaktam (NBL)", items: ["nblProduksi", "nblKemasan"] },
  { key: "bl", title: "Betalaktam (BL)", items: ["blProduksi", "blKemasan"] },
  { key: "sefaNonSteril", title: "Sefalosporin Non Steril", items: ["sefaNonSterilProduksi", "sefaNonSterilKemasan"] },
  { key: "sefaSteril", title: "Sefalosporin Steril", items: ["sefaSterilProduksi", "sefaSterilKemasan"] },
  { key: "gbb", title: "Gudang Bahan Baku (GBB)", items: ["gbbNbl", "gbbBl", "gbbSefa"] },
  { key: "qc", title: "Laboratorium QC", singleKey: "qc", icon: FlaskConical },
  { key: "rnd", title: "Research & Development (RND)", singleKey: "rnd", icon: Microscope },
  { key: "pkrt", title: "PKRT", singleKey: "pkrt", icon: Sparkles },
  { key: "alkes", title: "Alat Kesehatan (Alkes)", singleKey: "alkes", icon: Stethoscope },
  { key: "gbj", title: "Gudang Barang Jadi (GBJ)", singleKey: "gbj", icon: Warehouse },
  { key: "gbk", title: "Gudang Bahan Kemas (GBK)", singleKey: "gbk", icon: PackageCheck },
];

const DENAH_MAP = {
  nblProduksi: "/denah/nbl.png",
  nblKemasan: "/denah/nbl.png",
  gbbNbl: "/denah/nbl.png",

  sefaNonSterilProduksi: "/denah/sefa.png",
  sefaNonSterilKemasan: "/denah/sefa.png",
  sefaSterilProduksi: "/denah/sefa.png",
  sefaSterilKemasan: "/denah/sefa.png",
  gbbSefa: "/denah/sefa.png",
};

const PARAM_DEFS = [
  { key: "suhu", label: "Suhu", unit: "°C", icon: Thermometer },
  { key: "rh", label: "Kelembaban Relatif (RH)", unit: "%", icon: Droplets },
  { key: "dpg", label: "Perbedaan Tekanan (DPG)", unit: "Pa", icon: Gauge },
];

const SESI = ["08:00", "13:00"];

/* =========================================================================
   3. UTILITY HELPER
   ========================================================================= */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(monthStr) {
  if (!monthStr) return 31;
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function toNumberSafe(v) {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const clean = String(v).replace(/[≤≥]/g, "").replace(",", ".").trim();
  const n = Number(clean);
  return Number.isNaN(n) ? null : n;
}

function inRange(v, lower, upper) {
  const lo = toNumberSafe(lower);
  const hi = toNumberSafe(upper);
  if (lo !== null && v < lo) return false;
  if (hi !== null && v > hi) return false;
  return true;
}

function liveLevelFor(rawValue, limit, paramKey) {
  if (rawValue === "-") return 1;
  const v = toNumberSafe(rawValue);
  if (v === null) return 0;
  if (!limit) return paramKey === "suhu" ? 1 : null;

  const allNull = [
    limit.syaratL,
    limit.syaratU,
    limit.alertL,
    limit.alertU,
    limit.actionL,
    limit.actionU,
  ].every((x) => toNumberSafe(x) === null);
  if (allNull) return paramKey === "suhu" ? 1 : null;

  if (inRange(v, limit.alertL, limit.alertU)) return 1;
  if (inRange(v, limit.actionL, limit.actionU)) return 2;
  if (inRange(v, limit.syaratL, limit.syaratU)) return 3;
  return 4;
}

const LEVEL_STYLE = {
  0: { label: "Belum diisi", color: "#64748b", bg: "#f1f5f9", dot: "#94a3b8" },
  1: { label: "Terkendali", color: "#15803d", bg: "#dcfce7", dot: "#22c55e" },
  2: { label: "Alert", color: "#b45309", bg: "#fef3c7", dot: "#f59e0b" },
  3: { label: "Action", color: "#c2410c", bg: "#ffedd5", dot: "#f97316" },
  4: { label: "Melebihi Syarat", color: "#b91c1c", bg: "#fee2e2", dot: "#ef4444" },
};

function levelStyle(level) {
  if (level === null || level === undefined) {
    return { label: "N/A", color: "#94a3b8", bg: "#f8fafc", dot: "#cbd5e1" };
  }
  return LEVEL_STYLE[level] || LEVEL_STYLE[0];
}

function formatRange(lower, upper, unit, isDpg = false) {
  const lo = toNumberSafe(lower);
  const hi = toNumberSafe(upper);
  if (lo === null && hi === null) return "—";
  if (isDpg) {
    const val = lo !== null ? lo : hi;
    return `≥ ${String(val).replace(".", ",")} ${unit}`;
  }
  if (lo === null) return `≤ ${String(hi).replace(".", ",")} ${unit}`;
  if (hi === null) return `≥ ${String(lo).replace(".", ",")} ${unit}`;
  return `${String(lo).replace(".", ",")} – ${String(hi).replace(".", ",")} ${unit}`;
}

function facilityOverallLevel(entries) {
  let max = 0;
  (entries || []).forEach((e) => {
    PARAM_DEFS.forEach((p) => {
      const lvl = e?.level?.[p.key];
      if (lvl !== null && lvl !== undefined && lvl > max) max = lvl;
    });
  });
  return max;
}

/* =========================================================================
   4. TANDA TANGAN DIGITAL QR (/verify)
   ========================================================================= */
function buildVerifyUrl(params) {
  const qs = new URLSearchParams(params).toString();
  const base =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://emnv.myrama.id";
  return `${base}/verify?${qs}`;
}

function VerifyQR({ type, facility, period, roomName, jam, signerRole, signerName, size = 36, hideLabel = true }) {
  const params = { type, facility };
  if (type === "pengkajian") {
    params.month = period;
    if (roomName) params.roomName = roomName;
    if (signerRole) params.role = signerRole;
  } else if (type === "formulir") {
    params.bulan = period;
    params.roomName = roomName;
    if (signerRole) params.role = signerRole;
  } else {
    params.type = "harian";
    params.tanggal = period;
    if (roomName) params.roomName = roomName;
    if (jam) params.jam = jam;
    if (signerRole) params.role = signerRole;
  }
  if (signerName) params.name = signerName;

  const url = buildVerifyUrl(params);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Verifikasi Tanda Tangan Digital"
      className="inline-flex flex-col items-center gap-0.5 hover:opacity-80 transition transform hover:scale-105"
    >
      <QRCodeSVG
        value={url}
        size={size}
        level="L"
        includeMargin={true}
        bgColor="#ffffff"
        fgColor="#0f172a"
      />
      {!hideLabel && <span className="text-[9px] text-slate-400">Scan</span>}
    </a>
  );
}

/* =========================================================================
   5. KOMPONEN GRAFIK RECHARTS
   ========================================================================= */
function ChartDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  const style = levelStyle(payload?.level);
  return <circle cx={cx} cy={cy} r={3.5} fill={style.color} stroke="#fff" strokeWidth={1.5} />;
}

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const style = levelStyle(p?.level);
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md px-3 py-1.5 text-xs shadow-xl space-y-0.5">
      <p className="font-semibold text-slate-800">{p.label}</p>
      <p className="text-sm font-extrabold" style={{ color: style.color }}>
        {p.value} {unit}
      </p>
      <p className="font-medium text-[10.5px]" style={{ color: style.color }}>
        {style.label}
      </p>
    </div>
  );
}

function LegendChip({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[9.5px] font-medium text-slate-600 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function DayParamChart({ activeRoomNames = [], rooms = [], currentDayEntries = [], paramKey, paramLabel, unit }) {
  const data = useMemo(() => {
    return (activeRoomNames || [])
      .map((name) => {
        const rObj = (rooms || []).find((r) => r?.name === name);
        const rowAm = (currentDayEntries || []).find((e) => e?.roomName === name && e?.jam === "08:00");
        const rowPm = (currentDayEntries || []).find((e) => e?.roomName === name && e?.jam === "13:00");
        const vAm = toNumberSafe(rowAm?.[paramKey]);
        const vPm = toNumberSafe(rowPm?.[paramKey]);
        const lim = rObj?.limits?.[paramKey];

        const points = [];
        if (vAm !== null) {
          points.push({
            label: `${name} (08:00)`,
            roomName: name,
            jam: "08:00",
            value: vAm,
            level: liveLevelFor(vAm, lim, paramKey),
            lim,
          });
        }
        if (vPm !== null) {
          points.push({
            label: `${name} (13:00)`,
            roomName: name,
            jam: "13:00",
            value: vPm,
            level: liveLevelFor(vPm, lim, paramKey),
            lim,
          });
        }
        return points;
      })
      .flat();
  }, [activeRoomNames, rooms, currentDayEntries, paramKey]);

  if (!data || data.length === 0) {
    return (
      <div className="p-4 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
        Belum ada data pengukuran {paramLabel} yang tersimpan pada tanggal ini.
      </div>
    );
  }

  const peak = data.reduce((a, b) => (b.level > a.level ? b : a), data[0]);
  const refLim = peak?.lim || rooms[0]?.limits?.[paramKey] || {};
  const isDpg = paramKey === "dpg";

  const alertVal = toNumberSafe(refLim.alertU ?? refLim.alertL);
  const actionVal = toNumberSafe(refLim.actionU ?? refLim.actionL);
  const syaratVal = toNumberSafe(refLim.syaratU ?? refLim.syaratL);

  const allVals = data
    .map((d) => d.value)
    .concat([alertVal, actionVal, syaratVal])
    .filter((v) => v !== null && !isNaN(v));
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 10);
  const yMin = minVal < 0 ? Math.round((minVal - (maxVal - minVal) * 0.1) * 10) / 10 : 0;
  const yMax = Math.round((maxVal + (maxVal - minVal) * 0.1) * 10) / 10;
  const gradId = `dayGrad-${paramKey}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs print-card avoid-break w-full">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 px-3.5 py-2 bg-slate-50/60">
        <div>
          <p className="text-xs font-bold text-slate-800">{paramLabel}</p>
          <p className="text-[9.5px] text-slate-500 mt-0.5">
            Nilai Tertinggi: <span className="font-semibold text-slate-800">{peak.value} {unit}</span> ({peak.roomName})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <LegendChip color="#15803d" label="Terkendali" />
          {alertVal !== null && <LegendChip color="#b45309" label={`Alert ${isDpg ? "≥ " : ""}${alertVal}`} />}
          {actionVal !== null && <LegendChip color="#c2410c" label={`Action ${isDpg ? "≥ " : ""}${actionVal}`} />}
          {syaratVal !== null && <LegendChip color="#b91c1c" label={`Syarat ${isDpg ? "≥ " : ""}${syaratVal}`} />}
        </div>
      </div>
      <div className="p-2.5 chart-container-print">
        <ResponsiveContainer width="100%" height={165}>
          <ComposedChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 20 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            {alertVal !== null && <ReferenceLine y={alertVal} stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="4 3" />}
            {actionVal !== null && <ReferenceLine y={actionVal} stroke="#ea580c" strokeWidth={1.2} strokeDasharray="4 3" />}
            {syaratVal !== null && <ReferenceLine y={syaratVal} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 3" />}
            <XAxis dataKey="label" tick={{ fontSize: 8.5, fill: "#64748b" }} angle={-25} textAnchor="end" interval={0} height={30} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 8.5, fill: "#64748b" }} width={36} tickFormatter={(v) => { const n = Math.round(v * 10) / 10; return Number.isInteger(n) ? n : n.toFixed(1); }} />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${gradId})`} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#16a34a"
              strokeWidth={2}
              dot={<ChartDot />}
              activeDot={{ r: 4.5, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RoomMonthlyTrendChart({ entriesData = [], paramKey, paramLabel, unit, limit, isGlobal = false }) {
  const data = useMemo(() => {
    return (entriesData || [])
      .map((e) => {
        const v = toNumberSafe(e?.[paramKey]);
        if (v === null) return null;
        return {
          label: isGlobal
            ? `${String(e?.tanggal || "").slice(-2)} (${e?.roomName || ""})`
            : `${String(e?.tanggal || "").slice(-2)}/${e?.jam || ""}`,
          value: v,
          level: e?.level?.[paramKey] ?? 0,
          roomName: e?.roomName || "",
        };
      })
      .filter(Boolean);
  }, [entriesData, paramKey, isGlobal]);

  if (!data || data.length === 0) return null;

  const peak = data.reduce((a, b) => (b.level > a.level ? b : a), data[0]);
  const isDpg = paramKey === "dpg";

  const alertVal = toNumberSafe(limit?.alertU ?? limit?.alertL);
  const actionVal = toNumberSafe(limit?.actionU ?? limit?.actionL);
  const syaratVal = toNumberSafe(limit?.syaratU ?? limit?.syaratL);

  const allVals = data
    .map((d) => d.value)
    .concat([alertVal, actionVal, syaratVal])
    .filter((v) => v !== null && !isNaN(v));
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 10);
  const yMin = minVal < 0 ? Math.round((minVal - (maxVal - minVal) * 0.1) * 10) / 10 : 0;
  const yMax = Math.round((maxVal + (maxVal - minVal) * 0.1) * 10) / 10;
  const gradId = `monthGrad-${paramKey}-${isGlobal ? "global" : "room"}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs print-card avoid-break w-full">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 px-3.5 py-2 bg-slate-50/60">
        <div>
          <p className="text-xs font-bold text-slate-800">
            {paramLabel} — {isGlobal ? "Tren Global Fasilitas" : "Tren 1 Bulan"}
          </p>
          <p className="text-[9.5px] text-slate-500 mt-0.5">
            Nilai Tertinggi: <span className="font-semibold text-slate-800">{peak.value} {unit}</span> ({peak.roomName})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <LegendChip color="#15803d" label="Terkendali" />
          {alertVal !== null && <LegendChip color="#b45309" label={`Alert ${isDpg ? "≥ " : ""}${alertVal}`} />}
          {actionVal !== null && <LegendChip color="#c2410c" label={`Action ${isDpg ? "≥ " : ""}${actionVal}`} />}
          {syaratVal !== null && <LegendChip color="#b91c1c" label={`Syarat ${isDpg ? "≥ " : ""}${syaratVal}`} />}
        </div>
      </div>
      <div className="p-2.5 chart-container-print">
        <ResponsiveContainer width="100%" height={155}>
          <ComposedChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 20 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            {alertVal !== null && <ReferenceLine y={alertVal} stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="4 3" />}
            {actionVal !== null && <ReferenceLine y={actionVal} stroke="#ea580c" strokeWidth={1.2} strokeDasharray="4 3" />}
            {syaratVal !== null && <ReferenceLine y={syaratVal} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 3" />}
            <XAxis dataKey="label" tick={{ fontSize: 8, fill: "#64748b" }} angle={-25} textAnchor="end" interval="preserveStartEnd" height={30} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 8.5, fill: "#64748b" }} width={36} tickFormatter={(v) => { const n = Math.round(v * 10) / 10; return Number.isInteger(n) ? n : n.toFixed(1); }} />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${gradId})`} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#16a34a"
              strokeWidth={2}
              dot={<ChartDot />}
              activeDot={{ r: 4.5, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* =========================================================================
   6. SIDEBAR COMPONENT (HITAM PEKAT & NO-PRINT)
   ========================================================================= */
function Sidebar({ session, view, setView, status = {}, onNeedLogin, isOpen, onClose, notifications = [] }) {
  const [expandedGroups, setExpandedGroups] = useState({ nbl: true, gbb: true });

  const toggleGroup = (k) => {
    setExpandedGroups((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const navigateTo = (newView) => {
    if (newView.page === "facility" && !session) {
      onNeedLogin();
      return;
    }
    setView(newView);
    if (window.innerWidth < 1024) onClose();
  };

  const criticalCount = notifications.filter((n) => n.type === "critical").length;

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="no-print fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Background Hitam Pekat (bg-black) & no-print */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-72 bg-black text-zinc-300 border-r border-zinc-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-800/80 bg-zinc-950">
          <button onClick={() => navigateTo({ page: "dashboard" })} className="flex items-center gap-3 text-left">
            <img src="/logo-rama.png" alt="Logo" className="h-9 w-9 object-contain brightness-0 invert" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white tracking-tight leading-tight truncate">EM Non Viable</p>
              <p className="text-[10px] font-medium text-rose-400 truncate">PT. Rama Emerald Multi Sukses</p>
            </div>
          </button>
          <button onClick={onClose} className="text-zinc-400 hover:text-white lg:hidden p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Menu Utama</p>
            <button
              onClick={() => navigateTo({ page: "dashboard" })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                view.page === "dashboard"
                  ? "bg-rose-900 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard Global</span>
            </button>

            {session && (
              <button
                onClick={() => navigateTo({ page: "notifications" })}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  view.page === "notifications"
                    ? "bg-rose-900 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell size={16} />
                  <span>Pusat Notifikasi</span>
                </div>
                {notifications.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white ${
                      criticalCount > 0 ? "bg-red-600 animate-pulse" : "bg-amber-500"
                    }`}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>
            )}

            {session && hasAccess(session, "Supervisor", "QA") && (
              <button
                onClick={() => navigateTo({ page: "pengkajian", facility: view.facility || "nblProduksi", room: "" })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  view.page === "pengkajian" && !view.room
                    ? "bg-rose-900 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <ClipboardList size={16} />
                <span>Pengkajian QA Global</span>
              </button>
            )}
            {session && hasAccess(session, "Supervisor") && (
              <button
                onClick={() => navigateTo({ page: "activity" })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  view.page === "activity"
                    ? "bg-rose-900 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <History size={16} />
                <span>Riwayat Aktivitas</span>
              </button>
            )}
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Area &amp; Fasilitas</p>
            {GROUPS.map((g) => {
              if (g.singleKey) {
                const fac = FACILITIES.find((f) => f.key === g.singleKey);
                const st = status?.[g.singleKey];
                const active = view.page === "facility" && view.facility === g.singleKey;
                const dotColor = st?.hasData ? levelStyle(st.level).dot : "#52525b";
                const SingleIcon = g.icon || Building2;

                return (
                  <button
                    key={g.key}
                    onClick={() => navigateTo({ page: "facility", facility: g.singleKey })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                      active
                        ? "bg-rose-900/70 text-white border border-rose-700/50"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <SingleIcon size={14} className="text-zinc-400 shrink-0" />
                      <span className="truncate">{fac?.label || g.title}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                  </button>
                );
              }

              const isOpenGroup = !!expandedGroups[g.key];
              const isGroupActive = view.page === "facility" && g.items.includes(view.facility);
              const GroupIcon = Building2;

              return (
                <div key={g.key} className="space-y-0.5">
                  <button
                    onClick={() => toggleGroup(g.key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      isGroupActive ? "text-rose-300" : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <GroupIcon size={14} className="text-zinc-400 shrink-0" />
                      <span className="truncate">{g.title}</span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-zinc-500 transition-transform duration-200 ${isOpenGroup ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpenGroup && (
                    <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-zinc-800 ml-4">
                      {g.items.map((facKey) => {
                        const fac = FACILITIES.find((f) => f.key === facKey);
                        const st = status?.[facKey];
                        const active = view.page === "facility" && view.facility === facKey;
                        const dotColor = st?.hasData ? levelStyle(st.level).dot : "#52525b";

                        return (
                          <button
                            key={facKey}
                            onClick={() => navigateTo({ page: "facility", facility: facKey })}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition ${
                              active
                                ? "bg-rose-900 text-white font-semibold"
                                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                            }`}
                          >
                            <span className="truncate">{fac?.label}</span>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950 text-[10px] text-zinc-400 flex justify-between items-center select-none">
          <span className="font-mono text-zinc-400">SOP POS.QA.025</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online Sync
          </span>
        </div>
      </aside>
    </>
  );
}

/* =========================================================================
   7. DASHBOARD OVERVIEW COMPONENT
   ========================================================================= */
function DashboardOverview({ month, status = {}, setView, session, onNeedLogin }) {
  const perluCount = FACILITIES.filter((f) => (status?.[f.key]?.level || 0) === 3).length;
  const tmsCount = FACILITIES.filter((f) => (status?.[f.key]?.level || 0) >= 4).length;
  const terkendaliCount = FACILITIES.filter((f) => status?.[f.key]?.hasData && (status?.[f.key]?.level || 0) < 3).length;
  const belumAdaCount = FACILITIES.filter((f) => !status?.[f.key]?.hasData).length;

  function handleOpenFacility(facKey) {
    if (!session) {
      onNeedLogin();
      return;
    }
    setView({ page: "facility", facility: facKey });
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-zinc-950 to-rose-950 p-6 sm:p-8 text-white shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-rose-600/20 blur-3xl animate-pulse" />
        <div className="relative space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 px-3 py-0.5 text-[11px] font-semibold text-rose-200">
            <ShieldCheck size={13} /> Sistem Pemantauan CPOB Non Viable
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Status Fasilitas EM Non Viable</h1>
          <p className="text-xs sm:text-sm text-rose-100/80 max-w-2xl leading-relaxed">
            Pemantauan berkala parameter Suhu, Kelembaban Relatif (RH), dan Perbedaan Tekanan Ruang (DPG) seluruh gedung
            produksi periode <b>{monthLabelID(month)}</b>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-105 hover:shadow-lg hover:border-slate-300 cursor-default select-none">
          <p className="text-xs font-semibold text-slate-400">Total Fasilitas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{FACILITIES.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-300 cursor-default select-none">
          <p className="text-xs font-semibold text-emerald-700">Terkendali</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{terkendaliCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-300 cursor-default select-none">
          <p className="text-xs font-semibold text-amber-700">Perlu Perhatian</p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{perluCount}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-105 hover:shadow-lg hover:shadow-red-500/10 hover:border-red-300 cursor-default select-none">
          <p className="text-xs font-semibold text-red-700">Melebihi Syarat</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{tmsCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-105 hover:shadow-lg hover:border-slate-300 cursor-default select-none">
          <p className="text-xs font-semibold text-slate-400">Belum Ada Data</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{belumAdaCount}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Matriks 17 Fasilitas — {monthLabelID(month)}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GROUPS.map((g) => {
            if (g.singleKey) {
              const fac = FACILITIES.find((f) => f.key === g.singleKey);
              const st = status?.[g.singleKey];
              const lvl = levelStyle(st?.hasData ? st.level : null);
              const SingleIcon = g.icon || Building2;

              return (
                <div
                  key={g.key}
                  onClick={() => handleOpenFacility(g.singleKey)}
                  className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:border-rose-400 hover:shadow-xl hover:shadow-rose-950/5 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-rose-50 group-hover:text-rose-900 shadow-2xs">
                        <SingleIcon size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 transition-colors group-hover:text-rose-900">{fac?.label || g.title}</h3>
                        <p className="text-xs text-slate-400">Departemen {fac?.department}</p>
                      </div>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 transition-transform duration-300 group-hover:scale-105"
                      style={{ background: lvl.bg, color: lvl.color }}
                    >
                      {st?.hasData ? lvl.label : "Belum Ada Data"}
                    </span>
                  </div>
                </div>
              );
            }

            const GroupIcon = g.key === "gbb" ? Boxes : Building2;

            return (
              <div key={g.key} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:border-slate-300 space-y-3">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <GroupIcon size={16} className="text-rose-800" />
                    <h3 className="text-sm font-bold text-slate-800">{g.title}</h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{g.items.length} Sub-Area</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {g.items.map((facKey) => {
                    const fac = FACILITIES.find((f) => f.key === facKey);
                    const st = status?.[facKey];
                    const lvl = levelStyle(st?.hasData ? st.level : null);

                    return (
                      <button
                        key={facKey}
                        onClick={() => handleOpenFacility(facKey)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.015] hover:border-rose-300 hover:bg-rose-50/50 hover:shadow-sm text-left group/btn"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 transition-colors group-hover/btn:text-rose-900">{fac?.label}</p>
                          <p className="text-[10px] text-slate-400">Dept: {fac?.department}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium transition-transform duration-200 group-hover/btn:scale-105"
                            style={{ background: lvl.bg, color: lvl.color }}
                          >
                            {st?.hasData ? lvl.label : "Belum Ada Data"}
                          </span>
                          <ChevronRight size={14} className="text-slate-300 transition-transform duration-200 group-hover/btn:translate-x-1 group-hover/btn:text-rose-800" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   8. HEADER BAR DENGAN PUSAT NOTIFIKASI REAL-TIME
   ========================================================================= */
function HeaderBar({
  session,
  onLoginClick,
  onLogout,
  onProfileClick,
  month,
  setMonth,
  onToggleSidebar,
  notifications = [],
  onSelectNotification,
}) {
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const avatarLetter = (session?.nama || session?.username || "U").charAt(0).toUpperCase();

  const criticalCount = notifications.filter((n) => n.type === "critical").length;

  return (
    <header className="no-print sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 lg:px-8">
      <div className="h-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Menu size={18} />
          </button>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-slate-800">PT. Rama Emerald Multi Sukses</p>
            <p className="text-[10px] text-slate-400">Quality Assurance Department</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-2xs">
            <Calendar size={13} className="text-rose-800" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent border-none outline-none font-semibold text-xs text-slate-800 [color-scheme:light]"
            />
          </label>

          {session && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifPopover(!showNotifPopover)}
                className="relative p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title="Pusat Notifikasi & Alarm Integritas Data"
              >
                <Bell size={16} />
                {notifications.length > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[9px] font-extrabold text-white animate-pulse shadow-sm ${
                      criticalCount > 0 ? "bg-red-600" : "bg-amber-500"
                    }`}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifPopover && (
                <>
                  <div
                    onClick={() => setShowNotifPopover(false)}
                    className="fixed inset-0 z-40 bg-transparent"
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-rose-800" />
                        <h4 className="text-xs font-bold text-slate-800">Pusat Notifikasi &amp; Alert</h4>
                      </div>
                      <span className="text-[10px] font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                        {notifications.length} Item
                      </span>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1 text-xs">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 space-y-1">
                          <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5" />
                          <p className="font-semibold text-slate-700 text-xs">Semua Parameter Terkendali</p>
                          <p className="text-[10px] text-slate-400">Tidak ada deviasi batas limit ataupun tugas evaluasi.</p>
                        </div>
                      ) : (
                        notifications.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              onSelectNotification(item);
                              setShowNotifPopover(false);
                            }}
                            className={`p-3 transition cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                              item.type === "critical"
                                ? "bg-red-50/40"
                                : item.type === "qa_global"
                                ? "bg-blue-50/40"
                                : "bg-amber-50/30"
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              {item.type === "critical" ? (
                                <AlertOctagon size={16} className="text-red-600" />
                              ) : item.type === "qa_global" ? (
                                <FileText size={16} className="text-blue-600" />
                              ) : (
                                <Clock size={16} className="text-amber-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <p className="font-bold text-slate-800 text-[11px] truncate">{item.title}</p>
                                <span className="text-[9px] text-slate-400 whitespace-nowrap">{item.time || "Hari Ini"}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">{item.desc}</p>
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[9px] font-semibold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.2 rounded-md">
                                  {item.facilityLabel}
                                </span>
                                {item.tag && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                                      item.type === "critical"
                                        ? "bg-red-100 text-red-700"
                                        : item.type === "qa_global"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {item.tag}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {session ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
              >
                <div className="w-6 h-6 rounded-lg bg-rose-900 text-white flex items-center justify-center text-[10px] font-bold">
                  {avatarLetter}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="truncate max-w-[120px]">{session?.nama || session?.username}</p>
                  <p className="text-[9px] text-slate-400 font-normal">{session?.role || "User"}</p>
                </div>
              </button>
              <button
                onClick={onLogout}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition"
                title="Keluar"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-900 hover:bg-rose-950 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition"
            >
              <LogIn size={14} /> Masuk
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   9. HALAMAN DETAIL PUSAT NOTIFIKASI DI SIDEBAR
   ========================================================================= */
function NotificationsPage({ notifications = [], onSelectNotification, setView }) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setView({ page: "dashboard" })}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition"
        >
          <ChevronLeft size={16} /> Kembali ke Dashboard
        </button>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-800 flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Pusat Notifikasi &amp; Alert CPOB</h2>
              <p className="text-xs text-slate-400">Daftar pemantauan deviasi limit, respon QA, dan alur persetujuan</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {notifications.length} Notifikasi Aktif
          </span>
        </div>

        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
            <p className="font-bold text-slate-700 text-sm">Seluruh Fasilitas Berada Dalam Kondisi Terkendali</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tidak ada parameter yang mencapai batas Action Limit/TMS, dan tidak ada tugas evaluasi pengkajian tertunda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectNotification(item)}
                className={`p-4 transition cursor-pointer hover:bg-slate-50 flex items-start justify-between gap-4 rounded-2xl ${
                  item.type === "critical"
                    ? "bg-red-50/40 border border-red-100 my-1.5"
                    : item.type === "qa_global"
                    ? "bg-blue-50/40 border border-blue-100 my-1.5"
                    : "bg-amber-50/30 border border-amber-100 my-1.5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.type === "critical" ? (
                      <AlertOctagon size={20} className="text-red-600" />
                    ) : item.type === "qa_global" ? (
                      <FileText size={20} className="text-blue-600" />
                    ) : (
                      <Clock size={20} className="text-amber-600" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 text-xs">{item.title}</p>
                      {item.tag && (
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                            item.type === "critical"
                              ? "bg-red-100 text-red-700"
                              : item.type === "qa_global"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{item.desc}</p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      Fasilitas: <span className="text-slate-700">{item.facilityLabel}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col justify-between items-end">
                  <span className="text-[10px] text-slate-400">{item.time || "Hari Ini"}</span>
                  <span className="text-xs text-rose-800 font-bold hover:underline inline-flex items-center gap-0.5 mt-2">
                    Buka Detail <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   10. MODAL PROFIL & GANTI PASSWORD & LOGIN
   ========================================================================= */
function ProfileModal({ session, onClose, onChangePasswordClick }) {
  if (!session) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center gap-3 border-b pb-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-800 flex items-center justify-center font-bold">
            <User size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Profil Pengguna</h3>
            <p className="text-[11px] text-slate-400">Informasi akun aktif</p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-400">Username</span>
            <span className="font-bold text-slate-800">{session?.username || "—"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-400">Nama Lengkap</span>
            <span className="font-bold text-slate-800">{session?.nama || "—"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-400">Role / Jabatan</span>
            <span className="font-bold text-slate-800">{session?.role || "—"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-400">Departemen</span>
            <span className="font-bold text-slate-800">{session?.departemen || "—"}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onChangePasswordClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-900 hover:bg-rose-950 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs"
          >
            <KeyRound size={13} /> Ganti Password
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ session, onClose }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "changePassword",
          token: session?.token,
          oldPassword,
          newPassword,
        }),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: true }));

      if (res && res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || "Gagal mengganti password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <KeyRound size={18} className="text-rose-800" />
          <h3 className="text-sm font-bold text-slate-800">Ganti Password</h3>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-50 text-emerald-700 text-xs rounded-2xl font-semibold text-center border border-emerald-200">
            ✓ Password berhasil diperbarui!
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Password Lama</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Konfirmasi Password Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-700 focus:outline-none"
              />
            </div>

            {error && <p className="p-2 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !oldPassword || !newPassword || !confirmPassword}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-900 hover:bg-rose-950 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : null} Simpan
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={18} className="text-rose-700" />
          <h3 className="text-base font-bold text-slate-800">Login EM Non Viable</h3>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Username</label>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-rose-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-rose-700 focus:outline-none"
            />
          </div>
          {error && <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-950 disabled:opacity-60 shadow-sm"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : null} Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   11. HALAMAN FASILITAS INTEGRATED
   ========================================================================= */
function FacilityIntegratedPage({ session, facilityKey, month, setMonth, setView, initialDate }) {
  const cfg = FACILITIES.find((f) => f.key === facilityKey) || FACILITIES[0];
  const canInput = hasFacilityAccess(session, "Staff", cfg);
  const canApproveSPV = hasFacilityAccess(session, "Supervisor", cfg);
  const canApproveOPR = canInput || canApproveSPV;
  
  const canDraftQA = hasAccess(session, "Supervisor", "QA");
  const canFinalQA = hasAccess(session, "Manager", "QA");

  const [selectedDate, setSelectedDate] = useState(initialDate || todayStr());
  const [rooms, setRooms] = useState([]);
  const [monthEntries, setMonthEntries] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRow, setBusyRow] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [lastSavedTime, setLastSavedTime] = useState("");

  const [activeRoomNames, setActiveRoomNames] = useState([]);
  const [gridValues, setGridValues] = useState({});

  const [pendahuluan, setPendahuluan] = useState("");
  const [kesimpulanUmum, setKesimpulanUmum] = useState("");
  const [perParameter, setPerParameter] = useState({ suhu: "", rh: "", dpg: "" });
  const narasiRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  /* Modal Denah State */
  const [showDenahModal, setShowDenahModal] = useState(false);
  const [denahScale, setDenahScale] = useState(1);
  const [denahPosition, setDenahPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const denahSrc = DENAH_MAP[facilityKey] || null;

  const handleResetZoom = () => {
    setDenahScale(1);
    setDenahPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setDenahScale((prev) => Math.min(prev + 0.3, 5));
  const handleZoomOut = () => setDenahScale((prev) => Math.max(prev - 0.3, 0.6));

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - denahPosition.x, y: e.clientY - denahPosition.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setDenahPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setDenahScale((prev) => Math.min(prev + 0.2, 5));
    } else {
      setDenahScale((prev) => Math.max(prev - 0.2, 0.6));
    }
  };

  const [narrativeMemory, setNarrativeMemory] = useState({});
  const currentMemKey = `${facilityKey}_${selectedDate}`;

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleAutoResize = (e) => {
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  useEffect(() => {
    const textareas = narasiRef.current ? narasiRef.current.querySelectorAll("textarea") : [];
    textareas.forEach((el) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [pendahuluan, kesimpulanUmum, perParameter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [roomRes, entryRes] = await Promise.all([
        fetchMaster(facilityKey),
        fetchEntries(facilityKey, month),
      ]);
      const roomList = Array.isArray(roomRes) ? roomRes : roomRes?.rooms || [];
      const entryList = Array.isArray(entryRes) ? entryRes : entryRes?.entries || [];

      setRooms(roomList);
      setMonthEntries(entryList);

      let reportRes = await fetchReport(facilityKey, selectedDate, session?.token, "").catch(() => null);
      if (!reportRes?.narrative?.pendahuluan && !reportRes?.narrative?.kesimpulanUmum) {
        reportRes = await fetchReport(facilityKey, month, session?.token, selectedDate).catch(() => null);
      }

      if (reportRes?.narrative?.pendahuluan || reportRes?.narrative?.kesimpulanUmum) {
        setReport(reportRes);
        setPendahuluan(reportRes.narrative.pendahuluan || "");
        setKesimpulanUmum(reportRes.narrative.kesimpulanUmum || "");
        setPerParameter(reportRes.narrative.perParameter || { suhu: "", rh: "", dpg: "" });
      } else if (narrativeMemory[currentMemKey]) {
        const mem = narrativeMemory[currentMemKey];
        setPendahuluan(mem.pendahuluan || "");
        setKesimpulanUmum(mem.kesimpulanUmum || "");
        setPerParameter(mem.perParameter || { suhu: "", rh: "", dpg: "" });
      } else {
        setReport(null);
        setPendahuluan("");
        setKesimpulanUmum("");
        setPerParameter({ suhu: "", rh: "", dpg: "" });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityKey, month, selectedDate, session?.token, currentMemKey, narrativeMemory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!rooms || rooms.length === 0) return;

    const existingRoomsToday = Array.from(
      new Set((monthEntries || []).filter((e) => e?.tanggal === selectedDate).map((e) => e?.roomName))
    ).filter(Boolean);

    setActiveRoomNames(existingRoomsToday);

    const initialGrid = {};
    rooms.forEach((r) => {
      if (!r?.name) return;
      initialGrid[r.name] = {
        "08:00": { suhu: "", rh: "", dpg: "", opr: "", spv: "" },
        "13:00": { suhu: "", rh: "", dpg: "", opr: "", spv: "" },
      };
      SESI.forEach((jam) => {
        PARAM_DEFS.forEach((p) => {
          if (!r.required?.[p.key]) initialGrid[r.name][jam][p.key] = "-";
        });
      });
    });

    (monthEntries || []).filter((e) => e?.tanggal === selectedDate).forEach((e) => {
      if (initialGrid[e.roomName] && initialGrid[e.roomName][e.jam]) {
        const rObj = rooms.find((r) => r.name === e.roomName);
        initialGrid[e.roomName][e.jam] = {
          suhu: e.suhu ?? (rObj?.required?.suhu ? "" : "-"),
          rh: e.rh ?? (rObj?.required?.rh ? "" : "-"),
          dpg: e.dpg ?? (rObj?.required?.dpg ? "" : "-"),
          opr: e.opr || "",
          spv: e.spv || "",
        };
      }
    });

    setGridValues(initialGrid);
  }, [selectedDate, monthEntries, rooms]);

  function handleAddRoom(roomName) {
    if (!roomName || activeRoomNames.includes(roomName)) return;
    setActiveRoomNames((prev) => [roomName, ...prev]);
  }

  function handleRemoveActiveRoom(roomName) {
    setActiveRoomNames((prev) => prev.filter((name) => name !== roomName));
  }

  function handleCellChange(roomName, jam, field, val) {
    const normalized = field === "suhu" || field === "rh" || field === "dpg" ? val.replace(/\./g, ",") : val;
    setGridValues((prev) => ({
      ...prev,
      [roomName]: {
        ...prev[roomName],
        [jam]: {
          ...prev[roomName][jam],
          [field]: normalized,
        },
      },
    }));
  }

  function buildTodayPayload() {
    const todayRows = [];
    activeRoomNames.forEach((rName) => {
      const rObj = (rooms || []).find((r) => r?.name === rName);
      SESI.forEach((jam) => {
        const v = gridValues[rName]?.[jam] || {};
        const anyFilled = PARAM_DEFS.some((p) => v[p.key] && v[p.key] !== "-");
        if (anyFilled) {
          const sVal = !rObj?.required?.suhu ? v.suhu || "-" : v.suhu;
          const rVal = !rObj?.required?.rh ? v.rh || "-" : v.rh;
          const dVal = !rObj?.required?.dpg ? v.dpg || "-" : v.dpg;

          todayRows.push({
            id: `${rName}|${selectedDate}|${jam}`,
            tanggal: selectedDate,
            jam,
            roomName: rName,
            persyaratanKey: rObj?.persyaratanKey || "",
            suhu: sVal === "" ? null : sVal,
            rh: rVal === "" ? null : rVal,
            dpg: dVal === "" ? null : dVal,
            opr: v.opr || "",
            spv: v.spv || "",
          });
        }
      });
    });
    return todayRows;
  }

  async function handleSaveDataOnly() {
    setSaving(true);
    setError("");
    try {
      const todayRows = buildTodayPayload();
      const otherRows = (monthEntries || []).filter((e) => e?.tanggal !== selectedDate);
      await apiSaveEntries(facilityKey, month, otherRows.concat(todayRows), session?.token);
      await loadData();
      showToast("Data pengukuran harian berhasil disimpan.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveOprBatch() {
    setSaving(true);
    setError("");
    try {
      const todayRows = buildTodayPayload();
      if (todayRows.length === 0) throw new Error("Belum ada nilai yang diisi pada tanggal ini.");

      const otherRows = (monthEntries || []).filter((e) => e?.tanggal !== selectedDate);
      await apiSaveEntries(facilityKey, month, otherRows.concat(todayRows), session?.token);

      const uniqueRooms = Array.from(new Set(todayRows.map((r) => r.roomName)));
      for (const rName of uniqueRooms) {
        await apiApproveOpr(facilityKey, selectedDate, rName, session?.token);
      }
      await loadData();
      showToast("Approval Operator berhasil disimpan.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveSpvBatch() {
    setSaving(true);
    setError("");
    try {
      const todayRows = buildTodayPayload();
      if (todayRows.length === 0) throw new Error("Tidak ada data ruangan untuk di-approve SPV.");

      const otherRows = (monthEntries || []).filter((e) => e?.tanggal !== selectedDate);
      await apiSaveEntries(facilityKey, month, otherRows.concat(todayRows), session?.token);

      const uniqueRooms = Array.from(new Set(todayRows.map((r) => r.roomName)));
      for (const rName of uniqueRooms) {
        const rows = todayRows.filter((r) => r.roomName === rName);
        const oprEmpty = rows.some((r) => !r.opr);
        if (oprEmpty) {
          await apiApproveOpr(facilityKey, selectedDate, rName, session?.token).catch(() => {});
        }
      }

      await apiApproveDay(facilityKey, selectedDate, session?.token);
      await loadData();
      showToast("Approval SPV berhasil, seluruh data tanggal ini terkunci.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveOprSingle(roomName) {
    setBusyRow(roomName + "|opr");
    setError("");
    try {
      const todayRows = buildTodayPayload();
      const otherRows = (monthEntries || []).filter((e) => e?.tanggal !== selectedDate);
      await apiSaveEntries(facilityKey, month, otherRows.concat(todayRows), session?.token);
      await apiApproveOpr(facilityKey, selectedDate, roomName, session?.token);
      await loadData();
      showToast(`Approval Operator ruangan ${roomName} berhasil.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyRow(null);
    }
  }

  async function handleApproveSpvSingle(roomName) {
    setBusyRow(roomName + "|spv");
    setError("");
    try {
      const todayRows = buildTodayPayload();
      const otherRows = (monthEntries || []).filter((e) => e?.tanggal !== selectedDate);
      await apiSaveEntries(facilityKey, month, otherRows.concat(todayRows), session?.token);
      await apiApproveSpv(facilityKey, selectedDate, roomName, session?.token);
      await loadData();
      showToast(`Approval SPV ruangan ${roomName} berhasil.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyRow(null);
    }
  }

  async function handleSaveReport() {
    setError("");
    setSaving(true);
    try {
      const payload = { pendahuluan, kesimpulanUmum, perParameter };

      setNarrativeMemory((prev) => ({
        ...prev,
        [currentMemKey]: payload,
      }));

      await apiSaveReport(
        facilityKey,
        selectedDate,
        payload,
        session?.token,
        ""
      );

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      setLastSavedTime(timeStr);
      showToast(`Narasi evaluasi harian (${selectedDate}) berhasil disimpan!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateAI() {
    setGenerating(true);
    setError("");
    try {
      const todayRows = buildTodayPayload();
      const otherRows = (monthEntries || []).filter((e) => e?.tanggal !== selectedDate);
      const combinedEntries = [...otherRows, ...todayRows];
      const currentDayRooms = (rooms || []).filter((r) => activeRoomNames.includes(r.name));

      if (todayRows.length === 0 && currentDayEntriesMemo.length === 0) {
        showToast("Belum ada data pengukuran yang diisi pada tanggal ini.");
        setGenerating(false);
        return;
      }

      const facilityStats = buildFacilityStats({
        facilityLabel: `${cfg.label} (Harian: ${selectedDate})`,
        monthLabel: fullDateID(selectedDate),
        entries: combinedEntries,
        rooms: currentDayRooms.length > 0 ? currentDayRooms : rooms,
      });

      let narrative;
      try {
        narrative = await generateNarrative({
          facilityLabel: `${cfg.label} (Harian: ${selectedDate})`,
          monthLabel: fullDateID(selectedDate),
          stats: facilityStats?.stats || {},
        });
      } catch (aiErr) {
        narrative = generateLocalNarrative({
          facilityLabel: `${cfg.label} (Harian: ${selectedDate})`,
          monthLabel: fullDateID(selectedDate),
          entries: combinedEntries,
          rooms: currentDayRooms.length > 0 ? currentDayRooms : rooms,
        });
        showToast("Menggunakan draf narasi evaluator lokal.");
      }

      if (narrative) {
        const nextPendahuluan = narrative.pendahuluan || "";
        const nextPerParam = narrative.perParameter || { suhu: "", rh: "", dpg: "" };
        const nextKesimpulan = narrative.kesimpulanUmum || "";

        setPendahuluan(nextPendahuluan);
        setPerParameter(nextPerParam);
        setKesimpulanUmum(nextKesimpulan);

        setNarrativeMemory((prev) => ({
          ...prev,
          [currentMemKey]: {
            pendahuluan: nextPendahuluan,
            perParameter: nextPerParam,
            kesimpulanUmum: nextKesimpulan,
          },
        }));

        showToast("Draf narasi harian berhasil dibuat!");
      }
    } catch (err) {
      setError(err.message || "Gagal membuat narasi AI harian.");
      showToast("Terjadi kendala saat generate narasi AI.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDikaji() {
    try {
      await apiApproveDikaji(facilityKey, selectedDate, session?.token, "");
      await loadData();
      showToast("Status 'Dikaji Oleh' berhasil disetujui!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMengetahui() {
    try {
      await apiApproveMengetahui(facilityKey, selectedDate, session?.token, "");
      await loadData();
      showToast("Status 'Mengetahui' Final berhasil disetujui!");
    } catch (err) {
      setError(err.message);
    }
  }

  const currentDayEntriesMemo = useMemo(() => {
    return (monthEntries || []).filter((e) => e?.tanggal === selectedDate);
  }, [monthEntries, selectedDate]);

  const currentLevel = facilityOverallLevel(monthEntries);
  const isFinalApproved = !!report?.signoff?.diperiksa?.nama;

  const roomStatusToday = useMemo(() => {
    const map = {};
    (rooms || []).forEach((r) => {
      const rows = currentDayEntriesMemo.filter((e) => e?.roomName === r?.name);
      if (rows.length === 0) {
        map[r.name] = "empty";
      } else if (rows.every((e) => !!e.spv)) {
        map[r.name] = "spv";
      } else if (rows.some((e) => !!e.opr)) {
        map[r.name] = "opr";
      } else {
        map[r.name] = "filled";
      }
    });
    return map;
  }, [rooms, currentDayEntriesMemo]);

  const isFacilityFullySpvApproved = useMemo(() => {
    if (!rooms || rooms.length === 0) return false;
    return rooms.every((r) => roomStatusToday[r.name] === "spv");
  }, [rooms, roomStatusToday]);

  const hasUnapprovedRoomsInActive = useMemo(() => {
    return (activeRoomNames || []).some((rName) => roomStatusToday[rName] !== "spv");
  }, [activeRoomNames, roomStatusToday]);

  const unselectedRooms = (rooms || []).filter((r) => !activeRoomNames.includes(r.name));

  const activeDistinctLimits = useMemo(() => {
    const map = {};
    (activeRoomNames || []).forEach((rName) => {
      const rObj = (rooms || []).find((r) => r?.name === rName);
      if (rObj && rObj.persyaratanKey) {
        map[rObj.persyaratanKey] = rObj.limits;
      }
    });
    return map;
  }, [activeRoomNames, rooms]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 bg-zinc-900/95 text-white border border-emerald-500/60 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          onClick={() => setView({ page: "dashboard" })}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
        >
          <ArrowLeft size={14} className="text-rose-900" /> Kembali ke Dashboard
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {denahSrc && (
            <button
              type="button"
              onClick={() => setShowDenahModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 text-indigo-950 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
            >
              <Map size={14} className="text-indigo-700" /> Lihat Denah Ruangan
            </button>
          )}
          {canDraftQA && (
            <button
              onClick={() => setView({ page: "pengkajian", facility: facilityKey, room: "" })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-950 hover:to-black text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition"
            >
              <ClipboardList size={14} className="text-rose-300" /> Pengkajian QA Global
            </button>
          )}
          {rooms && rooms.length > 0 && (
            <button
              onClick={() => setView({ page: "formulir", facility: facilityKey, room: rooms[0]?.name, bulan: month })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 text-rose-950 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
            >
              <FileCheck2 size={14} className="text-rose-800" /> Formulir Bulanan (FM.QA.024/R11)
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold transition shadow-xs"
          >
            <Printer size={14} className="text-slate-300" /> Cetak Harian
          </button>
        </div>
      </div>

      {/* KOP HEADER FASILITAS HARIAN */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 print-card shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-6 py-4">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-600/20 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-start gap-4">
              <img src="/logo-rama.png" alt="Logo" className="h-11 w-11 object-contain brightness-0 invert" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                  PT. Rama Emerald Multi Sukses — QA
                </p>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Data Pemantauan &amp; Evaluasi Harian EM Non Viable
                </h1>
                <p className="text-xs text-rose-100/90 mt-0.5">
                  Fasilitas: <span className="font-semibold text-white">{cfg?.label}</span> · Periode:{" "}
                  <span className="font-semibold text-white">{monthLabelID(month)}</span>
                </p>
              </div>
            </div>
            <p className="text-right text-[11px] text-rose-200 font-mono">FM.QA.024/R11</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-white px-6 py-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400">Status Fasilitas:</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-bold"
            style={{ background: levelStyle(currentLevel).bg, color: levelStyle(currentLevel).color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: levelStyle(currentLevel).dot }} />
            {levelStyle(currentLevel).label}
          </span>
        </div>
      </div>

      {error && <p className="p-3.5 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-200">{error}</p>}

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4 print-card avoid-break">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-700">Tanggal:</label>
              <input
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-700 bg-slate-50"
              />
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="text-xs bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl font-medium text-slate-600 no-print transition"
              >
                Hari Ini
              </button>
            </div>

            {canInput && unselectedRooms.length > 0 && (
              <div className="flex items-center gap-2 no-print">
                <select
                  value=""
                  onChange={(e) => handleAddRoom(e.target.value)}
                  className="border border-rose-300 bg-rose-50/50 hover:bg-rose-50 rounded-xl px-3 py-1.5 text-xs text-rose-950 font-semibold outline-none transition"
                >
                  <option value="">+ Tambah Ruangan...</option>
                  {unselectedRooms.map((r) => {
                    const st = roomStatusToday[r.name];
                    const labelSuffix =
                      st === "spv" ? " ✓ disetujui" : st === "opr" ? " • diapprove OPR" : st === "filled" ? " • terisi" : "";
                    return (
                      <option key={r.code + r.name} value={r.name}>
                        {r.code} — {r.name} ({r.persyaratanKey || "—"}){labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {isFacilityFullySpvApproved && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-800 font-semibold px-2.5 py-1 rounded-xl border border-rose-200">
                <Lock size={12} /> Seluruh Ruangan Terkunci (Disetujui SPV)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {canInput && hasUnapprovedRoomsInActive && (
              <>
                <button
                  onClick={handleSaveDataOnly}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Draf
                </button>
                {canApproveOPR && (
                  <button
                    onClick={handleApproveOprBatch}
                    disabled={saving || activeRoomNames.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition"
                  >
                    <CheckCheck size={14} /> Approve OPR (Semua)
                  </button>
                )}
              </>
            )}
            {canApproveSPV && hasUnapprovedRoomsInActive && (
              <button
                onClick={handleApproveSpvBatch}
                disabled={saving || activeRoomNames.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-rose-900 hover:bg-rose-950 text-white shadow-sm disabled:opacity-50 transition"
              >
                <FileCheck2 size={14} /> Approve SPV &amp; Kunci (Semua)
              </button>
            )}
          </div>
        </div>

        {activeRoomNames.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-1.5">
            <p className="font-bold text-slate-700">Belum ada ruangan yang dipilih pada tanggal {selectedDate}.</p>
            <p className="text-slate-400">
              Silakan klik dropdown <b>"+ Tambah Ruangan..."</b> di atas untuk mulai mengisi data ruangan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs print:table-fixed">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b">
                  <th className="px-3 py-2 text-left min-w-[170px] print:w-40">RUANGAN</th>
                  <th className="px-2 py-2 text-center w-28">PERSYARATAN</th>
                  <th className="px-2 py-2 text-center w-14">JAM</th>
                  <th className="px-2 py-2 text-center w-20">SUHU (°C)</th>
                  <th className="px-2 py-2 text-center w-20">RH (%)</th>
                  <th className="px-2 py-2 text-center w-20">DPG (Pa)</th>
                  <th className="px-2 py-2 text-center w-28">OPR (TTD)</th>
                  <th className="px-2 py-2.5 text-center w-28">SPV (TTD)</th>
                  <th className="px-2 py-2.5 text-center w-10 no-print">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRoomNames.map((rName) => {
                  const rObj = (rooms || []).find((r) => r?.name === rName);
                  if (!rObj) return null;
                  const st = roomStatusToday[rName];
                  const labelSuffix =
                    st === "spv" ? "✓ Disetujui SPV" : st === "opr" ? "• Diapprove OPR" : st === "filled" ? "• Terisi" : "";

                  const isLocked = st === "spv";

                  return SESI.map((jam, jamIdx) => {
                    const v = gridValues[rName]?.[jam] || {};
                    const sLvl = liveLevelFor(v.suhu, rObj.limits?.suhu, "suhu");
                    const rLvl = liveLevelFor(v.rh, rObj.limits?.rh, "rh");
                    const dLvl = liveLevelFor(v.dpg, rObj.limits?.dpg, "dpg");

                    return (
                      <tr key={rObj.code + jam} className={jamIdx === 0 ? "border-t border-slate-200" : "bg-slate-50/30"}>
                        {jamIdx === 0 ? (
                          <>
                            <td rowSpan={2} className="px-3 py-1.5 align-middle border-r border-slate-100">
                              <div className="font-bold text-slate-800 text-xs">
                                {rObj.code} — {rObj.name}
                              </div>
                              {labelSuffix && (
                                <span
                                  className={`inline-block mt-0.5 text-[9px] font-medium px-2 py-0.2 rounded-full ${
                                    st === "spv"
                                      ? "bg-rose-50 text-rose-800"
                                      : st === "opr"
                                      ? "bg-emerald-50 text-emerald-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {labelSuffix}
                                </span>
                              )}
                            </td>
                            <td rowSpan={2} className="px-2 py-1.5 text-center align-middle border-r border-slate-100">
                              <span className="inline-block bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg text-[10px] border border-slate-200">
                                {rObj.persyaratanKey || "—"}
                              </span>
                            </td>
                          </>
                        ) : null}
                        <td className="px-2 py-1.5 text-center font-medium text-slate-500">{jam}</td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            value={v.suhu ?? ""}
                            onChange={(e) => handleCellChange(rName, jam, "suhu", e.target.value)}
                            placeholder=""
                            disabled={isLocked || !canInput}
                            className="w-14 text-center border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-700 disabled:bg-slate-50 font-medium text-xs shadow-2xs"
                            style={{
                              background: v.suhu && v.suhu !== "-" ? levelStyle(sLvl).bg : undefined,
                              color: v.suhu && v.suhu !== "-" ? levelStyle(sLvl).color : undefined,
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            value={v.rh ?? ""}
                            onChange={(e) => handleCellChange(rName, jam, "rh", e.target.value)}
                            placeholder={rObj.required?.rh ? "" : "N/A"}
                            disabled={isLocked || !rObj.required?.rh || !canInput}
                            className="w-14 text-center border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-700 disabled:bg-slate-50 font-medium text-xs shadow-2xs"
                            style={{
                              background: v.rh && v.rh !== "-" ? levelStyle(rLvl).bg : undefined,
                              color: v.rh && v.rh !== "-" ? levelStyle(rLvl).color : undefined,
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            value={v.dpg ?? ""}
                            onChange={(e) => handleCellChange(rName, jam, "dpg", e.target.value)}
                            placeholder={rObj.required?.dpg ? "" : "N/A"}
                            disabled={isLocked || !rObj.required?.dpg || !canInput}
                            className="w-14 text-center border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-700 disabled:bg-slate-50 font-medium text-xs shadow-2xs"
                            style={{
                              background: v.dpg && v.dpg !== "-" ? levelStyle(dLvl).bg : undefined,
                              color: v.dpg && v.dpg !== "-" ? levelStyle(dLvl).color : undefined,
                            }}
                          />
                        </td>

                        <td className="px-2 py-1.5 text-center text-slate-600">
                          {v.opr ? (
                            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded-lg border border-emerald-200">
                              <span className="font-medium text-[9.5px] truncate max-w-[60px]">{v.opr}</span>
                              <VerifyQR
                                type="harian"
                                facility={facilityKey}
                                period={selectedDate}
                                roomName={rName}
                                jam={jam}
                                signerRole="OPR"
                                signerName={v.opr}
                                size={30}
                              />
                            </div>
                          ) : canApproveOPR && !isLocked ? (
                            <button
                              onClick={() => handleApproveOprSingle(rName)}
                              disabled={busyRow === rName + "|opr"}
                              className="no-print inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 transition"
                            >
                              {busyRow === rName + "|opr" ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={10} />
                              )}
                              Approve
                            </button>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-2 py-1.5 text-center text-slate-600">
                          {v.spv ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-900 px-1.5 py-0.5 rounded-lg border border-rose-200">
                              <span className="font-medium text-[9.5px] truncate max-w-[60px]">{v.spv}</span>
                              <VerifyQR
                                type="harian"
                                facility={facilityKey}
                                period={selectedDate}
                                roomName={rName}
                                jam={jam}
                                signerRole="SPV"
                                signerName={v.spv}
                                size={30}
                              />
                            </div>
                          ) : canApproveSPV && !isLocked ? (
                            <button
                              onClick={() => handleApproveSpvSingle(rName)}
                              disabled={busyRow === rName + "|spv"}
                              className="no-print inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-rose-900 hover:bg-rose-950 text-white shadow-xs disabled:opacity-50 transition"
                            >
                              {busyRow === rName + "|spv" ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <FileCheck2 size={10} />
                              )}
                              Approve
                            </button>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>

                        {jamIdx === 0 ? (
                          <td rowSpan={2} className="px-2 py-1.5 text-center align-middle no-print">
                            {!isLocked && (
                              <button
                                onClick={() => handleRemoveActiveRoom(rName)}
                                className="text-slate-400 hover:text-red-600 p-1 transition"
                                title="Hapus baris ini"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: CARD PERSYARATAN & LIMIT */}
      {Object.keys(activeDistinctLimits).length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-2.5 print-card avoid-break">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Persyaratan &amp; Batas Limit (Jenis Limit Terpakai)
          </h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b">
                  <th className="px-3 py-1">KODE / PERSYARATAN</th>
                  <th className="px-3 py-1">PARAMETER</th>
                  <th className="px-3 py-1">SYARAT</th>
                  <th className="px-3 py-1">ALERT LIMIT</th>
                  <th className="px-3 py-1">ACTION LIMIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(activeDistinctLimits).map(([pKey, limits]) => {
                  return PARAM_DEFS.map((p) => {
                    const lim = limits?.[p.key];
                    if (!lim) return null;
                    const allNull = [
                      lim.syaratL,
                      lim.syaratU,
                      lim.alertL,
                      lim.alertU,
                      lim.actionL,
                      lim.actionU,
                    ].every((x) => toNumberSafe(x) === null);
                    if (allNull) return null;
                    const isDpg = p.key === "dpg";

                    return (
                      <tr key={pKey + p.key}>
                        <td className="px-3 py-1 font-bold text-slate-800">{pKey}</td>
                        <td className="px-3 py-1 font-semibold text-slate-700">{p.label}</td>
                        <td className="px-3 py-1 text-slate-800">
                          {formatRange(lim.syaratL, lim.syaratU, p.unit, isDpg)}
                        </td>
                        <td className="px-3 py-1 text-amber-700">
                          {formatRange(lim.alertL, lim.alertU, p.unit, isDpg)}
                        </td>
                        <td className="px-3 py-1 text-orange-700">
                          {formatRange(lim.actionL, lim.actionU, p.unit, isDpg)}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Terkendali
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Alert
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Action
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Melebihi Syarat
            </span>
          </div>
        </div>
      )}

      {/* SECTION 3: GRAFIK CROSS-SECTIONAL */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Grafik Perbandingan Ruangan Terisi ({selectedDate})
        </h2>
        <div className="space-y-2.5">
          <DayParamChart
            activeRoomNames={activeRoomNames}
            rooms={rooms}
            currentDayEntries={currentDayEntriesMemo}
            paramKey="suhu"
            paramLabel="Suhu"
            unit="°C"
          />
          <DayParamChart
            activeRoomNames={activeRoomNames}
            rooms={rooms}
            currentDayEntries={currentDayEntriesMemo}
            paramKey="rh"
            paramLabel="Kelembaban Relatif (RH)"
            unit="%"
          />
          <DayParamChart
            activeRoomNames={activeRoomNames}
            rooms={rooms}
            currentDayEntries={currentDayEntriesMemo}
            paramKey="dpg"
            paramLabel="Perbedaan Tekanan (DPG)"
            unit="Pa"
          />
        </div>
      </div>

      {/* SECTION 4: PEMBAHASAN & NARASI */}
      <div ref={narasiRef} className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-3.5 print-card avoid-break">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2.5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Pembahasan &amp; Narasi Evaluasi Harian ({selectedDate})
            </h2>
            <p className="text-[10.5px] text-slate-400">
              Catatan pemantauan operasional tanggal {selectedDate} mengacu pada Protap POS.QA.025
            </p>
          </div>
          {canDraftQA && !isFinalApproved && (
            <div className="flex flex-wrap items-center gap-2 no-print">
              {lastSavedTime && (
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                  ✓ Tersimpan {lastSavedTime}
                </span>
              )}
              <button
                onClick={handleGenerateAI}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-900 hover:bg-rose-950 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60 transition"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate AI
              </button>
              <button
                onClick={handleSaveReport}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Draf
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs avoid-break">
          <div className="bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-3.5 py-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <FileSpreadsheet size={13} className="text-rose-400" /> Pendahuluan
            </span>
          </div>
          <div className="p-2.5 bg-white">
            <textarea
              value={pendahuluan}
              onChange={(e) => {
                setPendahuluan(e.target.value);
                handleAutoResize(e);
              }}
              onFocus={handleAutoResize}
              disabled={!canDraftQA || isFinalApproved}
              rows={2}
              style={{ minHeight: "55px", overflow: "hidden" }}
              className="no-print w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-rose-700 disabled:bg-slate-50 leading-relaxed resize-none"
            />
            <p className="only-print text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{pendahuluan || "-"}</p>
          </div>
        </div>

        {PARAM_DEFS.map((p) => {
          const PIcon = p.icon || Sparkles;
          return (
            <div key={p.key} className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs avoid-break">
              <div className="bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-3.5 py-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <PIcon size={13} className="text-rose-400" /> {p.label} ({p.unit})
                </span>
                <span className="text-[9.5px] text-rose-200 font-mono">Hasil, Tren &amp; Kesimpulan</span>
              </div>
              <div className="p-2.5 bg-white">
                <textarea
                  value={perParameter[p.key] || ""}
                  onChange={(e) => {
                    setPerParameter({ ...perParameter, [p.key]: e.target.value });
                    handleAutoResize(e);
                  }}
                  onFocus={handleAutoResize}
                  disabled={!canDraftQA || isFinalApproved}
                  rows={2}
                  style={{ minHeight: "60px", overflow: "hidden" }}
                  placeholder={`Tulis ulasan hasil, tren, dan kesimpulan untuk parameter ${p.label}...`}
                  className="no-print w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-rose-700 disabled:bg-slate-50 leading-relaxed resize-none"
                />
                <p className="only-print text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {perParameter[p.key] || "-"}
                </p>
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs avoid-break">
          <div className="bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-3.5 py-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <CheckCircle2 size={13} /> Kesimpulan Umum
            </span>
          </div>
          <div className="p-2.5 bg-white">
            <textarea
              value={kesimpulanUmum}
              onChange={(e) => {
                setKesimpulanUmum(e.target.value);
                handleAutoResize(e);
              }}
              onFocus={handleAutoResize}
              disabled={!canDraftQA || isFinalApproved}
              rows={2}
              style={{ minHeight: "55px", overflow: "hidden" }}
              className="no-print w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-rose-700 disabled:bg-slate-50 leading-relaxed resize-none"
            />
            <p className="only-print text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {kesimpulanUmum || "-"}
            </p>
          </div>
        </div>

        <div className="pt-2.5 border-t grid grid-cols-1 sm:grid-cols-2 gap-3 avoid-break">
          <div className="border rounded-2xl p-3.5 bg-slate-50/50 text-center flex flex-col justify-between min-h-[125px]">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">
              Dikaji Oleh (Supervisor QA)
            </p>
            {report?.signoff?.dinilai?.nama ? (
              <div className="space-y-0.5 my-auto">
                <div className="flex justify-center">
                  <VerifyQR
                    type="pengkajian"
                    facility={facilityKey}
                    period={selectedDate}
                    roomName=""
                    signerRole="Dikaji Oleh"
                    signerName={report.signoff.dinilai.nama}
                    size={42}
                  />
                </div>
                <p className="text-xs font-bold text-slate-800">{report.signoff.dinilai.nama}</p>
                <p className="text-[9px] text-slate-400">{report.signoff.dinilai.tanggal}</p>
              </div>
            ) : (
              <div className="my-auto space-y-2">
                <p className="text-xs italic text-slate-400">Belum disetujui</p>
                {canDraftQA && (
                  <button
                    onClick={handleDikaji}
                    className="no-print px-4 py-1.5 bg-rose-900 hover:bg-rose-950 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Approve "Dikaji Oleh"
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border rounded-2xl p-3.5 bg-slate-50/50 text-center flex flex-col justify-between min-h-[125px]">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">
              Mengetahui (Manager QA)
            </p>
            {report?.signoff?.diperiksa?.nama ? (
              <div className="space-y-0.5 my-auto">
                <div className="flex justify-center">
                  <VerifyQR
                    type="pengkajian"
                    facility={facilityKey}
                    period={selectedDate}
                    roomName=""
                    signerRole="Mengetahui"
                    signerName={report.signoff.diperiksa.nama}
                    size={42}
                  />
                </div>
                <p className="text-xs font-bold text-slate-800">{report.signoff.diperiksa.nama}</p>
                <p className="text-[9px] text-slate-400">{report.signoff.diperiksa.tanggal}</p>
              </div>
            ) : (
              <div className="my-auto space-y-2">
                <p className="text-xs italic text-slate-400">
                  {report?.signoff?.dinilai?.nama
                    ? "Menunggu approval Manager QA"
                    : "Menunggu approval 'Dikaji Oleh' terlebih dahulu"}
                </p>
                {canFinalQA && report?.signoff?.dinilai?.nama && (
                  <button
                    onClick={handleMengetahui}
                    className="no-print px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Approve Final "Mengetahui"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDenahModal && denahSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in no-print">
          <div className="relative max-w-6xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Map size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Denah Tata Letak Ruangan — {cfg?.label}</h3>
                  <p className="text-[11px] text-slate-500">Gunakan scroll/drag untuk zoom hingga 500% dan menggeser denah</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-200/80 rounded-xl p-0.5 text-xs font-semibold text-slate-700">
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 hover:bg-white rounded-lg transition"
                    title="Zoom Out"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span className="px-2 text-[11px] select-none">{Math.round(denahScale * 100)}%</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 hover:bg-white rounded-lg transition"
                    title="Zoom In"
                  >
                    <ZoomIn size={15} />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-1.5 hover:bg-white rounded-lg transition border-l border-slate-300 ml-0.5 text-[10px]"
                    title="Reset Ukuran"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowDenahModal(false);
                    handleResetZoom();
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              className={`flex-1 overflow-hidden p-4 flex items-center justify-center bg-zinc-900/5 select-none relative ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <div
                style={{
                  transform: `translate(${denahPosition.x}px, ${denahPosition.y}px) scale(${denahScale})`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out",
                }}
                className="max-w-full max-h-full flex items-center justify-center origin-center pointer-events-none"
              >
                <img
                  src={denahSrc}
                  alt={`Denah Ruangan ${cfg?.label}`}
                  className="max-w-none w-auto h-auto max-h-[70vh] rounded-xl shadow-md border border-slate-200 bg-white"
                  draggable={false}
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
              <span className="text-[11px] text-slate-400">💡 Klik dan tahan mouse untuk menggeser denah</span>
              <button
                onClick={() => {
                  setShowDenahModal(false);
                  handleResetZoom();
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                Tutup Denah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   12. HALAMAN PENGKAJIAN QA RESMI (PENGKAJIAN GLOBAL & RUANGAN)
   ========================================================================= */
function PengkajianPage({ session, month, setView, initialFacility, initialRoom }) {
  const [facilityKey, setFacilityKey] = useState(initialFacility || FACILITIES[0].key);
  const [selectedRoomName, setSelectedRoomName] = useState(initialRoom || "");
  const [report, setReport] = useState(null);
  const [pendahuluan, setPendahuluan] = useState("");
  const [kesimpulanUmum, setKesimpulanUmum] = useState("");
  const [perParameter, setPerParameter] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [lastSavedTime, setLastSavedTime] = useState("");
  const [generating, setGenerating] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [monthEntries, setMonthEntries] = useState([]);

  const cfg = FACILITIES.find((f) => f.key === facilityKey) || FACILITIES[0];
  const canDraftQA = hasAccess(session, "Supervisor", "QA");
  const canFinalQA = hasAccess(session, "Manager", "QA");
  const narasiRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleAutoResize = (e) => {
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  useEffect(() => {
    const textareas = narasiRef.current ? narasiRef.current.querySelectorAll("textarea") : [];
    textareas.forEach((el) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [pendahuluan, kesimpulanUmum, perParameter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, roomRes, entryRes] = await Promise.all([
        fetchReport(facilityKey, month, session?.token, selectedRoomName),
        fetchMaster(facilityKey),
        fetchEntries(facilityKey, month),
      ]);
      const roomList = Array.isArray(roomRes) ? roomRes : roomRes?.rooms || [];
      const allEntries = Array.isArray(entryRes) ? entryRes : entryRes?.entries || [];

      setReport(r);
      if (r?.narrative) {
        setPendahuluan(r.narrative.pendahuluan || "");
        setKesimpulanUmum(r.narrative.kesimpulanUmum || "");
        setPerParameter(r.narrative.perParameter || {});
      } else {
        setPendahuluan("");
        setKesimpulanUmum("");
        setPerParameter({});
      }
      setRooms(roomList);
      setMonthEntries(
        selectedRoomName
          ? (allEntries || []).filter((e) => e?.roomName === selectedRoomName)
          : allEntries || []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityKey, month, session?.token, selectedRoomName]);

  useEffect(() => {
    load();
  }, [load]);

  const isFinal = !!report?.signoff?.diperiksa?.nama;

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      await apiSaveReport(
        facilityKey,
        month,
        { pendahuluan, kesimpulanUmum, perParameter },
        session?.token,
        selectedRoomName
      );
      await load();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      setLastSavedTime(timeStr);
      showToast(
        selectedRoomName
          ? `Narasi Pengkajian Ruangan (${selectedRoomName}) berhasil disimpan!`
          : `Narasi Pengkajian Global Fasilitas (${cfg?.label}) berhasil disimpan!`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDikaji() {
    setError("");
    try {
      await apiApproveDikaji(facilityKey, month, session?.token, selectedRoomName);
      await load();
      showToast("Status 'Dikaji Oleh' berhasil disetujui!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMengetahui() {
    setError("");
    try {
      await apiApproveMengetahui(facilityKey, month, session?.token, selectedRoomName);
      await load();
      showToast("Status 'Mengetahui' Final berhasil disetujui!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateAI() {
    setGenerating(true);
    setError("");
    try {
      const targetLabel = cfg.label + (selectedRoomName ? ` — ${selectedRoomName}` : "");
      const facilityStats = buildFacilityStats({
        facilityLabel: targetLabel,
        monthLabel: monthLabelID(month),
        entries: monthEntries,
        rooms,
      });
      let narrative;
      try {
        narrative = await generateNarrative({
          facilityLabel: targetLabel,
          monthLabel: monthLabelID(month),
          stats: facilityStats.stats,
        });
      } catch (aiErr) {
        narrative = generateLocalNarrative({
          facilityLabel: targetLabel,
          monthLabel: monthLabelID(month),
          entries: monthEntries,
          rooms,
        });
        showToast("Menggunakan draf evaluator lokal.");
      }
      setPendahuluan(narrative.pendahuluan || "");
      setPerParameter(narrative.perParameter || {});
      setKesimpulanUmum(narrative.kesimpulanUmum || "");
      showToast("Draf narasi pengkajian berhasil dibuat!");
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const distinctReportLimits = useMemo(() => {
    const map = {};
    const relevantRooms = selectedRoomName
      ? (rooms || []).filter((r) => r?.name === selectedRoomName)
      : rooms || [];
    relevantRooms.forEach((rObj) => {
      if (rObj && rObj.persyaratanKey) {
        map[rObj.persyaratanKey] = rObj.limits;
      }
    });
    return map;
  }, [rooms, selectedRoomName]);

  const roomsMap = useMemo(() => {
    const map = {};
    (rooms || []).forEach((r) => {
      if (r?.name) map[r.name] = r.persyaratanKey || "—";
    });
    return map;
  }, [rooms]);

  const currentLevel = facilityOverallLevel(
    selectedRoomName ? (monthEntries || []).filter((e) => e?.roomName === selectedRoomName) : monthEntries
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 bg-zinc-900/95 text-white border border-emerald-500/60 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          onClick={() => setView({ page: "facility", facility: facilityKey })}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
        >
          <ArrowLeft size={14} className="text-rose-900" /> Kembali ke {cfg?.label}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold transition shadow-xs"
        >
          <Printer size={14} className="text-slate-300" /> Cetak Pengkajian
        </button>
      </div>

      {/* HEADER KOP UTAMA PENGKAJIAN QA */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 print-card shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-6 py-4">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-600/20 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-start gap-4">
              <img src="/logo-rama.png" alt="Logo" className="h-11 w-11 object-contain brightness-0 invert" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                  PT. Rama Emerald Multi Sukses — QA
                </p>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {selectedRoomName
                    ? `Pengkajian Tren Ruangan — ${selectedRoomName}`
                    : `Pengkajian Trend Data EM Non Viable (Global)`}
                </h1>
                <p className="text-xs text-rose-100/90 mt-0.5">
                  Fasilitas: <span className="font-semibold text-white">{cfg?.label}</span> · Periode:{" "}
                  <span className="font-semibold text-white">{monthLabelID(month)}</span>
                  {selectedRoomName && (
                    <span>
                      {" "}
                      · Ruangan: <span className="font-semibold text-white">{selectedRoomName}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-right text-xs text-rose-200 font-mono">POS.QA.025</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-white px-6 py-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400">
            {selectedRoomName ? "Status Ruangan:" : "Status Fasilitas:"}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-bold"
            style={{ background: levelStyle(currentLevel).bg, color: levelStyle(currentLevel).color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: levelStyle(currentLevel).dot }} />
            {levelStyle(currentLevel).label}
          </span>
        </div>
      </div>

      {/* FILTER FASILITAS & CAKUPAN */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700">Fasilitas:</label>
            <select
              value={facilityKey}
              onChange={(e) => {
                setFacilityKey(e.target.value);
                setSelectedRoomName("");
              }}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none bg-slate-50 focus:border-rose-700"
            >
              {FACILITIES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} ({f.department})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700">Cakupan:</label>
            <select
              value={selectedRoomName}
              onChange={(e) => setSelectedRoomName(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none bg-slate-50 focus:border-rose-700"
            >
              <option value="">Semua Ruangan (Global Fasilitas)</option>
              {(rooms || []).map((r) => (
                <option key={r.code + r.name} value={r.name}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="p-3.5 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-200">{error}</p>}

      {/* 1. TABEL REKAP NILAI DATA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-2.5 print-card avoid-break">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {selectedRoomName
              ? `Rekap Data Pengukuran Bulanan — ${selectedRoomName}`
              : `Rekap Data Pengukuran Seluruh Ruangan — Fasilitas ${cfg?.label}`}
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">{(monthEntries || []).length} Baris Data</span>
        </div>

        {(monthEntries || []).length === 0 ? (
          <div className="p-6 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
            Belum ada data pengukuran yang tercatat pada periode ini.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-100 print:max-h-none print:overflow-visible">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b print:static">
                <tr>
                  <th className="px-3 py-1">TANGGAL</th>
                  <th className="px-2 py-1 text-center">JAM</th>
                  <th className="px-3 py-1">RUANGAN</th>
                  <th className="px-2 py-1 text-center">PERSYARATAN</th>
                  <th className="px-2 py-1 text-center">SUHU (°C)</th>
                  <th className="px-2 py-1 text-center">RH (%)</th>
                  <th className="px-2 py-1 text-center">DPG (Pa)</th>
                  <th className="px-2 py-1 text-center">OPR</th>
                  <th className="px-2 py-1 text-center">SPV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(monthEntries || []).map((e) => {
                  const reqKey = roomsMap[e.roomName] || e.persyaratanKey || "—";
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-1 font-medium text-slate-700">{e.tanggal}</td>
                      <td className="px-2 py-1 text-center text-slate-500">{e.jam}</td>
                      <td className="px-3 py-1 text-slate-700 font-medium">{e.roomName}</td>
                      <td className="px-2 py-1 text-center">
                        <span className="inline-block bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg text-[10px] border border-slate-200">
                          {reqKey}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: levelStyle(e?.level?.suhu).bg,
                            color: levelStyle(e?.level?.suhu).color,
                          }}
                        >
                          {e.suhu ?? "-"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: levelStyle(e?.level?.rh).bg,
                            color: levelStyle(e?.level?.rh).color,
                          }}
                        >
                          {e.rh ?? "-"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: levelStyle(e?.level?.dpg).bg,
                            color: levelStyle(e?.level?.dpg).color,
                          }}
                        >
                          {e.dpg ?? "-"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-center text-slate-500 font-medium text-[10px]">
                        {e.opr || "—"}
                      </td>
                      <td className="px-2 py-1 text-center text-slate-500 font-medium text-[10px]">
                        {e.spv || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. CARD PERSYARATAN & LIMIT */}
      {Object.keys(distinctReportLimits).length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-2.5 print-card avoid-break">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Persyaratan &amp; Batas Limit (Jenis Limit Terpakai)
          </h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b">
                  <th className="px-3 py-1">KODE / PERSYARATAN</th>
                  <th className="px-3 py-1">PARAMETER</th>
                  <th className="px-3 py-1">SYARAT</th>
                  <th className="px-3 py-1">ALERT LIMIT</th>
                  <th className="px-3 py-1">ACTION LIMIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(distinctReportLimits).map(([pKey, limits]) => {
                  return PARAM_DEFS.map((p) => {
                    const lim = limits?.[p.key];
                    if (!lim) return null;
                    const allNull = [
                      lim.syaratL,
                      lim.syaratU,
                      lim.alertL,
                      lim.alertU,
                      lim.actionL,
                      lim.actionU,
                    ].every((x) => toNumberSafe(x) === null);
                    if (allNull) return null;
                    const isDpg = p.key === "dpg";

                    return (
                      <tr key={pKey + p.key}>
                        <td className="px-3 py-1 font-bold text-slate-800">{pKey}</td>
                        <td className="px-3 py-1 font-semibold text-slate-700">{p.label}</td>
                        <td className="px-3 py-1 text-slate-800">
                          {formatRange(lim.syaratL, lim.syaratU, p.unit, isDpg)}
                        </td>
                        <td className="px-3 py-1 text-amber-700">
                          {formatRange(lim.alertL, lim.alertU, p.unit, isDpg)}
                        </td>
                        <td className="px-3 py-1 text-orange-700">
                          {formatRange(lim.actionL, lim.actionU, p.unit, isDpg)}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Terkendali
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Alert
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Action
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Melebihi Syarat
            </span>
          </div>
        </div>
      )}

      {/* 3. GRAFIK TREN BULANAN */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Grafik Tren Pengukuran Periode {monthLabelID(month)}
        </h2>
        <div className="space-y-2.5">
          {PARAM_DEFS.map((p) => {
            const rObj = selectedRoomName ? (rooms || []).find((r) => r?.name === selectedRoomName) : null;
            return (
              <RoomMonthlyTrendChart
                key={p.key}
                entriesData={monthEntries}
                paramKey={p.key}
                paramLabel={p.label}
                unit={p.unit}
                limit={rObj?.limits?.[p.key]}
                isGlobal={!selectedRoomName}
              />
            );
          })}
        </div>
      </div>

      {/* 4. FORM NARASI PENGKAJIAN DENGAN KOP THEMATIC ELEGAN */}
      <div ref={narasiRef} className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-3.5 print-card avoid-break">
        <div className="flex items-center justify-between border-b pb-2.5">
          <h2 className="text-sm font-bold text-slate-800">
            {selectedRoomName
              ? `Pembahasan & Narasi Pengkajian — ${selectedRoomName}`
              : `Pembahasan & Narasi Pengkajian Fasilitas ${cfg?.label} (Global)`}
          </h2>
          {canDraftQA && !isFinal && (
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={handleGenerateAI}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-900 hover:bg-rose-950 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60 transition"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate AI
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Draf
              </button>
            </div>
          )}
        </div>

        {/* Blok Pendahuluan Thematic KOP */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs avoid-break">
          <div className="bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-3.5 py-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <FileSpreadsheet size={13} className="text-rose-400" /> Pendahuluan
            </span>
          </div>
          <div className="p-2.5 bg-white">
            <textarea
              value={pendahuluan}
              onChange={(e) => {
                setPendahuluan(e.target.value);
                handleAutoResize(e);
              }}
              onFocus={handleAutoResize}
              disabled={!canDraftQA || isFinal}
              rows={2}
              style={{ minHeight: "55px", overflow: "hidden" }}
              className="no-print w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-rose-700 disabled:bg-slate-50 leading-relaxed resize-none"
            />
            <p className="only-print text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{pendahuluan || "-"}</p>
          </div>
        </div>

        {/* Blok Tiap Parameter Thematic KOP */}
        {PARAM_DEFS.map((p) => {
          const PIcon = p.icon || Sparkles;
          return (
            <div key={p.key} className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs avoid-break">
              <div className="bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-3.5 py-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <PIcon size={13} className="text-rose-400" /> {p.label} ({p.unit})
                </span>
                <span className="text-[9.5px] text-rose-200 font-mono">Hasil, Tren &amp; Kesimpulan</span>
              </div>
              <div className="p-2.5 bg-white">
                <textarea
                  value={perParameter[p.key] || ""}
                  onChange={(e) => {
                    setPerParameter({ ...perParameter, [p.key]: e.target.value });
                    handleAutoResize(e);
                  }}
                  onFocus={handleAutoResize}
                  disabled={!canDraftQA || isFinal}
                  rows={2}
                  style={{ minHeight: "60px", overflow: "hidden" }}
                  placeholder={`Tulis ulasan hasil, tren, dan kesimpulan untuk parameter ${p.label}...`}
                  className="no-print w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-rose-700 disabled:bg-slate-50 leading-relaxed resize-none"
                />
                <p className="only-print text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {perParameter[p.key] || "-"}
                </p>
              </div>
            </div>
          );
        })}

        {/* Blok Kesimpulan Umum Thematic KOP */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs avoid-break">
          <div className="bg-gradient-to-r from-black via-zinc-950 to-rose-950 px-3.5 py-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <CheckCircle2 size={13} /> Kesimpulan Umum
            </span>
          </div>
          <div className="p-2.5 bg-white">
            <textarea
              value={kesimpulanUmum}
              onChange={(e) => {
                setKesimpulanUmum(e.target.value);
                handleAutoResize(e);
              }}
              onFocus={handleAutoResize}
              disabled={!canDraftQA || isFinal}
              rows={2}
              style={{ minHeight: "55px", overflow: "hidden" }}
              className="no-print w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-rose-700 disabled:bg-slate-50 leading-relaxed resize-none"
            />
            <p className="only-print text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {kesimpulanUmum || "-"}
            </p>
          </div>
        </div>

        {/* Tanda Tangan */}
        <div className="pt-2.5 border-t grid grid-cols-1 sm:grid-cols-2 gap-3 avoid-break">
          <div className="border rounded-2xl p-3.5 bg-slate-50/50 text-center flex flex-col justify-between min-h-[125px]">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">
              Dikaji Oleh (Supervisor QA)
            </p>
            {report?.signoff?.dinilai?.nama ? (
              <div className="space-y-0.5 my-auto">
                <div className="flex justify-center">
                  <VerifyQR
                    type="pengkajian"
                    facility={facilityKey}
                    period={month}
                    roomName={selectedRoomName}
                    signerRole="Dikaji Oleh"
                    signerName={report.signoff.dinilai.nama}
                    size={42}
                  />
                </div>
                <p className="text-xs font-bold text-slate-800">{report.signoff.dinilai.nama}</p>
                <p className="text-[9px] text-slate-400">{report.signoff.dinilai.tanggal}</p>
              </div>
            ) : (
              <div className="my-auto space-y-2">
                <p className="text-xs italic text-slate-400">Belum disetujui</p>
                {canDraftQA && (
                  <button
                    onClick={handleDikaji}
                    className="no-print px-4 py-1.5 bg-rose-900 hover:bg-rose-950 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Approve "Dikaji Oleh"
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border rounded-2xl p-3.5 bg-slate-50/50 text-center flex flex-col justify-between min-h-[125px]">
            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">
              Mengetahui (Manager QA)
            </p>
            {report?.signoff?.diperiksa?.nama ? (
              <div className="space-y-0.5 my-auto">
                <div className="flex justify-center">
                  <VerifyQR
                    type="pengkajian"
                    facility={facilityKey}
                    period={month}
                    roomName={selectedRoomName}
                    signerRole="Mengetahui"
                    signerName={report.signoff.diperiksa.nama}
                    size={42}
                  />
                </div>
                <p className="text-xs font-bold text-slate-800">{report.signoff.diperiksa.nama}</p>
                <p className="text-[9px] text-slate-400">{report.signoff.diperiksa.tanggal}</p>
              </div>
            ) : (
              <div className="my-auto space-y-2">
                <p className="text-xs italic text-slate-400">
                  {report?.signoff?.dinilai?.nama
                    ? "Menunggu approval Manager QA"
                    : "Menunggu approval 'Dikaji Oleh' terlebih dahulu"}
                </p>
                {canFinalQA && report?.signoff?.dinilai?.nama && (
                  <button
                    onClick={handleMengetahui}
                    className="no-print px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Approve Final "Mengetahui"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   13. FORMULIR BULANAN CETAK (FM.QA.024/R11)
   ========================================================================= */
function FormulirBulananPrint({ session, facilityKey, roomName, bulan, setView }) {
  const cfg = FACILITIES.find((f) => f.key === facilityKey) || FACILITIES[0];
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(roomName || "");
  const [entries, setEntries] = useState([]);
  const [formulir, setFormulir] = useState(null);
  const [busy, setBusy] = useState(false);

  const canKepalaBagian = cfg ? hasFacilityAccess(session, "Supervisor", cfg) : false;
  const canManagerQA = hasAccess(session, "Manager", "QA");

  const load = useCallback(async () => {
    try {
      const [master, entriesRes, formulirRes] = await Promise.all([
        fetchMaster(facilityKey),
        fetchEntries(facilityKey, bulan),
        fetchFormulirBulanan(facilityKey, bulan, selectedRoom, session?.token),
      ]);
      const roomList = Array.isArray(master) ? master : master?.rooms || [];
      setRooms(roomList);
      const targetRoom = selectedRoom || roomList[0]?.name || "";
      setSelectedRoom(targetRoom);
      const list = Array.isArray(entriesRes) ? entriesRes : entriesRes?.entries || [];
      setEntries(list.filter((e) => String(e?.roomName || "").trim() === String(targetRoom).trim()));
      setFormulir(formulirRes);
    } catch {
      // ignore
    }
  }, [facilityKey, bulan, selectedRoom, session?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const n = daysInMonth(bulan);
  const byDay = {};
  (entries || []).forEach((e) => {
    byDay[e.tanggal + "|" + e.jam] = e;
  });
  const roomObj = (rooms || []).find((r) => r?.name === selectedRoom) || rooms[0];

  return (
    <div className="max-w-5xl mx-auto space-y-4 print:max-w-none print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          onClick={() => setView({ page: "facility", facility: facilityKey })}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
        >
          <ArrowLeft size={14} className="text-rose-900" /> Kembali ke {cfg?.label}
        </button>
        <div className="flex items-center gap-2">
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="border rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold outline-none bg-white"
          >
            {(rooms || []).map((r) => (
              <option key={r.code} value={r.name}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
          {hasAccess(session, "Supervisor", "QA") && (
            <button
              onClick={() => setView({ page: "pengkajian", facility: facilityKey, room: selectedRoom })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 text-rose-950 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
            >
              <ClipboardList size={14} className="text-rose-800" /> Pengkajian Ruangan Ini
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold transition shadow-xs"
          >
            <Printer size={14} className="text-slate-300" /> Cetak
          </button>
        </div>
      </div>

      <div className="print-card avoid-break rounded-3xl border-2 border-slate-800 bg-white p-5 text-xs shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-2.5">
          <div className="flex items-center gap-3">
            <img src="/logo-rama.png" alt="Logo" className="h-11 w-11 object-contain" />
            <div>
              <p className="text-[11px] font-bold text-slate-700">PT. Rama Emerald</p>
              <p className="text-[11px] font-bold text-slate-700">Multi Sukses</p>
            </div>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Check List Pemantauan Suhu, Kelembaban dan Perbedaan Tekanan
            </p>
          </div>
          <div className="whitespace-nowrap text-right text-[11px] text-slate-600">
            <p>
              No. : <span className="font-semibold">FM.QA.024/R11</span>
            </p>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold text-slate-600">Bulan - Tahun</span> : {monthLabelID(bulan)}
            </p>
            <p>
              <span className="font-semibold text-slate-600">Gedung</span> : {cfg?.label}
            </p>
            <p>
              <span className="font-semibold text-slate-600">Nama Ruang / No. Ruang</span> : {roomObj?.name} (
              {roomObj?.code})
            </p>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-slate-400 bg-slate-100 px-1 py-1">
                  Tanggal
                </th>
                <th colSpan={5} className="border border-slate-400 bg-slate-100 px-1 py-1">
                  Jam 08.00
                </th>
                <th colSpan={5} className="border border-slate-400 bg-slate-100 px-1 py-1">
                  Jam 13.00
                </th>
              </tr>
              <tr>
                {[
                  "Suhu (°C)",
                  "RH (%)",
                  "DPG (Pa)",
                  "OPR",
                  "SPV",
                  "Suhu (°C)",
                  "RH (%)",
                  "DPG (Pa)",
                  "OPR",
                  "SPV",
                ].map((h, i) => (
                  <th key={i} className="border border-slate-400 bg-slate-50 px-1 py-0.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
                const tanggal = `${bulan}-${String(d).padStart(2, "0")}`;
                const am = byDay[tanggal + "|08:00"];
                const pm = byDay[tanggal + "|13:00"];
                return (
                  <tr key={d}>
                    <td className="border border-slate-300 px-1 py-0.5 text-center font-medium">{d}</td>
                    {[am, pm].flatMap((e, idx) => [
                      <td key={idx + "s"} className="border border-slate-300 px-1 py-0.5 text-center">
                        {e?.suhu ?? ""}
                      </td>,
                      <td key={idx + "r"} className="border border-slate-300 px-1 py-0.5 text-center">
                        {e?.rh ?? ""}
                      </td>,
                      <td key={idx + "d"} className="border border-slate-300 px-1 py-0.5 text-center">
                        {e?.dpg ?? ""}
                      </td>,
                      <td key={idx + "o"} className="border border-slate-300 px-1 py-0.5 text-center">
                        {e?.opr || ""}
                      </td>,
                      <td key={idx + "p"} className="border border-slate-300 px-1 py-0.5 text-center">
                        {e?.spv || ""}
                      </td>,
                    ])}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-center avoid-break">
          <div>
            <p className="mb-1 text-[10px] text-slate-500">(Kepala Bagian)</p>
            {formulir?.kepalaBagian?.nama ? (
              <>
                <div className="mb-1 flex justify-center">
                  <VerifyQR
                    type="formulir"
                    facility={facilityKey}
                    period={bulan}
                    roomName={selectedRoom}
                    signerRole="Kepala Bagian"
                    signerName={formulir.kepalaBagian.nama}
                    size={46}
                  />
                </div>
                <p className="text-xs font-semibold text-slate-800">{formulir.kepalaBagian.nama}</p>
                <p className="text-[9px] text-slate-400">{formulir.kepalaBagian.tanggal}</p>
              </>
            ) : canKepalaBagian ? (
              <button
                onClick={async () => {
                  setBusy(true);
                  await apiApproveKepalaBagian(facilityKey, bulan, selectedRoom, session?.token);
                  await load();
                  setBusy(false);
                }}
                disabled={busy}
                className="no-print bg-emerald-600 px-3 py-1.5 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Approve (Kepala Bagian)
              </button>
            ) : (
              <p className="italic text-slate-400">Belum di-ACC</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[10px] text-slate-500">(Manager QA)</p>
            {formulir?.managerQA?.nama ? (
              <>
                <div className="mb-1 flex justify-center">
                  <VerifyQR
                    type="formulir"
                    facility={facilityKey}
                    period={bulan}
                    roomName={selectedRoom}
                    signerRole="Manager QA"
                    signerName={formulir.managerQA.nama}
                    size={46}
                  />
                </div>
                <p className="text-xs font-semibold text-slate-800">{formulir.managerQA.nama}</p>
                <p className="text-[9px] text-slate-400">{formulir.managerQA.tanggal}</p>
              </>
            ) : canManagerQA ? (
              <button
                onClick={async () => {
                  setBusy(true);
                  await apiApproveManagerQAFormulir(facilityKey, bulan, session?.token);
                  await load();
                  setBusy(false);
                }}
                disabled={busy}
                className="no-print bg-rose-900 px-3 py-1.5 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Approve (Manager QA)
              </button>
            ) : (
              <p className="italic text-slate-400">Belum di-ACC</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   14. RIWAYAT AKTIVITAS & AUDIT TRAIL + DOWNLOAD CSV
   ========================================================================= */
function ActivityPage({ session, month, setView }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(month || currentMonth());
  const [allMonths, setAllMonths] = useState(true);
  const [filterFacility, setFilterFacility] = useState("");

  const canDownloadQA = session?.departemen?.toUpperCase().includes("QA") || session?.role === "Administrator";

  const loadLogs = useCallback(() => {
    setLoading(true);
    fetchActivityLog(session?.token, {
      month: allMonths ? undefined : selectedMonth,
      facility: filterFacility || undefined,
    })
      .then((data) => {
        const logList = Array.isArray(data) ? data : data?.logs || [];
        setLogs(logList);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [session?.token, allMonths, selectedMonth, filterFacility]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleDownloadCSV = () => {
    if (!logs || logs.length === 0) return;
    const headers = ["Waktu", "Username", "Nama", "Role", "Departemen", "Aksi", "Fasilitas", "Bulan", "Detail"];
    const rows = logs.map((l) => [
      `"${new Date(l.waktu).toLocaleString("id-ID")}"`,
      `"${l.username || ""}"`,
      `"${l.nama || ""}"`,
      `"${l.role || ""}"`,
      `"${l.departemen || ""}"`,
      `"${l.aksi || ""}"`,
      `"${l.fasilitas || ""}"`,
      `"${l.bulan || ""}"`,
      `"${(l.detail || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Audit_Log_EMNV_${allMonths ? "Semua_Periode" : selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setView({ page: "dashboard" })}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition"
        >
          <ChevronLeft size={16} /> Kembali ke Dashboard
        </button>
        <button onClick={loadLogs} className="text-xs text-rose-800 hover:underline font-bold">
          Refresh Log
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800">Riwayat Aktivitas &amp; Audit Trail</h2>
          <p className="text-xs text-slate-400">Rekam jejak seluruh aksi login, input, dan approval integritas data</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <input
              type="checkbox"
              checked={allMonths}
              onChange={(e) => setAllMonths(e.target.checked)}
              className="rounded"
            />
            Semua Periode
          </label>

          {!allMonths && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none bg-slate-50"
            />
          )}

          <select
            value={filterFacility}
            onChange={(e) => setFilterFacility(e.target.value)}
            className="border rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none font-semibold bg-slate-50"
          >
            <option value="">Semua Fasilitas</option>
            {FACILITIES.map((f) => (
              <option key={f.key} value={f.label}>
                {f.label}
              </option>
            ))}
          </select>

          {canDownloadQA && (
            <button
              onClick={handleDownloadCSV}
              disabled={logs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <Download size={13} />
              <span>Download Log (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (logs || []).length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs">
          Belum ada riwayat aktivitas yang tercatat.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y text-xs shadow-xs overflow-hidden">
          {(logs || []).map((l, i) => (
            <div key={i} className="p-4 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/70 transition">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-800">{l.nama}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {l.role}
                    {l.departemen ? ` · ${l.departemen}` : ""}
                  </span>
                  <span className="font-semibold text-rose-900 bg-rose-50 px-2.5 py-0.5 rounded-full text-[11px] border border-rose-200/60">
                    {l.aksi}
                  </span>
                  {l.fasilitas && (
                    <span className="text-[11px] font-bold text-slate-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {l.fasilitas}
                    </span>
                  )}
                </div>
                {l.detail && <p className="text-slate-500 text-[11px]">{l.detail}</p>}
              </div>
              <span className="text-slate-400 text-[10px] whitespace-nowrap">
                {new Date(l.waktu).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   15. HALAMAN VERIFIKASI QR DOKUMEN PUBLIK (/verify)
   ========================================================================= */
function VerifyPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const type = params.get("type");
  const facilityKey = params.get("facility");
  const roomName = params.get("roomName") || "";
  const jam = params.get("jam") || "";
  const role = params.get("role") || "";
  const nameOverride = params.get("name") || "";
  const period =
    type === "pengkajian"
      ? params.get("month")
      : type === "formulir"
      ? params.get("bulan")
      : params.get("tanggal");
  const facility = FACILITIES.find((f) => f.key === facilityKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerify(type, facilityKey, period, roomName).then(setData).finally(() => setLoading(false));
  }, [type, facilityKey, period, roomName]);

  const docTitle =
    type === "pengkajian"
      ? `Pengkajian Trend Data EM Non Viable (POS.QA.025)${roomName ? ` — Ruangan: ${roomName}` : " (Global)"}`
      : type === "formulir"
      ? `Formulir Pemantauan Bulanan (FM.QA.024/R11)${roomName ? ` — ${roomName}` : ""}`
      : `Data Pemantauan Harian (FM.QA.024/R11)${roomName ? ` — ${roomName}` : ""}${jam ? ` (${jam})` : ""}`;

  const signerDisplay =
    nameOverride ||
    (role === "OPR"
      ? data?.approvedBy?.opr || "Operator Terdaftar"
      : data?.approvedBy?.nama || data?.approvedBy?.spv || "Supervisor / Manager");

  const roleLabel = role === "OPR" ? "Diinput & Disetujui Oleh (OPR)" : role || "Disetujui Oleh";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm flex flex-col items-center space-y-4">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <img src="/logo-rama.png" alt="Logo PT. Rama Emerald Multi Sukses" className="h-16 w-16 object-contain" />
          <h1 className="text-base font-bold text-slate-800">Verifikasi Dokumen EM Non Viable</h1>
          <p className="text-xs text-slate-500">PT. Rama Emerald Multi Sukses</p>
        </div>

        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto shadow-inner">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-sm font-bold text-emerald-800">Dokumen Sah &amp; Terverifikasi</h2>

          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 size={18} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 text-left text-xs space-y-2 border border-slate-100">
              <p>
                <span className="text-slate-400">Dokumen:</span>{" "}
                <span className="font-semibold text-slate-800">{docTitle}</span>
              </p>
              <p>
                <span className="text-slate-400">Fasilitas:</span>{" "}
                <span className="font-semibold text-slate-800">{facility?.label || facilityKey}</span>
              </p>
              <p>
                <span className="text-slate-400">Periode / Tanggal:</span>{" "}
                <span className="font-semibold text-slate-800">{period}</span>
              </p>
              <p>
                <span className="text-slate-400">{roleLabel}:</span>{" "}
                <span className="font-bold text-slate-900">{signerDisplay}</span>
              </p>
              <p>
                <span className="text-slate-400">Status:</span>{" "}
                <span className="font-semibold text-emerald-700">Terverifikasi Digital</span>
              </p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-400 text-center max-w-xs leading-relaxed">
          Dokumen ini terintegrasi langsung dengan database QA EM Non Viable PT. Rama Emerald Multi Sukses.
        </p>
      </div>
    </div>
  );
}

/* =========================================================================
   16. APP CONTENT CONTROLLER
   ========================================================================= */
function AppContent() {
  const { session, checking, login, logout } = useAuth();
  const [view, setView] = useState({ page: "dashboard" });
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchStatusIndex(month)
      .then((d) => {
        if (!cancelled) setStatus(d?.status || d || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [month]);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      return;
    }

    let isMounted = true;
    const fetchNotifs = async () => {
      try {
        const notifList = [];
        const tglHariIni = todayStr();
        const isQA = session?.departemen?.toUpperCase().includes("QA") || session?.role === "Administrator";
        const isMonthCompleted = month < currentMonth();

        const relevantFacilities = FACILITIES.filter((f) => {
          if (isQA) return true;
          return hasFacilityAccess(session, "Staff", f);
        });

        await Promise.all(
          relevantFacilities.map(async (fac) => {
            try {
              const [entriesRes, reportRes] = await Promise.all([
                fetchEntries(fac.key, month).catch(() => []),
                isQA && isMonthCompleted ? fetchReport(fac.key, month, session?.token, "").catch(() => null) : null,
              ]);

              const entryList = Array.isArray(entriesRes) ? entriesRes : entriesRes?.entries || [];

              // Alert Deviasi Kritis
              entryList.forEach((e) => {
                PARAM_DEFS.forEach((p) => {
                  const lvl = e?.level?.[p.key];
                  if (lvl >= 3) {
                    notifList.push({
                      type: "critical",
                      facilityKey: fac.key,
                      facilityLabel: fac.label,
                      targetDate: e.tanggal,
                      title: `Peringatan ${lvl === 4 ? "TMS (Melebihi Syarat)" : "Action Limit"}`,
                      desc: `Ruangan ${e.roomName} parameter ${p.label}: ${e[p.key]} ${p.unit} (Tgl ${e.tanggal}, Jam ${e.jam}).`,
                      tag: lvl === 4 ? "TMS" : "Action Limit",
                      time: e.tanggal,
                    });
                  }
                });
              });

              // Alert Pengkajian Global Bulanan (QA)
              if (isQA && isMonthCompleted && entryList.length > 0) {
                const hasGlobalNarrative = reportRes?.narrative?.pendahuluan || reportRes?.narrative?.kesimpulanUmum;
                if (!hasGlobalNarrative) {
                  notifList.push({
                    type: "qa_global",
                    facilityKey: fac.key,
                    facilityLabel: fac.label,
                    title: "Pengkajian QA Global Belum Dibuat",
                    desc: `Terdapat ${entryList.length} data pemantauan pada periode ${monthLabelID(month)}. Pengkajian tren global diperlukan.`,
                    tag: "Pengkajian Global",
                    time: "Awal Bulan",
                  });
                }
              }

              // Alert Pending SPV Approval (SPV/Manager Area)
              if (!isQA) {
                const pendingEntries = entryList.filter((e) => !!e.opr && !e.spv);
                if (pendingEntries.length > 0) {
                  const uniqueDates = Array.from(new Set(pendingEntries.map((e) => e.tanggal)));
                  uniqueDates.forEach((tgl) => {
                    const countOnDate = pendingEntries.filter((e) => e.tanggal === tgl).length;
                    notifList.push({
                      type: "pending_spv",
                      facilityKey: fac.key,
                      facilityLabel: fac.label,
                      targetDate: tgl,
                      title: "Menunggu Approval SPV",
                      desc: `Terdapat ${countOnDate} data ruangan pada tgl ${tgl} telah di-approve OPR dan siap ditinjau.`,
                      tag: "Pending SPV",
                      time: tgl,
                    });
                  });
                }
              }
            } catch {
              // ignore
            }
          })
        );

        if (isMounted) {
          setNotifications(notifList);
        }
      } catch {
        // ignore
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session, month]);

  const handleSelectNotification = (notif) => {
    if (notif.type === "qa_global") {
      setView({ page: "pengkajian", facility: notif.facilityKey, room: "" });
    } else if (notif.facilityKey) {
      setView({ page: "facility", facility: notif.facilityKey, targetDate: notif.targetDate });
    }
  };

  const handleLogout = useCallback(() => {
    logout();
    setView({ page: "dashboard" });
    setShowProfile(false);
    setShowChangePassword(false);
  }, [logout]);

  useEffect(() => {
    const needsAuthPages = ["facility", "pengkajian", "formulir", "activity", "notifications"];
    if (needsAuthPages.includes(view.page) && !session) {
      setView({ page: "dashboard" });
    }
  }, [session, view.page]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-sans">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans">
      {/* CSS CETAK PRINT DENGAN RESET PADDING SHELL & NO-PRINT OVERRIDE */}
      <style>{`
        .only-print { display: none; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          .no-print, aside, header { display: none !important; }
          .only-print { display: block !important; }
          .print-content-shell {
            padding-left: 0 !important;
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-card { 
            box-shadow: none !important; 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
            border: 1px solid #e2e8f0 !important; 
            margin-bottom: 0.65rem !important; 
            padding: 0.12rem 0.45rem !important;
            border-radius: 1.25rem !important;
            overflow: hidden !important;
          }
          .avoid-break { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
            margin-bottom: 0.55rem !important;
          }
          .chart-container-print {
            height: 155px !important;
            padding: 0.15rem !important;
          }
          table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
          th, td { padding-top: 2.5px !important; padding-bottom: 2.5px !important; padding-left: 3px !important; padding-right: 3px !important; font-size: 8px !important; word-break: break-word !important; overflow-wrap: anywhere !important; white-space: normal !important; }
          .overflow-x-auto { overflow: visible !important; max-width: 100% !important; }
          .overflow-y-auto { overflow: visible !important; max-height: none !important; }
          body, html, #root { background: white !important; height: auto !important; overflow-x: hidden !important; width: 100% !important; max-width: 100% !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; }
          textarea { border: none !important; resize: none !important; background: transparent !important; padding: 0 !important; height: auto !important; }
        }
        @page {
          margin: 0.6cm 0.6cm 0.8cm 0.6cm;
          size: portrait;
        }
      `}</style>

      <Sidebar
        session={session}
        view={view}
        setView={setView}
        status={status}
        onNeedLogin={() => setShowLogin(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notifications={notifications}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 print-content-shell">
        <HeaderBar
          session={session}
          onLoginClick={() => setShowLogin(true)}
          onLogout={handleLogout}
          onProfileClick={() => setShowProfile(true)}
          month={month}
          setMonth={setMonth}
          onToggleSidebar={() => setSidebarOpen(true)}
          notifications={notifications}
          onSelectNotification={handleSelectNotification}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {view.page === "dashboard" && (
            <DashboardOverview
              month={month}
              status={status}
              setView={setView}
              session={session}
              onNeedLogin={() => setShowLogin(true)}
            />
          )}
          {view.page === "notifications" && session && (
            <NotificationsPage
              notifications={notifications}
              onSelectNotification={handleSelectNotification}
              setView={setView}
            />
          )}
          {view.page === "facility" && session && (
            <FacilityIntegratedPage
              session={session}
              facilityKey={view.facility}
              month={month}
              setMonth={setMonth}
              setView={setView}
              initialDate={view.targetDate}
            />
          )}
          {view.page === "pengkajian" && session && (
            <PengkajianPage
              session={session}
              month={month}
              setView={setView}
              initialFacility={view.facility}
              initialRoom={view.room}
            />
          )}
          {view.page === "formulir" && session && (
            <FormulirBulananPrint
              session={session}
              facilityKey={view.facility}
              roomName={view.room}
              bulan={view.bulan || month}
              setView={setView}
            />
          )}
          {view.page === "activity" && session && (
            <ActivityPage session={session} month={month} setView={setView} />
          )}
        </main>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={login} />}
      {showProfile && session && (
        <ProfileModal
          session={session}
          onClose={() => setShowProfile(false)}
          onChangePasswordClick={() => {
            setShowProfile(false);
            setShowChangePassword(true);
          }}
        />
      )}
      {showChangePassword && session && (
        <ChangePasswordModal session={session} onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}

/* =========================================================================
   17. ROOT EXPORT
   ========================================================================= */
export default function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/verify") {
    return <VerifyPage />;
  }
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}