// Run: node --test tests/rule-engine.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RuleEngine = require("../app/js/rule-engine.js");
const { STATUS, REASON, evaluate } = RuleEngine;

// ใช้ชุดกฎจริงจาก data.js (คู่มือฯ ปีงบประมาณ 2570) แทน fixture ที่แต่งขึ้นเอง
function loadSeedData() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/js/data.js"), "utf8"), sandbox);
  return sandbox.window.RECEIPT_DATA;
}

const data = loadSeedData();
const ruleSet2570 = {
  fundSourceId: "fundsource002",
  ruleVersionId: "ruleversion002",
  versionLabel: "2570.1",
  ruleItems: data.ruleItems.filter((ri) => ri.ruleVersionId === "ruleversion002"),
  evidenceChains: Object.fromEntries(data.evidenceChains.map((c) => [c.id, c])),
};
const documentNames = Object.fromEntries(data.documentTypes.map((d) => [d.id, d.documentName]));

const check = (category, amount, ruleSet = ruleSet2570) => evaluate({ category, amount }, ruleSet);

test("missing fund source → reject", () => {
  const r = check("ค่าวัสดุสำนักงาน", 100, null);
  assert.equal(r.status, STATUS.REJECT);
  assert.equal(r.reasonCode, REASON.NO_FUND_SOURCE);
});

test("no active rule version → reject", () => {
  const r = check("ค่าวัสดุสำนักงาน", 100, { fundSourceId: "fs", ruleVersionId: null, ruleItems: [] });
  assert.equal(r.status, STATUS.REJECT);
  assert.equal(r.reasonCode, REASON.NO_ACTIVE_RULE_VERSION);
});

test("ค่าตอบแทนคณะผู้วิจัย is not supported by the 2570 manual → reject", () => {
  const r = check("ค่าตอบแทนคณะผู้วิจัย", 5000);
  assert.equal(r.status, STATUS.REJECT);
  assert.equal(r.reasonCode, REASON.CATEGORY_NOT_IN_RULES);
});

test("every dropdown category except the unsupported one has exactly one rule item", () => {
  for (const category of data.categories) {
    const matches = ruleSet2570.ruleItems.filter((ri) => ri.categoryName === category);
    assert.equal(matches.length, category === "ค่าตอบแทนคณะผู้วิจัย" ? 0 : 1, category);
  }
});

test("office supplies: cap ฿5,000 — at cap passes, above cap needs fix", () => {
  assert.equal(check("ค่าวัสดุสำนักงาน", 5000).status, STATUS.PASS);
  const over = check("ค่าวัสดุสำนักงาน", 5000.01);
  assert.equal(over.status, STATUS.FIX);
  assert.equal(over.reasonCode, REASON.AMOUNT_EXCEEDS_CAP);
  assert.equal(over.ruleItemId, "ruleitem019");
});

test("flat-rate (เหมาจ่าย) taxi ฿700 is compared like a cap", () => {
  assert.equal(check("ค่าแท็กซี่ (เดินทางปฏิบัติงาน)", 700).reasonCode, REASON.WITHIN_CAP);
  assert.equal(check("ค่าแท็กซี่ (เดินทางปฏิบัติงาน)", 701).reasonCode, REASON.AMOUNT_EXCEEDS_CAP);
});

test("per-unit mileage passes but is flagged as not auto-verified", () => {
  const r = check("ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)", 99999);
  assert.equal(r.status, STATUS.PASS);
  assert.equal(r.reasonCode, REASON.NO_FIXED_CAP);
  assert.equal(r.autoVerified, false);
});

test("per-proposal category passes but is flagged as not auto-verified", () => {
  const r = check("ค่าครุภัณฑ์", 150000);
  assert.equal(r.reasonCode, REASON.NO_FIXED_CAP);
  assert.equal(r.autoVerified, false);
});

test("capped categories with complete evidence are auto-verified", () => {
  const r = evaluate({ category: "ค่าวัสดุสำนักงาน", amount: 100, evidence: { documentTypeIds: ["tax-invoice-full"], attestationIds: ["inspection-stamp"] } }, ruleSet2570);
  assert.equal(r.autoVerified, true);
});

test("invalid amount → needs fix, not pass", () => {
  for (const amount of [0, -50, NaN, undefined]) {
    assert.equal(check("ค่าวัสดุสำนักงาน", amount).reasonCode, REASON.INVALID_AMOUNT, String(amount));
  }
});

test("citation and evidence chain come from the matched rule item", () => {
  const r = check("ค่าเครื่องบิน (ชั้นประหยัด)", 4000);
  assert.match(r.citation, /คู่มือฯ ปีงบประมาณ 2570/);
  assert.equal(r.evidenceChainId, "chain-travel-domestic");
  assert.equal(r.ruleVersionId, "ruleversion002");
  assert.equal(r.engineVersion, RuleEngine.ENGINE_VERSION);
});

test("legacy { categoryName, maxAmount } rule item is treated as a cap", () => {
  const legacy = { fundSourceId: "fs", ruleVersionId: "v1", ruleItems: [{ id: "old", categoryName: "ค่าเดินทาง", maxAmount: 3000 }] };
  assert.equal(check("ค่าเดินทาง", 3500, legacy).reasonCode, REASON.AMOUNT_EXCEEDS_CAP);
  assert.equal(check("ค่าเดินทาง", 2500, legacy).reasonCode, REASON.WITHIN_CAP);
});

// ─── ความครบของเอกสารแนบ ───
const withDocs = (category, amount, documentTypeIds, attestationIds = []) =>
  evaluate({ category, amount, evidence: { documentTypeIds, attestationIds } }, ruleSet2570, documentNames);

test("every evidenceChainId in the rule items points at an existing chain and document types", () => {
  const docIds = new Set(data.documentTypes.map((d) => d.id));
  for (const ri of ruleSet2570.ruleItems) {
    const chain = ruleSet2570.evidenceChains[ri.evidenceChainId];
    assert.ok(chain, ri.categoryName);
    for (const step of [...chain.steps, ...chain.conditionalSteps.map((c) => c.addStep)]) {
      for (const id of step.documentTypeIds) assert.ok(docIds.has(id), `${chain.id} → ${id}`);
    }
  }
});

test("no evidence given → amount verdict stands but is not auto-verified", () => {
  const r = check("ค่าวัสดุสำนักงาน", 1000);
  assert.equal(r.status, STATUS.PASS);
  assert.equal(r.autoVerified, false);
  assert.ok(r.findings.some((f) => f.code === REASON.EVIDENCE_NOT_CHECKED));
});

test("purchase with tax invoice and inspection stamp confirmed → pass", () => {
  const r = withDocs("ค่าวัสดุสำนักงาน", 1000, ["tax-invoice-full"], ["inspection-stamp"]);
  assert.equal(r.status, STATUS.PASS);
  assert.equal(r.reasonCode, REASON.WITHIN_CAP);
  assert.equal(r.autoVerified, true);
});

test("purchase without inspection stamp confirmed → needs fix", () => {
  const r = withDocs("ค่าวัสดุสำนักงาน", 1000, ["tax-invoice-full"], []);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.MISSING_ATTESTATION);
  assert.match(r.explanation, /ตรวจรับพัสดุ/);
});

test("either alternative document satisfies a step (abbreviated tax invoice is enough)", () => {
  assert.equal(withDocs("ค่าสาธารณูปโภค", 500, ["tax-invoice-abbreviated"], ["inspection-stamp"]).status, STATUS.PASS);
});

test("domestic travel missing the pre-trip approval (วจ.3) → needs fix, names the form", () => {
  const r = withDocs("ค่าที่พัก (เดินทางปฏิบัติงาน)", 1500, ["hr-leave-form", "travel-report-vj4", "tax-invoice-full"]);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.MISSING_EVIDENCE);
  assert.match(r.explanation, /วจ\.3/);
  const missing = r.findings.filter((f) => f.code === REASON.MISSING_EVIDENCE).map((f) => f.documentTypeIds.join(","));
  assert.deepEqual(missing, ["travel-approval-vj3"]);
});

test("optional steps (e.g. ID card copy for travel) are not required", () => {
  const r = withDocs("ค่าที่พัก (เดินทางปฏิบัติงาน)", 1500, ["travel-approval-vj3", "hr-leave-form", "travel-report-vj4", "tax-invoice-full"]);
  assert.equal(r.status, STATUS.PASS);
});

test("equipment over ฿100,000 also requires the procurement committee certificate", () => {
  const steps = (amount) => RuleEngine.requiredEvidence("ค่าครุภัณฑ์", amount, ruleSet2570).steps.map((s) => s.documentTypeIds[0]);
  assert.ok(!steps(100000).includes("procurement-committee-cert"));
  assert.ok(steps(100000.01).includes("procurement-committee-cert"));

  const r = withDocs("ค่าครุภัณฑ์", 150000, ["tax-invoice-full"], ["inspection-stamp"]);
  assert.equal(r.reasonCode, REASON.MISSING_EVIDENCE);
  assert.match(r.explanation, /กรรมการ 3 คน/);
});

test("amount over cap stays the primary reason even when documents are also missing", () => {
  const r = withDocs("ค่าวัสดุสำนักงาน", 9000, [], []);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.AMOUNT_EXCEEDS_CAP);
  const codes = r.findings.map((f) => f.code);
  assert.ok(codes.includes(REASON.MISSING_EVIDENCE) && codes.includes(REASON.MISSING_ATTESTATION));
});

test("rejected category skips the evidence check entirely", () => {
  const r = withDocs("ค่าตอบแทนคณะผู้วิจัย", 5000, []);
  assert.equal(r.reasonCode, REASON.CATEGORY_NOT_IN_RULES);
  assert.equal(r.findings.length, 1);
});

test("same input always gives the same output", () => {
  assert.deepEqual(check("ค่าที่พัก (เดินทางปฏิบัติงาน)", 2000), check("ค่าที่พัก (เดินทางปฏิบัติงาน)", 2000));
});
