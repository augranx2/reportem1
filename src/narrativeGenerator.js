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

  const breachPoints = points.filter((p) => getStatusLevel(p.raw, paramKey, kelas) >= 2);

  let text = `Hasil monitoring ${paramShort.toLowerCase()} menunjukkan nilai tertinggi pada ${topStr}. `;

  if (breachPoints.length === 0) {
    text += `Seluruh hasil masih berada di bawah Alert Limit (${limit.alert} CFU) dan Action Limit (${limit.action} CFU), sehingga kondisi lingkungan untuk parameter ini masih memenuhi persyaratan yang ditetapkan.`;
  } else {
    const highestLevel = Math.max(...breachPoints.map((p) => getStatusLevel(p.raw, paramKey, kelas)));
    const uniqueDates = new Set(breachPoints.map((p) => p.tanggal));
    const recurring = uniqueDates.size > 1;

    if (highestLevel >= 4) {
      text += `Nilai tersebut telah melampaui batas Syarat (spesifikasi) yang ditetapkan (Alert Limit ${limit.alert} CFU, Action Limit ${limit.action} CFU, Syarat ${limit.lessThan ? "< 1" : limit.syarat} CFU), sehingga dikategorikan sebagai penyimpangan. `;
      text += recurring
        ? "Kejadian ini terjadi pada lebih dari satu tanggal pengujian sehingga memerlukan investigasi lebih lanjut dan tindak lanjut segera."
        : "Kejadian ini perlu segera ditindaklanjuti dengan investigasi dan pengujian ulang (re-sampling) pada titik terkait.";
    } else {
      const levelPhrase = highestLevel >= 3 ? "mencapai Action Limit" : "mencapai Alert Limit";
      text += `Nilai tersebut ${levelPhrase} (Alert Limit ${limit.alert} CFU, Action Limit ${limit.action} CFU), namun masih berada di bawah batas Syarat (spesifikasi) sehingga belum dikategorikan sebagai penyimpangan. `;
      text += recurring
        ? "Kejadian ini tercatat pada lebih dari satu tanggal pengujian, sehingga perlu dievaluasi pada hasil pengujian periode berikutnya apakah nilainya masih tetap tinggi atau sudah menunjukkan perbaikan, termasuk meninjau kembali efektivitas sanitasi/higiene pada area terkait."
        : "Kejadian ini hanya terjadi pada satu kali pengujian, dan dapat dievaluasi lebih lanjut pada hasil pengujian periode berikutnya untuk memastikan tidak berulang.";
    }
  }
  return text;
}

// Narasi tindak lanjut: menyebutkan uji ulang yang sudah dilakukan beserta
// hasilnya. Ini bagian yang menjadi bukti saat inspeksi bahwa setiap hasil di
// luar batas sudah ditindaklanjuti, bukan sekadar dicatat.
function resamplingNarrative(breachesInClass, kelas) {
  if (breachesInClass.length === 0) return null;
  const selesai = breachesInClass.filter((b) => b.resolved);
  const masihTerbuka = breachesInClass.filter((b) => b.openResample && !b.resolved);
  const belumDiuji = breachesInClass.filter((b) => !b.resolved && !b.openResample);
  const kalimat = [];

  if (selesai.length > 0) {
    const rincian = selesai
      .map(
        (b) =>
          `${b.parameter} pada area ${b.roomName} tanggal ${fullDateID(b.tanggal)} (${b.value}) telah diuji ulang pada tanggal ${fullDateID(b.resample.tanggal)} dengan hasil ${displayValue(b.resample[b.paramKey], kelas, b.paramKey)}`
      )
      .join("; ");
    kalimat.push(
      `Terhadap hasil yang berada di luar batas kendali telah dilakukan pengambilan sampel ulang (re-sampling), yaitu ${rincian}. Seluruh hasil uji ulang tersebut telah kembali memenuhi persyaratan sehingga penyimpangan dinyatakan telah ditindaklanjuti dan ditutup.`
    );
  }
  if (masihTerbuka.length > 0) {
    const rincian = masihTerbuka
      .map((b) => `${b.parameter} pada area ${b.roomName} tanggal ${fullDateID(b.tanggal)}`)
      .join("; ");
    kalimat.push(
      `Uji ulang telah dilakukan pada ${rincian}, namun hasilnya masih berada di luar batas kendali sehingga diperlukan investigasi lanjutan beserta tindakan perbaikan dan pencegahan (CAPA).`
    );
  }
  if (belumDiuji.length > 0) {
    const rincian = belumDiuji
      .map((b) => `${b.parameter} pada area ${b.roomName} tanggal ${fullDateID(b.tanggal)}`)
      .join("; ");
    kalimat.push(
      `Hasil pada ${rincian} belum disertai pencatatan hasil uji ulang sehingga perlu segera ditindaklanjuti.`
    );
  }
  return kalimat.join(" ");
}

function classConclusion(kelas, breachesInClass) {
  if (breachesInClass.length === 0) {
    return `Lingkungan Kelas ${kelas} berada dalam kondisi terkendali. Seluruh parameter monitoring memenuhi persyaratan yang ditetapkan tanpa adanya hasil yang mencapai Alert maupun Action Limit.`;
  }
  const highestLevel = Math.max(...breachesInClass.map((b) => b.level));
  if (highestLevel >= 4) {
    return `Lingkungan Kelas ${kelas} terdapat titik yang melampaui batas persyaratan (spesifikasi) yang ditetapkan, sehingga dikategorikan sebagai penyimpangan. Diperlukan investigasi lebih lanjut dan pengujian ulang (re-sampling) untuk memastikan kondisi lingkungan kembali terkendali.`;
  }
  return `Lingkungan Kelas ${kelas} masih berada dalam kondisi terkendali dan memenuhi persyaratan (spesifikasi) yang ditetapkan. Terdapat beberapa hasil yang mencapai Alert maupun Action Limit, namun karena masih di bawah batas Syarat, hal ini belum dikategorikan sebagai penyimpangan — cukup dievaluasi pada hasil pengujian periode berikutnya untuk memastikan tidak ada peningkatan berkelanjutan.`;
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
      const text = paramNarrative(p.key, p.short, k, kelasEntries);
      if (text) sections.push(`Hasil dan Tren ${p.short}\n${text}`);
    });

    const tindakLanjutText = resamplingNarrative(breachesInClass, k);
    if (tindakLanjutText) sections.push(`Tindak Lanjut dan Uji Ulang\n${tindakLanjutText}`);

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
    // Semua temuan sudah ditutup oleh uji ulang yang hasilnya memenuhi syarat?
    const semuaSudahDiujiUlang = hasAlertAction && allBreaches.every((b) => b.resolved);

    const intro = `Berdasarkan evaluasi trend data Environment Monitoring (EM) Viable periode ${monthLabel} pada fasilitas ${facilityLabel}, dapat disimpulkan bahwa kondisi lingkungan produksi pada seluruh kelas ruangan (${classes.map((k) => `Kelas ${k}`).join(", ")}) ${
      !hasAlertAction
        ? "berada dalam keadaan terkendali dan memenuhi persyaratan Standar CPOB yang berlaku."
        : hasDeviation
          ? semuaSudahDiujiUlang
            ? "secara umum masih berada dalam keadaan terkendali, dengan satu atau lebih titik yang melampaui batas persyaratan (penyimpangan) yang seluruhnya telah ditindaklanjuti melalui pengambilan sampel ulang (re-sampling) dengan hasil memenuhi persyaratan."
            : "secara umum masih berada dalam keadaan terkendali, dengan satu atau lebih titik yang melampaui batas persyaratan (penyimpangan) dan memerlukan tindak lanjut."
          : "secara umum masih berada dalam keadaan terkendali dan memenuhi persyaratan (spesifikasi) yang ditetapkan, dengan beberapa hasil yang mencapai Alert/Action Limit namun belum dikategorikan sebagai penyimpangan."
    }`;

    const perClassRecap = classSummaries.map(({ kelas: k, breaches }) => {
      if (breaches.length === 0) {
        return `Pada Kelas ${k}, seluruh parameter monitoring memenuhi persyaratan tanpa adanya hasil yang mencapai Alert maupun Action Limit.`;
      }
      const rooms = Array.from(new Set(breaches.map((b) => b.roomName))).slice(0, 3).join(", ");
      const classHasDeviation = breaches.some((b) => b.level >= 4);
      return classHasDeviation
        ? `Pada Kelas ${k}, terdapat hasil pada area ${rooms} yang melampaui batas persyaratan (penyimpangan).`
        : `Pada Kelas ${k}, terdapat hasil pada area ${rooms} yang mencapai Alert/Action Limit, namun masih di bawah batas Syarat sehingga belum dikategorikan sebagai penyimpangan.`;
    });

    const closing = !hasAlertAction
      ? `Secara keseluruhan, variasi hasil yang diperoleh masih mencerminkan kondisi operasional normal dan tidak menunjukkan adanya kecenderungan peningkatan cemaran mikrobiologi yang signifikan. Dengan demikian, program Environment Monitoring (EM) Viable periode ${monthLabel} masih efektif dalam memantau dan mengendalikan kondisi lingkungan produksi sehingga tetap mendukung proses pembuatan produk sesuai persyaratan mutu dan Standar CPOB tahun 2024 dan 2025 yang berlaku.`
      : semuaSudahDiujiUlang
        ? `Secara keseluruhan, seluruh hasil yang berada di luar batas kendali pada periode ini telah ditindaklanjuti melalui pengambilan sampel ulang (re-sampling) dalam waktu sesegera mungkin, dan hasil uji ulang menunjukkan nilai yang kembali memenuhi persyaratan. Dengan demikian, kondisi lingkungan fasilitas ${facilityLabel} dinilai telah kembali terkendali dan program Environment Monitoring (EM) Viable periode ${monthLabel} tetap efektif dalam memantau serta mengendalikan kondisi lingkungan produksi sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`
      : hasDeviation
        ? `Secara keseluruhan, diperlukan tindak lanjut berupa investigasi dan pengujian ulang (re-sampling) pada titik-titik yang mengalami penyimpangan. Fasilitas ${facilityLabel} tetap dapat digunakan dengan catatan dilakukan penanganan hingga diperoleh hasil yang terkendali secara konsisten sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`
        : `Secara keseluruhan, hasil yang mencapai Alert/Action Limit pada periode ini masih berada dalam batas persyaratan (spesifikasi) sehingga belum dikategorikan sebagai penyimpangan. Disarankan untuk mengevaluasi hasil pengujian pada periode berikutnya guna memastikan nilai tersebut sudah menurun/membaik atau masih menunjukkan tren yang sama, termasuk meninjau efektivitas sanitasi dan higiene personel pada area terkait. Dengan demikian, program Environment Monitoring (EM) Viable periode ${monthLabel} tetap dinilai efektif dalam memantau dan mengendalikan kondisi lingkungan produksi sesuai Standar CPOB tahun 2024 dan 2025 yang berlaku.`;

    kesimpulanUmum = [intro, ...perClassRecap, closing].join("\n\n");
  }

  return { perKelas, kesimpulanUmum };
}
