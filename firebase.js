// ============================================================
// KONFIGURASI FIREBASE — ISI BAGIAN INI
// Salin nilai dari Firebase Console:
// Project settings (ikon gerigi) → General → Your apps → SDK setup and configuration
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "ISI_API_KEY_ANDA",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  storageBucket: "ISI_PROJECT_ID.appspot.com",
  messagingSenderId: "ISI_SENDER_ID",
  appId: "// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyApHpLT8A8yRkm8NFJa8pO2D2nsR_qriWc",
  authDomain: "lembar-kinerja-guru-smphbs.firebaseapp.com",
  databaseURL: "https://lembar-kinerja-guru-smphbs-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lembar-kinerja-guru-smphbs",
  storageBucket: "lembar-kinerja-guru-smphbs.firebasestorage.app",
  messagingSenderId: "233229540259",
  appId: "1:233229540259:web:0b363184476db6e8b85816",
  measurementId: "G-Q6Y6REJE7R"
};",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
