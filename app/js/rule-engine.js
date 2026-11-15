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
  var ENGINE_VERSION = "1.2.0";

  var STATUS = { PASS: "ผ่าน", FIX: "ต้องแก้ไข", APPROVAL: "ต้องชี้แจง/ขออนุมัติ", REJECT: "ไม่เข้าเงื่อนไข" };

  var REASON = {
    NO_FUND_SOURCE: "NO_FUND_SOURCE",
    NO_ACTIVE_RULE_VERSION: "NO_ACTIVE_RULE_VERSION",
    CATEGORY_NOT_IN_RULES: "CATEGORY_NOT_IN_RULES",
    INVALID_AMOUNT: "INVALID_AMOUNT",
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
    ESTIMATE_NOT_CHECKED: "ESTIMATE_NOT_CHECKED",
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

  function findRuleItem(category, ruleSet) {
    var raw = ruleSet && (ruleSet.ruleItems || []).filter(function (ri) { return ri.categoryName === category; })[0];
    return raw ? normalizeRuleItem(raw) : null;
  }

  var CONDITION_OPS = {
    ">": function (a, b) { return a > b; },
    ">=": function (a, b) { return a >= b; },
    "<": function (a, b) { return a < b; },
    "<=": function (a, b) { return a <= b; },
  };

  // ชุดเอกสารที่หมวดนี้ต้องมี (รวม conditionalSteps ที่เข้าเงื่อนไขของใบเสร็จนี้แล้ว) — ใช้ทั้งตอนตรวจ
  // และตอนสร้าง checklist ในหน้าจอ เพื่อให้สองที่ใช้ตรรกะชุดเดียวกัน
  // คืน null ถ้าหมวดนี้ไม่มีกฎหรือไม่ได้ผูกชุดเอกสารไว้
  function requiredEvidence(category, amount, ruleSet) {
    var item = findRuleItem(category, ruleSet);
    var chain = item && item.evidenceChainId && ruleSet.evidenceChains ? ruleSet.evidenceChains[item.evidenceChainId] : null;
    if (!chain) return null;

    var steps = (chain.steps || []).map(function (s) {
      return { order: s.order, timing: s.timing || "with", required: !!s.required, documentTypeIds: s.documentTypeIds || [], note: s.note || null };
    });
    (chain.conditionalSteps || []).forEach(function (cs, i) {
      var op = CONDITION_OPS[cs.when && cs.when.op];
      var value = cs.when && cs.when.field === "amount" ? amount : undefined;
      if (op && typeof value === "number" && op(value, cs.when.value)) {
        steps.push({ order: 100 + i, timing: "with", required: true, documentTypeIds: cs.addStep.documentTypeIds || [], note: cs.addStep.note || null, conditional: true });
      }
    });

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
  var GROUP_ORDER = ["budget", "regulation", "evidence"];

  function checkBudget(receipt) {
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
      return [{
        group: "budget", status: STATUS.APPROVAL, code: REASON.OVER_ESTIMATE,
        message: "ใช้จ่ายเกินประมาณการ: " + usage + " ต้องชี้แจงเหตุผลและขออนุมัติ",
        budgetLineId: line.id, percentUsed: percent,
      }];
    }
    return [{
      group: "budget", status: STATUS.PASS, code: REASON.WITHIN_ESTIMATE,
      message: "อยู่ในประมาณการ: " + usage, budgetLineId: line.id, percentUsed: percent,
    }];
  }

  function checkEvidenceFindings(receipt, ruleSet, documentNames) {
    var required = requiredEvidence(receipt.category, receipt.amount, ruleSet);
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
    if (!parts.length) return infoText;
    return parts.join(" — ") + (infoText ? " — ส่วนที่ผ่านแล้ว: " + infoText : "");
  }

  // receipt: {
  //   category, amount,
  //   evidence?: { documentTypeIds, attestationIds }   — ไม่ส่งมา = ยังไม่ได้ตรวจเอกสารแนบ
  //   budget?: { line: { id, itemName, total } | null, spentBefore }
  //     — ไม่ส่งมา = โครงการยังไม่ได้นำเข้าประมาณการ; line: null = ใบนี้ไม่อยู่ในประมาณการ
  //     — spentBefore คือยอดของใบเสร็จอื่นที่ตัดจากรายการเดียวกันแล้ว (ไม่รวมใบนี้)
  // }
  // ruleSet: null | { fundSourceId, ruleVersionId, versionLabel, ruleItems: [...], evidenceChains?: { id: chain } }
  //   — ruleSet === null หมายถึงหาแหล่งทุนไม่เจอ, ruleVersionId === null หมายถึงไม่มีเวอร์ชันที่ active
  // documentNames: { documentTypeId: ชื่อเอกสาร } ใช้แค่ทำคำอธิบายให้อ่านง่าย ไม่มีผลต่อการตัดสิน
  function evaluate(receipt, ruleSet, documentNames) {
    var hasBudget = !!receipt.budget;
    var result = evaluateAmount(receipt, ruleSet, { perUnitViaEstimate: hasBudget && !!receipt.budget.line });
    var regulationFinding = { group: "regulation", status: result.status, code: result.reasonCode, message: result.explanation };
    if (result.status === STATUS.REJECT || result.reasonCode === REASON.INVALID_AMOUNT) {
      result.findings = [regulationFinding];
      return result;
    }

    var findings = [];
    if (hasBudget) findings = findings.concat(checkBudget(receipt));
    else {
      result.autoVerified = false;
      findings.push({ group: "budget", status: STATUS.PASS, code: REASON.ESTIMATE_NOT_CHECKED, message: "โครงการนี้ยังไม่ได้นำเข้าประมาณการ จึงยังไม่ได้เทียบกับประมาณการ", unverified: true });
    }
    findings.push(regulationFinding);
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

  // opts.perUnitViaEstimate: ใบเสร็จผูกกับรายการในประมาณการแล้ว — เพดาน "ต่อคน/ต่อคืน/ต่อมื้อ" ของระเบียบ
  // ห้ามเอายอดรวมทั้งใบไปเทียบตรงๆ (อาหาร 10 คน ฿1,500 ไม่ได้เกินเพดาน ฿150/คน/มื้อ) ให้ใช้การเทียบยอดกับ
  // ประมาณการที่อนุมัติตามอัตราระเบียบแล้วแทน
  function evaluateAmount(receipt, ruleSet, opts) {
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
      if (opts && opts.perUnitViaEstimate && item.unit) {
        result.status = STATUS.PASS;
        result.reasonCode = REASON.PER_UNIT_CAP_VIA_ESTIMATE;
        result.autoVerified = false;
        result.explanation = withNote("หมวด \"" + category + "\" มีเพดานต่อหน่วย (" + rateText(item) + ") ซึ่งตรวจจากยอดรวมใบเสร็จไม่ได้ ระบบจึงเทียบกับประมาณการที่อนุมัติแล้วแทน", item);
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

    // "ต่อหน่วย" ต้องรู้ปริมาณ (เช่น กม.) ที่ระบบยังไม่เก็บ; "ตามข้อเสนอโครงการ" ไม่มีเพดานระดับแหล่งทุน
    var rateNote = item.rateType === "ต่อหน่วย" && item.rateAmount != null
      ? "อัตราอ้างอิง " + rateText(item)
      : "ไม่มีเพดานระดับแหล่งทุน อ้างอิงจากข้อเสนอโครงการของโครงการนี้เอง";
    result.status = STATUS.PASS;
    result.reasonCode = REASON.NO_FIXED_CAP;
    result.autoVerified = false;
    result.explanation = withNote("หมวด \"" + category + "\" เป็นประเภท " + item.rateType + " (" + rateNote + ") — ระบบยังตรวจอัตโนมัติแบบเต็มรูปแบบไม่ได้ กรุณาให้เจ้าหน้าที่การเงินตรวจสอบยอดเงินอีกครั้ง", item);
    return result;
  }

  return {
    ENGINE_VERSION: ENGINE_VERSION,
    STATUS: STATUS,
    REASON: REASON,
    normalizeRuleItem: normalizeRuleItem,
    requiredEvidence: requiredEvidence,
    evaluate: evaluate,
  };
});
