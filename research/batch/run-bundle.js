#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// research/batch/run-bundle.js — รันไฟล์สแกนทั้งโครงการหลายโครงการต่อเนื่องโดยไม่ผ่านหน้าจอ (Stage C)
// ทุกขั้นใช้ app/js/document-pipeline.js ตัวเดียวกับหน้า app/batch-import.html
//
//   node research/batch/run-bundle.js research/batch/bundles.example --verdict-mode rule
//   node research/batch/run-bundle.js research/batch/data/bundles                    (ค่าเริ่มต้น llm)
//
// ผลลัพธ์ใน research/batch/output/: <ชื่อ>-<เวลา>.json (ผลทุกขั้นของทุกไฟล์: OCR รายหน้า, แยกเอกสาร,
// ฟิลด์, จัดกลุ่ม, ตัดสิน), -items.csv (1 แถวต่อรายการค่าใช้จ่าย), -documents.csv (1 แถวต่อเอกสาร)
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./lib.js");
const bundleLib = require("./bundle-lib.js");
const evalLib = require("../eval/lib.js");
const baseline = require("../eval/baseline.js");
const OcrClient = require(path.join(lib.ROOT, "app/js/ocr-client.js"));
const AiClient = require(path.join(lib.ROOT, "app/js/ai-client.js"));
const DocumentPipeline = require(path.join(lib.ROOT, "app/js/document-pipeline.js"));
const LlmVerdict = require(path.join(lib.ROOT, "app/js/llm-verdict.js"));

async function main() {
  const args = process.argv.slice(2);
  const modeIdx = args.indexOf("--verdict-mode");
  const verdictMode = modeIdx !== -1 ? args[modeIdx + 1] : "llm";
  const casesDir = args.find((a, i) => !a.startsWith("--") && i !== modeIdx + 1);
  if (!casesDir || !fs.existsSync(casesDir) || (verdictMode !== "llm" && verdictMode !== "rule")) {
    console.error("ใช้: node research/batch/run-bundle.js <โฟลเดอร์เคส> [--verdict-mode llm|rule]");
    process.exit(1);
  }

  const { ruleSet, documentNames, data } = evalLib.loadRuleSet();
  const documentTypesById = Object.fromEntries(data.documentTypes.map((d) => [d.id, d]));
  const cases = lib.loadCases(casesDir);

  const noEstimate = cases.filter((c) => !c.estimate || !c.estimate.length).map((c) => c.id);
  if (noEstimate.length) {
    console.error("เคสต่อไปนี้ไม่มี \"estimate\" (ประมาณการของโครงการ) ใน meta.json: " + noEstimate.join(", "));
    process.exit(1);
  }
  if (bundleLib.hasRealBundleFiles(cases) && !(await OcrClient.isAvailable())) {
    console.error("ต่อ OCR server (" + OcrClient.endpoint() + ") ไม่ได้ — เปิด research/ocr/server.py ก่อนรันเคสที่มีไฟล์จริง");
    process.exit(1);
  }

  // แยกเอกสาร/ดึงฟิลด์/จัดกลุ่มใช้ AI เมื่อตั้งค่าไว้ (ทั้งสองโหมด) — ไม่มี AI ใช้วิธีสำรองและบันทึกว่าใช้วิธีไหน
  const aiConfig = baseline.loadAiConfig();
  const aiReady = AiClient.isConfigured(aiConfig || {});
  if (verdictMode === "llm" && !aiReady) {
    console.error("ยังไม่ได้ตั้งค่า AI สำหรับ verdictMode=llm — สร้างไฟล์ " + baseline.CONFIG_PATH + " หรือรันด้วย --verdict-mode rule");
    process.exit(1);
  }
  const deps = { OcrClient, AiClient: aiReady ? AiClient : null, config: aiConfig };
  const ctx = { ruleSet, documentNames, documentTypesById, categories: Array.from(data.categories), verdictMode };

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    process.stdout.write(`${i + 1}/${cases.length} ${cases[i].id}... `);
    const r = await bundleLib.runBundleCase(cases[i], ctx, deps);
    results.push(r);
    const files = r.files;
    console.log(files.map((f) => `${f.fileName}: ${f.ocr.pageCount} หน้า → ${f.documents.length} เอกสาร → ${f.items.length} รายการ` +
      (f.ocr.error ? ` (OCR error: ${f.ocr.error})` : "")).join("; "));
  }

  const pairs = [].concat(...results.map((r) => r.pairs));
  const binaryMetrics = lib.computeBinaryMetrics(pairs);
  const unmatched = [].concat(...results.map((r) => r.unmatchedExpected.map((e) => Object.assign({ caseId: r.id }, e))));

  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(outDir, `${path.basename(casesDir)}-${stamp}`);
  const runMeta = {
    ranAt: new Date().toISOString(), casesDir, verdictMode,
    engineVersion: evalLib.RuleEngine.ENGINE_VERSION, ruleSetVersion: ruleSet.versionLabel,
    ocrModel: "OpenThai 2.0 (local, research/ocr/server.py)",
    llmModel: aiReady ? AiClient.modelName(aiConfig, false) : null,
    pipelinePromptVersion: DocumentPipeline.PROMPT_VERSION, verdictPromptVersion: LlmVerdict.PROMPT_VERSION,
  };
  fs.writeFileSync(base + ".json", JSON.stringify({ runMeta, binaryMetrics, unmatchedExpected: unmatched, results }, null, 2), "utf8");
  fs.writeFileSync(base + "-items.csv", bundleLib.toCsv(bundleLib.ITEM_COLUMNS, bundleLib.itemRows(results)), "utf8");
  fs.writeFileSync(base + "-documents.csv", bundleLib.toCsv(bundleLib.DOCUMENT_COLUMNS, bundleLib.documentRows(results)), "utf8");

  const pct = (x) => (x == null ? "-" : (x * 100).toFixed(1) + "%");
  console.log("");
  console.log(`รายการที่จับคู่กับผลของการเงินได้: ${binaryMetrics.n} · ไม่พบรายการที่ระบบสร้างให้ตรงกัน: ${unmatched.length}`);
  console.log(`pass/fail ตรงกับการเงิน: ${pct(binaryMetrics.accuracy)} · missed ${binaryMetrics.missed} · false alarm ${binaryMetrics.falseAlarm}`);
  console.log(`บันทึกผลที่ ${base}.json, -items.csv และ -documents.csv`);
}

main().catch((err) => { console.error(err); process.exit(1); });
