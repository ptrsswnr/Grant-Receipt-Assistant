// ─────────────────────────────────────────────────────────────
// js/document-classifier.js — เดาว่าไฟล์ที่แนบมาแต่ละไฟล์ "เป็นเอกสารอะไร" จากข้อความ OCR
// (documentTypes ใน Firestore เช่น ใบเสร็จรับเงิน/วจ.1/วจ.3/สำเนาบัตรประชาชน ฯลฯ) เพื่อเช็คความครบของ
// evidenceChain แบบอัตโนมัติ (ไม่ต้องให้ผู้วิจัยติ๊ก checklist เอง — ดู CLAUDE.md
// "AI receipt reading agent (Level 2)" ส่วนที่เพิ่มหลังจากนั้น)
// เป็น heuristic จับคำสำคัญ (ชื่อเอกสาร/รหัสแบบฟอร์มที่พิมพ์อยู่บนเอกสารจริง) ไม่ใช่ document
// classification model จริง — ความแม่นยำขึ้นกับว่า OCR อ่านหัวเอกสารได้ตรงแค่ไหน
// ใช้ได้ทั้งเบราว์เซอร์ (window.DocumentClassifier) และ Node (require) เพื่อให้ batch runner (Stage B)
// เรียกซ้ำได้โดยไม่ต้องเปิดเบราว์เซอร์
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DocumentClassifier = api;
})(typeof self !== "undefined" ? self : this, function () {
  // คำสำคัญของเอกสารชนิดหนึ่ง: รหัสแบบฟอร์ม (วจ.1 ฯลฯ) + แต่ละส่วนของชื่อเอกสาร (ตัด "(...)" ออก
  // เพราะมักเป็นหมายเหตุ ไม่ใช่ข้อความที่พิมพ์บนเอกสารจริงเป๊ะๆ)
  function keywordsFor(docType) {
    var words = [];
    if (docType.formCode && docType.formCode !== "-") words.push(docType.formCode);
    (docType.documentName || "").split("/").forEach(function (part) {
      part = part.replace(/\s*\([^)]*\)\s*/g, "").trim();
      if (part) words.push(part);
    });
    return words;
  }

  // OpenThai OCR มักทำวรรณยุกต์/การันต์หาย ("ที่" → "ที") และเว้นวรรคไม่ตรง — เทียบโดยตัดทั้งสองอย่างออกทั้งสองฝั่ง
  function normalize(s) {
    return String(s || "").replace(/[่-์]/g, "").replace(/\s+/g, "");
  }

  // documentTypesById: { id: { documentName, formCode, ... } } — คืน documentTypeId ที่คำสำคัญยาว
  // ที่สุดไปตรงกับข้อความ OCR (คำยาวกว่า = เจาะจงกว่า เช่น "วจ.3" ชนะ "ใบ" เปล่าๆ) หรือ null ถ้าไม่เจอเลย
  function classifyDocument(ocrText, documentTypesById) {
    var text = normalize(ocrText);
    var best = null;
    var bestLen = 0;
    Object.keys(documentTypesById || {}).forEach(function (id) {
      keywordsFor(documentTypesById[id]).forEach(function (kw) {
        var k = normalize(kw);
        if (k.length > bestLen && text.indexOf(k) !== -1) {
          best = id;
          bestLen = k.length;
        }
      });
    });
    return best;
  }

  // attestations (สิ่งที่ต้องมี "บนตัวเอกสาร" เช่นตราประทับ) — จับคำสำคัญที่ปรากฏบนตราประทับจริง
  // ไม่ใช่ข้อความอธิบายเต็มประโยคใน data.js (ซึ่งยาวเกินจะไปปรากฏบนเอกสารตรงๆ)
  var ATTESTATION_KEYWORDS = {
    "paid-stamp": "จ่ายแล้ว",
    "inspection-stamp": "ตรวจรับพัสดุ",
  };

  // ocrTexts: [ข้อความ OCR ของแต่ละไฟล์ที่แนบ] — คืนรายชื่อ attestationId ที่พบคำสำคัญในไฟล์ใดไฟล์หนึ่ง
  function detectAttestations(ocrTexts) {
    var found = [];
    Object.keys(ATTESTATION_KEYWORDS).forEach(function (id) {
      var k = normalize(ATTESTATION_KEYWORDS[id]);
      if ((ocrTexts || []).some(function (t) { return normalize(t).indexOf(k) !== -1; })) found.push(id);
    });
    return found;
  }

  return { keywordsFor: keywordsFor, normalize: normalize, classifyDocument: classifyDocument, detectAttestations: detectAttestations };
});
