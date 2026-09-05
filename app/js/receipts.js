// ─────────────────────────────────────────────────────────────
// js/receipts.js — หน้ารายการใบเสร็จของฉัน
// อ่านข้อมูลจาก Firestore จริง — ไม่ใช่ mock ในโค้ด
// receipts อยู่ซ้อนใน users/{userId}/projects/{projectId}/receipts/{id} (ดูเหตุผลใน js/seed.js)
// หน้านี้ต้องแสดงใบเสร็จของทุกโครงการของผู้ใช้ที่ล็อกอินอยู่รวมกัน จึงใช้ collectionGroup("receipts")
// แทน db.collection("receipts") เดิม กรองด้วย .where("ownerUserId", "==", uid) เพื่อไม่ให้เห็นข้อมูล
// ของผู้ใช้คนอื่น (ownerUserId เป็น field ที่ denormalize ไว้บนเอกสาร receipt เอง — ดู firestore.rules
// ที่ต้องอิง field นี้เช็คสิทธิ์การอ่านของ collectionGroup query แบบนี้ด้วย) — ครั้งแรกที่รันอาจเจอ
// error ขอให้สร้าง Firestore composite index ก่อน (ดูคำอธิบายใน catch ด้านล่าง)
// ─────────────────────────────────────────────────────────────

var STATUS_CHIP_CLASS = {
  "ผ่าน": "chip-status--pass",
  "ต้องแก้ไข": "chip-status--fix",
  "ไม่เข้าเงื่อนไข": "chip-status--reject",
};

function formatCurrency(amount) {
  if (typeof amount !== "number") return "-";
  return "฿" + amount.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function filesHtml(files) {
  if (!files || files.length === 0) {
    return '<p class="text-small">ไฟล์แนบ: ไม่มี (ไม่ได้แนบไฟล์จริงตอนอัปโหลด — โหมดสาธิต)</p>';
  }
  var links = files
    .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); })
    .map(function (f) {
      if (f.fileReference) {
        return '<a href="' + esc(f.fileReference) + '" target="_blank" rel="noopener">📎 ' + esc(f.originalFileName) + '</a>';
      }
      return '<span>📎 ' + esc(f.originalFileName) + ' (mock — ยังไม่มีไฟล์จริงอัปโหลด)</span>';
    })
    .join(" · ");
  return '<p class="text-small">ไฟล์แนบ: ' + links + '</p>';
}

// การ์ดใบเสร็จ + ไฟล์แนบ + คำอธิบายผลตรวจของใบเสร็จ 1 รายการ ถูกห่อไว้ใน .receipt-entry
// เดียวกันเสมอ (เส้นขอบล้อมรอบทั้งกลุ่ม) เพื่อไม่ให้สับสนว่าคำอธิบายไหนเป็นของใบเสร็จรายการใด
// เวลามีหลายรายการเรียงต่อกัน
function receiptCardHtml(receipt, files, projectName) {
  var chipClass = STATUS_CHIP_CLASS[receipt.status] || "chip-status--pending";
  var calloutKind = chipClass.indexOf("pass") > -1 ? "pass" : chipClass.indexOf("fix") > -1 ? "fix" : "reject";

  var html = '<div class="receipt-entry">';
  html +=
    '<div class="receipt-card">' +
      '<div class="receipt-card__thumb">🧾</div>' +
      '<div class="receipt-card__body">' +
        '<div class="receipt-card__amount">' + esc(formatCurrency(receipt.confirmedAmount)) + '</div>' +
        '<div class="receipt-card__meta">' + esc(projectName || "(ไม่พบโครงการ)") + ' · ' + esc(receipt.confirmedDate) + ' · ' + esc(receipt.confirmedCategory) + ' · ' + esc(receipt.confirmedVendorName) + '</div>' +
      '</div>' +
      '<div class="receipt-card__status">' +
        '<span class="chip-status ' + chipClass + '">' + esc(receipt.status || "ไม่ทราบสถานะ") + '</span>' +
      '</div>' +
    '</div>';

  html += filesHtml(files);

  if (receipt.aiExplanation) {
    html +=
      '<div class="rule-callout rule-callout--' + calloutKind + '">' +
        '<p class="rule-callout__explain">' + esc(receipt.aiExplanation) + '</p>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

(async function loadReceipts() {
  var loadState = document.getElementById("load-state");
  var list = document.getElementById("receipt-list");

  try {
    var user = await window.AUTH_READY;
    var snapshot = await db.collectionGroup("receipts")
      .where("ownerUserId", "==", user.uid)
      .orderBy("uploadedAt", "desc")
      .get();

    if (snapshot.empty) {
      loadState.innerHTML =
        '<div class="banner banner--warning">' +
          '<p class="text-body">ยังไม่มีข้อมูลใน collection <code>receipts</code> — ไปที่หน้า ' +
          '<a href="seed.html">🌱 ใส่ข้อมูลตัวอย่าง</a> ก่อน (ต้องตั้ง Firestore Rules ให้เขียนได้ด้วย ดู firestore.rules)</p>' +
        '</div>';
      return;
    }

    var htmlParts = await Promise.all(snapshot.docs.map(async function (doc) {
      var filesSnapshot = await doc.ref.collection("files").get();
      var files = filesSnapshot.docs.map(function (f) { return f.data(); });
      var receipt = doc.data();

      // parent ของ collection "receipts" คือเอกสารโครงการ (users/{u}/projects/{p}) เสมอ
      // ยกเว้นใบเสร็จเก่าจากโครงสร้าง flat (ก่อน 2026-09-05) ที่ไม่มี parent — เผื่อไว้กันพัง
      var projectRef = doc.ref.parent.parent;
      var projectName = "(ข้อมูลจากโครงสร้างเก่า — ไปที่หน้า seed.html แล้วกด \"ล้างข้อมูลโครงสร้างเก่า\")";
      if (projectRef) {
        var projectSnap = await projectRef.get();
        projectName = projectSnap.exists ? projectSnap.data().projectName : "(ไม่พบโครงการ)";
      }

      return receiptCardHtml(receipt, files, projectName);
    }));

    list.innerHTML = htmlParts.join("");
    list.style.display = "block";
    loadState.style.display = "none";
  } catch (err) {
    // Firestore query แบบ collectionGroup + orderBy ต้องมี index รองรับ — ครั้งแรกที่ query แบบ
    // นี้มักจะยังไม่มี index จึงโยน error พร้อมลิงก์สร้าง index มาด้วยเสมอ (แกะลิงก์ออกมาทำเป็น
    // ปุ่มคลิกได้จริง แทนที่จะโยน error message ดิบๆ เป็น plain text ให้อ่านเอง)
    var ลิงก์สร้างIndex = String(err.message || "").match(/https:\/\/console\.firebase\.google\.com\S*/);

    if (ลิงก์สร้างIndex) {
      loadState.innerHTML =
        '<div class="banner banner--warning">' +
          '<p class="text-body"><strong>ยังไม่มี Firestore index สำหรับ query นี้</strong> — เกิดขึ้นเป็น ' +
          'ปกติตอนใช้ collection group query ครั้งแรก (อ่านใบเสร็จรวมข้ามทุกโครงการ) ต้องสร้าง index ' +
          '1 ครั้งใน Firebase Console ก่อน (ทำครั้งเดียว ไม่ต้องทำซ้ำอีก)</p>' +
          '<p class="text-body"><a href="' + esc(ลิงก์สร้างIndex[0]) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">' +
            'เปิด Firebase Console เพื่อสร้าง Index' +
          '</a></p>' +
          '<p class="text-small">ล็อกอินด้วยบัญชีที่มีสิทธิ์ในโปรเจกต์นี้ → กด "Create Index" → รอสถานะ ' +
          'เปลี่ยนจาก "Building" เป็น "Enabled" (ประมาณ 1-2 นาที) → กลับมาโหลดหน้านี้ใหม่</p>' +
        '</div>';
    } else {
      loadState.innerHTML =
        '<div class="banner banner--error">' +
          '<p class="text-body"><strong>โหลดข้อมูลไม่สำเร็จ:</strong> ' + esc(err.message) + '</p>' +
          '<p class="text-small">ตรวจสอบว่า Firestore Rules อนุญาต read ด้วย (ดู firestore.rules ว่า deploy ' +
          'ขึ้น Firebase Console แล้วหรือยัง)</p>' +
        '</div>';
    }
    console.error(err);
  }
})();
