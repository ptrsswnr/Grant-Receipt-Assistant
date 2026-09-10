// ─────────────────────────────────────────────────────────────
// js/signup.js — สมัครสมาชิกด้วยอีเมล/รหัสผ่านของ Firebase Auth
// สร้างบัญชีแล้วเขียนเอกสาร users/{uid} ของตัวเอง (ได้รับอนุญาตตาม firestore.rules เพราะ
// request.auth.uid == userId) แล้วเด้งไป projects.html ให้สร้างโครงการวิจัยแรกของตัวเอง (FR-23)
// isAdmin ตั้งเป็น false เสมอตอนสมัคร — ไม่มี UI ให้ผู้ใช้ตั้งตัวเองเป็น admin, ต้องเปลี่ยนค่านี้เป็น
// true ผ่าน Firebase Console เอง (ดู CLAUDE.md หัวข้อ Auth) ถึงจะเข้าหน้า fund-sources.html ได้
// ─────────────────────────────────────────────────────────────

(function () {
  var fullNameInput = document.getElementById("fullName");
  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");
  var confirmPasswordInput = document.getElementById("confirmPassword");
  var warningBox = document.getElementById("warningBox");
  var signupButton = document.getElementById("signupButton");

  function warn(message) {
    warningBox.textContent = "⚠️ " + message;
    warningBox.style.display = "block";
  }

  function clearWarning() {
    warningBox.style.display = "none";
  }

  // ล็อกอินอยู่แล้ว (เช่น session ค้างจากรอบก่อน) → เด้งเข้า index.html เลย — แต่ต้องข้ามเช็คนี้ระหว่าง
  // กำลังสมัครสมาชิกอยู่ (ตัวแปร signingUp ด้านล่าง) เพราะ createUserWithEmailAndPassword ก็ทำให้
  // auth state เปลี่ยนเหมือนกัน ถ้าไม่กันไว้จะแย่งกันเปลี่ยนหน้ากับ location.href = "projects.html"
  // ในตัวจัดการปุ่มด้านล่าง (เจอจริงตอนทดสอบ — เด้งไป index.html แทน projects.html ทุกครั้ง)
  var signingUp = false;
  firebase.auth().onAuthStateChanged(function (user) {
    if (user && !signingUp) location.href = "index.html";
  });

  var errorMessages = {
    "auth/email-already-in-use": "อีเมลนี้มีผู้ใช้งานแล้ว",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/weak-password": "รหัสผ่านสั้นเกินไป (ต้องอย่างน้อย 6 ตัวอักษร)",
  };

  signupButton.addEventListener("click", async function () {
    clearWarning();

    var fullName = fullNameInput.value.trim();
    var email = emailInput.value.trim();
    var password = passwordInput.value;
    var confirmPassword = confirmPasswordInput.value;

    if (!fullName || !email || !password || !confirmPassword) {
      warn("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (password !== confirmPassword) {
      warn("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    signingUp = true;
    signupButton.disabled = true;
    signupButton.textContent = "กำลังสมัครสมาชิก...";
    try {
      var result = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await db.collection("users").doc(result.user.uid).set({
        fullName: fullName,
        email: email,
        roleType: "นักวิจัย/เจ้าของโครงการ",
        isAdmin: false,
      });
      location.href = "projects.html";
    } catch (err) {
      signingUp = false;
      warn(errorMessages[err.code] || err.message);
      signupButton.disabled = false;
      signupButton.textContent = "สมัครสมาชิก";
    }
  });
})();
