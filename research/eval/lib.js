// ─────────────────────────────────────────────────────────────
// research/eval/lib.js — ส่วนที่เป็น pure function ของชุดประเมินผล (ทดสอบใน tests/eval.test.js)
// อ่านไฟล์เคส CSV → แปลงเป็นใบเสร็จที่ rule engine รับ → เทียบผลกับผลตัดสินของการเงิน → คำนวณตัวชี้วัด
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const RuleEngine = require(path.join(ROOT, "app/js/rule-engine.js"));
const { STATUS } = RuleEngine;

// ลำดับคงที่ของ 4 ผลตัดสิน (เบาไปหนัก) ใช้เป็นแถว/คอลัมน์ของ confusion matrix
const LABELS = [STATUS.PASS, STATUS.FIX, STATUS.APPROVAL, STATUS.REJECT];
const LABEL_ALIASES = {
  pass: STATUS.PASS, "ผ่าน": STATUS.PASS,
  fix: STATUS.FIX, "ต้องแก้ไข": STATUS.FIX, "แก้ไข": STATUS.FIX,
  approval: STATUS.APPROVAL, "ต้องชี้แจง/ขออนุมัติ": STATUS.APPROVAL, "ขออนุมัติ": STATUS.APPROVAL, "ชี้แจง": STATUS.APPROVAL,
  reject: STATUS.REJECT, "ไม่เข้าเงื่อนไข": STATUS.REJECT, "ไม่ผ่าน": STATUS.REJECT,
};

function normalizeLabel(value) {
  const key = String(value || "").trim();
  return LABEL_ALIASES[key] || LABEL_ALIASES[key.toLowerCase()] || null;
}

// CSV แบบที่ Excel/Google Sheets export: รองรับ "..." ที่มีคอมมา/ขึ้นบรรทัดใหม่ และ BOM ต้นไฟล์
function parseCsv(text) {
  text = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])));
}

// ชุดกฎจาก app/js/data.js — ไฟล์เดียวกับที่ seed ขึ้น Firestore จึงตรงกับที่เว็บใช้ตัดสินจริง
function loadRuleSet() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "app/js/data.js"), "utf8"), sandbox);
  const data = sandbox.window.RECEIPT_DATA;
  const version = data.ruleVersions.find((v) => v.isActive) || data.ruleVersions[0];
  return {
    data,
    ruleSet: {
      fundSourceId: version.fundSourceId,
      ruleVersionId: version.id,
      versionLabel: version.versionLabel,
      ruleItems: data.ruleItems.filter((ri) => ri.ruleVersionId === version.id),
      evidenceChains: Object.fromEntries(data.evidenceChains.map((c) => [c.id, c])),
    },
    documentNames: Object.fromEntries(data.documentTypes.map((d) => [d.id, d.documentName])),
  };
}

function toNumber(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(/[,\s฿]/g, ""));
  return isFinite(n) ? n : null;
}

function idList(v) {
  if (!v || /^none$/i.test(v.trim()) || v.trim() === "-") return [];
  return v.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
}

// แถว CSV → { id, receipt (รูปแบบที่ RuleEngine.evaluate รับ), expected, note }
// คอลัมน์ดูใน research/eval/README.md
function caseToReceipt(row) {
  const receipt = { category: row.category, amount: toNumber(row.amount) };

  const inEstimate = (row.in_estimate || "").trim().toLowerCase();
  if (inEstimate === "yes" || inEstimate === "ใช่") {
    receipt.budget = {
      line: {
        id: row.case_id + "-line",
        itemName: row.line_name || row.category,
        total: toNumber(row.line_total) || 0,
        quantity: toNumber(row.line_quantity),
      },
      spentBefore: toNumber(row.spent_before) || 0,
    };
  } else if (inEstimate === "no" || inEstimate === "ไม่") {
    receipt.budget = { line: null, spentBefore: 0 };
  }
  // ว่าง = โครงการไม่มีประมาณการในระบบ → ไม่ส่ง budget (engine บันทึกว่ายังไม่ได้เทียบ)

  const summaryAmount = toNumber(row.summary_amount);
  if (summaryAmount !== null) receipt.summary = { amount: summaryAmount };

  // ทั้งสองช่องว่าง = ไม่ได้บันทึกว่าแนบอะไร (engine ไม่ตรวจเอกสาร); "none" = ไม่ได้แนบอะไรเลย
  if ((row.documents || "") !== "" || (row.attestations || "") !== "") {
    receipt.evidence = { documentTypeIds: idList(row.documents), attestationIds: idList(row.attestations) };
  }
  return { id: row.case_id, receipt, expected: normalizeLabel(row.finance_verdict), rawExpected: row.finance_verdict, note: row.finance_note || "" };
}

// pairs: [{ expected, predicted }] — ข้ามเคสที่ไม่มีผลของการเงินหรือระบบตอบไม่ได้ (นับแยกไว้ใน skipped)
function computeMetrics(pairs) {
  const valid = pairs.filter((p) => LABELS.includes(p.expected) && LABELS.includes(p.predicted));
  const n = valid.length;
  const matrix = LABELS.map(() => LABELS.map(() => 0));
  valid.forEach((p) => { matrix[LABELS.indexOf(p.expected)][LABELS.indexOf(p.predicted)]++; });

  const correct = LABELS.reduce((sum, _, i) => sum + matrix[i][i], 0);
  const perClass = LABELS.map((label, i) => {
    const tp = matrix[i][i];
    const actual = matrix[i].reduce((a, b) => a + b, 0);
    const predicted = matrix.reduce((a, row) => a + row[i], 0);
    const precision = predicted ? tp / predicted : null;
    const recall = actual ? tp / actual : null;
    const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : (actual || predicted ? 0 : null);
    return { label, support: actual, predicted, precision, recall, f1 };
  });
  const f1s = perClass.filter((c) => c.support > 0).map((c) => c.f1 || 0);
  const macroF1 = f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : null;

  // Cohen's kappa: ความเห็นตรงกันเกินกว่าที่บังเอิญตรง (1 = ตรงสมบูรณ์, 0 = เท่ากับสุ่ม)
  const po = n ? correct / n : null;
  const pe = n ? LABELS.reduce((sum, _, i) => {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    const colSum = matrix.reduce((a, row) => a + row[i], 0);
    return sum + (rowSum * colSum) / (n * n);
  }, 0) : null;
  const kappa = n && pe < 1 ? (po - pe) / (1 - pe) : null;

  // มุมมองที่ใช้จริงที่สุด: ระบบ "ปล่อยผ่าน" ใบที่การเงินบอกว่ามีปัญหาไหม (missed) และ "ทักผิด" ใบที่ผ่าน (false alarm)
  const flagged = (label) => label !== STATUS.PASS;
  const missed = valid.filter((p) => flagged(p.expected) && !flagged(p.predicted)).length;
  const falseAlarm = valid.filter((p) => !flagged(p.expected) && flagged(p.predicted)).length;
  const actualProblems = valid.filter((p) => flagged(p.expected)).length;
  const actualPasses = n - actualProblems;

  return {
    n, skipped: pairs.length - n, correct, accuracy: po, kappa, macroF1, matrix, labels: LABELS, perClass,
    flagging: {
      missed, falseAlarm, actualProblems, actualPasses,
      problemRecall: actualProblems ? (actualProblems - missed) / actualProblems : null,
      falseAlarmRate: actualPasses ? falseAlarm / actualPasses : null,
    },
  };
}

module.exports = { ROOT, RuleEngine, STATUS, LABELS, normalizeLabel, parseCsv, loadRuleSet, caseToReceipt, computeMetrics };
