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

test("prompt gives precomputed budget numbers per line and asks for a budget_check step", () => {
  const ruleSet = { ruleItems: [
    { id: "ruleitem018", categoryName: "ค่าวัสดุคอมพิวเตอร์", rateType: "เพดานตามจริง", rateAmount: 5000 },
    { id: "ruleitem014", categoryName: "ค่าแท็กซี่ (เดินทางปฏิบัติงาน)", rateType: "เหมาจ่าย", rateAmount: 700, averaging: false },
  ], evidenceChains: {} };
  const estimate = [
    { id: "line010", group: "หมวดวัสดุ", itemName: "ค่าวัสดุสำนักงาน", total: 5000, spentBefore: 0, ruleCategory: "ค่าวัสดุสำนักงาน" },
    { id: "line011", group: "หมวดวัสดุ", itemName: "ค่าวัสดุคอมพิวเตอร์", total: 5000, spentBefore: 4747.66, ruleCategory: "ค่าวัสดุคอมพิวเตอร์" },
    { id: "line020", group: "หมวดค่าใช้สอย", itemName: "ค่าแท็กซี่", total: 700, spentBefore: 0, ruleCategory: "ค่าแท็กซี่ (เดินทางปฏิบัติงาน)" },
  ];
  const prompt = buildPrompt("x", ruleSet, {}, { category: "ค่าวัสดุคอมพิวเตอร์", amount: 5210.28, estimate });
  assert.equal(PROMPT_VERSION, "1.5.5");
  // line011: 4,747.66 + 5,210.28 = 9,957.94 of 5,000 (over the line), group 9,957.94 of 10,000 (within)
  assert.match(prompt, /\[line011\][^\n]*รายการรวมใบนี้ 9,957\.94 บาท จากที่ตั้งไว้ 5,000 บาท \(เกินรายการ 4,957\.94 บาท\)[^\n]*หมวดรวมใบนี้ 9,957\.94 บาท จากที่ตั้งไว้ 10,000 บาท \(ไม่เกินหมวด\), หมวดนี้ถัวได้, รายการนี้ถัวได้/);
  assert.match(prompt, /\[line020\][^\n]*รายการนี้ห้ามถัว/);
  assert.match(prompt, /ข้อ 1 ประมาณการ \(budget_check\)/);
  assert.match(prompt, /"budget_check"/);
  assert.match(prompt, /"averaged"/);
});

test("budget_check in the LLM reply is parsed and cleaned", async () => {
  const reply = { budget_check: { line_id: "line011", line_total_after: "9,957.94", line_budget: 5000, group_total_after: 9957.94, group_budget: 10000, averaging_allowed: true, result: "averaged" },
    verdict: "fail", issues: [], rule_refs: [], recommendation: "แนบรูปถ่ายพัสดุ" };
  const ai = { chat: async () => JSON.stringify(reply), extractJson: (t) => JSON.parse(t), modelName: () => "fake" };
  const r = await evaluateWithLlm("x", { ruleItems: [], evidenceChains: {} }, {}, {}, { aiClient: ai });
  assert.deepEqual(r.budget_check, { line_id: "line011", line_total_after: 9957.94, line_budget: 5000, group_total_after: 9957.94, group_budget: 10000, averaging_allowed: true, result: "averaged" });
  const bad = await evaluateWithLlm("x", { ruleItems: [], evidenceChains: {} }, {}, {}, { aiClient: { ...ai, chat: async () => JSON.stringify({ verdict: "pass", budget_check: { result: "maybe" } }) } });
  assert.equal(bad.budget_check.result, null);
});

test("prompt 1.4.0 is a 4-item checklist and shows each rule's evidence chain", () => {
  const ruleSet = { ruleItems: [{ id: "ruleitem018", categoryName: "ค่าวัสดุคอมพิวเตอร์", rateType: "เพดานตามจริง", rateAmount: 5000, evidenceChainId: "chain-purchase" }], evidenceChains: {} };
  const prompt = buildPrompt("x", ruleSet, {}, { category: "ค่าวัสดุคอมพิวเตอร์", amount: 5210.28, estimate: [] });
  assert.match(prompt, /\[ruleitem018\][^\n]*ชุดเอกสาร \[chain-purchase\]/);
  for (const key of ["budget_check", "cap_check", "documents_check", "attestations_check"]) assert.match(prompt, new RegExp('"' + key + '"'));
  assert.match(prompt, /ข้อ 2 เพดานตามระเบียบ/);
  assert.match(prompt, /ข้อ 4 ตราประทับ/);
});

test("a pass that contradicts the LLM's own failed checklist item becomes fail; the reported verdict is kept", async () => {
  const reply = {
    budget_check: { line_id: "line011", result: "averaged" },
    cap_check: { rule_ref: "ruleitem018", cap: "5,000", unit: null, amount: 5210.28, result: "over" },
    documents_check: { required: ["ใบเสร็จ", "รูปถ่ายพัสดุ"], found: ["ใบเสร็จ"], missing: ["รูปถ่ายพัสดุ"], result: "complete" },
    attestations_check: { required: ["จ่ายแล้ว"], found: ["จ่ายแล้ว"], missing: [], result: "complete" },
    verdict: "pass", issues: [], rule_refs: [], recommendation: "",
  };
  const ai = { chat: async () => JSON.stringify(reply), extractJson: (t) => JSON.parse(t), modelName: () => "fake" };
  const r = await evaluateWithLlm("x", { ruleItems: [], evidenceChains: {} }, {}, {}, { aiClient: ai });
  assert.equal(r.verdict_reported, "pass");
  assert.equal(r.verdict, "fail");
  assert.deepEqual(r.failed_checks, ["cap_check", "documents_check"]);
  assert.equal(r.cap_check.cap, 5000);
  assert.equal(r.documents_check.result, "missing"); // a listed missing document overrides "complete"

  const allOk = { ...reply, cap_check: { result: "within" }, documents_check: { missing: [], result: "complete" } };
  const r2 = await evaluateWithLlm("x", { ruleItems: [], evidenceChains: {} }, {}, {}, { aiClient: { ...ai, chat: async () => JSON.stringify(allOk) } });
  assert.equal(r2.verdict, "pass");
  assert.deepEqual(r2.failed_checks, []);
});

test("record() gives the Firestore shape with every checklist field", () => {
  const { record } = require("../app/js/llm-verdict.js");
  assert.equal(record(null), null);
  const rec = record({ verdict: "fail", issues: [], rule_refs: [], recommendation: "", raw: "{}", model: "m", promptVersion: "1.4.0", durationMs: 1, error: null });
  assert.deepEqual(Object.keys(rec).sort(), ["attestations_check", "attestations_rejected", "budget_check", "cap_check", "documents_check", "durationMs", "error", "failed_checks", "issues", "model", "promptVersion", "raw", "recommendation", "rule_refs", "verdict", "verdict_reported"].sort());
});

test("prompt 1.5 lists only this category's evidence chain and says which amount conditions apply", () => {
  const ruleSet = {
    ruleItems: [{ id: "ruleitem018", categoryName: "ค่าวัสดุคอมพิวเตอร์", rateType: "เพดานตามจริง", rateAmount: 5000, evidenceChainId: "chain-purchase" }],
    evidenceChains: {
      "chain-purchase": { chainName: "ซื้อวัสดุ", steps: [{ required: true, documentTypeIds: ["tax-invoice-full"] }, { required: true, documentTypeIds: ["inspection-photos"] }],
        conditionalSteps: [{ when: { field: "amount", op: ">", value: 100000 }, addStep: { documentTypeIds: ["procurement-committee-cert"] } }],
        attestations: [{ id: "paid-stamp", text: 'ประทับตรา "จ่ายแล้ว"' }] },
      "chain-equipment": { chainName: "ครุภัณฑ์", steps: [{ required: true, documentTypeIds: ["committee-pre-approval"] }] },
    },
  };
  const names = { "tax-invoice-full": "ใบเสร็จ", "inspection-photos": "รูปถ่ายพัสดุ", "procurement-committee-cert": "ใบตรวจรับกรรมการ 3 คน", "committee-pre-approval": "หนังสืออนุมัติ" };
  const small = buildPrompt("x", ruleSet, names, { category: "ค่าวัสดุคอมพิวเตอร์", amount: 4747.66, estimate: [] });
  assert.match(small, /ชุดเอกสารของหมวดนี้ \[chain-purchase\]/);
  assert.doesNotMatch(small, /หนังสืออนุมัติ/);
  assert.match(small, /ไม่ต้องใช้กับใบนี้[^\n]*ใบตรวจรับกรรมการ 3 คน/);
  const big = buildPrompt("x", ruleSet, names, { category: "ค่าวัสดุคอมพิวเตอร์", amount: 150000, estimate: [] });
  assert.match(big, /3\) ใบตรวจรับกรรมการ 3 คน \(บังคับเพราะยอด/);
  assert.match(small, /"quote"/);
  assert.match(small, /ประทับตรา "จ่ายแล้ว" — คำหลัก: "จ่ายแล้ว"/);
});

test("a found stamp whose quote lacks the stamp's keyword is moved to missing (OCR misspellings still count)", async () => {
  const ruleSet = {
    ruleItems: [{ id: "ruleitem018", categoryName: "ค่าวัสดุคอมพิวเตอร์", evidenceChainId: "chain-purchase" }],
    evidenceChains: { "chain-purchase": { steps: [], attestations: [
      { id: "paid-stamp", text: 'เอกสารการจ่ายเงินทุกใบประทับตรา "จ่ายแล้ว" แล้ว' },
      { id: "inspection-stamp", text: 'ใบเสร็จมีตราประทับตรวจรับพัสดุ (เช่น "ตรวจรับพัสดุ" หรือ "ได้รับพัสดุ...เรียบร้อยแล้ว")' },
    ] } },
  };
  const reply = {
    attestations_check: { required: ["จ่ายแล้ว", "ตรวจรับพัสดุ"], missing: [], result: "complete", found: [
      { name: "จ่ายแล้ว", quote: "อิเล็กทรอนิกฉ์(E-TAX) เรียบร้อยแอ้ว as" },
      { name: "ตรวจรับพัสดุ", quote: "ได้รับพัสดตามใบส่งของเรียบร้อยมล้อ" },
    ] },
    verdict: "pass", issues: [],
  };
  const ai = { chat: async () => JSON.stringify(reply), extractJson: (t) => JSON.parse(t), modelName: () => "fake" };
  const r = await evaluateWithLlm("x", ruleSet, {}, { category: "ค่าวัสดุคอมพิวเตอร์", amount: 4747.66 }, { aiClient: ai });
  assert.deepEqual(r.attestations_check.found.map((f) => f.name), ["ตรวจรับพัสดุ"]);
  assert.deepEqual(r.attestations_check.missing, ["จ่ายแล้ว"]);
  assert.equal(r.attestations_check.result, "missing");
  assert.equal(r.attestations_rejected.length, 1);
  assert.equal(r.verdict, "fail");
  assert.equal(r.verdict_reported, "pass");
  assert.ok(r.issues.some((i) => i.type === "missing_stamp" && /จ่ายแล้ว/.test(i.description) && !/E-TAX/.test(i.description)));
  assert.match(r.attestations_rejected[0].quote, /E-TAX/);

  const real = { ...reply, attestations_check: { ...reply.attestations_check, found: [{ name: "จ่ายแล้ว", quote: "จายแลว 12/11/68" }] } };
  const r2 = await evaluateWithLlm("x", ruleSet, {}, { category: "ค่าวัสดุคอมพิวเตอร์" }, { aiClient: { ...ai, chat: async () => JSON.stringify(real) } });
  assert.equal(r2.attestations_rejected.length, 0);
});
