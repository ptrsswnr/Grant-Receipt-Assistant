// Run: node --test tests/budget-parser.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRows, parseMultiplier, guessRuleCategory, pickSheetName } = require("../app/js/budget-parser.js");

// หัวตารางตรงตามชีต "ตาราง ข้อ 17.2" ของไฟล์ตัวช่วยมหาวิทยาลัย; รายการเป็นตัวอย่างที่กรอกเอง
const sheet = [
  ["17.2 รายละเอียดงบประมาณการวิจัยจำแนกตามงบประเภทต่างๆ", "", "", "", "", "", "", "", "* คำอธิบาย (ลบออกก่อนพิมพ์)"],
  ["ลำดับ", "รายการค่าใช้จ่าย", "(แตกตัวคูณของแต่ละรายการ)", "จำนวนเงิน (บาท)"],
  ["", "", "", "งวดที่ 1\n50%", "งวดที่ 2\n40%", "งวดที่ 3\n10%", "รวม\n100%"],
  ["", "หมวดค่าตอบแทน"],
  ["1", "ค่าตอบแทน – นักศึกษาช่วยงานด้านวิชาการ", "60 บาท x 100 ชม.", 3000, 2400, 600, 6000],
  ["2", "ค่าตอบแทน – ผู้ให้สัมภาษณ์", "100 บาท x 30 คน", 1500, 1200, 300, 3000],
  ["3", "", "", "", "", "", "0.00"],
  ["รวม", "", "", 4500, 3600, 900, 9000],
  ["", "หมวดค่าใช้สอย"],
  ["1", "ค่าใช้จ่ายในการจัดประชุม - ค่าอาหารกลางวัน (แนบกำหนดการ)", "150 บาท x 20 คน x 2 มื้อ", 3000, 2400, 600, 6000],
  ["2", "ค่าถ่ายเอกสาร", "", "1,000.00", "800.00", "200.00", "2,000.00"],
  ["", "หมวดค่าใช้สอย - ค่าเดินทาง"],
  ["1", "ค่าพาหนะในการเดินทางไปปฏิบัติงาน (รถยนต์ส่วนบุคคล)", "200 กม. x 2 x 4 บาท x 3 ครั้ง", 2400, 2400, 0, 4800],
  ["", "หมวดครุภัณฑ์"],
  ["1", "เครื่องวัดค่าคุณภาพน้ำ", "1 เครื่อง", 25000, 0, 0, 30000],
  ["รวมงบประมาณที่เสนอขอ", "", "", 0, 0, 0, 0],
];

test("parses line items with their category group, multiplier and installments", () => {
  const { lines } = parseRows(sheet);
  assert.equal(lines.length, 6);
  const lunch = lines[2];
  assert.equal(lunch.group, "หมวดค่าใช้สอย");
  assert.equal(lunch.multiplierText, "150 บาท x 20 คน x 2 มื้อ");
  assert.deepEqual([...lunch.installmentAmounts], [3000, 2400, 600]);
  assert.equal(lunch.total, 6000);
});

test("skips empty template rows, subtotal rows and the grand total", () => {
  const names = parseRows(sheet).lines.map((l) => l.itemName);
  assert.ok(!names.includes(""));
  assert.ok(!names.some((n) => /รวม/.test(n)));
});

test("reads numbers formatted as text with thousands separators", () => {
  assert.equal(parseRows(sheet).lines.find((l) => l.itemName === "ค่าถ่ายเอกสาร").total, 2000);
});

test("warns when installments don't add up to the total", () => {
  const { warnings } = parseRows(sheet);
  assert.ok(warnings.some((w) => /เครื่องวัดค่าคุณภาพน้ำ/.test(w)));
});

test("warns when the file doesn't look like table 17.2", () => {
  const { warnings, lines } = parseRows([["a", "b"], ["1", "x", "", 1, 0, 0, 1]]);
  assert.equal(lines.length, 1);
  assert.match(warnings[0], /ไม่พบหัวตาราง/);
});

test("guesses the regulation category from the official item name", () => {
  const { lines } = parseRows(sheet);
  assert.deepEqual(lines.map((l) => l.ruleCategory), [
    "ค่าตอบแทนนักศึกษาช่วยงาน (วิชาการ)",
    "ค่าตอบแทนอาสาสมัคร/ผู้ให้ข้อมูล",
    "ค่าอาหารกลางวัน (ประชุม/อบรม)",
    "ค่าถ่ายเอกสาร",
    "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)",
    "ค่าครุภัณฑ์",
  ]);
});

test("service hire for analysis maps to hire, not to the analysis fee", () => {
  assert.equal(guessRuleCategory("ค่าจ้างเหมาวิเคราะห์ทดสอบทางวิทยาศาสตร์ (แนบ TOR)"), "ค่าจ้างเหมาบริการ");
  assert.equal(guessRuleCategory("ค่าธรรมเนียมเครื่องมือวิเคราะห์ทดสอบ (แนบอัตราค่าบริการหรือใบเสนอราคา)"), "ค่าธรรมเนียมห้องปฏิบัติการ/เครื่องมือ");
});

test("every guessed category exists in data.js", () => {
  const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/js/data.js"), "utf8"), sandbox);
  const categories = new Set(sandbox.window.RECEIPT_DATA.categories);
  // รายการทางการทั้งหมดจากชีต "Sheet2" ของไฟล์ตัวช่วย
  const official = [
    "ค่าตอบแทน – นักศึกษาช่วยงานด้านวิชาการ", "ค่าตอบแทน – นักศึกษาช่วยงานทั่วไป", "ค่าตอบแทน – ผู้ให้ข้อมูล",
    "ค่าตอบแทน – ผู้ให้สัมภาษณ์", "ค่าตอบแทน – ผู้ตอบแบบสอบถาม", "ค่าตอบแทน – อาสาสมัคร",
    "ค่าใช้จ่ายในการจัดประชุม - ค่าอาหารกลางวัน (แนบกำหนดการ)", "ค่าใช้จ่ายในการจัดประชุม - ค่าอาหารว่าง (แนบกำหนดการ)",
    "ค่าธรรมเนียมการขอจริยธรรมการวิจัยในมนุษย์ ", "ค่าธรรมเนียมการใช้ห้องปฏิบัติการ (แนบอัตราค่าบริการหรือใบเสนอราคา)",
    "ค่าธรรมเนียมเครื่องมือวิเคราะห์ทดสอบ (แนบอัตราค่าบริการหรือใบเสนอราคา)", "ค่าธรรมเนียมอื่น - ระบุ (แนบอัตราค่าบริการหรือใบเสนอราคา)",
    "ค่าถ่ายเอกสาร", "ค่าจัดทำรูปเล่มรายงานวิจัยฯ ", "ค่าไปรษณีย์และขนส่ง", "ค่าโทรศัพท์และโทรสารในประเทศ", "ค่าบริการทางอินเตอร์เน็ต",
    "ค่ายานพาหนะเครื่องบินอาจารย์", "ค่าพาหนะในการเดินทางไปปฏิบัติงาน (รถยนต์ส่วนบุคคล)", "ค่าเช่ายานพาหนะรถตู้ (แนบ TOR)",
    "ค่าพาหนะในการเดินทางไปปฏิบัติงาน (Taxi)", "ค่าที่พัก ", "ค่าเบี้ยเลี้ยง (กรณีเดินทางออกนอกพื้นที่จังหวัด)",
    "ค่าจ้างเหมาผู้ช่วยจัดทํารายงานการเงินและเบิกจ่ายงบประมาณ (แนบ TOR)", "ค่าจ้างเหมาวิเคราะห์ทดสอบทางวิทยาศาสตร์ (แนบ TOR)",
    "ค่าจ้างเหมาวิเคราะห์ทางการแพทย์ (แนบ TOR)", "ค่าจ้างเหมาผู้ช่วยเก็บข้อมูลในพื้นที่ (แนบ TOR)", "ค่าจ้างเหมาผู้นำทางในพื้นที่ (ล่าม) (แนบ TOR)",
    "ค่าจ้างเหมาถอดเทป (แนบ TOR)", "ค่าจ้างเหมาอื่นๆ - ระบุ (แนบ TOR)",
    "ค่าวัสดุสำนักงาน", "ค่าวัสดุคอมพิวเตอร์ ", "ค่าวัสดุวิทยาศาสตร์ ", "ค่าวัสดุโปรแกรมคอมพิวเตอร์หรือค่าลิขสิทธิ์โปรแกรมคอมพิวเตอร์ (แนบ TOR)",
    "ค่าวัสดุไฟฟ้าและวิทยุ", "ค่าวัสดุงานบ้านงานครัว", "ค่าวัสดุก่อสร้างและประปา", "ค่าวัสดุเชื้อเพลิงและหล่อลื่น", "ค่าวัสดุการเกษตร",
    "ค่าวัสดุโฆษณาและเผยแพร่", "ค่าวัสดุเครื่องแต่งกาย", "ค่าวัสดุกีฬา", "ค่าวัสดุสื่อ/ตำรา/วารสาร", "ค่าเวชภัณฑ์ยา",
    "ค่าเวชภัณฑ์ที่มิใช่ยา", "ค่าบรรจุภัณฑ์", "ค่าวัสดุของที่ระลึก", "ค่าวัสดุอื่นๆ",
  ];
  const unmapped = [];
  for (const name of official) {
    const guess = guessRuleCategory(name);
    if (guess === null) unmapped.push(name.trim());
    else assert.ok(categories.has(guess), `${name} → ${guess}`);
  }
  // รายการที่ระเบียบในระบบยังไม่มีหมวดรองรับ — ต้องเพิ่ม ruleItem ก่อนจึงจะตรวจได้
  // ทุกรายการทางการมีหมวดตามระเบียบรองรับแล้ว (เพิ่ม 4 หมวดที่เคยขาด เมื่อ 2026-11-15)
  assert.deepEqual(unmapped, []);
  assert.equal(guessRuleCategory("ค่าวัสดุโปรแกรมคอมพิวเตอร์หรือค่าลิขสิทธิ์โปรแกรมคอมพิวเตอร์ (แนบ TOR)"), "ค่าวัสดุโปรแกรมคอมพิวเตอร์/ค่าลิขสิทธิ์โปรแกรม");
  assert.equal(guessRuleCategory("ค่าวัสดุคอมพิวเตอร์ "), "ค่าวัสดุคอมพิวเตอร์");
});

test("reads unit price and quantity from the multiplier column", () => {
  const cases = [
    ["60 บาท x 100 ชม.", 60, 100],
    ["200 กม. x 2 x 4 บาท x 3 ครั้ง", 4, 1200],
    ["150 บาท x 20 คน x 2 มื้อ", 150, 40],
    ["1,800 บาท × 2 คน × 3 คืน", 1800, 6],
  ];
  for (const [text, unitPrice, quantity] of cases) {
    const r = parseMultiplier(text);
    assert.equal(r.unitPrice, unitPrice, text);
    assert.equal(r.quantity, quantity, text);
  }
  for (const text of ["ไม่เกิน 5,000 บาท", "....... บาท x … คน x ..... ครั้ง", ""]) {
    assert.equal(parseMultiplier(text).quantity, null, text);
  }
});

test("parsed lines carry quantity, and a multiplier that doesn't match the total is flagged", () => {
  const { lines, warnings } = parseRows(sheet);
  assert.equal(lines[0].quantity, 100);
  assert.equal(lines[0].unitPrice, 60);
  const odd = parseRows([["ลำดับ", "รายการค่าใช้จ่าย"], ["1", "ค่าตอบแทน – ผู้ให้ข้อมูล", "100 บาท x 30 คน", 2000, 0, 0, 2000]]);
  assert.ok(odd.warnings.some((w) => /ตัวคูณ/.test(w)));
});

test("lodging guesses hotel unless the item says flat-rate or relative's home", () => {
  assert.equal(guessRuleCategory("ค่าที่พัก "), "ค่าที่พัก (โรงแรม)");
  assert.equal(guessRuleCategory("ค่าที่พัก (เหมาจ่าย 800 บาท)"), "ค่าที่พัก (เหมาจ่าย พักบ้านญาติ/บ้านตนเอง)");
});

test("picks the 17.2 sheet by name, else the first sheet", () => {
  assert.equal(pickSheetName(["ตาราง ข้อ 17", "ตาราง ข้อ 17.2", "Sheet2"]), "ตาราง ข้อ 17.2");
  assert.equal(pickSheetName(["Sheet1"]), "Sheet1");
});

// ─── ตารางจาก Word/PDF: คอลัมน์อาจสลับที่ หัวหมวดอยู่ช่องแรก ลำดับมีจุด ───
const { detectColumns } = require("../app/js/budget-parser.js");
const wordTable = [
  ["ลำดับ", "รายการค่าใช้จ่าย", "ตัวคูณ", "รวม", "งวดที่ 1", "งวดที่ 2", "งวดที่ 3"],
  ["หมวดค่าตอบแทน", "", "", "", "", "", ""],
  ["1.", "ค่าตอบแทน – นักศึกษาช่วยงานด้านวิชาการ", "60 บาท x 100 ชม.", "6,000", "3,000", "2,400", "600"],
  ["", "รวมหมวด", "", "6,000", "", "", ""],
  ["หมวดค่าวัสดุ", "", "", "", "", "", ""],
  ["1.", "ค่าวัสดุสำนักงาน", "", "4,000", "4,000", "", ""],
];

test("finds columns from the header even when they are in a different order", () => {
  const c = detectColumns(wordTable);
  assert.equal(c.detected, true);
  assert.equal(c.total, 3);
  assert.equal(c.inst1, 4);
  const { lines } = parseRows(wordTable);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].total, 6000);
  assert.equal(lines[0].installmentAmounts.join(","), "3000,2400,600");
  assert.equal(lines[0].quantity, 100);
  assert.equal(lines[1].group, "หมวดค่าวัสดุ");
  assert.equal(lines[1].ruleCategory, "ค่าวัสดุสำนักงาน");
});

test("falls back to the helper-file column positions when there is no header", () => {
  const c = detectColumns([["1", "ค่าถ่ายเอกสาร", "", 0, 0, 0, 500]]);
  assert.equal(c.detected, false);
  assert.equal(c.total, 6);
});
