// Run: node --test tests/batch-lib.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../research/batch/lib.js");
const evalLib = require("../research/eval/lib.js");

const { ruleSet, documentNames, data } = evalLib.loadRuleSet();
const documentTypesById = Object.fromEntries(data.documentTypes.map((d) => [d.id, d]));

function fakeOcrClient(textByFile) {
  return {
    read: async (buffer) => ({ lines: [{ text: textByFile[buffer.__name] || "", confidence: 0.95 }] }),
    textForAi: (ocrResult) => ocrResult.lines.map((l) => l.text).join("\n"),
  };
}

const caseDef = {
  id: "case001", dir: __dirname, fundSourceId: "fundsource002",
  category: "ค่าวัสดุสำนักงาน", amount: 3200, financeVerdict: "ผ่าน",
  files: [
    { fileName: "receipt.jpg", ocrText: "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ จ่ายแล้ว" },
    { fileName: "inspection.jpg", ocrText: "รูปถ่ายพัสดุ ณ เวลาที่ตรวจรับ ตรวจรับพัสดุ เรียบร้อย" },
  ],
};

test("ocrOneFile skips the OCR call entirely when ocrText is already provided (synthetic/example cases)", async () => {
  const result = await lib.ocrOneFile({ fileName: "a.jpg", ocrText: "ข้อความที่เตรียมไว้" }, __dirname, null);
  assert.equal(result.text, "ข้อความที่เตรียมไว้");
  assert.equal(result.ocrSkipped, true);
  assert.equal(result.error, null);
});

test("ocrOneFile reports the error for a file it can't read, instead of throwing", async () => {
  const result = await lib.ocrOneFile({ fileName: "missing.jpg" }, __dirname, {});
  assert.equal(result.text, "");
  assert.ok(result.error);
});

test("runCase goes through classification/evidence/rule-engine and reports a rule-engine verdict in 'rule' mode", async () => {
  const result = await lib.runCase(caseDef, ruleSet, documentNames, documentTypesById, { OcrClient: fakeOcrClient({}), AiClient: null }, { verdictMode: "rule" });
  assert.equal(result.predictedStatus, "ผ่าน");
  assert.equal(result.expected, "ผ่าน");
  assert.equal(result.llmVerdict, null);
  assert.equal(result.ruleSetVersion, ruleSet.versionLabel);
  assert.ok(result.documentClassification.some((c) => c.documentTypeId === "tax-invoice-full"));
  assert.ok(result.documentClassification.some((c) => c.documentTypeId === "inspection-photos"));
});

test("runCase asks the LLM to decide in 'llm' mode and tags the result with model/prompt version", async () => {
  const fakeAiClient = {
    chat: async () => JSON.stringify({ verdict: "fail", issues: [{ type: "amount", description: "เกินเพดาน" }], rule_refs: ["ruleitem019"], recommendation: "ลดยอดเบิก" }),
    extractJson: (t) => JSON.parse(t),
    modelName: () => "test-model",
  };
  const overCapCase = Object.assign({}, caseDef, { amount: 6500 });
  const result = await lib.runCase(overCapCase, ruleSet, documentNames, documentTypesById, { OcrClient: fakeOcrClient({}), AiClient: fakeAiClient }, { verdictMode: "llm" });
  assert.equal(result.predictedStatus, "ต้องแก้ไข");
  assert.equal(result.llmModel, "test-model");
  assert.match(result.predictedExplanation, /ลดยอดเบิก/);
});

test("estimate in meta.json drives the rule engine's budget check: not in estimate → approval", async () => {
  const notInEstimate = Object.assign({}, caseDef, { estimate: [{ id: "line001", itemName: "ค่าถ่ายเอกสาร", total: 3000, spentBefore: 0, ruleCategory: "ค่าถ่ายเอกสาร" }] });
  const result = await lib.runCase(notInEstimate, ruleSet, documentNames, documentTypesById, { OcrClient: fakeOcrClient({}), AiClient: null }, { verdictMode: "rule" });
  assert.equal(result.predictedStatus, "ต้องชี้แจง/ขออนุมัติ");
  assert.equal(lib.budgetForRuleEngine(null, "x"), undefined);
  const b = lib.budgetForRuleEngine([{ id: "a", group: "g", itemName: "A", total: 10, ruleCategory: "x", spentBefore: 5 }], "x");
  assert.equal(b.line.id, "a");
  assert.equal(b.spentBefore, 5);
  assert.deepEqual(b.group, { name: "g", total: 10, spentBefore: 5 });
});

test("the LLM prompt receives the case's estimate", async () => {
  let seenPrompt = "";
  const fakeAiClient = {
    chat: async (messages) => { seenPrompt = messages[0].content; return JSON.stringify({ verdict: "pass", issues: [], rule_refs: [], recommendation: "" }); },
    extractJson: (t) => JSON.parse(t),
    modelName: () => "m",
  };
  const withEstimate = Object.assign({}, caseDef, { estimate: [{ id: "line009", itemName: "ค่าวัสดุสำนักงาน", total: 9000, spentBefore: 0, ruleCategory: "ค่าวัสดุสำนักงาน" }] });
  await lib.runCase(withEstimate, ruleSet, documentNames, documentTypesById, { OcrClient: fakeOcrClient({}), AiClient: fakeAiClient }, { verdictMode: "llm" });
  assert.match(seenPrompt, /\[line009\]/);
});

test("binary metrics count every non-pass finance verdict as a problem", () => {
  const m = lib.computeBinaryMetrics([
    { expected: "ผ่าน", predicted: "ผ่าน" },
    { expected: "ต้องชี้แจง/ขออนุมัติ", predicted: "ต้องแก้ไข" },
    { expected: "ไม่เข้าเงื่อนไข", predicted: "ผ่าน" },
    { expected: "ผ่าน", predicted: "ต้องแก้ไข" },
    { expected: null, predicted: "ผ่าน" },
  ]);
  assert.equal(m.n, 4);
  assert.equal(m.skipped, 1);
  assert.equal(m.accuracy, 0.5);
  assert.equal(m.missed, 1);
  assert.equal(m.falseAlarm, 1);
});

test("hasRealFiles is true only when some file has no prepared ocrText", () => {
  assert.equal(lib.hasRealFiles([{ files: [{ ocrText: "x" }] }]), false);
  assert.equal(lib.hasRealFiles([{ files: [{ ocrText: "x" }, { path: "a.jpg" }] }]), true);
});

test("resultsToCsv produces a header plus one row per result with dotted-path fields flattened", () => {
  const csv = lib.resultsToCsv([{
    id: "case001", category: "ค่าวัสดุสำนักงาน", amount: 3200, financeVerdict: "ผ่าน", predictedStatus: "ผ่าน",
    ruleCheck: { status: "ผ่าน", reasonCode: "WITHIN_CAP" }, llmVerdict: null, llmModel: null, promptVersion: null,
    ruleSetVersion: "2570.4", engineVersion: "1.5.0", durationMs: 12, ocrErrors: 0,
  }]);
  const lines = csv.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^id,category,amount.*,ocrErrors,llmVerdict\.error$/);
  assert.match(lines[1], /^case001,ค่าวัสดุสำนักงาน,3200,ผ่าน,ผ่าน,ผ่าน,WITHIN_CAP,,,,,2570\.4,1\.5\.0,12,0,$/);
});
