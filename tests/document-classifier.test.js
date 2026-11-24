// Run: node --test tests/document-classifier.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyDocument, detectAttestations } = require("../app/js/document-classifier.js");

const DOC_TYPES = {
  "voucher-vj1": { documentName: "ใบสำคัญรับเงิน (วจ.1)", formCode: "วจ.1" },
  "travel-approval-vj3": { documentName: "แบบขออนุมัติเดินทางไปปฏิบัติงานวิจัย (วจ.3)", formCode: "วจ.3" },
  "tax-invoice-full": { documentName: "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ", formCode: "-" },
  "id-card-copy": { documentName: "สำเนาบัตรประจำตัวประชาชนผู้รับเงิน", formCode: "-" },
};

test("classifies by form code when present on the document", () => {
  assert.equal(classifyDocument("แบบขออนุมัติเดินทางไปปฏิบัติงานวิจัย วจ.3 เลขที่ 12/2569", DOC_TYPES), "travel-approval-vj3");
});

test("classifies by document name when there is no form code", () => {
  assert.equal(classifyDocument("ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ\nร้านตัวอย่าง", DOC_TYPES), "tax-invoice-full");
});

test("a slash-separated document name matches on either half", () => {
  assert.equal(classifyDocument("สำเนาบัตรประจำตัวประชาชนผู้รับเงิน แนบ", DOC_TYPES), "id-card-copy");
});

test("no keyword found anywhere → null", () => {
  assert.equal(classifyDocument("ข้อความที่ไม่เกี่ยวข้องเลย", DOC_TYPES), null);
});

test("detects attestations from stamp keywords across files, not full sentences", () => {
  assert.deepEqual(detectAttestations(["ตราประทับ จ่ายแล้ว", "เอกสารอื่น"]), ["paid-stamp"]);
  assert.deepEqual(detectAttestations(["จ่ายแล้ว", "ตรวจรับพัสดุ เรียบร้อย"]).sort(), ["inspection-stamp", "paid-stamp"]);
  assert.deepEqual(detectAttestations(["ไม่มีตราประทับใดๆ"]), []);
});
