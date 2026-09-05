// ─────────────────────────────────────────────────────────────
// js/firebase-config.js — ตั้งค่าการเชื่อมต่อ Firebase (โปรเจกต์ grant-receipt-assistant)
// ใช้ Firebase JS SDK แบบ "compat" (โหลดด้วย <script> ธรรมดา ไม่ใช่ module)
// เพราะเว็บนี้เปิดตรงจากไฟล์ (file://) ได้ — เบราว์เซอร์บล็อก type="module" บน file://
// apiKey ของเว็บแอปไม่ใช่ความลับ — ความปลอดภัยจริงมาจาก Firestore Security Rules
// ต้องโหลดหลัง firebase-app-compat.js, firebase-auth-compat.js (ทุกหน้า), firebase-firestore-compat.js
// และ firebase-storage-compat.js (เฉพาะหน้าที่ต้องใช้ SDK นั้นๆ) เท่านั้น
// ─────────────────────────────────────────────────────────────

var firebaseConfig = {
  apiKey: "AIzaSyBS1Pi2xs3RTQQFG5ox6HDK1iOPnjFY5iE",
  authDomain: "grant-receipt-assistant.firebaseapp.com",
  projectId: "grant-receipt-assistant",
  storageBucket: "grant-receipt-assistant.firebasestorage.app",
  messagingSenderId: "748022324743",
  appId: "1:748022324743:web:d75edfffdb66c50ad354a2",
  measurementId: "G-783V7JH4S4",
};

firebase.initializeApp(firebaseConfig);
// firebase.firestore()/firebase.storage() ใช้ได้เฉพาะหน้าที่โหลด firebase-firestore-compat.js /
// firebase-storage-compat.js ไว้ด้วย (บางหน้า เช่น index.html/login.html/signup.html ใช้แค่ auth
// ไม่ต้องโหลด firestore SDK มาเปล่าๆ)
if (firebase.firestore) {
  window.db = firebase.firestore();
}
if (firebase.storage) {
  window.storage = firebase.storage();
}
