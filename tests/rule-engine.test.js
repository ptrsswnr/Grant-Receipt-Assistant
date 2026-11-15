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
  versionLabel: "2570.2",
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

const officeLine = { id: "line-office", itemName: "ค่าวัสดุสำนักงาน", total: 5000 };
const completePurchase = { documentTypeIds: ["tax-invoice-full", "inspection-photos"], attestationIds: ["paid-stamp", "inspection-stamp"] };

test("only fully verified when the estimate, cap and evidence were all checked", () => {
  const full = evaluate({ category: "ค่าวัสดุสำนักงาน", amount: 100, evidence: completePurchase, budget: { line: officeLine, spentBefore: 0 } }, ruleSet2570);
  assert.equal(full.autoVerified, true);
  const noEstimate = evaluate({ category: "ค่าวัสดุสำนักงาน", amount: 100, evidence: completePurchase }, ruleSet2570);
  assert.equal(noEstimate.autoVerified, false);
  assert.ok(noEstimate.findings.some((f) => f.code === REASON.ESTIMATE_NOT_CHECKED));
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

test("purchase with receipt, inspection photos and both stamps confirmed → pass", () => {
  const r = withDocs("ค่าวัสดุสำนักงาน", 1000, ["tax-invoice-full", "inspection-photos"], ["paid-stamp", "inspection-stamp"]);
  assert.equal(r.status, STATUS.PASS);
  assert.equal(r.reasonCode, REASON.WITHIN_CAP);
});

test("purchase without inspection stamp confirmed → needs fix", () => {
  const r = withDocs("ค่าวัสดุสำนักงาน", 1000, ["tax-invoice-full", "inspection-photos"], ["paid-stamp"]);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.MISSING_ATTESTATION);
  assert.match(r.explanation, /ตรวจรับพัสดุ/);
});

test("either alternative document satisfies a step (abbreviated tax invoice is enough)", () => {
  assert.equal(withDocs("ค่าสาธารณูปโภค", 500, ["tax-invoice-abbreviated"], ["paid-stamp"]).status, STATUS.PASS);
});

// คู่มือฉบับปรับปรุง หน้า 6: ตรา "ตรวจรับพัสดุ" เฉพาะซื้อสินค้า/บริการ — ค่าธรรมเนียม/สาธารณูปโภคไม่ใช่พัสดุ
test("fees and utilities need the paid stamp but not the inspection stamp", () => {
  const required = RuleEngine.requiredEvidence("ค่าสาธารณูปโภค", 500, ruleSet2570);
  assert.equal(required.attestations.map((a) => a.id).join(","), "paid-stamp");
});

// คู่มือฉบับปรับปรุง หน้า 6, 25–27: ตรา "จ่ายแล้ว" ทุกเอกสารการจ่าย
test("every evidence chain requires the paid stamp", () => {
  for (const chain of data.evidenceChains) {
    assert.ok((chain.attestations || []).some((a) => a.id === "paid-stamp"), chain.id);
  }
});

// คู่มือฉบับปรับปรุง หน้า 3, 47–48: ต้องได้รับอนุมัติจากคณะกรรมการก่อนดำเนินการ
test("compensation, travel, TOR hire, equipment and software require committee pre-approval", () => {
  const needsApproval = ["ค่าตอบแทนนักศึกษาช่วยงาน (วิชาการ)", "ค่าตอบแทนอาสาสมัคร/ผู้ให้ข้อมูล", "ค่าที่พัก (โรงแรม)",
    "ค่าจ้างเหมาบริการ", "ค่าเช่ายานพาหนะ (รถตู้)", "ค่าครุภัณฑ์", "ค่าวัสดุโปรแกรมคอมพิวเตอร์/ค่าลิขสิทธิ์โปรแกรม"];
  for (const category of needsApproval) {
    const step = RuleEngine.requiredEvidence(category, 1000, ruleSet2570).steps.find((s) => s.documentTypeIds.includes("committee-pre-approval"));
    assert.ok(step && step.required && step.timing === "before", category);
  }
  const materials = RuleEngine.requiredEvidence("ค่าวัสดุสำนักงาน", 1000, ruleSet2570).steps;
  assert.ok(!materials.some((s) => s.documentTypeIds.includes("committee-pre-approval")));
});

test("goods purchases require inspection photos", () => {
  const r = withDocs("ค่าวัสดุสำนักงาน", 1000, ["tax-invoice-full"], ["paid-stamp", "inspection-stamp"]);
  assert.equal(r.reasonCode, REASON.MISSING_EVIDENCE);
  assert.match(r.explanation, /รูปถ่ายพัสดุ/);
});

// คู่มือฉบับปรับปรุง หน้า 34: วจ.9 ยกเลิกแล้ว
test("the cancelled petty-cash ledger (วจ.9) is gone", () => {
  assert.ok(!data.documentTypes.some((d) => d.formCode === "วจ.9"));
});

test("domestic travel missing the pre-trip approval (วจ.3) → needs fix, names the form", () => {
  const r = withDocs("ค่าที่พัก (โรงแรม)", 1500, ["committee-pre-approval", "hr-leave-form", "travel-report-vj4", "tax-invoice-full"], ["paid-stamp"]);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.MISSING_EVIDENCE);
  assert.match(r.explanation, /วจ\.3/);
  const missing = r.findings.filter((f) => f.code === REASON.MISSING_EVIDENCE).map((f) => f.documentTypeIds.join(","));
  assert.deepEqual(missing, ["travel-approval-vj3"]);
});

test("optional steps (e.g. ID card copy for travel) are not required", () => {
  const r = withDocs("ค่าที่พัก (โรงแรม)", 1500, ["committee-pre-approval", "travel-approval-vj3", "hr-leave-form", "travel-report-vj4", "tax-invoice-full"], ["paid-stamp"]);
  assert.equal(r.status, STATUS.PASS);
});

test("equipment over ฿100,000 also requires the procurement committee certificate", () => {
  const steps = (amount) => RuleEngine.requiredEvidence("ค่าครุภัณฑ์", amount, ruleSet2570).steps.map((s) => s.documentTypeIds[0]);
  assert.ok(!steps(100000).includes("procurement-committee-cert"));
  assert.ok(steps(100000.01).includes("procurement-committee-cert"));

  const r = withDocs("ค่าครุภัณฑ์", 150000, ["committee-pre-approval", "tax-invoice-full", "inspection-photos"], ["paid-stamp", "inspection-stamp"]);
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

// ─── เทียบกับประมาณการ ───
const lunchLine = { id: "line-lunch", itemName: "ค่าอาหารกลางวัน (ประชุม/อบรม)", total: 6000 }; // 150 × 20 คน × 2 มื้อ
const meetingDocs = { documentTypeIds: ["attendee-signin-sheet", "tax-invoice-full"], attestationIds: ["paid-stamp"] };
const lunch = (amount, spentBefore, line = lunchLine) =>
  evaluate({ category: "ค่าอาหารกลางวัน (ประชุม/อบรม)", amount, evidence: meetingDocs, budget: { line, spentBefore } }, ruleSet2570, documentNames);

test("per-person cap is not compared against a whole-receipt total once an estimate line is given", () => {
  // อาหาร 20 คน ฿3,000 = ฿150/คน ไม่เกินเพดาน; แบบเดิมจะเทียบ ฿3,000 > ฿150 แล้วตัดสินผิดว่าต้องแก้ไข
  const r = lunch(3000, 0);
  assert.equal(r.status, STATUS.PASS);
  assert.equal(r.reasonCode, REASON.WITHIN_ESTIMATE);
  assert.ok(r.findings.some((f) => f.code === REASON.PER_UNIT_CAP_VIA_ESTIMATE));
});

test("spending exactly up to the line total passes", () => {
  assert.equal(lunch(3000, 3000).status, STATUS.PASS);
});

test("cumulative spending over the line total → needs justification/approval, with the numbers", () => {
  const r = lunch(3000, 3500);
  assert.equal(r.status, STATUS.APPROVAL);
  assert.equal(r.reasonCode, REASON.OVER_ESTIMATE);
  assert.match(r.explanation, /6,000/);
  assert.match(r.explanation, /108\.3%/);
});

test("expense not in the estimate at all → needs justification/approval", () => {
  const r = lunch(500, 0, null);
  assert.equal(r.status, STATUS.APPROVAL);
  assert.equal(r.reasonCode, REASON.NOT_IN_ESTIMATE);
  assert.equal(r.budgetLineId, null);
});

test("over the estimate outranks missing documents, but both are reported", () => {
  const r = evaluate({ category: "ค่าวัสดุสำนักงาน", amount: 2000, evidence: { documentTypeIds: [], attestationIds: [] }, budget: { line: officeLine, spentBefore: 4000 } }, ruleSet2570, documentNames);
  assert.equal(r.status, STATUS.APPROVAL);
  assert.equal(r.reasonCode, REASON.OVER_ESTIMATE);
  const codes = r.findings.map((f) => f.code);
  assert.ok(codes.includes(REASON.MISSING_EVIDENCE) && codes.includes(REASON.MISSING_ATTESTATION));
});

test("a category the regulations forbid is rejected even if it was in the estimate", () => {
  const r = evaluate({ category: "ค่าตอบแทนคณะผู้วิจัย", amount: 1000, budget: { line: { id: "x", itemName: "ค่าตอบแทนคณะผู้วิจัย", total: 50000 }, spentBefore: 0 } }, ruleSet2570);
  assert.equal(r.status, STATUS.REJECT);
});

test("whole-amount caps (no unit) still apply when an estimate line is given", () => {
  const r = evaluate({ category: "ค่าวัสดุสำนักงาน", amount: 6000, evidence: completePurchase, budget: { line: { ...officeLine, total: 10000 }, spentBefore: 0 } }, ruleSet2570);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.AMOUNT_EXCEEDS_CAP);
});

// ─── อัตราตามระเบียบ × จำนวนหน่วยจากตัวคูณในประมาณการ ───
const studentLine = { id: "line-ra", itemName: "ค่าตอบแทน – นักศึกษาช่วยงานด้านวิชาการ", total: 8000, quantity: 100 }; // ตั้งไว้ 80 บาท × 100 ชม. แต่ระเบียบให้ 60
const raDocs = { documentTypeIds: ["committee-pre-approval", "timesheet-parttime-vj8", "voucher-vj1", "id-card-copy"], attestationIds: ["paid-stamp"] };
const ra = (amount, spentBefore, line = studentLine) =>
  evaluate({ category: "ค่าตอบแทนนักศึกษาช่วยงาน (วิชาการ)", amount, evidence: raDocs, budget: { line, spentBefore } }, ruleSet2570, documentNames);

test("per-hour rate × hours from the estimate: within ฿60 × 100 h passes and is fully verified", () => {
  const r = ra(3000, 3000);
  assert.equal(r.status, STATUS.PASS);
  assert.ok(r.findings.some((f) => f.code === REASON.WITHIN_RATE_ALLOWANCE));
  assert.equal(r.autoVerified, true);
});

test("per-hour rate × hours: over ฿6,000 needs fix even though the estimate line (฿8,000) isn't used up", () => {
  const r = ra(1000, 5500);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.OVER_RATE_ALLOWANCE);
  assert.match(r.explanation, /6,000/);
});

test("mileage: ฿4/km × 1,200 km from the estimate multiplier", () => {
  const line = { id: "line-car", itemName: "ค่าพาหนะ (รถยนต์ส่วนบุคคล)", total: 6000, quantity: 1200 }; // ประมาณการตั้งไว้สูงกว่าที่ระเบียบให้ (4 × 1,200 = 4,800)
  const docs = { documentTypeIds: ["committee-pre-approval", "travel-approval-vj3", "hr-leave-form", "travel-report-vj4", "payment-cert-vj2"], attestationIds: ["paid-stamp"] };
  const ok = evaluate({ category: "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)", amount: 1600, evidence: docs, budget: { line, spentBefore: 3200 } }, ruleSet2570, documentNames);
  assert.equal(ok.status, STATUS.PASS);
  const over = evaluate({ category: "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)", amount: 1700, evidence: docs, budget: { line, spentBefore: 3200 } }, ruleSet2570, documentNames);
  assert.equal(over.reasonCode, REASON.OVER_RATE_ALLOWANCE);
});

test("per-person meal cap uses persons × meals from the estimate when it is known", () => {
  const r = lunch(3000, 0, { ...lunchLine, quantity: 40 });
  assert.ok(r.findings.some((f) => f.code === REASON.WITHIN_RATE_ALLOWANCE));
  assert.equal(r.autoVerified, true);
});

test("without a quantity in the estimate the rate can't be checked and the receipt is not auto-verified", () => {
  const r = ra(3000, 0, { ...studentLine, quantity: null });
  assert.equal(r.autoVerified, false);
  assert.ok(r.findings.some((f) => f.code === REASON.NO_FIXED_CAP));
});

test("fuel is reimbursed at actual cost against the estimate, not capped at the budgeting rate", () => {
  const line = { id: "line-fuel", itemName: "ค่าน้ำมันเชื้อเพลิง", total: 9000 };
  const docs = { documentTypeIds: ["tax-invoice-full", "inspection-photos"], attestationIds: ["paid-stamp", "inspection-stamp"] };
  const r = evaluate({ category: "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ต่างจังหวัด)", amount: 2600, evidence: docs, budget: { line, spentBefore: 0 } }, ruleSet2570, documentNames);
  assert.equal(r.status, STATUS.PASS);
  assert.ok(r.findings.some((f) => f.code === REASON.PER_PROPOSAL_VIA_ESTIMATE));
});

test("flat-rate lodging (relative's or own home) needs a payment certificate (วจ.2), not a hotel receipt", () => {
  const steps = RuleEngine.requiredEvidence("ค่าที่พัก (เหมาจ่าย พักบ้านญาติ/บ้านตนเอง)", 800, ruleSet2570).steps;
  const payment = steps.find((s) => s.order === 5);
  assert.equal(payment.documentTypeIds.join(","), "payment-cert-vj2");
  assert.equal(check("ค่าที่พัก (เหมาจ่าย พักบ้านญาติ/บ้านตนเอง)", 900).reasonCode, REASON.AMOUNT_EXCEEDS_CAP);
  assert.equal(check("ค่าที่พัก (โรงแรม)", 1800).reasonCode, REASON.WITHIN_CAP);
});

test("same input always gives the same output", () => {
  assert.deepEqual(check("ค่าที่พัก (โรงแรม)", 2000), check("ค่าที่พัก (โรงแรม)", 2000));
});

// ─── ยอดในใบสรุปรายรับ-จ่าย (engine 1.4.0) ───
const summaryReceipt = (summaryAmount) => ({
  category: "ค่าวัสดุสำนักงาน", amount: 3200,
  budget: { line: { id: "l1", itemName: "วัสดุสำนักงาน", total: 10000 }, spentBefore: 0 },
  evidence: { documentTypeIds: ["tax-invoice-full", "inspection-photos"], attestationIds: ["paid-stamp", "inspection-stamp"] },
  summary: summaryAmount === undefined ? undefined : { amount: summaryAmount },
});

test("summary sheet amount that differs from the receipt → ต้องแก้ไข", () => {
  const r = evaluate(summaryReceipt(3020), ruleSet2570, documentNames);
  assert.equal(r.status, STATUS.FIX);
  assert.equal(r.reasonCode, REASON.SUMMARY_AMOUNT_MISMATCH);
  assert.match(r.explanation, /180\.00/);
});

test("summary sheet amount that matches → pass, and leaving it blank skips the check", () => {
  const same = evaluate(summaryReceipt(3200), ruleSet2570, documentNames);
  assert.equal(same.status, STATUS.PASS);
  assert.ok(same.findings.some((f) => f.code === REASON.SUMMARY_MATCHES));
  const blank = evaluate(summaryReceipt(undefined), ruleSet2570, documentNames);
  assert.equal(blank.status, STATUS.PASS);
  assert.ok(!blank.findings.some((f) => f.group === "summary"));
  assert.equal(blank.autoVerified, true);
});

test("an over-estimate receipt keeps the estimate as the main reason even if the summary is also wrong", () => {
  const receipt = summaryReceipt(1);
  receipt.budget.line.total = 1000;
  const r = evaluate(receipt, ruleSet2570, documentNames);
  assert.equal(r.status, STATUS.APPROVAL);
  assert.equal(r.reasonCode, REASON.OVER_ESTIMATE);
  assert.ok(r.findings.some((f) => f.code === REASON.SUMMARY_AMOUNT_MISMATCH));
});
