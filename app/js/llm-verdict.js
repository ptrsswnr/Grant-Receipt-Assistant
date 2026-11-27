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
  var PROMPT_VERSION = "1.7.0";

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
  var CONDITION_OPS = {
    ">": function (a, b) { return a > b; }, ">=": function (a, b) { return a >= b; },
    "<": function (a, b) { return a < b; }, "<=": function (a, b) { return a <= b; },
  };

  // เงื่อนไขของ conditionalSteps (ยอดเงิน หรือวันที่ในใบเสร็จ) — ใช้ตรรกะเดียวกับ rule engine ถ้าโหลดได้
  function conditionFor(when, receipt) {
    var RE = ruleEngine();
    if (RE && RE.conditionApplies) return RE.conditionApplies(when, { amount: receipt.amount, date: receipt.date });
    var op = CONDITION_OPS[when && when.op];
    return { applies: !!(op && typeof receipt.amount === "number" && when.field === "amount" && op(receipt.amount, when.value)), assumed: false };
  }
  function conditionText(when) {
    var RE = ruleEngine();
    if (RE && RE.describeCondition) return RE.describeCondition(when);
    return "ยอด " + (when && when.op) + " " + money(when && when.value);
  }
  function receiptFactText(when, receipt) {
    if (when && when.field === "date") return receipt.date ? "ใบนี้ลงวันที่ " + receipt.date : "อ่านวันที่ในใบนี้ไม่ได้";
    return "ใบนี้ยอด " + money(receipt.amount);
  }

  function docList(ids, documentNames) {
    return (ids || []).map(function (did) { return documentNames[did] || did; }).join(" หรือ ");
  }

  // ชุดเอกสารของหมวดของใบนี้ชุดเดียว (prompt 1.5.0) — prompt 1.4.0 ส่งทุกชุด แล้วโมเดลหยิบเอกสารข้ามชุด
  // และขอเอกสารตามเงื่อนไขยอดเงินที่ยอดไม่ถึง จึงบอกไว้เลยว่าเงื่อนไขแต่ละข้อ "ใช้/ไม่ใช้" กับยอดนี้
  // (เป็นข้อเท็จจริงจากการเทียบตัวเลข ไม่ใช่ผลตัดสินว่าแนบครบหรือไม่ — อันนั้นโมเดลตัดสินเองจาก OCR)
  function chainForReceiptText(ruleSet, documentNames, receipt) {
    var item = (ruleSet.ruleItems || []).filter(function (r) {
      return r.categoryName === receipt.category && r.isActive !== false;
    })[0];
    var chainId = item && item.evidenceChainId;
    var c = chainId && ruleSet.evidenceChains ? ruleSet.evidenceChains[chainId] : null;
    if (!c) return "ชุดเอกสารของหมวดนี้: (ไม่มีชุดเอกสารกำหนดไว้สำหรับหมวด \"" + (receipt.category || "-") + "\")";
    var lines = ["ชุดเอกสารของหมวดนี้ [" + chainId + "] " + (c.chainName || chainId) + " — ใช้ชุดนี้ชุดเดียว ห้ามขอเอกสารนอกรายการนี้:"];
    var required = (c.steps || []).filter(function (s) { return s.required; });
    var optional = (c.steps || []).filter(function (s) { return !s.required; });
    lines.push("เอกสารบังคับ (ต้องพบทุกข้อ ข้อที่มีหลายแบบ พบแบบใดแบบหนึ่งก็พอ):");
    required.forEach(function (s, i) {
      lines.push("  " + (i + 1) + ") " + docList(s.documentTypeIds, documentNames) + (s.timing === "before" ? " (ต้องได้ก่อนดำเนินการ)" : ""));
    });
    var n = required.length;
    (c.conditionalSteps || []).forEach(function (cs) {
      var cond = conditionFor(cs.when, receipt);
      var names = docList(cs.addStep && cs.addStep.documentTypeIds, documentNames);
      if (cond.applies) {
        n += 1;
        lines.push("  " + n + ") " + names + " (บังคับเฉพาะ" + conditionText(cs.when) + " — " + receiptFactText(cs.when, receipt) +
          (cond.assumed ? " จึงถือว่าต้องมี" : " จึงต้องมี") + ")");
      } else {
        lines.push("ไม่ต้องใช้กับใบนี้ (ห้ามใส่ใน required/missing): " + names + " — ใช้เฉพาะ" + conditionText(cs.when) +
          " แต่" + receiptFactText(cs.when, receipt));
      }
    });
    if (optional.length) {
      lines.push("เอกสารไม่บังคับ (ไม่มีก็ไม่ผิด): " + optional.map(function (s) { return docList(s.documentTypeIds, documentNames); }).join("; "));
    }
    if ((c.attestations || []).length) {
      lines.push("ตราประทับ/ข้อความรับรองที่ต้องพบบนเอกสาร:");
      c.attestations.forEach(function (a, i) {
        var kws = attestationKeywords(a.text);
        lines.push("  " + (i + 1) + ") " + a.text + (kws.length ? " — คำหลัก: " + kws.map(function (k) { return "\"" + k + "\""; }).join(" หรือ ") : ""));
      });
    }
    return lines.join("\n");
  }

  // receipt (ไม่บังคับ): { category, amount, date } — ถ้าให้มา จะแสดงเฉพาะชุดเอกสารของหมวดนั้น (prompt 1.5.0)
  function rulesAsText(ruleSet, documentNames, receipt) {
    documentNames = documentNames || {};
    var lines = [];
    lines.push("ระเบียบของแหล่งทุนนี้ (รหัสในวงเล็บเหลี่ยมคือรหัสอ้างอิง — ใช้รหัสนี้เท่านั้นใน rule_refs ห้ามสร้างรหัสเอง):");
    (ruleSet.ruleItems || []).forEach(function (r) {
      var rate = r.rateType === "ตามข้อเสนอโครงการ"
        ? "ไม่มีเพดานกลาง ใช้ยอดในประมาณการที่อนุมัติแล้วเป็นเพดาน"
        : r.rateType + " " + money(r.rateAmount) + (r.unit ? " ต่อ " + r.unit : " ต่อครั้ง");
      lines.push("[" + r.id + "] " + r.categoryName + ": " + rate + (r.averaging === false ? " — ห้ามถัวเฉลี่ยกับรายการอื่นในหมวด" : "") +
        (r.evidenceChainId ? " — ชุดเอกสาร [" + r.evidenceChainId + "]" : "") + (r.note ? " — หมายเหตุ: " + r.note : ""));
    });
    lines.push("");
    if (receipt) {
      lines.push(chainForReceiptText(ruleSet, documentNames, receipt));
      return lines.join("\n");
    }
    lines.push("ชุดเอกสารที่ต้องแนบต่อหมวด (ขั้นที่มีเอกสารหลายแบบ แนบอย่างใดอย่างหนึ่งก็พอ; \"ไม่บังคับ\" ไม่ทำให้ผิด):");
    Object.keys(ruleSet.evidenceChains || {}).forEach(function (id) {
      var c = ruleSet.evidenceChains[id];
      lines.push("[" + id + "] " + (c.chainName || id) + ":");
      (c.steps || []).forEach(function (s) {
        lines.push("  - " + (s.required ? "บังคับ" : "ไม่บังคับ") + ": " +
          (s.documentTypeIds || []).map(function (did) { return documentNames[did] || did; }).join(" หรือ "));
      });
      (c.conditionalSteps || []).forEach(function (cs) {
        lines.push("  - บังคับเมื่อ" + conditionText(cs.when) + ": " +
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
    return lines.join("\n");
  }

  // เช็กลิสต์ (prompt 1.4.0 มี 4 ข้อ; 1.6.0 เพิ่มข้อ 5 ชื่อโครงการ; 1.7.0 เพิ่มข้อ 6 ระยะเวลาสัญญา) — ให้ LLM ตรวจและกรอกผลทีละข้อก่อนตัดสิน เพราะ prompt 1.3.0 ที่มีแค่ขั้นตอน
  // ประมาณการ ทำให้โมเดล (ทั้ง gemini และ qwen3) ตรวจแค่ประมาณการแล้วตอบ pass ข้ามเรื่องเพดานและเอกสาร
  function checklistText() {
    return [
      "ตรวจตามเช็กลิสต์ 6 ข้อด้านล่างให้ครบทุกข้อ กรอกผลของแต่ละข้อใน JSON ก่อน แล้วจึงตัดสิน verdict",
      "ข้อ 1 ประมาณการ (budget_check):",
      "  1) เลือกรายการในประมาณการที่ใบเสร็จนี้ตรงที่สุด ถ้าไม่ตรงรายการใดเลย result = \"not_in_estimate\"",
      "  2) ใช้ตัวเลข \"ถ้าใบนี้อยู่ในรายการนี้\" ของรายการนั้นตามที่ให้ไว้ด้านบน ห้ามคำนวณเอง",
      "  3) กรอก averaging_allowed = true เมื่อ \"หมวดนี้ถัวได้\" และ \"รายการนี้ถัวได้\" ทั้งคู่ แล้วเลือก result ตามตารางนี้ตามลำดับ:",
      "     ก. line_total_after ≤ line_budget → \"within\"",
      "     ข. line_total_after > line_budget และ averaging_allowed = true และ group_total_after ≤ group_budget → \"averaged\" (ถัวจ่ายในหมวด ไม่ใช่ปัญหา)",
      "     ค. นอกนั้น → \"over\"",
      "ข้อ 2 เพดานตามระเบียบ (cap_check) — เป็นคนละเรื่องกับข้อ 1: แม้ประมาณการจะถัวได้ ใบเสร็จก็ต้องไม่เกินเพดานต่อครั้งของระเบียบ",
      "  - หาระเบียบของหมวดค่าใช้จ่ายของใบนี้ ถ้าไม่มีระเบียบของหมวดนี้ → \"not_in_rules\"",
      "  - ต้องกรอก cap_check.result ทุกครั้ง ห้ามเป็น null",
      "  - ถ้าเป็นเพดาน \"ต่อครั้ง\" (เพดานตามจริงหรือเหมาจ่ายที่ไม่มีหน่วย): ยอดใบเสร็จมากกว่าเพดาน → \"over\", ไม่เกิน → \"within\"",
      "  - ถ้าเพดานมีหน่วย (ต่อคน ต่อมื้อ ต่อคืน ต่อวัน ต่อกม. ต่อชม.) หรือเป็น \"ไม่มีเพดานกลาง\" → \"not_applicable\" (ข้อ 1 ตรวจแทนแล้ว)",
      "ข้อ 3 เอกสารแนบ (documents_check):",
      "  - required = เอกสารบังคับตาม \"ชุดเอกสารของหมวดนี้\" ด้านบนเท่านั้น (ข้อที่มีหลายแบบ นับเป็นหนึ่งรายการ) ห้ามเพิ่มเอกสารอื่น",
      "  - แต่ละรายการใน required: ถ้าพบในข้อความ OCR ใส่ใน found พร้อม quote = ข้อความ OCR ที่เป็นหลักฐาน (คัดลอกมาตรงๆ); ถ้าหาไม่พบ ใส่ใน missing",
      "  - missing ว่าง → \"complete\", มีเอกสารขาด → \"missing\"",
      "ข้อ 4 ตราประทับ/การรับรอง (attestations_check):",
      "  - required = ตราประทับ/ข้อความรับรองของชุดเอกสารนี้ทุกข้อ แล้วค้นข้อความของแต่ละตราในข้อความ OCR ทีละบรรทัด",
      "  - พบ → ใส่ใน found พร้อม quote = บรรทัด OCR ที่พบ (คัดลอกมาตรงๆ); ไม่พบ → ใส่ใน missing",
      "  - missing ว่าง → \"complete\", มีที่ขาด → \"missing\"",
      "ข้อความ OCR ภาษาไทยมักสะกดเพี้ยน เช่น วรรณยุกต์/สระหาย (\"ที่\" เป็น \"ที\") หรืออ่านคำผิด (\"แล้ว\" เป็น \"มล้อ\")",
      "  ถ้าบรรทัดใดมีความหมายตรงกับเอกสารที่ต้องการ แม้สะกดเพี้ยน ให้นับว่าพบ และยกบรรทัดนั้นมาเป็น quote",
      "  สำหรับตราประทับ: แต่ละตรามี \"คำหลัก\" กำกับไว้ในรายการตราด้านบน quote ต้องมีคำหลักอย่างน้อยหนึ่งคำของตรานั้น (คำอื่นในบรรทัดเดียวกันจะเพี้ยนหรือขาดไปก็ได้)",
      "  ตรวจซ้ำก่อนใส่ใน found: ทุกพยางค์ของคำหลักที่ใช้ต้องอยู่ใน quote (สะกดเพี้ยนได้) เช่น \"จ่ายแล้ว\" ต้องมีทั้ง \"จ่าย\" (หรือ \"จาย\") และ \"แล้ว\" (หรือ \"แลว\")",
      "  บรรทัดที่มีแค่บางพยางค์หรือคำทั่วไปที่คล้าย เช่น \"เรียบร้อยแล้ว\" หรือ \"ชำระเงิน\" ไม่นับว่าพบตรานั้น ให้ใส่ใน missing",
      "ข้อ 5 ชื่อโครงการบนหลักฐานการเงิน (project_check):",
      "  - หลักฐานการเงินที่มีช่องชื่อผู้ซื้อ/ลูกค้า ต้องออกในนาม \"ชื่อโครงการ โดย ชื่อหัวหน้าโครงการ\" ใช้ชื่อโครงการแบบย่อได้",
      "  - หาบรรทัด OCR ที่เป็นชื่อผู้ซื้อหรือชื่อโครงการบนเอกสาร ใส่ใน quote (คัดลอกมาตรงๆ) แล้วเทียบกับ \"ชื่อโครงการ\" ด้านบน",
      "  - เป็นโครงการเดียวกัน (ชื่อเต็ม ชื่อย่อ หรือส่วนหนึ่งของชื่อ) → \"match\"; เป็นชื่อโครงการอื่น → \"mismatch\"",
      "  - ชื่อย่อต้องประกอบด้วยคำที่อยู่ในชื่อโครงการด้านบน ถ้าคำในเอกสารแทบไม่มีอยู่ในชื่อโครงการด้านบนเลย → \"mismatch\" (ห้ามเดาว่าเป็นโครงการเดียวกันเพราะเป็นงานวิจัยเหมือนกัน)",
      "  - ไม่มีบรรทัดชื่อผู้ซื้อ/ชื่อโครงการในเอกสารเลย → \"not_found\" (ไม่ถือว่าผิด)",
      "ข้อ 6 ระยะเวลาสัญญา (period_check):",
      "  - วันที่ในใบเสร็จต้องอยู่ในระยะเวลาสัญญาของโครงการด้านบน (นับวันเริ่มและวันสิ้นสุดด้วย)",
      "  - receipt_date = วันที่ในใบเสร็จแบบ ค.ศ. YYYY-MM-DD (ใช้ \"วันที่ในใบเสร็จ\" ด้านบน ถ้าอ่านไม่ได้ให้หาจากข้อความ OCR; ปี พ.ศ. ให้ลบ 543)",
      "  - อยู่ในช่วง → \"within\"; ก่อนวันเริ่มหรือหลังวันสิ้นสุด → \"outside\"; ไม่มีวันที่หรือไม่มีระยะเวลาสัญญา → \"unknown\" (ไม่ถือว่าผิด)",
      "ตัดสิน: verdict = \"pass\" ก็ต่อเมื่อ ข้อ 1 เป็น within หรือ averaged, ข้อ 2 เป็น within หรือ not_applicable, ข้อ 3 และข้อ 4 เป็น complete, ข้อ 5 ไม่ใช่ mismatch และข้อ 6 ไม่ใช่ outside",
      "ข้อใดไม่ผ่าน → verdict = \"fail\" และเขียน issues ข้อละหนึ่งรายการต่อทุกข้อที่ไม่ผ่าน (ห้ามเขียนว่าเกินประมาณการเมื่อข้อ 1 เป็น averaged)",
      "issues: type ใช้ชื่อข้อที่ไม่ผ่าน (budget_check, cap_check, documents_check, attestations_check, project_check, period_check)",
      "recommendation: บอกวิธีแก้ตามระเบียบเท่านั้น (แนบเอกสาร/ขอประทับตราที่ขาด, ยอดเกินเพดานให้เบิกไม่เกินเพดานหรือชี้แจงขออนุมัติ, ชื่อโครงการไม่ตรงให้ตรวจว่าอัปโหลดถูกโครงการหรือขอให้ผู้ขายแก้ชื่อผู้ซื้อ, นอกระยะเวลาสัญญาให้ตรวจวันที่ในใบเสร็จ เพราะเบิกได้เฉพาะค่าใช้จ่ายในระยะเวลาสัญญา)",
      "  ห้ามแนะนำให้เปลี่ยนหมวดค่าใช้จ่ายเพื่อเลี่ยงเพดาน — หมวดต้องตรงกับสิ่งที่ซื้อจริง",
    ].join("\n");
  }

  // extra: { category, amount, date, projectName, contract: { start, end } (ISO), estimate } — ข้อมูลที่ระบบอ่านได้จากใบเสร็จ (ไม่ใช่ที่ผู้ใช้แก้ไขเอง ตามข้อ 1)
  // และประมาณการของโครงการ (ต้องมีก่อนอัปโหลดใบเสร็จได้ — ดู js/new-receipt.js)
  function isoDay(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? m[0] : null;
  }
  function contractText(contract) {
    var start = isoDay(contract && contract.start), end = isoDay(contract && contract.end);
    if (!start || !end) return "(โครงการยังไม่ได้กรอก)";
    return start + " ถึง " + end + (contract.extensionCount ? " (ขยายเวลาแล้ว " + contract.extensionCount + " ครั้ง จากเดิมสิ้นสุด " + contract.originalEnd + ")" : "");
  }

  function buildPrompt(ocrText, ruleSet, documentNames, extra) {
    extra = extra || {};
    var parts = [
      "คุณคือผู้ช่วยตรวจใบเสร็จค่าใช้จ่ายโครงการวิจัยของมหาวิทยาลัย ตัดสินผลจากระเบียบและประมาณการที่ให้ไว้ด้านล่างเท่านั้น",
      "ห้ามใช้ความรู้อื่นนอกเหนือจากนี้ และห้ามอ้างอิงระเบียบข้อที่ไม่อยู่ในรายการ",
      "",
      rulesAsText(ruleSet, documentNames, { category: extra.category, amount: extra.amount, date: extra.date }),
      "",
      estimateAsText(extra.estimate, ruleSet, extra.amount),
      "",
      "ข้อมูลที่ระบบอ่านได้จากใบเสร็จ/เอกสารแนบ:",
      "- หมวดค่าใช้จ่าย: " + (extra.category || "(อ่านไม่ได้)"),
      "- ยอดเงิน: " + money(extra.amount),
      "- วันที่ในใบเสร็จ: " + (extra.date || "(อ่านไม่ได้)"),
      "",
      "โครงการที่อัปโหลดใบเสร็จนี้:",
      "- ชื่อโครงการ: " + (extra.projectName || "(ไม่ทราบ)"),
      "- ระยะเวลาสัญญา: " + contractText(extra.contract),
      "",
      "ข้อความที่อ่านได้ด้วย OCR จากไฟล์ที่แนบทั้งหมด (อาจมีจุดที่ OCR ไม่มั่นใจ ใช้วิจารณญาณ):",
      ocrText || "(ไม่มีข้อความ OCR — ไม่ได้แนบไฟล์หรือ OCR อ่านไม่สำเร็จ)",
      "",
      checklistText(),
      "",
      "ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ตามโครงสร้างนี้:",
      '{"budget_check": {"line_id": "<รหัสรายการ หรือ null>", "line_total_after": <ตัวเลข|null>, "line_budget": <ตัวเลข|null>, ' +
        '"group_total_after": <ตัวเลข|null>, "group_budget": <ตัวเลข|null>, "averaging_allowed": true หรือ false, ' +
        '"result": "within" หรือ "averaged" หรือ "over" หรือ "not_in_estimate"}, ' +
        '"cap_check": {"rule_ref": "<รหัสระเบียบ หรือ null>", "cap": <ตัวเลข|null>, "unit": "<หน่วยของเพดาน หรือ null>", "amount": <ตัวเลข|null>, ' +
        '"result": "within" หรือ "over" หรือ "not_applicable" หรือ "not_in_rules"}, ' +
        '"documents_check": {"required": ["<ชื่อเอกสาร>"], "found": [{"name": "<ชื่อเอกสาร>", "quote": "<ข้อความ OCR>"}], "missing": ["<ชื่อเอกสาร>"], "result": "complete" หรือ "missing"}, ' +
        '"attestations_check": {"required": ["<ตรา>"], "found": [{"name": "<ตรา>", "quote": "<บรรทัด OCR>"}], "missing": ["<ตรา>"], "result": "complete" หรือ "missing"}, ' +
        '"project_check": {"quote": "<บรรทัด OCR ชื่อผู้ซื้อ/ชื่อโครงการ หรือ null>", "result": "match" หรือ "mismatch" หรือ "not_found"}, ' +
        '"period_check": {"receipt_date": "<YYYY-MM-DD หรือ null>", "result": "within" หรือ "outside" หรือ "unknown"}, ' +
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

  var PROJECT_RESULTS = ["match", "mismatch", "not_found"];
  function cleanProjectCheck(c) {
    if (!c || typeof c !== "object") return null;
    return { quote: c.quote != null && c.quote !== "" ? String(c.quote) : null, result: PROJECT_RESULTS.indexOf(c.result) !== -1 ? c.result : null };
  }

  var PERIOD_RESULTS = ["within", "outside", "unknown"];
  function cleanPeriodCheck(c) {
    if (!c || typeof c !== "object") return null;
    return { receipt_date: isoDay(c.receipt_date), result: PERIOD_RESULTS.indexOf(c.result) !== -1 ? c.result : null };
  }

  var CAP_RESULTS = ["within", "over", "not_applicable", "not_in_rules"];
  var COMPLETENESS_RESULTS = ["complete", "missing"];
  function strList(v) {
    return Array.isArray(v) ? v.filter(function (x) { return x != null && x !== ""; }).map(String) : [];
  }
  function cleanCapCheck(c) {
    if (!c || typeof c !== "object") return null;
    var n = typeof c.cap === "number" ? c.cap : parseFloat(String(c.cap == null ? "" : c.cap).replace(/[^0-9.]/g, ""));
    var a = typeof c.amount === "number" ? c.amount : parseFloat(String(c.amount == null ? "" : c.amount).replace(/[^0-9.]/g, ""));
    return {
      rule_ref: c.rule_ref ? String(c.rule_ref) : null,
      cap: isFinite(n) ? n : null, unit: c.unit ? String(c.unit) : null, amount: isFinite(a) ? a : null,
      result: CAP_RESULTS.indexOf(c.result) !== -1 ? c.result : null,
    };
  }
  function cleanCompleteness(c) {
    if (!c || typeof c !== "object") return null;
    var missing = strList(c.missing);
    var result = COMPLETENESS_RESULTS.indexOf(c.result) !== -1 ? c.result : null;
    // มีรายการใน missing แต่ตอบ complete ถือว่าขาด (คำตอบขัดกันเอง ยึดรายการที่ระบุไว้)
    if (missing.length && result === "complete") result = "missing";
    return { required: strList(c.required), found: foundList(c.found), missing: missing, result: result };
  }

  // found: [{ name, quote }] (prompt 1.5.0) — รับแบบสตริงล้วนของ prompt เก่าด้วย (quote = null)
  function foundList(v) {
    if (!Array.isArray(v)) return [];
    return v.filter(function (x) { return x != null && x !== ""; }).map(function (x) {
      if (typeof x === "object") return { name: x.name != null ? String(x.name) : "", quote: x.quote != null && x.quote !== "" ? String(x.quote) : null };
      return { name: String(x), quote: null };
    });
  }

  // ข้อในเช็กลิสต์ที่ LLM ตอบเองว่าไม่ผ่าน (ผลที่ไม่รู้จัก/null ไม่นับ) — ใช้ตรวจว่า verdict ขัดกับเช็กลิสต์ของมันเองไหม
  function failedChecks(checks) {
    var failed = [];
    if (checks.budget_check && (checks.budget_check.result === "over" || checks.budget_check.result === "not_in_estimate")) failed.push("budget_check");
    if (checks.cap_check && (checks.cap_check.result === "over" || checks.cap_check.result === "not_in_rules")) failed.push("cap_check");
    if (checks.documents_check && checks.documents_check.result === "missing") failed.push("documents_check");
    if (checks.attestations_check && checks.attestations_check.result === "missing") failed.push("attestations_check");
    if (checks.project_check && checks.project_check.result === "mismatch") failed.push("project_check");
    if (checks.period_check && checks.period_check.result === "outside") failed.push("period_check");
    return failed;
  }

  // ─── ตรวจหลักฐานของตราประทับ (1.5.3) ───
  // prompt 1.5.0–1.5.2 ให้โมเดลยก quote เป็นหลักฐาน แต่โมเดลยังนับบรรทัดที่ไม่ใช่ตรา "จ่ายแล้ว" ว่าพบตรา
  // ("…(E-TAX) เรียบร้อยแอ้ว", "พนักงานเขาย") ทุกรอบ แม้สั่งในข้อความแล้ว — จึงตรวจว่า quote ที่โมเดลอ้าง
  // มีคำหลักของตรานั้นจริง (เทียบโครงพยัญชนะ ไม่สนสระ/วรรณยุกต์ เพราะ OCR ภาษาไทยมักทำหาย)
  // ทำได้แค่ย้าย found → missing (ตัดหลักฐานที่ไม่ตรง) ไม่เคยเพิ่มตราที่โมเดลไม่ได้อ้าง และไม่ใช้ผลของ
  // ตัวจับคำสำคัญ/rule engine — ผลก่อนตรวจเก็บไว้ใน attestations_rejected เพื่อนับความผิดพลาดของโมเดลในงานวิจัย
  function consonantSkeleton(text) {
    return String(text || "").replace(/[^ก-ฮ]/g, "");
  }
  // คำหลักของตรา = คำในเครื่องหมายคำพูดของข้อความตรา (ส่วนก่อน "..." ถ้ามี) เช่น "จ่ายแล้ว", "ได้รับพัสดุ"
  function attestationKeywords(text) {
    var out = [];
    String(text || "").replace(/["“]([^"”]+)["”]/g, function (m, k) {
      var kw = k.split("...")[0].trim();
      if (kw) out.push(kw);
      return m;
    });
    return out;
  }
  function chainAttestations(ruleSet, category) {
    var item = (ruleSet.ruleItems || []).filter(function (r) { return r.categoryName === category && r.isActive !== false; })[0];
    var chain = item && item.evidenceChainId && ruleSet.evidenceChains ? ruleSet.evidenceChains[item.evidenceChainId] : null;
    return (chain && chain.attestations) || [];
  }
  function guardAttestationEvidence(check, attestations) {
    if (!check || !attestations.length) return { check: check, rejected: [] };
    var defs = attestations.map(function (a) {
      return { text: a.text, skeletons: attestationKeywords(a.text).map(consonantSkeleton).filter(Boolean) };
    }).filter(function (d) { return d.skeletons.length; });
    var kept = [], rejected = [], missing = check.missing.slice();
    check.found.forEach(function (f) {
      var nameSk = consonantSkeleton(f.name);
      var def = defs.filter(function (d) {
        return d.skeletons.some(function (s) { return nameSk.indexOf(s) !== -1; }) || consonantSkeleton(d.text) === nameSk;
      })[0];
      if (!def) { kept.push(f); return; }
      var quoteSk = consonantSkeleton(f.quote);
      if (def.skeletons.some(function (s) { return quoteSk.indexOf(s) !== -1; })) { kept.push(f); return; }
      rejected.push(f);
      if (missing.indexOf(f.name) === -1) missing.push(f.name);
    });
    if (!rejected.length) return { check: check, rejected: [] };
    return { check: { required: check.required, found: kept, missing: missing, result: "missing" }, rejected: rejected };
  }

  // ─── ตรวจหลักฐานชื่อโครงการ (1.6.1) ───
  // 1.6.0 โมเดลตอบ "match" ทั้งที่ quote ของมันเองเป็นชื่อโครงการอื่นทั้งเรื่อง จึงเทียบ quote ที่โมเดลยกมา
  // กับชื่อโครงการด้วยฟังก์ชันเทียบชื่อของ rule-engine (โครงพยัญชนะ + สัดส่วน bigram — ใช้แค่เทียบข้อความ ไม่ได้
  // ใช้ผลตัดสินของ rule engine) — ทำได้แค่เปลี่ยน match → mismatch จาก quote ที่โมเดลอ้างเอง ผลเดิมเก็บใน project_rejected
  function guardProjectEvidence(check, projectName) {
    if (!check || check.result !== "match" || !check.quote || !projectName) return { check: check, rejected: null };
    var RE = ruleEngine();
    if (!RE || !RE.projectNameMatches) return { check: check, rejected: null };
    var named = String(check.quote).replace(/\(OCR ไม่มั่นใจ[^)]*\)/g, "").split(/\sโดย(\s|$)/)[0];
    if (RE.projectNameMatches(named, projectName)) return { check: check, rejected: null };
    return { check: { quote: check.quote, result: "mismatch" }, rejected: { quote: check.quote, result: "match" } };
  }

  // ─── ตรวจวันที่กับระยะเวลาสัญญา (1.7.0) ───
  // เทียบวันที่ที่โมเดลกรอกเองใน receipt_date กับระยะเวลาสัญญาที่ให้ไว้ใน prompt — โมเดลตอบ "within" ทั้งที่วันที่
  // ของมันเองอยู่นอกช่วง → "outside" (ผลเดิมเก็บใน period_rejected) ทำได้ทางเดียวเหมือน guard อื่น ไม่ใช้ผล rule engine
  function guardPeriodEvidence(check, contract) {
    var start = isoDay(contract && contract.start), end = isoDay(contract && contract.end);
    if (!check || check.result !== "within" || !check.receipt_date || !start || !end) return { check: check, rejected: null };
    if (check.receipt_date >= start && check.receipt_date <= end) return { check: check, rejected: null };
    return { check: { receipt_date: check.receipt_date, result: "outside" }, rejected: { receipt_date: check.receipt_date, result: "within" } };
  }

  // คืน { verdict, verdict_reported, failed_checks, issues, rule_refs, recommendation, budget_check, cap_check,
  //       documents_check, attestations_check, raw, model, promptVersion, durationMs, error }
  // verdict: ถ้า LLM ตอบ pass แต่เช็กลิสต์ของมันเองมีข้อไม่ผ่าน จะเปลี่ยนเป็น fail (ยึดผลรายข้อของ LLM เอง
  // ไม่ได้ใช้ผลของ rule engine) — verdict_reported เก็บคำตอบเดิมของ LLM ไว้ใช้วิเคราะห์ในงานวิจัย
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
      var reported = parsed.verdict === "pass" || parsed.verdict === "fail" ? parsed.verdict : null;
      var checks = {
        budget_check: cleanBudgetCheck(parsed.budget_check),
        cap_check: cleanCapCheck(parsed.cap_check),
        documents_check: cleanCompleteness(parsed.documents_check),
        attestations_check: cleanCompleteness(parsed.attestations_check),
        project_check: cleanProjectCheck(parsed.project_check),
        period_check: cleanPeriodCheck(parsed.period_check),
      };
      var guarded = guardAttestationEvidence(checks.attestations_check, chainAttestations(ruleSet || {}, extra && extra.category));
      checks.attestations_check = guarded.check;
      var projectGuard = guardProjectEvidence(checks.project_check, extra && extra.projectName);
      checks.project_check = projectGuard.check;
      var periodGuard = guardPeriodEvidence(checks.period_check, extra && extra.contract);
      checks.period_check = periodGuard.check;
      var issues = Array.isArray(parsed.issues) ? parsed.issues.slice() : [];
      if (projectGuard.rejected) {
        issues.push({ type: "project_check", description: "ชื่อโครงการในเอกสาร (\"" + projectGuard.rejected.quote + "\") ไม่ตรงกับโครงการ \"" + extra.projectName +
          "\" กรุณาตรวจว่าอัปโหลดเข้าโครงการถูกต้อง หรือขอให้ผู้ขายแก้ชื่อผู้ซื้อเป็นชื่อโครงการ โดย ชื่อหัวหน้าโครงการ" });
      }
      if (periodGuard.rejected) {
        issues.push({ type: "period_check", description: "ใบเสร็จลงวันที่ " + periodGuard.rejected.receipt_date + " อยู่นอกระยะเวลาสัญญา (" +
          contractText(extra.contract) + ") เบิกได้เฉพาะค่าใช้จ่ายในระยะเวลาสัญญา" });
      }
      guarded.rejected.forEach(function (f) {
        // ข้อความถึงผู้ใช้บอกแค่ว่าขาดตรา — หลักฐานที่ AI อ้างผิดเก็บไว้ใน attestations_rejected สำหรับงานวิจัย
        issues.push({ type: "missing_stamp", description: "ไม่พบตรา \"" + f.name + "\" บนเอกสาร กรุณาขอประทับตราให้ครบ" });
      });
      var failed = failedChecks(checks);
      var verdict = reported === "pass" && failed.length ? "fail" : reported;
      return {
        verdict: verdict,
        verdict_reported: reported,
        failed_checks: failed,
        attestations_rejected: guarded.rejected,
        issues: issues,
        rule_refs: Array.isArray(parsed.rule_refs) ? parsed.rule_refs : [],
        recommendation: parsed.recommendation || "",
        budget_check: checks.budget_check,
        cap_check: checks.cap_check,
        documents_check: checks.documents_check,
        attestations_check: checks.attestations_check,
        project_check: checks.project_check,
        project_rejected: projectGuard.rejected,
        period_check: checks.period_check,
        period_rejected: periodGuard.rejected,
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

  // ผล LLM ในรูปที่บันทึกลง Firestore (receipt.llmVerdict) — ใช้ร่วมกันทุกหน้าที่บันทึกผล (อัปโหลด, นำเข้าไฟล์สแกน, ตรวจใหม่)
  function record(llm) {
    if (!llm) return null;
    return {
      verdict: llm.verdict, verdict_reported: llm.verdict_reported || null, failed_checks: llm.failed_checks || [],
      attestations_rejected: llm.attestations_rejected || [],
      issues: llm.issues, rule_refs: llm.rule_refs, recommendation: llm.recommendation,
      budget_check: llm.budget_check || null, cap_check: llm.cap_check || null,
      documents_check: llm.documents_check || null, attestations_check: llm.attestations_check || null,
      project_check: llm.project_check || null, project_rejected: llm.project_rejected || null,
      period_check: llm.period_check || null, period_rejected: llm.period_rejected || null,
      raw: llm.raw, model: llm.model, promptVersion: llm.promptVersion, durationMs: llm.durationMs, error: llm.error,
    };
  }

  return { PROMPT_VERSION: PROMPT_VERSION, record: record, rulesAsText: rulesAsText, estimateAsText: estimateAsText, buildPrompt: buildPrompt, evaluateWithLlm: evaluateWithLlm };
});
