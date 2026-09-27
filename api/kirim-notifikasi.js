// ============================================================
// FUNGSI SERVER (Vercel Serverless Function) — HANYA berjalan di server.
// Mengirim notifikasi PUSH lewat Firebase Cloud Messaging (FCM), memakai Firebase Admin SDK
// (satu-satunya cara resmi mengirim notifikasi dari luar perangkat penerima).
// Endpoint otomatis aktif di: /api/kirim-notifikasi
//
// KEAMANAN: pemanggil wajib login (token diverifikasi), tapi TIDAK harus admin — guru juga
// boleh memicu notifikasi (mis. saat mengajukan surat tugas, admin perlu diberi tahu).
// Target notifikasi ditentukan dari data yang sudah ada di Firestore (bukan dari klaim
// sepihak pemanggil), jadi guru tidak bisa mengirim notifikasi mengatasnamakan admin.
// ============================================================

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function admin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY belum diatur di Environment Variables Vercel.");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return { auth: getAuth(), db: getFirestore(), messaging: getMessaging() };
}

// Kirim ke satu atau beberapa token FCM, abaikan token yang sudah tidak valid (perangkat lama)
async function kirimKeToken(messaging, tokens, judul, isi, data) {
  const unik = [...new Set(tokens.filter(Boolean))];
  if (unik.length === 0) return { terkirim: 0 };
  const hasil = await messaging.sendEachForMulticast({
    tokens: unik,
    notification: { title: judul, body: isi },
    data: data || {},
    webpush: { fcmOptions: { link: "/" } },
  });
  return { terkirim: hasil.successCount, gagal: hasil.failureCount };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Metode tidak diizinkan." }); return; }

  try {
    const { auth, db, messaging } = admin();

    // 1) Verifikasi pemanggil login dan sah
    const header = req.headers.authorization || "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: "Token login tidak ditemukan." }); return; }
    await auth.verifyIdToken(idToken); // cukup pastikan token sah; target ditentukan dari data, bukan klaim

    // 2) Validasi input
    const { tujuan, guruId, judul, isi, data } = req.body || {};
    if (!tujuan || !judul || !isi) { res.status(400).json({ error: "tujuan, judul, dan isi wajib diisi." }); return; }

    let tokens = [];

    if (tujuan === "admin") {
      // Kirim ke SEMUA akun berperan admin yang sudah mengizinkan notifikasi
      const snap = await db.collection("users").where("peran", "==", "admin").get();
      tokens = snap.docs.map((d) => d.data()?.fcmToken).filter(Boolean);
    } else if (tujuan === "guru") {
      if (!guruId) { res.status(400).json({ error: "guruId wajib diisi untuk tujuan guru." }); return; }
      const snap = await db.collection("users").where("guruId", "==", guruId).get();
      tokens = snap.docs.map((d) => d.data()?.fcmToken).filter(Boolean);
    } else {
      res.status(400).json({ error: "tujuan harus 'admin' atau 'guru'." }); return;
    }

    const hasil = await kirimKeToken(messaging, tokens, judul, isi, data);
    res.status(200).json({ ok: true, ...hasil });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Terjadi kesalahan pada server." });
  }
}
