// ─────────────────────────────────────────────────────────────
// js/rule-engine.js — Rule Engine แบบ pure function (ไม่แตะ Firestore/DOM/เครือข่าย)
// ตัดสิน ผ่าน/ต้องแก้ไข/ไม่เข้าเงื่อนไข จากข้อมูลใบเสร็จ + ชุดกฎ (ruleSet) ที่ผู้เรียกโหลดมาให้เอง
// ผลลัพธ์เดียวกันทุกครั้งเมื่อ input เดียวกัน — ใช้ได้ทั้งในเบราว์เซอร์ (window.RuleEngine) และ Node
// (require) เพื่อให้ evaluation harness รันกับใบเสร็จย้อนหลังแบบ offline ได้โดยไม่ต้องเปิดแอป
// LLM ไม่มีส่วนในการตัดสินที่นี่ — ดู js/receipt-check-agent.js สำหรับชั้นอธิบายผล
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RuleEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  // เพิ่มเลขนี้ทุกครั้งที่ตรรกะการตัดสินเปลี่ยน — บันทึกลงใบเสร็จทุกใบ เพื่อให้รู้ว่าผลแต่ละใบมาจากตรรกะชุดไหน
  var ENGINE_VERSION = "1.8.0";

  var STATUS = { PASS: "ผ่าน", FIX: "ต้องแก้ไข", APPROVAL: "ต้องชี้แจง/ขออนุมัติ", REJECT: "ไม่เข้าเงื่อนไข" };

  var REASON = {
    NO_FUND_SOURCE: "NO_FUND_SOURCE",
    NO_ACTIVE_RULE_VERSION: "NO_ACTIVE_RULE_VERSION",
    CATEGORY_NOT_IN_RULES: "CATEGORY_NOT_IN_RULES",
    INVALID_AMOUNT: "INVALID_AMOUNT",
    SUMMARY_AMOUNT_MISMATCH: "SUMMARY_AMOUNT_MISMATCH",
    SUMMARY_MATCHES: "SUMMARY_MATCHES",
    AMOUNT_EXCEEDS_CAP: "AMOUNT_EXCEEDS_CAP",
    WITHIN_CAP: "WITHIN_CAP",
    NO_FIXED_CAP: "NO_FIXED_CAP",
    MISSING_EVIDENCE: "MISSING_EVIDENCE",
    MISSING_ATTESTATION: "MISSING_ATTESTATION",
    EVIDENCE_NOT_CHECKED: "EVIDENCE_NOT_CHECKED",
    PER_UNIT_CAP_VIA_ESTIMATE: "PER_UNIT_CAP_VIA_ESTIMATE",
    NOT_IN_ESTIMATE: "NOT_IN_ESTIMATE",
    OVER_ESTIMATE: "OVER_ESTIMATE",
    WITHIN_ESTIMATE: "WITHIN_ESTIMATE",
    AVERAGED_WITHIN_GROUP: "AVERAGED_WITHIN_GROUP",
    ESTIMATE_NOT_CHECKED: "ESTIMATE_NOT_CHECKED",
    OVER_RATE_ALLOWANCE: "OVER_RATE_ALLOWANCE",
    WITHIN_RATE_ALLOWANCE: "WITHIN_RATE_ALLOWANCE",
    PER_PROPOSAL_VIA_ESTIMATE: "PER_PROPOSAL_VIA_ESTIMATE",
    FUND_SOURCE_INACTIVE: "FUND_SOURCE_INACTIVE",
    PROJECT_NAME_MATCHES: "PROJECT_NAME_MATCHES",
    PROJECT_NAME_MISMATCH: "PROJECT_NAME_MISMATCH",
    WITHIN_CONTRACT_PERIOD: "WITHIN_CONTRACT_PERIOD",
    OUTSIDE_CONTRACT_PERIOD: "OUTSIDE_CONTRACT_PERIOD",
    CONTRACT_PERIOD_NOT_CHECKED: "CONTRACT_PERIOD_NOT_CHECKED",
  };

  var CAPPED_RATE_TYPES = ["เพดานตามจริง", "เหมาจ่าย"];

  // ruleItem เก่า (ก่อน 2026-09-10) มีแค่ { categoryName, maxAmount } — ถือเป็น "เพดานตามจริง"
  function normalizeRuleItem(item) {
    return {
      id: item.id || null,
      categoryName: item.categoryName,
      rateType: item.rateType || "เพดานตามจริง",
      rateAmount: item.rateAmount != null ? item.rateAmount : (item.maxAmount != null ? item.maxAmount : null),
      unit: item.unit || null,
      note: item.note || null,
      evidenceChainId: item.evidenceChainId || null,
      // false = ห้ามถัวเฉลี่ยกับรายการอื่นในหมวด (รายการที่ระเบียบกำหนดเป็น % เช่น ค่าเดินทาง ค่าจ้างเหมาบริการ)
      averaging: item.averaging !== false,
    };
  }

  function formatCurrency(amount) {
    if (typeof amount !== "number") return "-";
    return "฿" + amount.toLocaleString("th-TH", { minimumFractionDigits: 2 });
  }

  function withNote(text, item) {
    return item && item.note ? text + " หมายเหตุ: " + item.note : text;
  }

  function rateText(item) {
    return formatCurrency(item.rateAmount) + (item.unit ? " / " + item.unit : "");
  }

  // กฎที่แอดมินปิดใช้งานแล้ว (isActive === false) ไม่ใช้ตรวจใบเสร็จใหม่ แต่ยังเก็บไว้ให้ย้อนตรวจใบเก่าได้
  function findRuleItem(category, ruleSet) {
    var raw = ruleSet && (ruleSet.ruleItems || []).filter(function (ri) {
      return ri.categoryName === category && ri.isActive !== false;
    })[0];
    return raw ? normalizeRuleItem(raw) : null;
  }

  var CONDITION_OPS = {
    ">": function (a, b) { return a > b; },
    ">=": function (a, b) { return a >= b; },
    "<": function (a, b) { return a < b; },
    "<=": function (a, b) { return a <= b; },
  };

  var THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  function thaiDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? parseInt(m[3], 10) + " " + THAI_MONTHS[parseInt(m[2], 10) - 1] + " " + (parseInt(m[1], 10) + 543) : String(iso);
  }
  function isoDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? m[0] : null;
  }

  // เงื่อนไขของ conditionalSteps: field "amount" (ยอดใบเสร็จ) หรือ "date" (วันที่ในใบเสร็จ, ISO YYYY-MM-DD)
  // คืน { applies, assumed } — อ่านวันที่ไม่ได้ ถือว่าเข้าเงื่อนไข (assumed: true) เพื่อไม่ให้เอกสารที่อาจต้องมีหลุดไป
  // ยอดอ่านไม่ได้ ไม่เข้าเงื่อนไข (เหมือนเดิม — ยอดที่ไม่ถูกต้องเป็น INVALID_AMOUNT อยู่แล้ว)
  function conditionApplies(when, facts) {
    var op = CONDITION_OPS[when && when.op];
    if (!op) return { applies: false, assumed: false };
    if (when.field === "date") {
      var d = isoDate(facts.date);
      if (!d) return { applies: true, assumed: true };
      return { applies: op(d, String(when.value)), assumed: false };
    }
    var value = when.field === "amount" ? facts.amount : undefined;
    return { applies: typeof value === "number" && op(value, when.value), assumed: false };
  }

  // ข้อความภาษาไทยของเงื่อนไข เช่น "ยอดเกิน ฿100,000.00", "ใบเสร็จลงวันที่ตั้งแต่ 22 เม.ย. 2569"
  function describeCondition(when) {
    if (!when) return "";
    if (when.field === "date") {
      var word = { ">=": "ตั้งแต่", ">": "หลัง", "<": "ก่อน", "<=": "ไม่หลัง" }[when.op] || when.op;
      return "ใบเสร็จลงวันที่" + word + " " + thaiDate(when.value);
    }
    var aw = { ">": "เกิน", ">=": "ตั้งแต่", "<": "ต่ำกว่า", "<=": "ไม่เกิน" }[when.op] || when.op;
    return "ยอด" + aw + " " + formatCurrency(when.value);
  }

  // ชุดเอกสารที่หมวดนี้ต้องมี (รวม conditionalSteps ที่เข้าเงื่อนไขของใบเสร็จนี้แล้ว) — ใช้ทั้งตอนตรวจ
  // และตอนสร้าง checklist ในหน้าจอ เพื่อให้สองที่ใช้ตรรกะชุดเดียวกัน
  // facts: { amount, date } หรือตัวเลขยอดอย่างเดียว (แบบเดิม — ไม่มีวันที่ ถือว่าเข้าเงื่อนไขวันที่)
  // คืน null ถ้าหมวดนี้ไม่มีกฎหรือไม่ได้ผูกชุดเอกสารไว้
  function requiredEvidence(category, facts, ruleSet) {
    if (typeof facts !== "object" || facts === null) facts = { amount: facts };
    var item = findRuleItem(category, ruleSet);
    var chain = item && item.evidenceChainId && ruleSet.evidenceChains ? ruleSet.evidenceChains[item.evidenceChainId] : null;
    if (!chain) return null;

    var steps = (chain.steps || []).map(function (s) {
      return { order: s.order, timing: s.timing || "with", required: !!s.required, documentTypeIds: s.documentTypeIds || [], note: s.note || null };
    });
    (chain.conditionalSteps || []).forEach(function (cs, i) {
      var c = conditionApplies(cs.when, facts);
      if (c.applies) {
        var note = cs.addStep.note || null;
        if (c.assumed) note = (note ? note + " " : "") + "(อ่านวันที่ในใบเสร็จไม่ได้ จึงถือว่าต้องแนบ)";
        steps.push({ order: cs.addStep.order || 100 + i, timing: cs.addStep.timing || "with", required: true, documentTypeIds: cs.addStep.documentTypeIds || [], note: note, conditional: true });
      }
    });
    steps.sort(function (a, b) { return a.order - b.order; });

    return {
      evidenceChainId: item.evidenceChainId,
      chainName: chain.chainName || item.evidenceChainId,
      steps: steps,
      attestations: (chain.attestations || []).map(function (a) { return { id: a.id, text: a.text }; }),
    };
  }

  // provided: { documentTypeIds: [...], attestationIds: [...] } — ตอนนี้มาจาก checklist ที่นักวิจัยติ๊กเอง
  // ภายหลังจะมาจาก OCR จำแนกประเภทเอกสารอัตโนมัติก็ได้ โดยไม่ต้องแก้ฟังก์ชันนี้
  function checkEvidence(required, provided) {
    var have = provided.documentTypeIds || [];
    var confirmed = provided.attestationIds || [];
    return {
      missingSteps: required.steps.filter(function (s) {
        return s.required && !s.documentTypeIds.some(function (id) { return have.indexOf(id) !== -1; });
      }),
      missingAttestations: required.attestations.filter(function (a) { return confirmed.indexOf(a.id) === -1; }),
    };
  }

  // ความรุนแรงของผล — ผลรวมของใบเสร็จคือ finding ที่รุนแรงที่สุด
  var SEVERITY = {};
  SEVERITY[STATUS.PASS] = 0;
  SEVERITY[STATUS.FIX] = 1;
  SEVERITY[STATUS.APPROVAL] = 2;
  SEVERITY[STATUS.REJECT] = 3;

  // ประมาณการก่อน แล้วจึงระเบียบ แล้วจึงเอกสาร (ลำดับเดียวกับที่เจ้าหน้าที่การเงินตรวจจริง) — ถ้ารุนแรงเท่ากัน
  // finding ของกลุ่มที่มาก่อนเป็นเหตุผลหลัก
  // ระยะเวลาสัญญามาก่อนสุด — ใบเสร็จนอกสัญญาเบิกไม่ได้ ไม่ว่าเรื่องอื่นจะถูกหรือไม่ (engine 1.8.0)
  var GROUP_ORDER = ["period", "budget", "regulation", "summary", "project", "evidence"];

  // ยอดที่นักวิจัยลงไว้ใน "สรุปรายรับ-จ่ายเงินโครงการ" (บันทึกรายรับ-จ่าย, คู่มือฉบับปรับปรุง หน้า 2–4)
  // ต้องตรงกับยอดในใบเสร็จ — การเงินเจอตัวเลขไม่ตรงกันบ่อย ไม่กรอก = ไม่ตรวจข้อนี้
  function checkSummary(receipt) {
    var summary = receipt.summary;
    if (!summary || typeof summary.amount !== "number" || !isFinite(summary.amount)) return [];
    var diff = Math.round((summary.amount - receipt.amount) * 100) / 100;
    if (Math.abs(diff) >= 0.01) {
      return [{
        group: "summary", status: STATUS.FIX, code: REASON.SUMMARY_AMOUNT_MISMATCH,
        message: "ยอดที่ลงในใบสรุปรายรับ-จ่าย (" + formatCurrency(summary.amount) + ") ไม่ตรงกับยอดในใบเสร็จ (" +
          formatCurrency(receipt.amount) + ") ต่างกัน " + formatCurrency(Math.abs(diff)) + " กรุณาแก้ตัวเลขในใบสรุปให้ตรงกับใบเสร็จ",
        summaryAmount: summary.amount,
      }];
    }
    return [{ group: "summary", status: STATUS.PASS, code: REASON.SUMMARY_MATCHES, message: "ยอดในใบสรุปรายรับ-จ่ายตรงกับใบเสร็จ" }];
  }

  // ─── ชื่อโครงการบนหลักฐานการเงิน (engine 1.7.0, เจ้าของโครงการ 2026-11-27) ───
  // หลักฐานการเงินที่มีช่องชื่อผู้ซื้อต้องออกในนาม "ชื่อโครงการ โดย ชื่อหัวหน้าโครงการ" (ย่อชื่อโครงการได้)
  // ระบบหาบรรทัดที่น่าจะเป็นชื่อผู้ซื้อ/ชื่อโครงการจากข้อความ OCR แล้วเทียบกับชื่อโครงการที่อัปโหลด
  // ไม่ตรง → ต้องแก้ไข; หาบรรทัดแบบนี้ไม่เจอเลย (เช่น ใบเสร็จไม่มีช่องผู้ซื้อ) → ไม่มี finding ข้อนี้
  // เทียบด้วยโครงพยัญชนะไทย + อักษรละติน/ตัวเลข (OCR มักทำสระ/วรรณยุกต์หาย) และวัดว่าคู่ตัวอักษร (bigram)
  // ของชื่อในเอกสารอยู่ในชื่อโครงการกี่ส่วน — ชื่อย่อเป็นส่วนหนึ่งของชื่อเต็ม จึงยังนับว่าตรง
  function nameSkeleton(text) {
    return String(text || "").toLowerCase()
      .replace(/^[\s(]*(ชื่อ)?\s*โครงการ(วิจัย)?(เรื่อง)?\s*[:：]?/, "")
      .replace(/[^ก-ฮa-z0-9]/g, "");
  }
  function bigrams(text) {
    var out = [];
    for (var i = 0; i + 1 < text.length; i++) out.push(text.slice(i, i + 2));
    return out;
  }
  function containment(part, whole) {
    var bs = bigrams(part);
    if (!bs.length) return 0;
    return bs.filter(function (b) { return whole.indexOf(b) !== -1; }).length / bs.length;
  }
  function projectNameMatches(candidate, projectName) {
    var c = nameSkeleton(candidate), p = nameSkeleton(projectName);
    if (!c || !p) return true;
    return containment(c, p) >= 0.6 || containment(p, c) >= 0.8;
  }
  var NOT_BUYER_BEFORE_BY = /(ชำระ|จ่าย|โอน|ส่ง|ลงชื่อ|ลงนาม|อนุมัติ|รับรอง|ออก|จัดทำ)\s*$/;
  // บรรทัดที่น่าจะเป็นชื่อโครงการ/ชื่อผู้ซื้อ: ขึ้นต้นด้วย "โครงการ..." หรือ "(โครงการ..." หรือมี "ชื่อโครงการ",
  // หรือรูป "<ชื่อ> โดย <ชื่อคน>" — ตัดบรรทัดลายเซ็น (หัวหน้าโครงการ) และ "ชำระโดย/โอนโดย" ทิ้ง
  function projectNameCandidates(ocrText) {
    var out = [];
    String(ocrText || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/\(OCR ไม่มั่นใจ[^)]*\)/g, "").trim();
      if (!line) return;
      if (/^[\s(]*(ชื่อ)?\s*โครงการ/.test(line) || /ชื่อโครงการ/.test(line)) {
        var text = line.slice(line.indexOf("โครงการ")).split(/\sโดย(\s|$)/)[0];
        if (nameSkeleton(text).length >= 6) out.push({ quote: line, name: text });
        return;
      }
      var by = /^(.*\S)\s+โดย(\s|$)/.exec(line);
      if (by && !NOT_BUYER_BEFORE_BY.test(by[1]) && nameSkeleton(by[1]).length >= 6) out.push({ quote: line, name: by[1] });
    });
    return out;
  }
  // ─── วันที่ในใบเสร็จต้องอยู่ในระยะเวลาสัญญา (engine 1.8.0, เจ้าของโครงการ 2026-11-27) ───
  // receipt.contract: { start, end } (ISO YYYY-MM-DD จากเอกสารโครงการ) — ไม่ส่งมา = ไม่ตรวจข้อนี้
  // อยู่นอกสัญญา → ไม่เข้าเงื่อนไข (เบิกไม่ได้ แก้ด้วยการแนบเอกสารเพิ่มไม่ได้)
  // ยังไม่ได้กรอกระยะเวลาสัญญา หรืออ่านวันที่ในใบเสร็จไม่ได้ → แจ้งว่ายังตรวจไม่ได้ (ไม่เปลี่ยนผล แต่ไม่นับว่าตรวจครบ)
  function contractPeriodText(contract) {
    var text = thaiDate(contract.start) + " – " + thaiDate(contract.end);
    if (contract.extensionCount) {
      text += " ขยายเวลาแล้ว " + contract.extensionCount + " ครั้ง จากเดิมสิ้นสุด " + thaiDate(contract.originalEnd);
    }
    return text;
  }

  // ระยะเวลาสัญญาที่ใช้ตรวจจากเอกสารโครงการ — โครงการขอขยายระยะเวลาได้ (contractExtensions: [{ endDate, note, addedAt }])
  // ยึดวันสิ้นสุดของการขยายครั้งล่าสุด (เจ้าของโครงการ 2026-11-27) ไม่มีการขยาย = contractEndDate เดิม
  // คืน { start, end, originalEnd, extensionCount } — ใช้ร่วมกันทุกหน้าที่ตรวจใบเสร็จ
  function contractOf(project) {
    project = project || {};
    var extensions = (project.contractExtensions || []).filter(function (x) { return x && isoDate(x.endDate); });
    var latest = extensions.length ? isoDate(extensions[extensions.length - 1].endDate) : null;
    return {
      start: project.contractStartDate || null,
      end: latest || project.contractEndDate || null,
      originalEnd: project.contractEndDate || null,
      extensionCount: extensions.length,
    };
  }
  function checkContractPeriod(receipt) {
    var contract = receipt.contract;
    if (!contract) return [];
    var start = isoDate(contract.start), end = isoDate(contract.end);
    if (!start || !end) {
      return [{ group: "period", status: STATUS.PASS, code: REASON.CONTRACT_PERIOD_NOT_CHECKED, unverified: true,
        message: "วันที่ในใบเสร็จต้องอยู่ในระยะเวลาสัญญา แต่โครงการนี้ยังไม่ได้กรอกระยะเวลาสัญญา กรุณากรอกที่ปุ่ม \"แก้ไข\" ในหน้าโครงการของฉัน" }];
    }
    var date = isoDate(receipt.date);
    if (!date) {
      return [{ group: "period", status: STATUS.PASS, code: REASON.CONTRACT_PERIOD_NOT_CHECKED, unverified: true,
        message: "อ่านวันที่ในใบเสร็จไม่ได้ จึงยังตรวจไม่ได้ว่าอยู่ในระยะเวลาสัญญา (" + contractPeriodText({ start: start, end: end }) + ") หรือไม่" }];
    }
    var period = { start: start, end: end, originalEnd: contract.originalEnd, extensionCount: contract.extensionCount || 0 };
    if (date < start || date > end) {
      return [{ group: "period", status: STATUS.REJECT, code: REASON.OUTSIDE_CONTRACT_PERIOD,
        message: "ใบเสร็จลงวันที่ " + thaiDate(date) + " อยู่นอกระยะเวลาสัญญาของโครงการ (" + contractPeriodText(period) +
          ") — เบิกได้เฉพาะค่าใช้จ่ายที่เกิดในระยะเวลาสัญญา (ถ้าโครงการได้รับอนุมัติขยายเวลาแล้ว ให้เพิ่มข้อมูลการขยายที่หน้าโครงการของฉัน) กรุณาตรวจว่าวันที่ในใบเสร็จและระยะเวลาสัญญาถูกต้อง" }];
    }
    return [{ group: "period", status: STATUS.PASS, code: REASON.WITHIN_CONTRACT_PERIOD,
      message: "ใบเสร็จลงวันที่ " + thaiDate(date) + " อยู่ในระยะเวลาสัญญา" + (period.extensionCount ? " (รวมการขยายเวลาถึง " + thaiDate(end) + ")" : "") }];
  }

  // receipt.project: { name, ocrText } — ไม่ส่งมา/ไม่มีชื่อ = ไม่ตรวจข้อนี้
  function checkProjectName(receipt) {
    var project = receipt.project;
    if (!project || !project.name || !project.ocrText) return [];
    var candidates = projectNameCandidates(project.ocrText);
    if (!candidates.length) return [];
    var bad = candidates.filter(function (c) { return !projectNameMatches(c.name, project.name); });
    if (bad.length) {
      return [{
        group: "project", status: STATUS.FIX, code: REASON.PROJECT_NAME_MISMATCH,
        message: "ชื่อโครงการในเอกสาร (\"" + bad[0].quote + "\") ไม่ตรงกับโครงการ \"" + project.name + "\" — หลักฐานการเงินต้องออกในนาม " +
          "\"ชื่อโครงการ โดย ชื่อหัวหน้าโครงการ\" (ย่อชื่อโครงการได้) กรุณาตรวจว่าอัปโหลดเข้าโครงการถูกต้อง หรือขอให้ผู้ขายแก้ชื่อผู้ซื้อ",
        quote: bad[0].quote,
      }];
    }
    return [{ group: "project", status: STATUS.PASS, code: REASON.PROJECT_NAME_MATCHES, message: "ชื่อโครงการในเอกสารตรงกับโครงการ", quote: candidates[0].quote }];
  }

  // ถัวเฉลี่ยภายในหมวด (เจ้าของโครงการ/การเงิน 2026-11-25): หมวดค่าใช้สอย ค่าวัสดุ และหมวดอื่น ใช้เงินถัวกัน
  // ระหว่างรายการที่ตั้งไว้แล้วในหมวดเดียวกันได้ ไม่ต้องชี้แจง ถ้ายอดรวมทั้งหมวดไม่เกินที่ตั้งไว้ — ยกเว้นหมวด
  // ค่าตอบแทน/ค่าจ้าง และครุภัณฑ์ (ถัวไม่ได้ทั้งหมวด) และรายการที่ระเบียบกำหนดเป็น % (ruleItem.averaging
  // === false) ซึ่งห้ามเกินยอดของรายการตัวเอง รายการที่ไม่อยู่ในประมาณการเลยยังต้องขออนุมัติเสมอ
  function groupAllowsAveraging(groupName) {
    return !!groupName && !/ตอบแทน|ค่าจ้าง|ครุภัณฑ์/.test(groupName);
  }

  // ประมาณการทั้งโครงการ (มี spentBefore ต่อรายการ) → budget ที่ evaluate() รับ: จับคู่รายการด้วยหมวด
  // (ruleCategory) แล้วรวมยอดตั้งไว้/ใช้ไปของทั้งหมวดสำหรับการถัว — undefined เมื่อยังไม่มีประมาณการ
  function budgetFromEstimate(category, estimate) {
    if (!estimate || !estimate.length) return undefined;
    var line = estimate.filter(function (l) { return l.ruleCategory === category; })[0] || null;
    if (!line) return { line: null, spentBefore: 0 };
    var name = line.group || "";
    var sameGroup = estimate.filter(function (l) { return (l.group || "") === name; });
    return {
      line: { id: line.id, itemName: line.itemName, total: line.total, quantity: line.quantity, group: name },
      spentBefore: line.spentBefore || 0,
      group: {
        name: name,
        total: sameGroup.reduce(function (s, l) { return s + (l.total || 0); }, 0),
        spentBefore: sameGroup.reduce(function (s, l) { return s + (l.spentBefore || 0); }, 0),
      },
    };
  }

  // ตัวเลขประมาณการต่อรายการ "ถ้าใบเสร็จนี้อยู่ในรายการนี้" สำหรับ prompt ของ LLM (js/llm-verdict.js)
  // เป็นข้อเท็จจริงเชิงตัวเลขเท่านั้น ไม่มีผลตัดสิน — LLM ยังต้องเลือกรายการและตัดสินเอง แค่ไม่ต้องบวกเลขเอง
  // (LLM รุ่นเล็กบวกยอดผิดและข้ามกติกาถัวเฉลี่ยบ่อย 2026-11-25)
  // คืน [{ id, lineTotal, lineAfter, groupName, groupTotal, groupAfter, groupAverages, lineAverages }]
  function budgetFacts(estimate, ruleSet, amount) {
    if (!estimate || !estimate.length || typeof amount !== "number" || !isFinite(amount)) return [];
    var groups = {};
    estimate.forEach(function (l) {
      var g = groups[l.group || ""] = groups[l.group || ""] || { total: 0, spent: 0 };
      g.total += l.total || 0;
      g.spent += l.spentBefore || 0;
    });
    return estimate.map(function (l) {
      var g = groups[l.group || ""];
      var item = l.ruleCategory ? findRuleItem(l.ruleCategory, ruleSet) : null;
      return {
        id: l.id,
        lineTotal: l.total || 0,
        lineAfter: (l.spentBefore || 0) + amount,
        groupName: l.group || "",
        groupTotal: g.total,
        groupAfter: g.spent + amount,
        groupAverages: groupAllowsAveraging(l.group || ""),
        lineAverages: !item || item.averaging,
      };
    });
  }

  function checkBudget(receipt, ruleSet) {
    var budget = receipt.budget;
    var amount = receipt.amount;
    if (!budget.line) {
      return [{
        group: "budget", status: STATUS.APPROVAL, code: REASON.NOT_IN_ESTIMATE,
        message: "ค่าใช้จ่ายนี้ไม่อยู่ในประมาณการที่อนุมัติไว้ (รายการใหม่) ต้องชี้แจงเหตุผลและขออนุมัติก่อนเบิก",
      }];
    }
    var line = budget.line;
    var spentBefore = budget.spentBefore || 0;
    var spentAfter = spentBefore + amount;
    var percent = line.total > 0 ? Math.round((spentAfter / line.total) * 1000) / 10 : null;
    var usage = "รายการ \"" + line.itemName + "\" ตั้งไว้ " + formatCurrency(line.total) +
      " ใช้ไปแล้ว " + formatCurrency(spentBefore) + " รวมใบนี้เป็น " + formatCurrency(spentAfter) +
      (percent != null ? " (" + percent + "%)" : "");
    if (spentAfter > line.total) {
      var over = spentAfter - line.total;
      var group = budget.group;
      var item = findRuleItem(receipt.category, ruleSet);
      var lineAverages = !item || item.averaging;
      var groupAverages = !!group && groupAllowsAveraging(group.name);
      var groupAfter = group ? group.spentBefore + amount : null;
      if (groupAverages && lineAverages && groupAfter <= group.total) {
        return [{
          group: "budget", status: STATUS.PASS, code: REASON.AVERAGED_WITHIN_GROUP,
          message: "ถัวจ่ายในหมวด: " + usage + " เกินรายการนี้ " + formatCurrency(over) + " ถัวจากรายการอื่นใน\"" +
            group.name + "\" ได้ (หมวดตั้งไว้ " + formatCurrency(group.total) + " รวมใบนี้ใช้ไป " + formatCurrency(groupAfter) +
            ") ไม่ต้องชี้แจง",
          budgetLineId: line.id, percentUsed: percent, averagedAmount: over,
        }];
      }
      var why = !group ? ""
        : !groupAverages ? " (หมวด\"" + group.name + "\" ถัวเฉลี่ยไม่ได้)"
        : !lineAverages ? " (รายการนี้ระเบียบกำหนดเป็น % ห้ามถัวเฉลี่ย ใช้ได้ไม่เกินยอดที่ตั้งไว้)"
        : " (ยอดรวมทั้งหมวดก็เกิน: หมวดตั้งไว้ " + formatCurrency(group.total) + " รวมใบนี้ใช้ไป " + formatCurrency(groupAfter) + ")";
      return [{
        group: "budget", status: STATUS.APPROVAL, code: REASON.OVER_ESTIMATE,
        message: "ใช้จ่ายเกินประมาณการ: " + usage + why + " ต้องชี้แจงเหตุผลและขออนุมัติ",
        budgetLineId: line.id, percentUsed: percent,
      }];
    }
    return [{
      group: "budget", status: STATUS.PASS, code: REASON.WITHIN_ESTIMATE,
      message: "อยู่ในประมาณการ: " + usage, budgetLineId: line.id, percentUsed: percent,
    }];
  }

  function checkEvidenceFindings(receipt, ruleSet, documentNames) {
    var required = requiredEvidence(receipt.category, { amount: receipt.amount, date: receipt.date }, ruleSet);
    if (!required) return { findings: [], required: null };
    if (!receipt.evidence) {
      return { required: required, findings: [{ group: "evidence", status: STATUS.PASS, code: REASON.EVIDENCE_NOT_CHECKED, message: "ยังไม่ได้ตรวจความครบของเอกสารแนบ", unverified: true }] };
    }
    var names = documentNames || {};
    var gaps = checkEvidence(required, receipt.evidence);
    var findings = [];
    gaps.missingSteps.forEach(function (s) {
      var docs = s.documentTypeIds.map(function (id) { return names[id] || id; }).join(" หรือ ");
      findings.push({ group: "evidence", status: STATUS.FIX, code: REASON.MISSING_EVIDENCE, message: "ขาดเอกสาร: " + docs + (s.note ? " (" + s.note + ")" : ""), documentTypeIds: s.documentTypeIds });
    });
    gaps.missingAttestations.forEach(function (a) {
      findings.push({ group: "evidence", status: STATUS.FIX, code: REASON.MISSING_ATTESTATION, message: "ยังไม่ได้ยืนยัน: " + a.text, attestationId: a.id });
    });
    return { findings: findings, required: required };
  }

  function explain(findings, chainName) {
    var problems = findings.filter(function (f) { return f.status !== STATUS.PASS; });
    var infos = findings.filter(function (f) { return f.status === STATUS.PASS && !f.unverified; });
    var parts = [];
    GROUP_ORDER.forEach(function (group) {
      var msgs = problems.filter(function (f) { return f.group === group; }).map(function (f) { return f.message; });
      if (!msgs.length) return;
      parts.push(group === "evidence" ? "เอกสารประกอบยังไม่ครบตามชุด \"" + chainName + "\": " + msgs.join("; ") : msgs.join("; "));
    });
    var infoText = infos.map(function (f) { return f.message; }).join(" — ");
    // สิ่งที่ระบบยังตรวจไม่ได้ (เช่น ยังไม่มีไฟล์ประมาณการ) ต่อท้ายเสมอ เพื่อให้ผู้ใช้รู้ว่าต้องทำอะไรต่อ
    var todo = findings.filter(function (f) { return f.unverified; }).map(function (f) { return f.message; }).join(" — ");
    var text = !parts.length ? infoText : parts.join(" — ") + (infoText ? " — ส่วนที่ผ่านแล้ว: " + infoText : "");
    return todo ? (text ? text + " — " : "") + todo : text;
  }

  // receipt: {
  //   category, amount, date?  — date (ISO) ใช้กับเงื่อนไขชุดเอกสารที่ขึ้นกับวันที่ (เช่น รูปถ่ายพัสดุตั้งแต่ 22 เม.ย. 2569)
  //   project?: { name, ocrText }  — เทียบชื่อโครงการบนหลักฐานการเงิน (checkProjectName)
  //   contract?: { start, end }  — ระยะเวลาสัญญา (ISO) วันที่ในใบเสร็จต้องอยู่ในช่วงนี้ (checkContractPeriod)
  //   evidence?: { documentTypeIds, attestationIds }   — ไม่ส่งมา = ยังไม่ได้ตรวจเอกสารแนบ
  //   budget?: { line: { id, itemName, total } | null, spentBefore, group?: { name, total, spentBefore } }
  //     — สร้างจากประมาณการด้วย budgetFromEstimate(); group ใช้ตรวจการถัวเฉลี่ยภายในหมวด
  //     — ไม่ส่งมา = โครงการยังไม่ได้นำเข้าประมาณการ; line: null = ใบนี้ไม่อยู่ในประมาณการ
  //     — spentBefore คือยอดของใบเสร็จอื่นที่ตัดจากรายการเดียวกันแล้ว (ไม่รวมใบนี้)
  // }
  // ruleSet: null | { fundSourceId, ruleVersionId, versionLabel, ruleItems: [...], evidenceChains?: { id: chain } }
  //   — ruleSet === null หมายถึงหาแหล่งทุนไม่เจอ, ruleVersionId === null หมายถึงไม่มีเวอร์ชันที่ active
  // documentNames: { documentTypeId: ชื่อเอกสาร } ใช้แค่ทำคำอธิบายให้อ่านง่าย ไม่มีผลต่อการตัดสิน
  // แหล่งทุนที่ปิดใช้งานแล้ว (FR-35): ยังตรวจต่อด้วยกฎที่เก็บไว้ตามปกติ แต่แจ้งเตือนไว้หน้าคำอธิบาย
  // ไม่เปลี่ยนผลตัดสินและไม่ลด autoVerified
  function evaluate(receipt, ruleSet, documentNames) {
    var result = evaluateReceipt(receipt, ruleSet, documentNames);
    if (ruleSet && ruleSet.fundSourceActive === false) {
      var notice = {
        group: "regulation", status: STATUS.PASS, code: REASON.FUND_SOURCE_INACTIVE, notice: true,
        message: "แหล่งทุนนี้ถูกปิดใช้งานแล้ว ระบบตรวจตามกฎเดิมที่เก็บไว้ กรุณาสอบถามผู้ดูแลระบบว่าโครงการนี้ยังเบิกได้หรือไม่",
      };
      result.findings = [notice].concat(result.findings || []);
      result.explanation = notice.message + (result.explanation ? " — " + result.explanation : "");
    }
    return result;
  }

  function evaluateReceipt(receipt, ruleSet, documentNames) {
    var hasBudget = !!receipt.budget;
    var line = hasBudget ? receipt.budget.line : null;
    var result = evaluateAmount(receipt, ruleSet, { hasEstimate: hasBudget, line: line, spentBefore: hasBudget ? receipt.budget.spentBefore || 0 : 0 });
    var regulationFinding = { group: "regulation", status: result.status, code: result.reasonCode, message: result.explanation };
    var periodFindings = checkContractPeriod(receipt);
    var outside = periodFindings.filter(function (f) { return f.status === STATUS.REJECT; })[0];
    if (result.status === STATUS.REJECT || result.reasonCode === REASON.INVALID_AMOUNT) {
      result.findings = (outside ? [outside] : []).concat([regulationFinding]);
      if (outside) {
        result.status = STATUS.REJECT;
        result.reasonCode = outside.code;
        result.explanation = outside.message + " — " + result.explanation;
      }
      return result;
    }

    var findings = periodFindings.slice();
    if (hasBudget) findings = findings.concat(checkBudget(receipt, ruleSet));
    else {
      result.autoVerified = false;
      findings.push({ group: "budget", status: STATUS.PASS, code: REASON.ESTIMATE_NOT_CHECKED, message: "ทุกรายจ่ายต้องเป็นไปตามประมาณการที่อนุมัติแล้ว แต่โครงการนี้ยังไม่มีไฟล์ประมาณการในระบบ กรุณาอัปโหลดไฟล์ประมาณการ (ตาราง 17.2) ที่ปุ่ม \"ประมาณการ\" ในหน้าโครงการของฉัน เพื่อให้ระบบตรวจกับประมาณการ", unverified: true });
    }
    findings.push(regulationFinding);
    findings = findings.concat(checkSummary(receipt));
    findings = findings.concat(checkProjectName(receipt));
    var evidence = checkEvidenceFindings(receipt, ruleSet, documentNames);
    findings = findings.concat(evidence.findings);
    if (findings.some(function (f) { return f.unverified; })) result.autoVerified = false;

    var worst = findings.reduce(function (max, f) { return SEVERITY[f.status] > SEVERITY[max] ? f.status : max; }, STATUS.PASS);
    var primary = null;
    GROUP_ORDER.some(function (group) {
      primary = findings.filter(function (f) { return f.group === group && f.status === worst && !f.unverified; })[0] || null;
      return !!primary;
    });

    result.status = worst;
    result.reasonCode = primary ? primary.code : result.reasonCode;
    result.budgetLineId = hasBudget && receipt.budget.line ? receipt.budget.line.id : null;
    result.findings = findings.map(function (f) {
      var out = Object.assign({}, f);
      delete out.unverified;
      return out;
    });
    result.explanation = explain(findings, evidence.required ? evidence.required.chainName : "");
    return result;
  }

  // อัตราตามระเบียบ × จำนวนหน่วยจากตัวคูณในประมาณการ (line.quantity เช่น 100 ชม., 1,200 กม., 40 คน×มื้อ)
  // = ยอดสูงสุดที่ระเบียบอนุญาตสำหรับรายการนี้ เทียบกับยอดสะสมของรายการ (รวมใบนี้)
  function checkRateAllowance(item, receipt, opts, result) {
    var allowance = item.rateAmount * opts.line.quantity;
    var spentAfter = (opts.spentBefore || 0) + receipt.amount;
    var calc = rateText(item) + " × " + opts.line.quantity.toLocaleString("en-US") + " (ตามตัวคูณในประมาณการ) = " + formatCurrency(allowance);
    if (spentAfter > allowance) {
      result.status = STATUS.FIX;
      result.reasonCode = REASON.OVER_RATE_ALLOWANCE;
      result.explanation = withNote("ยอดสะสมของรายการนี้ (" + formatCurrency(spentAfter) + ") เกินยอดที่ระเบียบอนุญาต: " + calc + " กรุณาตรวจสอบอัตราหรือจำนวนที่เบิก", item);
    } else {
      result.status = STATUS.PASS;
      result.reasonCode = REASON.WITHIN_RATE_ALLOWANCE;
      result.explanation = withNote("อยู่ในอัตราตามระเบียบ: " + calc + " ยอดสะสมรวมใบนี้ " + formatCurrency(spentAfter), item);
    }
    return result;
  }

  // opts.line: รายการในประมาณการที่ใบเสร็จนี้ผูกอยู่ (ถ้ามี) — เพดาน "ต่อคน/ต่อคืน/ต่อมื้อ/ต่อชั่วโมง/ต่อ กม."
  // ห้ามเอายอดรวมทั้งใบไปเทียบตรงๆ (อาหาร 10 คน ฿1,500 ไม่ได้เกินเพดาน ฿150/คน/มื้อ) ถ้าประมาณการมีตัวคูณ
  // ให้เทียบกับ อัตรา × จำนวนหน่วย; ถ้าไม่มี ให้พึ่งการเทียบยอดกับประมาณการและแจ้งว่ายังตรวจอัตราไม่ได้
  function evaluateAmount(receipt, ruleSet, opts) {
    opts = opts || {};
    var hasQuantity = !!(opts.line && typeof opts.line.quantity === "number" && opts.line.quantity > 0);
    var result = {
      engineVersion: ENGINE_VERSION,
      fundSourceId: ruleSet ? ruleSet.fundSourceId || null : null,
      ruleVersionId: ruleSet ? ruleSet.ruleVersionId || null : null,
      ruleItemId: null,
      evidenceChainId: null,
      status: STATUS.REJECT,
      reasonCode: null,
      // true = ระบบตัดสินจากตัวเลขได้ครบเอง; false = ผ่านตามหมวดแต่ยังต้องให้คนตรวจยอด (ห้ามแสดงว่าตรวจครบแล้ว)
      autoVerified: true,
      citation: null,
      explanation: "",
    };

    if (!ruleSet || !ruleSet.fundSourceId) {
      result.reasonCode = REASON.NO_FUND_SOURCE;
      result.explanation = "ไม่พบแหล่งทุนของโครงการนี้ กรุณาตรวจสอบข้อมูลโครงการที่หน้าโครงการของฉัน";
      return result;
    }
    if (!ruleSet.ruleVersionId) {
      result.reasonCode = REASON.NO_ACTIVE_RULE_VERSION;
      result.explanation = "แหล่งทุนนี้ยังไม่มีระเบียบที่ admin กำหนดไว้ กรุณาติดต่อผู้ดูแลระบบให้เพิ่มกฎที่หน้าจัดการแหล่งทุน";
      return result;
    }

    var category = receipt.category;
    var item = findRuleItem(category, ruleSet);
    if (!item) {
      result.reasonCode = REASON.CATEGORY_NOT_IN_RULES;
      result.explanation = "ระเบียบของแหล่งทุนนี้ไม่มีหมวด \"" + category + "\" กรุณาตรวจสอบว่าเลือกหมวดค่าใช้จ่ายถูกต้องหรือไม่";
      return result;
    }

    result.ruleItemId = item.id;
    result.evidenceChainId = item.evidenceChainId;
    result.citation = item.note;

    var amount = receipt.amount;
    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      result.status = STATUS.FIX;
      result.reasonCode = REASON.INVALID_AMOUNT;
      result.explanation = "ยอดเงินในใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลขมากกว่า 0) กรุณาตรวจสอบยอดเงินอีกครั้ง";
      return result;
    }

    if (CAPPED_RATE_TYPES.indexOf(item.rateType) !== -1 && item.rateAmount != null) {
      if (opts.line && item.unit && hasQuantity) return checkRateAllowance(item, receipt, opts, result);
      if (opts.line && item.unit) {
        result.status = STATUS.PASS;
        result.reasonCode = REASON.PER_UNIT_CAP_VIA_ESTIMATE;
        result.autoVerified = false;
        result.explanation = withNote("หมวด \"" + category + "\" มีเพดานต่อหน่วย (" + rateText(item) + ") ซึ่งตรวจจากยอดรวมใบเสร็จไม่ได้ " + "ประมาณการที่อัปโหลดไว้ไม่ได้ระบุจำนวน (เช่น ชั่วโมง กม. คน×มื้อ คืน) ในช่องตัวคูณของรายการนี้ กรุณาอัปโหลดไฟล์ประมาณการอีกครั้งโดยระบุตัวคูณ เพื่อให้ระบบตรวจอัตรากับประมาณการ", item);
        return result;
      }
      if (amount > item.rateAmount) {
        result.status = STATUS.FIX;
        result.reasonCode = REASON.AMOUNT_EXCEEDS_CAP;
        result.explanation = withNote("ยอดเงินที่ระบุ (" + formatCurrency(amount) + ") เกินเพดานของหมวด \"" + category + "\" ซึ่งกำหนดไว้ไม่เกิน " + rateText(item) + " กรุณาตรวจสอบว่ามีเอกสารประกอบครบตามระเบียบของแหล่งทุนหรือไม่", item);
        return result;
      }
      result.status = STATUS.PASS;
      result.reasonCode = REASON.WITHIN_CAP;
      result.explanation = withNote("ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด (" + rateText(item) + ")", item);
      return result;
    }

    if (item.rateType === "ต่อหน่วย" && item.rateAmount != null && hasQuantity) return checkRateAllowance(item, receipt, opts, result);

    // "ตามข้อเสนอโครงการ": ไม่มีเพดานระดับแหล่งทุน — ประมาณการที่อนุมัติแล้วคือเพดาน จึงตรวจครบเมื่อผูกกับรายการในประมาณการ
    if (item.rateType === "ตามข้อเสนอโครงการ" && opts.line) {
      result.status = STATUS.PASS;
      result.reasonCode = REASON.PER_PROPOSAL_VIA_ESTIMATE;
      result.explanation = withNote("หมวด \"" + category + "\" ไม่มีเพดานระดับแหล่งทุน ใช้ยอดในประมาณการที่อนุมัติแล้วเป็นเพดาน", item);
      return result;
    }

    // "ต่อหน่วย" ที่ไม่รู้จำนวนหน่วย (ไม่มีประมาณการหรือตัวคูณ) และ "ตามข้อเสนอโครงการ" ที่ไม่มีประมาณการ: ตรวจเองไม่ได้
    var rateNote = item.rateType === "ต่อหน่วย" && item.rateAmount != null
      ? "อัตรา " + rateText(item)
      : "ไม่มีเพดานระดับแหล่งทุน ใช้ยอดในประมาณการที่อนุมัติแล้วเป็นเพดาน";
    // ใบที่ผูกกับรายการแต่ไม่มีตัวคูณ → ให้อัปโหลดใหม่พร้อมตัวคูณ; ยังไม่มีประมาณการ → ให้อัปโหลด;
    // ใบที่ระบุว่าไม่อยู่ในประมาณการ → ส่วนประมาณการแจ้งให้ขออนุมัติอยู่แล้ว
    var nextStep = opts.line ? "ประมาณการที่อัปโหลดไว้ไม่ได้ระบุจำนวน (เช่น ชั่วโมง กม. คน×มื้อ คืน) ในช่องตัวคูณของรายการนี้ กรุณาอัปโหลดไฟล์ประมาณการอีกครั้งโดยระบุตัวคูณ เพื่อให้ระบบตรวจอัตรากับประมาณการ"
      : !opts.hasEstimate ? "ตรวจยอดได้เมื่อมีประมาณการ"
      : "รายการนี้ไม่อยู่ในประมาณการ จึงต้องขออนุมัติก่อน";
    result.status = STATUS.PASS;
    result.reasonCode = REASON.NO_FIXED_CAP;
    result.autoVerified = false;
    result.explanation = withNote("หมวด \"" + category + "\" เป็นประเภท " + item.rateType + " (" + rateNote + ") — " + nextStep, item);
    return result;
  }

  return {
    ENGINE_VERSION: ENGINE_VERSION,
    STATUS: STATUS,
    REASON: REASON,
    normalizeRuleItem: normalizeRuleItem,
    requiredEvidence: requiredEvidence,
    conditionApplies: conditionApplies,
    describeCondition: describeCondition,
    projectNameCandidates: projectNameCandidates,
    projectNameMatches: projectNameMatches,
    thaiDate: thaiDate,
    contractOf: contractOf,
    evaluate: evaluate,
    groupAllowsAveraging: groupAllowsAveraging,
    budgetFromEstimate: budgetFromEstimate,
    budgetFacts: budgetFacts,
  };
});
