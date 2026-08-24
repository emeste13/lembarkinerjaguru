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
  supervisi: "supervisiPembelajaran",
  administrasi: "penilaianAdministrasi",
  akhlak: "penilaianAkhlak",
  suratTugas: "pengajuanSuratTugas",
};

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

// Admin mengubah email dan/atau password akun GURU LAIN — client SDK Firebase tidak mengizinkan
// ini secara langsung (hanya boleh mengubah akun sendiri), jadi permintaan dikirim ke fungsi
// server (/api/admin-kelola-akun) yang memakai Firebase Admin SDK. Token login admin disertakan
// supaya server bisa memverifikasi bahwa yang meminta memang admin.
export const adminUbahAkunGuru = async ({ targetUid, guruId, emailBaru, passwordBaru }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesi admin tidak aktif. Silakan masuk ulang.");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/admin-kelola-akun", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ targetUid, guruId, emailBaru, passwordBaru }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* respons kosong */ }
  if (!res.ok) throw new Error(data?.error || `Gagal memperbarui akun (${res.status}).`);
  return data;
};

export const langgananData = (sesi, cb) => {
  const stops = [];
  const state = { guru: [], struktural: [], insidental: [], catatan: [], supervisi: [], administrasi: [], akhlak: [], suratTugas: [], pengaturan: { namaSekolah: "SMP Al Hikmah IIBS Batu", ta: "2026/2027" } };
  const kePeta = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const kirim = () => cb({ ...state, guru: [...state.guru], struktural: [...state.struktural], insidental: [...state.insidental], catatan: [...state.catatan], supervisi: [...state.supervisi], administrasi: [...state.administrasi], akhlak: [...state.akhlak], suratTugas: [...state.suratTugas] });

  stops.push(onSnapshot(doc(db, "pengaturan", "utama"), (s) => {
    if (s.exists()) state.pengaturan = { ...state.pengaturan, ...s.data() };
    kirim();
  }, () => {}));

  if (sesi.peran === "admin") {
    stops.push(onSnapshot(collection(db, KOLEKSI.guru), (s) => { state.guru = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.struktural), (s) => { state.struktural = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.insidental), (s) => { state.insidental = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.catatan), (s) => { state.catatan = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.supervisi), (s) => { state.supervisi = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.administrasi), (s) => { state.administrasi = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.akhlak), (s) => { state.akhlak = kePeta(s); kirim(); }));
    stops.push(onSnapshot(collection(db, KOLEKSI.suratTugas), (s) => { state.suratTugas = kePeta(s); kirim(); }));
  } else if (sesi.peran === "guru" && sesi.guruId) {
    const gid = sesi.guruId;
    stops.push(onSnapshot(doc(db, KOLEKSI.guru, gid), (s) => {
      state.guru = s.exists() ? [{ id: s.id, ...s.data() }] : []; kirim();
    }));
    const q = (kol) => query(collection(db, kol), where("guruId", "==", gid));
    stops.push(onSnapshot(q(KOLEKSI.struktural), (s) => { state.struktural = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.insidental), (s) => { state.insidental = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.catatan), (s) => { state.catatan = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.supervisi), (s) => { state.supervisi = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.administrasi), (s) => { state.administrasi = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.akhlak), (s) => { state.akhlak = kePeta(s); kirim(); }));
    stops.push(onSnapshot(q(KOLEKSI.suratTugas), (s) => { state.suratTugas = kePeta(s); kirim(); }));
  }
  return () => stops.forEach((stop) => stop());
};

export const langgananUsers = (cb) =>
  onSnapshot(collection(db, "users"), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));

const bersih = (obj) => {
  const { id, ...sisa } = obj;
  Object.keys(sisa).forEach((k) => sisa[k] === undefined && delete sisa[k]);
  return sisa;
};

export const tambahDok = (kol, data) => addDoc(collection(db, kol), bersih(data));
export const perbaruiDok = (kol, id, patch) => updateDoc(doc(db, kol, id), bersih(patch));
export const hapusDok = (kol, id) => deleteDoc(doc(db, kol, id));
export const simpanPengaturan = (patch) => setDoc(doc(db, "pengaturan", "utama"), patch, { merge: true });

// Penilaian Akhlak Mandiri — ID dokumen deterministik (guruId_TA_Semester) sehingga
// otomatis membatasi satu pengisian per guru per semester (mengisi ulang = menimpa dokumen yang sama).
// Guru hanya boleh menulis selagi status masih "Menunggu Validasi" (ditegakkan oleh Security Rules).
export const idAkhlak = (guruId, ta, semester) => `${guruId}_${ta.replace("/", "-")}_${semester}`;

export const ajukanPenilaianAkhlak = (guruId, ta, semester, isi) =>
  setDoc(doc(db, KOLEKSI.akhlak, idAkhlak(guruId, ta, semester)), bersih({
    ...isi, guruId, ta, semester, status: "Menunggu Validasi", diperbaruiPada: new Date().toISOString(),
  }));

export const validasiPenilaianAkhlak = (docId, catatanValidasi = "") =>
  updateDoc(doc(db, KOLEKSI.akhlak, docId), {
    status: "Divalidasi", catatanValidasi, tanggalValidasi: new Date().toISOString(),
  });

export const bukaKembaliPenilaianAkhlak = (docId) =>
  updateDoc(doc(db, KOLEKSI.akhlak, docId), { status: "Menunggu Validasi", catatanValidasi: "", tanggalValidasi: null });

export const hapusGuruMenyeluruh = async (guruId) => {
  const batch = writeBatch(db);
  for (const kol of [KOLEKSI.struktural, KOLEKSI.insidental, KOLEKSI.catatan, KOLEKSI.supervisi, KOLEKSI.administrasi, KOLEKSI.akhlak, KOLEKSI.suratTugas]) {
    const s = await getDocs(query(collection(db, kol), where("guruId", "==", guruId)));
    s.docs.forEach((d) => batch.delete(d.ref));
  }
  const u = await getDocs(query(collection(db, "users"), where("guruId", "==", guruId)));
  u.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, KOLEKSI.guru, guruId));
  await batch.commit();
};

/* ---------- Pengajuan Surat Tugas ---------- */
// Guru mengajukan → admin menyetujui (otomatis membuat Tugas Insidental, belum dinilai) atau menolak.

export const ajukanSuratTugas = (guruId, isi) =>
  addDoc(collection(db, KOLEKSI.suratTugas), bersih({
    ...isi, guruId, status: "Menunggu Persetujuan", diajukanPada: new Date().toISOString(),
  }));

export const perbaruiSuratTugas = (id, patch) => updateDoc(doc(db, KOLEKSI.suratTugas, id), bersih(patch));
export const batalkanSuratTugas = (id) => deleteDoc(doc(db, KOLEKSI.suratTugas, id));

// Setujui: satu transaksi batch — buat dokumen Tugas Insidental baru (nilai belum diisi, menunggu
// penilaian Kepala Sekolah seperti tugas insidental lainnya) SEKALIGUS menandai pengajuan Disetujui.
export const setujuiSuratTugas = async (pengajuan, { kategori, jam }) => {
  const batch = writeBatch(db);
  const refInsidental = doc(collection(db, KOLEKSI.insidental));
  const catatanGabungan = [
    pengajuan.lokasi ? `Lokasi: ${pengajuan.lokasi}.` : "",
    pengajuan.tanggalSelesai && pengajuan.tanggalSelesai !== pengajuan.tanggalMulai
      ? `Periode: ${pengajuan.tanggalMulai} s.d. ${pengajuan.tanggalSelesai}.` : "",
    pengajuan.deskripsi || "",
  ].filter(Boolean).join(" ");

  batch.set(refInsidental, bersih({
    guruId: pengajuan.guruId,
    tanggal: pengajuan.tanggalMulai,
    kegiatan: pengajuan.namaAgenda,
    peran: pengajuan.peran,
    jam: Number(jam) || 0,
    kategori,
    catatan: catatanGabungan,
    nilai: null,
    asalSuratTugasId: pengajuan.id,
  }));
  batch.update(doc(db, KOLEKSI.suratTugas, pengajuan.id), {
    status: "Disetujui", diprosesPada: new Date().toISOString(), tugasInsidentalId: refInsidental.id,
  });
  await batch.commit();
};

export const tolakSuratTugas = (id, catatanAdmin = "") =>
  updateDoc(doc(db, KOLEKSI.suratTugas, id), {
    status: "Ditolak", catatanAdmin, diprosesPada: new Date().toISOString(),
  });
