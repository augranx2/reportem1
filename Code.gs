/**
 * @OnlyCurrentDoc
 */
/**
 * EM VIABLE — Google Apps Script backend
 * PT. Rama Emerald Multi Sukses — QA
 *
 * Tempel seluruh isi file ini ke Apps Script (Extensions > Apps Script)
 * yang menempel pada Google Sheet "EM Viable - Data QA REMS".
 *
 * Setelah ditempel: Deploy > Manage deployments > edit (pensil) > pilih
 * "New version" > Deploy. (Kalau ini deployment pertama kali: Deploy >
 * New deployment > Web app, Execute as: Me, Who has access: Anyone.)
 * Lalu salin URL yang dihasilkan (diakhiri /exec) untuk dipakai di website.
 *
 * Tab yang dibutuhkan di spreadsheet ini (selain tab data fasilitas & Laporan_Narasi):
 *   User_Roles : Nama | Role | Departemen | Username | PasswordBaru | PasswordHash | Salt
 *   Sessions   : Token | Username | Nama | Role | Departemen | LoginAt | ExpiresAt
 *   Audit_Log  : Waktu | Username | Nama | Role | Departemen | Aksi | Fasilitas | Bulan | Detail
 *
 * Cara pakai User_Roles: isi Nama/Role/Departemen/Username seperti biasa.
 * Kolom Role diisi salah satu dari: Staff, Supervisor, Manager, Assistant Manager,
 * Administrator, Tamu. "Assistant Manager" punya hak persis sama seperti Manager
 * (di departemen yang sama). "Administrator" punya akses penuh ke semua fitur
 * dan lintas departemen (QC maupun QA), berapa pun isi kolom Departemen-nya.
 * "Tamu" adalah level akses terendah yang tetap login: boleh melihat data hasil
 * pengujian LENGKAP dengan grafik dan pembahasan/pengkajian QA (beda dari publik
 * tanpa login yang cuma melihat data hasil pengujian saja), tapi tidak boleh
 * input/edit/hapus/approve apa pun, dan tidak bisa melihat Formulir QC
 * (FM.QC.062). Kolom Departemen untuk akun Tamu boleh dikosongkan.
 * Untuk set/reset password seseorang, ketik password barunya (teks biasa)
 * di kolom PasswordBaru baris orang itu — begitu ada orang login (siapa
 * saja), sistem otomatis mengubahnya jadi PasswordHash+Salt lalu
 * mengosongkan lagi kolom PasswordBaru (supaya password asli tidak pernah
 * tersimpan sebagai teks biasa).
 *
 * ALUR KERJA & PENGUNCIAN DATA (revisi terbaru):
 * 1. Formulir QC (FM.QC.062, tab Report_EM) hanya bisa DILIHAT oleh akun
 *    QC, QA, atau Administrator yang sudah login (publik/tanpa-login dan
 *    Tamu tidak bisa melihat halaman ini sama sekali).
 * 2. QA (siapa pun level-nya) boleh MELIHAT dan MENCETAK Formulir QC, tapi
 *    tidak pernah bisa mengisi atau approve/acc — itu tetap khusus QC.
 * 3. QA baru boleh MEMBUAT Pengkajian EM (tab Laporan_Narasi) untuk suatu
 *    bulan setelah SEMUA Formulir QC bulan itu (satu per tanggal input
 *    data) sudah final di-acc/di-Diperiksa oleh Supervisor/Manager QC.
 * 4. Selama Formulir QC bulan itu belum final acc QC, QA (Supervisor ke
 *    atas) tetap boleh bantu input/hapus data mentah. Begitu Manager/
 *    Supervisor QC sudah approve Formulir QC (dianggap data selesai), QA
 *    tidak bisa lagi mengedit/menghapus data mentah bulan itu (QC tetap
 *    bisa).
 * 5. Begitu Pengkajian EM suatu bulan sudah DIBUAT (baris tersimpan di
 *    Laporan_Narasi), data mentah maupun Formulir QC bulan itu terkunci
 *    total dari edit/hapus untuk SIAPA PUN kecuali Administrator. Narasi
 *    Pengkajian EM sendiri tetap bisa disunting Supervisor/Manager QA
 *    sampai di-approve final ("Mengetahui").
 */

// ---------------------------------------------------------------------------
// KONFIGURASI: nama tab di spreadsheet untuk tiap fasilitas
// ---------------------------------------------------------------------------
const FACILITIES = {
  nbl: { label: "NBL", masterSheet: "NBL", dataSheet: "NBL_Data" },
  betalaktam: { label: "Betalaktam", masterSheet: "Betalaktam", dataSheet: "Betalaktam_Data" },
  sefaNonSteril: { label: "Sefalosporin Non Steril", masterSheet: "Sefa Non Steril", dataSheet: "SefaNonSteril_Data" },
  sefaSteril: { label: "Sefalosporin Steril", masterSheet: "Sefa Steril", dataSheet: "SefaSteril_Data" },
  labMikro: { label: "Lab Mikrobiologi", masterSheet: "Lab Mikrobiologi", dataSheet: "LabMikro_Data" },
};

const NARRATIVE_SHEET = "Laporan_Narasi";
const CLASS_ORDER = ["E", "D", "C", "B", "A"];

// Tabel Persyaratan / Alert / Action (QA.FM.156) — sama dengan yang di website
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

// ---------------------------------------------------------------------------
// KONFIGURASI: AUTH / ROLE / AUDIT
// ---------------------------------------------------------------------------
const USER_ROLES_SHEET = "User_Roles";
const SESSIONS_SHEET = "Sessions";
const AUDIT_LOG_SHEET = "Audit_Log";
const REPORT_EM_SHEET = "Report_EM";
// Nomor formulir "Report Hasil EM" fisik (FM.QC.062) yang didigitalkan.
// Ubah di sini kalau nanti ada revisi berikutnya (R4, dst).
const REPORT_EM_FORM_NO = "FM.QC.062/R3";
const REPORT_EM_PREV_FORM_NO = "FM.QC.062/R2";
const REPORT_EM_PREV_TGL_BERLAKU = "27 September 2022";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 jam
// Tamu sengaja di level 0 (paling rendah): tetap "login" (dapat token session
// yang valid) supaya bisa dibedakan dari publik tanpa login, tapi levelnya di
// bawah Staff jadi otomatis gagal di semua requireRole_() yang minta akses
// input/edit/approve.
const ROLE_LEVEL = { Tamu: 0, Staff: 1, Supervisor: 2, Manager: 3, "Assistant Manager": 3, Administrator: 4 };

// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;
    switch (action) {
      case "master":
        result = getMaster_(e.parameter.facility);
        break;
      case "entries":
        result = getEntries_(e.parameter.facility, e.parameter.month);
        break;
      case "report":
        result = getReportForViewer_(e.parameter.facility, e.parameter.month, e.parameter.token);
        break;
      case "statusIndex":
        result = getStatusIndex_(e.parameter.month);
        break;
      case "whoami":
        result = whoami_(e.parameter.token);
        break;
      case "activityLog":
        result = getActivityLog_(e.parameter.token, e.parameter.month, e.parameter.facility);
        break;
      case "reportEM":
        result = getReportEMForViewer_(e.parameter.facility, e.parameter.tanggal, e.parameter.token);
        break;
      case "verify":
        // Halaman /verify (dibuka lewat scan QR) HARUS tetap bisa diakses
        // publik tanpa login — makanya action ini terpisah dari "report" /
        // "reportEM" di atas dan cuma mengembalikan info tanda tangan
        // (bukan isi narasi/pembahasan lengkap).
        result = e.parameter.type === "report"
          ? getVerifySignoffReportEM_(e.parameter.facility, e.parameter.tanggal)
          : getVerifySignoffPengkajian_(e.parameter.facility, e.parameter.month);
        break;
      default:
        result = { error: "Aksi tidak dikenal: " + action };
    }
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;
    switch (body.action) {
      case "login":
        result = login_(body.username, body.password);
        break;
      case "logout":
        result = logout_(body.token);
        break;
      case "saveEntries":
        result = withAuth_(body.token, function (session) {
          return saveEntriesAuthed_(session, body.facility, body.month, body.entries || []);
        });
        break;
      case "saveReport":
        result = withAuth_(body.token, function (session) {
          return saveReportAuthed_(session, body.facility, body.month, body.narrative || {});
        });
        break;
      case "approveDikaji":
        result = withAuth_(body.token, function (session) {
          return approveDikajiAuthed_(session, body.facility, body.month);
        });
        break;
      case "approveMengetahui":
        result = withAuth_(body.token, function (session) {
          return approveMengetahuiAuthed_(session, body.facility, body.month);
        });
        break;
      case "saveReportEM":
        result = withAuth_(body.token, function (session) {
          return saveReportEMAuthed_(session, body.facility, body.tanggal, body.noKontrolMedia, body.tanggalPembacaan);
        });
        break;
      case "approveReportEM":
        result = withAuth_(body.token, function (session) {
          return approveReportEMAuthed_(session, body.facility, body.tanggal);
        });
        break;
      default:
        result = { error: "Aksi tidak dikenal: " + body.action };
    }
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function withAuth_(token, fn) {
  const session = validateSession_(token);
  if (!session) return { error: "Sesi tidak valid atau sudah habis, silakan login ulang." };
  try {
    return fn(session);
  } catch (err) {
    return { error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// AUTH: LOGIN / LOGOUT / SESSION
// ---------------------------------------------------------------------------

function randomHex_(numBytes) {
  const chars = [];
  for (let i = 0; i < numBytes; i++) {
    chars.push(("0" + Math.floor(Math.random() * 256).toString(16)).slice(-2));
  }
  return chars.join("");
}

function generateSalt_() {
  return randomHex_(16);
}

function generateToken_() {
  return Utilities.getUuid().replace(/-/g, "") + randomHex_(8);
}

function hashPassword_(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password) + "::" + String(salt)
  );
  return digest
    .map(function (b) {
      return ("0" + (b & 0xff).toString(16)).slice(-2);
    })
    .join("");
}

function getUserRolesSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_ROLES_SHEET);
  if (!sheet) throw new Error("Tab '" + USER_ROLES_SHEET + "' tidak ditemukan.");
  return sheet;
}

// Kolom User_Roles (posisi tetap): A Nama | B Role | C Departemen | D Username
// | E PasswordBaru | F PasswordHash | G Salt
function migratePasswords_() {
  const sheet = getUserRolesSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = range.getValues();
  let changed = false;
  for (let i = 0; i < values.length; i++) {
    const passwordBaru = values[i][4];
    if (passwordBaru !== "" && passwordBaru !== null && passwordBaru !== undefined) {
      const salt = generateSalt_();
      const hash = hashPassword_(String(passwordBaru), salt);
      values[i][4] = ""; // kosongkan PasswordBaru
      values[i][5] = hash; // PasswordHash
      values[i][6] = salt; // Salt
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

function findUserByUsername_(username) {
  const sheet = getUserRolesSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const target = String(username || "").trim().toLowerCase();
  if (!target) return null;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const uname = String(row[3] || "").trim().toLowerCase();
    if (uname && uname === target) {
      return {
        nama: row[0],
        role: String(row[1] || "").trim(),
        departemen: String(row[2] || "").trim(),
        username: row[3],
        passwordHash: row[5],
        salt: row[6],
      };
    }
  }
  return null;
}

function login_(username, password) {
  if (!username || !password) return { error: "Username dan password wajib diisi." };
  migratePasswords_();
  const user = findUserByUsername_(username);
  if (!user || !user.passwordHash) return { error: "Username atau password salah." };
  const hash = hashPassword_(password, user.salt);
  if (hash !== user.passwordHash) return { error: "Username atau password salah." };
  if (!ROLE_LEVEL[user.role]) return { error: "Role akun ini belum diatur dengan benar. Hubungi Manager." };

  const token = generateToken_();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const sessSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SESSIONS_SHEET);
  if (!sessSheet) return { error: "Tab '" + SESSIONS_SHEET + "' tidak ditemukan." };
  sessSheet.appendRow([token, user.username, user.nama, user.role, user.departemen, now, expiresAt]);

  writeAuditLog_({
    username: user.username, nama: user.nama, role: user.role, departemen: user.departemen,
    aksi: "Login", fasilitas: "", bulan: "", detail: "",
  });

  return { ok: true, token: token, nama: user.nama, role: user.role, departemen: user.departemen, username: user.username };
}

function logout_(token) {
  if (!token) return { ok: true };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SESSIONS_SHEET);
  if (!sheet) return { ok: true };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true };
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(token)) {
      const row = values[i];
      writeAuditLog_({
        username: row[1], nama: row[2], role: row[3], departemen: row[4],
        aksi: "Logout", fasilitas: "", bulan: "", detail: "",
      });
      sheet.deleteRow(i + 2);
    }
  }
  return { ok: true };
}

// Sessions kolom: A Token | B Username | C Nama | D Role | E Departemen | F LoginAt | G ExpiresAt
function validateSession_(token) {
  if (!token) return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SESSIONS_SHEET);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const now = new Date();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[0]) === String(token)) {
      const expiresAt = new Date(row[6]);
      if (isNaN(expiresAt.getTime()) || now.getTime() > expiresAt.getTime()) {
        sheet.deleteRow(i + 2);
        return null;
      }
      return {
        token: row[0], username: row[1], nama: row[2],
        role: String(row[3] || "").trim(), departemen: String(row[4] || "").trim(),
      };
    }
  }
  return null;
}

function whoami_(token) {
  const session = validateSession_(token);
  if (!session) return { error: "invalid" };
  return { ok: true, nama: session.nama, role: session.role, departemen: session.departemen, username: session.username };
}

function requireRole_(session, minRole, departemen) {
  if (session.role === "Administrator") return true; // akses penuh, lintas departemen
  const level = ROLE_LEVEL[session.role] || 0;
  const minLevel = ROLE_LEVEL[minRole] || 99;
  if (level < minLevel) return false;
  if (departemen && session.departemen !== departemen) return false;
  return true;
}

// ---------------------------------------------------------------------------
// AUDIT LOG
// ---------------------------------------------------------------------------
// Kolom: A Waktu | B Username | C Nama | D Role | E Departemen | F Aksi | G Fasilitas | H Bulan | I Detail
function writeAuditLog_(entry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_LOG_SHEET);
  if (!sheet) return; // jangan sampai proses utama gagal cuma karena log gagal
  sheet.appendRow([
    new Date(), entry.username || "", entry.nama || "", entry.role || "", entry.departemen || "",
    entry.aksi || "", entry.fasilitas || "", entry.bulan || "", entry.detail || "",
  ]);
}

function getActivityLog_(token, month, facilityLabel) {
  const session = validateSession_(token);
  if (!session) return { error: "Sesi tidak valid atau sudah habis, silakan login ulang." };
  if (!requireRole_(session, "Supervisor")) {
    return { error: "Hanya Supervisor/Manager yang boleh melihat Riwayat Aktivitas." };
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_LOG_SHEET);
  if (!sheet) return { logs: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { logs: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  let logs = values.map(function (row) {
    return {
      waktu: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      username: row[1], nama: row[2], role: row[3], departemen: row[4],
      aksi: row[5], fasilitas: row[6], bulan: row[7], detail: row[8],
    };
  });
  if (month) logs = logs.filter(function (l) { return l.bulan === month; });
  if (facilityLabel) logs = logs.filter(function (l) { return l.fasilitas === facilityLabel; });
  logs.sort(function (a, b) { return new Date(b.waktu) - new Date(a.waktu); });
  return { logs: logs.slice(0, 300) };
}

// ---------------------------------------------------------------------------
// AKSI TERPROTEKSI (butuh login) — pembungkus di atas fungsi data asli
// ---------------------------------------------------------------------------

function saveEntriesAuthed_(session, facilityKey, month, entries) {
  // QC (Staff ke atas) boleh input rutin. QA (Supervisor ke atas) juga boleh
  // input/koreksi — untuk kebutuhan intervensi saat mengkaji data yang salah.
  const isQCInput = requireRole_(session, "Staff", "QC");
  const isQAInput = requireRole_(session, "Supervisor", "QA");
  if (!isQCInput && !isQAInput) {
    return { error: "Hanya Staff/Supervisor/Manager QC, atau Supervisor/Manager QA, yang boleh mengisi data pengujian." };
  }
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };

  if (session.role !== "Administrator") {
    // Kunci total: kalau Pengkajian EM bulan ini sudah dibuat, data mentah
    // tidak bisa diubah/dihapus siapa pun kecuali Administrator.
    if (getReport_(facilityKey, month).found) {
      return { error: "Pengkajian EM bulan ini sudah dibuat — data mentah terkunci. Hubungi Administrator kalau perlu perubahan." };
    }
    // Kunci parsial: begitu Formulir QC bulan ini sudah final di-acc
    // Supervisor/Manager QC, QA tidak boleh lagi input/hapus data (QC tetap
    // boleh selama Pengkajian belum dibuat, dicek di atas).
    if (!isQCInput && isFormulirQCCompleteForMonth_(facilityKey, month)) {
      return { error: "Formulir QC bulan ini sudah final disetujui QC — QA tidak bisa lagi mengubah/menghapus data. Hubungi QC." };
    }
  }

  // Deteksi penghapusan: baris LAMA (id "row-N") yang hilang dari daftar baru.
  const before = getEntries_(facilityKey, month).entries || [];
  const submittedIds = {};
  entries.forEach(function (e) { submittedIds[e.id] = true; });
  const deletedRows = before.filter(function (e) { return !submittedIds[e.id]; });
  const canDelete = requireRole_(session, "Supervisor", "QC") || requireRole_(session, "Supervisor", "QA");
  if (deletedRows.length > 0 && !canDelete) {
    return { error: "Staff tidak bisa menghapus data yang sudah tersimpan. Hubungi Supervisor/Manager QC atau QA untuk menghapus baris." };
  }

  const result = saveEntries_(facilityKey, month, entries);
  writeAuditLog_({
    username: session.username, nama: session.nama, role: session.role, departemen: session.departemen,
    aksi: deletedRows.length > 0 ? "Hapus/Ubah Data" : "Simpan Data",
    fasilitas: cfg.label, bulan: month,
    detail: entries.length + " baris tersimpan" + (deletedRows.length > 0 ? ", " + deletedRows.length + " baris dihapus" : ""),
  });
  return result;
}

function emptySignoffServer_() {
  return { dinilai: { nama: "", jabatan: "", tanggal: "" }, diperiksa: { nama: "", jabatan: "", tanggal: "" } };
}

function saveReportAuthed_(session, facilityKey, month, narrative) {
  if (!requireRole_(session, "Supervisor", "QA")) {
    return { error: "Hanya Supervisor/Manager QA yang boleh menyusun Pengkajian EM." };
  }
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const existing = getReport_(facilityKey, month);
  // Pengkajian EM baru (belum ada baris tersimpan): hanya boleh MULAI dibuat
  // setelah Formulir QC bulan ini selesai/final di-acc QC. Kalau sudah ada
  // (sedang menyempurnakan draf), boleh terus disunting seperti biasa.
  if (!existing.found && session.role !== "Administrator" && !isFormulirQCCompleteForMonth_(facilityKey, month)) {
    return { error: "Formulir QC (FM.QC.062) bulan ini belum lengkap/final di-acc Supervisor/Manager QC. Pengkajian EM baru bisa dibuat setelah Formulir QC selesai." };
  }
  const signoff = (existing && existing.signoff) || emptySignoffServer_();
  const result = saveReport_(facilityKey, month, narrative, signoff);
  writeAuditLog_({
    username: session.username, nama: session.nama, role: session.role, departemen: session.departemen,
    aksi: "Susun Pengkajian EM", fasilitas: cfg.label, bulan: month, detail: "",
  });
  return result;
}

function approveDikajiAuthed_(session, facilityKey, month) {
  if (!requireRole_(session, "Supervisor", "QA")) {
    return { error: "Hanya Supervisor/Manager QA yang boleh menyetujui 'Dikaji Oleh'." };
  }
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const existing = getReport_(facilityKey, month);
  if (!existing.found) return { error: "Belum ada draf Pengkajian EM untuk bulan ini, isi dulu narasinya." };
  const signoff = existing.signoff || emptySignoffServer_();
  signoff.dinilai = { nama: session.nama, jabatan: session.role + " QA", tanggal: formatDate_(new Date()) };
  const result = saveReport_(facilityKey, month, existing.narrative, signoff);
  writeAuditLog_({
    username: session.username, nama: session.nama, role: session.role, departemen: session.departemen,
    aksi: "Approve Dikaji Oleh", fasilitas: cfg.label, bulan: month, detail: "",
  });
  return result;
}

function approveMengetahuiAuthed_(session, facilityKey, month) {
  if (!requireRole_(session, "Manager", "QA")) {
    return { error: "Hanya Manager QA (atau yang mewakili) yang boleh menyetujui final 'Mengetahui'." };
  }
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const existing = getReport_(facilityKey, month);
  if (!existing.found) return { error: "Belum ada draf Pengkajian EM untuk bulan ini." };
  if (!existing.signoff || !existing.signoff.dinilai || !existing.signoff.dinilai.nama) {
    return { error: "Pengkajian ini belum di-approve 'Dikaji Oleh', tidak bisa langsung final." };
  }
  const signoff = existing.signoff;
  signoff.diperiksa = { nama: session.nama, jabatan: "Manager QA", tanggal: formatDate_(new Date()) };
  const result = saveReport_(facilityKey, month, existing.narrative, signoff);
  writeAuditLog_({
    username: session.username, nama: session.nama, role: session.role, departemen: session.departemen,
    aksi: "Approve Final (Mengetahui)", fasilitas: cfg.label, bulan: month, detail: "",
  });
  return result;
}

// ---------------------------------------------------------------------------
// REPORT HASIL EM (form fisik FM.QC.062 yang didigitalkan) — tab "Report_EM"
// Kolom: A Fasilitas | B TanggalPemeriksaan | C NoKontrolMedia | D TanggalPembacaan
// | E NoFormulir | F AnalisNama | G AnalisUsername | H AnalisTanggal
// | I DiperiksaNama | J DiperiksaUsername | K DiperiksaTanggal | L UpdatedAt
// ---------------------------------------------------------------------------
function getReportEMSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REPORT_EM_SHEET);
  if (!sheet) throw new Error("Tab '" + REPORT_EM_SHEET + "' tidak ditemukan.");
  return sheet;
}

function findReportEMRow_(facilityLabel, tanggal) {
  const sheet = getReportEMSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { sheet: sheet, rowIndex: -1, row: null };
  const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === facilityLabel && formatDate_(values[i][1]) === tanggal) {
      return { sheet: sheet, rowIndex: i + 2, row: values[i] };
    }
  }
  return { sheet: sheet, rowIndex: -1, row: null };
}

function getReportEM_(facilityKey, tanggal) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  if (!tanggal) return { found: false };
  const found = findReportEMRow_(cfg.label, tanggal);
  if (found.rowIndex === -1) {
    return { found: false, formNo: REPORT_EM_FORM_NO, prevFormNo: REPORT_EM_PREV_FORM_NO, prevTglBerlaku: REPORT_EM_PREV_TGL_BERLAKU };
  }
  const row = found.row;
  return {
    found: true,
    noKontrolMedia: row[2] || "",
    tanggalPembacaan: formatDate_(row[3]),
    formNo: row[4] || REPORT_EM_FORM_NO,
    prevFormNo: REPORT_EM_PREV_FORM_NO,
    prevTglBerlaku: REPORT_EM_PREV_TGL_BERLAKU,
    analis: { nama: row[5] || "", username: row[6] || "", tanggal: formatDate_(row[7]) },
    diperiksa: { nama: row[8] || "", username: row[9] || "", tanggal: formatDate_(row[10]) },
    updatedAt: row[11],
  };
}

function saveReportEMAuthed_(session, facilityKey, tanggal, noKontrolMedia, tanggalPembacaan) {
  if (!requireRole_(session, "Staff", "QC")) {
    return { error: "Hanya Staff/Supervisor/Manager QC yang boleh mengisi Report Hasil EM." };
  }
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  if (!tanggal) return { error: "Tanggal pemeriksaan wajib diisi." };

  if (session.role !== "Administrator" && getReport_(facilityKey, tanggal.slice(0, 7)).found) {
    return { error: "Pengkajian EM bulan ini sudah dibuat — Formulir QC terkunci. Hubungi Administrator kalau perlu perubahan." };
  }

  const found = findReportEMRow_(cfg.label, tanggal);
  const now = new Date();
  const isNew = found.rowIndex === -1;
  const analisNama = isNew ? session.nama : (found.row[5] || session.nama);
  const analisUsername = isNew ? session.username : (found.row[6] || session.username);
  const analisTanggal = isNew ? formatDate_(now) : (formatDate_(found.row[7]) || formatDate_(now));
  const diperiksaNama = isNew ? "" : (found.row[8] || "");
  const diperiksaUsername = isNew ? "" : (found.row[9] || "");
  const diperiksaTanggal = isNew ? "" : (found.row[10] || "");

  const rowValues = [
    cfg.label, tanggal, noKontrolMedia || "", tanggalPembacaan || "", REPORT_EM_FORM_NO,
    analisNama, analisUsername, analisTanggal,
    diperiksaNama, diperiksaUsername, diperiksaTanggal, now,
  ];

  if (isNew) {
    found.sheet.appendRow(rowValues);
  } else {
    found.sheet.getRange(found.rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  }

  writeAuditLog_({
    username: session.username, nama: session.nama, role: session.role, departemen: session.departemen,
    aksi: isNew ? "Buat Report Hasil EM" : "Update Report Hasil EM",
    fasilitas: cfg.label, bulan: tanggal, detail: "No Kontrol Media: " + (noKontrolMedia || "-"),
  });

  return getReportEM_(facilityKey, tanggal);
}

function approveReportEMAuthed_(session, facilityKey, tanggal) {
  if (!requireRole_(session, "Supervisor", "QC")) {
    return { error: "Hanya Supervisor/Manager QC yang boleh menyetujui Report Hasil EM." };
  }
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };

  if (session.role !== "Administrator" && getReport_(facilityKey, tanggal.slice(0, 7)).found) {
    return { error: "Pengkajian EM bulan ini sudah dibuat — Formulir QC terkunci. Hubungi Administrator kalau perlu perubahan." };
  }

  const found = findReportEMRow_(cfg.label, tanggal);
  if (found.rowIndex === -1) return { error: "Belum ada draf Report Hasil EM untuk tanggal ini." };

  const row = found.row;
  const now = new Date();
  const rowValues = [
    cfg.label, tanggal, row[2] || "", row[3] || "", row[4] || REPORT_EM_FORM_NO,
    row[5] || "", row[6] || "", row[7] || "",
    session.nama, session.username, formatDate_(now), now,
  ];
  found.sheet.getRange(found.rowIndex, 1, 1, rowValues.length).setValues([rowValues]);

  writeAuditLog_({
    username: session.username, nama: session.nama, role: session.role, departemen: session.departemen,
    aksi: "Approve Report Hasil EM", fasilitas: cfg.label, bulan: tanggal, detail: "",
  });

  return getReportEM_(facilityKey, tanggal);
}



// ---------------------------------------------------------------------------
// MASTER ROOM LIST  (dibaca dari tab asli hasil import Excel)
// Format tab: baris 1 = judul, baris 2 = header, baris 3+ = data
// Kolom: A=NOMOR RUANGAN, B & C = NAMA RUANGAN (kadang terpisah "Ruang" + nama), D=KELAS
// ---------------------------------------------------------------------------
function getMaster_(facilityKey) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.masterSheet);
  if (!sheet) return { error: "Tab master tidak ditemukan: " + cfg.masterSheet };

  const values = sheet.getDataRange().getValues();
  const rooms = [];
  for (let i = 2; i < values.length; i++) {
    const row = values[i];
    const code = row[0];
    const namePart = [row[1], row[2]].filter((v) => v !== "" && v !== null).join(" ").trim();
    const kelas = row[3];
    if (!code && !namePart) continue;
    if (kelas === "F") continue; // dikecualikan (lihat catatan Sefa Steril)
    rooms.push({
      code: String(code || "").trim(),
      name: namePart,
      kelas: String(kelas || "").trim(),
      isLaf: /LAF/i.test(namePart),
    });
  }
  return { facility: facilityKey, rooms: rooms };
}

// ---------------------------------------------------------------------------
// MONTHLY ENTRIES  (tab "..._Data": Bulan | Tanggal | Nama Ruangan | Kelas | Cawan Papar | Cawan Kontak | Air Sampler)
// ---------------------------------------------------------------------------
function getEntries_(facilityKey, month) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.dataSheet);
  if (!sheet) return { error: "Tab data tidak ditemukan: " + cfg.dataSheet };

  const values = sheet.getDataRange().getValues();
  const entries = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const bulan = formatMonth_(row[0]);
    if (bulan !== month) continue;
    entries.push({
      id: "row-" + i,
      tanggal: formatDate_(row[1]),
      roomName: row[2],
      kelas: row[3],
      settle: emptyToNull_(row[4]),
      contact: emptyToNull_(row[5]),
      air: emptyToNull_(row[6]),
    });
  }
  return { facility: facilityKey, month: month, entries: entries };
}

function saveEntries_(facilityKey, month, entries) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.dataSheet);
  if (!sheet) return { error: "Tab data tidak ditemukan: " + cfg.dataSheet };

  const values = sheet.getDataRange().getValues();
  const kept = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (formatMonth_(row[0]) !== month) kept.push(row);
  }
  const newRows = entries.map((e) => [
    month,
    e.tanggal || "",
    e.roomName || "",
    e.kelas || "",
    e.settle === null || e.settle === undefined ? "" : e.settle,
    e.contact === null || e.contact === undefined ? "" : e.contact,
    e.air === null || e.air === undefined ? "" : e.air,
  ]);

  const finalRows = kept.concat(newRows);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 7).clearContent();
  if (finalRows.length > 0) {
    sheet.getRange(2, 1, finalRows.length, 7).setValues(finalRows);
  }
  return { ok: true, saved: newRows.length };
}

// ---------------------------------------------------------------------------
// NARRATIVE REPORT  (tab "Laporan_Narasi")
// ---------------------------------------------------------------------------
const NARRATIVE_COLUMNS = [
  "Fasilitas", "Bulan", "Pendahuluan", "PerKelasJSON", "KesimpulanUmum",
  "KesanUmum", "ObservasiKritis", "TindakLanjut", "RekomendasiAkhir",
  "DinilaiNama", "DinilaiJabatan", "DinilaiTanggal",
  "DiperiksaNama", "DiperiksaJabatan", "DiperiksaTanggal", "UpdatedAt",
];

function getReport_(facilityKey, month) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NARRATIVE_SHEET);
  if (!sheet) return { error: "Tab tidak ditemukan: " + NARRATIVE_SHEET };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[0] === cfg.label && formatMonth_(row[1]) === month) {
      return {
        found: true,
        narrative: {
          pendahuluan: row[2],
          perKelas: safeParseJSON_(row[3]) || {},
          kesimpulanUmum: row[4],
          kesanUmum: row[5],
          observasiKritis: row[6],
          tindakLanjut: row[7],
          rekomendasiAkhir: row[8],
        },
        signoff: {
          dinilai: { nama: row[9], jabatan: row[10], tanggal: formatDate_(row[11]) },
          diperiksa: { nama: row[12], jabatan: row[13], tanggal: formatDate_(row[14]) },
        },
        updatedAt: row[15],
      };
    }
  }
  return { found: false };
}

// Pembungkus getReport_ untuk permintaan LIHAT (GET) dari browser:
// - Sudah login (role apa pun, termasuk Tamu) -> lihat narasi & tanda tangan lengkap.
// - Publik / tanpa login -> hanya info dasar (found/updatedAt), tanpa isi
//   narasi/pembahasan/tanda tangan, sesuai permintaan: publik cuma boleh
//   lihat data hasil pengujian, bukan pembahasan/pengkajian QA.
function getReportForViewer_(facilityKey, month, token) {
  const full = getReport_(facilityKey, month);
  if (full.error) return full;
  const session = token ? validateSession_(token) : null;
  if (session) return full;
  return { found: full.found, updatedAt: full.updatedAt, restricted: true };
}

// Pembungkus getReportEM_ (Formulir QC / FM.QC.062) untuk permintaan LIHAT:
// hanya akun QC, QA, atau Administrator yang sudah login yang boleh melihat
// formulir ini sama sekali — publik dan Tamu tidak bisa mengaksesnya.
function getReportEMForViewer_(facilityKey, tanggal, token) {
  const session = token ? validateSession_(token) : null;
  const canView = session && (session.role === "Administrator" || session.departemen === "QC" || session.departemen === "QA");
  if (!canView) {
    return { error: "Formulir QC (FM.QC.062) hanya bisa dilihat oleh akun QC atau QA yang sudah login." };
  }
  return getReportEM_(facilityKey, tanggal);
}

// Dipakai khusus halaman publik /verify (scan QR): hanya mengembalikan info
// tanda tangan (nama/jabatan/tanggal), TIDAK pernah mengembalikan isi
// narasi/pembahasan. Ini sengaja tetap bisa diakses tanpa login supaya
// siapa pun yang men-scan QR di dokumen fisik/PDF bisa memverifikasi
// keasliannya.
function getVerifySignoffPengkajian_(facilityKey, month) {
  const full = getReport_(facilityKey, month);
  if (full.error) return full;
  if (!full.found) return { found: false };
  return { found: true, signoff: full.signoff, updatedAt: full.updatedAt };
}

function getVerifySignoffReportEM_(facilityKey, tanggal) {
  const full = getReportEM_(facilityKey, tanggal);
  if (full.error) return full;
  if (!full.found) return { found: false };
  return { found: true, analis: full.analis, diperiksa: full.diperiksa, updatedAt: full.updatedAt };
}

// Formulir QC (Report_EM) suatu bulan dianggap "selesai" kalau SETIAP
// tanggal yang punya data pengujian di bulan itu sudah punya baris
// Report_EM DAN sudah di-"Diperiksa" (di-acc Supervisor/Manager QC).
// Kalau belum ada data sama sekali di bulan itu, dianggap belum selesai.
function isFormulirQCCompleteForMonth_(facilityKey, month) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return false;
  const entriesRes = getEntries_(facilityKey, month);
  const dates = Array.from(
    new Set((entriesRes.entries || []).map(function (e) { return e.tanggal; }).filter(Boolean))
  );
  if (dates.length === 0) return false;
  return dates.every(function (tgl) {
    const found = findReportEMRow_(cfg.label, tgl);
    if (found.rowIndex === -1) return false;
    return !!found.row[8]; // kolom I DiperiksaNama
  });
}

function saveReport_(facilityKey, month, narrative, signoff) {
  const cfg = FACILITIES[facilityKey];
  if (!cfg) return { error: "Fasilitas tidak dikenal: " + facilityKey };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NARRATIVE_SHEET);
  if (!sheet) return { error: "Tab tidak ditemukan: " + NARRATIVE_SHEET };

  const values = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === cfg.label && formatMonth_(values[i][1]) === month) {
      targetRow = i + 1; // 1-indexed sheet row
      break;
    }
  }

  const dinilai = signoff.dinilai || {};
  const diperiksa = signoff.diperiksa || {};
  const now = new Date();

  const rowValues = [
    cfg.label,
    month,
    narrative.pendahuluan || "",
    JSON.stringify(narrative.perKelas || {}),
    narrative.kesimpulanUmum || "",
    narrative.kesanUmum || "",
    narrative.observasiKritis || "",
    narrative.tindakLanjut || "",
    narrative.rekomendasiAkhir || "",
    dinilai.nama || "",
    dinilai.jabatan || "",
    dinilai.tanggal || "",
    diperiksa.nama || "",
    diperiksa.jabatan || "",
    diperiksa.tanggal || "",
    now,
  ];

  if (targetRow === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// STATUS INDEX  (untuk halaman dashboard rekap 5 fasilitas)
// ---------------------------------------------------------------------------
function getLimit_(parameter, kelas) {
  for (let i = 0; i < LIMITS.length; i++) {
    if (LIMITS[i].parameter === parameter && LIMITS[i].kelas === kelas) return LIMITS[i];
  }
  return null;
}

function levelFor_(rawValue, parameter, kelas) {
  const limit = getLimit_(parameter, kelas);
  if (!limit) return 0;
  if (rawValue === null || rawValue === undefined || rawValue === "") return 0;
  const v = Number(rawValue);
  if (isNaN(v)) return 0;
  if (limit.lessThan) return v < 1 ? 1 : 4;
  if (v < limit.alert) return 1;
  if (v < limit.action) return 2;
  if (v < limit.syarat) return 3;
  return 4;
}

function getStatusIndex_(month) {
  const out = {};
  Object.keys(FACILITIES).forEach((key) => {
    const res = getEntries_(key, month);
    const entries = res.entries || [];
    let maxLevel = 0;
    entries.forEach((e) => {
      ["settle", "contact", "air"].forEach((p) => {
        const lvl = levelFor_(e[p], p, e.kelas);
        if (lvl > maxLevel) maxLevel = lvl;
      });
    });
    out[key] = { level: maxLevel, hasData: entries.length > 0 };
  });
  return { month: month, status: out };
}

// ---------------------------------------------------------------------------
// UTIL
// ---------------------------------------------------------------------------
function formatMonth_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM");
  }
  return String(value || "").trim();
}

function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "").trim();
}

function emptyToNull_(value) {
  if (value === "" || value === null || value === undefined) return null;
  return value;
}

function safeParseJSON_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
