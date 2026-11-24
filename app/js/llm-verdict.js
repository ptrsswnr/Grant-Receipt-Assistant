// ─────────────────────────────────────────────────────────────
// js/llm-verdict.js — verdictMode: 'llm' — ให้ LLM เป็นผู้ตัดสินผล pass/fail เองทั้งหมด จากผล OCR
// ดิบ + ระเบียบของแหล่งทุนปัจจุบัน (แปลงเป็นข้อความมีรหัสอ้างอิงต่อข้อ) เท่านั้น ไม่ใช้ความรู้อื่น
// ต่างจาก js/rule-engine.js (verdictMode: 'rule', เปรียบเทียบตัวเลขล้วน ไม่มี AI) และ
// js/receipt-check-agent.js (Level 2 — อธิบายผลของ rule-engine เท่านั้น ไม่ตัดสินเอง)
// เรียก AI ผ่าน js/ai-client.js ตัวเดียวกับทั้งระบบ — temperature: 0 เสมอ ตามข้อกำหนด
// ใช้ได้ทั้งเบราว์เซอร์ (window.LlmVerdict) และ Node (require) เพื่อให้ batch runner (Stage B) เรียกซ้ำได้
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LlmVerdict = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  // เพิ่มเลขนี้ทุกครั้งที่แก้ข้อความ prompt — บันทึกไว้กับทุกผลตรวจ เพื่อย้อนดูว่าผลแต่ละใบมาจาก prompt เวอร์ชันไหน
  var PROMPT_VERSION = "1.1.0";

  function money(n) {
    return typeof n === "number" && isFinite(n) ? n.toLocaleString("en-US") + " บาท" : "-";
  }

  // แปลงกฎ (ruleItems ของเวอร์ชันที่ active) เป็นข้อความอ้างอิงมีรหัสต่อข้อในวงเล็บ — ใช้ id จริงของ
  // ruleItem/evidenceChain ใน Firestore เป็นรหัสอ้างอิงตรงๆ (ไม่ให้ LLM เดาเลขเอง) เพื่อให้ rule_refs
  // ที่ LLM ตอบกลับมาอ้างอิงกลับไปยังข้อมูลจริงได้เสมอ
  function rulesAsText(ruleSet, documentNames) {
    documentNames = documentNames || {};
    var lines = [];
    lines.push("ระเบียบของแหล่งทุนนี้ (รหัสในวงเล็บเหลี่ยมคือรหัสอ้างอิง — ใช้รหัสนี้เท่านั้นใน rule_refs ห้ามสร้างรหัสเอง):");
    (ruleSet.ruleItems || []).forEach(function (r) {
      var rate = r.rateType === "ตามข้อเสนอโครงการ"
        ? "ไม่มีเพดานกลาง ใช้ยอดในประมาณการที่อนุมัติแล้วเป็นเพดาน"
        : r.rateType + " " + money(r.rateAmount) + (r.unit ? " ต่อ " + r.unit : " ต่อครั้ง");
      lines.push("[" + r.id + "] " + r.categoryName + ": " + rate + (r.note ? " — หมายเหตุ: " + r.note : ""));
    });
    lines.push("");
    lines.push("ชุดเอกสารที่ต้องแนบต่อหมวด (ขั้นที่มีเอกสารหลายแบบ แนบอย่างใดอย่างหนึ่งก็พอ; \"ไม่บังคับ\" ไม่ทำให้ผิด):");
    Object.keys(ruleSet.evidenceChains || {}).forEach(function (id) {
      var c = ruleSet.evidenceChains[id];
      lines.push("[" + id + "] " + (c.chainName || id) + ":");
      (c.steps || []).forEach(function (s) {
        lines.push("  - " + (s.required ? "บังคับ" : "ไม่บังคับ") + ": " +
          (s.documentTypeIds || []).map(function (did) { return documentNames[did] || did; }).join(" หรือ "));
      });
      (c.conditionalSteps || []).forEach(function (cs) {
        lines.push("  - บังคับเมื่อยอดเกิน " + money(cs.when && cs.when.value) + ": " +
          ((cs.addStep && cs.addStep.documentTypeIds) || []).map(function (did) { return documentNames[did] || did; }).join(" หรือ "));
      });
      (c.attestations || []).forEach(function (a) { lines.push("  - ต้องยืนยัน: " + a.text); });
    });
    return lines.join("\n");
  }

  // ประมาณการที่อนุมัติแล้วของโครงการเป็นข้อมูลดิบ — ไม่ใส่ผลเทียบของ rule engine (เกิน/ไม่อยู่ในประมาณการ)
  // เพื่อให้ LLM เลือกรายการและตัดสินเอง ไม่ใช่ลอกคำตอบของ rule engine
  // estimate: [{ id, group, itemName, multiplierText, total, spentBefore }] — spentBefore ไม่รวมใบนี้
  function estimateAsText(estimate) {
    if (!estimate || !estimate.length) return "ประมาณการของโครงการ: (ไม่มีข้อมูล)";
    var lines = ["ประมาณการที่อนุมัติแล้วของโครงการนี้ (รหัสในวงเล็บเหลี่ยมคือรหัสรายการ; \"เบิกไปแล้ว\" ไม่รวมใบเสร็จนี้):"];
    estimate.forEach(function (l) {
      var spent = typeof l.spentBefore === "number" ? l.spentBefore : 0;
      lines.push("[" + l.id + "] " + (l.group ? l.group + " / " : "") + l.itemName +
        (l.multiplierText ? " (ตัวคูณ: " + l.multiplierText + ")" : "") +
        ": ตั้งไว้ " + money(l.total) + ", เบิกไปแล้ว " + money(spent) +
        ", คงเหลือ " + money(typeof l.total === "number" ? l.total - spent : null));
    });
    lines.push("ค่าใช้จ่ายทุกรายการต้องเป็นไปตามประมาณการที่อนุมัติแล้ว: ใบเสร็จที่ไม่อยู่ในรายการใดของประมาณการ หรือทำให้ยอดเบิกสะสมของรายการเกินยอดที่ตั้งไว้ ต้องชี้แจงเหตุผลและขออนุมัติ (ถือว่า fail) — ระบุรหัสรายการที่ใช้เทียบไว้ใน issues หรือ recommendation");
    return lines.join("\n");
  }

  // extra: { category, amount, estimate } — ข้อมูลที่ระบบอ่านได้จากใบเสร็จ (ไม่ใช่ที่ผู้ใช้แก้ไขเอง ตามข้อ 1)
  // และประมาณการของโครงการ (ต้องมีก่อนอัปโหลดใบเสร็จได้ — ดู js/new-receipt.js)
  function buildPrompt(ocrText, ruleSet, documentNames, extra) {
    extra = extra || {};
    var parts = [
      "คุณคือผู้ช่วยตรวจใบเสร็จค่าใช้จ่ายโครงการวิจัยของมหาวิทยาลัย ตัดสินผลจากระเบียบและประมาณการที่ให้ไว้ด้านล่างเท่านั้น",
      "ห้ามใช้ความรู้อื่นนอกเหนือจากนี้ และห้ามอ้างอิงระเบียบข้อที่ไม่อยู่ในรายการ",
      "",
      rulesAsText(ruleSet, documentNames),
      "",
      estimateAsText(extra.estimate),
      "",
      "ข้อมูลที่ระบบอ่านได้จากใบเสร็จ/เอกสารแนบ:",
      "- หมวดค่าใช้จ่าย: " + (extra.category || "(อ่านไม่ได้)"),
      "- ยอดเงิน: " + money(extra.amount),
      "",
      "ข้อความที่อ่านได้ด้วย OCR จากไฟล์ที่แนบทั้งหมด (อาจมีจุดที่ OCR ไม่มั่นใจ ใช้วิจารณญาณ):",
      ocrText || "(ไม่มีข้อความ OCR — ไม่ได้แนบไฟล์หรือ OCR อ่านไม่สำเร็จ)",
      "",
      "ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ตามโครงสร้างนี้:",
      '{"verdict": "pass" หรือ "fail", "issues": [{"type": "...", "description": "..."}], ' +
        '"rule_refs": ["<รหัสอ้างอิงในวงเล็บเหลี่ยมด้านบนเท่านั้น>"], "recommendation": "คำแนะนำวิธีแก้เป็นภาษาไทย"}',
    ];
    return parts.join("\n");
  }

  // คืน { verdict, issues, rule_refs, recommendation, raw, model, promptVersion, durationMs, error }
  // ไม่ throw — เรียกไม่สำเร็จ/parse ไม่ได้ ให้ error เป็น string แล้วปล่อยให้ผู้เรียก fallback ไป
  // verdictMode: 'rule' เอง (เก็บผลดิบนี้ไว้เสมอไม่ว่าจะสำเร็จหรือไม่ ตามข้อ 1 "ห้ามทิ้ง")
  async function evaluateWithLlm(ocrText, ruleSet, documentNames, extra, opts) {
    opts = opts || {};
    var AiClient = opts.aiClient || (root && root.AiClient) || (typeof require === "function" ? require("./ai-client.js") : null);
    var started = Date.now();
    var prompt = buildPrompt(ocrText, ruleSet, documentNames, extra);
    if (!AiClient) {
      return { verdict: null, issues: [], rule_refs: [], recommendation: "", raw: null, model: null, promptVersion: PROMPT_VERSION, durationMs: 0, error: "ไม่พบ AiClient" };
    }
    try {
      var text = await AiClient.chat([{ role: "user", content: prompt }], { config: opts.config, temperature: 0, fetchImpl: opts.fetchImpl });
      var parsed = AiClient.extractJson(text);
      var verdict = parsed.verdict === "pass" || parsed.verdict === "fail" ? parsed.verdict : null;
      return {
        verdict: verdict,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        rule_refs: Array.isArray(parsed.rule_refs) ? parsed.rule_refs : [],
        recommendation: parsed.recommendation || "",
        raw: text,
        model: AiClient.modelName(opts.config, false),
        promptVersion: PROMPT_VERSION,
        durationMs: Date.now() - started,
        error: verdict ? null : "LLM ไม่ตอบ verdict เป็น pass/fail: " + text.slice(0, 200),
      };
    } catch (err) {
      return { verdict: null, issues: [], rule_refs: [], recommendation: "", raw: null, model: null, promptVersion: PROMPT_VERSION, durationMs: Date.now() - started, error: err.message };
    }
  }

  return { PROMPT_VERSION: PROMPT_VERSION, rulesAsText: rulesAsText, estimateAsText: estimateAsText, buildPrompt: buildPrompt, evaluateWithLlm: evaluateWithLlm };
});
