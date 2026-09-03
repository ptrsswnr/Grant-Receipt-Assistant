// ─────────────────────────────────────────────────────────────
// js/new-receipt.js — หน้ากรอกใบเสร็จใหม่ด้วยมือ (แทน OCR ที่ยังไม่มี)
// บันทึก record ลง Firestore (collection receipts) ใช้ mock Rule Engine จาก data.js
// ตัดสิน status/aiExplanation แทนของจริงที่ยังไม่มี (ดู SCOPE.md)
// อัปโหลดไฟล์แนบจริงขึ้น Firebase Storage แล้วเก็บ URL ไว้ใน receipts/{id}/files (FR-19/FR-22)
// ─────────────────────────────────────────────────────────────

var MAX_FILES = 5;
var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — finalize แล้วตาม db-spec.md 5.1
var ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];

(function () {
  var ฟอร์ม = document.getElementById("ฟอร์มใบเสร็จ");
  var ช่องโครงการ = document.getElementById("projectId");
  var ช่องหมวด = document.getElementById("confirmedCategory");
  var ช่องไฟล์ = document.getElementById("receiptFiles");
  var กล่องเตือน = document.getElementById("ข้อความเตือน");
  var กล่องสถานะไฟล์ = document.getElementById("สถานะไฟล์");
  var ปุ่มบันทึก = document.getElementById("ปุ่มบันทึก");

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

  function ตรวจไฟล์(files) {
    if (files.length === 0) return "กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์";
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

  ฟอร์ม.addEventListener("submit", async function (e) {
    e.preventDefault();

    var ค่า = {
      projectId: ช่องโครงการ.value,
      confirmedAmount: parseFloat(document.getElementById("confirmedAmount").value),
      confirmedDate: document.getElementById("confirmedDate").value,
      confirmedCategory: ช่องหมวด.value,
      confirmedVendorName: document.getElementById("confirmedVendorName").value.trim(),
    };
    var files = Array.from(ช่องไฟล์.files);

    if (!ค่า.projectId || !ค่า.confirmedAmount || !ค่า.confirmedDate || !ค่า.confirmedCategory) {
      เตือน("กรอกไม่ครบ — ต้องเลือกโครงการวิจัย, ยอดเงิน, วันที่ และหมวดค่าใช้จ่ายก่อนกดบันทึก");
      return;
    }

    var fileError = ตรวจไฟล์(files);
    if (fileError) {
      เตือน(fileError);
      return;
    }

    var ผลตรวจ = window.mockRuleEngine(ค่า.confirmedCategory, ค่า.confirmedAmount);

    ปุ่มบันทึก.disabled = true;

    try {
      ปุ่มบันทึก.textContent = "กำลังบันทึกข้อมูลใบเสร็จ...";
      var receiptRef = await db.collection("receipts").add(Object.assign({}, ค่า, {
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

      location.href = "receipts.html";
    } catch (err) {
      เตือน("บันทึกไม่สำเร็จ: " + err.message + " (เช็ค Firestore/Storage Rules ว่าเปิดให้เขียนได้หรือยัง)");
      ปุ่มบันทึก.disabled = false;
      ปุ่มบันทึก.textContent = "บันทึกใบเสร็จ";
    }
  });

  function เตือน(ข้อความ) {
    กล่องเตือน.textContent = "⚠️ " + ข้อความ;
    กล่องเตือน.style.display = "block";
  }
})();
