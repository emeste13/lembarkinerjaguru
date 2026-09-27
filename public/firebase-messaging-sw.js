// ============================================================
// SERVICE WORKER — menangani notifikasi push (FCM) saat aplikasi TERTUTUP
// atau di latar belakang. Juga berfungsi sebagai service worker dasar untuk PWA.
//
// PENTING: file ini TIDAK diproses oleh Vite (murni file statis di folder public/),
// jadi firebaseConfig di bawah harus DISALIN MANUAL dan disamakan dengan isi
// src/firebase.js setiap kali firebaseConfig berubah (mis. saat dipakai sekolah lain).
// Nilai-nilai ini bersifat publik (bukan rahasia), aman ditulis di sini.
// ============================================================

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "ISI_API_KEY_ANDA",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  storageBucket: "ISI_PROJECT_ID.appspot.com",
  messagingSenderId: "ISI_SENDER_ID",
  appId: "ISI_APP_ID",
});

const messaging = firebase.messaging();

// Notifikasi yang tiba saat aplikasi TERTUTUP / di tab lain — tampilkan lewat notifikasi sistem HP.
messaging.onBackgroundMessage((payload) => {
  const judul = payload.notification?.title || "Catatan Kinerja Guru";
  const opsi = {
    body: payload.notification?.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  };
  self.registration.showNotification(judul, opsi);
});

// Saat notifikasi diketuk: buka/fokuskan aplikasi
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((daftar) => {
      for (const c of daftar) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
