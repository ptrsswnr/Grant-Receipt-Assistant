// ─────────────────────────────────────────────────────────────
// js/login.js — ฟอร์มเข้าสู่ระบบด้วยอีเมล/รหัสผ่านของ Firebase Auth
// ไม่มี nav.js/auth-guard.js ในหน้านี้ (หน้านี้เองคือทางเข้าก่อนมี auth-guard ได้)
// ─────────────────────────────────────────────────────────────

(function () {
  var ช่องอีเมล = document.getElementById("email");
  var ช่องรหัสผ่าน = document.getElementById("password");
  var กล่องเตือน = document.getElementById("ข้อความเตือน");
  var ปุ่ม = document.getElementById("ปุ่มเข้าสู่ระบบ");

  function เตือน(ข้อความ) {
    กล่องเตือน.textContent = "⚠️ " + ข้อความ;
    กล่องเตือน.style.display = "block";
  }

  function ล้างคำเตือน() {
    กล่องเตือน.style.display = "none";
  }

  // ล็อกอินอยู่แล้ว (เช่น session ค้างจากรอบก่อน) → ไม่ต้องแสดงฟอร์มซ้ำ เด้งเข้า index.html เลย
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) location.href = "index.html";
  });

  var ข้อความError = {
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/user-not-found": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/too-many-requests": "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
    "auth/user-disabled": "บัญชีนี้ถูกระงับการใช้งาน",
  };

  ปุ่ม.addEventListener("click", async function () {
    ล้างคำเตือน();

    var อีเมล = ช่องอีเมล.value.trim();
    var รหัสผ่าน = ช่องรหัสผ่าน.value;

    if (!อีเมล || !รหัสผ่าน) {
      เตือน("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    ปุ่ม.disabled = true;
    ปุ่ม.textContent = "กำลังเข้าสู่ระบบ...";
    try {
      await firebase.auth().signInWithEmailAndPassword(อีเมล, รหัสผ่าน);
      location.href = "index.html";
    } catch (err) {
      เตือน(ข้อความError[err.code] || err.message);
      ปุ่ม.disabled = false;
      ปุ่ม.textContent = "เข้าสู่ระบบ";
    }
  });
})();
