// ─────────────────────────────────────────────────────────────
// js/new-receipt.js — ตัวช่วยกรอกใบเสร็จใหม่ แบบ 3 ขั้นตอน (อัปโหลด → ตรวจสอบข้อมูล → ผลตรวจ)
// ยังไม่มี OCR/Rule Engine/LLM จริงเชื่อมต่อ (ดูเหตุผลใน SCOPE.md) ขั้นตอน "ตรวจสอบข้อมูล" จึง
// สุ่มค่าขึ้นมาเอง สมมติว่าเป็นผลจาก AI อ่านใบเสร็จให้แล้ว ส่วนผลตรวจใช้ mock Rule Engine จาก data.js
// การแนบไฟล์จริงเป็นออปชัน (ไม่บังคับ) เพื่อให้ทดลองขั้นตอนได้ทันทีโดยไม่ต้องมีไฟล์จริง
// บันทึกลง Firestore ที่ users/{ownerUserId}/projects/{projectId}/receipts/{id} (ดูเหตุผลของ
// โครงสร้างซ้อนนี้ใน js/seed.js)
// ─────────────────────────────────────────────────────────────

var MAX_FILES = 5;
var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
var ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
var ผู้ขายตัวอย่าง = [
  "ร้านถ่ายเอกสาร ABC", "ร้านเครื่องเขียนสยาม", "ร้านอาหารครัวคุณแม่",
  "บริษัท ทัวร์แอนด์แทรเวล จำกัด", "ร้านวัสดุก่อสร้าง ใจดี", "ร้านกาแฟดอยหลวง",
  "ห้างหุ้นส่วนจำกัด รุ่งเรืองพาณิชย์",
];

(function () {
  var ช่องโครงการ = document.getElementById("projectId");
  var ช่องหมวด = document.getElementById("confirmedCategory");
  var ช่องไฟล์ = document.getElementById("receiptFiles");
  var กล่องเตือน = document.getElementById("ข้อความเตือน");
  var กล่องสถานะไฟล์ = document.getElementById("สถานะไฟล์");

  var stepEl = { 1: document.getElementById("step1"), 2: document.getElementById("step2"), 3: document.getElementById("step3") };
  var dotEl = { 1: document.getElementById("stepDot1"), 2: document.getElementById("stepDot2"), 3: document.getElementById("stepDot3") };

  window.RECEIPT_DATA.projects.forEach(function (project) {
    var ตัวเลือก = document.createElement("option");
    ตัวเลือก.value = project.id;
    ตัวเลือก.textContent = project.projectName;
    ช่องโครงการ.appendChild(ตัวเลือก);
  });

  window.RECEIPT_DATA.categories.forEach(function (category) {
    var ตัวเลือก = document.createElement("option");
    ตัวเลือก.value = category;
    ตัวเลือก.textContent = category;
    ช่องหมวด.appendChild(ตัวเลือก);
  });

  function นามสกุลไฟล์(fileName) {
    return fileName.split(".").pop().toLowerCase();
  }

  // หารหัสถัดไปแบบ receipt006, receipt007, ... จากรหัสเดิมที่มีอยู่จริงใน Firestore
  // receipts อยู่ซ้อนใน users/{u}/projects/{p}/receipts/{id} จึงต้องใช้ collectionGroup
  // เพื่อสแกนหาเลขสูงสุดข้ามทุกโครงการ (ไม่ใช่แค่โครงการที่กำลังเลือกอยู่)
  async function รหัสใบเสร็จถัดไป() {
    var snapshot = await db.collectionGroup("receipts").get();
    var เลขสูงสุด = 0;
    snapshot.forEach(function (doc) {
      var m = doc.id.match(/^receipt(\d+)$/);
      if (m) เลขสูงสุด = Math.max(เลขสูงสุด, parseInt(m[1], 10));
    });
    return "receipt" + String(เลขสูงสุด + 1).padStart(3, "0");
  }

  function ตรวจไฟล์(files) {
    if (files.length > MAX_FILES) return "แนบไฟล์ได้สูงสุด " + MAX_FILES + " ไฟล์ต่อใบเสร็จ 1 รายการ (ตอนนี้เลือกไว้ " + files.length + " ไฟล์)";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = นามสกุลไฟล์(f.name);
      if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
        return "ไฟล์ \"" + f.name + "\" ไม่ใช่ชนิดที่รองรับ (รองรับเฉพาะ jpg/png/pdf)";
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        return "ไฟล์ \"" + f.name + "\" มีขนาดเกิน 5 MB";
      }
    }
    return null;
  }

  function สุ่มข้อมูลAI() {
    var หมวด = window.RECEIPT_DATA.categories[Math.floor(Math.random() * window.RECEIPT_DATA.categories.length)];
    var ยอดเงิน = Math.round((Math.random() * 4700 + 100) * 100) / 100;
    var วันย้อนหลัง = Math.floor(Math.random() * 14);
    var วันที่ = new Date();
    วันที่.setDate(วันที่.getDate() - วันย้อนหลัง);
    var ผู้ขาย = ผู้ขายตัวอย่าง[Math.floor(Math.random() * ผู้ขายตัวอย่าง.length)];
    return {
      confirmedAmount: ยอดเงิน,
      confirmedDate: วันที่.toISOString().slice(0, 10),
      confirmedCategory: หมวด,
      confirmedVendorName: ผู้ขาย,
    };
  }

  function เตือน(ข้อความ) {
    กล่องเตือน.textContent = "⚠️ " + ข้อความ;
    กล่องเตือน.style.display = "block";
  }

  function ล้างคำเตือน() {
    กล่องเตือน.style.display = "none";
  }

  function ไปขั้นตอน(n) {
    [1, 2, 3].forEach(function (i) {
      stepEl[i].hidden = i !== n;
      dotEl[i].classList.remove("is-current", "is-done");
      if (i < n) dotEl[i].classList.add("is-done");
      if (i === n) dotEl[i].classList.add("is-current");
    });
    window.scrollTo(0, 0);
  }

  ช่องไฟล์.addEventListener("change", function () {
    var files = Array.from(ช่องไฟล์.files);
    var error = files.length > 0 ? ตรวจไฟล์(files) : null;
    if (error) {
      กล่องสถานะไฟล์.innerHTML = '<span style="color:var(--color-error);">⚠️ ' + error + '</span>';
    } else if (files.length > 0) {
      กล่องสถานะไฟล์.textContent = "เลือกไว้ " + files.length + " ไฟล์ (" + files.map(function (f) { return f.name; }).join(", ") + ")";
    } else {
      กล่องสถานะไฟล์.textContent = "";
    }
  });

  // ─── ขั้นตอนที่ 1 → 2 ───
  document.getElementById("ปุ่มขั้นที่1").addEventListener("click", function () {
    ล้างคำเตือน();

    if (!ช่องโครงการ.value) {
      เตือน("กรุณาเลือกโครงการวิจัยก่อน");
      return;
    }
    var files = Array.from(ช่องไฟล์.files);
    var fileError = files.length > 0 ? ตรวจไฟล์(files) : null;
    if (fileError) {
      เตือน(fileError);
      return;
    }

    ไปขั้นตอน(2);
    document.getElementById("กำลังประมวลผลAI").hidden = false;
    document.getElementById("แบบฟอร์มตรวจสอบ").hidden = true;

    setTimeout(function () {
      var ข้อมูลAI = สุ่มข้อมูลAI();
      document.getElementById("confirmedAmount").value = ข้อมูลAI.confirmedAmount;
      document.getElementById("confirmedDate").value = ข้อมูลAI.confirmedDate;
      ช่องหมวด.value = ข้อมูลAI.confirmedCategory;
      document.getElementById("confirmedVendorName").value = ข้อมูลAI.confirmedVendorName;

      var ชื่อไฟล์ = files.length > 0
        ? files.map(function (f) { return f.name; }).join(", ")
        : "ไม่ได้แนบไฟล์จริง (โหมดสาธิต — จำลองผลอ่านด้วย AI)";
      document.getElementById("ชื่อไฟล์แสดงผล").textContent = ชื่อไฟล์;

      document.getElementById("กำลังประมวลผลAI").hidden = true;
      document.getElementById("แบบฟอร์มตรวจสอบ").hidden = false;
    }, 700);
  });

  // ─── ขั้นตอนที่ 2 → 1 (ย้อนกลับ) ───
  document.getElementById("ปุ่มย้อนกลับขั้นที่1").addEventListener("click", function () {
    ล้างคำเตือน();
    ไปขั้นตอน(1);
  });

  // ─── ขั้นตอนที่ 2 → 3 (ส่งเข้าตรวจ) ───
  document.getElementById("ปุ่มขั้นที่2").addEventListener("click", async function () {
    ล้างคำเตือน();

    var ค่า = {
      projectId: ช่องโครงการ.value,
      confirmedAmount: parseFloat(document.getElementById("confirmedAmount").value),
      confirmedDate: document.getElementById("confirmedDate").value,
      confirmedCategory: ช่องหมวด.value,
      confirmedVendorName: document.getElementById("confirmedVendorName").value.trim(),
    };

    if (!ค่า.projectId || !ค่า.confirmedAmount || !ค่า.confirmedDate || !ค่า.confirmedCategory) {
      เตือน("กรอกไม่ครบ — ต้องมียอดเงิน วันที่ และหมวดค่าใช้จ่ายก่อนส่งตรวจ");
      return;
    }

    var files = Array.from(ช่องไฟล์.files);
    var ผลตรวจ = window.mockRuleEngine(ค่า.confirmedCategory, ค่า.confirmedAmount);
    var ปุ่มบันทึก = document.getElementById("ปุ่มขั้นที่2");

    ปุ่มบันทึก.disabled = true;
    try {
      ปุ่มบันทึก.textContent = "กำลังบันทึกข้อมูลใบเสร็จ...";
      var รหัสใหม่ = await รหัสใบเสร็จถัดไป();
      // receipts อยู่ซ้อนใน users/{u}/projects/{p}/receipts/{id} — ต้องหา ownerUserId ของ
      // โครงการที่เลือกก่อน (ยังไม่มี auth จริง จึงอ้างจาก RECEIPT_DATA.projects ในเครื่อง)
      var โครงการที่เลือก = window.RECEIPT_DATA.projects.find(function (p) { return p.id === ค่า.projectId; });
      var receiptRef = db.collection("users").doc(โครงการที่เลือก.ownerUserId)
        .collection("projects").doc(ค่า.projectId)
        .collection("receipts").doc(รหัสใหม่);
      await receiptRef.set(Object.assign({}, ค่า, {
        status: ผลตรวจ.status,
        aiExplanation: ผลตรวจ.aiExplanation,
        isExported: false,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }));

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        ปุ่มบันทึก.textContent = "กำลังอัปโหลดไฟล์ " + (i + 1) + "/" + files.length + "...";

        var storagePath = "receipts/" + receiptRef.id + "/" + Date.now() + "_" + file.name;
        var storageRef = storage.ref(storagePath);
        await storageRef.put(file);
        var downloadUrl = await storageRef.getDownloadURL();

        await receiptRef.collection("files").add({
          originalFileName: file.name,
          fileType: นามสกุลไฟล์(file.name),
          fileSizeBytes: file.size,
          fileReference: downloadUrl,
          sortOrder: i + 1,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      var projectName = window.RECEIPT_DATA.projects.find(function (p) { return p.id === ค่า.projectId; }).projectName;
      แสดงผลตรวจ(ค่า, ผลตรวจ, projectName);
      ไปขั้นตอน(3);
    } catch (err) {
      เตือน("บันทึกไม่สำเร็จ: " + err.message + " (เช็ค Firestore/Storage Rules ว่าเปิดให้เขียนได้หรือยัง)");
    } finally {
      ปุ่มบันทึก.disabled = false;
      ปุ่มบันทึก.textContent = "ส่งเข้าตรวจกับ Rule Engine";
    }
  });

  var STATUS_CHIP_CLASS = { "ผ่าน": "chip-status--pass", "ต้องแก้ไข": "chip-status--fix", "ไม่เข้าเงื่อนไข": "chip-status--reject" };
  var STATUS_CALLOUT_KIND = { "ผ่าน": "pass", "ต้องแก้ไข": "fix", "ไม่เข้าเงื่อนไข": "reject" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatCurrency(amount) {
    if (typeof amount !== "number") return "-";
    return "฿" + amount.toLocaleString("th-TH", { minimumFractionDigits: 2 });
  }

  function แสดงผลตรวจ(ค่า, ผลตรวจ, projectName) {
    var chipClass = STATUS_CHIP_CLASS[ผลตรวจ.status] || "chip-status--pending";
    var calloutKind = STATUS_CALLOUT_KIND[ผลตรวจ.status] || "reject";

    document.getElementById("ผลตรวจ").innerHTML =
      '<div class="receipt-entry">' +
        '<div class="receipt-card">' +
          '<div class="receipt-card__thumb">🧾</div>' +
          '<div class="receipt-card__body">' +
            '<div class="receipt-card__amount">' + esc(formatCurrency(ค่า.confirmedAmount)) + '</div>' +
            '<div class="receipt-card__meta">' + esc(projectName) + ' · ' + esc(ค่า.confirmedDate) + ' · ' + esc(ค่า.confirmedCategory) + ' · ' + esc(ค่า.confirmedVendorName) + '</div>' +
          '</div>' +
          '<div class="receipt-card__status"><span class="chip-status ' + chipClass + '">' + esc(ผลตรวจ.status) + '</span></div>' +
        '</div>' +
        '<div class="rule-callout rule-callout--' + calloutKind + '">' +
          '<p class="rule-callout__explain">' + esc(ผลตรวจ.aiExplanation) + '</p>' +
        '</div>' +
      '</div>';
  }

  // ─── ขั้นตอนที่ 3 → เริ่มใหม่ ───
  document.getElementById("ปุ่มอัปโหลดใหม่").addEventListener("click", function () {
    ล้างคำเตือน();
    ช่องโครงการ.value = "";
    ช่องไฟล์.value = "";
    กล่องสถานะไฟล์.textContent = "";
    document.getElementById("confirmedAmount").value = "";
    document.getElementById("confirmedDate").value = "";
    document.getElementById("confirmedVendorName").value = "";
    ไปขั้นตอน(1);
  });
})();
