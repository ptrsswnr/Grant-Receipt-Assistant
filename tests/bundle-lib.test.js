// Run: node --test tests/bundle-lib.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const bundleLib = require("../research/batch/bundle-lib.js");
const lib = require("../research/batch/lib.js");
const evalLib = require("../research/eval/lib.js");
const OcrClient = require("../app/js/ocr-client.js");

const { ruleSet, documentNames, data } = evalLib.loadRuleSet();
const documentTypesById = Object.fromEntries(data.documentTypes.map((d) => [d.id, d]));
const ctxFor = (verdictMode) => ({ ruleSet, documentNames, documentTypesById, categories: Array.from(data.categories), verdictMode });

const caseDef = lib.loadCases(path.join(__dirname, "..", "research", "batch", "bundles.example"))[0];

test("example project: 5 pages → 4 documents → 2 expense items, without AI (keyword split, payment-order grouping)", async () => {
  const r = await bundleLib.runBundleCase(caseDef, ctxFor("rule"), { OcrClient, AiClient: null });
  const f = r.files[0];
  assert.equal(f.ocr.pageCount, 5);
  assert.equal(f.split.method, "keyword");
  assert.deepEqual(f.documents.map((d) => [d.pageFrom, d.pageTo, d.documentTypeId]), [
    [1, 2, "tax-invoice-full"], [3, 3, "inspection-photos"], [4, 4, "voucher-vj1"], [5, 5, "id-card-copy"],
  ]);
  assert.equal(f.grouping.method, "payment-order");
  assert.deepEqual(f.items.map((i) => [i.paymentPage, i.result.amount]), [[1, 3200], [4, 100]]);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.unmatchedExpected.length, 0);
});

test("with AI, the LLM's split, fields and grouping feed the same verdict path; spending accumulates on the estimate", async () => {
  const answers = [
    { documents: [{ pageFrom: 1, pageTo: 2, documentTypeId: "tax-invoice-full" }, { pageFrom: 3, pageTo: 3, documentTypeId: "inspection-photos" }, { pageFrom: 4, pageTo: 4, documentTypeId: "voucher-vj1" }, { pageFrom: 5, pageTo: 5, documentTypeId: "id-card-copy" }] },
    { amount: 3200, date: "2026-11-01", vendorName: "ร้านเครื่องเขียนสยาม", category: "ค่าวัสดุสำนักงาน" },
    { fields: {} },
    { amount: 100, date: "2026-11-05", vendorName: "นายสมชาย ใจดี", category: "ค่าตอบแทนอาสาสมัคร/ผู้ให้ข้อมูล" },
    { fields: {} },
    { groups: [{ documentIndexes: [0, 1] }, { documentIndexes: [2, 3] }], unassigned: [] },
  ];
  const ai = {
    isConfigured: () => true, modelName: () => "fake-model", extractJson: (t) => JSON.parse(t),
    chat: async () => JSON.stringify(answers.shift()),
  };
  const r = await bundleLib.runBundleCase(caseDef, ctxFor("rule"), { OcrClient, AiClient: ai });
  const f = r.files[0];
  assert.equal(f.split.method, "llm");
  assert.equal(f.grouping.method, "llm");
  const [office, volunteer] = f.items.map((i) => i.result);
  assert.equal(office.status, "ผ่าน");
  assert.equal(office.budgetLineId, "line001");
  // ค่าตอบแทนต้องมีหนังสืออนุมัติจากคณะกรรมการก่อน (chain-honorarium) — ไม่มีในไฟล์ จึงต้องแก้ไข
  assert.equal(volunteer.status, "ต้องแก้ไข");
  assert.ok(volunteer.ruleCheck.findings.some((x) => x.code === "MISSING_EVIDENCE"));
  assert.deepEqual(r.pairs, [{ expected: "ผ่าน", predicted: "ผ่าน" }, { expected: "ต้องแก้ไข", predicted: "ต้องแก้ไข" }]);
  // meta.json ของเคสไม่ถูกแก้ระหว่างรัน (ยอดสะสมอยู่ในสำเนา)
  assert.equal(caseDef.estimate[0].spentBefore, 0);
});

test("item and document CSV rows carry the stage methods for error analysis", async () => {
  const r = await bundleLib.runBundleCase(caseDef, ctxFor("rule"), { OcrClient, AiClient: null });
  const items = bundleLib.itemRows([r]);
  assert.equal(items[0].pages, "1-2;3");
  assert.equal(items[0].financeVerdict, "ผ่าน");
  const docs = bundleLib.documentRows([r]);
  assert.equal(docs.length, 4);
  assert.equal(docs[0].extractMethod, "ocr-heuristic");
  assert.equal(docs[1].kind, "supporting");
  const csv = bundleLib.toCsv(bundleLib.DOCUMENT_COLUMNS, docs);
  assert.match(csv.split("\n")[0], /^caseId,fileName,index,pageFrom/);
});

test("hasRealBundleFiles is false when every file has prepared OCR pages", () => {
  assert.equal(bundleLib.hasRealBundleFiles([caseDef]), false);
  assert.equal(bundleLib.hasRealBundleFiles([{ files: [{ fileName: "a.pdf", path: "a.pdf" }] }]), true);
});
