import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

// ============================================================
// KONFIGURASI FIREBASE — ISI BAGIAN INI
// Salin nilai dari Firebase Console:
// Project settings (ikon gerigi) → General → Your apps → SDK setup and configuration
// ============================================================
export const firebaseConfig = {
  apiKey: "ISI_API_KEY_ANDA",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  storageBucket: "ISI_PROJECT_ID.appspot.com",
  messagingSenderId: "ISI_SENDER_ID",
  appId: "ISI_APP_ID",
};

// VAPID key untuk Web Push — Firebase Console → Project Settings → Cloud Messaging →
// Web Push certificates → Generate key pair. Ini kunci PUBLIK, aman ditulis di kode klien.
export const VAPID_KEY = "ISI_VAPID_KEY_ANDA";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Messaging hanya didukung di browser tertentu (butuh HTTPS + service worker) — dibungkus
// aman supaya tidak error di lingkungan yang tidak mendukung (mis. beberapa browser desktop lama).
export let messaging = null;
export const messagingSiap = isSupported().then((ok) => {
  if (ok) messaging = getMessaging(app);
  return ok;
});
