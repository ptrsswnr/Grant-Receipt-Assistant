#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// research/batch/run-batch.js — รันหลายเคส (ใบเสร็จ+เอกสารแนบจริง) ต่อเนื่องโดยไม่ผ่านหน้าจอ
// เรียกใช้โมดูลเดิมของเว็บจริงทุกตัว (js/rule-engine.js, js/document-classifier.js,
// js/receipt-pipeline.js, js/llm-verdict.js, js/ocr-client.js, js/ai-client.js) ผ่าน research/batch/lib.js
//
//   node research/batch/run-batch.js research/batch/cases.example
//   node research/batch/run-batch.js data/cases --verdict-mode rule     (เทียบ rule engine ล้วน ไม่เรียก AI)
//
// บันทึกทุกครั้งที่รัน: ชื่อรุ่น OCR, ชื่อรุ่น LLM, เวอร์ชัน prompt, เวอร์ชัน rule set, ผล OCR ดิบ,
// ผล LLM ดิบ, เวลาที่ใช้ — ผลลัพธ์: research/batch/output/<ชื่อโฟลเดอร์เคส>-<เวลา>.json และ .csv
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./lib.js");
const evalLib = require("../eval/lib.js");
const baseline = require("../eval/baseline.js"); // ใช้ loadAiConfig()/CONFIG_PATH ตัวเดียวกับ eval harness
const OcrClient = require(path.join(lib.ROOT, "app/js/ocr-client.js"));
const AiClient = require(path.join(lib.ROOT, "app/js/ai-client.js"));

async function main() {
  const args = process.argv.slice(2);
  const modeIdx = args.indexOf("--verdict-mode");
  const verdictMode = modeIdx !== -1 ? args[modeIdx + 1] : "llm";
  const casesDir = args.find((a, i) => !a.startsWith("--") && i !== modeIdx + 1);
  if (!casesDir || !fs.existsSync(casesDir) || (verdictMode !== "llm" && verdictMode !== "rule")) {
    console.error("ใช้: node research/batch/run-batch.js <โฟลเดอร์เคส> [--verdict-mode llm|rule]");
    process.exit(1);
  }

  const { ruleSet, documentNames, data } = evalLib.loadRuleSet();
  const documentTypesById = Object.fromEntries(data.documentTypes.map((d) => [d.id, d]));
  const cases = lib.loadCases(casesDir);

  // ประมาณการต้องมีก่อนตรวจใบเสร็จ (เหมือนที่เว็บบังคับ) — เคสที่ไม่มีจะถูกตัดสินโดยไม่รู้งบของโครงการ
  const noEstimate = cases.filter((c) => !c.estimate || !c.estimate.length).map((c) => c.id);
  if (noEstimate.length) {
    console.error("เคสต่อไปนี้ไม่มี \"estimate\" (ประมาณการของโครงการ) ใน meta.json: " + noEstimate.join(", "));
    process.exit(1);
  }

  // มีไฟล์จริงที่ต้องให้ OCR อ่าน แต่ไม่ได้เปิด OCR server → หยุดเลย ไม่ปล่อยให้ทุกเคสถูกตัดสินโดยไม่มีข้อความ OCR
  if (lib.hasRealFiles(cases) && !(await OcrClient.isAvailable())) {
    console.error("ต่อ OCR server (" + OcrClient.endpoint() + ") ไม่ได้ — เปิด research/ocr/server.py ก่อนรันเคสที่มีไฟล์จริง");
    process.exit(1);
  }

  let aiConfig = null;
  if (verdictMode === "llm") {
    aiConfig = baseline.loadAiConfig();
    if (!AiClient.isConfigured(aiConfig || {})) {
      console.error("ยังไม่ได้ตั้งค่า AI สำหรับ verdictMode=llm — สร้างไฟล์ " + baseline.CONFIG_PATH + " (ดู research/eval/README.md) หรือรันด้วย --verdict-mode rule");
      process.exit(1);
    }
  }

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    process.stdout.write(`${i + 1}/${cases.length} ${cases[i].id}... `);
    const r = await lib.runCase(cases[i], ruleSet, documentNames, documentTypesById, { OcrClient, AiClient }, { verdictMode, aiConfig });
    results.push(r);
    console.log(r.predictedStatus +
      (r.ocrErrors ? " (OCR error " + r.ocrErrors + " ไฟล์)" : "") +
      (r.llmVerdict && r.llmVerdict.error ? " (LLM error: " + r.llmVerdict.error + ")" : ""));
  }

  const pairs = results.map((r) => ({ expected: r.expected, predicted: r.predictedStatus }));
  // pass/fail เป็นตัวหลัก (LLM ตอบได้แค่ 2 แบบ); แบบ 4 ผลเก็บไว้ใน JSON สำหรับโหมด rule
  const binaryMetrics = lib.computeBinaryMetrics(pairs);
  const metrics = evalLib.computeMetrics(pairs);
  const ocrErrorCases = results.filter((r) => r.ocrErrors).length;

  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(outDir, `${path.basename(casesDir)}-${stamp}`);
  const runMeta = {
    ranAt: new Date().toISOString(),
    casesDir: casesDir,
    verdictMode: verdictMode,
    engineVersion: results[0] ? results[0].engineVersion : null,
    ruleSetVersion: ruleSet.versionLabel,
    ocrModel: "OpenThai 2.0 (local, research/ocr/server.py)",
    llmModel: results.find((r) => r.llmModel) ? results.find((r) => r.llmModel).llmModel : null,
    promptVersion: results.find((r) => r.promptVersion) ? results.find((r) => r.promptVersion).promptVersion : null,
  };
  fs.writeFileSync(base + ".json", JSON.stringify({ runMeta, binaryMetrics, metrics, results }, null, 2), "utf8");
  fs.writeFileSync(base + ".csv", lib.resultsToCsv(results), "utf8");

  const pct = (x) => (x == null ? "-" : (x * 100).toFixed(1) + "%");
  const b = binaryMetrics;
  console.log("");
  console.log(`เคสที่นับ: ${b.n}${b.skipped ? ` (ข้าม ${b.skipped}: ไม่มีผลของการเงิน)` : ""}`);
  console.log(`pass/fail ตรงกับการเงิน: ${pct(b.accuracy)} · kappa ${b.kappa == null ? "-" : b.kappa.toFixed(3)}`);
  console.log(`มีปัญหาจริงแต่ปล่อยผ่าน (missed): ${b.missed} · ผ่านจริงแต่ทักผิด (false alarm): ${b.falseAlarm}`);
  if (verdictMode === "rule") console.log(`4 ผล (rule engine) ตรงกับการเงิน: ${pct(metrics.accuracy)} (${metrics.correct}/${metrics.n})`);
  if (ocrErrorCases) console.log(`คำเตือน: ${ocrErrorCases} เคสมีไฟล์ที่ OCR อ่านไม่สำเร็จ — ดูคอลัมน์ ocrErrors`);
  console.log(`บันทึกผลที่ ${base}.json และ .csv`);
}

main().catch((err) => { console.error(err); process.exit(1); });
