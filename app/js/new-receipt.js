// ─────────────────────────────────────────────────────────────
// js/new-receipt.js — ตัวช่วยกรอกใบเสร็จใหม่ แบบ 3 ขั้นตอน (อัปโหลด → ตรวจสอบข้อมูล → ผลตรวจ)
// ยังไม่มี OCR/Rule Engine/LLM จริงเชื่อมต่อ (ดูเหตุผลใน SCOPE.md) ขั้นตอน "ตรวจสอบข้อมูล" จึง
// สุ่มค่าขึ้นมาเอง สมมติว่าเป็นผลจาก AI อ่านใบเสร็จให้แล้ว ส่วนผลตรวจใช้ mock Rule Engine จาก data.js
// การแนบไฟล์จริงเป็นออปชัน (ไม่บังคับ) เพื่อให้ทดลองขั้นตอนได้ทันทีโดยไม่ต้องมีไฟล์จริง
// บันทึกลง Firestore ที่ users/{uid ของผู้ใช้ที่ล็อกอินอยู่}/projects/{projectId}/receipts/{id}
// (ดูเหตุผลของโครงสร้างซ้อนนี้ใน js/seed.js) — ต้อง await window.AUTH_READY (จาก js/auth-guard.js)
// ก่อนเรียก Firestore ทุกครั้ง เอกสาร receipt เขียน field ownerUserId ไว้ด้วยเสมอ เพราะ
// firestore.rules ต้องอ้าง field นี้เช็คสิทธิ์ตอนอ่านผ่าน collectionGroup("receipts")
// ─────────────────────────────────────────────────────────────

var MAX_FILES = 5;
var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
var ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
var SAMPLE_VENDORS = [
  "ร้านถ่ายเอกสาร ABC", "ร้านเครื่องเขียนสยาม", "ร้านอาหารครัวคุณแม่",
  "บริษัท ทัวร์แอนด์แทรเวล จำกัด", "ร้านวัสดุก่อสร้าง ใจดี", "ร้านกาแฟดอยหลวง",
  "ห้างหุ้นส่วนจำกัด รุ่งเรืองพาณิชย์",
];

(async function () {
  var projectSelect = document.getElementById("projectId");
  var categorySelect = document.getElementById("confirmedCategory");
  var fileInput = document.getElementById("receiptFiles");
  var warningBox = document.getElementById("warningBox");
  var fileStatusBox = document.getElementById("fileStatus");

  var stepEl = { 1: document.getElementById("step1"), 2: document.getElementById("step2"), 3: document.getElementById("step3") };
  var dotEl = { 1: document.getElementById("stepDot1"), 2: document.getElementById("stepDot2"), 3: document.getElementById("stepDot3") };

  var user = await window.AUTH_READY;

  // ดรอปดาวน์โครงการวิจัยต้องดึงเฉพาะโครงการของผู้ใช้ที่ล็อกอินอยู่ (users/{uid}/projects) — ไม่ใช้
  // window.RECEIPT_DATA.projects ตรงๆ อีกต่อไป เพราะไฟล์นั้นเป็นแค่ข้อมูลตัวอย่างสำหรับ seed.html
  var userProjects = await db.collection("users").doc(user.uid).collection("projects").get();
  if (userProjects.empty) {
    var noProjectOption = document.createElement("option");
    noProjectOption.value = "";
    noProjectOption.textContent = "ยังไม่มีโครงการวิจัย — ไปที่หน้า \"ใส่ข้อมูลตัวอย่าง\" ก่อน";
    noProjectOption.disabled = true;
    projectSelect.appendChild(noProjectOption);
  } else {
    userProjects.forEach(function (doc) {
      var option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().projectName;
      projectSelect.appendChild(option);
    });
  }

  window.RECEIPT_DATA.categories.forEach(function (category) {
    var option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  function fileExtension(fileName) {
    return fileName.split(".").pop().toLowerCase();
  }

  // หารหัสถัดไปแบบ receipt006, receipt007, ... จากรหัสเดิมที่มีอยู่จริงใน Firestore ของผู้ใช้คนนี้
  // receipts อยู่ซ้อนใน users/{u}/projects/{p}/receipts/{id} จึงต้องใช้ collectionGroup เพื่อสแกนหา
  // เลขสูงสุดข้ามทุกโครงการของผู้ใช้คนนี้ (ไม่ใช่แค่โครงการที่กำลังเลือกอยู่) — กรองด้วย ownerUserId
  // เพื่อไม่ให้ปนกับรหัสใบเสร็จของผู้ใช้คนอื่น (แต่ละคนมีลำดับ receipt001, 002, ... ของตัวเอง)
  async function nextReceiptId() {
    var snapshot = await db.collectionGroup("receipts").where("ownerUserId", "==", user.uid).get();
    var maxNumber = 0;
    snapshot.forEach(function (doc) {
      var m = doc.id.match(/^receipt(\d+)$/);
      if (m) maxNumber = Math.max(maxNumber, parseInt(m[1], 10));
    });
    return "receipt" + String(maxNumber + 1).padStart(3, "0");
  }

  function validateFiles(files) {
    if (files.length > MAX_FILES) return "แนบไฟล์ได้สูงสุด " + MAX_FILES + " ไฟล์ต่อใบเสร็จ 1 รายการ (ตอนนี้เลือกไว้ " + files.length + " ไฟล์)";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = fileExtension(f.name);
      if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
        return "ไฟล์ \"" + f.name + "\" ไม่ใช่ชนิดที่รองรับ (รองรับเฉพาะ jpg/png/pdf)";
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        return "ไฟล์ \"" + f.name + "\" มีขนาดเกิน 5 MB";
      }
    }
    return null;
  }

  function randomAiData() {
    var category = window.RECEIPT_DATA.categories[Math.floor(Math.random() * window.RECEIPT_DATA.categories.length)];
    var amount = Math.round((Math.random() * 4700 + 100) * 100) / 100;
    var daysAgo = Math.floor(Math.random() * 14);
    var date = new Date();
    date.setDate(date.getDate() - daysAgo);
    var vendor = SAMPLE_VENDORS[Math.floor(Math.random() * SAMPLE_VENDORS.length)];
    return {
      confirmedAmount: amount,
      confirmedDate: date.toISOString().slice(0, 10),
      confirmedCategory: category,
      confirmedVendorName: vendor,
    };
  }

  function warn(message) {
    warningBox.textContent = "⚠️ " + message;
    warningBox.style.display = "block";
  }

  function clearWarning() {
    warningBox.style.display = "none";
  }

  function goToStep(n) {
    [1, 2, 3].forEach(function (i) {
      stepEl[i].hidden = i !== n;
      dotEl[i].classList.remove("is-current", "is-done");
      if (i < n) dotEl[i].classList.add("is-done");
      if (i === n) dotEl[i].classList.add("is-current");
    });
    window.scrollTo(0, 0);
  }

  fileInput.addEventListener("change", function () {
    var files = Array.from(fileInput.files);
    var error = files.length > 0 ? validateFiles(files) : null;
    if (error) {
      fileStatusBox.innerHTML = '<span style="color:var(--color-error);">⚠️ ' + error + '</span>';
    } else if (files.length > 0) {
      fileStatusBox.textContent = "เลือกไว้ " + files.length + " ไฟล์ (" + files.map(function (f) { return f.name; }).join(", ") + ")";
    } else {
      fileStatusBox.textContent = "";
    }
  });

  // ─── ขั้นตอนที่ 1 → 2 ───
  document.getElementById("step1Button").addEventListener("click", function () {
    clearWarning();

    if (!projectSelect.value) {
      warn("กรุณาเลือกโครงการวิจัยก่อน");
      return;
    }
    var files = Array.from(fileInput.files);
    var fileError = files.length > 0 ? validateFiles(files) : null;
    if (fileError) {
      warn(fileError);
      return;
    }

    goToStep(2);
    document.getElementById("aiProcessing").hidden = false;
    document.getElementById("reviewForm").hidden = true;

    setTimeout(function () {
      var aiData = randomAiData();
      document.getElementById("confirmedAmount").value = aiData.confirmedAmount;
      document.getElementById("confirmedDate").value = aiData.confirmedDate;
      categorySelect.value = aiData.confirmedCategory;
      document.getElementById("confirmedVendorName").value = aiData.confirmedVendorName;

      var fileNameText = files.length > 0
        ? files.map(function (f) { return f.name; }).join(", ")
        : "ไม่ได้แนบไฟล์จริง (โหมดสาธิต — จำลองผลอ่านด้วย AI)";
      document.getElementById("fileNameDisplay").textContent = fileNameText;

      document.getElementById("aiProcessing").hidden = true;
      document.getElementById("reviewForm").hidden = false;
    }, 700);
  });

  // ─── ขั้นตอนที่ 2 → 1 (ย้อนกลับ) ───
  document.getElementById("backToStep1Button").addEventListener("click", function () {
    clearWarning();
    goToStep(1);
  });

  // ─── ขั้นตอนที่ 2 → 3 (ส่งเข้าตรวจ) ───
  document.getElementById("step2Button").addEventListener("click", async function () {
    clearWarning();

    var values = {
      projectId: projectSelect.value,
      confirmedAmount: parseFloat(document.getElementById("confirmedAmount").value),
      confirmedDate: document.getElementById("confirmedDate").value,
      confirmedCategory: categorySelect.value,
      confirmedVendorName: document.getElementById("confirmedVendorName").value.trim(),
    };

    if (!values.projectId || !values.confirmedAmount || !values.confirmedDate || !values.confirmedCategory) {
      warn("กรอกไม่ครบ — ต้องมียอดเงิน วันที่ และหมวดค่าใช้จ่ายก่อนส่งตรวจ");
      return;
    }

    var files = Array.from(fileInput.files);
    var checkResult = window.mockRuleEngine(values.confirmedCategory, values.confirmedAmount);
    var step2Button = document.getElementById("step2Button");

    step2Button.disabled = true;
    try {
      step2Button.textContent = "กำลังบันทึกข้อมูลใบเสร็จ...";
      var newReceiptId = await nextReceiptId();
      // receipts อยู่ซ้อนใน users/{u}/projects/{p}/receipts/{id} — เจ้าของคือผู้ใช้ที่ล็อกอินอยู่เสมอ
      // (โครงการในดรอปดาวน์ดึงมาจาก users/{uid}/projects ของผู้ใช้คนนี้อยู่แล้ว)
      var receiptRef = db.collection("users").doc(user.uid)
        .collection("projects").doc(values.projectId)
        .collection("receipts").doc(newReceiptId);
      await receiptRef.set(Object.assign({}, values, {
        status: checkResult.status,
        aiExplanation: checkResult.aiExplanation,
        isExported: false,
        ownerUserId: user.uid,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }));

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        step2Button.textContent = "กำลังอัปโหลดไฟล์ " + (i + 1) + "/" + files.length + "...";

        var storagePath = "receipts/" + user.uid + "/" + receiptRef.id + "/" + Date.now() + "_" + file.name;
        var storageRef = storage.ref(storagePath);
        await storageRef.put(file);
        var downloadUrl = await storageRef.getDownloadURL();

        await receiptRef.collection("files").add({
          originalFileName: file.name,
          fileType: fileExtension(file.name),
          fileSizeBytes: file.size,
          fileReference: downloadUrl,
          sortOrder: i + 1,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      var projectName = projectSelect.options[projectSelect.selectedIndex].textContent;
      showCheckResult(values, checkResult, projectName);
      goToStep(3);
    } catch (err) {
      warn("บันทึกไม่สำเร็จ: " + err.message + " (เช็ค Firestore/Storage Rules ว่าเปิดให้เขียนได้หรือยัง)");
    } finally {
      step2Button.disabled = false;
      step2Button.textContent = "ส่งเข้าตรวจกับ Rule Engine";
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

  function showCheckResult(values, checkResult, projectName) {
    var chipClass = STATUS_CHIP_CLASS[checkResult.status] || "chip-status--pending";
    var calloutKind = STATUS_CALLOUT_KIND[checkResult.status] || "reject";

    document.getElementById("checkResult").innerHTML =
      '<div class="receipt-entry">' +
        '<div class="receipt-card">' +
          '<div class="receipt-card__thumb">🧾</div>' +
          '<div class="receipt-card__body">' +
            '<div class="receipt-card__amount">' + esc(formatCurrency(values.confirmedAmount)) + '</div>' +
            '<div class="receipt-card__meta">' + esc(projectName) + ' · ' + esc(values.confirmedDate) + ' · ' + esc(values.confirmedCategory) + ' · ' + esc(values.confirmedVendorName) + '</div>' +
          '</div>' +
          '<div class="receipt-card__status"><span class="chip-status ' + chipClass + '">' + esc(checkResult.status) + '</span></div>' +
        '</div>' +
        '<div class="rule-callout rule-callout--' + calloutKind + '">' +
          '<p class="rule-callout__explain">' + esc(checkResult.aiExplanation) + '</p>' +
        '</div>' +
      '</div>';
  }

  // ─── ขั้นตอนที่ 3 → เริ่มใหม่ ───
  document.getElementById("uploadAgainButton").addEventListener("click", function () {
    clearWarning();
    projectSelect.value = "";
    fileInput.value = "";
    fileStatusBox.textContent = "";
    document.getElementById("confirmedAmount").value = "";
    document.getElementById("confirmedDate").value = "";
    document.getElementById("confirmedVendorName").value = "";
    goToStep(1);
  });
})();
