// ─────────────────────────────────────────────────────────────
// js/receipts.js — หน้ารายการใบเสร็จของฉัน (หรือของโครงการเดียว ถ้ามี ?projectId= ใน URL)
// อ่านข้อมูลจาก Firestore จริง — ไม่ใช่ mock ในโค้ด
// receipts อยู่ซ้อนใน users/{userId}/projects/{projectId}/receipts/{id} (ดูเหตุผลใน js/seed.js)
// หน้านี้ต้องแสดงใบเสร็จของทุกโครงการของผู้ใช้ที่ล็อกอินอยู่รวมกัน จึงใช้ collectionGroup("receipts")
// แทน db.collection("receipts") เดิม กรองด้วย .where("ownerUserId", "==", uid) เพื่อไม่ให้เห็นข้อมูล
// ของผู้ใช้คนอื่น (ownerUserId เป็น field ที่ denormalize ไว้บนเอกสาร receipt เอง — ดู firestore.rules
// ที่ต้องอิง field นี้เช็คสิทธิ์การอ่านของ collectionGroup query แบบนี้ด้วย) — ครั้งแรกที่รันอาจเจอ
// error ขอให้สร้าง Firestore composite index ก่อน (ดูคำอธิบายใน catch ด้านล่าง)
//
// ถ้ามาจาก app/projects.html (ลิงก์ "ใบเสร็จในโครงการนี้") จะมี ?projectId=xxx ใน URL — กรอง
// เฉพาะใบเสร็จของโครงการนั้นฝั่ง client (ยังคง fetch ทุกใบของผู้ใช้เหมือนเดิม แค่กรองผลลัพธ์ก่อนแสดง
// ไม่ต้อง query ใหม่/ไม่ต้องมี index เพิ่ม) พร้อมเปลี่ยนหัวข้อหน้าให้ระบุชื่อโครงการและมีปุ่ม
// "อัปโหลดใบเสร็จในโครงการนี้" ต่อไปยัง new-receipt.html?projectId=xxx
//
// ปุ่ม "ลบ" ต่อใบเสร็จ — ลบได้เฉพาะใบเสร็จของตัวเอง อาศัย firestore.rules เดิมที่อนุญาตให้เจ้าของ
// (request.auth.uid == userId ใน path users/{userId}/...) write (ซึ่งครอบคลุม delete ด้วย) เอกสาร
// receipt ของตัวเองอยู่แล้ว — ไม่ต้องแก้ rules เพิ่ม ลบผ่าน doc.ref ตรงๆ (path มี uid ของเจ้าของ
// อยู่แล้ว คนอื่นเดา path มาลบใบเสร็จของเราไม่ได้อยู่ดีเพราะ rules เช็คจาก path จริง ไม่ใช่แค่ซ่อนปุ่ม)
// cascade ลบ subcollection "files" (เอกสารอ้างอิงไฟล์แนบใน Firestore) ไปด้วย — ไม่ลบไฟล์จริงใน
// Google Drive ด้วย (ลบแค่เอกสารอ้างอิงใน Firestore) — ดู CLAUDE.md หัวข้อ "แนบไฟล์จริงผ่าน Google Drive"
// ─────────────────────────────────────────────────────────────

var STATUS_CHIP_CLASS = {
  "ผ่าน": "chip-status--pass",
  "ต้องแก้ไข": "chip-status--fix",
  "ต้องชี้แจง/ขออนุมัติ": "chip-status--approval",
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
        return '<a href="' + esc(f.fileReference) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> ' + esc(f.originalFileName) + '</a>';
      }
      return '<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> ' + esc(f.originalFileName) + ' (mock — ยังไม่มีไฟล์จริงอัปโหลด)</span>';
    })
    .join(" · ");
  return '<p class="text-small">ไฟล์แนบ: ' + links + '</p>';
}

// การ์ดใบเสร็จ + ไฟล์แนบ + คำอธิบายผลตรวจของใบเสร็จ 1 รายการ ถูกห่อไว้ใน .receipt-entry
// เดียวกันเสมอ (เส้นขอบล้อมรอบทั้งกลุ่ม) เพื่อไม่ให้สับสนว่าคำอธิบายไหนเป็นของใบเสร็จรายการใด
// เวลามีหลายรายการเรียงต่อกัน — data-receipt-path ใช้ระบุตัวใบเสร็จให้ปุ่มลบ (event delegation)
function receiptCardHtml(receiptPath, receipt, files, projectName) {
  var chipClass = STATUS_CHIP_CLASS[receipt.status] || "chip-status--pending";
  var calloutKind = chipClass.replace("chip-status--", "").replace("pending", "reject");

  var html = '<div class="receipt-entry" data-receipt-path="' + esc(receiptPath) + '">';
  html +=
    '<div class="receipt-card">' +
      '<div class="receipt-card__thumb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>' +
      '<div class="receipt-card__body">' +
        '<div class="receipt-card__amount">' + esc(formatCurrency(receipt.confirmedAmount)) + '</div>' +
        '<div class="receipt-card__meta">' + esc(projectName || "(ไม่พบโครงการ)") + ' · ' + esc(receipt.confirmedDate) + ' · ' + esc(receipt.confirmedCategory) + ' · ' + esc(receipt.confirmedVendorName) + '</div>' +
      '</div>' +
      '<div class="receipt-card__status">' +
        '<span class="chip-status ' + chipClass + '">' + esc(receipt.status || "ไม่ทราบสถานะ") + '</span>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="delete-receipt">ลบ</button>' +
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

// รายการย่อในแผงสีฟ้าด้านซ้าย (จอใหญ่) — คลิกแล้วแสดงรายละเอียดใบนั้นในแผงขวา
function paneItemHtml(receiptPath, receipt) {
  var chipClass = STATUS_CHIP_CLASS[receipt.status] || "chip-status--pending";
  return '<button type="button" class="receipt-pane__item" data-receipt-path="' + esc(receiptPath) + '">' +
    '<span class="receipt-pane__amount">' + esc(formatCurrency(receipt.confirmedAmount)) + '</span>' +
    '<span class="receipt-pane__meta">' + esc(receipt.confirmedCategory) + '</span>' +
    '<span class="receipt-pane__foot"><span class="chip-status ' + chipClass + '">' + esc(receipt.status || "ไม่ทราบสถานะ") + '</span>' +
    '<span class="receipt-pane__date">' + esc(receipt.confirmedDate) + '</span></span>' +
  '</button>';
}

function paneSummaryHtml(receipts) {
  var passed = receipts.filter(function (r) { return r.status === "ผ่าน"; }).length;
  var percent = receipts.length ? Math.round((passed / receipts.length) * 100) : 0;
  return '<div class="receipt-pane__summary">' +
    '<span class="receipt-pane__summary-figure">' + passed + ' / ' + receipts.length + '</span>' +
    '<span class="receipt-pane__summary-label">ใบเสร็จที่ผ่านแล้ว</span>' +
    '<span class="receipt-pane__track"><span style="width:' + percent + '%"></span></span>' +
  '</div>';
}

(function () {
  var loadState = document.getElementById("load-state");
  var list = document.getElementById("receipt-list");
  var pageIntro = document.getElementById("pageIntro");

  var filterProjectId = new URLSearchParams(location.search).get("projectId");

  function showEmptyState() {
    loadState.innerHTML = filterProjectId
      ? '<div class="banner banner--info"><p class="text-body">โครงการนี้ยังไม่มีใบเสร็จ — ' +
        '<a href="new-receipt.html?projectId=' + esc(filterProjectId) + '">อัปโหลดใบเสร็จแรก</a></p></div>'
      : '<div class="banner banner--warning">' +
        '<p class="text-body">ยังไม่มีใบเสร็จ ไปที่หน้า ' +
        '<a href="projects.html">โครงการของฉัน</a> เพื่อสร้างโครงการ แล้วอัปโหลดใบเสร็จใบแรก</p>' +
        '</div>';
    loadState.style.display = "block";
    list.style.display = "none";
  }

  async function loadReceipts() {
    try {
      var user = await window.AUTH_READY;

      if (filterProjectId) {
        var projectDoc = await db.collection("users").doc(user.uid).collection("projects").doc(filterProjectId).get();
        var filterProjectName = projectDoc.exists ? projectDoc.data().projectName : "(ไม่พบโครงการ)";
        pageIntro.innerHTML =
          '<h1>ใบเสร็จของโครงการ: ' + esc(filterProjectName) + '</h1>' +
          '<p class="text-body">' +
            '<a href="projects.html" style="display:inline-flex;align-items:center;gap:4px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>กลับไปโครงการของฉัน</a> · ' +
            '<a href="new-receipt.html?projectId=' + esc(filterProjectId) + '" class="btn btn-primary btn-sm">อัปโหลดใบเสร็จในโครงการนี้</a>' +
          '</p>';
      }

      var snapshot = await db.collectionGroup("receipts")
        .where("ownerUserId", "==", user.uid)
        .orderBy("uploadedAt", "desc")
        .get();

      var docs = snapshot.docs;
      if (filterProjectId) {
        docs = docs.filter(function (doc) {
          var projectRef = doc.ref.parent.parent;
          return projectRef && projectRef.id === filterProjectId;
        });
      }

      if (docs.length === 0) {
        showEmptyState();
        return;
      }

      var entries = await Promise.all(docs.map(async function (doc) {
        var filesSnapshot = await doc.ref.collection("files").get();
        var files = filesSnapshot.docs.map(function (f) { return f.data(); });
        var receipt = doc.data();

        // parent ของ collection "receipts" คือเอกสารโครงการ (users/{u}/projects/{p}) เสมอ
        // ยกเว้นใบเสร็จเก่าจากโครงสร้าง flat (ก่อน 2026-09-05) ที่ไม่มี parent — เผื่อไว้กันพัง
        var projectRef = doc.ref.parent.parent;
        var projectName = "(ข้อมูลจากโครงสร้างเก่า — ไม่มีโครงการอ้างอิง)";
        if (projectRef) {
          var projectSnap = await projectRef.get();
          projectName = projectSnap.exists ? projectSnap.data().projectName : "(ไม่พบโครงการ)";
        }

        return { path: doc.ref.path, receipt: receipt, html: receiptCardHtml(doc.ref.path, receipt, files, projectName) };
      }));

      // จอใหญ่: แผงรายการสีฟ้า (ซ้าย) + รายละเอียดใบที่เลือก (ขวา) / จอเล็ก: style.css ซ่อนแผงซ้าย
      // แล้วแสดงทุกใบเรียงต่อกันเหมือนเดิม
      var uploadHref = filterProjectId ? "new-receipt.html?projectId=" + encodeURIComponent(filterProjectId) : "new-receipt.html";
      list.innerHTML =
        '<div class="receipt-master">' +
          '<div class="receipt-pane">' +
            '<div class="receipt-pane__head"><h2>รายการใบเสร็จ</h2>' +
              '<a class="btn btn-sm receipt-pane__new" href="' + esc(uploadHref) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>อัปโหลด</a></div>' +
            paneSummaryHtml(entries.map(function (e) { return e.receipt; })) +
            '<div class="receipt-pane__list">' + entries.map(function (e) { return paneItemHtml(e.path, e.receipt); }).join("") + '</div>' +
          '</div>' +
          '<div class="receipt-detail">' + entries.map(function (e) { return e.html; }).join("") + '</div>' +
        '</div>';
      selectReceipt(entries[0].path);
      list.style.display = "block";
      loadState.style.display = "none";
    } catch (err) {
      // Firestore query แบบ collectionGroup + orderBy ต้องมี index รองรับ — ครั้งแรกที่ query แบบ
      // นี้มักจะยังไม่มี index จึงโยน error พร้อมลิงก์สร้าง index มาด้วยเสมอ (แกะลิงก์ออกมาทำเป็น
      // ปุ่มคลิกได้จริง แทนที่จะโยน error message ดิบๆ เป็น plain text ให้อ่านเอง)
      var createIndexLink = String(err.message || "").match(/https:\/\/console\.firebase\.google\.com\S*/);

      if (createIndexLink) {
        loadState.innerHTML =
          '<div class="banner banner--warning">' +
            '<p class="text-body"><strong>ยังไม่มี Firestore index สำหรับ query นี้</strong> — เกิดขึ้นเป็น ' +
            'ปกติตอนใช้ collection group query ครั้งแรก (อ่านใบเสร็จรวมข้ามทุกโครงการ) ต้องสร้าง index ' +
            '1 ครั้งใน Firebase Console ก่อน (ทำครั้งเดียว ไม่ต้องทำซ้ำอีก)</p>' +
            '<p class="text-body"><a href="' + esc(createIndexLink[0]) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">' +
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
  }

  function selectReceipt(path) {
    list.querySelectorAll("[data-receipt-path]").forEach(function (el) {
      var on = el.dataset.receiptPath === path;
      el.classList.toggle("is-selected", on);
      if (el.classList.contains("receipt-pane__item")) el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // เดลิเกตคลิกทั้งหมดที่ #receipt-list เดียว (แต่ละใบเสร็จมีปุ่มซ้ำกัน ใช้ id ซ้ำไม่ได้)
  list.addEventListener("click", async function (e) {
    var paneItem = e.target.closest(".receipt-pane__item");
    if (paneItem) {
      selectReceipt(paneItem.dataset.receiptPath);
      return;
    }

    var button = e.target.closest('button[data-action="delete-receipt"]');
    if (!button) return;

    var entry = button.closest(".receipt-entry");
    var receiptPath = entry.dataset.receiptPath;

    if (!confirm("ลบใบเสร็จนี้? การลบนี้ย้อนกลับไม่ได้")) return;

    button.disabled = true;
    button.textContent = "กำลังลบ...";
    try {
      var receiptRef = db.doc(receiptPath);
      var filesSnapshot = await receiptRef.collection("files").get();
      for (var i = 0; i < filesSnapshot.docs.length; i++) {
        await filesSnapshot.docs[i].ref.delete();
      }
      await receiptRef.delete();

      entry.remove();
      var paneItemToRemove = list.querySelector('.receipt-pane__item[data-receipt-path="' + CSS.escape(receiptPath) + '"]');
      if (paneItemToRemove) paneItemToRemove.remove();
      var remaining = list.querySelector(".receipt-entry");
      if (remaining) selectReceipt(remaining.dataset.receiptPath);
      else showEmptyState();
    } catch (err) {
      alert("ลบใบเสร็จไม่สำเร็จ: " + err.message);
      button.disabled = false;
      button.textContent = "ลบ";
    }
  });

  loadReceipts();
})();
