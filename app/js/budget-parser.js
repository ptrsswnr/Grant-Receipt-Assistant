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
  // ตำแหน่งคอลัมน์ของไฟล์ Excel ตัวช่วย ใช้เมื่อหาหัวตารางไม่เจอ
  var COL = { order: 0, itemName: 1, multiplier: 2, inst1: 3, inst2: 4, inst3: 5, total: 6 };

  function text(v) {
    return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
  }

  // หาคอลัมน์จากหัวตาราง (ลำดับ / รายการ / ตัวคูณ / งวดที่ 1–3 / รวม) — ตารางใน Word/PDF อาจเรียง
  // คอลัมน์ไม่เหมือนไฟล์ Excel ตัวช่วย หัวตารางอาจแยก 2 แถว (งวด/รวม อยู่แถวล่าง) จึงไล่ดูหลายแถวแรก
  function detectColumns(rows) {
    var col = {};
    var limit = Math.min(rows.length, 25);
    for (var r = 0; r < limit; r++) {
      var row = rows[r] || [];
      var cells = row.map(text);
      // "งวด(ที่)? 1" — แบบเสนอโครงการ RS-01 ใช้ "งวด 1"; ไฟล์สแกนที่ผ่าน OCR มักทำไม้เอกหาย ("งวดที 1")
      var isHeaderRow = cells.some(function (t) { return /^ลำดับ|^รายการ|งวด(?:ที่?)?\s*\d/.test(t); });
      if (!isHeaderRow) continue;
      cells.forEach(function (t, i) {
        if (!t) return;
        if (col.order == null && /^ลำดับ/.test(t)) col.order = i;
        else if (col.itemName == null && /^รายการ/.test(t)) col.itemName = i;
        else if (col.multiplier == null && /ตัวคูณ/.test(t)) col.multiplier = i;
        else if (col.inst1 == null && /งวด(?:ที่?)?\s*1/.test(t)) col.inst1 = i;
        else if (col.inst2 == null && /งวด(?:ที่?)?\s*2/.test(t)) col.inst2 = i;
        else if (col.inst3 == null && /งวด(?:ที่?)?\s*3/.test(t)) col.inst3 = i;
        else if (col.total == null && /^รวม/.test(t)) col.total = i;
      });
    }
    if (col.itemName == null || col.total == null) return Object.assign({ detected: false }, COL);
    return {
      detected: true,
      order: col.order != null ? col.order : null,
      itemName: col.itemName,
      multiplier: col.multiplier != null ? col.multiplier : null,
      inst1: col.inst1 != null ? col.inst1 : null,
      inst2: col.inst2 != null ? col.inst2 : null,
      inst3: col.inst3 != null ? col.inst3 : null,
      total: col.total,
    };
  }

  function toNumber(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var n = parseFloat(String(v).replace(/[,\s฿บาท]/g, ""));
    return isFinite(n) ? n : 0;
  }

  // แยกตัวคูณของรายการ เช่น "60 บาท x 100 ชม." หรือ "200 กม. x 2 x 4 บาท x 3 ครั้ง"
  // ตัวที่มีคำว่า "บาท" คือราคาต่อหน่วย; ตัวเลขที่เหลือคูณกันเป็นจำนวนหน่วย (ชั่วโมง, กม., คน×มื้อ, คืน ...)
  // ถ้ายังเป็นแบบฟอร์มเปล่า ("....... บาท x … คน") หรือไม่มีตัวคูณ คืน null ให้ระบบรู้ว่าตรวจอัตราไม่ได้
  function parseMultiplier(text) {
    var none = { unitPrice: null, quantity: null };
    if (!text || !/[x×*]/i.test(text)) return none;
    var unitPrice = null;
    var quantity = null;
    var factors = String(text).split(/\s*[x×*]\s*/i);
    for (var i = 0; i < factors.length; i++) {
      var m = factors[i].match(/\d[\d,]*(?:\.\d+)?/);
      if (!m) return none;
      var n = parseFloat(m[0].replace(/,/g, ""));
      if (/บาท/.test(factors[i]) && unitPrice === null) unitPrice = n;
      else quantity = (quantity === null ? 1 : quantity) * n;
    }
    return { unitPrice: unitPrice, quantity: quantity };
  }

  function cell(row, i) {
    if (i == null) return "";
    var v = row[i];
    return v == null ? "" : String(v).trim();
  }

  function num(row, i) {
    return i == null ? 0 : toNumber(row[i]);
  }

  // rows: array ของแถว (array ของค่าในแต่ละเซลล์) จากชีต 17.2
  // คืน { lines: [...], warnings: [...] } — ไม่ throw ถ้าแถวไหนแปลกๆ แต่ใส่คำเตือนไว้ให้ผู้ใช้ดูก่อนบันทึก
  // options.orderOptional (ไฟล์สแกนผ่าน OCR): OCR มักอ่านตัวเลขหลักเดียว เช่น เลขลำดับ "1" หรือยอด "0" ไม่ออก
  // จึงรับแถวที่ไม่มีเลขลำดับแต่มีชื่อรายการและยอดเงิน (ยกเว้นแถว "รวม...") และแถวที่มีแต่ข้อความ
  // ต่อจากรายการก่อนหน้าในหมวดเดียวกัน ถือเป็นชื่อรายการที่ขึ้นบรรทัดใหม่
  function parseRows(rows, options) {
    var orderOptional = !!(options && options.orderOptional);
    var lines = [];
    var warnings = [];
    var group = null;
    var COLS = detectColumns(rows);
    var foundHeader = COLS.detected;
    var lastLineGroup = undefined;

    rows.forEach(function (row, idx) {
      if (!row || !row.length) return;
      var a = cell(row, COLS.order);
      var b = cell(row, COLS.itemName);
      if (!foundHeader && /รายการค่าใช้จ่าย/.test(b)) foundHeader = true;
      // แถวหัวหมวด: มีข้อความช่องเดียวขึ้นต้นด้วย "หมวด" (ใน Word/PDF มักเป็นช่องที่ผสานกันทั้งแถว)
      var filled = row.map(text).filter(Boolean);
      // แบบเสนอโครงการ RS-01 ใส่เลขหน้าหมวด ("1. หมวดค่าตอบแทน", "3.หมวดวัสดุ") — ตัดเลขออก
      if (filled.length === 1 && /^(?:\d+\.\s*)?หมวด/.test(filled[0]) && !/^\d+\.?$/.test(a)) {
        group = filled[0].replace(/^\d+\.\s*/, "");
        lastLineGroup = undefined;
        return;
      }
      a = a.replace(/\.$/, "");

      var installments = [num(row, COLS.inst1), num(row, COLS.inst2), num(row, COLS.inst3)];
      var installmentSum = installments[0] + installments[1] + installments[2];
      var total = num(row, COLS.total) || installmentSum;

      if (!/^\d+$/.test(a)) {
        if (!orderOptional || a || !b || /^(รวม|ลำดับ|รายการ)/.test(b)) return;
        if (total <= 0) {
          // ต่อชื่อรายการเฉพาะบรรทัดที่เห็นชัดว่าเป็นส่วนต่อ: ชื่อก่อนหน้ายังเปิดวงเล็บค้าง หรือบรรทัดนี้เป็นวงเล็บ
          // อธิบาย — ไม่ต่อรายชื่อบุคคลหรือหัวข้อย่อย "- ..." ที่ตามมาใต้รายการ
          var prev = lines[lines.length - 1];
          var openParen = prev && (prev.itemName.split("(").length > prev.itemName.split(")").length);
          if (prev && lastLineGroup === group && !cell(row, COLS.multiplier) && (openParen || /^\(/.test(b))) prev.itemName += " " + b;
          return;
        }
      } else if (!b) {
        return;
      }
      if (total <= 0) {
        warnings.push("แถว " + (idx + 1) + " \"" + b + "\" ไม่มียอดเงิน — ข้ามไป");
        return;
      }
      if (installmentSum > 0 && Math.abs(installmentSum - total) > 0.5) {
        warnings.push("แถว " + (idx + 1) + " \"" + b + "\" ยอดงวด 1–3 รวมกัน (" + installmentSum + ") ไม่เท่ากับยอดรวม (" + total + ")");
      }
      var multiplier = parseMultiplier(cell(row, COLS.multiplier));
      if (multiplier.unitPrice !== null && multiplier.quantity !== null &&
          Math.abs(multiplier.unitPrice * multiplier.quantity - total) > 0.5) {
        warnings.push("แถว " + (idx + 1) + " \"" + b + "\" ตัวคูณ (" + multiplier.unitPrice + " × " + multiplier.quantity + ") ไม่เท่ากับยอดรวม (" + total + ")");
      }
      lines.push({
        group: group,
        itemName: b,
        multiplierText: cell(row, COLS.multiplier),
        unitPrice: multiplier.unitPrice,
        quantity: multiplier.quantity,
        installmentAmounts: installments,
        total: Math.round(total * 100) / 100,
        ruleCategory: guessRuleCategory(b, group),
      });
      lastLineGroup = group;
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
    // แบบเสนอโครงการ RS-01 เขียนเป็น "ค่าวัสดุเชื้อเพลิงและหล่อลื่น" (1,500 บาท/คัน/วัน = อัตราในจังหวัด)
    [/เชื้อเพลิงและหล่อลื่น.*ต่างจังหวัด/, "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ต่างจังหวัด)"],
    [/เชื้อเพลิงและหล่อลื่น/, "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ในจังหวัด)"],
    [/รถตู้|เช่ายานพาหนะ/, "ค่าเช่ายานพาหนะ (รถตู้)"],
    [/ที่พัก.*(เหมาจ่าย|บ้านญาติ|บ้านตนเอง)|(เหมาจ่าย|บ้านญาติ).*ที่พัก/, "ค่าที่พัก (เหมาจ่าย พักบ้านญาติ/บ้านตนเอง)"],
    [/ที่พัก/, "ค่าที่พัก (โรงแรม)"],
    [/เบี้ยเลี้ยง/, "ค่าเบี้ยเลี้ยงเดินทาง"],
    [/จริยธรรม/, "ค่าธรรมเนียมการขอจริยธรรมการวิจัยในมนุษย์"],
    [/ค่าธรรมเนียมอื่น/, "ค่าธรรมเนียมอื่นๆ"],
    [/ถ่ายเอกสาร/, "ค่าถ่ายเอกสาร"],
    [/รูปเล่ม/, "ค่าจัดทำรูปเล่มรายงานวิจัย"],
    [/วัสดุสำนักงาน/, "ค่าวัสดุสำนักงาน"],
    [/โปรแกรมคอมพิวเตอร์|ลิขสิทธิ์/, "ค่าวัสดุโปรแกรมคอมพิวเตอร์/ค่าลิขสิทธิ์โปรแกรม"],
    [/วัสดุคอมพิวเตอร์/, "ค่าวัสดุคอมพิวเตอร์"],
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

  return { parseRows: parseRows, detectColumns: detectColumns, parseMultiplier: parseMultiplier, guessRuleCategory: guessRuleCategory, pickSheetName: pickSheetName };
});
