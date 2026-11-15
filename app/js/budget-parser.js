// ─────────────────────────────────────────────────────────────
// js/budget-parser.js — แปลงแถวของตาราง 17.2 "รายละเอียดงบประมาณการวิจัยจำแนกตามงบประเภทต่างๆ"
// (ไฟล์ตัวช่วยทำตารางประมาณการของมหาวิทยาลัย ดาวน์โหลดเป็น .xlsx) ให้เป็นรายการประมาณการ
// pure function — ใช้ได้ทั้งเบราว์เซอร์ (window.BudgetParser) และ Node (require) เพื่อทดสอบ
// รูปแบบตาราง: แถวหัวหมวด (คอลัมน์ A ว่าง, B = "หมวด...") ตามด้วยแถวรายการ (A = ลำดับ, B = รายการ,
// C = ตัวคูณ, D/E/F = งวด 1/2/3, G = รวม) และแถว "รวม" ท้ายหมวด
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BudgetParser = api;
})(typeof self !== "undefined" ? self : this, function () {
  var COL = { order: 0, itemName: 1, multiplier: 2, inst1: 3, inst2: 4, inst3: 5, total: 6 };

  function toNumber(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var n = parseFloat(String(v).replace(/[,\s฿บาท]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function cell(row, i) {
    var v = row[i];
    return v == null ? "" : String(v).trim();
  }

  // rows: array ของแถว (array ของค่าในแต่ละเซลล์) จากชีต 17.2
  // คืน { lines: [...], warnings: [...] } — ไม่ throw ถ้าแถวไหนแปลกๆ แต่ใส่คำเตือนไว้ให้ผู้ใช้ดูก่อนบันทึก
  function parseRows(rows) {
    var lines = [];
    var warnings = [];
    var group = null;
    var foundHeader = false;

    rows.forEach(function (row, idx) {
      if (!row || !row.length) return;
      var a = cell(row, COL.order);
      var b = cell(row, COL.itemName);
      if (!foundHeader && /รายการค่าใช้จ่าย/.test(b)) foundHeader = true;
      if (!a && /^หมวด/.test(b)) { group = b; return; }
      if (!/^\d+$/.test(a) || !b) return;

      var installments = [toNumber(row[COL.inst1]), toNumber(row[COL.inst2]), toNumber(row[COL.inst3])];
      var installmentSum = installments[0] + installments[1] + installments[2];
      var total = toNumber(row[COL.total]) || installmentSum;
      if (total <= 0) {
        warnings.push("แถว " + (idx + 1) + " \"" + b + "\" ไม่มียอดเงิน — ข้ามไป");
        return;
      }
      if (installmentSum > 0 && Math.abs(installmentSum - total) > 0.5) {
        warnings.push("แถว " + (idx + 1) + " \"" + b + "\" ยอดงวด 1–3 รวมกัน (" + installmentSum + ") ไม่เท่ากับยอดรวม (" + total + ")");
      }
      lines.push({
        group: group,
        itemName: b,
        multiplierText: cell(row, COL.multiplier),
        installmentAmounts: installments,
        total: Math.round(total * 100) / 100,
        ruleCategory: guessRuleCategory(b, group),
      });
    });

    if (!foundHeader) warnings.unshift("ไม่พบหัวตาราง \"รายการค่าใช้จ่าย\" — ไฟล์นี้อาจไม่ใช่ตาราง 17.2 กรุณาตรวจรายการด้านล่างให้ดี");
    if (!lines.length) warnings.push("ไม่พบรายการที่มียอดเงินเลย");
    return { lines: lines, warnings: warnings };
  }

  // จับคู่ชื่อรายการทางการ (จากรายการตัวเลือกในไฟล์ตัวช่วยของมหาวิทยาลัย) กับหมวดตามระเบียบในระบบ
  // เป็นแค่ค่าเริ่มต้น — ผู้ใช้แก้ได้ก่อนบันทึก ลำดับสำคัญ: ข้อที่เจาะจงกว่าต้องมาก่อน
  // (เช่น "ค่าจ้างเหมาวิเคราะห์ทดสอบ" ต้องเป็นจ้างเหมา ไม่ใช่ค่าธรรมเนียมวิเคราะห์ทดสอบ)
  var CATEGORY_HINTS = [
    [/นักศึกษาช่วยงานด้านวิชาการ|นักศึกษาช่วยงาน.*วิชาการ/, "ค่าตอบแทนนักศึกษาช่วยงาน (วิชาการ)"],
    [/นักศึกษาช่วยงาน/, "ค่าตอบแทนนักศึกษาช่วยงาน (ทั่วไป)"],
    [/ผู้ให้ข้อมูล|ผู้ให้สัมภาษณ์|ผู้ตอบแบบสอบถาม|อาสาสมัคร/, "ค่าตอบแทนอาสาสมัคร/ผู้ให้ข้อมูล"],
    [/ผู้ทรงคุณวุฒิ.*(Manuscript|ตรวจทาน)/i, "ค่าตอบแทนผู้ทรงคุณวุฒิ (ตรวจทาน Manuscript)"],
    [/ผู้ทรงคุณวุฒิ/, "ค่าตอบแทนผู้ทรงคุณวุฒิพิจารณาเครื่องมือ"],
    [/จ้างเหมา/, "ค่าจ้างเหมาบริการ"],
    [/อาหารกลางวัน/, "ค่าอาหารกลางวัน (ประชุม/อบรม)"],
    [/อาหารว่าง/, "ค่าอาหารว่างและเครื่องดื่ม (ประชุม/อบรม)"],
    [/ห้องปฏิบัติการ|เครื่องมือวิเคราะห์|วิเคราะห์ทดสอบ/, "ค่าธรรมเนียมห้องปฏิบัติการ/เครื่องมือ"],
    [/เครื่องบิน/, "ค่าเครื่องบิน (ชั้นประหยัด)"],
    [/รถยนต์ส่วน/, "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)"],
    [/taxi|แท็กซี่/i, "ค่าแท็กซี่ (เดินทางปฏิบัติงาน)"],
    [/น้ำมันเชื้อเพลิงพาหนะเช่า.*ต่างจังหวัด/, "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ต่างจังหวัด)"],
    [/น้ำมันเชื้อเพลิงพาหนะเช่า/, "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ในจังหวัด)"],
    [/รถตู้|เช่ายานพาหนะ/, "ค่าเช่ายานพาหนะ (รถตู้)"],
    [/ที่พัก/, "ค่าที่พัก (เดินทางปฏิบัติงาน)"],
    [/เบี้ยเลี้ยง/, "ค่าเบี้ยเลี้ยงเดินทาง"],
    [/วัสดุสำนักงาน/, "ค่าวัสดุสำนักงาน"],
    [/วัสดุคอมพิวเตอร์|โปรแกรมคอมพิวเตอร์/, "ค่าวัสดุคอมพิวเตอร์"],
    [/ไปรษณีย์|ขนส่ง|โทรศัพท์|โทรสาร|อินเตอร์เน็ต|อินเทอร์เน็ต|สาธารณูปโภค/, "ค่าสาธารณูปโภค"],
    [/วัสดุ|เวชภัณฑ์|บรรจุภัณฑ์/, "ค่าวัสดุอื่นๆ"],
  ];

  function guessRuleCategory(itemName, group) {
    for (var i = 0; i < CATEGORY_HINTS.length; i++) {
      if (CATEGORY_HINTS[i][0].test(itemName)) return CATEGORY_HINTS[i][1];
    }
    if (group && /ครุภัณฑ์/.test(group)) return "ค่าครุภัณฑ์";
    return null;
  }

  // หาชีต 17.2 ในไฟล์: ชื่อชีตมี "17.2" ก่อน ถ้าไม่มีให้ใช้ชีตแรก
  function pickSheetName(sheetNames) {
    return sheetNames.filter(function (n) { return /17\.2/.test(n); })[0] || sheetNames[0];
  }

  return { parseRows: parseRows, guessRuleCategory: guessRuleCategory, pickSheetName: pickSheetName };
});
