// ─────────────────────────────────────────────────────────────
// js/receipt-pipeline.js — ขั้นตอน "หลัง OCR" ของการตรวจใบเสร็จแบบ pure function (ไม่แตะ Firestore/DOM)
// ดึงออกมาจาก js/new-receipt.js เพื่อให้ batch runner (research/batch/) เรียกใช้ตรรกะชุดเดียวกับเว็บจริง
// ได้โดยไม่ต้องเปิดเบราว์เซอร์ (ตามข้อกำหนด Stage B "เรียกใช้โมดูลเดิม" ไม่สร้างโค้ดคู่ขนาน)
//   1) classifyAttachedFiles — เดาประเภทเอกสารของแต่ละไฟล์ที่แนบ (js/document-classifier.js)
//   2) buildEvidence         — รวมเป็น evidence ที่ js/rule-engine.js รับ
//   3) decideVerdict         — เลือกผลสุดท้ายตาม verdictMode: 'llm' ให้ js/llm-verdict.js ตัดสิน,
//                              'rule' ใช้ผลของ js/rule-engine.js ตรงๆ (ไม่ถูกแก้ไขจากที่นี่)
// ใช้ได้ทั้งเบราว์เซอร์ (window.ReceiptPipeline) และ Node (require)
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReceiptPipeline = api;
})(typeof self !== "undefined" ? self : this, function () {
  // ocrByFile: [{ fileName, text }] ของทุกไฟล์ที่แนบ — คืน [{ fileName, documentTypeId }], documentTypeId
  // เป็น null ถ้าเดาไม่ได้ (ดูคอมเมนต์ heuristic ใน document-classifier.js)
  function classifyAttachedFiles(ocrByFile, documentTypesById, DocumentClassifier) {
    return ocrByFile.map(function (f) {
      return { fileName: f.fileName, documentTypeId: DocumentClassifier.classifyDocument(f.text, documentTypesById) };
    });
  }

  // คืนรูปแบบ evidence ที่ js/rule-engine.js รับตรงๆ ({ documentTypeIds, attestationIds })
  function buildEvidence(ocrByFile, classification, DocumentClassifier) {
    var documentTypeIds = classification.map(function (c) { return c.documentTypeId; }).filter(Boolean);
    var attestationIds = DocumentClassifier.detectAttestations(ocrByFile.map(function (f) { return f.text; }));
    return { documentTypeIds: documentTypeIds, attestationIds: attestationIds };
  }

  // เลือกผลสุดท้าย: verdictMode 'rule' ใช้ผลของ rule-engine ตรงๆ เสมอ; 'llm' ใช้ผลของ LLM เอง (binary
  // pass/fail เท่านั้น ตามโครงสร้างของ js/llm-verdict.js) ไม่สำเร็จ/ไม่มี verdict ก็ fallback กลับไปใช้
  // ผลของ rule-engine พร้อมบอกเหตุผลที่ fallback ไว้ในคำอธิบาย
  // STATUS: ค่าคงที่จาก RuleEngine.STATUS ({ PASS, FIX, APPROVAL, REJECT })
  // ─── คำแนะนำเป็นภาษาไทย ───
  // LLM ตอบ issues[].type เป็นรหัสภาษาอังกฤษ (prompt ไม่ได้กำหนดชุดรหัสตายตัว) และอ้างระเบียบด้วยรหัสในวงเล็บ
  // เหลี่ยม เช่น [chain-purchase] — แปลงเป็นข้อความที่นักวิจัยอ่านเข้าใจ ทั้งตอนบันทึก (decideVerdict) และตอนแสดง
  // (humanizeAdvice ใช้กับใบเสร็จเก่าที่บันทึกรหัสไว้แล้วด้วย)
  var ISSUE_LABELS = {
    amount_exceeded: "ยอดเกิน", over_budget: "ยอดเกินประมาณการ", over_estimate: "ยอดเกินประมาณการ",
    exceeds_estimate: "ยอดเกินประมาณการ", exceeds_cap: "ยอดเกินเพดาน", over_cap: "ยอดเกินเพดาน",
    not_in_estimate: "ไม่อยู่ในประมาณการ", budget: "ประมาณการ", estimate: "ประมาณการ",
    missing_attachment: "ขาดเอกสาร", missing_document: "ขาดเอกสาร", missing_documents: "ขาดเอกสาร",
    missing_evidence: "ขาดเอกสาร", evidence: "เอกสารประกอบ",
    missing_stamp: "ขาดตราประทับ", missing_attestation: "ขาดตราประทับ/การรับรอง",
    missing_signature: "ขาดลายมือชื่อ", invalid_amount: "ยอดเงินไม่ถูกต้อง", amount_mismatch: "ยอดเงินไม่ตรงกัน",
    date_issue: "วันที่", invalid_date: "วันที่ไม่ถูกต้อง", category_mismatch: "หมวดค่าใช้จ่ายไม่ตรง",
    category_not_allowed: "หมวดที่ไม่สนับสนุน", unreadable: "อ่านเอกสารไม่ได้", ocr_unclear: "อ่านเอกสารไม่ชัด",
    // ชื่อข้อในเช็กลิสต์ของ prompt 1.4.0 ขึ้นไป (โมเดลมักใช้เป็น issues[].type)
    budget_check: "ประมาณการ", cap_check: "ยอดเกินเพดาน", documents_check: "ขาดเอกสาร", attestations_check: "ขาดตราประทับ",
    project_check: "ชื่อโครงการไม่ตรง", project_mismatch: "ชื่อโครงการไม่ตรง", project_name_mismatch: "ชื่อโครงการไม่ตรง",
    period_check: "นอกระยะเวลาสัญญา", outside_contract_period: "นอกระยะเวลาสัญญา",
  };

  function issueLabel(type) {
    var t = String(type || "").trim();
    if (!t) return "ข้อสังเกต";
    if (/[฀-๿]/.test(t)) return t; // เป็นภาษาไทยอยู่แล้ว
    var key = t.toLowerCase().replace(/[\s-]+/g, "_");
    if (ISSUE_LABELS[key]) return ISSUE_LABELS[key];
    if (/missing|lack|absent/.test(key) && /stamp|attest/.test(key)) return "ขาดตราประทับ/การรับรอง";
    if (/missing|lack|absent|attach|document|evidence/.test(key)) return "ขาดเอกสาร";
    if (/exceed|over|above/.test(key)) return "ยอดเกิน";
    if (/estimate|budget/.test(key)) return "ประมาณการ";
    if (/amount|total/.test(key)) return "ยอดเงิน";
    if (/date/.test(key)) return "วันที่";
    if (/category/.test(key)) return "หมวดค่าใช้จ่าย";
    if (/stamp|sign/.test(key)) return "ตราประทับ/ลายมือชื่อ";
    return "ข้อสังเกต";
  }

  // รหัสอ้างอิง → ชื่อที่อ่านได้: ระเบียบ (ruleItems → ชื่อหมวด), ชุดเอกสาร (evidenceChains), ประเภทเอกสาร
  // และรายการในประมาณการ (ถ้ามี) — data = window.RECEIPT_DATA หรือข้อมูลรูปแบบเดียวกัน
  function referenceNames(data, estimateLines) {
    var names = {};
    data = data || {};
    (data.ruleItems || []).forEach(function (r) { if (r.id) names[r.id] = r.categoryName; });
    (data.evidenceChains || []).forEach(function (c) { if (c.id) names[c.id] = "ชุดเอกสาร" + (c.chainName ? "“" + c.chainName + "”" : ""); });
    (data.documentTypes || []).forEach(function (d) { if (d.id) names[d.id] = d.documentName; });
    (estimateLines || []).forEach(function (l) { if (l.id) names[l.id] = "รายการ “" + (l.itemName || l.id) + "” ในประมาณการ"; });
    return names;
  }

  function humanizeAdvice(text, names) {
    if (!text) return text;
    names = names || {};
    return String(text)
      // รหัสปัญหาแบบ snake_case ตามด้วย ":" เช่น "amount_exceeded:"
      .replace(/\b([a-z]+(?:_[a-z]+)+)\s*:/g, function (m, code) { return issueLabel(code) + ":"; })
      // รหัสอ้างอิงในวงเล็บเหลี่ยม เช่น [chain-purchase], [ruleitem019], [line011]
      .replace(/\[([a-z0-9][a-z0-9-]*)\]/gi, function (m, id) {
        if (names[id]) return /^ชุดเอกสาร|^รายการ/.test(names[id]) ? names[id] : "“" + names[id] + "”";
        if (/^line\d+$/i.test(id)) return "รายการในประมาณการ";
        if (/^ruleitem\d+$/i.test(id)) return "ระเบียบที่เกี่ยวข้อง";
        if (/^chain-/i.test(id)) return "ชุดเอกสารที่กำหนด";
        return m;
      });
  }

  function decideVerdict(verdictMode, ruleCheckResult, llmResult, STATUS) {
    if (verdictMode !== "llm") {
      return { status: ruleCheckResult.status, explanation: ruleCheckResult.aiExplanation || ruleCheckResult.explanation };
    }
    if (llmResult && llmResult.verdict) {
      var explanation = llmResult.recommendation || "";
      // LLM ตอบ pass แต่ตัวกันขัดแย้ง/ตัวตรวจหลักฐานเปลี่ยนเป็น fail — คำแนะนำของโมเดลจะเป็น "ไม่มีปัญหา ผ่านทุกข้อ"
      // ซึ่งขัดกับผล จึงไม่ใช้ แต่บอกให้แก้ตามรายการด้านล่างแทน (ผลดิบยังอยู่ใน llmVerdict.recommendation)
      if (llmResult.verdict === "fail" && llmResult.verdict_reported === "pass") {
        explanation = "ต้องแก้ไขตามรายการด้านล่าง";
      }
      if (llmResult.issues && llmResult.issues.length) {
        // ปัญหาละบรรทัด หัวข้อเป็นภาษาไทย (หน้าเว็บแสดงคำแนะนำแบบคงการขึ้นบรรทัดไว้)
        explanation += (explanation ? "\n" : "") + llmResult.issues.map(function (i) {
          return "• " + issueLabel(i.type) + ": " + (i.description || "");
        }).join("\n");
      }
      // นอกระยะเวลาสัญญา (เช็กลิสต์ข้อ 6 ของ LLM เอง) = ไม่เข้าเงื่อนไข เหมือน rule engine — เบิกไม่ได้ แก้ด้วยการแนบเอกสารไม่ได้
      // (เจ้าของโครงการ 2026-11-27) ข้อไม่ผ่านอื่นยังเป็นต้องแก้ไขตามเดิม
      var outsideContract = llmResult.period_check && llmResult.period_check.result === "outside";
      var status = llmResult.verdict === "pass" ? STATUS.PASS : (outsideContract ? STATUS.REJECT : STATUS.FIX);
      return { status: status, explanation: explanation };
    }
    var fallbackExplanation = ruleCheckResult.aiExplanation || ruleCheckResult.explanation;
    var reason = (llmResult && llmResult.error) || "ไม่ได้ตั้งค่า AI";
    return { status: ruleCheckResult.status, explanation: "LLM ตัดสินไม่สำเร็จ (" + reason + ") — ใช้ผลของ Rule Engine แทน: " + fallbackExplanation };
  }

  // ─── ฉบับแก้ไขของใบเสร็จเดิม (new-receipt.html?revise=receiptNNN) ───
  // ใบที่ "ผ่าน" แล้วไม่ต้องส่งฉบับแก้ไข
  function isRevisable(status) {
    return !!status && status !== "ผ่าน";
  }

  // รวมไฟล์ที่ใช้ตรวจของฉบับแก้ไข
  //   'append'  — ไฟล์เดิม (ข้อความ OCR ที่เก็บไว้ + ประเภทเอกสารที่เดาไว้แล้ว) ต่อด้วยไฟล์ใหม่
  //   'replace' — ไฟล์ใหม่อย่างเดียว (ไฟล์เดิมถูกแทนที่)
  // stored: { files: [{ fileName, text }], classification: [{ fileName, documentTypeId }] }
  function revisionInputs(mode, stored, ocrNew, classificationNew) {
    if (mode === "append") {
      return {
        ocrByFile: stored.files.concat(ocrNew),
        classification: stored.classification.concat(classificationNew),
      };
    }
    return { ocrByFile: ocrNew, classification: classificationNew };
  }

  // ผลเดิมของใบเสร็จก่อนบันทึกฉบับแก้ไข — ต่อท้ายไว้ใน verdictHistory (รูปเดียวกับการตรวจซ้ำ + ข้อมูลที่อ่านได้เดิม)
  // ocrRaw เก็บแค่ข้อความ ไม่เก็บ confidence รายบรรทัด เพื่อไม่ให้เอกสารใหญ่เกินขนาดที่ Firestore รับ
  function revisionSnapshot(r, mode, revisionNumber) {
    return {
      kind: "revision", revision: revisionNumber, revisionMode: mode,
      status: r.status || null, aiExplanation: r.aiExplanation || null, verdictMode: r.verdictMode || null,
      ruleCheck: r.ruleCheck || null, llmVerdict: r.llmVerdict || null, budgetLineId: r.budgetLineId || null,
      confirmedAmount: typeof r.confirmedAmount === "number" ? r.confirmedAmount : null,
      confirmedDate: r.confirmedDate || null, confirmedCategory: r.confirmedCategory || null,
      confirmedVendorName: r.confirmedVendorName || null,
      confirmedAttestations: r.confirmedAttestations || null,
      providedDocumentTypeIds: r.providedDocumentTypeIds || null,
      ocrRaw: (r.ocrRaw || []).map(function (f) { return { fileName: f.fileName || "", text: f.text || "" }; }),
      checkedAt: r.revisedAt || r.recheckedAt || r.uploadedAt || null,
    };
  }

  return {
    classifyAttachedFiles: classifyAttachedFiles, buildEvidence: buildEvidence, decideVerdict: decideVerdict,
    issueLabel: issueLabel, referenceNames: referenceNames, humanizeAdvice: humanizeAdvice,
    isRevisable: isRevisable, revisionInputs: revisionInputs, revisionSnapshot: revisionSnapshot,
  };
});
