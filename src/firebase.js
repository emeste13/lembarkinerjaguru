// ============================================================
// KONFIGURASI FIREBASE — ISI BAGIAN INI
// Salin nilai dari Firebase Console:
// Project settings (ikon gerigi) → General → Your apps → SDK setup and configuration
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyApHpLT8A8yRkm8NFJa8pO2D2nsR_qriWc",
  authDomain: "lembar-kinerja-guru-smphbs.firebaseapp.com",
  projectId: "lembar-kinerja-guru-smphbs",
  storageBucket: "lembar-kinerja-guru-smphbs.firebasestorage.app",
  messagingSenderId: "233229540259ISI_SENDER_ID",
  appId: "1:233229540259:web:0b363184476db6e8b85816ISI_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
