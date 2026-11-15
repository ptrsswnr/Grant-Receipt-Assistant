// ─────────────────────────────────────────────────────────────
// research/eval/baseline.js — ตัวเปรียบเทียบ "AI ตัดสินเองล้วน" (LLM-only baseline)
// ให้ AI อ่านกฎชุดเดียวกับ rule engine (จาก app/js/data.js) ในรูปข้อความ แล้วตัดสินเคสเองโดยไม่มี
// rule engine ช่วย — ใช้พิสูจน์ในวิทยานิพนธ์ว่า "กฎตัดสิน AI แค่อธิบาย" ดีกว่าให้ AI ตัดสินเองหรือไม่
// เรียก AI ผ่าน app/js/ai-client.js ตัวเดียวกับเว็บ — ตั้งค่าใน research/eval/ai-config.local.json
// ─────────────────────────────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");
const AiClient = require("../../app/js/ai-client.js");
const { LABELS } = require("./lib.js");

const CONFIG_PATH = path.join(__dirname, "ai-config.local.json");

function loadAiConfig() {
  if (process.env.AI_CONFIG_JSON) return JSON.parse(process.env.AI_CONFIG_JSON);
  if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  return null;
}

function money(n) {
  return n == null ? "-" : Number(n).toLocaleString("en-US") + " บาท";
}

// กฎทั้งชุดเป็นข้อความ — ใส่ทุกข้อเหมือนกันทุกเคส เพื่อให้ AI มีข้อมูลเท่ากับ rule engine
function rulesAsText(data, ruleSet) {
  const docName = Object.fromEntries(data.documentTypes.map((d) => [d.id, d.documentName]));
  const lines = [];
  lines.push("ผลตัดสินมี 4 แบบ (เรียงจากเบาไปหนัก ใบเสร็จได้ผลที่หนักที่สุดที่เจอ):");
  lines.push("- ผ่าน: อยู่ในประมาณการ ไม่เกินอัตราตามระเบียบ และเอกสารครบ");
  lines.push("- ต้องแก้ไข: เกินเพดาน/อัตราตามระเบียบ หรือเอกสาร/ตราประทับไม่ครบ หรือยอดเงินไม่ถูกต้อง หรือยอดที่ลงในใบสรุปรายรับ-จ่ายไม่ตรงกับใบเสร็จ");
  lines.push("- ต้องชี้แจง/ขออนุมัติ: ไม่อยู่ในประมาณการที่อนุมัติ หรือยอดสะสมของรายการเกินยอดที่ตั้งไว้ในประมาณการ");
  lines.push("- ไม่เข้าเงื่อนไข: หมวดค่าใช้จ่ายนี้ไม่มีในระเบียบ (เบิกไม่ได้)");
  lines.push("");
  lines.push("หมวดค่าใช้จ่ายที่ระเบียบอนุญาต (หมวดที่ไม่อยู่ในรายการนี้ = ไม่เข้าเงื่อนไข):");
  ruleSet.ruleItems.forEach((r) => {
    const rate = r.rateType === "ตามข้อเสนอโครงการ" ? "ไม่มีเพดานกลาง ใช้ยอดในประมาณการเป็นเพดาน"
      : r.rateType + " " + money(r.rateAmount) + (r.unit ? " ต่อ " + r.unit : " ต่อครั้ง");
    lines.push(`- ${r.categoryName}: ${rate}; ชุดเอกสาร ${r.evidenceChainId || "-"}${r.note ? "; หมายเหตุ " + r.note : ""}`);
  });
  lines.push("");
  lines.push("อัตราที่มีหน่วย (ต่อคน/มื้อ/ชั่วโมง/กม./วัน) ให้คูณกับจำนวนหน่วยที่ตั้งไว้ในประมาณการ แล้วเทียบกับยอดสะสมของรายการนั้น");
  lines.push("");
  lines.push("ชุดเอกสารที่ต้องแนบ (ขั้นที่มีหลายเอกสาร แนบอย่างใดอย่างหนึ่งก็ได้; \"ไม่บังคับ\" ไม่ทำให้ผิด):");
  Object.values(ruleSet.evidenceChains).forEach((c) => {
    lines.push(`- ${c.id} (${c.chainName}):`);
    c.steps.forEach((s) => lines.push(`  - ${s.required ? "บังคับ" : "ไม่บังคับ"}: ${s.documentTypeIds.map((id) => docName[id] || id).join(" หรือ ")}`));
    (c.conditionalSteps || []).forEach((cs) => lines.push(`  - บังคับเมื่อยอดเกิน ${money(cs.when.value)}: ${cs.addStep.documentTypeIds.map((id) => docName[id] || id).join(" หรือ ")}`));
    (c.attestations || []).forEach((a) => lines.push(`  - ต้องยืนยัน: ${a.text}`));
  });
  return lines.join("\n");
}

function caseAsText(c, data) {
  const docName = Object.fromEntries(data.documentTypes.map((d) => [d.id, d.documentName]));
  const attText = {};
  data.evidenceChains.forEach((ch) => (ch.attestations || []).forEach((a) => { attText[a.id] = a.text; }));
  const r = c.receipt;
  const lines = [`หมวด: ${r.category}`, `ยอดเงินในใบเสร็จ: ${money(r.amount)}`];
  if (!r.budget) lines.push("ประมาณการ: โครงการยังไม่มีไฟล์ประมาณการในระบบ");
  else if (!r.budget.line) lines.push("ประมาณการ: รายการนี้ไม่อยู่ในประมาณการที่อนุมัติ");
  else {
    const l = r.budget.line;
    lines.push(`ประมาณการ: รายการ "${l.itemName}" ตั้งไว้ ${money(l.total)}${l.quantity ? ` จำนวน ${l.quantity} หน่วย` : ""}; ใช้ไปแล้วก่อนใบนี้ ${money(r.budget.spentBefore)}`);
  }
  if (r.summary) lines.push(`ยอดที่ลงในใบสรุปรายรับ-จ่าย: ${money(r.summary.amount)}`);
  if (!r.evidence) lines.push("เอกสารแนบ: ไม่ได้บันทึก");
  else {
    lines.push("เอกสารที่แนบ: " + (r.evidence.documentTypeIds.map((id) => docName[id] || id).join(", ") || "ไม่มี"));
    lines.push("สิ่งที่ยืนยันแล้วบนเอกสาร: " + (r.evidence.attestationIds.map((id) => attText[id] || id).join(", ") || "ไม่มี"));
  }
  return lines.join("\n");
}

function buildPrompt(c, data, ruleSet) {
  return [
    "คุณคือเจ้าหน้าที่การเงินที่ตรวจใบเสร็จโครงการวิจัย ตัดสินจากกฎด้านล่างเท่านั้น",
    "",
    rulesAsText(data, ruleSet),
    "",
    "ใบเสร็จที่ต้องตัดสิน:",
    caseAsText(c, data),
    "",
    'ตอบเป็น JSON เท่านั้น: {"status": "<ผ่าน|ต้องแก้ไข|ต้องชี้แจง/ขออนุมัติ|ไม่เข้าเงื่อนไข>", "reason": "<เหตุผลสั้นๆ>"}',
  ].join("\n");
}

// คืน { predicted, reason, error, durationMs } — ไม่ throw เพื่อให้เคสอื่นรันต่อได้
async function predict(c, data, ruleSet, config, fetchImpl) {
  const started = Date.now();
  try {
    const text = await AiClient.chat([{ role: "user", content: buildPrompt(c, data, ruleSet) }], { config, temperature: 0, fetchImpl });
    const parsed = AiClient.extractJson(text);
    const predicted = LABELS.includes(parsed.status) ? parsed.status : null;
    return { predicted, reason: parsed.reason || "", error: predicted ? null : "ตอบผลที่ไม่อยู่ใน 4 แบบ: " + parsed.status, durationMs: Date.now() - started };
  } catch (err) {
    return { predicted: null, reason: "", error: err.message, durationMs: Date.now() - started };
  }
}

module.exports = { loadAiConfig, rulesAsText, caseAsText, buildPrompt, predict, CONFIG_PATH };
