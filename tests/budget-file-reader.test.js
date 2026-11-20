// Run: node --test tests/budget-file-reader.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { docxXmlToTables, pickBudgetTable, pdfItemsToRows, extensionOf } = require("../app/js/budget-file-reader.js");
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
