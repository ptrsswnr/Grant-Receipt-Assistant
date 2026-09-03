// ─────────────────────────────────────────────────────────────
// js/receipts.js — หน้ารายการใบเสร็จของฉัน
// อ่านข้อมูลจาก Firestore จริง (collection receipts) — ไม่ใช่ mock ในโค้ด
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
  if (!files || files.length === 0) return "";
  var links = files
    .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); })
    .map(function (f) {
      if (f.fileReference) {
        return '<a href="' + esc(f.fileReference) + '" target="_blank" rel="noopener">📎 ' + esc(f.originalFileName) + '</a>';
      }
      return '<span>📎 ' + esc(f.originalFileName) + ' (mock — ยังไม่มีไฟล์จริงอัปโหลด)</span>';
    })
    .join(" · ");
  return '<div class="text-small" style="margin-bottom:24px;">ไฟล์แนบ: ' + links + '</div>';
}

function receiptCardHtml(receipt, files, projectName) {
  var chipClass = STATUS_CHIP_CLASS[receipt.status] || "chip-status--pending";
  var calloutKind = chipClass.indexOf("pass") > -1 ? "pass" : chipClass.indexOf("fix") > -1 ? "fix" : "reject";
  var html =
    '<div class="receipt-card" style="margin-bottom:12px;">' +
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
      '<div class="rule-callout rule-callout--' + calloutKind + '" style="margin-bottom:24px;">' +
        '<p class="rule-callout__explain">' + esc(receipt.aiExplanation) + '</p>' +
      '</div>';
  }
  return html;
}

(async function loadReceipts() {
  var loadState = document.getElementById("load-state");
  var list = document.getElementById("receipt-list");

  try {
    var snapshot = await db.collection("receipts").orderBy("uploadedAt", "desc").get();

    if (snapshot.empty) {
      loadState.innerHTML =
        '<div class="banner banner--warning">' +
          '<p class="text-body">ยังไม่มีข้อมูลใน collection <code>receipts</code> — ไปที่หน้า ' +
          '<a href="seed.html">🌱 ใส่ข้อมูลตัวอย่าง</a> ก่อน (ต้องตั้ง Firestore Rules ให้เขียนได้ด้วย ดู firestore.rules)</p>' +
        '</div>';
      return;
    }

    var projectsSnapshot = await db.collection("projects").get();
    var projectNameById = {};
    projectsSnapshot.forEach(function (p) { projectNameById[p.id] = p.data().projectName; });

    var htmlParts = await Promise.all(snapshot.docs.map(async function (doc) {
      var filesSnapshot = await doc.ref.collection("files").get();
      var files = filesSnapshot.docs.map(function (f) { return f.data(); });
      var receipt = doc.data();
      return receiptCardHtml(receipt, files, projectNameById[receipt.projectId]);
    }));

    list.innerHTML = htmlParts.join("");
    list.style.display = "block";
    loadState.style.display = "none";
  } catch (err) {
    loadState.innerHTML =
      '<div class="banner banner--error">' +
        '<p class="text-body"><strong>โหลดข้อมูลไม่สำเร็จ:</strong> ' + esc(err.message) + '</p>' +
        '<p class="text-small">ตรวจสอบว่า Firestore Rules อนุญาต read (<code>allow read: if true;</code>) ' +
        'และมี collection <code>receipts</code> อยู่จริงแล้ว</p>' +
      '</div>';
    console.error(err);
  }
})();
