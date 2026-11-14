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
  var ENGINE_VERSION = "1.0.0";

  var STATUS = { PASS: "ผ่าน", FIX: "ต้องแก้ไข", REJECT: "ไม่เข้าเงื่อนไข" };

  var REASON = {
    NO_FUND_SOURCE: "NO_FUND_SOURCE",
    NO_ACTIVE_RULE_VERSION: "NO_ACTIVE_RULE_VERSION",
    CATEGORY_NOT_IN_RULES: "CATEGORY_NOT_IN_RULES",
    INVALID_AMOUNT: "INVALID_AMOUNT",
    AMOUNT_EXCEEDS_CAP: "AMOUNT_EXCEEDS_CAP",
    WITHIN_CAP: "WITHIN_CAP",
    NO_FIXED_CAP: "NO_FIXED_CAP",
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

  // receipt: { category, amount }
  // ruleSet: null | { fundSourceId, ruleVersionId, versionLabel, ruleItems: [ruleItem, ...] }
  //   — ruleSet === null หมายถึงหาแหล่งทุนไม่เจอ, ruleVersionId === null หมายถึงไม่มีเวอร์ชันที่ active
  function evaluate(receipt, ruleSet) {
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
    var raw = (ruleSet.ruleItems || []).filter(function (ri) { return ri.categoryName === category; })[0];
    if (!raw) {
      result.reasonCode = REASON.CATEGORY_NOT_IN_RULES;
      result.explanation = "ระเบียบของแหล่งทุนนี้ไม่มีหมวด \"" + category + "\" กรุณาตรวจสอบว่าเลือกหมวดค่าใช้จ่ายถูกต้องหรือไม่";
      return result;
    }

    var item = normalizeRuleItem(raw);
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
    evaluate: evaluate,
  };
});
