// Run: node --test tests/llm-verdict.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { rulesAsText, buildPrompt, evaluateWithLlm, PROMPT_VERSION } = require("../app/js/llm-verdict.js");

const RULE_SET = {
  ruleItems: [
    { id: "ruleitem001", categoryName: "ค่าวัสดุ", rateType: "เพดานตามจริง", rateAmount: 5000, unit: null, note: "อ้างอิงคู่มือฯ" },
  ],
  evidenceChains: {
    "chain-purchase": {
      chainName: "ชุดเอกสารจัดซื้อ",
      steps: [{ required: true, documentTypeIds: ["tax-invoice-full", "tax-invoice-abbreviated"] }],
      conditionalSteps: [{ when: { field: "amount", op: ">", value: 100000 }, addStep: { documentTypeIds: ["procurement-committee-cert"] } }],
      attestations: [{ id: "paid-stamp", text: "ประทับตรา \"จ่ายแล้ว\" แล้ว" }],
    },
  },
};
const DOC_NAMES = { "tax-invoice-full": "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ", "tax-invoice-abbreviated": "ใบกำกับภาษีอย่างย่อ", "procurement-committee-cert": "ใบตรวจรับพัสดุ" };

test("rulesAsText numbers every rule item with its real Firestore id as the reference code", () => {
  const text = rulesAsText(RULE_SET, DOC_NAMES);
  assert.match(text, /\[ruleitem001\] ค่าวัสดุ/);
  assert.match(text, /\[chain-purchase\]/);
  assert.match(text, /ใบเสร็จรับเงิน\/ใบกำกับภาษีเต็มรูปแบบ หรือ ใบกำกับภาษีอย่างย่อ/);
});

test("buildPrompt embeds OCR text, category/amount and demands JSON-only pass/fail", () => {
  const prompt = buildPrompt("ร้านตัวอย่าง 4,500 บาท", RULE_SET, DOC_NAMES, { category: "ค่าวัสดุ", amount: 4500 });
  assert.match(prompt, /ร้านตัวอย่าง 4,500 บาท/);
  assert.match(prompt, /ค่าวัสดุ/);
  assert.match(prompt, /"verdict"/);
  assert.match(prompt, /pass.*fail|fail.*pass/);
});

test("buildPrompt includes the project's estimate as raw data (line codes, totals, spent, remaining)", () => {
  const estimate = [{ id: "line001", group: "หมวดค่าวัสดุ", itemName: "ค่าวัสดุสำนักงาน", multiplierText: "", total: 10000, spentBefore: 2000 }];
  const prompt = buildPrompt("x", RULE_SET, DOC_NAMES, { category: "ค่าวัสดุ", amount: 100, estimate });
  assert.match(prompt, /\[line001\] หมวดค่าวัสดุ \/ ค่าวัสดุสำนักงาน: ตั้งไว้ 10,000 บาท, เบิกไปแล้ว 2,000 บาท, คงเหลือ 8,000 บาท/);
  assert.match(prompt, /ขออนุมัติ/);
  assert.match(buildPrompt("x", RULE_SET, DOC_NAMES, {}), /ประมาณการของโครงการ: \(ไม่มีข้อมูล\)/);
});

test("evaluateWithLlm parses a valid pass/fail response and tags it with the prompt version", async () => {
  const fakeAiClient = {
    chat: async () => JSON.stringify({ verdict: "fail", issues: [{ type: "amount", description: "เกินเพดาน" }], rule_refs: ["ruleitem001"], recommendation: "ลดยอดเบิกหรือแนบเอกสารเพิ่ม" }),
    extractJson: (text) => JSON.parse(text),
    modelName: () => "test-model",
  };
  const result = await evaluateWithLlm("ร้านตัวอย่าง 6,000 บาท", RULE_SET, DOC_NAMES, { category: "ค่าวัสดุ", amount: 6000 }, { aiClient: fakeAiClient });
  assert.equal(result.verdict, "fail");
  assert.equal(result.rule_refs[0], "ruleitem001");
  assert.equal(result.promptVersion, PROMPT_VERSION);
  assert.equal(result.error, null);
});

test("evaluateWithLlm never throws — a bad response or a thrown error becomes a reported error instead", async () => {
  const badJson = { chat: async () => "not json at all", extractJson: () => { throw new Error("bad json"); }, modelName: () => "test-model" };
  const r1 = await evaluateWithLlm("x", RULE_SET, DOC_NAMES, {}, { aiClient: badJson });
  assert.equal(r1.verdict, null);
  assert.match(r1.error, /bad json/);

  const wrongVerdict = { chat: async () => JSON.stringify({ verdict: "maybe" }), extractJson: (t) => JSON.parse(t), modelName: () => "m" };
  const r2 = await evaluateWithLlm("x", RULE_SET, DOC_NAMES, {}, { aiClient: wrongVerdict });
  assert.equal(r2.verdict, null);
  assert.match(r2.error, /pass\/fail/);

  const throws = { chat: async () => { throw new Error("network down"); }, extractJson: (t) => JSON.parse(t), modelName: () => "m" };
  const r3 = await evaluateWithLlm("x", RULE_SET, DOC_NAMES, {}, { aiClient: throws });
  assert.equal(r3.verdict, null);
  assert.match(r3.error, /network down/);
});
