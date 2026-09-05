// Konfigurasi website EM Viable.
// Kalau URL Apps Script berubah (misalnya deploy ulang versi baru), cukup ganti
// nilai API_URL di bawah ini, commit, lalu deploy ulang ke Vercel — tidak perlu
// mengubah kode sumber apa pun. File ini berada di folder public/ sehingga
// disalin apa adanya ke hasil build dan bisa dibaca sebelum bundle React jalan.
//
// Catatan: sebelumnya ada salinan kedua file ini di root project yang sama sekali
// tidak terpakai (Vite hanya menyajikan yang di public/) dan komentarnya masih
// menyebut Netlify padahal deploy-nya sudah di Vercel. Salinan itu sudah dihapus
// supaya tidak ada dua sumber konfigurasi yang membingungkan.
window.EM_VIABLE_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyMPKpQCwhBRBG40OzFH2dVIoy7RcwRljienMEH2CWOBf6FQM_CAa6bIx6gSsk7weqGsQ/exec",
};
