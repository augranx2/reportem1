// Helper module untuk menghasilkan Pembahasan (per Kelas, per Parameter)
// dan Kesimpulan Umum berbasis analisis data terinput, mengikuti gaya
// bahasa & struktur pembahasan farmasi (Settle Plate / Contact Plate /
// Air Sampler per kelas, lalu Kesimpulan per kelas, lalu Kesimpulan Umum).

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

const KELAS_INTRO = {
  E: "Kelas E merupakan area pendukung umum pada fasilitas produksi dengan tingkat pengendalian lingkungan paling dasar.",
  D: "Kelas D merupakan area pendukung yang digunakan untuk kegiatan pencucian alat, washing, persiapan, loading, dan aktivitas penunjang lainnya. Area ini memiliki aktivitas personel dan perpindahan material yang relatif tinggi sehingga memungkinkan terjadinya variasi hasil monitoring mikrobiologi.",
  C: "Kelas C merupakan area dengan tingkat pengendalian lebih tinggi yang berfungsi sebagai area transisi menuju area aseptik.",
  B: "Kelas B merupakan area latar belakang untuk proses aseptik sehingga memerlukan tingkat pengendalian lingkungan yang lebih ketat.",
  A: "Kelas A merupakan area paling kritis yang digunakan untuk proses aseptik sehingga memerlukan kondisi lingkungan dengan tingkat kebersihan tertinggi.",
};

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function getLimit(parameter, kelas) {
  return LIMITS.find((l) => l.parameter === parameter && l.kelas === kelas) || null;
}

function parseNumericValue(rawValue) {
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

function getStatus(rawValue, parameter, kelas) {
  const limit = getLimit(parameter, kelas);
  if (!limit) return { level: 0, label: "N/A" };
  if (rawValue === null || rawValue === undefined || rawValue === "")
    return { level: 0, label: "Belum diuji" };
  const v = parseNumericValue(rawValue);
  if (v === null) return { level: 0, label: "N/A" };
  if (limit.lessThan) {
    return v < 1
      ? { level: 1, label: "Terkendali" }
      : { level: 4, label: "Melebihi Syarat" };
  }
  if (v < limit.alert) return { level: 1, label: "Terkendali" };
  if (v < limit.action) return { level: 2, label: "Alert" };
  if (v < limit.syarat) return { level: 3, label: "Action" };
  return { level: 4, label: "Melebihi Syarat" };
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

function fullDateID(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_ID[Number(m) - 1] || m} ${y}`;
}

// Narasi 1 sub-bagian parameter (Settle Plate / Contact Plate / Air Sampler)
// untuk 1 kelas — mengikuti gaya: sebutkan nilai tertinggi (lokasi + tanggal),
// bandingkan dengan Alert/Action Limit, dan jelaskan apakah kejadian breach
// (bila ada) berulang atau hanya sekali.
function paramNarrative(paramKey, paramShort, kelas, kelasEntries) {
  const limit = getLimit(paramKey, kelas);
  if (!limit) return null;

  const points = kelasEntries
    .map((e) => ({ room: e.roomName || "Ruangan", tanggal: e.tanggal, raw: e[paramKey], value: parseNumericValue(e[paramKey]) }))
    .filter((p) => p.value !== null);

  if (points.length === 0) {
    return `Belum terdapat data ${paramShort} yang tercatat untuk parameter ini pada periode berjalan.`;
  }

  const allBelowOne = limit.lessThan && points.every((p) => p.value < 1);
  if (allBelowOne) {
    return `Seluruh hasil ${paramShort} menunjukkan <1 CFU secara konsisten pada seluruh titik dan tanggal pengujian.`;
  }

  const maxVal = Math.max(...points.map((p) => p.value));
  const topPoints = points.filter((p) => p.value === maxVal).slice(0, 3);
  const topStr = topPoints
    .map((p) => `${p.room} : ${displayValue(p.raw, kelas, paramKey)} CFU (${fullDateID(p.tanggal)})`)
    .join("; ");

  const breachPoints = points.filter((p) => getStatus(p.raw, paramKey, kelas).level >= 2);

  let text = `Hasil monitoring ${paramShort.toLowerCase()} menunjukkan nilai tertinggi pada ${topStr}. `;

  if (breachPoints.length === 0) {
    text += `Seluruh hasil masih berada di bawah Alert Limit (${limit.alert} CFU) dan Action Limit (${limit.action} CFU), sehingga kondisi lingkungan untuk parameter ini masih memenuhi persyaratan yang ditetapkan.`;
  } else {
    const highestLevel = Math.max(...breachPoints.map((p) => getStatus(p.raw, paramKey, kelas).level));
    const uniqueDates = new Set(breachPoints.map((p) => p.tanggal));
    const recurring = uniqueDates.size > 1;
    const levelPhrase = highestLevel >= 4
      ? "telah melampaui batas Syarat (spesifikasi) yang ditetapkan"
      : highestLevel >= 3
        ? "telah mencapai/melampaui Action Limit"
        : "telah mencapai Alert Limit";
    text += `Nilai tersebut ${levelPhrase} (Alert Limit ${limit.alert} CFU, Action Limit ${limit.action} CFU). `;
    text += recurring
      ? "Kejadian ini terjadi pada lebih dari satu tanggal pengujian sehingga memerlukan perhatian dan tindak lanjut lebih serius."
      : "Namun kejadian tersebut hanya terjadi pada satu kali pengujian, tidak berulang pada pengujian berikutnya.";
  }
  return text;
}

function classConclusion(kelas, breachesInClass) {
  if (breachesInClass.length === 0) {
    return `Lingkungan Kelas ${kelas} berada dalam kondisi terkendali. Seluruh parameter monitoring memenuhi persyaratan yang ditetapkan tanpa adanya hasil yang mencapai Alert maupun Action Limit.`;
  }
  const highestLevel = Math.max(...breachesInClass.map((b) => b.level));
  if (highestLevel >= 4) {
    return `Lingkungan Kelas ${kelas} terdapat titik yang melebihi batas persyaratan (spesifikasi) yang ditetapkan. Diperlukan investigasi lebih lanjut dan pengujian ulang (re-sampling) untuk memastikan kondisi lingkungan kembali terkendali.`;
  }
  return `Lingkungan Kelas ${kelas} masih berada dalam kondisi terkendali. Terdapat beberapa hasil yang mencapai Alert maupun Action Limit, namun kejadian tersebut tidak menunjukkan pola peningkatan yang konsisten dan tidak memengaruhi kondisi kelas ruangan lainnya.`;
}

export function generateLocalNarrative({ facilityLabel, monthLabel, classes, entries }) {
  const perKelas = {};
  const allBreaches = [];
  const classSummaries = [];
  let totalPointsAll = 0;

  classes.forEach((k) => {
    const kelasEntries = (entries || []).filter((e) => e.kelas === k);
    totalPointsAll += kelasEntries.length;

    if (kelasEntries.length === 0) {
      perKelas[k] = `Pada periode ${monthLabel}, tidak terdapat pengujian Environment Monitoring (EM) Viable yang dilakukan untuk ruangan Kelas ${k}.`;
      return;
    }

    const breachesInClass = [];
    kelasEntries.forEach((e) => {
      PARAM_DEFS.forEach((p) => {
        const limit = getLimit(p.key, k);
        if (!limit) return;
        const val = e[p.key];
        if (val === null || val === undefined || val === "" || val === "-") return;
        const st = getStatus(val, p.key, k);
        if (st.level >= 2) {
          const breachObj = { kelas: k, roomName: e.roomName || "Ruangan", tanggal: e.tanggal, parameter: p.short, value: displayValue(val, k, p.key), level: st.level, label: st.label };
          breachesInClass.push(breachObj);
          allBreaches.push(breachObj);
        }
      });
    });

    const sections = [KELAS_INTRO[k] || `Kelas ${k} merupakan salah satu area pemantauan lingkungan pada fasilitas ini.`];

    PARAM_DEFS.forEach((p) => {
      const text = paramNarrative(p.key, p.short, k, kelasEntries);
      if (text) sections.push(`Hasil dan Tren ${p.short}\n${text}`);
    });

    sections.push(`Kesimpulan\n${classConclusion(k, breachesInClass)}`);
    perKelas[k] = sections.join("\n\n");

    classSummaries.push({ kelas: k, breaches: breachesInClass });
  });

  // Kesimpulan Umum — rekap singkat tiap kelas, ditutup pernyataan efektivitas
  // program EM Viable periode ini (tanpa istilah "state of control").
  let kesimpulanUmum = "";
  if (totalPointsAll === 0) {
    kesimpulanUmum = `Berdasarkan data yang diinput untuk fasilitas ${facilityLabel} pada periode ${monthLabel}, belum ada titik sampling yang dicatat. Diharapkan untuk melengkapi data pemantauan lingkungan sebelum melakukan evaluasi akhir.`;
  } else {
    const intro = `Berdasarkan evaluasi trend data Environment Monitoring (EM) Viable periode ${monthLabel} pada fasilitas ${facilityLabel}, dapat disimpulkan bahwa kondisi lingkungan produksi pada seluruh kelas ruangan (${classes.map((k) => `Kelas ${k}`).join(", ")}) ${allBreaches.length === 0 ? "berada dalam keadaan terkendali dan memenuhi persyaratan CPOB yang berlaku." : "secara umum masih berada dalam keadaan terkendali, dengan beberapa titik pada kelas tertentu yang memerlukan perhatian lebih lanjut."}`;

    const perClassRecap = classSummaries.map(({ kelas: k, breaches }) => {
      if (breaches.length === 0) {
        return `Pada Kelas ${k}, seluruh parameter monitoring memenuhi persyaratan tanpa adanya hasil yang mencapai Alert maupun Action Limit.`;
      }
      const rooms = Array.from(new Set(breaches.map((b) => b.roomName))).slice(0, 3).join(", ");
      return `Pada Kelas ${k}, terdapat hasil pada area ${rooms} yang mencapai Alert/Action Limit, namun kejadian tersebut tidak menunjukkan tren peningkatan yang berkelanjutan.`;
    });

    const closing = allBreaches.length === 0
      ? `Secara keseluruhan, variasi hasil yang diperoleh masih mencerminkan kondisi operasional normal dan tidak menunjukkan adanya kecenderungan peningkatan cemaran mikrobiologi yang signifikan. Dengan demikian, program Environment Monitoring (EM) Viable periode ${monthLabel} masih efektif dalam memantau dan mengendalikan kondisi lingkungan produksi sehingga tetap mendukung proses pembuatan produk sesuai persyaratan mutu dan Standar CPOB tahun 2024 dan 2025 yang berlaku.`
      : `Secara keseluruhan, diperlukan tindak lanjut berupa investigasi dan pemantauan yang lebih ketat pada titik-titik yang mengalami penyimpangan. Fasilitas ${facilityLabel} tetap dapat digunakan dengan catatan dilakukan penanganan dan re-sampling pada titik terkait hingga diperoleh hasil yang terkendali secara konsisten sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`;

    kesimpulanUmum = [intro, ...perClassRecap, closing].join("\n\n");
  }

  return { perKelas, kesimpulanUmum };
}
