// ============================================================
// FUNGSI SERVER (Vercel Serverless Function) — HANYA berjalan di server, tidak pernah di browser.
// Memakai Firebase ADMIN SDK (bukan SDK klien biasa) — inilah satu-satunya cara yang diizinkan
// Firebase untuk mengubah email/password milik AKUN LAIN (client SDK hanya boleh mengubah akun
// yang sedang login sendiri). Endpoint ini otomatis aktif di: /api/admin-kelola-akun
//
// KEAMANAN: setiap permintaan WAJIB menyertakan token login admin (Authorization: Bearer <idToken>).
// Token itu diverifikasi ke Firebase, lalu perannya dicek ke Firestore (koleksi users) — harus
// "admin". Kalau bukan admin, permintaan ditolak. Guru tidak bisa memanggil endpoint ini untuk
// mengubah akun guru lain, dan siapa pun tanpa token yang sah langsung ditolak.
// ============================================================

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function admin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY belum diatur di Environment Variables Vercel.");
    const serviceAccount = JSON.parse(raw);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metode tidak diizinkan." });
    return;
  }

  try {
    const { auth, db } = admin();

    // 1) Verifikasi pemanggil benar-benar login dan tokennya sah
    const header = req.headers.authorization || "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: "Token login tidak ditemukan." }); return; }

    const dekode = await auth.verifyIdToken(idToken);
    const uidPemanggil = dekode.uid;

    // 2) Verifikasi pemanggil adalah admin (dicek dari Firestore, bukan dari klaim yang bisa dipalsukan)
    const dokPemanggil = await db.collection("users").doc(uidPemanggil).get();
    if (!dokPemanggil.exists || dokPemanggil.data()?.peran !== "admin") {
      res.status(403).json({ error: "Hanya admin yang boleh mengubah akun pegawai lain." });
      return;
    }

    // 3) Validasi input
    const { targetUid, guruId, emailBaru, passwordBaru } = req.body || {};
    if (!targetUid) { res.status(400).json({ error: "targetUid wajib diisi." }); return; }
    if (!emailBaru && !passwordBaru) { res.status(400).json({ error: "Isi email baru atau password baru." }); return; }
    if (passwordBaru && String(passwordBaru).length < 6) {
      res.status(400).json({ error: "Password baru minimal 6 karakter." }); return;
    }

    // 4) Terapkan perubahan lewat Admin SDK (satu-satunya cara mengubah akun orang lain)
    const patch = {};
    if (emailBaru) patch.email = emailBaru;
    if (passwordBaru) patch.password = passwordBaru;
    await auth.updateUser(targetUid, patch);

    // 5) Selaraskan salinan email di Firestore (dipakai untuk tampilan di aplikasi)
    if (emailBaru) {
      await db.collection("users").doc(targetUid).set({ email: emailBaru }, { merge: true });
      if (guruId) await db.collection("guru").doc(guruId).set({ emailAkun: emailBaru }, { merge: true });
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    const kode = e?.errorInfo?.code || e?.code || "";
    const pesan =
      kode === "auth/email-already-exists" ? "Email tersebut sudah dipakai akun lain." :
      kode === "auth/invalid-email" ? "Format email tidak valid." :
      kode === "auth/user-not-found" ? "Akun tidak ditemukan (mungkin sudah terhapus)." :
      kode.includes("id-token") ? "Sesi login admin sudah tidak valid, silakan masuk ulang." :
      e?.message || "Terjadi kesalahan pada server.";
    res.status(500).json({ error: pesan });
  }
}
