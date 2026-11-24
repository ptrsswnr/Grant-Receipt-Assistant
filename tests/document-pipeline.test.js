// Run: node --test tests/document-pipeline.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const DP = require("../app/js/document-pipeline.js");
const DocumentClassifier = require("../app/js/document-classifier.js");
const RuleEngine = require("../app/js/rule-engine.js");
const LlmVerdict = require("../app/js/llm-verdict.js");
const ReceiptPipeline = require("../app/js/receipt-pipeline.js");
const OcrClient = require("../app/js/ocr-client.js");
const evalLib = require("../research/eval/lib.js");

const { ruleSet, documentNames, data } = evalLib.loadRuleSet();
const TYPES = Object.fromEntries(data.documentTypes.map((d) => [d.id, d]));
const CATEGORIES = data.categories;

// fake AI: ตอบตามลำดับที่กำหนด และจำ prompt ไว้ตรวจ
function fakeAi(answers) {
  const prompts = [];
  return {
    prompts,
    isConfigured: () => true,
    modelName: () => "fake-model",
    extractJson: (t) => JSON.parse(t),
    chat: async (messages) => {
      prompts.push(messages[0].content);
      const a = answers.shift();
      if (a instanceof Error) throw a;
      return typeof a === "string" ? a : JSON.stringify(a);
    },
  };
}
const NO_AI = { isConfigured: () => false, modelName: () => null };

const pages = [
  { page: 1, text: "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ ร้านเครื่องเขียนสยาม รวมทั้งสิ้น 3,200.00 จ่ายแล้ว" },
  { page: 2, text: "(ต่อ) รายการสินค้า หน้า 2" },
  { page: 3, text: "รูปถ่ายพัสดุ ณ เวลาที่ตรวจรับ ตรวจรับพัสดุ" },
  { page: 4, text: "ใบสำคัญรับเงิน วจ.1 นายสมชาย ค่าตอบแทน 500.00" },
];

test("keyword split: a page with a document heading starts a new document, other pages continue the previous one", () => {
  const docs = DP.splitByKeywords(pages, TYPES, DocumentClassifier);
  assert.deepEqual(docs, [
    { pageFrom: 1, pageTo: 2, documentTypeId: "tax-invoice-full" },
    { pageFrom: 3, pageTo: 3, documentTypeId: "inspection-photos" },
    { pageFrom: 4, pageTo: 4, documentTypeId: "voucher-vj1" },
  ]);
});

test("validateSplit accepts a contiguous cover of all pages and rejects gaps, overlaps and short covers", () => {
  assert.equal(DP.validateSplit([{ pageFrom: 1, pageTo: 2, documentTypeId: "x-unknown" }, { pageFrom: 3, pageTo: 4 }], 4, TYPES).ok, true);
  assert.equal(DP.validateSplit([{ pageFrom: 1, pageTo: 2, documentTypeId: "x-unknown" }, { pageFrom: 3, pageTo: 4 }], 4, TYPES).documents[0].documentTypeId, null);
  assert.equal(DP.validateSplit([{ pageFrom: 1, pageTo: 2 }, { pageFrom: 4, pageTo: 4 }], 4, TYPES).ok, false);
  assert.equal(DP.validateSplit([{ pageFrom: 1, pageTo: 3 }, { pageFrom: 3, pageTo: 4 }], 4, TYPES).ok, false);
  assert.equal(DP.validateSplit([{ pageFrom: 1, pageTo: 3 }], 4, TYPES).ok, false);
});

test("splitAndClassify uses the LLM's split when valid, and records method/model", async () => {
  const ai = fakeAi([{ documents: [{ pageFrom: 1, pageTo: 3, documentTypeId: "tax-invoice-full" }, { pageFrom: 4, pageTo: 4, documentTypeId: "voucher-vj1" }] }]);
  const r = await DP.splitAndClassify(pages, TYPES, { AiClient: ai, DocumentClassifier });
  assert.equal(r.method, "llm");
  assert.equal(r.model, "fake-model");
  assert.equal(r.documents.length, 2);
  assert.match(ai.prompts[0], /=== หน้า 4 ===/);
});

test("splitAndClassify falls back to keywords (and keeps the reason) when the LLM answer is invalid or fails", async () => {
  const bad = await DP.splitAndClassify(pages, TYPES, { AiClient: fakeAi([{ documents: [{ pageFrom: 1, pageTo: 2 }] }]), DocumentClassifier });
  assert.equal(bad.method, "keyword");
  assert.match(bad.error, /ไม่ครบ/);
  assert.equal(bad.documents.length, 3);
  const thrown = await DP.splitAndClassify(pages, TYPES, { AiClient: fakeAi([new Error("timeout")]), DocumentClassifier });
  assert.equal(thrown.method, "keyword");
  assert.equal(thrown.error, "timeout");
  const none = await DP.splitAndClassify(pages, TYPES, { AiClient: NO_AI, DocumentClassifier });
  assert.equal(none.method, "keyword");
  assert.equal(none.error, null);
});

test("payment documents extract the existing receipt fields; values outside the allowed shape become null", async () => {
  const ai = fakeAi([{ amount: "3,200.00", date: "2026-11-01", vendorName: "ร้านเครื่องเขียนสยาม", category: "หมวดที่ไม่มีจริง" }]);
  const r = await DP.extractDocumentFields({ documentTypeId: "tax-invoice-full" }, pages[0].text, [], TYPES, CATEGORIES, { AiClient: ai });
  assert.equal(r.kind, "payment");
  assert.deepEqual(r.receipt, { amount: 3200, date: "2026-11-01", vendorName: "ร้านเครื่องเขียนสยาม", category: null });
  assert.equal(r.fields, null);
  assert.match(ai.prompts[0], /ค่าวัสดุสำนักงาน/);
});

test("supporting documents extract a map keyed by that type's requiredFields only", async () => {
  const req = [...TYPES["travel-approval-vj3"].requiredFields]; // data.js มาจาก vm sandbox — copy เป็น array ของ realm นี้
  const ai = fakeAi([{ fields: { [req[0]]: "นายสมชาย", "ฟิลด์ที่ไม่ได้ขอ": "x" } }]);
  const r = await DP.extractDocumentFields({ documentTypeId: "travel-approval-vj3" }, "แบบขออนุมัติ วจ.3", [], TYPES, CATEGORIES, { AiClient: ai });
  assert.equal(r.kind, "supporting");
  assert.deepEqual(Object.keys(r.fields), req);
  assert.equal(r.fields[req[0]], "นายสมชาย");
  assert.equal(r.fields[req[1]], null);
});

test("without AI, payment fields come from the OCR heuristics and supporting fields stay empty", async () => {
  const lines = [{ text: "ร้านเครื่องเขียนสยาม" }, { text: "วันที่ 1/11/2569" }, { text: "รวมทั้งสิ้น 3,200.00" }];
  const p = await DP.extractDocumentFields({ documentTypeId: "tax-invoice-full" }, "", lines, TYPES, CATEGORIES, { AiClient: NO_AI, OcrClient });
  assert.equal(p.method, "ocr-heuristic");
  assert.equal(p.receipt.amount, 3200);
  assert.equal(p.receipt.date, "2026-11-01");
  assert.equal(p.receipt.category, null);
  const s = await DP.extractDocumentFields({ documentTypeId: "id-card-copy" }, "", [], TYPES, CATEGORIES, { AiClient: NO_AI, OcrClient });
  assert.equal(s.method, "none");
  assert.ok(Object.values(s.fields).every((v) => v === null));
});

const docs = [
  { pageFrom: 1, pageTo: 1, documentTypeId: "travel-approval-vj3" },
  { pageFrom: 2, pageTo: 2, documentTypeId: "tax-invoice-full" },
  { pageFrom: 3, pageTo: 3, documentTypeId: "payment-cert-vj2" },
  { pageFrom: 4, pageTo: 4, documentTypeId: "inspection-photos" },
];

test("fallback grouping: each payment document starts an expense item; leading supporting documents stay unassigned", () => {
  assert.deepEqual(DP.groupByPaymentDocuments(docs), {
    groups: [{ documentIndexes: [1], paymentDocumentIndex: 1 }, { documentIndexes: [2, 3], paymentDocumentIndex: 2 }],
    unassigned: [0],
  });
});

test("LLM grouping may share one supporting document between items, but each item has exactly one payment document", async () => {
  const ok = await DP.groupIntoExpenses(docs, TYPES, { AiClient: fakeAi([{ groups: [{ documentIndexes: [0, 1] }, { documentIndexes: [0, 2] }] }]) });
  assert.equal(ok.method, "llm");
  assert.deepEqual(ok.groups, [{ documentIndexes: [0, 1], paymentDocumentIndex: 1 }, { documentIndexes: [0, 2], paymentDocumentIndex: 2 }]);
  assert.deepEqual(ok.unassigned, [3]);

  const twoPayments = await DP.groupIntoExpenses(docs, TYPES, { AiClient: fakeAi([{ groups: [{ documentIndexes: [1, 2] }] }]) });
  assert.equal(twoPayments.method, "payment-order");
  assert.match(twoPayments.error, /2 ใบ/);

  const missing = await DP.groupIntoExpenses(docs, TYPES, { AiClient: fakeAi([{ groups: [{ documentIndexes: [1] }] }]) });
  assert.equal(missing.method, "payment-order");
  assert.match(missing.error, /#2/);
});

test("evaluateGroup runs the same rule engine / LLM verdict as single uploads, with the estimate and evidence from the group", async () => {
  const groupDocs = [
    { pageFrom: 1, pageTo: 1, documentTypeId: "tax-invoice-full", text: "ใบเสร็จ จ่ายแล้ว", extraction: { receipt: { amount: 3200, date: "2026-11-01", vendorName: "ร้าน", category: "ค่าวัสดุสำนักงาน" } } },
    { pageFrom: 2, pageTo: 2, documentTypeId: "inspection-photos", text: "รูปถ่ายพัสดุ ตรวจรับพัสดุ", extraction: { fields: {} } },
  ];
  const estimate = [{ id: "line001", itemName: "ค่าวัสดุสำนักงาน", total: 10000, spentBefore: 2000, ruleCategory: "ค่าวัสดุสำนักงาน" }];
  const ctx = { ruleSet, documentNames, documentTypesById: TYPES, estimate, verdictMode: "rule" };
  const deps = { RuleEngine, LlmVerdict, ReceiptPipeline, DocumentClassifier, AiClient: NO_AI };
  const r = await DP.evaluateGroup({ documentIndexes: [0, 1], paymentDocumentIndex: 0 }, groupDocs, ctx, deps);
  assert.equal(r.status, "ผ่าน");
  assert.equal(r.budgetLineId, "line001");
  assert.deepEqual(r.evidence.documentTypeIds, ["tax-invoice-full", "inspection-photos"]);
  assert.deepEqual(r.evidence.attestationIds.sort(), ["inspection-stamp", "paid-stamp"]);

  const ai = fakeAi([{ verdict: "fail", issues: [], rule_refs: [], recommendation: "ขาดลายเซ็น" }]);
  const llmRun = await DP.evaluateGroup({ documentIndexes: [0, 1], paymentDocumentIndex: 0 }, groupDocs,
    Object.assign({}, ctx, { verdictMode: "llm" }), Object.assign({}, deps, { AiClient: ai }));
  assert.equal(llmRun.status, "ต้องแก้ไข");
  assert.match(ai.prompts[0], /\[line001\]/);
  assert.match(ai.prompts[0], /เอกสาร #1 หน้า 2 \(รูปถ่ายพัสดุ/);
});
