import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyApHpLT8A8yRkm8NFJa8pO2D2nsR_qriWc",
  authDomain: "lembar-kinerja-guru-smphbs.firebaseapp.com",
  projectId: "lembar-kinerja-guru-smphbs",
  storageBucket: "lembar-kinerja-guru-smphbs.firebasestorage.app",
  messagingSenderId: "233229540259",
  appId: "1:233229540259:web:0b363184476db6e8b85816",
};

// VAPID key untuk Web Push — hasil ekstraksi dari appId yang sebelumnya tertimpa.
// MOHON VERIFIKASI di Firebase Console → Project Settings → Cloud Messaging →
// Web Push certificates sebelum benar-benar dipakai.
export const VAPID_KEY = "BE7Dy8TR0e1tDeGdASYLl15u86pNzxA3qfsJRQovOYS_p_DQ66EVchxyGxbP2cD8U0Wftg2HP1nyiFM-gIFqoAU";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Messaging hanya didukung di browser tertentu (butuh HTTPS + service worker) — dibungkus
// aman supaya tidak error di lingkungan yang tidak mendukung.
export let messaging = null;
export const messagingSiap = isSupported().then((ok) => {
  if (ok) messaging = getMessaging(app);
  return ok;
});
