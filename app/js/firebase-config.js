// ─────────────────────────────────────────────────────────────
// js/firebase-config.js — ตั้งค่าการเชื่อมต่อ Firebase (โปรเจกต์ grant-receipt-assistant)
// ใช้ Firebase JS SDK แบบ "compat" (โหลดด้วย <script> ธรรมดา ไม่ใช่ module)
// เพราะเว็บนี้เปิดตรงจากไฟล์ (file://) ได้ — เบราว์เซอร์บล็อก type="module" บน file://
// apiKey ของเว็บแอปไม่ใช่ความลับ — ความปลอดภัยจริงมาจาก Firestore Security Rules
// ต้องโหลดหลัง firebase-app-compat.js, firebase-firestore-compat.js และ
// firebase-storage-compat.js (เฉพาะหน้าที่อัปโหลดไฟล์) เท่านั้น
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
window.db = firebase.firestore();
// firebase.storage() ใช้ได้เฉพาะหน้าที่โหลด firebase-storage-compat.js ไว้ด้วย
if (firebase.storage) {
  window.storage = firebase.storage();
}
