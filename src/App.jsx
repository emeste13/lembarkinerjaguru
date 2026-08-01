import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  masuk, keluar, pantauSesi, kirimResetPassword, gantiPasswordSendiri,
  buatAkunGuru, langgananData, langgananUsers,
  tambahDok, perbaruiDok, hapusDok, hapusGuruMenyeluruh, simpanPengaturan, KOLEKSI,
} from "./api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import {
  Users, Briefcase, CalendarClock, NotebookPen, LayoutDashboard, FileBarChart,
  Plus, Pencil, Trash2, Download, Search, X, GraduationCap, Award, AlertTriangle,
  Lightbulb, Clock, ShieldCheck, ChevronDown, LogIn, LogOut, KeyRound, Eye, EyeOff,
  ThumbsUp, ThumbsDown,
} from "lucide-react";

/* ================= KONSTANTA ================= */

const KATEGORI_INSIDENTAL = ["Kepanitiaan", "Kedinasan", "Akademik", "Kesiswaan", "Humas/Marketing"];
const KAT_WARNA = { "Kepanitiaan": "#1a5632", "Kedinasan": "#2e7d4f", "Akademik": "#c2912e", "Kesiswaan": "#4f7fae", "Humas/Marketing": "#8a5a9e" };

const JENIS_CATATAN = ["Prestasi", "Inovasi", "Kedisiplinan", "Pembinaan", "Pelanggaran Ringan"];
const CAT_WARNA = { "Prestasi": "#c2912e", "Inovasi": "#2e7d4f", "Kedisiplinan": "#1a5632", "Pembinaan": "#b06a2c", "Pelanggaran Ringan": "#b23a3a" };

// Sifat catatan: menentukan warna dan arah skor (menambah/mengurangi)
const SIFAT_INFO = {
  "Positif": { warna: "#177a3e", latar: "#e9f6ee" },
  "Negatif": { warna: "#c03333", latar: "#fbecec" },
};
const SIFAT_CATATAN = ["Positif", "Negatif"];
const SIFAT_BAWAAN = { "Prestasi": "Positif", "Inovasi": "Positif", "Kedisiplinan": "Positif", "Pembinaan": "Negatif", "Pelanggaran Ringan": "Negatif" };
const CAT_MAGNITUDO = { "Prestasi": 5, "Inovasi": 5, "Kedisiplinan": 2, "Pembinaan": 3, "Pelanggaran Ringan": 5 };
const sifatCatatan = (r) => r.sifat || SIFAT_BAWAAN[r.jenis] || "Positif";
const skorCatatanItem = (r) => (sifatCatatan(r) === "Negatif" ? -1 : 1) * (CAT_MAGNITUDO[r.jenis] ?? 2);

// Penilaian tugas oleh Kepala Sekolah + bobot akumulasi
const PENILAIAN = [
  { nilai: 4, label: "Sangat Baik" },
  { nilai: 3, label: "Baik" },
  { nilai: 2, label: "Cukup" },
  { nilai: 1, label: "Kurang" },
];
const BOBOT = { struktural: 5, insidental: 2 }; // struktural berbobot lebih tinggi
const labelNilai = (n) => PENILAIAN.find((p) => p.nilai === n)?.label || "Belum dinilai";

const BULAN_TA = ["Jul", "Agu", "Sep", "Okt", "Nov", "Des", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];
const STATUS_PEG = ["GTY (Guru Tetap Yayasan)", "GTTY (Guru Tidak Tetap)", "PNS DPK", "Kontrak"];

/* ================= UTILITAS ================= */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const fmtTgl = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

// Tahun ajaran: Juli–Juni. "2026/2027" berarti Jul 2026 s.d. Jun 2027.
const tahunAjaranDariTanggal = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear(), m = d.getMonth(); // 0=Jan
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
};

const semesterDariTanggal = (iso) => {
  const m = new Date(iso + "T00:00:00").getMonth();
  return m >= 6 ? "Ganjil" : "Genap"; // Jul–Des Ganjil, Jan–Jun Genap
};

// index bulan dalam tahun ajaran: Jul=0 ... Jun=11
const idxBulanTA = (iso) => {
  const m = new Date(iso + "T00:00:00").getMonth();
  return m >= 6 ? m - 6 : m + 6;
};

const cocokFilter = (iso, ta, sem) => {
  if (!iso) return false;
  if (ta !== "Semua" && tahunAjaranDariTanggal(iso) !== ta) return false;
  if (sem !== "Semua" && semesterDariTanggal(iso) !== sem) return false;
  return true;
};

const unduhCSV = (nama, baris) => {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const teks = "\uFEFF" + baris.map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob([teks], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nama; a.click();
  URL.revokeObjectURL(url);
};

/* ================= KOMPONEN DASAR ================= */

const Ikon = ({ I, size = 16 }) => <I size={size} strokeWidth={2} style={{ flexShrink: 0 }} />;

const Tombol = ({ children, varian = "utama", onClick, kecil, type = "button", title }) => (
  <button type={type} onClick={onClick} title={title} className={`btn btn-${varian} ${kecil ? "btn-kecil" : ""}`}>
    {children}
  </button>
);

const Kartu = ({ children, className = "", style }) => (
  <div className={`kartu ${className}`} style={style}>{children}</div>
);

const Kolom = ({ label, children, wajib }) => (
  <label className="kolom">
    <span className="kolom-label">{label}{wajib && <em> *</em>}</span>
    {children}
  </label>
);

const Modal = ({ judul, onTutup, children, lebar = 560 }) => (
  <div className="modal-latar" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
    <div className="modal" style={{ maxWidth: lebar }} role="dialog" aria-modal="true">
      <div className="modal-kepala">
        <h3>{judul}</h3>
        <button className="btn-ikon" onClick={onTutup} aria-label="Tutup"><Ikon I={X} size={18} /></button>
      </div>
      <div className="modal-isi">{children}</div>
    </div>
  </div>
);

const Kosong = ({ pesan, aksi }) => (
  <div className="kosong">
    <p>{pesan}</p>
    {aksi}
  </div>
);

const Lencana = ({ warna, children }) => (
  <span className="lencana" style={{ background: `${warna}18`, color: warna, borderColor: `${warna}55` }}>{children}</span>
);

const NILAI_WARNA = { 4: "#1a5632", 3: "#2e7d4f", 2: "#c2912e", 1: "#b23a3a", 0: "#8a948c" };

// Dropdown penilaian sekali klik — Kepala Sekolah cukup memilih dari daftar
const NilaiPilih = ({ nilai, onUbah, judul = "Penilaian Kepala Sekolah" }) => (
  <select
    className="nilai-pilih" title={judul} aria-label={judul}
    style={{ color: NILAI_WARNA[nilai || 0], borderColor: `${NILAI_WARNA[nilai || 0]}66`, background: `${NILAI_WARNA[nilai || 0]}10` }}
    value={nilai || ""}
    onChange={(e) => onUbah(e.target.value ? Number(e.target.value) : null)}
  >
    <option value="">Belum dinilai</option>
    {PENILAIAN.map((p) => <option key={p.nilai} value={p.nilai}>{p.label} ({p.nilai})</option>)}
  </select>
);

const LencanaNilai = ({ nilai }) => (
  <Lencana warna={NILAI_WARNA[nilai || 0]}>{labelNilai(nilai)}{nilai ? ` (${nilai})` : ""}</Lencana>
);

/* ================= PERHITUNGAN SKOR ================= */

const hitungProfil = (guruId, data, ta, sem) => {
  const str = data.struktural.filter((s) => s.guruId === guruId);
  const ins = data.insidental.filter((r) => r.guruId === guruId && cocokFilter(r.tanggal, ta, sem));
  const cat = data.catatan.filter((r) => r.guruId === guruId && cocokFilter(r.tanggal, ta, sem));
  const g = data.guru.find((x) => x.id === guruId);

  const totalJamIns = ins.reduce((a, b) => a + (Number(b.jam) || 0), 0);
  const perKategori = KATEGORI_INSIDENTAL.map((k) => ({
    kategori: k, jumlah: ins.filter((r) => r.kategori === k).length,
    jam: ins.filter((r) => r.kategori === k).reduce((a, b) => a + (Number(b.jam) || 0), 0),
  }));
  const perJenisCatatan = JENIS_CATATAN.map((j) => ({ jenis: j, jumlah: cat.filter((r) => r.jenis === j).length }));
  const perBulan = BULAN_TA.map((b, idx) => ({
    bulan: b,
    jam: ins.filter((r) => idxBulanTA(r.tanggal) === idx).reduce((a, x) => a + (Number(x.jam) || 0), 0),
  }));

  const nCat = (j) => cat.filter((r) => r.jenis === j).length;

  // Akumulasi penilaian KS: skor tugas = nilai (1–4) × bobot. Struktural berbobot lebih tinggi.
  const strDinilai = str.filter((r) => Number(r.nilai) > 0);
  const insDinilai = ins.filter((r) => Number(r.nilai) > 0);
  const skorStruktural = strDinilai.reduce((a, r) => a + Number(r.nilai) * BOBOT.struktural, 0);
  const skorInsidental = insDinilai.reduce((a, r) => a + Number(r.nilai) * BOBOT.insidental, 0);
  const skorCatatan = cat.reduce((a, r) => a + skorCatatanItem(r), 0);
  const skorTotal = skorStruktural + skorInsidental + skorCatatan;
  const belumDinilai = (str.length - strDinilai.length) + (ins.length - insDinilai.length);
  const rata = (l) => (l.length ? l.reduce((a, r) => a + Number(r.nilai), 0) / l.length : 0);
  const rataStruktural = rata(strDinilai);
  const rataInsidental = rata(insDinilai);

  // Radar 0–100 sederhana
  const radar = [
    { dimensi: "Beban Mengajar", nilai: Math.min(100, Math.round(((g?.jam || 0) / 24) * 100)) },
    { dimensi: "Tugas Struktural", nilai: str.length === 0 ? 0 : Math.min(100, Math.round((rataStruktural / 4) * 70 + str.length * 15)) },
    { dimensi: "Kontribusi Insidental", nilai: ins.length === 0 ? 0 : Math.min(100, Math.round((rataInsidental / 4) * 60 + ins.length * 6 + totalJamIns * 0.5)) },
    { dimensi: "Kedisiplinan", nilai: Math.max(0, Math.min(100, 60 + nCat("Kedisiplinan") * 15 - nCat("Pelanggaran Ringan") * 20 - nCat("Pembinaan") * 10)) },
    { dimensi: "Inovasi", nilai: Math.min(100, nCat("Inovasi") * 30) },
    { dimensi: "Prestasi", nilai: Math.min(100, nCat("Prestasi") * 30) },
  ];

  return { g, str, ins, cat, totalJamIns, perKategori, perJenisCatatan, perBulan, skorStruktural, skorInsidental, skorCatatan, skorTotal, radar, belumDinilai, rataStruktural, rataInsidental };
};

/* ================= APLIKASI UTAMA ================= */

const TAB = [
  { id: "dasbor", label: "Dasbor", I: LayoutDashboard },
  { id: "guru", label: "Data Guru", I: Users },
  { id: "struktural", label: "Tugas Struktural", I: Briefcase },
  { id: "insidental", label: "Tugas Insidental", I: CalendarClock },
  { id: "catatan", label: "Catatan Kinerja", I: NotebookPen },
  { id: "laporan", label: "Laporan Guru", I: FileBarChart },
  { id: "akses", label: "Akses & Token", I: KeyRound },
];

export default function AplikasiKinerjaGuru() {
  const [sesi, setSesi] = useState(undefined); // undefined=memeriksa, null=belum masuk
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dasbor");
  const [ta, setTa] = useState("2026/2027");
  const [sem, setSem] = useState("Semua");

  useEffect(() => pantauSesi(setSesi), []);

  useEffect(() => {
    if (!sesi || sesi.peran === "tanpa-peran") { setData(null); return; }
    setData(null);
    return langgananData(sesi, setData);
  }, [sesi?.uid, sesi?.peran, sesi?.guruId]);

  const daftarTA = useMemo(() => {
    const s = new Set(["2026/2027"]);
    if (data) [...data.insidental, ...data.catatan].forEach((r) => r.tanggal && s.add(tahunAjaranDariTanggal(r.tanggal)));
    return [...s].sort();
  }, [data]);

  if (sesi === undefined) return (<><Gaya /><div className="muat">Memeriksa sesi…</div></>);
  if (sesi === null) return (<><Gaya /><Masuk /></>);
  if (sesi.peran === "tanpa-peran") return (<><Gaya /><TanpaPeran email={sesi.email} /></>);
  if (!data) return (<><Gaya /><div className="muat">Memuat data dari server…</div></>);

  const admin = sesi.peran === "admin";
  const guruSesi = admin ? null : data.guru.find((g) => g.id === sesi.guruId);

  return (
    <div className="app">
      <Gaya />
      <header className="kepala">
        <div className="kepala-merek">
          <div className="kepala-logo"><Ikon I={GraduationCap} size={22} /></div>
          <div>
            <h1>Catatan Kinerja Guru</h1>
            <p>{data.pengaturan.namaSekolah} · Tahun Ajaran {ta === "Semua" ? "Semua" : ta}</p>
          </div>
        </div>
        <div className="kepala-filter">
          <div className="pilih-bungkus">
            <select value={ta} onChange={(e) => setTa(e.target.value)} aria-label="Tahun ajaran">
              <option value="Semua">Semua TA</option>
              {daftarTA.map((t) => <option key={t} value={t}>TA {t}</option>)}
            </select>
            <Ikon I={ChevronDown} size={14} />
          </div>
          <div className="pilih-bungkus">
            <select value={sem} onChange={(e) => setSem(e.target.value)} aria-label="Semester">
              <option value="Semua">Semua Semester</option>
              <option value="Ganjil">Ganjil (Jul–Des)</option>
              <option value="Genap">Genap (Jan–Jun)</option>
            </select>
            <Ikon I={ChevronDown} size={14} />
          </div>
          <div className="sesi-info">
            <span className="sesi-peran">{admin ? (sesi.nama || "Kepala Sekolah / Admin") : (guruSesi?.nama || sesi.nama || "Guru")}</span>
            <button className="btn btn-keluar" onClick={() => { keluar(); setTab("dasbor"); }}><Ikon I={LogOut} size={14} /> Keluar</button>
          </div>
        </div>
      </header>

      {admin && (
        <nav className="navigasi" role="tablist">
          {TAB.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={`nav-item ${tab === t.id ? "aktif" : ""}`} onClick={() => setTab(t.id)}>
              <Ikon I={t.I} size={16} /><span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <main className="isi">
        {admin ? (<>
          {tab === "dasbor" && <Dasbor data={data} ta={ta} sem={sem} kePindah={setTab} />}
          {tab === "guru" && <TabGuru data={data} />}
          {tab === "struktural" && <TabStruktural data={data} />}
          {tab === "insidental" && <TabInsidental data={data} ta={ta} sem={sem} />}
          {tab === "catatan" && <TabCatatan data={data} ta={ta} sem={sem} />}
          {tab === "laporan" && <TabLaporan data={data} ta={ta} sem={sem} />}
          {tab === "akses" && <TabAkun data={data} />}
        </>) : (
          guruSesi
            ? (<>
                <div className="info-realtime">Data diperbarui langsung — penilaian terbaru dari Kepala Sekolah tampil otomatis.</div>
                <TabLaporan data={data} ta={ta} sem={sem} kunciGuruId={guruSesi.id} />
              </>)
            : <Kartu><Kosong pesan="Data guru untuk akun ini belum tersedia. Hubungi Kepala Sekolah/admin." /></Kartu>
        )}
      </main>

      <footer className="kaki">Tersambung ke server · pembaruan realtime · Filter aktif: TA {ta} · Semester {sem}</footer>
    </div>
  );
}

const aman = (janji) => Promise.resolve(janji).catch((e) =>
  window.alert("Operasi gagal: " + (e?.message || e)));

/* ================= HALAMAN MASUK ================= */

function Masuk() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);

  const kirim = async () => {
    if (!email.trim() || !password) return;
    setProses(true); setGalat("");
    try {
      await masuk(email.trim(), password);
    } catch (e) {
      const kode = e?.code || "";
      setGalat(
        kode.includes("invalid-credential") || kode.includes("wrong-password") || kode.includes("user-not-found")
          ? "Email atau password salah."
          : kode.includes("too-many-requests")
            ? "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
            : "Gagal masuk: " + (e?.message || e));
    } finally { setProses(false); }
  };

  const lupa = async () => {
    if (!email.trim()) { setGalat("Isi email terlebih dahulu, lalu klik lupa password."); return; }
    try {
      await kirimResetPassword(email.trim());
      setGalat("");
      window.alert("Tautan reset password telah dikirim ke " + email.trim() + ". Periksa kotak masuk/spam.");
    } catch (e) { setGalat("Gagal mengirim email reset: " + (e?.message || e)); }
  };

  return (
    <div className="masuk-latar">
      <div className="masuk-kotak">
        <div className="kepala-logo besar" style={{ margin: "0 auto" }}><Ikon I={GraduationCap} size={26} /></div>
        <h1>Catatan Kinerja Guru</h1>
        <p className="sub">SMP Al Hikmah IIBS Batu</p>
        <label className="kolom" style={{ textAlign: "left", marginTop: 18 }}>
          <span className="kolom-label">Email</span>
          <input type="email" value={email} autoFocus placeholder="nama@sekolah.sch.id"
            onChange={(e) => { setEmail(e.target.value); setGalat(""); }}
            onKeyDown={(e) => e.key === "Enter" && kirim()} />
        </label>
        <label className="kolom" style={{ textAlign: "left" }}>
          <span className="kolom-label">Password</span>
          <input type="password" value={password} placeholder="Password Anda"
            onChange={(e) => { setPassword(e.target.value); setGalat(""); }}
            onKeyDown={(e) => e.key === "Enter" && kirim()} />
        </label>
        {galat && <p className="masuk-galat">{galat}</p>}
        <Tombol onClick={kirim}><Ikon I={LogIn} size={15} /> {proses ? "Memproses…" : "Masuk"}</Tombol>
        <button className="tautan-polos" onClick={lupa}>Lupa password? Kirim tautan reset ke email</button>
        <p className="masuk-catatan">Kepala Sekolah/admin adalah penilai dengan akses penuh. Guru masuk dengan akun yang dibuatkan admin dan hanya dapat melihat laporan kinerjanya sendiri secara realtime.</p>
      </div>
    </div>
  );
}

function TanpaPeran({ email }) {
  return (
    <div className="masuk-latar">
      <div className="masuk-kotak">
        <div className="kepala-logo besar" style={{ margin: "0 auto" }}><Ikon I={AlertTriangle} size={26} /></div>
        <h1>Akun belum terdaftar</h1>
        <p className="sub" style={{ lineHeight: 1.6 }}>
          Akun <strong>{email}</strong> berhasil masuk, tetapi belum memiliki peran di aplikasi ini.
          Untuk akun admin pertama: buka Firebase Console → Firestore → buat dokumen di koleksi
          <code> users</code> dengan ID = UID akun ini, berisi field <code>peran: "admin"</code> dan <code>nama</code>.
          Petunjuk lengkap ada di file PANDUAN.md.
        </p>
        <Tombol onClick={() => keluar()}><Ikon I={LogOut} size={15} /> Keluar</Tombol>
      </div>
    </div>
  );
}

/* ================= TAB AKUN (ADMIN) ================= */

function TabAkun({ data }) {
  const [users, setUsers] = useState([]);
  const [formAkun, setFormAkun] = useState(null);
  const [pwLama, setPwLama] = useState("");
  const [pwBaru, setPwBaru] = useState("");
  const [pwKonfirm, setPwKonfirm] = useState("");
  const [pesan, setPesan] = useState("");
  const [proses, setProses] = useState(false);

  useEffect(() => langgananUsers(setUsers), []);

  const akunGuru = (guruId) => users.find((u) => u.peran === "guru" && u.guruId === guruId);
  const tanpaAkun = data.guru.filter((g) => !akunGuru(g.id));

  const buatAkun = async () => {
    if (!formAkun.guruId || !formAkun.email.trim() || formAkun.password.length < 6) {
      window.alert("Lengkapi data. Password minimal 6 karakter (ketentuan Firebase)."); return;
    }
    const g = data.guru.find((x) => x.id === formAkun.guruId);
    setProses(true);
    try {
      await buatAkunGuru({ email: formAkun.email.trim(), password: formAkun.password, guruId: g.id, nama: g.nama });
      window.alert("Akun guru berhasil dibuat. Sampaikan email & password awal kepada guru, dan sarankan segera menggantinya lewat menu lupa password.");
      setFormAkun(null);
    } catch (e) {
      window.alert("Gagal membuat akun: " + (e?.message || e));
    } finally { setProses(false); }
  };

  const resetGuru = async (email) => {
    try { await kirimResetPassword(email); window.alert("Tautan reset password dikirim ke " + email); }
    catch (e) { window.alert("Gagal mengirim: " + (e?.message || e)); }
  };

  const gantiPw = async () => {
    setPesan("");
    if (pwBaru.length < 6) { setPesan("Password baru minimal 6 karakter."); return; }
    if (pwBaru !== pwKonfirm) { setPesan("Konfirmasi password tidak sama."); return; }
    try {
      await gantiPasswordSendiri(pwLama, pwBaru);
      setPwLama(""); setPwBaru(""); setPwKonfirm("");
      setPesan("Password berhasil diubah.");
    } catch (e) {
      setPesan(String(e?.code || "").includes("invalid-credential") || String(e?.code || "").includes("wrong-password")
        ? "Password saat ini salah." : "Gagal mengubah password: " + (e?.message || e));
    }
  };

  return (
    <div className="susun-v">
      <Kartu>
        <div className="kartu-kepala"><h2>Password Saya (Admin)</h2><span className="sub">Ganti password akun Anda sendiri</span></div>
        <div className="grid-2-form" style={{ gridTemplateColumns: "1fr 1fr 1fr", alignItems: "end", gap: 12 }}>
          <Kolom label="Password saat ini"><input type="password" value={pwLama} onChange={(e) => setPwLama(e.target.value)} /></Kolom>
          <Kolom label="Password baru (min. 6 karakter)"><input type="password" value={pwBaru} onChange={(e) => setPwBaru(e.target.value)} /></Kolom>
          <Kolom label="Ulangi password baru"><input type="password" value={pwKonfirm} onChange={(e) => setPwKonfirm(e.target.value)} /></Kolom>
        </div>
        <div className="form-aksi" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="teks-kecil" style={{ color: pesan.includes("berhasil") ? "#177a3e" : "#b23a3a" }}>{pesan}</span>
          <Tombol onClick={gantiPw}><Ikon I={KeyRound} size={15} /> Ubah Password</Tombol>
        </div>
      </Kartu>

      <Kartu>
        <div className="kartu-kepala baris">
          <div>
            <h2>Akun Login Guru</h2>
            <span className="sub">Guru dengan akun dapat masuk dan hanya melihat laporan kinerjanya sendiri (realtime)</span>
          </div>
          <Tombol onClick={() => setFormAkun({ guruId: tanpaAkun[0]?.id || "", email: "", password: "" })}>
            <Ikon I={Plus} size={15} /> Buat Akun Guru
          </Tombol>
        </div>
        <div className="tabel-bungkus"><table>
          <thead><tr><th>Nama</th><th>NIK/NIP</th><th>Status Akun</th><th>Email Login</th><th></th></tr></thead>
          <tbody>
            {data.guru.map((g) => {
              const akun = akunGuru(g.id);
              return (
                <tr key={g.id}>
                  <td><strong>{g.nama}</strong></td>
                  <td className="teks-kecil">{g.nik || "-"}</td>
                  <td>{akun
                    ? <Lencana warna="#177a3e"><Ikon I={ShieldCheck} size={12} /> Aktif</Lencana>
                    : <Lencana warna="#8a948c">Belum ada akun</Lencana>}</td>
                  <td className="teks-kecil">{akun?.email || "-"}</td>
                  <td className="aksi">
                    {akun && <Tombol kecil varian="netral" onClick={() => resetGuru(akun.email)}>Kirim Reset Password</Tombol>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </Kartu>

      {formAkun && (
        <Modal judul="Buat Akun Login Guru" onTutup={() => setFormAkun(null)}>
          {tanpaAkun.length === 0 ? (
            <Kosong pesan="Semua guru sudah memiliki akun." />
          ) : (
            <>
              <div className="form-grid">
                <Kolom label="Guru" wajib>
                  <select value={formAkun.guruId} onChange={(e) => setFormAkun({ ...formAkun, guruId: e.target.value })}>
                    {tanpaAkun.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
                  </select>
                </Kolom>
                <Kolom label="Email login guru" wajib>
                  <input type="email" value={formAkun.email} onChange={(e) => setFormAkun({ ...formAkun, email: e.target.value })} placeholder="nama.guru@sekolah.sch.id" />
                </Kolom>
                <Kolom label="Password awal (min. 6 karakter)" wajib>
                  <input type="text" value={formAkun.password} onChange={(e) => setFormAkun({ ...formAkun, password: e.target.value })} placeholder="Akan disampaikan ke guru" />
                </Kolom>
              </div>
              <div className="form-aksi">
                <Tombol varian="netral" onClick={() => setFormAkun(null)}>Batal</Tombol>
                <Tombol onClick={buatAkun}>{proses ? "Membuat…" : "Buat Akun"}</Tombol>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ================= DASBOR ================= */

function Dasbor({ data, ta, sem, kePindah }) {
  const profil = data.guru.map((g) => hitungProfil(g.id, data, ta, sem));
  const banding = profil
    .map((p) => ({ nama: p.g.nama.replace(/,.*$/, ""), skor: p.skorTotal }))
    .sort((a, b) => b.skor - a.skor);
  const totIns = data.insidental.filter((r) => cocokFilter(r.tanggal, ta, sem));
  const totCat = data.catatan.filter((r) => cocokFilter(r.tanggal, ta, sem));
  const totJam = totIns.reduce((a, b) => a + (Number(b.jam) || 0), 0);

  const belumDinilai = data.struktural.filter((r) => !Number(r.nilai)).length +
    totIns.filter((r) => !Number(r.nilai)).length;

  const statistik = [
    { label: "Guru terdaftar", nilai: data.guru.length, I: Users },
    { label: "Tugas struktural aktif", nilai: data.struktural.length, I: Briefcase },
    { label: "Tugas insidental (periode ini)", nilai: totIns.length, I: CalendarClock },
    { label: "Total jam tugas tambahan", nilai: totJam, I: Clock },
    { label: "Tugas belum dinilai", nilai: belumDinilai, I: AlertTriangle, sorot: belumDinilai > 0 },
  ];

  const terbaru = [...totIns.map((r) => ({ ...r, tipe: "insidental" })), ...totCat.map((r) => ({ ...r, tipe: "catatan" }))]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 6);
  const namaGuru = (id) => data.guru.find((g) => g.id === id)?.nama || "—";

  return (
    <div className="susun-v">
      <div className="grid-stat">
        {statistik.map((s) => (
          <Kartu key={s.label} className="stat" style={s.sorot ? { borderColor: "#c2912e", background: "#fdf8ee" } : undefined}>
            <div className="stat-ikon" style={s.sorot ? { background: "#f5e8cc", color: "#a3761f" } : undefined}><Ikon I={s.I} size={18} /></div>
            <div><div className="stat-angka">{s.nilai}</div><div className="stat-label">{s.label}</div></div>
          </Kartu>
        ))}
      </div>

      <div className="grid-2">
        <Kartu>
          <div className="kartu-kepala">
            <h2>Perbandingan Kontribusi Antarguru</h2>
            <span className="sub">Skor agregat: struktural + insidental + catatan kinerja</span>
          </div>
          {banding.length === 0 ? <Kosong pesan="Belum ada data guru." /> : (
            <ResponsiveContainer width="100%" height={Math.max(200, banding.length * 52)}>
              <BarChart data={banding} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#e4e8e2" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="nama" width={150} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, "Skor"]} />
                <Bar dataKey="skor" fill="#1a5632" radius={[0, 4, 4, 0]} barSize={22}>
                  <LabelList dataKey="skor" position="right" style={{ fontSize: 12, fill: "#1a5632", fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Kartu>

        <Kartu>
          <div className="kartu-kepala"><h2>Aktivitas Terbaru</h2><span className="sub">Periode terpilih</span></div>
          {terbaru.length === 0 ? (
            <Kosong pesan="Belum ada aktivitas pada periode ini."
              aksi={<Tombol kecil onClick={() => kePindah("insidental")}><Ikon I={Plus} size={14} /> Catat tugas insidental</Tombol>} />
          ) : (
            <ul className="linimasa">
              {terbaru.map((r) => (
                <li key={r.id}>
                  <span className="linimasa-tgl">{fmtTgl(r.tanggal)}</span>
                  <div>
                    <strong>{namaGuru(r.guruId)}</strong>
                    {r.tipe === "insidental"
                      ? <p>{r.kegiatan} — {r.peran} <Lencana warna={KAT_WARNA[r.kategori]}>{r.kategori}</Lencana></p>
                      : <p>{r.deskripsi} <Lencana warna={CAT_WARNA[r.jenis]}>{r.jenis}</Lencana></p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Kartu>
      </div>
    </div>
  );
}

/* ================= TAB GURU ================= */

function TabGuru({ data }) {
  const [form, setForm] = useState(null);
  const [cari, setCari] = useState("");

  const daftar = data.guru.filter((g) =>
    [g.nama, g.mapel, g.nik].join(" ").toLowerCase().includes(cari.toLowerCase()));

  const simpan = () => {
    if (!form.nama.trim() || !form.mapel.trim()) return;
    if (form.id) aman(perbaruiDok(KOLEKSI.guru, form.id, form));
    else aman(tambahDok(KOLEKSI.guru, form));
    setForm(null);
  };

  const hapus = (id) => {
    if (!window.confirm("Hapus guru ini beserta seluruh tugas, catatan, dan peran akunnya? Akun login di Firebase Authentication perlu dinonaktifkan terpisah dari Console.")) return;
    aman(hapusGuruMenyeluruh(id));
  };

  return (
    <div className="susun-v">
      <div className="baris-alat">
        <div className="cari"><Ikon I={Search} size={15} /><input placeholder="Cari nama, mapel, atau NIK…" value={cari} onChange={(e) => setCari(e.target.value)} /></div>
        <Tombol onClick={() => setForm({ nama: "", nik: "", mapel: "", jam: 24, status: STATUS_PEG[0] })}><Ikon I={Plus} size={15} /> Tambah Guru</Tombol>
      </div>
      <Kartu>
        {daftar.length === 0 ? <Kosong pesan="Tidak ada guru yang cocok." /> : (
          <div className="tabel-bungkus"><table>
            <thead><tr><th>Nama</th><th>NIK/NIP</th><th>Mata Pelajaran</th><th className="ka">Jam/Minggu</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {daftar.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.nama}</strong></td>
                  <td>{g.nik || "-"}</td>
                  <td>{g.mapel}</td>
                  <td className="ka">{g.jam}</td>
                  <td><span className="teks-kecil">{g.status}</span></td>
                  <td className="aksi">
                    <button className="btn-ikon" title="Ubah" onClick={() => setForm({ ...g })}><Ikon I={Pencil} size={15} /></button>
                    <button className="btn-ikon bahaya" title="Hapus" onClick={() => hapus(g.id)}><Ikon I={Trash2} size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Kartu>

      {form && (
        <Modal judul={form.id ? "Ubah Data Guru" : "Tambah Guru"} onTutup={() => setForm(null)}>
          <div className="form-grid">
            <Kolom label="Nama lengkap & gelar" wajib><input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Ust. …, S.Pd." /></Kolom>
            <Kolom label="NIK / NIP"><input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} /></Kolom>
            <Kolom label="Mata pelajaran" wajib><input value={form.mapel} onChange={(e) => setForm({ ...form, mapel: e.target.value })} /></Kolom>
            <Kolom label="Beban mengajar (jam/minggu)"><input type="number" min="0" max="40" value={form.jam} onChange={(e) => setForm({ ...form, jam: Number(e.target.value) })} /></Kolom>
            <Kolom label="Status kepegawaian">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_PEG.map((s) => <option key={s}>{s}</option>)}</select>
            </Kolom>
          </div>
          <div className="form-aksi">
            <Tombol varian="netral" onClick={() => setForm(null)}>Batal</Tombol>
            <Tombol onClick={simpan}>Simpan</Tombol>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= TAB STRUKTURAL ================= */

function TabStruktural({ data }) {
  const [form, setForm] = useState(null);

  const tumpangTindih = (f) => data.struktural.some((r) =>
    r.id !== f.id && r.guruId === f.guruId && r.jabatan.trim().toLowerCase() === f.jabatan.trim().toLowerCase() &&
    !(f.selesai < r.mulai || f.mulai > r.selesai));

  const simpan = () => {
    if (!form.guruId || !form.jabatan.trim() || !form.mulai || !form.selesai) return;
    if (form.mulai > form.selesai) { window.alert("Tanggal mulai harus sebelum tanggal selesai."); return; }
    if (tumpangTindih(form)) { window.alert("Guru ini sudah memiliki jabatan yang sama pada periode yang tumpang tindih."); return; }
    if (form.id) aman(perbaruiDok(KOLEKSI.struktural, form.id, form));
    else aman(tambahDok(KOLEKSI.struktural, form));
    setForm(null);
  };

  const perGuru = data.guru.map((g) => ({ g, tugas: data.struktural.filter((r) => r.guruId === g.id) }));

  return (
    <div className="susun-v">
      <div className="baris-alat">
        <p className="keterangan">Jabatan struktural berdasarkan SK Kepala Sekolah — Waka, koordinator, wali kelas, wali asrama, pembina, dan sejenisnya.</p>
        <Tombol onClick={() => setForm({ guruId: data.guru[0]?.id || "", jabatan: "", sk: "", mulai: "2026-07-01", selesai: "2027-06-30", tupoksi: "", nilai: null })}>
          <Ikon I={Plus} size={15} /> Tambah Penugasan
        </Tombol>
      </div>

      {perGuru.map(({ g, tugas }) => (
        <Kartu key={g.id}>
          <div className="kartu-kepala baris">
            <h2>{g.nama}</h2>
            <span className="sub">{tugas.length} jabatan</span>
          </div>
          {tugas.length === 0 ? <p className="teks-redup">Belum ada tugas struktural.</p> : (
            <div className="tabel-bungkus"><table>
              <thead><tr><th>Jabatan</th><th>SK Penugasan</th><th>Periode</th><th>Tupoksi Ringkas</th><th>Penilaian KS</th><th></th></tr></thead>
              <tbody>
                {tugas.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.jabatan}</strong></td>
                    <td className="teks-kecil">{r.sk || "-"}</td>
                    <td className="teks-kecil">{fmtTgl(r.mulai)} – {fmtTgl(r.selesai)}</td>
                    <td className="teks-kecil">{r.tupoksi || "-"}</td>
                    <td><NilaiPilih nilai={r.nilai} onUbah={(v) => aman(perbaruiDok(KOLEKSI.struktural, r.id, { nilai: v }))} /></td>
                    <td className="aksi">
                      <button className="btn-ikon" title="Ubah" onClick={() => setForm({ ...r })}><Ikon I={Pencil} size={15} /></button>
                      <button className="btn-ikon bahaya" title="Hapus" onClick={() => window.confirm("Hapus penugasan ini?") && aman(hapusDok(KOLEKSI.struktural, r.id))}><Ikon I={Trash2} size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Kartu>
      ))}

      {form && (
        <Modal judul={form.id ? "Ubah Penugasan Struktural" : "Tambah Penugasan Struktural"} onTutup={() => setForm(null)}>
          <div className="form-grid">
            <Kolom label="Guru" wajib>
              <select value={form.guruId} onChange={(e) => setForm({ ...form, guruId: e.target.value })}>
                {data.guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
              </select>
            </Kolom>
            <Kolom label="Nama jabatan" wajib><input value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} placeholder="Waka Kesiswaan, Wali Kelas 7B, …" /></Kolom>
            <Kolom label="SK penugasan (nomor & tanggal)"><input value={form.sk} onChange={(e) => setForm({ ...form, sk: e.target.value })} placeholder="SK/…/KS/VII/2026 — 1 Jul 2026" /></Kolom>
            <div className="grid-2-form">
              <Kolom label="Mulai" wajib><input type="date" value={form.mulai} onChange={(e) => setForm({ ...form, mulai: e.target.value })} /></Kolom>
              <Kolom label="Selesai" wajib><input type="date" value={form.selesai} onChange={(e) => setForm({ ...form, selesai: e.target.value })} /></Kolom>
            </div>
            <Kolom label="Tupoksi ringkas"><textarea rows={2} value={form.tupoksi} onChange={(e) => setForm({ ...form, tupoksi: e.target.value })} /></Kolom>
            <Kolom label="Penilaian Kepala Sekolah">
              <NilaiPilih nilai={form.nilai} onUbah={(v) => setForm({ ...form, nilai: v })} />
            </Kolom>
          </div>
          <div className="form-aksi">
            <Tombol varian="netral" onClick={() => setForm(null)}>Batal</Tombol>
            <Tombol onClick={simpan}>Simpan</Tombol>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= TAB INSIDENTAL ================= */

function TabInsidental({ data, ta, sem }) {
  const [form, setForm] = useState(null);
  const [fGuru, setFGuru] = useState("Semua");
  const [fKat, setFKat] = useState("Semua");
  const [cari, setCari] = useState("");

  const daftar = data.insidental
    .filter((r) => cocokFilter(r.tanggal, ta, sem))
    .filter((r) => fGuru === "Semua" || r.guruId === fGuru)
    .filter((r) => fKat === "Semua" || r.kategori === fKat)
    .filter((r) => [r.kegiatan, r.peran, r.catatan].join(" ").toLowerCase().includes(cari.toLowerCase()))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const namaGuru = (id) => data.guru.find((g) => g.id === id)?.nama || "—";

  const simpan = () => {
    if (!form.guruId || !form.tanggal || !form.kegiatan.trim()) return;
    const dobel = data.insidental.some((r) => r.id !== form.id && r.guruId === form.guruId &&
      r.tanggal === form.tanggal && r.kegiatan.trim().toLowerCase() === form.kegiatan.trim().toLowerCase());
    if (dobel) { window.alert("Tugas yang sama untuk guru ini pada tanggal tersebut sudah tercatat."); return; }
    if (form.id) aman(perbaruiDok(KOLEKSI.insidental, form.id, form));
    else aman(tambahDok(KOLEKSI.insidental, form));
    setForm(null);
  };

  return (
    <div className="susun-v">
      <div className="baris-alat bungkus">
        <div className="cari"><Ikon I={Search} size={15} /><input placeholder="Cari kegiatan atau peran…" value={cari} onChange={(e) => setCari(e.target.value)} /></div>
        <div className="pilih-bungkus"><select value={fGuru} onChange={(e) => setFGuru(e.target.value)}>
          <option value="Semua">Semua guru</option>
          {data.guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </select><Ikon I={ChevronDown} size={14} /></div>
        <div className="pilih-bungkus"><select value={fKat} onChange={(e) => setFKat(e.target.value)}>
          <option value="Semua">Semua kategori</option>
          {KATEGORI_INSIDENTAL.map((k) => <option key={k}>{k}</option>)}
        </select><Ikon I={ChevronDown} size={14} /></div>
        <Tombol onClick={() => setForm({ guruId: data.guru[0]?.id || "", tanggal: new Date().toISOString().slice(0, 10), kegiatan: "", peran: "", jam: 4, kategori: KATEGORI_INSIDENTAL[0], catatan: "", nilai: null })}>
          <Ikon I={Plus} size={15} /> Catat Tugas
        </Tombol>
      </div>

      <Kartu>
        {daftar.length === 0 ? <Kosong pesan="Belum ada tugas insidental pada filter ini." /> : (
          <div className="tabel-bungkus"><table>
            <thead><tr><th>Tanggal</th><th>Guru</th><th>Kegiatan</th><th>Peran</th><th className="ka">Jam</th><th>Kategori</th><th>Penilaian KS</th><th></th></tr></thead>
            <tbody>
              {daftar.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap teks-kecil">{fmtTgl(r.tanggal)}</td>
                  <td><strong>{namaGuru(r.guruId)}</strong></td>
                  <td>{r.kegiatan}{r.catatan && <div className="teks-kecil">{r.catatan}</div>}</td>
                  <td className="teks-kecil">{r.peran || "-"}</td>
                  <td className="ka">{r.jam}</td>
                  <td><Lencana warna={KAT_WARNA[r.kategori]}>{r.kategori}</Lencana></td>
                  <td><NilaiPilih nilai={r.nilai} onUbah={(v) => aman(perbaruiDok(KOLEKSI.insidental, r.id, { nilai: v }))} /></td>
                  <td className="aksi">
                    <button className="btn-ikon" title="Ubah" onClick={() => setForm({ ...r })}><Ikon I={Pencil} size={15} /></button>
                    <button className="btn-ikon bahaya" title="Hapus" onClick={() => window.confirm("Hapus catatan tugas ini?") && aman(hapusDok(KOLEKSI.insidental, r.id))}><Ikon I={Trash2} size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Kartu>

      {form && (
        <Modal judul={form.id ? "Ubah Tugas Insidental" : "Catat Tugas Insidental"} onTutup={() => setForm(null)}>
          <div className="form-grid">
            <div className="grid-2-form">
              <Kolom label="Guru" wajib>
                <select value={form.guruId} onChange={(e) => setForm({ ...form, guruId: e.target.value })}>
                  {data.guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
              </Kolom>
              <Kolom label="Tanggal" wajib><input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></Kolom>
            </div>
            <Kolom label="Nama kegiatan" wajib><input value={form.kegiatan} onChange={(e) => setForm({ ...form, kegiatan: e.target.value })} placeholder="Panitia Wisuda, Juri Lomba, …" /></Kolom>
            <div className="grid-2-form">
              <Kolom label="Peran"><input value={form.peran} onChange={(e) => setForm({ ...form, peran: e.target.value })} placeholder="Ketua, anggota, pemateri…" /></Kolom>
              <Kolom label="Beban kerja (jam)"><input type="number" min="0" value={form.jam} onChange={(e) => setForm({ ...form, jam: Number(e.target.value) })} /></Kolom>
            </div>
            <Kolom label="Kategori">
              <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                {KATEGORI_INSIDENTAL.map((k) => <option key={k}>{k}</option>)}
              </select>
            </Kolom>
            <Kolom label="Catatan kualitas pelaksanaan"><textarea rows={2} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></Kolom>
            <Kolom label="Penilaian Kepala Sekolah">
              <NilaiPilih nilai={form.nilai} onUbah={(v) => setForm({ ...form, nilai: v })} />
            </Kolom>
          </div>
          <div className="form-aksi">
            <Tombol varian="netral" onClick={() => setForm(null)}>Batal</Tombol>
            <Tombol onClick={simpan}>Simpan</Tombol>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= TAB CATATAN KINERJA ================= */

const IKON_CATATAN = { "Prestasi": Award, "Inovasi": Lightbulb, "Kedisiplinan": ShieldCheck, "Pembinaan": NotebookPen, "Pelanggaran Ringan": AlertTriangle };

function TabCatatan({ data, ta, sem }) {
  const [form, setForm] = useState(null);
  const [fGuru, setFGuru] = useState("Semua");

  const daftar = data.catatan
    .filter((r) => cocokFilter(r.tanggal, ta, sem))
    .filter((r) => fGuru === "Semua" || r.guruId === fGuru)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const namaGuru = (id) => data.guru.find((g) => g.id === id)?.nama || "—";

  const simpan = () => {
    if (!form.guruId || !form.tanggal || !form.deskripsi.trim()) return;
    if (form.id) aman(perbaruiDok(KOLEKSI.catatan, form.id, form));
    else aman(tambahDok(KOLEKSI.catatan, form));
    setForm(null);
  };

  return (
    <div className="susun-v">
      <div className="baris-alat">
        <div className="pilih-bungkus"><select value={fGuru} onChange={(e) => setFGuru(e.target.value)}>
          <option value="Semua">Semua guru</option>
          {data.guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </select><Ikon I={ChevronDown} size={14} /></div>
        <Tombol onClick={() => setForm({ guruId: data.guru[0]?.id || "", tanggal: new Date().toISOString().slice(0, 10), jenis: JENIS_CATATAN[0], sifat: SIFAT_BAWAAN[JENIS_CATATAN[0]], deskripsi: "", bukti: "" })}>
          <Ikon I={Plus} size={15} /> Tulis Catatan
        </Tombol>
      </div>

      {daftar.length === 0 ? <Kartu><Kosong pesan="Belum ada catatan kinerja pada filter ini." /></Kartu> : (
        <div className="grid-catatan">
          {daftar.map((r) => {
            const Ic = IKON_CATATAN[r.jenis] || NotebookPen;
            const sifat = sifatCatatan(r);
            const si = SIFAT_INFO[sifat];
            return (
              <Kartu key={r.id} className="catatan-kartu" style={{ borderTop: `3px solid ${si.warna}`, background: si.latar }}>
                <div className="catatan-atas">
                  <span className="baris-lencana">
                    <Lencana warna={si.warna}><Ikon I={sifat === "Positif" ? ThumbsUp : ThumbsDown} size={12} /> {sifat} ({skorCatatanItem(r) > 0 ? "+" : ""}{skorCatatanItem(r)})</Lencana>
                    <Lencana warna={CAT_WARNA[r.jenis]}><Ikon I={Ic} size={12} /> {r.jenis}</Lencana>
                  </span>
                  <span className="teks-kecil">{fmtTgl(r.tanggal)}</span>
                </div>
                <strong>{namaGuru(r.guruId)}</strong>
                <p>{r.deskripsi}</p>
                {r.bukti && <a href={r.bukti} target="_blank" rel="noreferrer" className="tautan">Bukti / dokumentasi</a>}
                <div className="aksi kanan">
                  <button className="btn-ikon" title="Ubah" onClick={() => setForm({ ...r })}><Ikon I={Pencil} size={15} /></button>
                  <button className="btn-ikon bahaya" title="Hapus" onClick={() => window.confirm("Hapus catatan ini?") && aman(hapusDok(KOLEKSI.catatan, r.id))}><Ikon I={Trash2} size={15} /></button>
                </div>
              </Kartu>
            );
          })}
        </div>
      )}

      {form && (
        <Modal judul={form.id ? "Ubah Catatan Kinerja" : "Tulis Catatan Kinerja"} onTutup={() => setForm(null)}>
          <div className="form-grid">
            <div className="grid-2-form">
              <Kolom label="Guru" wajib>
                <select value={form.guruId} onChange={(e) => setForm({ ...form, guruId: e.target.value })}>
                  {data.guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
              </Kolom>
              <Kolom label="Tanggal" wajib><input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></Kolom>
            </div>
            <Kolom label="Jenis catatan">
              <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value, sifat: SIFAT_BAWAAN[e.target.value] })}>
                {JENIS_CATATAN.map((j) => <option key={j}>{j}</option>)}
              </select>
            </Kolom>
            <Kolom label="Sifat catatan (menentukan arah skor)">
              <div className="sifat-pilih">
                {SIFAT_CATATAN.map((s) => {
                  const si = SIFAT_INFO[s];
                  const aktif = sifatCatatan(form) === s;
                  return (
                    <button key={s} type="button"
                      className={`sifat-tombol ${aktif ? "aktif" : ""}`}
                      style={aktif ? { background: si.warna, borderColor: si.warna, color: "#fff" } : { color: si.warna, borderColor: `${si.warna}66` }}
                      onClick={() => setForm({ ...form, sifat: s })}>
                      <Ikon I={s === "Positif" ? ThumbsUp : ThumbsDown} size={14} /> {s}
                    </button>
                  );
                })}
              </div>
            </Kolom>
            <Kolom label="Deskripsi" wajib><textarea rows={3} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /></Kolom>
            <Kolom label="Tautan bukti / dokumentasi"><input value={form.bukti} onChange={(e) => setForm({ ...form, bukti: e.target.value })} placeholder="https://…" /></Kolom>
          </div>
          <div className="form-aksi">
            <Tombol varian="netral" onClick={() => setForm(null)}>Batal</Tombol>
            <Tombol onClick={simpan}>Simpan</Tombol>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= TAB LAPORAN ================= */

function TabLaporan({ data, ta, sem, kunciGuruId = null }) {
  const [guruId, setGuruId] = useState(kunciGuruId || data.guru[0]?.id || "");
  useEffect(() => {
    if (kunciGuruId) { setGuruId(kunciGuruId); return; }
    if (!data.guru.find((g) => g.id === guruId)) setGuruId(data.guru[0]?.id || "");
  }, [data.guru, guruId, kunciGuruId]);

  if (!guruId) return <Kartu><Kosong pesan="Tambahkan data guru terlebih dahulu di tab Data Guru." /></Kartu>;

  const p = hitungProfil(guruId, data, ta, sem);
  const labelPeriode = `TA ${ta}${sem === "Semua" ? "" : " · Semester " + sem}`;

  const eksporGuru = () => {
    const baris = [
      ["LAPORAN KINERJA GURU"], [data.pengaturan.namaSekolah], [labelPeriode], [],
      ["Nama", p.g.nama], ["NIK/NIP", p.g.nik], ["Mata Pelajaran", p.g.mapel],
      ["Beban Mengajar (jam/minggu)", p.g.jam], ["Status", p.g.status], [],
      ["TUGAS STRUKTURAL", `(bobot x${BOBOT.struktural})`], ["Jabatan", "SK", "Mulai", "Selesai", "Tupoksi", "Penilaian", "Skor"],
      ...p.str.map((r) => [r.jabatan, r.sk, r.mulai, r.selesai, r.tupoksi, labelNilai(r.nilai), Number(r.nilai) ? Number(r.nilai) * BOBOT.struktural : ""]), [],
      ["TUGAS INSIDENTAL", `(bobot x${BOBOT.insidental})`], ["Tanggal", "Kegiatan", "Peran", "Jam", "Kategori", "Catatan", "Penilaian", "Skor"],
      ...p.ins.map((r) => [r.tanggal, r.kegiatan, r.peran, r.jam, r.kategori, r.catatan, labelNilai(r.nilai), Number(r.nilai) ? Number(r.nilai) * BOBOT.insidental : ""]), [],
      ["CATATAN KINERJA"], ["Tanggal", "Jenis", "Sifat", "Deskripsi", "Skor"],
      ...p.cat.map((r) => [r.tanggal, r.jenis, sifatCatatan(r), r.deskripsi, skorCatatanItem(r)]), [],
      ["REKAP SKOR"],
      ["Skor tugas struktural", p.skorStruktural],
      ["Skor tugas insidental", p.skorInsidental],
      ["Skor catatan kinerja", p.skorCatatan],
      ["SKOR TOTAL", p.skorTotal],
    ];
    unduhCSV(`laporan-${p.g.nama.split(",")[0].replace(/\W+/g, "-")}.csv`, baris);
  };

  const eksporSemua = () => {
    const baris = [
      ["REKAP KINERJA SELURUH GURU", data.pengaturan.namaSekolah, labelPeriode], [],
      ["Nama", "NIK/NIP", "Mapel", "Jam Mengajar", "Jml Tugas Struktural", "Rata2 Nilai Struktural", "Jml Tugas Insidental", "Rata2 Nilai Insidental", "Total Jam Insidental", "Tugas Belum Dinilai", "Jml Catatan", `Skor Struktural (x${BOBOT.struktural})`, `Skor Insidental (x${BOBOT.insidental})`, "Skor Catatan", "SKOR TOTAL"],
      ...data.guru.map((g) => {
        const q = hitungProfil(g.id, data, ta, sem);
        return [g.nama, g.nik, g.mapel, g.jam, q.str.length, q.rataStruktural ? q.rataStruktural.toFixed(2) : "", q.ins.length, q.rataInsidental ? q.rataInsidental.toFixed(2) : "", q.totalJamIns, q.belumDinilai, q.cat.length, q.skorStruktural, q.skorInsidental, q.skorCatatan, q.skorTotal];
      }),
    ];
    unduhCSV("rekap-kinerja-seluruh-guru.csv", baris);
  };

  const donat = p.perJenisCatatan.filter((d) => d.jumlah > 0);

  return (
    <div className="susun-v">
      <div className="baris-alat bungkus">
        {kunciGuruId ? (
          <span className="sub" style={{ fontSize: 13 }}>Laporan kinerja pribadi — hanya data Anda yang ditampilkan.</span>
        ) : (
          <div className="pilih-bungkus besar"><select value={guruId} onChange={(e) => setGuruId(e.target.value)}>
            {data.guru.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select><Ikon I={ChevronDown} size={14} /></div>
        )}
        <div className="baris-alat">
          <Tombol varian="netral" onClick={eksporGuru}><Ikon I={Download} size={15} /> Ekspor CSV {kunciGuruId ? "Laporan Saya" : "Guru Ini"}</Tombol>
          {!kunciGuruId && <Tombol varian="netral" onClick={eksporSemua}><Ikon I={Download} size={15} /> Ekspor Rekap Semua Guru</Tombol>}
          <Tombol onClick={() => window.print()}><Ikon I={Download} size={15} /> Cetak / Simpan PDF</Tombol>
        </div>
      </div>

      <div id="laporan-cetak" className="susun-v">
        <Kartu className="laporan-kepala">
          <div className="laporan-kop">
            <div className="kepala-logo besar"><Ikon I={GraduationCap} size={26} /></div>
            <div>
              <h2>Laporan Kinerja Guru — {labelPeriode}</h2>
              <p className="sub">{data.pengaturan.namaSekolah}</p>
            </div>
            <div className="skor-total">
              <span>Skor Total</span>
              <strong>{p.skorTotal}</strong>
            </div>
          </div>
          <div className="laporan-identitas">
            <div><span>Nama</span><strong>{p.g.nama}</strong></div>
            <div><span>NIK/NIP</span><strong>{p.g.nik || "-"}</strong></div>
            <div><span>Mapel</span><strong>{p.g.mapel}</strong></div>
            <div><span>Beban Mengajar</span><strong>{p.g.jam} jam/minggu</strong></div>
            <div><span>Status</span><strong>{p.g.status}</strong></div>
          </div>
          <div className="skor-rincian">
            <div><span>Struktural (bobot ×{BOBOT.struktural})</span><strong>{p.skorStruktural}</strong><em>Σ nilai × {BOBOT.struktural} · rata-rata {p.rataStruktural ? p.rataStruktural.toFixed(2) : "-"} dari {p.str.length} jabatan</em></div>
            <div><span>Insidental (bobot ×{BOBOT.insidental})</span><strong>{p.skorInsidental}</strong><em>Σ nilai × {BOBOT.insidental} · rata-rata {p.rataInsidental ? p.rataInsidental.toFixed(2) : "-"} dari {p.ins.length} tugas</em></div>
            <div><span>Catatan Kinerja</span><strong style={{ color: p.skorCatatan < 0 ? SIFAT_INFO.Negatif.warna : SIFAT_INFO.Positif.warna }}>{p.skorCatatan >= 0 ? "+" : ""}{p.skorCatatan}</strong><em>{p.cat.filter((r) => sifatCatatan(r) === "Positif").length} positif · {p.cat.filter((r) => sifatCatatan(r) === "Negatif").length} negatif</em></div>
          </div>
          {p.belumDinilai > 0 && (
            <p className="peringatan-nilai">
              <Ikon I={AlertTriangle} size={14} /> {p.belumDinilai} tugas belum dinilai dan belum masuk akumulasi skor. Beri penilaian di tab Tugas Struktural / Insidental.
            </p>
          )}
        </Kartu>

        <div className="grid-2">
          <Kartu>
            <div className="kartu-kepala"><h2>Profil Kinerja</h2><span className="sub">Enam dimensi (skala 0–100)</span></div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={p.radar} outerRadius="72%">
                <PolarGrid stroke="#dfe5dc" />
                <PolarAngleAxis dataKey="dimensi" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="nilai" stroke="#1a5632" fill="#1a5632" fillOpacity={0.28} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Kartu>

          <Kartu>
            <div className="kartu-kepala"><h2>Tugas Insidental per Kategori</h2><span className="sub">Jumlah tugas & total jam</span></div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={p.perKategori} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e4e8e2" />
                <XAxis dataKey="kategori" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="jumlah" name="Jumlah tugas" fill="#1a5632" radius={[3, 3, 0, 0]} />
                <Bar dataKey="jam" name="Total jam" fill="#c2912e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Kartu>

          <Kartu>
            <div className="kartu-kepala"><h2>Tren Beban Tugas Tambahan</h2><span className="sub">Jam per bulan, Juli–Juni</span></div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={p.perBulan} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e4e8e2" />
                <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="jam" name="Jam" stroke="#1a5632" strokeWidth={2.5} dot={{ r: 3, fill: "#1a5632" }} />
              </LineChart>
            </ResponsiveContainer>
          </Kartu>

          <Kartu>
            <div className="kartu-kepala"><h2>Proporsi Catatan Kinerja</h2><span className="sub">Per jenis catatan</span></div>
            {donat.length === 0 ? <Kosong pesan="Belum ada catatan kinerja pada periode ini." /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={donat} dataKey="jumlah" nameKey="jenis" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {donat.map((d) => <Cell key={d.jenis} fill={CAT_WARNA[d.jenis]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Kartu>
        </div>

        <Kartu>
          <div className="kartu-kepala"><h2>Rincian Tugas Struktural</h2></div>
          {p.str.length === 0 ? <p className="teks-redup">Tidak ada jabatan struktural.</p> : (
            <div className="tabel-bungkus"><table>
              <thead><tr><th>Jabatan</th><th>SK</th><th>Periode</th><th>Tupoksi</th><th>Penilaian</th><th className="ka">Skor</th></tr></thead>
              <tbody>{p.str.map((r) => (
                <tr key={r.id}><td><strong>{r.jabatan}</strong></td><td className="teks-kecil">{r.sk || "-"}</td>
                  <td className="teks-kecil nowrap">{fmtTgl(r.mulai)} – {fmtTgl(r.selesai)}</td><td className="teks-kecil">{r.tupoksi || "-"}</td>
                  <td><LencanaNilai nilai={r.nilai} /></td>
                  <td className="ka"><strong>{Number(r.nilai) ? Number(r.nilai) * BOBOT.struktural : "-"}</strong></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Kartu>

        <Kartu>
          <div className="kartu-kepala"><h2>Rincian Tugas Insidental</h2><span className="sub">{p.ins.length} tugas · {p.totalJamIns} jam</span></div>
          {p.ins.length === 0 ? <p className="teks-redup">Tidak ada tugas insidental pada periode ini.</p> : (
            <div className="tabel-bungkus"><table>
              <thead><tr><th>Tanggal</th><th>Kegiatan</th><th>Peran</th><th className="ka">Jam</th><th>Kategori</th><th>Penilaian</th><th className="ka">Skor</th></tr></thead>
              <tbody>{[...p.ins].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((r) => (
                <tr key={r.id}><td className="teks-kecil nowrap">{fmtTgl(r.tanggal)}</td><td>{r.kegiatan}</td>
                  <td className="teks-kecil">{r.peran || "-"}</td><td className="ka">{r.jam}</td>
                  <td><Lencana warna={KAT_WARNA[r.kategori]}>{r.kategori}</Lencana></td>
                  <td><LencanaNilai nilai={r.nilai} /></td>
                  <td className="ka"><strong>{Number(r.nilai) ? Number(r.nilai) * BOBOT.insidental : "-"}</strong></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Kartu>
      </div>
    </div>
  );
}

/* ================= GAYA ================= */

function Gaya() {
  return <style>{`
    :root {
      --hijau: #1a5632; --hijau-tua: #0f3d22; --hijau-muda: #eaf2ec;
      --emas: #c2912e; --tinta: #24301f; --redup: #6b7a6e;
      --garis: #dfe5dc; --latar: #f6f7f4; --kartu: #ffffff; --bahaya: #b23a3a;
    }
    * { box-sizing: border-box; }
    .app {
      min-height: 100vh; background: var(--latar); color: var(--tinta);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif; font-size: 14px;
      display: flex; flex-direction: column;
    }
    .muat { padding: 48px; text-align: center; color: #6b7a6e; font-family: system-ui; }

    .kepala {
      background: linear-gradient(120deg, var(--hijau-tua), var(--hijau) 70%);
      color: #fff; padding: 18px 22px; display: flex; justify-content: space-between;
      align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .kepala-merek { display: flex; align-items: center; gap: 13px; }
    .kepala-logo {
      width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center;
      background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
    }
    .kepala-logo.besar { width: 52px; height: 52px; background: var(--hijau-muda); color: var(--hijau); border-color: var(--garis); }
    .kepala h1 { margin: 0; font-size: 19px; letter-spacing: .2px; font-family: Georgia, "Times New Roman", serif; }
    .kepala p { margin: 2px 0 0; font-size: 12.5px; opacity: .85; }
    .kepala-filter { display: flex; gap: 8px; }

    .galat-bar { background: #fbecec; color: var(--bahaya); padding: 8px 22px; font-size: 13px; border-bottom: 1px solid #f0d4d4; }

    .navigasi {
      display: flex; gap: 2px; padding: 0 14px; background: var(--kartu);
      border-bottom: 1px solid var(--garis); overflow-x: auto;
    }
    .nav-item {
      display: flex; align-items: center; gap: 7px; padding: 12px 14px; border: none;
      background: none; cursor: pointer; font: inherit; font-size: 13.5px; color: var(--redup);
      border-bottom: 2.5px solid transparent; white-space: nowrap;
    }
    .nav-item:hover { color: var(--hijau); }
    .nav-item.aktif { color: var(--hijau); border-bottom-color: var(--emas); font-weight: 600; }
    .nav-item:focus-visible, .btn:focus-visible, .btn-ikon:focus-visible { outline: 2px solid var(--emas); outline-offset: 1px; }

    .isi { padding: 20px 22px; flex: 1; max-width: 1180px; width: 100%; margin: 0 auto; }
    .kaki { text-align: center; padding: 14px; font-size: 12px; color: var(--redup); }

    .susun-v { display: flex; flex-direction: column; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-stat { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .grid-catatan { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    @media (max-width: 860px) { .grid-2 { grid-template-columns: 1fr; } }

    .kartu { background: var(--kartu); border: 1px solid var(--garis); border-radius: 10px; padding: 16px 18px; }
    .kartu-kepala { margin-bottom: 12px; }
    .kartu-kepala.baris { display: flex; justify-content: space-between; align-items: baseline; }
    .kartu-kepala h2 { margin: 0; font-size: 15.5px; font-family: Georgia, serif; color: var(--hijau-tua); }
    .sub { font-size: 12px; color: var(--redup); }

    .stat { display: flex; gap: 12px; align-items: center; padding: 14px 16px; }
    .stat-ikon { width: 38px; height: 38px; border-radius: 9px; display: grid; place-items: center; background: var(--hijau-muda); color: var(--hijau); }
    .stat-angka { font-size: 22px; font-weight: 700; color: var(--hijau-tua); line-height: 1.1; }
    .stat-label { font-size: 11.5px; color: var(--redup); }

    .baris-alat { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
    .baris-alat.bungkus { flex-wrap: wrap; justify-content: flex-start; }
    .baris-alat .baris-alat { justify-content: flex-start; }
    .keterangan { margin: 0; color: var(--redup); font-size: 13px; max-width: 620px; }

    .btn {
      display: inline-flex; align-items: center; gap: 7px; border-radius: 8px; cursor: pointer;
      font: inherit; font-size: 13.5px; font-weight: 600; padding: 9px 14px; border: 1px solid transparent;
    }
    .btn-utama { background: var(--hijau); color: #fff; }
    .btn-utama:hover { background: var(--hijau-tua); }
    .btn-netral { background: #fff; color: var(--hijau-tua); border-color: var(--garis); }
    .btn-netral:hover { border-color: var(--hijau); }
    .btn-kecil { padding: 6px 10px; font-size: 12.5px; }
    .btn-ikon {
      border: none; background: none; cursor: pointer; color: var(--redup);
      width: 30px; height: 30px; border-radius: 7px; display: inline-grid; place-items: center;
    }
    .btn-ikon:hover { background: var(--hijau-muda); color: var(--hijau); }
    .btn-ikon.bahaya:hover { background: #fbecec; color: var(--bahaya); }

    .cari {
      display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--garis);
      border-radius: 8px; padding: 8px 12px; flex: 1; max-width: 340px; color: var(--redup);
    }
    .cari input { border: none; outline: none; font: inherit; width: 100%; color: var(--tinta); background: none; }

    .pilih-bungkus { position: relative; display: inline-flex; align-items: center; color: var(--redup); }
    .pilih-bungkus select {
      appearance: none; font: inherit; font-size: 13px; padding: 8px 30px 8px 12px;
      border: 1px solid var(--garis); border-radius: 8px; background: #fff; color: var(--tinta); cursor: pointer;
      max-width: 100%;
    }
    .kepala .pilih-bungkus select { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.3); }
    .kepala .pilih-bungkus { color: rgba(255,255,255,.8); }
    .kepala .pilih-bungkus select option { color: var(--tinta); }
    .pilih-bungkus svg { position: absolute; right: 10px; pointer-events: none; }
    .pilih-bungkus.besar select { font-size: 14.5px; font-weight: 600; min-width: 260px; }

    .tabel-bungkus { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--redup); padding: 8px 10px; border-bottom: 1.5px solid var(--garis); }
    td { padding: 10px; border-bottom: 1px solid #edf0ea; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafbf8; }
    .ka { text-align: right; }
    .nowrap { white-space: nowrap; }
    .teks-kecil { font-size: 12.5px; color: var(--redup); }
    .teks-redup { color: var(--redup); font-size: 13px; margin: 4px 0; }
    .aksi { white-space: nowrap; text-align: right; }
    .aksi.kanan { margin-top: 6px; }

    .lencana {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700;
      padding: 3px 8px; border-radius: 20px; border: 1px solid; white-space: nowrap;
    }

    .nilai-pilih {
      appearance: none; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
      padding: 5px 10px; border-radius: 20px; border: 1.5px solid; min-width: 128px;
      background-image: none;
    }
    .nilai-pilih:focus-visible { outline: 2px solid var(--emas); outline-offset: 1px; }
    .peringatan-nilai {
      display: flex; align-items: center; gap: 7px; margin: 12px 0 0; padding: 9px 13px;
      background: #fdf8ee; border: 1px solid #ecd9ab; border-radius: 8px;
      color: #8a6417; font-size: 12.5px;
    }

    .sesi-info { display: flex; align-items: center; gap: 10px; padding-left: 12px; border-left: 1px solid rgba(255,255,255,.25); }
    .sesi-peran { font-size: 12.5px; opacity: .9; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn-keluar { background: rgba(255,255,255,.14); color: #fff; border: 1px solid rgba(255,255,255,.35); padding: 7px 12px; font-size: 12.5px; }
    .btn-keluar:hover { background: rgba(255,255,255,.24); }

    .masuk-latar {
      min-height: 100vh; display: grid; place-items: center; padding: 20px;
      background: linear-gradient(150deg, var(--hijau-tua), var(--hijau) 60%, #2e7d4f);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    .masuk-kotak {
      background: #fff; border-radius: 14px; padding: 32px 30px; width: 100%; max-width: 380px;
      text-align: center; display: flex; flex-direction: column; gap: 8px;
      box-shadow: 0 18px 50px rgba(10,35,20,.35);
    }
    .masuk-kotak h1 { margin: 10px 0 0; font-size: 20px; font-family: Georgia, serif; color: var(--hijau-tua); }
    .masuk-kotak .btn { justify-content: center; margin-top: 6px; }
    .masuk-galat { margin: 0; color: var(--bahaya); font-size: 12.5px; text-align: left; }
    .masuk-catatan { margin: 10px 0 0; font-size: 11.5px; color: var(--redup); line-height: 1.55; }
    .masuk-kotak code { background: var(--hijau-muda); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
    .tautan-polos { background: none; border: none; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--hijau); text-decoration: underline; padding: 2px; }
    .info-realtime {
      background: var(--hijau-muda); border: 1px solid #cfe2d4; color: var(--hijau-tua);
      border-radius: 9px; padding: 9px 14px; font-size: 12.5px; margin-bottom: 14px;
    }

    .baris-lencana { display: flex; gap: 5px; flex-wrap: wrap; }
    .sifat-pilih { display: flex; gap: 8px; }
    .sifat-tombol {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
      padding: 9px 12px; border-radius: 8px; border: 1.5px solid; background: #fff;
    }
    .sifat-tombol:focus-visible { outline: 2px solid var(--emas); outline-offset: 1px; }

    .token-baris { display: flex; align-items: center; gap: 6px; }
    .token-baris input {
      font: inherit; font-size: 13px; padding: 7px 10px; border: 1px solid var(--garis);
      border-radius: 7px; width: 150px;
    }
    .token-baris input:focus { outline: 2px solid var(--hijau); outline-offset: -1px; }

    .kosong { text-align: center; padding: 28px 12px; color: var(--redup); display: flex; flex-direction: column; gap: 10px; align-items: center; }
    .kosong p { margin: 0; }

    .linimasa { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .linimasa li { display: flex; gap: 12px; align-items: flex-start; }
    .linimasa-tgl { font-size: 11.5px; color: var(--redup); white-space: nowrap; min-width: 84px; padding-top: 2px; }
    .linimasa p { margin: 2px 0 0; font-size: 13px; }

    .catatan-kartu { display: flex; flex-direction: column; gap: 6px; }
    .catatan-atas { display: flex; justify-content: space-between; align-items: center; }
    .catatan-kartu p { margin: 0; font-size: 13px; line-height: 1.5; }
    .tautan { color: var(--hijau); font-size: 12.5px; }

    .modal-latar { position: fixed; inset: 0; background: rgba(20,30,22,.45); display: grid; place-items: center; padding: 18px; z-index: 50; }
    .modal { background: #fff; border-radius: 12px; width: 100%; max-height: 90vh; overflow: auto; }
    .modal-kepala { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 8px; }
    .modal-kepala h3 { margin: 0; font-size: 16px; font-family: Georgia, serif; color: var(--hijau-tua); }
    .modal-isi { padding: 8px 20px 20px; }
    .form-grid { display: flex; flex-direction: column; gap: 12px; }
    .grid-2-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 520px) { .grid-2-form { grid-template-columns: 1fr; } }
    .kolom { display: flex; flex-direction: column; gap: 5px; }
    .kolom-label { font-size: 12px; font-weight: 600; color: var(--redup); }
    .kolom-label em { color: var(--bahaya); font-style: normal; }
    .kolom input, .kolom select, .kolom textarea {
      font: inherit; font-size: 13.5px; padding: 9px 11px; border: 1px solid var(--garis);
      border-radius: 8px; background: #fff; color: var(--tinta); width: 100%;
    }
    .kolom input:focus, .kolom select:focus, .kolom textarea:focus { outline: 2px solid var(--hijau); outline-offset: -1px; }
    .form-aksi { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }

    .laporan-kop { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .laporan-kop h2 { margin: 0; font-size: 17px; font-family: Georgia, serif; color: var(--hijau-tua); }
    .skor-total {
      margin-left: auto; text-align: center; background: var(--hijau); color: #fff;
      border-radius: 10px; padding: 8px 20px;
    }
    .skor-total span { font-size: 11px; opacity: .85; display: block; }
    .skor-total strong { font-size: 26px; }
    .laporan-identitas {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;
      margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--garis);
    }
    .laporan-identitas span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--redup); }
    .laporan-identitas strong { font-size: 13.5px; }
    .skor-rincian { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
    @media (max-width: 640px) { .skor-rincian { grid-template-columns: 1fr; } }
    .skor-rincian > div { background: var(--hijau-muda); border-radius: 9px; padding: 10px 14px; }
    .skor-rincian span { font-size: 11.5px; color: var(--redup); display: block; }
    .skor-rincian strong { font-size: 19px; color: var(--hijau-tua); }
    .skor-rincian em { display: block; font-size: 11px; color: var(--redup); font-style: normal; }

    @media print {
      .kepala, .navigasi, .baris-alat, .kaki, .galat-bar { display: none !important; }
      .app { background: #fff; }
      .isi { padding: 0; max-width: none; }
      .kartu { border: 1px solid #ccc; break-inside: avoid; }
      .grid-2 { grid-template-columns: 1fr 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
  `}</style>;
}
