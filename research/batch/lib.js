// ─────────────────────────────────────────────────────────────
// research/batch/lib.js — ส่วนที่เป็น pure function ของ batch runner (ทดสอบใน tests/batch-lib.test.js)
// อ่านโฟลเดอร์เคส (ใบเสร็จ+เอกสารแนบจริง หรือข้อความ OCR ที่เตรียมไว้ล่วงหน้า) → รันผ่านโมดูลเดิมของ
// เว็บจริงทุกตัว (ไม่สร้างตรรกะคู่ขนาน): js/rule-engine.js, js/document-classifier.js,
// js/receipt-pipeline.js, js/llm-verdict.js — แล้วคืนผลลัพธ์พร้อมผลดิบทุกขั้นของแต่ละเคส
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const RuleEngine = require(path.join(ROOT, "app/js/rule-engine.js"));
const DocumentClassifier = require(path.join(ROOT, "app/js/document-classifier.js"));
const ReceiptPipeline = require(path.join(ROOT, "app/js/receipt-pipeline.js"));
const LlmVerdict = require(path.join(ROOT, "app/js/llm-verdict.js"));
const evalLib = require("../eval/lib.js");

const MIME_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

function extensionOf(fileName) {
  const m = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

// โหลดเคสทั้งหมดจากโฟลเดอร์ (แต่ละเคสเป็นโฟลเดอร์ย่อยที่มี meta.json — ดู research/batch/README.md)
// meta.json: { fundSourceId, category, amount, financeVerdict?, note?,
//              files: [ { fileName, path? (ไฟล์จริงในโฟลเดอร์เคส ให้ OCR อ่าน) |
//                                    ocrText? (ข้อความ OCR ที่เตรียมไว้แล้ว ข้ามการเรียก OCR จริง) } ] }
function loadCases(casesDir) {
  return fs.readdirSync(casesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = path.join(casesDir, d.name);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
      return Object.assign({ id: d.name, dir: dir }, meta);
    });
}

// ไฟล์หนึ่งไฟล์ของเคส → { fileName, text, lines, ocrSkipped, error }
// ocrText ที่เตรียมไว้แล้ว (เคสตัวอย่าง/สังเคราะห์) ข้ามการเรียก OCR จริงไปเลย — ไฟล์จริงอ่านผ่าน
// OcrClient ตัวเดียวกับเว็บ (ชี้ไป 127.0.0.1:8765 โดย default เหมือนกัน — ต้องเปิด
// research/ocr/server.py ไว้ก่อนรัน batch ด้วยไฟล์จริง)
async function ocrOneFile(fileDef, caseDir, OcrClient) {
  if (fileDef.ocrText != null) {
    return { fileName: fileDef.fileName, text: fileDef.ocrText, lines: [], ocrSkipped: true, error: null };
  }
  const filePath = path.join(caseDir, fileDef.path || fileDef.fileName);
  try {
    const buffer = fs.readFileSync(filePath);
    buffer.type = MIME_BY_EXT[extensionOf(fileDef.fileName)] || "application/octet-stream";
    const ocrResult = await OcrClient.read(buffer);
    return { fileName: fileDef.fileName, text: OcrClient.textForAi(ocrResult), lines: ocrResult.lines || [], ocrSkipped: false, error: null };
  } catch (err) {
    return { fileName: fileDef.fileName, text: "", lines: [], ocrSkipped: false, error: err.message };
  }
}

// ประมาณการของเคส (meta.json "estimate") → รูปแบบ budget ที่ rule engine รับ โดยจับคู่รายการด้วยหมวด
// แบบเดียวกับ matchBudget() ในเว็บ (ruleCategory ของรายการ = หมวดของใบเสร็จ, เอารายการแรกที่ตรง)
// ไม่มี estimate → undefined (rule engine บันทึกว่ายังตรวจกับประมาณการไม่ได้)
function budgetForRuleEngine(estimate, category) {
  if (!estimate || !estimate.length) return undefined;
  const line = estimate.find((l) => l.ruleCategory === category) || null;
  return { line: line, spentBefore: line ? line.spentBefore || 0 : 0 };
}

function hasRealFiles(cases) {
  return cases.some((c) => (c.files || []).some((f) => f.ocrText == null));
}

// ตัวชี้วัดแบบ pass/fail — ใช้เป็นตัวหลักเพราะ LLM ตอบได้แค่ pass/fail (ผลอื่นที่ไม่ใช่ "ผ่าน" ของการเงินนับเป็น fail)
function computeBinaryMetrics(pairs) {
  const PASS = RuleEngine.STATUS.PASS;
  const valid = pairs.filter((p) => p.expected && p.predicted);
  const n = valid.length;
  const isFail = (s) => s !== PASS;
  let tp = 0, fp = 0, fn = 0, tn = 0; // positive = fail (มีปัญหา)
  valid.forEach((p) => {
    if (isFail(p.expected) && isFail(p.predicted)) tp++;
    else if (!isFail(p.expected) && isFail(p.predicted)) fp++;
    else if (isFail(p.expected) && !isFail(p.predicted)) fn++;
    else tn++;
  });
  const accuracy = n ? (tp + tn) / n : null;
  const pe = n ? (((tp + fp) * (tp + fn)) + ((fn + tn) * (fp + tn))) / (n * n) : null;
  const kappa = n && pe < 1 ? (accuracy - pe) / (1 - pe) : null;
  return {
    n, skipped: pairs.length - n, accuracy, kappa,
    matrix: { tp, fp, fn, tn },
    missed: fn, falseAlarm: fp,
    problemRecall: tp + fn ? tp / (tp + fn) : null,
    falseAlarmRate: fp + tn ? fp / (fp + tn) : null,
  };
}

// รันเคสเดียวผ่านทุกขั้นของ pipeline เดียวกับเว็บจริง — ไม่ throw (เคสอื่นในชุดต้องรันต่อได้)
// deps: { OcrClient, AiClient } (DI เพื่อให้ทดสอบด้วย fake client ได้ ไม่ต้องมี OCR server/AI จริง)
// opts: { verdictMode: 'llm'|'rule', aiConfig }
async function runCase(caseDef, ruleSet, documentNames, documentTypesById, deps, opts) {
  opts = opts || {};
  const verdictMode = opts.verdictMode || "llm";
  const started = Date.now();

  const ocrByFile = [];
  for (const fileDef of caseDef.files || []) {
    ocrByFile.push(await ocrOneFile(fileDef, caseDef.dir, deps.OcrClient));
  }
  const ocrTextCombined = ocrByFile.map((f) => f.fileName + ":\n" + (f.text || "(OCR อ่านไม่ได้)")).join("\n\n");

  const classification = ReceiptPipeline.classifyAttachedFiles(ocrByFile, documentTypesById, DocumentClassifier);
  const evidence = ReceiptPipeline.buildEvidence(ocrByFile, classification, DocumentClassifier);

  const estimate = caseDef.estimate || null;
  const ruleCheckResult = RuleEngine.evaluate({ category: caseDef.category, amount: caseDef.amount, evidence: evidence, budget: budgetForRuleEngine(estimate, caseDef.category) }, ruleSet, documentNames);
  ruleCheckResult.aiExplanation = ruleCheckResult.explanation;

  let llmResult = null;
  if (verdictMode === "llm") {
    llmResult = await LlmVerdict.evaluateWithLlm(
      ocrTextCombined, ruleSet, documentNames, { category: caseDef.category, amount: caseDef.amount, estimate: estimate },
      { aiClient: deps.AiClient, config: opts.aiConfig }
    );
  }
  const decided = ReceiptPipeline.decideVerdict(verdictMode, ruleCheckResult, llmResult, RuleEngine.STATUS);
  const expected = evalLib.normalizeLabel(caseDef.financeVerdict);

  return {
    id: caseDef.id,
    category: caseDef.category,
    amount: caseDef.amount,
    financeVerdict: caseDef.financeVerdict || null,
    expected: expected,
    note: caseDef.note || "",
    verdictMode: verdictMode,
    predictedStatus: decided.status,
    predictedExplanation: decided.explanation,
    engineVersion: RuleEngine.ENGINE_VERSION,
    ruleSetVersion: ruleSet.versionLabel,
    promptVersion: llmResult ? llmResult.promptVersion : null,
    llmModel: llmResult ? llmResult.model : null,
    ruleCheck: { status: ruleCheckResult.status, reasonCode: ruleCheckResult.reasonCode, autoVerified: ruleCheckResult.autoVerified, explanation: ruleCheckResult.explanation },
    llmVerdict: llmResult,
    ocrRaw: ocrByFile,
    documentClassification: classification,
    ocrErrors: ocrByFile.filter((f) => f.error).length,
    durationMs: Date.now() - started,
  };
}

const CSV_COLUMNS = [
  "id", "category", "amount", "financeVerdict", "predictedStatus", "ruleCheck.status", "ruleCheck.reasonCode",
  "llmVerdict.verdict", "llmModel", "promptVersion", "ruleSetVersion", "engineVersion", "durationMs", "ocrErrors", "llmVerdict.error",
];

function get(obj, dottedPath) {
  return dottedPath.split(".").reduce((o, k) => (o == null ? null : o[k]), obj);
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function resultsToCsv(results) {
  const lines = [CSV_COLUMNS.join(",")];
  results.forEach((r) => lines.push(CSV_COLUMNS.map((c) => csvEscape(get(r, c))).join(",")));
  return lines.join("\n");
}

module.exports = { ROOT, loadCases, ocrOneFile, runCase, resultsToCsv, extensionOf, CSV_COLUMNS, budgetForRuleEngine, hasRealFiles, computeBinaryMetrics };
