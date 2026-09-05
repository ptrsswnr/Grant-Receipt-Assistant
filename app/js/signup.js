// ─────────────────────────────────────────────────────────────
// js/signup.js — สมัครสมาชิกด้วยอีเมล/รหัสผ่านของ Firebase Auth
// สร้างบัญชีแล้วเขียนเอกสาร users/{uid} ของตัวเอง (ได้รับอนุญาตตาม firestore.rules เพราะ
// request.auth.uid == userId) แล้วเด้งไป seed.html เพราะบัญชีใหม่ยังไม่มีโครงการวิจัยเป็นของตัวเอง
// (ยังไม่มีฟอร์มสร้างโครงการเอง — ดู BACKLOG.md FR-23)
// ─────────────────────────────────────────────────────────────

(function () {
  var ช่องอีเมล = document.getElementById("email");
  var ช่องรหัสผ่าน = document.getElementById("password");
  var ช่องยืนยันรหัสผ่าน = document.getElementById("confirmPassword");
  var กล่องเตือน = document.getElementById("ข้อความเตือน");
  var ปุ่ม = document.getElementById("ปุ่มสมัครสมาชิก");

  function เตือน(ข้อความ) {
    กล่องเตือน.textContent = "⚠️ " + ข้อความ;
    กล่องเตือน.style.display = "block";
  }

  function ล้างคำเตือน() {
    กล่องเตือน.style.display = "none";
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) location.href = "index.html";
  });

  var ข้อความError = {
    "auth/email-already-in-use": "อีเมลนี้มีผู้ใช้งานแล้ว",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/weak-password": "รหัสผ่านสั้นเกินไป (ต้องอย่างน้อย 6 ตัวอักษร)",
  };

  ปุ่ม.addEventListener("click", async function () {
    ล้างคำเตือน();

    var อีเมล = ช่องอีเมล.value.trim();
    var รหัสผ่าน = ช่องรหัสผ่าน.value;
    var ยืนยันรหัสผ่าน = ช่องยืนยันรหัสผ่าน.value;

    if (!อีเมล || !รหัสผ่าน || !ยืนยันรหัสผ่าน) {
      เตือน("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (รหัสผ่าน !== ยืนยันรหัสผ่าน) {
      เตือน("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    ปุ่ม.disabled = true;
    ปุ่ม.textContent = "กำลังสมัครสมาชิก...";
    try {
      var ผลลัพธ์ = await firebase.auth().createUserWithEmailAndPassword(อีเมล, รหัสผ่าน);
      await db.collection("users").doc(ผลลัพธ์.user.uid).set({
        fullName: อีเมล,
        email: อีเมล,
        roleType: "นักวิจัย/เจ้าของโครงการ",
      });
      location.href = "seed.html";
    } catch (err) {
      เตือน(ข้อความError[err.code] || err.message);
      ปุ่ม.disabled = false;
      ปุ่ม.textContent = "สมัครสมาชิก";
    }
  });
})();
