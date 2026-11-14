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
};

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

test("capped categories are auto-verified", () => {
  assert.equal(check("ค่าวัสดุสำนักงาน", 100).autoVerified, true);
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

test("same input always gives the same output", () => {
  assert.deepEqual(check("ค่าที่พัก (เดินทางปฏิบัติงาน)", 2000), check("ค่าที่พัก (เดินทางปฏิบัติงาน)", 2000));
});
