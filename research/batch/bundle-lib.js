// ─────────────────────────────────────────────────────────────
// research/batch/bundle-lib.js — batch runner แบบ "ไฟล์สแกนทั้งโครงการ" (Stage C) ส่วนที่ทดสอบได้
// ใช้ app/js/document-pipeline.js ตัวเดียวกับหน้า app/batch-import.html ทุกขั้น ไม่มีตรรกะคู่ขนาน
// meta.json ของเคส (1 เคส = 1 โครงการ):
//   { fundSourceId, estimate: [...เหมือน run-batch...],
//     files: [ { fileName, path } | { fileName, pages: [{ page, text }] } ],    ← pages = OCR เตรียมไว้แล้ว
//     expectedItems?: [ { fileName, paymentPage, financeVerdict, note? } ] }   ← ผลของการเงินต่อรายการ
// รายการที่ระบบสร้างจับคู่กับ expectedItems ด้วย (ไฟล์, หน้าแรกของเอกสารจ่ายเงิน)
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const RuleEngine = require(path.join(ROOT, "app/js/rule-engine.js"));
const DocumentClassifier = require(path.join(ROOT, "app/js/document-classifier.js"));
const ReceiptPipeline = require(path.join(ROOT, "app/js/receipt-pipeline.js"));
const LlmVerdict = require(path.join(ROOT, "app/js/llm-verdict.js"));
const DocumentPipeline = require(path.join(ROOT, "app/js/document-pipeline.js"));
const evalLib = require("../eval/lib.js");
const { extensionOf } = require("./lib.js");

const MIME_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

// ไฟล์ 1 ไฟล์ → { pages: [{ page, text, lines }], error } — pages ที่เตรียมไว้ใน meta.json ข้ามการเรียก OCR
async function ocrBundleFile(fileDef, caseDir, OcrClient) {
  if (Array.isArray(fileDef.pages)) {
    return { pages: fileDef.pages.map((p) => ({ page: p.page, text: p.text || "", lines: p.lines || [] })), ocrSkipped: true, error: null };
  }
  try {
    const buffer = fs.readFileSync(path.join(caseDir, fileDef.path || fileDef.fileName));
    buffer.type = MIME_BY_EXT[extensionOf(fileDef.fileName)] || "application/octet-stream";
    return { pages: OcrClient.pagesOf(await OcrClient.read(buffer), 1), ocrSkipped: false, error: null };
  } catch (err) {
    return { pages: [], ocrSkipped: false, error: err.message };
  }
}

function hasRealBundleFiles(cases) {
  return cases.some((c) => (c.files || []).some((f) => !Array.isArray(f.pages)));
}

// ไฟล์ 1 ไฟล์ผ่านทุกขั้น — คืนผลแยกตามขั้นทั้งหมด ไม่ throw
// deps: { OcrClient, AiClient, config } / ctx: { ruleSet, documentNames, documentTypesById, categories, estimate, verdictMode }
async function runBundleFile(fileDef, caseDir, ctx, deps) {
  const started = Date.now();
  const pipelineDeps = { RuleEngine, LlmVerdict, ReceiptPipeline, DocumentClassifier, AiClient: deps.AiClient, OcrClient: deps.OcrClient, config: deps.config };
  const ocr = await ocrBundleFile(fileDef, caseDir, deps.OcrClient);
  const pages = ocr.pages;

  const split = await DocumentPipeline.splitAndClassify(pages, ctx.documentTypesById, pipelineDeps);
  const documents = split.documents.map((d) => {
    const inRange = pages.filter((p) => p.page >= d.pageFrom && p.page <= d.pageTo);
    return Object.assign({}, d, { text: DocumentPipeline.documentText(pages, d), lines: [].concat(...inRange.map((p) => p.lines)) });
  });
  for (const d of documents) {
    d.extraction = await DocumentPipeline.extractDocumentFields(d, d.text, d.lines, ctx.documentTypesById, ctx.categories, pipelineDeps);
  }
  const grouping = await DocumentPipeline.groupIntoExpenses(documents, ctx.documentTypesById, pipelineDeps);

  const items = [];
  for (const group of grouping.groups) {
    const result = await DocumentPipeline.evaluateGroup(group, documents, {
      ruleSet: ctx.ruleSet, documentNames: ctx.documentNames, documentTypesById: ctx.documentTypesById,
      estimate: ctx.estimate, verdictMode: ctx.verdictMode,
    }, pipelineDeps);
    const line = ctx.estimate.find((l) => l.id === result.budgetLineId);
    if (line && typeof result.amount === "number") line.spentBefore = (line.spentBefore || 0) + result.amount;
    items.push({ group, paymentPage: documents[group.paymentDocumentIndex].pageFrom, result });
  }

  return {
    fileName: fileDef.fileName,
    ocr: { pageCount: pages.length, ocrSkipped: ocr.ocrSkipped, error: ocr.error, pages },
    split: { method: split.method, model: split.model, promptVersion: split.promptVersion, raw: split.raw, error: split.error },
    documents: documents.map((d, i) => ({
      index: i, pageFrom: d.pageFrom, pageTo: d.pageTo, documentTypeId: d.documentTypeId, extraction: d.extraction,
      groupIndexes: grouping.groups.map((g, k) => (g.documentIndexes.includes(i) ? k : -1)).filter((k) => k !== -1),
    })),
    grouping: { method: grouping.method, model: grouping.model, promptVersion: grouping.promptVersion, raw: grouping.raw, error: grouping.error, groups: grouping.groups, unassigned: grouping.unassigned },
    items,
    durationMs: Date.now() - started,
  };
}

// เคส 1 โครงการ: ทุกไฟล์ใช้ประมาณการชุดเดียวกัน ยอดเบิกสะสมต่อเนื่องข้ามไฟล์ แล้วจับคู่กับผลของการเงิน
async function runBundleCase(caseDef, ctx, deps) {
  const estimate = JSON.parse(JSON.stringify(caseDef.estimate || []));
  const files = [];
  for (const fileDef of caseDef.files || []) {
    files.push(await runBundleFile(fileDef, caseDef.dir, Object.assign({}, ctx, { estimate }), deps));
  }
  const expected = (caseDef.expectedItems || []).map((e) => Object.assign({}, e, { expected: evalLib.normalizeLabel(e.financeVerdict) }));
  const pairs = [];
  const matched = new Set();
  files.forEach((f) => f.items.forEach((item) => {
    const e = expected.find((x, k) => !matched.has(k) && x.fileName === f.fileName && Number(x.paymentPage) === item.paymentPage);
    if (e) matched.add(expected.indexOf(e));
    item.financeVerdict = e ? e.financeVerdict : null;
    item.expected = e ? e.expected : null;
    if (e) pairs.push({ expected: e.expected, predicted: item.result.status });
  }));
  const unmatchedExpected = expected.filter((e, k) => !matched.has(k));
  return { id: caseDef.id, files, pairs, unmatchedExpected };
}

const ITEM_COLUMNS = ["caseId", "fileName", "paymentPage", "pages", "category", "amount", "status", "ruleStatus", "ruleReasonCode", "llmVerdict", "financeVerdict", "splitMethod", "groupingMethod"];
const DOCUMENT_COLUMNS = ["caseId", "fileName", "index", "pageFrom", "pageTo", "documentTypeId", "kind", "splitMethod", "extractMethod", "amount", "category", "groupIndexes", "extractError"];

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(columns, rows) {
  return [columns.join(",")].concat(rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))).join("\n");
}

function itemRows(caseResults) {
  const rows = [];
  caseResults.forEach((c) => c.files.forEach((f) => f.items.forEach((item) => {
    const docs = item.group.documentIndexes.map((i) => f.documents[i]);
    rows.push({
      caseId: c.id, fileName: f.fileName, paymentPage: item.paymentPage,
      pages: docs.map((d) => (d.pageFrom === d.pageTo ? d.pageFrom : d.pageFrom + "-" + d.pageTo)).join(";"),
      category: item.result.category, amount: item.result.amount, status: item.result.status,
      ruleStatus: item.result.ruleCheck.status, ruleReasonCode: item.result.ruleCheck.reasonCode,
      llmVerdict: item.result.llmVerdict ? item.result.llmVerdict.verdict : null,
      financeVerdict: item.financeVerdict, splitMethod: f.split.method, groupingMethod: f.grouping.method,
    });
  })));
  return rows;
}

function documentRows(caseResults) {
  const rows = [];
  caseResults.forEach((c) => c.files.forEach((f) => f.documents.forEach((d) => {
    const r = d.extraction.receipt;
    rows.push({
      caseId: c.id, fileName: f.fileName, index: d.index, pageFrom: d.pageFrom, pageTo: d.pageTo,
      documentTypeId: d.documentTypeId, kind: d.extraction.kind, splitMethod: f.split.method, extractMethod: d.extraction.method,
      amount: r ? r.amount : null, category: r ? r.category : null, groupIndexes: d.groupIndexes.join(";"), extractError: d.extraction.error,
    });
  })));
  return rows;
}

module.exports = {
  ocrBundleFile, hasRealBundleFiles, runBundleFile, runBundleCase,
  itemRows, documentRows, toCsv, ITEM_COLUMNS, DOCUMENT_COLUMNS,
};
