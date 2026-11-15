#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// research/eval/run-eval.js — รันชุดประเมินผล: เทียบผลของ rule engine (และ AI ล้วน ถ้าสั่ง) กับผลของการเงิน
//
//   node research/eval/run-eval.js research/eval/cases.example.csv
//   node research/eval/run-eval.js data/cases.csv --baseline          (เรียก AI ทุกเคส = มีค่าใช้จ่ายถ้าใช้ API เสียเงิน)
//   node research/eval/run-eval.js data/cases.csv --show-prompt EX01  (ดู prompt ของ baseline โดยไม่เรียก AI)
//
// ผลลัพธ์: research/eval/output/<ชื่อไฟล์>-<เวลา>.md และ .json (gitignored)
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./lib.js");
const baseline = require("./baseline.js");

function pct(x) {
  return x == null ? "-" : (x * 100).toFixed(1) + "%";
}

function num(x) {
  return x == null ? "-" : x.toFixed(3);
}

function metricsSection(title, m) {
  const out = [`## ${title}`, ""];
  out.push(`- เคสที่นับ: ${m.n}${m.skipped ? ` (ข้าม ${m.skipped} เคส: ไม่มีผลของการเงิน หรือตอบไม่ได้)` : ""}`);
  out.push(`- ตรงกับการเงิน (accuracy): ${pct(m.accuracy)} (${m.correct}/${m.n})`);
  out.push(`- Cohen's kappa: ${num(m.kappa)}`);
  out.push(`- Macro F1: ${num(m.macroF1)}`);
  out.push(`- ใบที่มีปัญหาจริง แต่ระบบปล่อยผ่าน (missed): ${m.flagging.missed}/${m.flagging.actualProblems} → จับปัญหาได้ ${pct(m.flagging.problemRecall)}`);
  out.push(`- ใบที่ผ่านจริง แต่ระบบทักผิด (false alarm): ${m.flagging.falseAlarm}/${m.flagging.actualPasses} → ${pct(m.flagging.falseAlarmRate)}`);
  out.push("", "Confusion matrix (แถว = การเงิน, คอลัมน์ = ระบบ):", "");
  out.push("| การเงิน \\ ระบบ | " + m.labels.join(" | ") + " |");
  out.push("|---|" + m.labels.map(() => "---").join("|") + "|");
  m.matrix.forEach((row, i) => out.push(`| ${m.labels[i]} | ${row.join(" | ")} |`));
  out.push("", "| ผลตัดสิน | จำนวนจริง | precision | recall | F1 |", "|---|---|---|---|---|");
  m.perClass.forEach((c) => out.push(`| ${c.label} | ${c.support} | ${pct(c.precision)} | ${pct(c.recall)} | ${num(c.f1)} |`));
  out.push("");
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--show-prompt");
  if (!file || !fs.existsSync(file)) {
    console.error("ใช้: node research/eval/run-eval.js <ไฟล์เคส.csv> [--baseline] [--show-prompt <case_id>]");
    process.exit(1);
  }
  const { data, ruleSet, documentNames } = lib.loadRuleSet();
  const cases = lib.parseCsv(fs.readFileSync(file, "utf8")).map(lib.caseToReceipt);

  const showIdx = args.indexOf("--show-prompt");
  if (showIdx !== -1) {
    const c = cases.find((x) => x.id === args[showIdx + 1]) || cases[0];
    console.log(baseline.buildPrompt(c, data, ruleSet));
    return;
  }

  const results = cases.map((c) => {
    const r = lib.RuleEngine.evaluate(c.receipt, ruleSet, documentNames);
    return { id: c.id, category: c.receipt.category, amount: c.receipt.amount, expected: c.expected, rawExpected: c.rawExpected, note: c.note,
      engine: { status: r.status, reasonCode: r.reasonCode, autoVerified: r.autoVerified, explanation: r.explanation } };
  });

  const useBaseline = args.includes("--baseline");
  let aiConfig = null;
  if (useBaseline) {
    aiConfig = baseline.loadAiConfig();
    if (!require("../../app/js/ai-client.js").isConfigured(aiConfig || {})) {
      console.error("ยังไม่ได้ตั้งค่า AI สำหรับ baseline — สร้างไฟล์ " + baseline.CONFIG_PATH + " (ดู research/eval/README.md)");
      process.exit(1);
    }
    for (let i = 0; i < cases.length; i++) {
      process.stdout.write(`baseline ${i + 1}/${cases.length} ${cases[i].id}... `);
      results[i].baseline = await baseline.predict(cases[i], data, ruleSet, aiConfig);
      console.log(results[i].baseline.predicted || "ผิดพลาด: " + results[i].baseline.error);
    }
  }

  const engineMetrics = lib.computeMetrics(results.map((r) => ({ expected: r.expected, predicted: r.engine.status })));
  const baselineMetrics = useBaseline ? lib.computeMetrics(results.map((r) => ({ expected: r.expected, predicted: r.baseline.predicted }))) : null;

  const md = [
    `# ผลประเมิน: ${path.basename(file)}`, "",
    `- วันที่รัน: ${new Date().toISOString()}`,
    `- Rule engine: ${lib.RuleEngine.ENGINE_VERSION}, ชุดกฎ ${ruleSet.versionLabel}`,
    useBaseline ? `- AI ล้วน (baseline): ${require("../../app/js/ai-client.js").describe(aiConfig)}` : "- AI ล้วน (baseline): ไม่ได้รัน (เพิ่ม --baseline)",
    "",
    ...metricsSection("Rule engine (กฎตัดสิน)", engineMetrics),
  ];
  if (baselineMetrics) md.push(...metricsSection("AI ล้วน (LLM-only baseline)", baselineMetrics));

  md.push("## เคสที่ไม่ตรงกับการเงิน", "");
  md.push("| เคส | หมวด | ยอด | การเงิน | Rule engine | reasonCode |" + (useBaseline ? " AI ล้วน |" : "") + " หมายเหตุการเงิน |");
  md.push("|---|---|---|---|---|---|" + (useBaseline ? "---|" : "") + "---|");
  results.filter((r) => r.expected !== r.engine.status || (useBaseline && r.expected !== r.baseline.predicted)).forEach((r) => {
    md.push(`| ${r.id} | ${r.category} | ${r.amount} | ${r.rawExpected || "-"} | ${r.engine.status} | ${r.engine.reasonCode} |` +
      (useBaseline ? ` ${r.baseline.predicted || "ผิดพลาด"} |` : "") + ` ${(r.note || "").replace(/\|/g, "/")} |`);
  });
  md.push("");

  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(outDir, `${path.basename(file, ".csv")}-${stamp}`);
  fs.writeFileSync(base + ".md", md.join("\n"), "utf8");
  fs.writeFileSync(base + ".json", JSON.stringify({ file, engineVersion: lib.RuleEngine.ENGINE_VERSION, ruleSet: ruleSet.versionLabel, engineMetrics, baselineMetrics, results }, null, 2), "utf8");

  console.log(md.join("\n"));
  console.log(`\nบันทึกผลที่ ${base}.md และ .json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
