// ============================================================
// LAPISAN DATA — Firestore realtime + Firebase Authentication
// Tidak perlu diubah. Semua komponen memakai fungsi dari sini.
// ============================================================

import { initializeApp, deleteApp } from "firebase/app";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, createUserWithEmailAndPassword, getAuth,
} from "firebase/auth";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  query, where, getDocs, writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfig } from "./firebase";

export const KOLEKSI = {
  guru: "guru",
  struktural: "tugasStruktural",
  insidental: "tugasInsidental",
  catatan: "catatanKinerja",
};

/* ---------- Autentikasi ---------- */

export const masuk = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const keluar = () => signOut(auth);
export const kirimResetPassword = (email) => sendPasswordResetEmail(auth, email);

export const pantauSesi = (cb) =>
  onAuthStateChanged(auth, async (user) => {
    if (!user) { cb(null); return; }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) { cb({ uid: user.uid, email: user.email, peran: "tanpa-peran" }); return; }
      cb({ uid: user.uid, email: user.email, ...snap.data() });
    } catch {
      cb({ uid: user.uid, email: user.email, peran: "tanpa-peran" });
    }
  });

export const gantiPasswordSendiri = async (passwordLama, passwordBaru) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Tidak ada sesi aktif.");
  const kred = EmailAuthProvider.credential(user.email, passwordLama);
  await reauthenticateWithCredential(user, kred);
  await updatePassword(user, passwordBaru);
};

// Membuat akun guru TANPA memutus sesi admin: pakai instans Firebase kedua sementara.
export const buatAkunGuru = async ({ email, password, guruId, nama }) => {
  const appKedua = initializeApp(firebaseConfig, "pembuatan-akun-" + Date.now());
  try {
    const authKedua = getAuth(appKedua);
    const kred = await createUserWithEmailAndPassword(authKedua, email, password);
    const uidBaru = kred.user.uid;
    await signOut(authKedua);
    await setDoc(doc(db, "users", uidBaru), { peran: "guru", guruId, nama, email });
    await updateDoc(doc(db, KOLEKSI.guru, guruId), { uid: uidBaru, emailAkun: email });
    return uidBaru;
  } finally {
    await deleteApp(appKedua).catch(() => {});
  }
};

/* ---------- Langganan data realtime ---------- */

export const langgananData = (sesi, cb) => {
  const stops = [];
  const state = { guru: [], struktural: [], insidental: [], catatan: [], pengaturan: { namaSekolah: "SMP Al Hikmah IIBS Batu", ta: "2026/2027" } };
  const kePeta = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const kirim = () => cb({ ...state, guru: [...state.guru], struktural: [...state.struktural], insidental: [...state.insidental], catatan: [...state.catatan] });

  stops.push(onSnapshot(doc(db, "pengaturan", "utama"), (s) => {
    if (s.exists()) state.pengaturan = { ...state.pengaturan, ...s.data() };
    kirim();
  }, () => {}));

  if (sesi.peran === "admin") {
    stops.push(onSnapshot(collection(db, KOLEKSI.guru), (s) => { state.guru = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.struktural), (s) => { state.struktural = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.insidental), (s) => { state.insidental = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.catatan), (s) => { state.catatan = kePeta(s); kirim(); }));
  } else if (sesi.peran === "guru" && sesi.guruId) {
    const gid = sesi.guruId;
    stops.push(onSnapshot(doc(db, KOLEKSI.guru, gid), (s) => {
      state.guru = s.exists() ? [{ id: s.id, ...s.data() }] : []; kirim();
    }));
    const q = (kol) => query(collection(db, kol), where("guruId", "==", gid));
    stops.push(onSnapshot(q(KOLEKSI.struktural), (s) => { state.struktural = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.insidental), (s) => { state.insidental = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.catatan), (s) => { state.catatan = kePeta(s); kirim(); }));
  }
  return () => stops.forEach((stop) => stop());
};

export const langgananUsers = (cb) =>
  onSnapshot(collection(db, "users"), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));

/* ---------- Operasi tulis (khusus admin, ditegakkan Rules) ---------- */

const bersih = (obj) => {
  const { id, ...sisa } = obj;
  Object.keys(sisa).forEach((k) => sisa[k] === undefined && delete sisa[k]);
  return sisa;
};

export const tambahDok = (kol, data) => addDoc(collection(db, kol), bersih(data));
export const perbaruiDok = (kol, id, patch) => updateDoc(doc(db, kol, id), bersih(patch));
export const hapusDok = (kol, id) => deleteDoc(doc(db, kol, id));
export const simpanPengaturan = (patch) => setDoc(doc(db, "pengaturan", "utama"), patch, { merge: true });

export const hapusGuruMenyeluruh = async (guruId) => {
  const batch = writeBatch(db);
  for (const kol of [KOLEKSI.struktural, KOLEKSI.insidental, KOLEKSI.catatan]) {
    const s = await getDocs(query(collection(db, kol), where("guruId", "==", guruId)));
    s.docs.forEach((d) => batch.delete(d.ref));
  }
  const u = await getDocs(query(collection(db, "users"), where("guruId", "==", guruId)));
  u.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, KOLEKSI.guru, guruId));
  await batch.commit();
};
