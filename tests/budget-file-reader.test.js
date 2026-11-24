// Run: node --test tests/budget-file-reader.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { docxXmlToTables, pickBudgetTable, pdfItemsToRows, ocrPagesToRows, extensionOf } =require("../app/js/budget-file-reader.js");
const { parseRows } = require("../app/js/budget-parser.js");

const tc = (text, span) => `<w:tc><w:tcPr>${span ? `<w:gridSpan w:val="${span}"/>` : ""}</w:tcPr><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
const tr = (...cells) => `<w:tr>${cells.join("")}</w:tr>`;
const docXml = `<w:document><w:body>
  <w:tbl>${tr(tc("ชื่อโครงการ"), tc("ทดสอบ"))}</w:tbl>
  <w:tbl>
    ${tr(tc("ลำดับ"), tc("รายการค่าใช้จ่าย"), tc("ตัวคูณ"), tc("งวดที่ 1"), tc("งวดที่ 2"), tc("งวดที่ 3"), tc("รวม"))}
    ${tr(tc("หมวดค่าใช้สอย", 7))}
    ${tr(tc("1"), tc("ค่าอาหารกลางวัน &amp; อาหารว่าง"), tc("150 บาท x 20 คน x 2 มื้อ"), tc("3,000"), tc("2,400"), tc("600"), tc("6,000"))}
    ${tr(tc("รวม", 6), tc("6,000"))}
  </w:tbl>
</w:body></w:document>`;

test("Word: reads tables, expands merged cells and decodes entities", () => {
  const tables = docxXmlToTables(docXml);
  assert.equal(tables.length, 2);
  const t = pickBudgetTable(tables);
  assert.equal(t[1].length, 7, "a group row merged over 7 columns keeps 7 cells");
  assert.equal(t[2][1], "ค่าอาหารกลางวัน & อาหารว่าง");
  const { lines, warnings } = parseRows(t);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].group, "หมวดค่าใช้สอย");
  assert.equal(lines[0].total, 6000);
  assert.equal(lines[0].quantity, 40);
  assert.ok(!warnings.some((w) => /หัวตาราง/.test(w)));
});

test("Word: several paragraphs in one cell become one line each", () => {
  const xml = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>งวดที่ 1</w:t></w:r></w:p><w:p><w:r><w:t>50%</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
  assert.equal(docxXmlToTables(xml)[0][0][0], "งวดที่ 1\n50%");
});

// ตำแหน่งข้อความแบบที่ได้จาก PDF ที่ export จาก Word: หัวตาราง 2 แถว, ข้อความไทยแตกเป็นหลายชิ้น,
// ตัวเลขชิดขวา, ชื่อรายการยาวจนจุดกึ่งกลางเลยไปทางขวา
const X = { order: 40, item: 120, mult: 300, i1: 380, i2: 440, i3: 500, total: 560 };
const it = (str, x, y, w) => ({ str, x, y, w: w != null ? w : str.length * 5 });
const pdfItems = [
  it("ลำดับ", X.order - 12, 100), it("รายการ", X.item - 25, 100), it("ค่าใช้จ่าย", X.item + 5, 100),
  it("ตัวคูณ", X.mult - 15, 100),
  it("งวดที่ 1", X.i1 - 20, 112), it("งวดที่ 2", X.i2 - 20, 112), it("งวดที่ 3", X.i3 - 20, 112), it("รวม", X.total - 10, 112),
  it("หมวดค่าตอบแทน", 60, 130),
  it("1", X.order - 2, 150), it("ค่าตอบแทน – นักศึกษาช่วยงานด้านวิชาการ (ปฏิบัติงานตลอดโครงการ)", 70, 150, 190),
  it("60 บาท x 100 ชม.", X.mult - 25, 151), it("3,000", X.i1 - 5, 150), it("2,400", X.i2 - 5, 150), it("600", X.i3 + 2, 150), it("6,000", X.total - 5, 150),
  it("2", X.order - 2, 170), it("ค่าตอบแทน", 70, 170), it("ผู้ให้สัมภาษณ์", 116, 170), it("100 บาท x 30 คน", X.mult - 25, 170),
  it("1,500", X.i1 - 5, 170), it("1,200", X.i2 - 5, 170), it("300", X.i3 + 2, 170), it("3,000", X.total - 5, 170),
];

test("PDF: rebuilds rows and columns from text positions", () => {
  const { rows, headerFound } = pdfItemsToRows(pdfItems);
  assert.equal(headerFound, true);
  const { lines, warnings } = parseRows(rows);
  assert.ok(!warnings.some((w) => /หัวตาราง/.test(w)), warnings.join(" | "));
  assert.equal(lines.length, 2);
  assert.match(lines[0].itemName, /นักศึกษาช่วยงานด้านวิชาการ/);
  assert.equal(lines[0].multiplierText, "60 บาท x 100 ชม.");
  assert.equal(lines[0].installmentAmounts.join(","), "3000,2400,600");
  assert.equal(lines[0].total, 6000);
  assert.equal(lines[1].itemName, "ค่าตอบแทนผู้ให้สัมภาษณ์", "touching Thai fragments join without a space");
  assert.equal(lines[1].group, "หมวดค่าตอบแทน");
  assert.equal(lines[1].total, 3000);
});

test("scanned file: OCR line boxes become rows, text before the table is dropped, missing tone mark tolerated", () => {
  const L = (text, x, y, w, h = 40) => ({ text, confidence: 0.95, box: { x, y, w, h } });
  const pages = [
    { lines: [L("ข้อเสนอโครงการวิจัย", 100, 50, 500), L("รายการเอกสารแนบ", 100, 120, 400)] },
    { lines: [
      L("ลำดับ", 80, 100, 90), L("รายการ", 300, 100, 120), L("ตัวคูณ", 700, 100, 110),
      L("งวดที 1", 900, 104, 120), L("งวดที 2", 1060, 98, 120), L("งวดที 3", 1220, 102, 120), L("รวม", 1400, 100, 70),
      L("หมวดค่าตอบแทน", 200, 180, 300),
      L("1", 110, 250, 20), L("ค่าตอบแทนผู้ให้สัมภาษณ์", 200, 255, 420), L("100 บาท x 30 คน", 650, 248, 230),
      L("1,500", 920, 252, 90), L("1,200", 1080, 249, 90), L("300", 1250, 253, 60), L("3,000", 1400, 250, 90),
    ] },
  ];
  const { rows, headerFound } = ocrPagesToRows(pages);
  assert.equal(headerFound, true);
  assert.match(rows[0][0], /^ลำดับ/, "the proposal text before the table is gone");
  const { lines, warnings } = parseRows(rows);
  assert.ok(!warnings.some((w) => /หัวตาราง/.test(w)), warnings.join(" | "));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].itemName, "ค่าตอบแทนผู้ให้สัมภาษณ์");
  assert.equal(lines[0].group, "หมวดค่าตอบแทน");
  assert.equal(lines[0].installmentAmounts.join(","), "1500,1200,300");
  assert.equal(lines[0].total, 3000);
  assert.equal(lines[0].quantity, 30);
});

// โครงตามแบบเสนอโครงการ RS-01 ที่สแกนจริง (ข้อความรายการเป็นตัวอย่าง): หน้าแรกมีตารางสรุปข้อ 17 ที่มี "งวดที่"
// แต่ไม่มี "รายการ", หัวตาราง 17.2 ใช้ "งวด 1" และ "(แตกตัวคูณ...)", ไม่มีคอลัมน์ลำดับ, หมวดมีเลขนำหน้า,
// ตัวเลขอยู่ต่ำกว่าชื่อรายการเล็กน้อย, ชื่อรายการยาวขึ้นบรรทัดใหม่ในวงเล็บ, มีรายชื่อบุคคลใต้รายการ
test("scanned RS-01 proposal: per-page header, 'งวด 1' columns, numbered groups, offset amounts", () => {
  const L = (text, x, y, w, h = 40) => ({ text, confidence: 0.95, box: { x, y, w, h } });
  const pages = [
    { lines: [L("17. งบประมาณ", 400, 200, 200), L("หมวด", 430, 280, 90), L("งวดที่ 1", 660, 370, 115), L("งวดที่ 2", 850, 370, 113),
      L("งวดที่ 3", 1050, 370, 108), L("1. ค่าตอบแทน/ค่าจ้าง", 330, 495, 270), L("9,000.00", 680, 498, 123), L("55,000.00", 1260, 500, 135)] },
    { lines: [
      L("RS-01", 2010, 86, 125),
      L("รายการค่าใช้จ่าย", 311, 212, 182), L("จำนวนเงิน (บาท)", 1626, 221, 186),
      L("(แตกตัวคูณของแต่ละรายการ)", 796, 267, 315), L("งวด 1", 1278, 276, 74), L("งวด 2", 1554, 276, 76), L("งวด 3", 1830, 280, 76), L("รวม", 2107, 286, 53),
      L("(ตัวเลขต้องครบ 50%)", 1196, 317, 239),
      L("1. หมวดค่าตอบแทน", 84, 417, 233),
      L("ค่าตอบแทนผู้ทรงคุณวุฒิพิจารณาเครื่องมือ", 84, 470, 520), L("2000 บาท x 5 คน", 735, 474, 208),
      L("10,000.00", 1597, 488, 121), L("10,000.00", 2127, 496, 123),
      L("จำนวน 5 ท่าน ได้แก่", 88, 527, 219), L("1. ผู้ทรงคุณวุฒิคนที่หนึ่ง", 78, 580, 270),
      L("2. หมวดค่าใช้สอย", 82, 640, 207),
      L("ค่าเช่าเหมายานพาหนะ (รถตู้รับส่ง", 82, 690, 580), L("2000 บาท x 1 คัน x 9 วัน", 737, 700, 280),
      L("18,000.00", 1318, 706, 121), L("18,000.00", 2127, 716, 121),
      L("อาสาสมัคร ภายในจังหวัด)", 84, 745, 600),
      L("39,900.00", 1318, 800, 121), L("42,900.00 (28.91%)", 2015, 805, 227),
      L("15", 1130, 1518, 59),
    ] },
  ];
  const { rows, headerFound } = ocrPagesToRows(pages);
  assert.equal(headerFound, true);
  assert.ok(!rows.some((r) => r.includes("55,000.00")), "the item-17 summary table on page 1 is not read as 17.2");
  const { lines, warnings } = parseRows(rows, { orderOptional: true });
  assert.ok(!warnings.some((w) => /หัวตาราง/.test(w)), warnings.join(" | "));
  assert.deepEqual(lines.map((l) => [l.group, l.itemName, l.installmentAmounts.join(","), l.total]), [
    ["หมวดค่าตอบแทน", "ค่าตอบแทนผู้ทรงคุณวุฒิพิจารณาเครื่องมือ", "0,10000,0", 10000],
    ["หมวดค่าใช้สอย", "ค่าเช่าเหมายานพาหนะ (รถตู้รับส่ง อาสาสมัคร ภายในจังหวัด)", "18000,0,0", 18000],
  ]);
  assert.equal(lines[0].quantity, 5);
  assert.equal(lines[1].quantity, 9);
});

test("PDF without a recognisable header falls back to one cell per phrase", () => {
  const { headerFound, rows } = pdfItemsToRows([it("ข้อความ", 10, 10), it("อื่น", 200, 10)]);
  assert.equal(headerFound, false);
  assert.equal(rows[0].length, 2);
});

test("file extension detection", () => {
  assert.equal(extensionOf("ประมาณการ.DOCX"), "docx");
  assert.equal(extensionOf("budget.final.pdf"), "pdf");
  assert.equal(extensionOf("noext"), "");
});
