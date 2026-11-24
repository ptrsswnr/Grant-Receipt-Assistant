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
  function decideVerdict(verdictMode, ruleCheckResult, llmResult, STATUS) {
    if (verdictMode !== "llm") {
      return { status: ruleCheckResult.status, explanation: ruleCheckResult.aiExplanation || ruleCheckResult.explanation };
    }
    if (llmResult && llmResult.verdict) {
      var explanation = llmResult.recommendation || "";
      if (llmResult.issues && llmResult.issues.length) {
        explanation += (explanation ? " — " : "") + llmResult.issues.map(function (i) { return i.type + ": " + i.description; }).join("; ");
      }
      return { status: llmResult.verdict === "pass" ? STATUS.PASS : STATUS.FIX, explanation: explanation };
    }
    var fallbackExplanation = ruleCheckResult.aiExplanation || ruleCheckResult.explanation;
    var reason = (llmResult && llmResult.error) || "ไม่ได้ตั้งค่า AI";
    return { status: ruleCheckResult.status, explanation: "LLM ตัดสินไม่สำเร็จ (" + reason + ") — ใช้ผลของ Rule Engine แทน: " + fallbackExplanation };
  }

  return { classifyAttachedFiles: classifyAttachedFiles, buildEvidence: buildEvidence, decideVerdict: decideVerdict };
});
