// ─────────────────────────────────────────────────────────────
// js/new-receipt.js — ตัวช่วยอัปโหลดใบเสร็จใหม่ แบบ 2 ขั้นตอนจริง (อัปโหลด → ผลตรวจ; ขั้นที่ 2 ในหน้าจอ
// เป็นแค่หน้าจอ "กำลังประมวลผล" ไม่มีฟอร์มให้แก้ไข)
//
// ตั้งแต่การปรับทิศทางงานวิจัย (วิทยานิพนธ์ Paper 1 — ดู docs/05-log/) ตัดขั้นตอน "ตรวจสอบ/แก้ไขข้อมูล"
// ที่เคยให้ผู้ใช้แก้ผลที่อ่านได้ก่อนส่งตรวจออกทั้งหมด — ผล OCR (js/ocr-client.js, OpenThai 2.0 ในเครื่อง)
// และผล AI (js/receipt-ai.js หรือ randomAiData() ถ้าไม่มี AI/ไม่มีไฟล์) ถูกส่งเข้าตรวจทันทีโดยไม่มีใคร
// แก้ไขก่อน — ผล OCR ดิบ (ข้อความ+confidence ทุกบรรทัด) เก็บไว้ในฟิลด์ ocrRaw ของทุกใบเสร็จเสมอ ไม่ทิ้ง
//
// ไฟล์ที่แนบแต่ละไฟล์ยังถูกเดาว่า "เป็นเอกสารอะไร" (js/document-classifier.js — จับคำสำคัญจากข้อความ
// OCR เทียบกับ documentTypes) เพื่อเช็คความครบของเอกสารประกอบ (evidenceChain) แบบอัตโนมัติ แทนที่
// checklist ที่เคยให้ผู้วิจัยติ๊กเอง — ผลเดายังเป็น heuristic ไม่ใช่โมเดลจำแนกเอกสารจริง (ดูคอมเมนต์ใน
// document-classifier.js)
//
// ใครเป็นผู้ตัดสินผล pass/fail คุมด้วย window.VERDICT_CONFIG.mode (js/ai-config.local.js หรือ .example.js):
//   'llm'  (ค่าเริ่มต้น) — js/llm-verdict.js ให้ LLM ตัดสินเองจากผล OCR + ระเบียบของแหล่งทุน (temperature 0)
//   'rule' — js/rule-engine.js (pure function, ตัวเดิม) ตัดสินแบบเทียบตัวเลขล้วน ไม่มี AI
// ไม่ว่าโหมดไหน js/rule-engine.js ยังถูกเรียกเสมอ เพื่อคำนวณกลุ่มประมาณการ/เอกสารที่เป็นตัวเลขล้วนและ
// เก็บไว้ตรวจสอบย้อนหลัง (ruleCheck) — โหมด 'llm' แค่ไม่ใช้ผลนั้นเป็นผลตัดสินสุดท้าย
//
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
  var VERDICT_MODE = (window.VERDICT_CONFIG && window.VERDICT_CONFIG.mode) || "llm";

  var projectSelect = document.getElementById("projectId");
  var fileInput = document.getElementById("receiptFiles");
  var warningBox = document.getElementById("warningBox");
  var fileStatusBox = document.getElementById("fileStatus");
  var privacyConsentCard = document.getElementById("privacyConsentCard");
  var privacyConsentCheckbox = document.getElementById("privacyConsentCheckbox");
  var aiProcessingText = document.getElementById("aiProcessingText");

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

  function fileExtension(fileName) {
    return fileName.split(".").pop().toLowerCase();
  }

  // หารหัสถัดไปแบบ receipt006, receipt007, ... จากรหัสเดิมที่มีอยู่จริงใน Firestore ของผู้ใช้คนนี้
  // receipts อยู่ซ้อนใน users/{u}/projects/{p}/receipts/{id} จึงต้องใช้ collectionGroup เพื่อสแกนหา
  // เลขสูงสุดข้ามทุกโครงการของผู้ใช้คนนี้ (ไม่ใช่แค่โครงการที่กำลังเลือกอยู่) — กรองด้วย ownerUserId
  // เพื่อไม่ให้ปนกับรหัสใบเสร็จของผู้ใช้คนอื่น (แต่ละคนมีลำดับ receipt001, 002, ... ของตัวเอง)
  async function nextReceiptId() {
    return window.ReceiptStore.receiptIdFor(await window.ReceiptStore.maxReceiptNumber(user.uid) + 1);
  }

  // ข้อมูลอ้างอิงกลาง (evidenceChains/documentTypes) โหลดครั้งเดียวตอนเปิดหน้า (js/receipt-store.js)
  var refData = await window.ReceiptStore.loadReferenceData();
  var evidenceChainsById = refData.evidenceChainsById;
  var documentNames = refData.documentNames;
  var documentTypesById = refData.documentTypesById;

  // ชุดกฎของเวอร์ชันที่ active — การตัดสินอยู่ใน js/rule-engine.js หรือ js/llm-verdict.js เท่านั้น
  var ruleSetCache = {};
  function getRuleSet(fundSourceId) {
    if (!ruleSetCache[fundSourceId]) ruleSetCache[fundSourceId] = window.ReceiptStore.loadActiveRuleSet(fundSourceId, evidenceChainsById);
    return ruleSetCache[fundSourceId];
  }

  // ตัดสินด้วย rule engine เสมอ (ไม่ว่า VERDICT_MODE จะเป็นอะไร) — ใช้คำนวณกลุ่มประมาณการ/เอกสารที่เป็น
  // ตัวเลขล้วน และเก็บผลไว้ตรวจสอบย้อนหลัง/เทียบผลใน Stage B เสมอ
  async function checkWithRuleEngine(fundSourceId, category, amount, evidence, budget, summary) {
    var ruleSet = await getRuleSet(fundSourceId);
    var result = window.RuleEngine.evaluate({ category: category, amount: amount, evidence: evidence, budget: budget, summary: summary }, ruleSet, documentNames);
    result.aiExplanation = result.explanation;
    return result;
  }

  // ─── รายการในประมาณการ — จับคู่อัตโนมัติจากหมวดที่อ่านได้ (ไม่มีดรอปดาวน์ให้เลือกเองแล้ว) ───
  function projectRefFor(projectId) {
    return window.ReceiptStore.projectRef(user.uid, projectId);
  }

  var budgetLinesCache = {};
  function getBudgetLines(projectId) {
    if (!budgetLinesCache[projectId]) budgetLinesCache[projectId] = window.ReceiptStore.loadBudgetLines(user.uid, projectId);
    return budgetLinesCache[projectId];
  }

  // คืน undefined ถ้าโครงการยังไม่มีไฟล์ประมาณการเลย (ปกติไปไม่ถึงตรงนี้ เพราะปุ่มอัปโหลดบังคับให้มีประมาณการก่อน)
  // คืน { line: null, spentBefore: 0 } ถ้ามีประมาณการแต่ไม่มีรายการไหนตรงกับหมวดที่อ่านได้ (ไม่อยู่ในประมาณการ)
  // ยอดรวมของหมวดใช้ตรวจการถัวเฉลี่ยในหมวด จึงอ่านยอดที่ใช้ไปของทุกรายการ (estimateWithSpent) แล้วให้
  // RuleEngine.budgetFromEstimate จับคู่ — ฟังก์ชันเดียวกับการนำเข้าไฟล์สแกนและ batch runner
  async function matchBudget(projectId, category) {
    return window.RuleEngine.budgetFromEstimate(category, await estimateWithSpent(projectId));
  }

  // ประมาณการทั้งโครงการพร้อมยอดที่เบิกไปแล้วต่อรายการ (ไม่รวมใบนี้) เป็นข้อมูลดิบให้ LLM (js/llm-verdict.js)
  // ยอดเบิกสะสมนับจาก budgetLineId ที่บันทึกไว้บนใบเสร็จเดิม ซึ่งมาจากการจับคู่ด้วยหมวดของ rule engine
  async function estimateWithSpent(projectId) {
    return window.ReceiptStore.estimateWithSpent(user.uid, projectId, await getBudgetLines(projectId));
  }

  // ─── บังคับให้มีประมาณการก่อนอัปโหลด: ขั้นตอนจริงคือลงทะเบียนโครงการ + แนบประมาณการก่อน แล้วจึงตรวจใบเสร็จ ───
  var estimateNotice = document.getElementById("estimateNotice");
  async function projectHasEstimate(projectId) {
    return !!projectId && (await getBudgetLines(projectId)).length > 0;
  }
  async function refreshEstimateNotice() {
    var projectId = projectSelect.value;
    var ok = !projectId || await projectHasEstimate(projectId);
    estimateNotice.hidden = ok;
    if (!ok) {
      estimateNotice.innerHTML = 'โครงการนี้ยังไม่มีประมาณการในระบบ — ต้อง<a href="budget.html?projectId=' +
        encodeURIComponent(projectId) + '">นำเข้าไฟล์ประมาณการ (ตาราง 17.2)</a>ก่อน จึงจะอัปโหลดใบเสร็จได้';
    }
    return ok;
  }
  projectSelect.addEventListener("change", refreshEstimateNotice);
  refreshEstimateNotice();

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

  // แปลงไฟล์หนึ่งไฟล์ (รูปภาพใช้ตรงๆ, pdf แปลงหน้าแรกเป็นรูปก่อนด้วย js/pdf-to-image.js) ให้เป็นไฟล์รูปภาพ
  // ที่ส่งให้ OCR/AI อ่านได้ — คืน null ถ้าแปลงไม่สำเร็จ
  async function toImageFile(file) {
    var ext = fileExtension(file.name);
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return file;
    if (ext === "pdf") {
      try { return await window.convertPdfFirstPageToImageFile(file); } catch (err) { console.warn("แปลง PDF เป็นรูปไม่สำเร็จ", file.name, err); return null; }
    }
    return null;
  }

  // อ่านทุกไฟล์ที่แนบด้วย OCR ในเครื่อง (ถ้าเปิดอยู่) — เก็บผลดิบ (ข้อความ+confidence ทุกบรรทัด) ของ
  // ทุกไฟล์ไว้เสมอตามข้อกำหนด "ห้ามทิ้งผล OCR ดิบ" ไม่ว่าจะใช้ AI ต่อสำเร็จหรือไม่
  // PDF ส่งทั้งไฟล์ให้ OCR server ซึ่งอ่านครบทุกหน้า (ข้อความต่อกันตามลำดับหน้า) ไม่ใช่แค่หน้าแรก
  async function ocrAllFiles(files) {
    var ocrAvailable = window.OcrClient && await window.OcrClient.isAvailable();
    var results = [];
    for (var i = 0; i < files.length; i++) {
      if (!ocrAvailable || ALLOWED_EXTENSIONS.indexOf(fileExtension(files[i].name)) === -1) {
        results.push({ fileName: files[i].name, text: "", lines: [], ocrResult: null });
        continue;
      }
      try {
        var ocrResult = await window.OcrClient.read(files[i]);
        results.push({ fileName: files[i].name, text: window.OcrClient.textForAi(ocrResult), lines: ocrResult.lines || [], ocrResult: ocrResult });
      } catch (err) {
        console.warn("OCR ในเครื่องอ่านไม่สำเร็จ", files[i].name, err);
        results.push({ fileName: files[i].name, text: "", lines: [], ocrResult: null });
      }
    }
    return results;
  }

  // ─── ขั้นตอนที่ 1 → 2 → 3 ทั้งหมดในปุ่มเดียว: อัปโหลด → OCR → AI/LLM → ตรวจตามระเบียบ → บันทึก ───
  // ไม่มีขั้นตอนให้ผู้ใช้แก้ไขผลที่อ่านได้ก่อนส่งตรวจอีกต่อไป (ตามทิศทางวิจัยใหม่)
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
    if (!await refreshEstimateNotice()) {
      warn("โครงการนี้ยังไม่มีประมาณการ — นำเข้าไฟล์ประมาณการก่อน แล้วจึงอัปโหลดใบเสร็จ");
      return;
    }
    var files = Array.from(fileInput.files);
    var fileError = files.length > 0 ? validateFiles(files) : null;
    if (fileError) {
      warn(fileError);
      return;
    }
    if (files.length > 0 && !window.googleDriveIsConnected()) {
      warn('มีไฟล์แนบแต่ยังไม่ได้เชื่อมต่อ Google Drive (หรือหมดอายุแล้ว) — กดปุ่ม "เชื่อมต่อ Google Drive" ก่อนแล้วลองอีกครั้ง');
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

    var step1Button = document.getElementById("step1Button");
    step1Button.disabled = true;
    goToStep(2);

    try {
      var projectId = projectSelect.value;
      var fundSourceId = projectFundSourceId[projectId];

      // 1) OCR ทุกไฟล์ที่แนบในเครื่อง (OpenThai 2.0, research/ocr/server.py) — เก็บผลดิบไว้เสมอ
      aiProcessingText.textContent = "กำลังอ่านใบเสร็จและเอกสารแนบด้วย OCR...";
      var ocrByFile = await ocrAllFiles(files);
      var ocrTextCombined = ocrByFile.map(function (f) { return f.fileName + ":\n" + (f.text || "(OCR อ่านไม่ได้/ไม่ได้เปิด OCR)"); }).join("\n\n");

      // 2) อ่านยอดเงิน/วันที่/หมวด/ชื่อร้าน — ใช้ไฟล์รูปภาพแรก (หรือ pdf หน้าแรกที่แปลงแล้ว) ให้ AI
      // จริงอ่านถ้าตั้งค่าไว้ (js/receipt-ai.js) ไม่งั้นดึงจากข้อความ OCR ตรงๆ ไม่งั้นใช้ข้อมูลจำลอง
      aiProcessingText.textContent = "กำลังอ่านยอดเงิน วันที่ และหมวดค่าใช้จ่าย...";
      var primaryFile = files[0] || null;
      var primaryImageFile = primaryFile ? await toImageFile(primaryFile) : null;
      var primaryOcrResult = ocrByFile[0] && ocrByFile[0].ocrResult;
      var aiReady = window.AiClient && window.AiClient.isConfigured();

      var aiData;
      var aiModeNote;
      var usedRealAi = false;
      if (primaryImageFile && aiReady) {
        try {
          aiData = await window.analyzeReceiptWithAI(primaryImageFile, window.RECEIPT_DATA.categories, primaryOcrResult ? window.OcrClient.textForAi(primaryOcrResult) : "");
          aiModeNote = "อ่านด้วย AI (" + window.AiClient.describe(null, true) + ")" + (primaryOcrResult ? " ร่วมกับ OCR ในเครื่อง" : "") + " จากไฟล์ " + primaryFile.name;
          usedRealAi = true;
        } catch (err) {
          warn("AI อ่านใบเสร็จไม่สำเร็จ (" + err.message + ") — ใช้ข้อมูลตัวอย่างแทนชั่วคราว");
          aiData = randomAiData();
          aiModeNote = "AI อ่านไม่สำเร็จ — ใช้ข้อมูลตัวอย่างแทน";
        }
      } else if (primaryOcrResult) {
        var fields = window.OcrClient.extractFields(primaryOcrResult);
        aiData = { confirmedAmount: fields.amount || "", confirmedDate: fields.date, confirmedCategory: "", confirmedVendorName: fields.vendorName };
        aiModeNote = "อ่านด้วย OCR ในเครื่อง (ไม่ใช้ AI) จากไฟล์ " + primaryFile.name + " — ไม่ได้ตั้งค่า AI จึงไม่มีหมวดค่าใช้จ่ายอัตโนมัติ";
      } else {
        aiData = randomAiData();
        aiModeNote = primaryFile
          ? "ยังไม่ได้ตั้งค่า AI และไม่ได้เปิด OCR ในเครื่อง — ใช้ข้อมูลตัวอย่างแทน (ดู js/ai-config.example.js)"
          : "ไม่ได้แนบไฟล์ — ใช้ข้อมูลตัวอย่างแทน (โหมดสาธิต)";
      }

      // อ่านยอดไม่ได้ → null (ไม่ใช่ NaN) เพื่อให้หน้าจอแสดง "-" และ rule engine ตอบ INVALID_AMOUNT
      var parsedAmount = parseFloat(aiData.confirmedAmount);
      var confirmedAmount = isFinite(parsedAmount) ? parsedAmount : null;
      var confirmedDate = aiData.confirmedDate || "";
      var confirmedCategory = aiData.confirmedCategory || "";
      var confirmedVendorName = aiData.confirmedVendorName || "";

      // 3) เดาประเภทเอกสารของทุกไฟล์ที่แนบ + เช็คความครบของเอกสารประกอบแบบอัตโนมัติ (js/receipt-pipeline.js
      // — โมดูลเดียวกับที่ batch runner ใน research/batch/ ใช้ เพื่อไม่ให้ตรรกะสองที่เพี้ยนไปจากกัน)
      aiProcessingText.textContent = "กำลังตรวจสอบความครบของเอกสารประกอบ...";
      var classification = window.ReceiptPipeline.classifyAttachedFiles(ocrByFile, documentTypesById, window.DocumentClassifier);
      var evidence = window.ReceiptPipeline.buildEvidence(ocrByFile, classification, window.DocumentClassifier);

      // 4) จับคู่กับรายการในประมาณการของโครงการ (ถ้ามี) จากหมวดที่อ่านได้
      var budget = await matchBudget(projectId, confirmedCategory);

      var summaryAmountValue = parseFloat(document.getElementById("summaryAmount").value);
      var summary = isNaN(summaryAmountValue) ? undefined : { amount: summaryAmountValue };

      // 5) ตรวจตามระเบียบ — รัน rule-engine เสมอ (ใช้คำนวณกลุ่มประมาณการ/เอกสาร + เก็บไว้ตรวจสอบย้อนหลัง)
      aiProcessingText.textContent = "กำลังตรวจสอบตามระเบียบแหล่งทุน...";
      var ruleCheckResult = await checkWithRuleEngine(fundSourceId, confirmedCategory, confirmedAmount, evidence, budget, summary);

      // 6) ถ้า verdictMode เป็น 'llm' (ค่าเริ่มต้น) ให้ LLM ตัดสิน pass/fail เองจากผล OCR + ระเบียบ แทน
      // ผลของ rule-engine ข้างบน (ซึ่งยังเก็บไว้ใน ruleCheck เพื่อเทียบ/ตรวจสอบย้อนหลังเสมอ) — เรียกไม่
      // สำเร็จ/ยังไม่ได้ตั้งค่า AI ก็ fallback กลับไปใช้ผลของ rule-engine แทน
      var llmResult = null;
      if (VERDICT_MODE === "llm") {
        aiProcessingText.textContent = "กำลังให้ LLM ตัดสินผลจากระเบียบและข้อความ OCR...";
        var ruleSetForLlm = await getRuleSet(fundSourceId);
        var estimate = await estimateWithSpent(projectId);
        llmResult = ruleSetForLlm
          ? await window.LlmVerdict.evaluateWithLlm(ocrTextCombined, ruleSetForLlm, documentNames, { category: confirmedCategory, amount: confirmedAmount, estimate: estimate }, { config: window.AI_CONFIG })
          : { verdict: null, issues: [], rule_refs: [], recommendation: "", raw: null, model: null, promptVersion: window.LlmVerdict.PROMPT_VERSION, durationMs: 0, error: "ไม่พบแหล่งทุนของโครงการนี้" };
      }
      var decided = window.ReceiptPipeline.decideVerdict(VERDICT_MODE, ruleCheckResult, llmResult, window.RuleEngine.STATUS);
      var finalStatus = decided.status;
      var finalExplanation = decided.explanation;

      // 7) บันทึกใบเสร็จ — เก็บผลดิบของทุกขั้นแยกกันเสมอ (ocrRaw, documentClassification, llmVerdict,
      // ruleCheck) เพื่อย้อนวิเคราะห์ว่าความผิดพลาดเกิดที่ขั้นไหนได้ ไม่ทิ้งอะไรแม้ขั้นนั้นจะ fallback
      aiProcessingText.textContent = "กำลังบันทึกข้อมูลใบเสร็จ...";
      var newReceiptId = await nextReceiptId();
      var receiptRef = db.collection("users").doc(user.uid)
        .collection("projects").doc(projectId)
        .collection("receipts").doc(newReceiptId);

      await receiptRef.set({
        projectId: projectId,
        confirmedAmount: confirmedAmount,
        confirmedDate: confirmedDate,
        confirmedCategory: confirmedCategory,
        confirmedVendorName: confirmedVendorName,
        status: finalStatus,
        aiExplanation: finalExplanation,
        verdictMode: VERDICT_MODE,
        aiModeNote: aiModeNote,
        // ที่มาของคำตัดสินของ rule-engine (เสมอ ไม่ว่า verdictMode จะเป็นอะไร) — ใช้ตรวจย้อนหลังและ
        // เทียบกับผลของเจ้าหน้าที่การเงินในการประเมินผล (Stage B)
        ruleCheck: {
          engineVersion: ruleCheckResult.engineVersion,
          reasonCode: ruleCheckResult.reasonCode,
          autoVerified: ruleCheckResult.autoVerified,
          fundSourceId: ruleCheckResult.fundSourceId,
          ruleVersionId: ruleCheckResult.ruleVersionId,
          ruleItemId: ruleCheckResult.ruleItemId,
          status: ruleCheckResult.status,
          explanation: ruleCheckResult.explanation,
          findings: ruleCheckResult.findings.map(function (f) { return { code: f.code, message: f.message }; }),
        },
        // ผล LLM ดิบทั้งก้อน (null ถ้า verdictMode เป็น 'rule') — เก็บไว้เสมอตามข้อกำหนด "ห้ามทิ้ง"
        llmVerdict: window.LlmVerdict.record(llmResult),
        // ผล OCR ดิบของทุกไฟล์ที่แนบ (ข้อความ+confidence ทุกบรรทัด) — เก็บไว้เสมอไม่ว่าจะใช้ต่อสำเร็จหรือไม่
        ocrRaw: ocrByFile.map(function (f) { return { fileName: f.fileName, text: f.text, lines: f.lines }; }),
        // ประเภทเอกสารที่เดาได้ของแต่ละไฟล์ (heuristic, ดู js/document-classifier.js) — null = เดาไม่ได้
        documentClassification: classification,
        // null = โครงการยังไม่มีประมาณการ หรือไม่มีรายการไหนตรงกับหมวดที่อ่านได้ (ดู ruleCheck.reasonCode แยกสองกรณี)
        budgetLineId: ruleCheckResult.budgetLineId || null,
        // ยอดที่นักวิจัยลงไว้ในใบสรุปรายรับ-จ่าย (null = ไม่ได้กรอก จึงไม่ได้เทียบ)
        summaryAmount: summary ? summary.amount : null,
        // เอกสาร/การยืนยันที่เดาได้อัตโนมัติจากไฟล์ที่แนบ (ไม่ใช่ที่ผู้ใช้ติ๊กเองอีกต่อไป)
        providedDocumentTypeIds: evidence.documentTypeIds,
        confirmedAttestations: evidence.attestationIds,
        isExported: false,
        ownerUserId: user.uid,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        aiProcessingText.textContent = "กำลังอัปโหลดไฟล์ขึ้น Google Drive " + (i + 1) + "/" + files.length + "...";

        var driveFile = await window.googleDriveUploadReceiptFile(file, receiptRef.id);

        await receiptRef.collection("files").add({
          originalFileName: file.name,
          fileType: fileExtension(file.name),
          fileSizeBytes: file.size,
          fileReference: driveFile.webViewLink,
          driveFileId: driveFile.id,
          sortOrder: i + 1,
          documentTypeId: (classification[i] && classification[i].documentTypeId) || null,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Level 2 agentic AI (js/receipt-check-agent.js) อธิบายผลของ rule-engine เพิ่มเติม — มีความหมาย
      // เฉพาะตอน verdictMode เป็น 'rule' เท่านั้น (ตอน 'llm' คำอธิบาย/คำแนะนำมาจาก js/llm-verdict.js
      // โดยตรงอยู่แล้ว เรียก agent ซ้ำจะเอาคำอธิบายของผล rule-engine ไปทับคำแนะนำของ LLM โดยไม่ได้ตั้งใจ)
      if (VERDICT_MODE !== "llm") {
        try {
          aiProcessingText.textContent = "กำลังให้ AI อธิบายผลตรวจและวิธีแก้ไข...";
          var enrichedExplanation = await window.runReceiptCheckAgent({
            receiptRef: receiptRef,
            evidenceChainId: ruleCheckResult.evidenceChainId,
            category: confirmedCategory,
            amount: confirmedAmount,
            deterministicResult: ruleCheckResult,
          });
          finalExplanation = enrichedExplanation;
          await receiptRef.update({ aiExplanation: enrichedExplanation });
        } catch (agentErr) {
          console.warn("AI agent อธิบายเพิ่มเติมไม่สำเร็จ (ใช้ผลตรวจแบบไม่มีคำอธิบายเสริม):", agentErr);
        }
      }

      var projectName = projectSelect.options[projectSelect.selectedIndex].textContent;
      showCheckResult({
        confirmedAmount: confirmedAmount, confirmedDate: confirmedDate,
        confirmedCategory: confirmedCategory, confirmedVendorName: confirmedVendorName,
      }, { status: finalStatus, aiExplanation: finalExplanation }, projectName, aiModeNote, classification, usedRealAi);
      goToStep(3);
    } catch (err) {
      goToStep(1);
      warn("ประมวลผลไม่สำเร็จ: " + err.message + " (เช็ค Firestore Rules หรือการเชื่อมต่อ Google Drive ว่าเปิดให้เขียนได้หรือยัง)");
    } finally {
      step1Button.disabled = false;
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

  function showCheckResult(values, checkResult, projectName, aiModeNote, classification, usedRealAi) {
    document.getElementById("verdictModeNote").textContent = VERDICT_MODE === "llm"
      ? "LLM เป็นผู้ตัดสินผลจากผล OCR และระเบียบของแหล่งทุน (temperature 0) — ไม่มีขั้นตอนให้แก้ไขข้อมูลก่อนตรวจ"
      : "Rule Engine เป็นผู้ตัดสินผล คำอธิบายด้านล่างเป็นภาษาที่เข้าใจง่าย ไม่ใช่ศัพท์บัญชี";

    var chipClass = STATUS_CHIP_CLASS[checkResult.status] || "chip-status--pending";
    var calloutKind = STATUS_CALLOUT_KIND[checkResult.status] || "reject";

    var docLines = classification.filter(function (c) { return c.documentTypeId; })
      .map(function (c) { return esc(c.fileName) + " → " + esc(documentNames[c.documentTypeId] || c.documentTypeId); }).join("<br>");

    document.getElementById("checkResult").innerHTML =
      '<div class="receipt-entry">' +
        '<div class="receipt-card">' +
          '<div class="receipt-card__thumb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>' +
          '<div class="receipt-card__body">' +
            '<div class="receipt-card__amount">' + esc(formatCurrency(values.confirmedAmount)) + '</div>' +
            '<div class="receipt-card__meta">' + esc(projectName) + ' · ' + esc(values.confirmedDate) + ' · ' + esc(values.confirmedCategory) + ' · ' + esc(values.confirmedVendorName) + '</div>' +
            (usedRealAi ? '<div class="chip-status chip-status--pass" style="margin-top:6px;">AI suggestion</div>' : '') +
          '</div>' +
          '<div class="receipt-card__status"><span class="chip-status ' + chipClass + '">' + esc(checkResult.status) + '</span></div>' +
        '</div>' +
        '<div class="rule-callout rule-callout--' + calloutKind + '">' +
          '<p class="rule-callout__explain">' + esc(window.ReceiptPipeline.humanizeAdvice(checkResult.aiExplanation, window.ReceiptPipeline.referenceNames(window.RECEIPT_DATA))) + '</p>' +
        '</div>' +
        '<p class="text-small" style="color:var(--color-content-secondary);">' + esc(aiModeNote) + '</p>' +
        (docLines ? '<p class="text-small" style="color:var(--color-content-secondary);">เอกสารที่ตรวจพบ:<br>' + docLines + '</p>' : '') +
      '</div>';
  }

  // ─── ขั้นตอนที่ 3 → เริ่มใหม่ ───
  document.getElementById("uploadAgainButton").addEventListener("click", function () {
    clearWarning();
    projectSelect.value = "";
    fileInput.value = "";
    fileStatusBox.textContent = "";
    document.getElementById("summaryAmount").value = "";
    goToStep(1);
  });
})();
