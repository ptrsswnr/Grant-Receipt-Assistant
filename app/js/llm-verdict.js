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
  var PROMPT_VERSION = "1.3.0";

  function ruleEngine() {
    if (root && root.RuleEngine) return root.RuleEngine;
    try { return typeof require === "function" ? require("./rule-engine.js") : null; } catch (e) { return null; }
  }

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
      lines.push("[" + r.id + "] " + r.categoryName + ": " + rate + (r.averaging === false ? " — ห้ามถัวเฉลี่ยกับรายการอื่นในหมวด" : "") + (r.note ? " — หมายเหตุ: " + r.note : ""));
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
  function estimateAsText(estimate, ruleSet, amount) {
    if (!estimate || !estimate.length) return "ประมาณการของโครงการ: (ไม่มีข้อมูล)";
    var lines = ["ประมาณการที่อนุมัติแล้วของโครงการนี้ (รหัสในวงเล็บเหลี่ยมคือรหัสรายการ; \"เบิกไปแล้ว\" ไม่รวมใบเสร็จนี้):"];
    var groups = [];
    estimate.forEach(function (l) {
      var name = l.group || "";
      var g = groups.filter(function (x) { return x.name === name; })[0];
      if (!g) groups.push(g = { name: name, total: 0, spent: 0 });
      g.total += typeof l.total === "number" ? l.total : 0;
      g.spent += typeof l.spentBefore === "number" ? l.spentBefore : 0;
    });
    var RE = ruleEngine();
    var facts = {};
    (RE && RE.budgetFacts ? RE.budgetFacts(estimate, ruleSet || {}, amount) : []).forEach(function (f) { facts[f.id] = f; });
    estimate.forEach(function (l) {
      var spent = typeof l.spentBefore === "number" ? l.spentBefore : 0;
      var f = facts[l.id];
      // ตัวเลขที่ระบบคำนวณให้ (ไม่ใช่ผลตัดสิน) — LLM ไม่ต้องบวกเอง
      var factText = f ? " | ถ้าใบนี้อยู่ในรายการนี้: รายการรวมใบนี้ " + money(f.lineAfter) + " จากที่ตั้งไว้ " + money(f.lineTotal) +
        (f.lineAfter > f.lineTotal ? " (เกินรายการ " + money(Math.round((f.lineAfter - f.lineTotal) * 100) / 100) + ")" : " (ไม่เกินรายการ)") +
        ", หมวดรวมใบนี้ " + money(f.groupAfter) + " จากที่ตั้งไว้ " + money(f.groupTotal) +
        (f.groupAfter > f.groupTotal ? " (เกินหมวด)" : " (ไม่เกินหมวด)") +
        ", " + (f.groupAverages ? "หมวดนี้ถัวได้" : "หมวดนี้ถัวไม่ได้") + ", " + (f.lineAverages ? "รายการนี้ถัวได้" : "รายการนี้ห้ามถัว") : "";
      lines.push("[" + l.id + "] " + (l.group ? l.group + " / " : "") + l.itemName +
        (l.multiplierText ? " (ตัวคูณ: " + l.multiplierText + ")" : "") +
        ": ตั้งไว้ " + money(l.total) + ", เบิกไปแล้ว " + money(spent) +
        ", คงเหลือ " + money(typeof l.total === "number" ? l.total - spent : null) + factText);
    });
    if (groups.some(function (g) { return g.name; })) {
      lines.push("ยอดรวมรายหมวด:");
      groups.forEach(function (g) {
        if (g.name) lines.push("- " + g.name + ": ตั้งไว้ " + money(g.total) + ", เบิกไปแล้ว " + money(g.spent) + ", คงเหลือ " + money(g.total - g.spent));
      });
    }
    lines.push("ค่าใช้จ่ายทุกรายการต้องเป็นไปตามประมาณการที่อนุมัติแล้ว: ใบเสร็จที่ไม่อยู่ในรายการใดของประมาณการ ต้องชี้แจงเหตุผลและขออนุมัติ (ถือว่า fail)");
    lines.push("การถัวเฉลี่ยภายในหมวด: ใช้เงินเกินรายการได้ไม่ต้องชี้แจง ถ้าหมวดถัวได้ รายการถัวได้ และยอดรวมของหมวดไม่เกิน (หมวดค่าตอบแทน/ค่าจ้าง และครุภัณฑ์ถัวไม่ได้ รายการที่ห้ามถัวต้องไม่เกินยอดของตัวเอง)");
    lines.push("");
    lines.push("ขั้นตอนตรวจประมาณการ ทำก่อนตัดสินและกรอกผลใน budget_check:");
    lines.push("1) เลือกรายการในประมาณการที่ใบเสร็จนี้ตรงที่สุด ถ้าไม่ตรงรายการใดเลย result = \"not_in_estimate\"");
    lines.push("2) ใช้ตัวเลข \"ถ้าใบนี้อยู่ในรายการนี้\" ของรายการนั้นตามที่ให้ไว้ด้านบน ห้ามคำนวณเอง");
    lines.push("3) ไม่เกินรายการ → result = \"within\"");
    lines.push("4) เกินรายการ แต่หมวดถัวได้ รายการถัวได้ และไม่เกินหมวด → result = \"averaged\" (ถัวจ่ายในหมวด ไม่ใช่ปัญหา ห้ามเขียนว่าเกินประมาณการใน issues)");
    lines.push("5) กรณีอื่นที่เกินรายการ → result = \"over\"");
    lines.push("ผล within และ averaged ไม่ทำให้ fail ส่วน over และ not_in_estimate ทำให้ fail (ต้องชี้แจงเหตุผลและขออนุมัติ)");
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
      estimateAsText(extra.estimate, ruleSet, extra.amount),
      "",
      "ข้อมูลที่ระบบอ่านได้จากใบเสร็จ/เอกสารแนบ:",
      "- หมวดค่าใช้จ่าย: " + (extra.category || "(อ่านไม่ได้)"),
      "- ยอดเงิน: " + money(extra.amount),
      "",
      "ข้อความที่อ่านได้ด้วย OCR จากไฟล์ที่แนบทั้งหมด (อาจมีจุดที่ OCR ไม่มั่นใจ ใช้วิจารณญาณ):",
      ocrText || "(ไม่มีข้อความ OCR — ไม่ได้แนบไฟล์หรือ OCR อ่านไม่สำเร็จ)",
      "",
      "ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ตามโครงสร้างนี้:",
      '{"budget_check": {"line_id": "<รหัสรายการ หรือ null>", "line_total_after": <ตัวเลข|null>, "line_budget": <ตัวเลข|null>, ' +
        '"group_total_after": <ตัวเลข|null>, "group_budget": <ตัวเลข|null>, "averaging_allowed": true หรือ false, ' +
        '"result": "within" หรือ "averaged" หรือ "over" หรือ "not_in_estimate"}, ' +
        '"verdict": "pass" หรือ "fail", "issues": [{"type": "...", "description": "..."}], ' +
        '"rule_refs": ["<รหัสอ้างอิงในวงเล็บเหลี่ยมด้านบนเท่านั้น>"], "recommendation": "คำแนะนำวิธีแก้เป็นภาษาไทย"}',
    ];
    return parts.join("\n");
  }

  var BUDGET_RESULTS = ["within", "averaged", "over", "not_in_estimate"];
  function cleanBudgetCheck(b) {
    if (!b || typeof b !== "object") return null;
    var num = function (v) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(/[,s฿บาท]/g, "")); return isFinite(n) ? n : null; };
    return {
      line_id: b.line_id ? String(b.line_id) : null,
      line_total_after: num(b.line_total_after), line_budget: num(b.line_budget),
      group_total_after: num(b.group_total_after), group_budget: num(b.group_budget),
      averaging_allowed: b.averaging_allowed === true,
      result: BUDGET_RESULTS.indexOf(b.result) !== -1 ? b.result : null,
    };
  }

  // คืน { verdict, issues, rule_refs, recommendation, budget_check, raw, model, promptVersion, durationMs, error }
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
        budget_check: cleanBudgetCheck(parsed.budget_check),
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
