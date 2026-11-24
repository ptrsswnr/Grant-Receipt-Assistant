// ─────────────────────────────────────────────────────────────
// js/batch-import.js — นำเข้าไฟล์สแกน (PDF/รูป) ที่อาจมีเอกสารหลายใบของทั้งโครงการในไฟล์เดียว
// ไฟล์ละ 1 การนำเข้า: OCR ทีละหน้า → แยกเอกสาร+ประเภท → ดึงฟิลด์ → จัดกลุ่มเป็นรายการค่าใช้จ่าย →
// จับคู่ประมาณการ + ตัดสิน (js/document-pipeline.js) → สร้างใบเสร็จ 1 รายการต่อกลุ่ม แบบเดียวกับ new-receipt.js
// ไม่มีขั้นตอนให้ผู้ใช้ยืนยันในขั้นใด
//
// ผลแต่ละขั้นเก็บแยกกันใน users/{uid}/projects/{p}/importBatches/{importNNN}:
//   ตัวเอกสาร        — ไฟล์, สถานะ, split (วิธี/โมเดล/ผล LLM ดิบ/สาเหตุที่ fallback), grouping (เหมือนกัน), receiptIds
//   pages/{pageNNN}  — OCR ดิบรายหน้า (ข้อความ+confidence ทุกบรรทัด)
//   documents/{docNNN} — ช่วงหน้า, ประเภท, ฟิลด์ที่ดึงได้ (+ผลดิบ), อยู่ในรายการ/ใบเสร็จไหน
// ใบเสร็จที่สร้างอ้างกลับด้วย importBatchId + sourcePages เพื่อย้อนไปดูหน้าในไฟล์สแกนต้นฉบับได้
// ─────────────────────────────────────────────────────────────
(async function () {
  var VERDICT_MODE = (window.VERDICT_CONFIG && window.VERDICT_CONFIG.mode) || "llm";
  var IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];
  var FIRESTORE_BATCH_LIMIT = 400;

  var projectSelect = document.getElementById("projectId");
  var fileInput = document.getElementById("scanFiles");
  var warningBox = document.getElementById("warningBox");
  var fileStatusBox = document.getElementById("fileStatus");
  var estimateNotice = document.getElementById("estimateNotice");
  var privacyConsentCard = document.getElementById("privacyConsentCard");
  var privacyConsentCheckbox = document.getElementById("privacyConsentCheckbox");
  var startButton = document.getElementById("startButton");
  var progressSection = document.getElementById("progressSection");
  var progressText = document.getElementById("progressText");
  var resultSection = document.getElementById("resultSection");
  var resultList = document.getElementById("resultList");
  var Store = window.ReceiptStore;
  var DP = window.DocumentPipeline;

  var user = await window.AUTH_READY;

  var userDoc = await db.collection("users").doc(user.uid).get();
  var privacyConsentAlreadyGiven = userDoc.exists && !!userDoc.data().privacyConsentAcceptedAt;
  if (!privacyConsentAlreadyGiven) privacyConsentCard.style.display = "block";

  var projectFundSourceId = {};
  var userProjects = await db.collection("users").doc(user.uid).collection("projects").get();
  userProjects.forEach(function (doc) {
    var option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.data().projectName;
    projectSelect.appendChild(option);
    projectFundSourceId[doc.id] = doc.data().fundSourceId;
  });
  var preselect = new URLSearchParams(location.search).get("projectId");
  if (preselect && projectFundSourceId.hasOwnProperty(preselect)) projectSelect.value = preselect;

  var refData = await Store.loadReferenceData();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatCurrency(amount) {
    return typeof amount === "number" ? "฿" + amount.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";
  }

  function pad(n) {
    return String(n).padStart(3, "0");
  }

  function fileExtension(name) {
    return name.split(".").pop().toLowerCase();
  }

  function pageRange(d) {
    return d.pageFrom === d.pageTo ? "หน้า " + d.pageFrom : "หน้า " + d.pageFrom + "–" + d.pageTo;
  }

  function warn(message) {
    warningBox.textContent = message;
    warningBox.style.display = "block";
  }

  function progress(message) {
    progressText.textContent = message;
  }

  // ─── ต้องมีประมาณการก่อน (เหมือนหน้าอัปโหลดใบเดียว) ───
  var budgetLinesCache = {};
  function getBudgetLines(projectId) {
    if (!budgetLinesCache[projectId]) budgetLinesCache[projectId] = Store.loadBudgetLines(user.uid, projectId);
    return budgetLinesCache[projectId];
  }
  async function refreshEstimateNotice() {
    var projectId = projectSelect.value;
    var ok = !projectId || (await getBudgetLines(projectId)).length > 0;
    estimateNotice.hidden = ok;
    if (!ok) {
      estimateNotice.innerHTML = 'โครงการนี้ยังไม่มีประมาณการในระบบ — ต้อง<a href="budget.html?projectId=' +
        encodeURIComponent(projectId) + '">นำเข้าไฟล์ประมาณการ (ตาราง 17.2)</a>ก่อน จึงจะนำเข้าเอกสารได้';
    }
    return ok;
  }
  projectSelect.addEventListener("change", refreshEstimateNotice);
  refreshEstimateNotice();

  var connectDriveButton = document.getElementById("connectDriveButton");
  var driveConnectStatus = document.getElementById("driveConnectStatus");
  function refreshDriveConnectStatus() {
    driveConnectStatus.textContent = window.googleDriveIsConnected() ? "เชื่อมต่อแล้ว" : "";
  }
  refreshDriveConnectStatus();
  connectDriveButton.addEventListener("click", async function () {
    connectDriveButton.disabled = true;
    try {
      await window.googleDriveConnect();
      refreshDriveConnectStatus();
    } catch (err) {
      driveConnectStatus.innerHTML = '<span style="color:var(--color-error);">' + esc(err.message) + '</span>';
    } finally {
      connectDriveButton.disabled = false;
    }
  });

  fileInput.addEventListener("change", function () {
    var files = Array.from(fileInput.files);
    fileStatusBox.textContent = files.length ? "เลือกไว้ " + files.length + " ไฟล์ (" + files.map(function (f) { return f.name; }).join(", ") + ")" : "";
  });

  // เลขการนำเข้าถัดไปของโครงการ (import001, import002, ...) — อ่านง่ายใน Console เหมือนรหัสใบเสร็จ
  async function nextImportNumber(projectId) {
    var snap = await Store.projectRef(user.uid, projectId).collection("importBatches").get();
    var max = 0;
    snap.forEach(function (d) {
      var m = d.id.match(/^import(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return max + 1;
  }

  // ─── ขั้นที่ 1: OCR ทีละหน้า — PDF แปลงทีละหน้าในเบราว์เซอร์แล้วส่งให้ OCR ทีละหน้า (ไม่ติดเพดานขนาดไฟล์
  // ของ OCR และเห็นความคืบหน้า) ผลรวมกลับตามลำดับหน้า ───
  async function ocrPages(file, label) {
    if (IMAGE_EXTENSIONS.indexOf(fileExtension(file.name)) !== -1) {
      progress(label + ": OCR หน้า 1/1");
      return window.OcrClient.pagesOf(await window.OcrClient.read(file), 1);
    }
    var pages = [];
    await window.forEachPdfPageImage(file, async function (image, n, total) {
      progress(label + ": OCR หน้า " + n + "/" + total);
      pages = pages.concat(window.OcrClient.pagesOf(await window.OcrClient.read(image), n));
    });
    return pages;
  }

  async function writeInChunks(items, write) {
    for (var i = 0; i < items.length; i += FIRESTORE_BATCH_LIMIT) {
      var wb = db.batch();
      items.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach(function (item) { write(wb, item); });
      await wb.commit();
    }
  }

  function llmVerdictRecord(llm) {
    if (!llm) return null;
    return {
      verdict: llm.verdict, issues: llm.issues, rule_refs: llm.rule_refs, recommendation: llm.recommendation,
      raw: llm.raw, model: llm.model, promptVersion: llm.promptVersion, durationMs: llm.durationMs, error: llm.error,
    };
  }

  function stageRecord(stage) {
    return { method: stage.method, model: stage.model || null, promptVersion: stage.promptVersion, raw: stage.raw || null, error: stage.error || null };
  }

  // ─── นำเข้าไฟล์ 1 ไฟล์ ───
  async function importFile(file, ctx) {
    var label = file.name;
    var importId = "import" + pad(ctx.nextImportNumber++);
    var projectRef = Store.projectRef(user.uid, ctx.projectId);
    var batchRef = projectRef.collection("importBatches").doc(importId);
    await batchRef.set({
      fileName: file.name, fileSizeBytes: file.size, status: "processing", verdictMode: VERDICT_MODE,
      ocrEngine: "OpenThai2.0-OCR-Text", ownerUserId: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // ไฟล์ต้นฉบับขึ้น Drive ก่อน — ถ้าไม่สำเร็จจะหยุดก่อนสร้างใบเสร็จใดๆ
      progress(label + ": อัปโหลดไฟล์ต้นฉบับขึ้น Google Drive...");
      var driveFile = await window.googleDriveUploadReceiptFile(file, importId);
      await batchRef.update({ driveFileId: driveFile.id, fileReference: driveFile.webViewLink });

      var pages = await ocrPages(file, label);
      progress(label + ": บันทึกผล OCR " + pages.length + " หน้า...");
      await writeInChunks(pages, function (wb, p) {
        wb.set(batchRef.collection("pages").doc("page" + pad(p.page)), {
          page: p.page, text: p.text, lines: p.lines,
          lowConfidenceCount: p.lines.filter(function (l) { return l.confidence < 0.9; }).length,
        });
      });
      await batchRef.update({ pageCount: pages.length });

      progress(label + ": แยกเอกสารและจัดประเภท (" + pages.length + " หน้า)...");
      var split = await DP.splitAndClassify(pages, refData.documentTypesById, ctx.deps);
      await batchRef.update({ split: Object.assign(stageRecord(split), { documentCount: split.documents.length }) });

      var documents = split.documents.map(function (d) {
        var inRange = pages.filter(function (p) { return p.page >= d.pageFrom && p.page <= d.pageTo; });
        return Object.assign({}, d, {
          text: DP.documentText(pages, d),
          lines: [].concat.apply([], inRange.map(function (p) { return p.lines; })),
        });
      });
      for (var i = 0; i < documents.length; i++) {
        progress(label + ": ดึงข้อมูลเอกสาร " + (i + 1) + "/" + documents.length + "...");
        documents[i].extraction = await DP.extractDocumentFields(documents[i], documents[i].text, documents[i].lines,
          refData.documentTypesById, window.RECEIPT_DATA.categories, ctx.deps);
      }

      progress(label + ": จัดกลุ่มเป็นรายการค่าใช้จ่าย...");
      var grouping = await DP.groupIntoExpenses(documents, refData.documentTypesById, ctx.deps);

      var receipts = [];
      for (var g = 0; g < grouping.groups.length; g++) {
        progress(label + ": ตรวจรายการที่ " + (g + 1) + "/" + grouping.groups.length + "...");
        var group = grouping.groups[g];
        var result = await DP.evaluateGroup(group, documents, {
          ruleSet: ctx.ruleSet, documentNames: refData.documentNames, documentTypesById: refData.documentTypesById,
          estimate: ctx.estimate, verdictMode: VERDICT_MODE,
        }, ctx.deps);
        // รายการถัดไปในไฟล์เดียวกันต้องเห็นยอดที่รายการนี้ตัดไปแล้ว
        var line = ctx.estimate.filter(function (l) { return l.id === result.budgetLineId; })[0];
        if (line && typeof result.amount === "number") line.spentBefore += result.amount;
        receipts.push(await saveReceipt(group, result, documents, file, importId, driveFile, ctx));
      }

      progress(label + ": บันทึกผลแยกเอกสาร...");
      await writeInChunks(documents.map(function (d, i) { return { d: d, i: i }; }), function (wb, item) {
        var groupIndexes = grouping.groups.map(function (gr, k) { return gr.documentIndexes.indexOf(item.i) !== -1 ? k : -1; })
          .filter(function (k) { return k !== -1; });
        var x = item.d.extraction;
        wb.set(batchRef.collection("documents").doc("doc" + pad(item.i + 1)), {
          index: item.i, pageFrom: item.d.pageFrom, pageTo: item.d.pageTo,
          documentTypeId: item.d.documentTypeId, classificationMethod: split.method,
          extraction: { kind: x.kind, receipt: x.receipt, fields: x.fields, method: x.method, model: x.model, promptVersion: x.promptVersion, raw: x.raw, error: x.error },
          groupIndexes: groupIndexes,
          receiptIds: groupIndexes.map(function (k) { return receipts[k].receiptId; }),
        });
      });

      await batchRef.update({
        status: "done",
        documentCount: documents.length,
        grouping: Object.assign(stageRecord(grouping), { groups: grouping.groups, unassigned: grouping.unassigned }),
        receiptIds: receipts.map(function (r) { return r.receiptId; }),
        finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return { file: file, importId: importId, pages: pages, split: split, documents: documents, grouping: grouping, receipts: receipts };
    } catch (err) {
      await batchRef.update({ status: "error", errorMessage: err.message });
      throw err;
    }
  }

  async function saveReceipt(group, result, documents, file, importId, driveFile, ctx) {
    var receiptId = Store.receiptIdFor(ctx.nextReceiptNumber++);
    var receiptRef = Store.projectRef(user.uid, ctx.projectId).collection("receipts").doc(receiptId);
    var members = group.documentIndexes.map(function (i) {
      var d = documents[i];
      return { documentId: "doc" + pad(i + 1), documentTypeId: d.documentTypeId, pageFrom: d.pageFrom, pageTo: d.pageTo };
    });
    var payment = documents[group.paymentDocumentIndex];
    var rc = result.ruleCheck;
    await receiptRef.set({
      projectId: ctx.projectId,
      confirmedAmount: result.amount,
      confirmedDate: result.date,
      confirmedCategory: result.category,
      confirmedVendorName: result.vendorName,
      status: result.status,
      aiExplanation: result.explanation,
      verdictMode: VERDICT_MODE,
      aiModeNote: "นำเข้าจากไฟล์ " + file.name + " (" + pageRange(payment) + ")",
      ruleCheck: {
        engineVersion: rc.engineVersion, reasonCode: rc.reasonCode, autoVerified: rc.autoVerified,
        fundSourceId: rc.fundSourceId, ruleVersionId: rc.ruleVersionId, ruleItemId: rc.ruleItemId,
        status: rc.status, explanation: rc.explanation,
        findings: rc.findings.map(function (f) { return { code: f.code, message: f.message }; }),
      },
      llmVerdict: llmVerdictRecord(result.llmVerdict),
      // OCR ดิบอยู่ที่ importBatches/{importId}/pages — ใบเสร็จเก็บแค่ว่ามาจากเอกสาร/หน้าไหน
      ocrRaw: null,
      documentClassification: members,
      importBatchId: importId,
      sourcePages: members.map(function (m) { return { pageFrom: m.pageFrom, pageTo: m.pageTo }; }),
      budgetLineId: result.budgetLineId,
      summaryAmount: null,
      providedDocumentTypeIds: result.evidence.documentTypeIds,
      confirmedAttestations: result.evidence.attestationIds,
      isExported: false,
      ownerUserId: user.uid,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // ไฟล์แนบชี้ไปไฟล์ต้นฉบับไฟล์เดียวกันพร้อมช่วงหน้า — ไม่มี driveFileId เพราะไฟล์นี้ใช้ร่วมกันหลายใบเสร็จ
    // (receipts.js ข้ามไฟล์ที่มี importBatchId ตอนลบใบเสร็จ ไม่ลบไฟล์ต้นฉบับใน Drive)
    var wb = db.batch();
    members.forEach(function (m, k) {
      wb.set(receiptRef.collection("files").doc(), {
        originalFileName: file.name + " (" + pageRange(m) + ")",
        fileType: fileExtension(file.name),
        fileReference: driveFile.webViewLink,
        importBatchId: importId,
        pageFrom: m.pageFrom, pageTo: m.pageTo,
        documentTypeId: m.documentTypeId,
        sortOrder: k + 1,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await wb.commit();
    return { receiptId: receiptId, group: group, result: result };
  }

  var STATUS_CHIP_CLASS = { "ผ่าน": "chip-status--pass", "ต้องแก้ไข": "chip-status--fix", "ต้องชี้แจง/ขออนุมัติ": "chip-status--approval", "ไม่เข้าเงื่อนไข": "chip-status--reject" };
  var METHOD_LABEL = { llm: "LLM", keyword: "คำสำคัญ (ไม่มี AI หรือ LLM ตอบผิดรูป)", "payment-order": "ลำดับเอกสารจ่ายเงิน (ไม่มี AI หรือ LLM ตอบผิดรูป)" };

  function renderResult(r) {
    var typeName = function (id) { return refData.documentNames[id] || "ไม่ทราบประเภท"; };
    var html = '<div class="card" style="margin-bottom:16px;">';
    html += '<h3 style="margin-top:0;">' + esc(r.file.name) + ' <span class="text-small">(' + esc(r.importId) + ')</span></h3>';
    html += '<p class="text-small">' + r.pages.length + " หน้า → " + r.documents.length + " เอกสาร (แยกด้วย " + esc(METHOD_LABEL[r.split.method]) + ") → " +
      r.receipts.length + " รายการค่าใช้จ่าย (จัดกลุ่มด้วย " + esc(METHOD_LABEL[r.grouping.method]) + ")</p>";
    if (r.split.error) html += '<p class="text-small" style="color:var(--color-warning);">แยกเอกสารด้วย LLM ไม่สำเร็จ: ' + esc(r.split.error) + "</p>";
    if (r.grouping.error) html += '<p class="text-small" style="color:var(--color-warning);">จัดกลุ่มด้วย LLM ไม่สำเร็จ: ' + esc(r.grouping.error) + "</p>";

    r.receipts.forEach(function (rec) {
      var res = rec.result;
      var chip = STATUS_CHIP_CLASS[res.status] || "chip-status--pending";
      html += '<div class="receipt-entry"><div class="receipt-card"><div class="receipt-card__body">' +
        '<div class="receipt-card__amount">' + esc(formatCurrency(res.amount)) + "</div>" +
        '<div class="receipt-card__meta">' + esc(rec.receiptId) + " · " + esc(res.category || "(ไม่ทราบหมวด)") + " · " + esc(res.date) + " · " + esc(res.vendorName) + "</div>" +
        '<div class="text-small">' + rec.group.documentIndexes.map(function (i) { var d = r.documents[i]; return esc(pageRange(d) + ": " + typeName(d.documentTypeId)); }).join("<br>") + "</div>" +
        '</div><div class="receipt-card__status"><span class="chip-status ' + chip + '">' + esc(res.status) + "</span></div></div>" +
        '<div class="rule-callout rule-callout--' + chip.replace("chip-status--", "") + '"><p class="rule-callout__explain">' + esc(res.explanation) + "</p></div></div>";
    });
    if (r.grouping.unassigned.length) {
      html += '<p class="text-small">เอกสารที่ไม่อยู่ในรายการใด (เก็บไว้ในผลการนำเข้า): ' +
        r.grouping.unassigned.map(function (i) { var d = r.documents[i]; return esc(pageRange(d) + " " + typeName(d.documentTypeId)); }).join(", ") + "</p>";
    }
    html += "</div>";
    resultList.insertAdjacentHTML("beforeend", html);
  }

  startButton.addEventListener("click", async function () {
    warningBox.style.display = "none";
    var projectId = projectSelect.value;
    var files = Array.from(fileInput.files);
    if (!privacyConsentAlreadyGiven && !privacyConsentCheckbox.checked) return warn("กรุณายอมรับเงื่อนไขเรื่องความเป็นส่วนตัวก่อนอัปโหลด");
    if (!projectId) return warn("กรุณาเลือกโครงการวิจัยก่อน");
    if (!(await refreshEstimateNotice())) return warn("โครงการนี้ยังไม่มีประมาณการ — นำเข้าไฟล์ประมาณการก่อน แล้วจึงนำเข้าเอกสาร");
    if (!files.length) return warn("กรุณาเลือกไฟล์สแกนอย่างน้อย 1 ไฟล์");
    var bad = files.filter(function (f) { return ["pdf"].concat(IMAGE_EXTENSIONS).indexOf(fileExtension(f.name)) === -1; })[0];
    if (bad) return warn("ไฟล์ \"" + bad.name + "\" ไม่ใช่ชนิดที่รองรับ (pdf/jpg/png)");
    if (!(await window.OcrClient.isAvailable())) return warn("ต่อ OCR ในเครื่องไม่ได้ — เปิด research/ocr/server.py ก่อน แล้วรีเฟรชหน้านี้");
    if (!window.googleDriveIsConnected()) return warn('ยังไม่ได้เชื่อมต่อ Google Drive (หรือหมดอายุแล้ว) — กดปุ่ม "เชื่อมต่อ Google Drive" ก่อน');

    if (!privacyConsentAlreadyGiven) {
      privacyConsentAlreadyGiven = true;
      privacyConsentCard.style.display = "none";
      await db.collection("users").doc(user.uid).set({ privacyConsentAcceptedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    startButton.disabled = true;
    progressSection.hidden = false;
    resultSection.hidden = false;
    resultList.innerHTML = "";
    document.getElementById("toReceiptsLink").href = "receipts.html?projectId=" + encodeURIComponent(projectId);
    document.getElementById("verdictModeNote").textContent = VERDICT_MODE === "llm"
      ? "LLM เป็นผู้ตัดสินผลของแต่ละรายการจากข้อความ OCR ระเบียบ และประมาณการของโครงการ"
      : "Rule Engine เป็นผู้ตัดสินผลของแต่ละรายการ";
    try {
      progress("กำลังโหลดระเบียบและประมาณการ...");
      var ctx = {
        projectId: projectId,
        ruleSet: await Store.loadActiveRuleSet(projectFundSourceId[projectId], refData.evidenceChainsById),
        estimate: await Store.estimateWithSpent(user.uid, projectId, await getBudgetLines(projectId)),
        nextReceiptNumber: await Store.maxReceiptNumber(user.uid) + 1,
        nextImportNumber: await nextImportNumber(projectId),
        deps: {
          RuleEngine: window.RuleEngine, LlmVerdict: window.LlmVerdict, ReceiptPipeline: window.ReceiptPipeline,
          DocumentClassifier: window.DocumentClassifier, AiClient: window.AiClient, OcrClient: window.OcrClient,
          config: window.AI_CONFIG,
        },
      };
      if (!ctx.ruleSet) throw new Error("ไม่พบแหล่งทุนของโครงการนี้");
      for (var f = 0; f < files.length; f++) renderResult(await importFile(files[f], ctx));
      progress("เสร็จแล้ว — นำเข้า " + files.length + " ไฟล์");
    } catch (err) {
      warn("นำเข้าไม่สำเร็จ: " + err.message);
      progress("หยุดเพราะเกิดข้อผิดพลาด (ไฟล์ที่นำเข้าเสร็จก่อนหน้านี้ยังบันทึกไว้ครบ)");
    } finally {
      startButton.disabled = false;
    }
  });
})();
