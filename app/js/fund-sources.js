// ─────────────────────────────────────────────────────────────
// js/fund-sources.js — หน้า "จัดการแหล่งทุน" สำหรับ admin เท่านั้น (ส่วนหนึ่งของ FR-11)
// ไม่มีระบบ role/custom-claim จริง — เช็คจาก field isAdmin บนเอกสาร users/{uid} ของตัวเอง
// (ต้องเปิด Firebase Console แล้วตั้งค่าเองด้วยมือ ยังไม่มี UI ให้ตั้ง admin คนแรก) หน้านี้เช็คสิทธิ์
// ฝั่ง client เพื่อซ่อน/แสดงฟอร์มเท่านั้น — ตัวบังคับจริงคือ firestore.rules ที่เช็ค isAdmin ก่อน
// อนุญาตเขียน fundSources เสมอ (ดู ACL.md) จึงปลอดภัยแม้ผู้ใช้จะพยายามเลี่ยงเช็คฝั่ง client
// ─────────────────────────────────────────────────────────────

(async function () {
  var adminCheck = document.getElementById("admin-check");
  var adminOnly = document.getElementById("admin-only");
  var fundSourceNameInput = document.getElementById("fundSourceName");
  var fundSourceCodeInput = document.getElementById("fundSourceCode");
  var warningBox = document.getElementById("warningBox");
  var addFundSourceButton = document.getElementById("addFundSourceButton");
  var loadState = document.getElementById("load-state");
  var fundSourceList = document.getElementById("fund-source-list");

  function warn(message) {
    warningBox.textContent = "⚠️ " + message;
    warningBox.style.display = "block";
  }
  function clearWarning() {
    warningBox.style.display = "none";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var user = await window.AUTH_READY;

  var userDoc = await db.collection("users").doc(user.uid).get();
  var isAdmin = userDoc.exists && userDoc.data().isAdmin === true;

  if (!isAdmin) {
    adminCheck.innerHTML =
      '<div class="banner banner--error">' +
        '<p class="text-body">หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น — บัญชีนี้ยังไม่มีสิทธิ์ admin</p>' +
      '</div>';
    return;
  }

  adminCheck.style.display = "none";
  adminOnly.style.display = "block";

  function fundSourceCardHtml(fs) {
    return (
      '<div class="card">' +
        '<h4>' + esc(fs.fundSourceName) + '</h4>' +
        '<p class="text-small text-mono">' + esc(fs.fundSourceCode) + '</p>' +
      '</div>'
    );
  }

  async function loadFundSourceList() {
    var snapshot = await db.collection("fundSources").get();

    if (snapshot.empty) {
      loadState.innerHTML = '<div class="banner banner--info"><p class="text-body">ยังไม่มีแหล่งทุนในระบบ — เพิ่มรายการแรกด้านบนได้เลย</p></div>';
      fundSourceList.style.display = "none";
      return snapshot.docs;
    }

    fundSourceList.innerHTML = snapshot.docs.map(function (doc) { return fundSourceCardHtml(doc.data()); }).join("");
    fundSourceList.style.display = "block";
    loadState.style.display = "none";
    return snapshot.docs;
  }

  // หารหัสถัดไปแบบ fundsource001, fundsource002, ... จากรหัสเดิมที่มีอยู่จริง
  function nextFundSourceId(existingDocs) {
    var maxNumber = 0;
    existingDocs.forEach(function (doc) {
      var m = doc.id.match(/^fundsource(\d+)$/);
      if (m) maxNumber = Math.max(maxNumber, parseInt(m[1], 10));
    });
    return "fundsource" + String(maxNumber + 1).padStart(3, "0");
  }

  var existingDocs;
  try {
    existingDocs = await loadFundSourceList();
  } catch (err) {
    loadState.innerHTML = '<div class="banner banner--error"><p class="text-body"><strong>โหลดข้อมูลไม่สำเร็จ:</strong> ' + esc(err.message) + '</p></div>';
    existingDocs = [];
  }

  addFundSourceButton.addEventListener("click", async function () {
    clearWarning();

    var fundSourceName = fundSourceNameInput.value.trim();
    var fundSourceCode = fundSourceCodeInput.value.trim();

    if (!fundSourceName || !fundSourceCode) {
      warn("กรุณากรอกชื่อและรหัสแหล่งทุนให้ครบ");
      return;
    }

    addFundSourceButton.disabled = true;
    addFundSourceButton.textContent = "กำลังเพิ่มแหล่งทุน...";
    try {
      var newFundSourceId = nextFundSourceId(existingDocs);
      await db.collection("fundSources").doc(newFundSourceId).set({
        fundSourceName: fundSourceName,
        fundSourceCode: fundSourceCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      fundSourceNameInput.value = "";
      fundSourceCodeInput.value = "";
      existingDocs = await loadFundSourceList();
    } catch (err) {
      warn("เพิ่มแหล่งทุนไม่สำเร็จ: " + err.message + " (เช็คว่าบัญชีนี้มี isAdmin: true ใน Firestore และ firestore.rules deploy แล้วหรือยัง)");
    } finally {
      addFundSourceButton.disabled = false;
      addFundSourceButton.textContent = "เพิ่มแหล่งทุน";
    }
  });
})();
