// Run: node --test tests/receipt-pipeline.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const DocumentClassifier = require("../app/js/document-classifier.js");
const { classifyAttachedFiles, buildEvidence, decideVerdict } = require("../app/js/receipt-pipeline.js");

const STATUS = { PASS: "ผ่าน", FIX: "ต้องแก้ไข", APPROVAL: "ต้องชี้แจง/ขออนุมัติ", REJECT: "ไม่เข้าเงื่อนไข" };
const DOC_TYPES = { "tax-invoice-full": { documentName: "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ", formCode: "-" } };

test("classifyAttachedFiles + buildEvidence wire document-classifier output into rule-engine's evidence shape", () => {
  const ocrByFile = [
    { fileName: "a.jpg", text: "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ จ่ายแล้ว" },
    { fileName: "b.jpg", text: "ข้อความที่ไม่เกี่ยวข้อง" },
  ];
  const classification = classifyAttachedFiles(ocrByFile, DOC_TYPES, DocumentClassifier);
  assert.deepEqual(classification, [
    { fileName: "a.jpg", documentTypeId: "tax-invoice-full" },
    { fileName: "b.jpg", documentTypeId: null },
  ]);
  const evidence = buildEvidence(ocrByFile, classification, DocumentClassifier);
  assert.deepEqual(evidence.documentTypeIds, ["tax-invoice-full"]);
  assert.deepEqual(evidence.attestationIds, ["paid-stamp"]);
});

test("decideVerdict in 'rule' mode always uses the rule-engine result, ignoring any LLM result", () => {
  const ruleCheck = { status: STATUS.FIX, aiExplanation: "เกินเพดาน" };
  const llm = { verdict: "pass", recommendation: "ผ่านนะ", issues: [] };
  const decided = decideVerdict("rule", ruleCheck, llm, STATUS);
  assert.equal(decided.status, STATUS.FIX);
  assert.equal(decided.explanation, "เกินเพดาน");
});

test("decideVerdict in 'llm' mode uses the LLM's pass/fail and its recommendation+issues", () => {
  const ruleCheck = { status: STATUS.PASS, aiExplanation: "ผ่านตามกฎ" };
  const llm = { verdict: "fail", recommendation: "แนบใบกำกับภาษีเพิ่ม", issues: [{ type: "evidence", description: "ขาดใบกำกับภาษี" }] };
  const decided = decideVerdict("llm", ruleCheck, llm, STATUS);
  assert.equal(decided.status, STATUS.FIX);
  assert.match(decided.explanation, /แนบใบกำกับภาษีเพิ่ม/);
  assert.match(decided.explanation, /ขาดใบกำกับภาษี/);
});

test("decideVerdict in 'llm' mode maps a pass verdict to STATUS.PASS", () => {
  const decided = decideVerdict("llm", { status: STATUS.FIX, aiExplanation: "x" }, { verdict: "pass", recommendation: "ไม่มีปัญหา", issues: [] }, STATUS);
  assert.equal(decided.status, STATUS.PASS);
});

test("decideVerdict falls back to the rule-engine result when the LLM call failed or wasn't configured", () => {
  const ruleCheck = { status: STATUS.PASS, aiExplanation: "ผ่านตามกฎ" };
  const decided1 = decideVerdict("llm", ruleCheck, { verdict: null, error: "network down" }, STATUS);
  assert.equal(decided1.status, STATUS.PASS);
  assert.match(decided1.explanation, /network down/);
  assert.match(decided1.explanation, /ผ่านตามกฎ/);

  const decided2 = decideVerdict("llm", ruleCheck, null, STATUS);
  assert.equal(decided2.status, STATUS.PASS);
  assert.match(decided2.explanation, /ไม่ได้ตั้งค่า AI/);
});

test("LLM issue codes become Thai labels, one issue per line", () => {
  const llm = { verdict: "fail", recommendation: "โปรดชี้แจงเหตุผล", issues: [
    { type: "amount_exceeded", description: "ยอดเกินประมาณการ" },
    { type: "missing_attachment", description: "ขาดรูปถ่ายพัสดุ" },
    { type: "something_new_from_llm", description: "อื่นๆ" },
  ] };
  const decided = decideVerdict("llm", { status: STATUS.PASS }, llm, STATUS);
  assert.equal(decided.explanation, "โปรดชี้แจงเหตุผล\n• ยอดเกิน: ยอดเกินประมาณการ\n• ขาดเอกสาร: ขาดรูปถ่ายพัสดุ\n• ข้อสังเกต: อื่นๆ");
  assert.doesNotMatch(decided.explanation, /[a-z]+_[a-z]+/);
});

test("humanizeAdvice rewrites codes and [references] in advice saved before this change", () => {
  const { humanizeAdvice, referenceNames } = require("../app/js/receipt-pipeline.js");
  const names = referenceNames({
    ruleItems: [{ id: "ruleitem019", categoryName: "ค่าวัสดุสำนักงาน" }],
    evidenceChains: [{ id: "chain-purchase", chainName: "ซื้อวัสดุ" }],
  }, [{ id: "line011", itemName: "ค่าวัสดุคอมพิวเตอร์" }]);
  const old = "โปรดชี้แจง — amount_exceeded: เกินยอดใน [line011]; missing_attachment: ขาดเอกสารตาม [chain-purchase] ตาม [ruleitem019] และ [chain-unknown]";
  const out = humanizeAdvice(old, names);
  assert.equal(out, "โปรดชี้แจง — ยอดเกิน: เกินยอดใน รายการ “ค่าวัสดุคอมพิวเตอร์” ในประมาณการ; ขาดเอกสาร: ขาดเอกสารตาม ชุดเอกสาร“ซื้อวัสดุ” ตาม “ค่าวัสดุสำนักงาน” และ ชุดเอกสารที่กำหนด");
  assert.equal(humanizeAdvice("ราคา 1,500 บาท: ผ่าน", names), "ราคา 1,500 บาท: ผ่าน", "Thai text and numbers are left alone");
});
