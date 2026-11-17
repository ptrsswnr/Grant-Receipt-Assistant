// ─────────────────────────────────────────────────────────────
// js/new-receipt.js — ตัวช่วยกรอกใบเสร็จใหม่ แบบ 3 ขั้นตอน (อัปโหลด → ตรวจสอบข้อมูล → ผลตรวจ)
// ตั้งแต่ 2026-09-16 ขั้นตอน "ตรวจสอบข้อมูล" อ่านด้วย AI จริงผ่าน OpenRouter ได้แล้ว (ดู
// js/receipt-ai.js) จากไฟล์แรกที่แนบ ไม่ว่าจะเป็นรูปภาพ (jpg/png) หรือ pdf (แปลงหน้าแรกเป็นรูปภาพ
// ก่อนด้วย js/pdf-to-image.js) แต่เฉพาะตอนรัน local ที่มี js/ai-config.local.js (test only — ดู
// CLAUDE.md "AI receipt reading (test only)") — ทุกกรณีอื่น (ไม่มีไฟล์แนบ, ไม่มี API key, หรือ AI
// เรียก/แปลงไฟล์ไม่สำเร็จ) ยังใช้ randomAiData() (mock) แทนเหมือนเดิม (เหตุผลเดิมของโหมด mock อยู่ใน
// SCOPE.md) — ผลตรวจตัดสินโดย js/rule-engine.js (pure function) จาก ruleItems ของแหล่งทุนที่
// โครงการสังกัดจริงใน Firestore (ดู docs/05-log/20260910-log.md ที่มาของโครงสร้าง ruleItems)
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
  var privacyConsentCard = document.getElementById("privacyConsentCard");
  var privacyConsentCheckbox = document.getElementById("privacyConsentCheckbox");

  var stepEl = { 1: document.getElementById("step1"), 2: document.getElementById("step2"), 3: document.getElementById("step3") };
  var dotEl = { 1: document.getElementById("stepDot1"), 2: document.getElementById("stepDot2"), 3: document.getElementById("stepDot3") };

  var user = await window.AUTH_READY;

  // แสดงกล่องขอความยินยอมเรื่องความเป็นส่วนตัวเฉพาะครั้งที่ยังไม่เคยกดยอมรับมาก่อน (เช็คจาก field
  // privacyConsentAcceptedAt บนเอกสาร users/{uid} ของตัวเอง) — ให้ admin เห็นข้อมูลใบเสร็จได้เต็มรูปแบบ
  // ผ่าน Admin Dashboard ตั้งแต่ 2026-09-10 (กลับคำตัดสินใจ FR-12 เดิม) จึงต้องแจ้งนักวิจัยให้รับทราบ
  // ก่อนอัปโหลดครั้งแรก (เวอร์ชันเบาของ FR-13/FR-14 ที่เดิมเลื่อนไป Sprint 3 — ยังไม่ใช่ PDPA
  // compliance เต็มรูปแบบ ไม่มี consent record แยกต่างหาก แค่ timestamp เดียวบนเอกสารผู้ใช้)
  var userDoc = await db.collection("users").doc(user.uid).get();
  var privacyConsentAlreadyGiven = userDoc.exists && !!userDoc.data().privacyConsentAcceptedAt;
  if (!privacyConsentAlreadyGiven) {
    privacyConsentCard.style.display = "block";
  }

  // ดรอปดาวน์โครงการวิจัยต้องดึงเฉพาะโครงการของผู้ใช้ที่ล็อกอินอยู่ (users/{uid}/projects) — ไม่ใช้
  // window.RECEIPT_DATA.projects ตรงๆ อีกต่อไป เพราะไฟล์นั้นเป็นแค่ข้อมูลตัวอย่างสำหรับ seed.html
  // เก็บ fundSourceId ของแต่ละโครงการไว้ใน projectFundSourceId ด้วย เพื่อให้ checkAgainstRules
  // (ตอนส่งเข้าตรวจ) รู้ว่าโครงการที่เลือกอยู่ต้องเทียบกับระเบียบของแหล่งทุนไหน
  var projectFundSourceId = {};
  var userProjects = await db.collection("users").doc(user.uid).collection("projects").get();
  if (userProjects.empty) {
    var noProjectOption = document.createElement("option");
    noProjectOption.value = "";
    noProjectOption.textContent = "ยังไม่มีโครงการวิจัย — ไปที่หน้า \"โครงการของฉัน\" ก่อน";
    noProjectOption.disabled = true;
    projectSelect.appendChild(noProjectOption);
  } else {
    userProjects.forEach(function (doc) {
      var option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().projectName;
      projectSelect.appendChild(option);
      projectFundSourceId[doc.id] = doc.data().fundSourceId;
    });
  }

  // ถ้ามาจากลิงก์ "อัปโหลดใบเสร็จ" ในการ์ดโครงการที่หน้า projects.html จะมี ?projectId=xxx ใน URL —
  // เลือกโครงการนั้นไว้ล่วงหน้าให้เลย (ยังแก้ไขเปลี่ยนโครงการอื่นในดรอปดาวน์เองได้ตามปกติ)
  var preselectProjectId = new URLSearchParams(location.search).get("projectId");
  if (preselectProjectId && projectFundSourceId.hasOwnProperty(preselectProjectId)) {
    projectSelect.value = preselectProjectId;
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

  // โหลดชุดกฎของเวอร์ชันที่ active ทั้งชุดจาก Firestore แล้วส่งให้ js/rule-engine.js ตัดสิน — การตัดสิน
  // อยู่ใน rule engine (pure function) เท่านั้น ไฟล์นี้แค่โหลดข้อมูลกับแสดงผล
  // ชุดเอกสาร (evidenceChains) และชื่อเอกสาร (documentTypes) เป็นข้อมูลกลางของมหาวิทยาลัย ไม่ผูกแหล่งทุน
  // โหลดครั้งเดียวตอนเปิดหน้า
  var evidenceChainsById = {};
  var documentNames = {};
  var [chainsSnap, docTypesSnap] = await Promise.all([
    db.collection("evidenceChains").get(),
    db.collection("documentTypes").get(),
  ]);
  chainsSnap.forEach(function (d) { evidenceChainsById[d.id] = d.data(); });
  docTypesSnap.forEach(function (d) { documentNames[d.id] = d.data().documentName; });

  var ruleSetCache = {};
  async function loadActiveRuleSet(fundSourceId) {
    if (!fundSourceId) return null;
    var fundSourceDoc = await db.collection("fundSources").doc(fundSourceId).get();
    if (!fundSourceDoc.exists) return null;
    // แหล่งทุนปิดใช้งาน (FR-35): ยังตรวจด้วยกฎเดิม แต่ rule engine จะแจ้งเตือนในคำอธิบาย
    var fundSourceActive = fundSourceDoc.data().isActive !== false;
    var ruleVersionsSnap = await db.collection("fundSources").doc(fundSourceId)
      .collection("ruleVersions").where("isActive", "==", true).limit(1).get();
    if (ruleVersionsSnap.empty) {
      return { fundSourceId: fundSourceId, fundSourceActive: fundSourceActive, ruleVersionId: null, versionLabel: null, ruleItems: [], evidenceChains: evidenceChainsById };
    }
    var versionDoc = ruleVersionsSnap.docs[0];
    var ruleItemsSnap = await versionDoc.ref.collection("ruleItems").get();
    return {
      fundSourceId: fundSourceId,
      fundSourceActive: fundSourceActive,
      ruleVersionId: versionDoc.id,
      versionLabel: versionDoc.data().versionLabel || null,
      ruleItems: ruleItemsSnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }),
      evidenceChains: evidenceChainsById,
    };
  }
  function getRuleSet(fundSourceId) {
    if (!ruleSetCache[fundSourceId]) ruleSetCache[fundSourceId] = loadActiveRuleSet(fundSourceId);
    return ruleSetCache[fundSourceId];
  }

  async function checkAgainstRules(fundSourceId, category, amount, evidence, budget, summary) {
    var ruleSet = await getRuleSet(fundSourceId);
    var result = window.RuleEngine.evaluate({ category: category, amount: amount, evidence: evidence, budget: budget, summary: summary }, ruleSet, documentNames);
    // receipt-check-agent.js และ field aiExplanation บนเอกสาร receipt ยังใช้ชื่อเดิม
    result.aiExplanation = result.explanation;
    return result;
  }

  // ─── checklist เอกสารประกอบ (ขั้นตอนที่ 2) ───
  // รายการมาจาก RuleEngine.requiredEvidence() ตัวเดียวกับที่ใช้ตัดสิน จึงแสดงตรงกับที่ระบบจะตรวจเสมอ
  var evidenceChecklist = document.getElementById("evidenceChecklist");
  var evidenceChecklistBody = document.getElementById("evidenceChecklistBody");
  var checklistShown = false;

  function checkedValues(attr) {
    return Array.from(evidenceChecklistBody.querySelectorAll("input[" + attr + "]:checked")).map(function (el) { return el.getAttribute(attr); });
  }

  async function renderEvidenceChecklist() {
    var fundSourceId = projectFundSourceId[projectSelect.value];
    var category = categorySelect.value;
    var amount = parseFloat(document.getElementById("confirmedAmount").value);
    var required = fundSourceId && category
      ? window.RuleEngine.requiredEvidence(category, amount, await getRuleSet(fundSourceId))
      : null;

    var keepDocs = checkedValues("data-doc-id");
    var keepAttest = checkedValues("data-attest-id");
    checklistShown = !!required;
    evidenceChecklist.hidden = !required;
    if (!required) {
      evidenceChecklistBody.innerHTML = "";
      return;
    }

    var html = '<p class="help-text" style="margin-top:0;">ชุดเอกสาร "' + esc(required.chainName) + '" — ติ๊กเอกสารที่แนบมาครบแล้ว ระบบจะแจ้งถ้ายังขาด</p>';
    required.steps.forEach(function (step) {
      var hint = !step.required ? "ถ้าเข้ากรณี"
        : step.documentTypeIds.length > 1 ? "จำเป็น — อย่างใดอย่างหนึ่ง" : "จำเป็น";
      if (step.timing === "before") hint += " · ต้องทำก่อนเกิดค่าใช้จ่าย";
      if (step.timing === "after") hint += " · ทำหลังเสร็จกิจกรรม";
      html += '<div style="margin:10px 0;"><div class="text-small" style="color:var(--color-content-secondary);">' + esc(hint) + (step.note ? " — " + esc(step.note) : "") + '</div>';
      step.documentTypeIds.forEach(function (id) {
        html += '<label style="display:flex; gap:8px; align-items:flex-start; margin-top:4px;"><input type="checkbox" data-doc-id="' + esc(id) + '"' + (keepDocs.indexOf(id) !== -1 ? " checked" : "") + '> <span>' + esc(documentNames[id] || id) + '</span></label>';
      });
      html += '</div>';
    });
    required.attestations.forEach(function (a) {
      html += '<label style="display:flex; gap:8px; align-items:flex-start; margin-top:10px;"><input type="checkbox" data-attest-id="' + esc(a.id) + '"' + (keepAttest.indexOf(a.id) !== -1 ? " checked" : "") + '> <span>ยืนยันว่า' + esc(a.text) + '</span></label>';
    });
    evidenceChecklistBody.innerHTML = html;
  }

  // ─── รายการในประมาณการ (ขั้นตอนที่ 2) ───
  // แสดงเฉพาะโครงการที่นำเข้าประมาณการแล้ว (budget.html) — โครงการที่ยังไม่มีจะไม่ถูกเทียบกับประมาณการ
  var NOT_IN_ESTIMATE = "__not_in_estimate__";
  var budgetLineField = document.getElementById("budgetLineField");
  var budgetLineSelect = document.getElementById("budgetLineId");
  var budgetLinesCache = {};

  function projectRefFor(projectId) {
    return db.collection("users").doc(user.uid).collection("projects").doc(projectId);
  }

  function getBudgetLines(projectId) {
    if (!budgetLinesCache[projectId]) {
      budgetLinesCache[projectId] = projectRefFor(projectId).collection("budgetLines").orderBy("order").get()
        .then(function (snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); });
    }
    return budgetLinesCache[projectId];
  }

  async function renderBudgetLines() {
    var lines = projectSelect.value ? await getBudgetLines(projectSelect.value) : [];
    budgetLineField.hidden = !lines.length;
    if (!lines.length) {
      budgetLineSelect.innerHTML = "";
      return;
    }
    var html = '<option value="">— เลือกรายการ —</option>';
    var group = null;
    lines.forEach(function (line) {
      if (line.group !== group) {
        if (group !== null) html += "</optgroup>";
        group = line.group;
        html += '<optgroup label="' + esc(group || "(ไม่ระบุหมวด)") + '">';
      }
      html += '<option value="' + esc(line.id) + '">' + esc(line.itemName) + " (ตั้งไว้ " + esc(formatCurrency(line.total)) + ")</option>";
    });
    html += '</optgroup><option value="' + NOT_IN_ESTIMATE + '">ไม่อยู่ในประมาณการ (รายการใหม่)</option>';
    budgetLineSelect.innerHTML = html;
  }

  budgetLineSelect.addEventListener("change", async function () {
    var lines = await getBudgetLines(projectSelect.value);
    var line = lines.filter(function (l) { return l.id === budgetLineSelect.value; })[0];
    if (line && line.ruleCategory) {
      categorySelect.value = line.ruleCategory;
      await renderEvidenceChecklist();
    }
  });

  // ยอดของใบเสร็จอื่นที่ตัดจากรายการเดียวกันแล้ว — query ตรงใน subcollection ของโครงการตัวเอง ไม่ต้องใช้ index พิเศษ
  async function spentOnLine(projectId, lineId) {
    var snap = await projectRefFor(projectId).collection("receipts").where("budgetLineId", "==", lineId).get();
    var sum = 0;
    snap.forEach(function (d) { sum += d.data().confirmedAmount || 0; });
    return sum;
  }

  categorySelect.addEventListener("change", renderEvidenceChecklist);
  // จำนวนเงินมีผลกับขั้นตอนตามเงื่อนไข (เช่น ซื้อเกิน 100,000 บาทต้องมีกรรมการตรวจรับ 3 คน)
  document.getElementById("confirmedAmount").addEventListener("change", renderEvidenceChecklist);

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
    warningBox.textContent = message;
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

  var connectDriveButton = document.getElementById("connectDriveButton");
  var driveConnectStatus = document.getElementById("driveConnectStatus");

  function refreshDriveConnectStatus() {
    driveConnectStatus.textContent = window.googleDriveIsConnected() ? "เชื่อมต่อแล้ว" : "";
  }
  refreshDriveConnectStatus();

  connectDriveButton.addEventListener("click", async function () {
    connectDriveButton.disabled = true;
    connectDriveButton.textContent = "กำลังเชื่อมต่อ...";
    try {
      await window.googleDriveConnect();
      refreshDriveConnectStatus();
    } catch (err) {
      driveConnectStatus.innerHTML = '<span style="color:var(--color-error);">' + esc(err.message) + '</span>';
    } finally {
      connectDriveButton.disabled = false;
      connectDriveButton.textContent = "เชื่อมต่อ Google Drive";
    }
  });

  fileInput.addEventListener("change", function () {
    var files = Array.from(fileInput.files);
    var error = files.length > 0 ? validateFiles(files) : null;
    if (error) {
      fileStatusBox.innerHTML = '<span style="color:var(--color-error);">' + error + '</span>';
    } else if (files.length > 0) {
      fileStatusBox.textContent = "เลือกไว้ " + files.length + " ไฟล์ (" + files.map(function (f) { return f.name; }).join(", ") + ")";
    } else {
      fileStatusBox.textContent = "";
    }
  });

  // ─── ขั้นตอนที่ 1 → 2 ───
  document.getElementById("step1Button").addEventListener("click", async function () {
    clearWarning();

    if (!privacyConsentAlreadyGiven && !privacyConsentCheckbox.checked) {
      warn("กรุณายอมรับเงื่อนไขเรื่องความเป็นส่วนตัวก่อนอัปโหลดใบเสร็จ");
      return;
    }
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

    if (!privacyConsentAlreadyGiven) {
      privacyConsentAlreadyGiven = true;
      privacyConsentCard.style.display = "none";
      await db.collection("users").doc(user.uid).set(
        { privacyConsentAcceptedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    goToStep(2);
    document.getElementById("aiProcessing").hidden = false;
    document.getElementById("reviewForm").hidden = true;

    // ไฟล์รูปภาพ (jpg/png) ส่งให้ AI จริงอ่านได้ตรงๆ (ดู js/receipt-ai.js) — ไฟล์ pdf ต้องแปลงเป็น
    // รูปภาพก่อน (js/pdf-to-image.js, หน้าแรกเท่านั้น) เพราะ OpenRouter รับแค่รูปภาพ ไม่มีไฟล์แนบเลย
    // ยังใช้ randomAiData() (โหมดสาธิต) เหมือนเดิม
    var imageFile = files.filter(function (f) {
      var ext = fileExtension(f.name);
      return ext === "jpg" || ext === "jpeg" || ext === "png";
    })[0];
    var pdfFile = !imageFile && files.filter(function (f) { return fileExtension(f.name) === "pdf"; })[0];
    var aiSourceFile = imageFile || pdfFile;

    var aiData;
    var aiModeNote;
    var usedRealAi = false;
    var aiReady = window.AiClient && window.AiClient.isConfigured();
    var fileForAi = null;
    var ocrResult = null;

    // OCR ภาษาไทยในเครื่อง (research/ocr/server.py) — ใช้เมื่อเปิดไว้เท่านั้น ใบเสร็จไม่ออกจากเครื่อง
    if (aiSourceFile && window.OcrClient && await window.OcrClient.isAvailable()) {
      try {
        fileForAi = imageFile || await window.convertPdfFirstPageToImageFile(pdfFile);
        ocrResult = await window.OcrClient.read(fileForAi);
      } catch (err) {
        console.warn("OCR ในเครื่องอ่านไม่สำเร็จ", err);
      }
    }
    var ocrNote = ocrResult && ocrResult.lowConfidence && ocrResult.lowConfidence.length
      ? " — OCR ไม่มั่นใจ " + ocrResult.lowConfidence.length + " บรรทัด ตรวจตัวเลขให้ดี"
      : "";

    if (aiSourceFile && aiReady) {
      try {
        fileForAi = fileForAi || imageFile || await window.convertPdfFirstPageToImageFile(pdfFile);
        aiData = await window.analyzeReceiptWithAI(fileForAi, window.RECEIPT_DATA.categories, ocrResult ? window.OcrClient.textForAi(ocrResult) : "");
        aiModeNote = "อ่านด้วย AI (" + window.AiClient.describe(null, true) + ")" + (ocrResult ? " ร่วมกับ OCR ในเครื่อง" : "") +
          " จากไฟล์ " + aiSourceFile.name + ocrNote;
        usedRealAi = true;
      } catch (err) {
        warn("AI อ่านใบเสร็จไม่สำเร็จ (" + err.message + ") — ใช้ข้อมูลตัวอย่างแทนชั่วคราว");
        aiData = randomAiData();
        aiModeNote = "AI อ่านไม่สำเร็จ — ใช้ข้อมูลตัวอย่างแทน";
      }
    } else if (ocrResult) {
      // ไม่มี AI: ดึงยอดเงิน/วันที่/ชื่อร้านจากข้อความ OCR ตรงๆ ส่วนหมวดให้ผู้ใช้เลือกเอง
      var fields = window.OcrClient.extractFields(ocrResult);
      aiData = { confirmedAmount: fields.amount || "", confirmedDate: fields.date, confirmedCategory: "", confirmedVendorName: fields.vendorName };
      aiModeNote = "อ่านด้วย OCR ในเครื่อง (ไม่ใช้ AI) จากไฟล์ " + aiSourceFile.name + " — ตรวจตัวเลขและเลือกหมวดเอง" + ocrNote;
    } else {
      aiData = randomAiData();
      aiModeNote = aiSourceFile
        ? "ยังไม่ได้ตั้งค่า AI และไม่ได้เปิด OCR ในเครื่อง — ใช้ข้อมูลตัวอย่างแทน (ดู js/ai-config.example.js)"
        : "ไม่ได้แนบไฟล์ — ใช้ข้อมูลตัวอย่างแทน (โหมดสาธิต)";
    }

    document.getElementById("aiSuggestionLabel").style.display = usedRealAi ? "block" : "none";
    document.getElementById("confirmedAmount").value = aiData.confirmedAmount;
    document.getElementById("confirmedDate").value = aiData.confirmedDate;
    categorySelect.value = aiData.confirmedCategory;
    document.getElementById("confirmedVendorName").value = aiData.confirmedVendorName;
    evidenceChecklistBody.innerHTML = "";
    await renderBudgetLines();
    await renderEvidenceChecklist();

    var fileNameText = files.length > 0
      ? files.map(function (f) { return f.name; }).join(", ") + " — " + aiModeNote
      : aiModeNote;
    document.getElementById("fileNameDisplay").textContent = fileNameText;

    document.getElementById("aiProcessing").hidden = true;
    document.getElementById("reviewForm").hidden = false;
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
    if (!budgetLineField.hidden && !budgetLineSelect.value) {
      warn("กรุณาเลือกว่าใบเสร็จนี้ตัดจากรายการไหนในประมาณการ (หรือเลือก \"ไม่อยู่ในประมาณการ\")");
      return;
    }

    var files = Array.from(fileInput.files);
    if (files.length > 0 && !window.googleDriveIsConnected()) {
      warn('มีไฟล์แนบแต่ยังไม่ได้เชื่อมต่อ Google Drive (หรือหมดอายุแล้ว) — กดปุ่ม "เชื่อมต่อ Google Drive" ในขั้นตอนที่ 1 ก่อนแล้วลองอีกครั้ง');
      return;
    }
    var step2Button = document.getElementById("step2Button");

    step2Button.disabled = true;
    try {
      step2Button.textContent = "กำลังตรวจสอบตามระเบียบแหล่งทุน...";
      var evidence = checklistShown
        ? { documentTypeIds: checkedValues("data-doc-id"), attestationIds: checkedValues("data-attest-id") }
        : undefined;
      var budget;
      if (!budgetLineField.hidden) {
        var budgetLines = await getBudgetLines(values.projectId);
        var line = budgetLines.filter(function (l) { return l.id === budgetLineSelect.value; })[0] || null;
        budget = { line: line, spentBefore: line ? await spentOnLine(values.projectId, line.id) : 0 };
      }
      var summaryAmount = parseFloat(document.getElementById("summaryAmount").value);
      var summary = isNaN(summaryAmount) ? undefined : { amount: summaryAmount };
      var checkResult = await checkAgainstRules(projectFundSourceId[values.projectId], values.confirmedCategory, values.confirmedAmount, evidence, budget, summary);

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
        // บันทึกที่มาของคำตัดสิน เพื่อใช้ตรวจย้อนหลังและเทียบกับผลของเจ้าหน้าที่การเงินในการประเมินผล
        ruleCheck: {
          engineVersion: checkResult.engineVersion,
          reasonCode: checkResult.reasonCode,
          autoVerified: checkResult.autoVerified,
          fundSourceId: checkResult.fundSourceId,
          ruleVersionId: checkResult.ruleVersionId,
          ruleItemId: checkResult.ruleItemId,
          findings: checkResult.findings.map(function (f) { return { code: f.code, message: f.message }; }),
        },
        // null = โครงการยังไม่มีประมาณการ หรือเลือก "ไม่อยู่ในประมาณการ" (ดู ruleCheck.reasonCode แยกสองกรณี)
        budgetLineId: checkResult.budgetLineId || null,
        // ยอดที่นักวิจัยลงไว้ในใบสรุปรายรับ-จ่าย (null = ไม่ได้กรอก จึงไม่ได้เทียบ)
        summaryAmount: summary ? summary.amount : null,
        // รายการที่นักวิจัยติ๊กยืนยันเอง (ยังไม่ได้ตรวจจากไฟล์จริง) — null คือหมวดนี้ไม่มี checklist
        providedDocumentTypeIds: evidence ? evidence.documentTypeIds : null,
        confirmedAttestations: evidence ? evidence.attestationIds : null,
        isExported: false,
        ownerUserId: user.uid,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }));

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        step2Button.textContent = "กำลังอัปโหลดไฟล์ขึ้น Google Drive " + (i + 1) + "/" + files.length + "...";

        var driveFile = await window.googleDriveUploadReceiptFile(file, receiptRef.id);

        await receiptRef.collection("files").add({
          originalFileName: file.name,
          fileType: fileExtension(file.name),
          fileSizeBytes: file.size,
          fileReference: driveFile.webViewLink,
          driveFileId: driveFile.id,
          sortOrder: i + 1,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Level 2 agentic AI: อ่านชุดเอกสารประกอบของหมวดนี้ (evidenceChain/documentTypes) จริงจาก
      // Firestore แล้วให้ AI อธิบายผลตรวจ + วิธีแก้ไขเอกสารเพิ่มเติม (ดู js/receipt-check-agent.js
      // — ผลตรวจ pass/fix/reject ข้างบนเป็น numeric comparison ล้วนๆ อยู่แล้ว agent นี้ไม่เปลี่ยนผลนั้น
      // แค่เสริมคำอธิบาย) ห่อ try/catch แยกจากการบันทึกใบเสร็จ เพื่อไม่ให้ AI อธิบายเพิ่มเติมไม่สำเร็จ
      // ไปบล็อกการแสดงผลตรวจที่บันทึกสำเร็จไปแล้ว
      try {
        step2Button.textContent = "กำลังให้ AI อธิบายผลตรวจและวิธีแก้ไข...";
        var enrichedExplanation = await window.runReceiptCheckAgent({
          receiptRef: receiptRef,
          evidenceChainId: checkResult.evidenceChainId,
          category: values.confirmedCategory,
          amount: values.confirmedAmount,
          deterministicResult: checkResult,
        });
        checkResult.aiExplanation = enrichedExplanation;
        await receiptRef.update({ aiExplanation: enrichedExplanation });
      } catch (agentErr) {
        console.warn("AI agent อธิบายเพิ่มเติมไม่สำเร็จ (ใช้ผลตรวจแบบไม่มีคำอธิบายเสริม):", agentErr);
      }

      var projectName = projectSelect.options[projectSelect.selectedIndex].textContent;
      showCheckResult(values, checkResult, projectName);
      goToStep(3);
    } catch (err) {
      warn("บันทึกไม่สำเร็จ: " + err.message + " (เช็ค Firestore Rules หรือการเชื่อมต่อ Google Drive ว่าเปิดให้เขียนได้หรือยัง)");
    } finally {
      step2Button.disabled = false;
      step2Button.textContent = "ส่งเข้าตรวจกับ Rule Engine";
    }
  });

  var STATUS_CHIP_CLASS = { "ผ่าน": "chip-status--pass", "ต้องแก้ไข": "chip-status--fix", "ต้องชี้แจง/ขออนุมัติ": "chip-status--approval", "ไม่เข้าเงื่อนไข": "chip-status--reject" };
  var STATUS_CALLOUT_KIND = { "ผ่าน": "pass", "ต้องแก้ไข": "fix", "ต้องชี้แจง/ขออนุมัติ": "approval", "ไม่เข้าเงื่อนไข": "reject" };

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
          '<div class="receipt-card__thumb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>' +
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
    document.getElementById("summaryAmount").value = "";
    document.getElementById("confirmedDate").value = "";
    document.getElementById("confirmedVendorName").value = "";
    evidenceChecklistBody.innerHTML = "";
    budgetLineSelect.value = "";
    goToStep(1);
  });
})();
