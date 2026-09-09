// Helper module untuk menghasilkan Pembahasan (per Kelas, per Parameter)
// dan Kesimpulan Umum berbasis analisis data terinput, mengikuti gaya
// bahasa & struktur pembahasan farmasi (Settle Plate / Contact Plate /
// Air Sampler per kelas, lalu Kesimpulan per kelas, lalu Kesimpulan Umum).
//
// Tabel LIMITS & helper hitung status di-import dari ./limits.js supaya
// tidak ada lagi salinan ganda yang bisa tidak sinkron.

import {
  PARAM_DEFS,
  getLimit,
  parseNumericValue,
  getStatusLevel,
  displayValue,
  fullDateID,
  isResampling,
  paramStatus,
  RESAMPLE_LEVEL,
} from "./limits.js";

const KELAS_INTRO = {
  E: "Kelas E merupakan area pendukung umum pada fasilitas produksi dengan tingkat pengendalian lingkungan paling dasar.",
  D: "Kelas D merupakan area pendukung yang digunakan untuk kegiatan pencucian alat, washing, persiapan, loading, dan aktivitas penunjang lainnya. Area ini memiliki aktivitas personel dan perpindahan material yang relatif tinggi sehingga memungkinkan terjadinya variasi hasil monitoring mikrobiologi.",
  C: "Kelas C merupakan area dengan tingkat pengendalian lebih tinggi yang berfungsi sebagai area transisi menuju area aseptik.",
  B: "Kelas B merupakan area latar belakang untuk proses aseptik sehingga memerlukan tingkat pengendalian lingkungan yang lebih ketat.",
  A: "Kelas A merupakan area paling kritis yang digunakan untuk proses aseptik sehingga memerlukan kondisi lingkungan dengan tingkat kebersihan tertinggi.",
};

// Narasi 1 sub-bagian parameter (Settle Plate / Contact Plate / Air Sampler)
// untuk 1 kelas — mengikuti gaya: sebutkan nilai tertinggi (lokasi + tanggal),
// bandingkan dengan Alert/Action Limit, dan jelaskan apakah kejadian breach
// (bila ada) berulang atau hanya sekali.
function paramNarrative(paramKey, paramShort, kelas, kelasEntries, allEntries) {
  const limit = getLimit(paramKey, kelas);
  if (!limit) return null;

  // Baris sampling ulang tidak dihitung sebagai titik pengujian rutin; hasilnya
  // dibahas sebagai tindak lanjut dari titik aslinya.
  const rutin = kelasEntries.filter((e) => !isResampling(e));
  const points = rutin
    .map((e) => ({ entry: e, room: e.roomName || "Ruangan", tanggal: e.tanggal, raw: e[paramKey], value: parseNumericValue(e[paramKey]) }))
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

  const breachPoints = points.filter((p) => getStatusLevel(p.raw, paramKey, kelas) >= 2);

  let text = `Hasil monitoring ${paramShort.toLowerCase()} menunjukkan nilai tertinggi pada ${topStr}. `;

  if (breachPoints.length === 0) {
    text += `Seluruh hasil masih berada di bawah Alert Limit (${limit.alert} CFU) dan Action Limit (${limit.action} CFU), sehingga kondisi lingkungan untuk parameter ini masih memenuhi persyaratan yang ditetapkan.`;
    return text;
  }

  const highestLevel = Math.max(...breachPoints.map((p) => getStatusLevel(p.raw, paramKey, kelas)));
  const uniqueDates = new Set(breachPoints.map((p) => p.tanggal));
  const recurring = uniqueDates.size > 1;

  if (highestLevel >= 4) {
    text += `Nilai tersebut telah melampaui batas Syarat (spesifikasi) yang ditetapkan (Alert Limit ${limit.alert} CFU, Action Limit ${limit.action} CFU, Syarat ${limit.lessThan ? "< 1" : limit.syarat} CFU) sehingga dinyatakan tidak memenuhi syarat (TMS) dan dikategorikan sebagai penyimpangan. Proses pada area terkait dihentikan sementara, dilakukan investigasi beserta tindakan perbaikan, kemudian dilanjutkan dengan pengambilan sampel ulang sampai diperoleh hasil yang memenuhi syarat. `;
  } else if (highestLevel === 3) {
    text += `Nilai tersebut melampaui Action Limit (${limit.action} CFU) namun masih berada di bawah batas Syarat (spesifikasi) ${limit.lessThan ? "< 1" : limit.syarat} CFU, sehingga dikategorikan sebagai Out of Trend (OOT) dan bukan penyimpangan. Penanganan awal berupa pengambilan sampel ulang segera pada titik terkait, disertai investigasi ringan bila diperlukan. `;
  } else {
    text += `Nilai tersebut mencapai Alert Limit (${limit.alert} CFU) namun masih berada di bawah Action Limit (${limit.action} CFU) sehingga kondisinya masih tergolong aman dan tidak memerlukan tindakan khusus, cukup dikoordinasikan di internal QC sebagai informasi awal. `;
    text += recurring
      ? "Kejadian ini tercatat pada lebih dari satu tanggal pengujian, sehingga tetap dipantau pada periode berikutnya untuk memastikan tidak berkembang menjadi tren peningkatan."
      : "Kejadian ini hanya terjadi pada satu kali pengujian dan tetap dipantau pada periode berikutnya.";
    return text;
  }

  // Untuk OOT dan penyimpangan: sebutkan hasil sampling ulangnya di sini juga,
  // supaya seluruh alur temuan sampai penutupannya terbaca dalam satu bagian.
  const tindak = followUpSentences(points, paramKey, kelas, allEntries);
  if (tindak) text += tindak + " ";

  text += recurring
    ? "Kejadian ini tercatat pada lebih dari satu tanggal pengujian sehingga menjadi perhatian khusus pada evaluasi periode berikutnya."
    : "Kejadian ini tercatat pada satu kali pengujian dan tetap dievaluasi pada periode berikutnya untuk memastikan tidak berulang.";

  return text;
}

// Kalimat tindak lanjut per parameter: hasil sampling ulang beserta statusnya.
function followUpSentences(points, paramKey, kelas, allEntries) {
  const selesai = [];
  const masihDiLuar = [];
  const belum = [];

  points.forEach((p) => {
    const st = paramStatus(allEntries || [], p.entry, paramKey);
    if (st.originalLevel < RESAMPLE_LEVEL) return;
    if (st.resolved) selesai.push({ p, st });
    else if (st.openResample) masihDiLuar.push({ p, st });
    else belum.push({ p, st });
  });

  const kalimat = [];
  if (selesai.length > 0) {
    const rincian = selesai
      .map(
        ({ p, st }) =>
          `${p.room} tanggal ${fullDateID(p.tanggal)} (${displayValue(p.raw, kelas, paramKey)} CFU) diuji ulang pada ${fullDateID(st.resample.tanggal)} dengan hasil ${displayValue(st.resample[paramKey], kelas, paramKey)} CFU`
      )
      .join("; ");
    kalimat.push(`Hasil sampling ulang menunjukkan ${rincian}, sehingga hasilnya telah kembali memenuhi syarat dan temuan dinyatakan selesai ditindaklanjuti.`);
  }
  if (masihDiLuar.length > 0) {
    const rincian = masihDiLuar
      .map(({ p, st }) => `${p.room} tanggal ${fullDateID(p.tanggal)} (sampling ulang ${fullDateID(st.openResample.tanggal)} : ${displayValue(st.openResample[paramKey], kelas, paramKey)} CFU)`)
      .join("; ");
    kalimat.push(`Sampling ulang pada ${rincian} masih menunjukkan hasil di luar batas sehingga diperlukan investigasi lanjutan beserta tindakan perbaikan dan pencegahan.`);
  }
  if (belum.length > 0) {
    const rincian = belum.map(({ p }) => `${p.room} tanggal ${fullDateID(p.tanggal)}`).join("; ");
    kalimat.push(`Hasil sampling ulang untuk ${rincian} belum tercatat sehingga perlu segera dilakukan dan diinput.`);
  }
  return kalimat.join(" ");
}

function classConclusion(kelas, breachesInClass) {
  if (breachesInClass.length === 0) {
    return `Lingkungan Kelas ${kelas} berada dalam kondisi terkendali. Seluruh parameter monitoring memenuhi persyaratan yang ditetapkan tanpa adanya hasil yang mencapai Alert maupun Action Limit.`;
  }
  const highestLevel = Math.max(...breachesInClass.map((b) => b.level));
  const perluTindakLanjut = breachesInClass.filter((b) => b.level >= RESAMPLE_LEVEL);
  const semuaSelesai = perluTindakLanjut.length > 0 && perluTindakLanjut.every((b) => b.resolved);

  if (highestLevel >= 4) {
    return semuaSelesai
      ? `Lingkungan Kelas ${kelas} sempat memiliki titik yang melampaui batas persyaratan (spesifikasi) sehingga dinyatakan tidak memenuhi syarat (TMS) dan dikategorikan sebagai penyimpangan. Setelah dilakukan investigasi, tindakan perbaikan, dan pengambilan sampel ulang, seluruh hasil telah kembali memenuhi syarat sehingga kondisi lingkungan dinyatakan kembali terkendali.`
      : `Lingkungan Kelas ${kelas} terdapat titik yang melampaui batas persyaratan (spesifikasi) sehingga dinyatakan tidak memenuhi syarat (TMS) dan dikategorikan sebagai penyimpangan. Proses pada area terkait dihentikan sementara dan diperlukan investigasi beserta tindakan perbaikan, dilanjutkan pengambilan sampel ulang sampai diperoleh hasil yang memenuhi syarat.`;
  }
  if (highestLevel === 3) {
    return semuaSelesai
      ? `Lingkungan Kelas ${kelas} masih memenuhi persyaratan (spesifikasi) yang ditetapkan. Terdapat hasil yang melampaui Action Limit sehingga dikategorikan sebagai Out of Trend (OOT), dan setelah dilakukan pengambilan sampel ulang hasilnya telah kembali memenuhi syarat.`
      : `Lingkungan Kelas ${kelas} masih memenuhi persyaratan (spesifikasi) yang ditetapkan, namun terdapat hasil yang melampaui Action Limit sehingga dikategorikan sebagai Out of Trend (OOT) dan perlu ditindaklanjuti dengan pengambilan sampel ulang segera.`;
  }
  return `Lingkungan Kelas ${kelas} berada dalam kondisi terkendali dan memenuhi persyaratan (spesifikasi) yang ditetapkan. Terdapat hasil yang mencapai Alert Limit, namun masih di bawah Action Limit sehingga kondisinya tergolong aman dan cukup dipantau pada periode berikutnya.`;
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
      // Baris uji ulang tidak dihitung sebagai temuan tersendiri — ia adalah
      // tindak lanjut dari sampling asli yang sudah dicatat di bawah ini.
      if (isResampling(e)) return;
      PARAM_DEFS.forEach((p) => {
        const limit = getLimit(p.key, k);
        if (!limit) return;
        const val = e[p.key];
        if (val === null || val === undefined || val === "" || val === "-") return;
        const st = paramStatus(entries || [], e, p.key);
        if (st.originalLevel >= 2) {
          const breachObj = {
            kelas: k,
            roomName: e.roomName || "Ruangan",
            tanggal: e.tanggal,
            parameter: p.short,
            value: displayValue(val, k, p.key),
            level: st.originalLevel,
            resolved: st.resolved,
            resample: st.resample,
            openResample: st.openResample,
            paramKey: p.key,
          };
          breachesInClass.push(breachObj);
          allBreaches.push(breachObj);
        }
      });
    });

    const sections = [KELAS_INTRO[k] || `Kelas ${k} merupakan salah satu area pemantauan lingkungan pada fasilitas ini.`];

    PARAM_DEFS.forEach((p) => {
      const text = paramNarrative(p.key, p.short, k, kelasEntries, entries || []);
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
    const hasDeviation = allBreaches.some((b) => b.level >= 4);
    const hasAlertAction = allBreaches.length > 0;
    // Hanya temuan OOT ke atas yang wajib ditindaklanjuti dengan sampling ulang.
    const perluTindakLanjut = allBreaches.filter((b) => b.level >= RESAMPLE_LEVEL);
    const hasOOT = perluTindakLanjut.length > 0;
    const semuaSudahDiujiUlang = hasOOT && perluTindakLanjut.every((b) => b.resolved);

    const intro = `Berdasarkan evaluasi trend data Environment Monitoring (EM) Viable periode ${monthLabel} pada fasilitas ${facilityLabel}, dapat disimpulkan bahwa kondisi lingkungan produksi pada seluruh kelas ruangan (${classes.map((k) => `Kelas ${k}`).join(", ")}) ${
      !hasAlertAction
        ? "berada dalam keadaan terkendali dan memenuhi persyaratan Standar CPOB yang berlaku."
        : hasDeviation
          ? semuaSudahDiujiUlang
            ? "sempat memiliki satu atau lebih titik yang melampaui batas persyaratan (penyimpangan), yang seluruhnya telah ditindaklanjuti melalui investigasi, perbaikan, dan pengambilan sampel ulang dengan hasil kembali memenuhi syarat."
            : "memiliki satu atau lebih titik yang melampaui batas persyaratan sehingga dinyatakan tidak memenuhi syarat (TMS) dan dikategorikan sebagai penyimpangan yang memerlukan penanganan."
          : hasOOT
            ? semuaSudahDiujiUlang
              ? "masih berada dalam keadaan terkendali dan memenuhi persyaratan (spesifikasi) yang ditetapkan, dengan beberapa hasil yang melampaui Action Limit (Out of Trend/OOT) yang seluruhnya telah ditindaklanjuti melalui pengambilan sampel ulang dengan hasil memenuhi syarat."
              : "masih berada dalam keadaan terkendali dan memenuhi persyaratan (spesifikasi) yang ditetapkan, dengan beberapa hasil yang melampaui Action Limit sehingga dikategorikan sebagai Out of Trend (OOT) dan perlu ditindaklanjuti dengan pengambilan sampel ulang."
            : "berada dalam keadaan terkendali dan memenuhi persyaratan (spesifikasi) yang ditetapkan, dengan beberapa hasil yang mencapai Alert Limit namun masih di bawah Action Limit sehingga tergolong aman."
    }`;

    const perClassRecap = classSummaries.map(({ kelas: k, breaches }) => {
      if (breaches.length === 0) {
        return `Pada Kelas ${k}, seluruh parameter monitoring memenuhi persyaratan tanpa adanya hasil yang mencapai Alert maupun Action Limit.`;
      }
      const rooms = Array.from(new Set(breaches.map((b) => b.roomName))).slice(0, 3).join(", ");
      const classHasDeviation = breaches.some((b) => b.level >= 4);
      const classHasOOT = breaches.some((b) => b.level === 3);
      if (classHasDeviation) {
        return `Pada Kelas ${k}, terdapat hasil pada area ${rooms} yang melampaui batas persyaratan sehingga dinyatakan tidak memenuhi syarat (TMS) dan dikategorikan sebagai penyimpangan.`;
      }
      if (classHasOOT) {
        return `Pada Kelas ${k}, terdapat hasil pada area ${rooms} yang melampaui Action Limit sehingga dikategorikan sebagai Out of Trend (OOT), namun masih berada di bawah batas Syarat sehingga bukan penyimpangan.`;
      }
      return `Pada Kelas ${k}, terdapat hasil pada area ${rooms} yang mencapai Alert Limit namun masih di bawah Action Limit sehingga kondisinya tergolong aman.`;
    });

    const closing = !hasAlertAction
      ? `Secara keseluruhan, variasi hasil yang diperoleh masih mencerminkan kondisi operasional normal dan tidak menunjukkan adanya kecenderungan peningkatan cemaran mikrobiologi yang signifikan. Dengan demikian, program Environment Monitoring (EM) Viable periode ${monthLabel} masih efektif dalam memantau dan mengendalikan kondisi lingkungan produksi sehingga tetap mendukung proses pembuatan produk sesuai persyaratan mutu dan Standar CPOB tahun 2024 dan 2025 yang berlaku.`
      : semuaSudahDiujiUlang
        ? `Secara keseluruhan, seluruh hasil yang berada di luar batas kendali pada periode ini telah ditindaklanjuti dengan pengambilan sampel ulang dalam waktu sesegera mungkin, dan hasilnya kembali memenuhi syarat. Dengan demikian, kondisi lingkungan fasilitas ${facilityLabel} dinilai telah kembali terkendali dan program Environment Monitoring (EM) Viable periode ${monthLabel} tetap efektif dalam memantau serta mengendalikan kondisi lingkungan produksi sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`
      : hasDeviation
        ? `Secara keseluruhan, titik yang dinyatakan tidak memenuhi syarat (TMS) memerlukan penghentian proses sementara pada area terkait, investigasi beserta tindakan perbaikan, dan pengambilan sampel ulang sampai diperoleh hasil yang memenuhi syarat. Fasilitas ${facilityLabel} tetap dapat digunakan dengan catatan penanganan tersebut dituntaskan sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`
      : hasOOT
        ? `Secara keseluruhan, hasil yang melampaui Action Limit pada periode ini masih berada dalam batas persyaratan (spesifikasi) sehingga dikategorikan sebagai Out of Trend (OOT) dan bukan penyimpangan. Penanganannya berupa pengambilan sampel ulang segera pada titik terkait beserta investigasi ringan bila diperlukan, serta peninjauan efektivitas sanitasi dan higiene personel pada area tersebut. Dengan demikian, program Environment Monitoring (EM) Viable periode ${monthLabel} tetap dinilai efektif dalam memantau dan mengendalikan kondisi lingkungan produksi sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`
        : `Secara keseluruhan, hasil yang mencapai Alert Limit pada periode ini masih berada di bawah Action Limit sehingga kondisinya tergolong aman dan cukup dipantau pada periode berikutnya. Dengan demikian, program Environment Monitoring (EM) Viable periode ${monthLabel} tetap dinilai efektif dalam memantau dan mengendalikan kondisi lingkungan produksi sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`;

    kesimpulanUmum = [intro, ...perClassRecap, closing].join("\n\n");
  }

  return { perKelas, kesimpulanUmum };
}
