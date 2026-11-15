// Run: node --test tests/eval.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../research/eval/lib.js");
const baseline = require("../research/eval/baseline.js");
const AiClient = require("../app/js/ai-client.js");
const { STATUS } = lib;

test("parseCsv handles BOM, quoted commas and newlines", () => {
  const rows = lib.parseCsv('﻿case_id,finance_note\r\nA1,"มีคอมมา, และ ""คำพูด"""\r\nA2,"สอง\nบรรทัด"\r\n\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].case_id, "A1");
  assert.equal(rows[0].finance_note, 'มีคอมมา, และ "คำพูด"');
  assert.equal(rows[1].finance_note, "สอง\nบรรทัด");
});

test("verdict labels accept Thai and English aliases", () => {
  assert.equal(lib.normalizeLabel("ผ่าน"), STATUS.PASS);
  assert.equal(lib.normalizeLabel(" Fix "), STATUS.FIX);
  assert.equal(lib.normalizeLabel("ขออนุมัติ"), STATUS.APPROVAL);
  assert.equal(lib.normalizeLabel("reject"), STATUS.REJECT);
  assert.equal(lib.normalizeLabel("อื่นๆ"), null);
});

test("caseToReceipt maps estimate and evidence columns", () => {
  const inLine = lib.caseToReceipt({ case_id: "C1", category: "x", amount: "1,500", in_estimate: "yes", line_total: "6000", line_quantity: "40", spent_before: "3000", documents: "a;b", attestations: "", finance_verdict: "ผ่าน" });
  assert.equal(inLine.receipt.amount, 1500);
  assert.equal(inLine.receipt.budget.line.total, 6000);
  assert.equal(inLine.receipt.budget.line.quantity, 40);
  assert.equal(inLine.receipt.budget.spentBefore, 3000);
  assert.equal(inLine.receipt.evidence.documentTypeIds.join(","), "a,b");

  const notInEstimate = lib.caseToReceipt({ case_id: "C2", category: "x", amount: "1", in_estimate: "no" });
  assert.equal(notInEstimate.receipt.budget.line, null);
  const noEstimate = lib.caseToReceipt({ case_id: "C3", category: "x", amount: "1", in_estimate: "" });
  assert.equal(noEstimate.receipt.budget, undefined);
  assert.equal(noEstimate.receipt.evidence, undefined);
  const nothingAttached = lib.caseToReceipt({ case_id: "C4", category: "x", amount: "1", documents: "none", attestations: "none" });
  assert.equal(nothingAttached.receipt.evidence.documentTypeIds.length, 0);
});

test("computeMetrics: accuracy, kappa, missed problems and false alarms", () => {
  const P = STATUS.PASS, F = STATUS.FIX, A = STATUS.APPROVAL;
  const m = lib.computeMetrics([
    { expected: P, predicted: P }, { expected: P, predicted: F },
    { expected: F, predicted: F }, { expected: F, predicted: P },
    { expected: A, predicted: A }, { expected: null, predicted: P },
  ]);
  assert.equal(m.n, 5);
  assert.equal(m.skipped, 1);
  assert.equal(m.correct, 3);
  assert.equal(m.accuracy, 0.6);
  assert.equal(m.flagging.missed, 1);
  assert.equal(m.flagging.falseAlarm, 1);
  assert.ok(m.kappa > 0 && m.kappa < 1);
  const perfect = lib.computeMetrics([{ expected: P, predicted: P }, { expected: F, predicted: F }]);
  assert.equal(perfect.kappa, 1);
});

test("example cases run end to end against the real rule set", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { ruleSet, documentNames } = lib.loadRuleSet();
  const cases = lib.parseCsv(fs.readFileSync(path.join(__dirname, "../research/eval/cases.example.csv"), "utf8")).map(lib.caseToReceipt);
  assert.ok(cases.length >= 10);
  const wrong = cases.filter((c) => lib.RuleEngine.evaluate(c.receipt, ruleSet, documentNames).status !== c.expected).map((c) => c.id);
  // EX11 ตั้งใจให้ไม่ตรง: การเงินเจอลายเซ็นไม่ตรง ซึ่งกฎมองไม่เห็น
  assert.equal(wrong.join(","), "EX11");
});

function fakeFetch(reply, capture) {
  return async (url, init) => {
    if (capture) capture.push({ url, init });
    return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }), text: async () => "" };
  };
}

test("AiClient: presets, legacy key, key never sent without one", async () => {
  assert.equal(AiClient.isConfigured({ provider: "openrouter" }), false);
  assert.equal(AiClient.isConfigured({ provider: "openrouter", apiKey: "sk-or-v1-your-key-here" }), false);
  assert.equal(AiClient.isConfigured({ provider: "ollama" }), true);
  assert.equal(AiClient.resolveConfig({ provider: "ollama" }).endpoint, "http://localhost:11434/v1/chat/completions");
  assert.equal(AiClient.isConfigured({ provider: "proxy" }), false, "proxy needs an endpoint");

  const calls = [];
  const text = await AiClient.chat([{ role: "user", content: "hi" }], { config: { provider: "ollama", model: "m" }, fetchImpl: fakeFetch("ok", calls) });
  assert.equal(text, "ok");
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(JSON.parse(calls[0].init.body).model, "m");
});

test("extractJson tolerates code fences and leading text", () => {
  assert.equal(AiClient.extractJson('```json\n{"a":1}\n```').a, 1);
  assert.equal(AiClient.extractJson('คำตอบคือ {"status":"ผ่าน"} ครับ').status, "ผ่าน");
});

test("baseline: parses the AI verdict and reports invalid answers without throwing", async () => {
  const { data, ruleSet } = lib.loadRuleSet();
  const c = lib.caseToReceipt({ case_id: "B1", category: "ค่าวัสดุสำนักงาน", amount: "6500", in_estimate: "yes", line_total: "10000" });
  const cfg = { provider: "ollama", model: "m" };
  const good = await baseline.predict(c, data, ruleSet, cfg, fakeFetch('{"status":"ต้องแก้ไข","reason":"เกินเพดาน"}'));
  assert.equal(good.predicted, STATUS.FIX);
  assert.equal(good.error, null);
  const bad = await baseline.predict(c, data, ruleSet, cfg, fakeFetch('{"status":"อนุมัติ"}'));
  assert.equal(bad.predicted, null);
  assert.ok(bad.error);
  const broken = await baseline.predict(c, data, ruleSet, cfg, async () => { throw new Error("offline"); });
  assert.equal(broken.error, "offline");
});
