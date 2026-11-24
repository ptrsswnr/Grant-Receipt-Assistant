// Run: node --test tests/ocr-client.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFields, textForAi, pagesOf } = require("../app/js/ocr-client.js");

const lines = (arr) => ({ lines: arr.map((text) => ({ text, confidence: 0.97 })) });

test("amount comes from the last total line, not item lines", () => {
  const f = extractFields(lines(["ร้านเครื่องเขียน", "ใบเสร็จรับเงิน", "กระดาษ 240.00", "รวม 390.00", "ภาษีมูลค่าเพิ่ม 27.30", "รวมทั้งสิ้น 417.30"]));
  assert.equal(f.amount, 417.3);
});

test("amount with thousands separators, and on the line after the keyword", () => {
  assert.equal(extractFields(lines(["ยอดสุทธิ 12,450.50"])).amount, 12450.5);
  assert.equal(extractFields(lines(["จำนวนเงินรวม", "3,200.00"])).amount, 3200);
});

test("no total keyword → largest amount with decimals", () => {
  assert.equal(extractFields(lines(["ค่าน้ำมัน 1,500.00", "ทอน 20.00"])).amount, 1500);
  assert.equal(extractFields(lines(["ไม่มีตัวเลข"])).amount, null);
});

test("dates in Buddhist era (numeric and Thai month) become ISO", () => {
  assert.equal(extractFields(lines(["วันที่ 12/11/2569"])).date, "2026-11-12");
  assert.equal(extractFields(lines(["วันที่ 5 พ.ย. 69"])).date, "2026-11-05");
  assert.equal(extractFields(lines(["Date 03-01-2026"])).date, "2026-01-03");
  assert.equal(extractFields(lines(["ไม่มีวันที่"])).date, "");
});

test("vendor skips document headings", () => {
  assert.equal(extractFields(lines(["ใบเสร็จรับเงิน/ใบกำกับภาษี", "บริษัท ตัวอย่าง จำกัด", "เลขที่ 001"])).vendorName, "บริษัท ตัวอย่าง จำกัด");
});

test("text sent to the AI marks low-confidence lines", () => {
  const t = textForAi({ lines: [{ text: "รวม 390.00", confidence: 0.99 }, { text: "วันที 1/1/69", confidence: 0.62 }] });
  assert.match(t, /วันที 1\/1\/69 {2}\(OCR ไม่มั่นใจ 62%\)/);
  assert.doesNotMatch(t.split("\n")[0], /ไม่มั่นใจ/);
});

test("pagesOf numbers PDF pages from the server, and treats an image result as one page", () => {
  const pdf = { pages: [{ lines: [{ text: "หน้าแรก", confidence: 0.99 }] }, { lines: [{ text: "หน้าสอง", confidence: 0.5 }] }] };
  const p = pagesOf(pdf);
  assert.deepEqual(p.map((x) => x.page), [1, 2]);
  assert.equal(p[0].text, "หน้าแรก");
  assert.match(p[1].text, /OCR ไม่มั่นใจ 50%/);
  assert.deepEqual(pagesOf({ lines: [{ text: "รูป", confidence: 0.99 }] }, 5).map((x) => x.page), [5]);
});
