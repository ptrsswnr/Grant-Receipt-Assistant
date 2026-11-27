# Batch runner (Stage B)

รันหลายเคส (ใบเสร็จ+เอกสารแนบจริง) ต่อเนื่องโดยไม่ผ่านหน้าจอเว็บ — ใช้วัดความแม่นยำของทั้ง pipeline
(OCR → จัดประเภทเอกสาร → rule engine → LLM verdict) เทียบกับผลตัดสินของเจ้าหน้าที่การเงินจริง สำหรับ
วิทยานิพนธ์ Phase 4 (~100 โครงการจริง ไม่มีผู้ใช้เข้าร่วม)

เรียกใช้โมดูลเดียวกับเว็บจริงทุกตัว ไม่มีตรรกะคู่ขนาน: `app/js/rule-engine.js`,
`app/js/document-classifier.js`, `app/js/receipt-pipeline.js`, `app/js/llm-verdict.js`,
`app/js/ocr-client.js`, `app/js/ai-client.js` — ความแตกต่างจาก `research/eval/` (ซึ่งรับ
category/amount/evidence ที่สกัดไว้แล้วจาก CSV) คือตัวนี้เริ่มจากไฟล์ใบเสร็จ/เอกสารแนบจริง รัน OCR เอง
และให้ LLM ตัดสินเอง (ไม่ใช่ rule-engine ล้วนหรือ LLM-only baseline)

## วิธีรัน

```
node research/batch/run-batch.js research/batch/cases.example --verdict-mode rule
node research/batch/run-batch.js research/batch/cases.example --verdict-mode llm
```

- `--verdict-mode llm` (ค่าเริ่มต้น): ให้ LLM ตัดสิน pass/fail เอง (เหมือนเว็บจริงโหมด `llm`) — ต้องตั้งค่า
  AI ที่ `research/eval/ai-config.local.json` ก่อน (ไฟล์เดียวกับ `research/eval/baseline.js` ใช้ — ดู
  `research/eval/README.md`)
- `--verdict-mode rule`: ใช้ผลของ rule engine ล้วน ไม่เรียก AI เลย (ไม่มีค่าใช้จ่าย ใช้ตรวจโค้ด/เทียบ baseline)

ไฟล์จริง (`.jpg`/`.png`/`.pdf`) ที่ให้ OCR อ่านเองต้องเปิด `research/ocr/server.py` ไว้ก่อน (ดู
`CLAUDE.md` → "Local Thai OCR") ถ้าต่อไม่ได้สคริปต์จะหยุดก่อนเริ่ม ไม่รันต่อแบบไม่มี OCR — เคสที่ใส่
`ocrText` ไว้ล่วงหน้า (เช่น `cases.example/`) ข้ามขั้นตอนนี้ไป ไฟล์ที่ OCR อ่านพลาดระหว่างรันจะนับไว้ในคอลัมน์
`ocrErrors`

ตัวชี้วัดหลักเป็นแบบ **pass/fail** (ผลของการเงินที่ไม่ใช่ "ผ่าน" นับเป็น fail) เพราะ LLM ตอบได้แค่ 2 แบบ:
accuracy, kappa, missed (มีปัญหาจริงแต่ปล่อยผ่าน), false alarm — แบบ 4 ผลยังอยู่ใน JSON (`metrics`) ใช้กับ
`--verdict-mode rule`

ผลลัพธ์อยู่ที่ `research/batch/output/` เป็นไฟล์ `.json` (ข้อมูลดิบทุกขั้นของทุกเคส: ผล OCR ดิบ, ผล LLM
ดิบ, เวลาที่ใช้) กับ `.csv` (สรุปแถวเดียวต่อเคส) — ทุกครั้งที่รันบันทึก `runMeta` ไว้ด้วยเสมอ: ชื่อรุ่น OCR,
ชื่อรุ่น LLM, เวอร์ชัน prompt (`LlmVerdict.PROMPT_VERSION`), เวอร์ชันชุดกฎ (`ruleSet.versionLabel`)

## โครงสร้างโฟลเดอร์เคส

แต่ละเคสเป็นโฟลเดอร์ย่อยหนึ่งโฟลเดอร์ มี `meta.json`:

```json
{
  "fundSourceId": "fundsource002",
  "category": "ค่าวัสดุสำนักงาน",
  "amount": 3200,
  "date": "2026-05-10",
  "projectName": "ชื่อโครงการตามที่ลงทะเบียน",
  "contractStart": "2025-10-01",
  "contractEnd": "2026-09-30",
  "financeVerdict": "ผ่าน",
  "note": "หมายเหตุอิสระ ใช้วิเคราะห์เคสที่ไม่ตรงกัน",
  "estimate": [
    { "id": "line001", "group": "หมวดค่าวัสดุ", "itemName": "ค่าวัสดุสำนักงาน", "multiplierText": "",
      "total": 10000, "spentBefore": 2000, "ruleCategory": "ค่าวัสดุสำนักงาน" }
  ],
  "files": [
    { "fileName": "receipt.jpg", "path": "receipt.jpg" },
    { "fileName": "inspection.jpg", "ocrText": "ข้อความ OCR ที่เตรียมไว้ล่วงหน้า — ข้ามการเรียก OCR จริง" }
  ]
}
```

- `category`/`amount` เป็นค่าที่กำหนดไว้ล่วงหน้า (ไม่ได้รันการอ่านด้วย AI/OCR ซ้ำในขั้นนี้ — เหมือน
  `research/eval/`'s CSV) เพื่อแยกวัดความแม่นยำของ "การตัดสิน" ออกจากความแม่นยำของ "การอ่านฟิลด์"
- `estimate` (บังคับ — เคสที่ไม่มีจะทำให้หยุดรัน เหมือนที่เว็บบังคับให้มีประมาณการก่อนอัปโหลด): ประมาณการของ
  โครงการ ณ วันที่ยื่นใบเสร็จนี้ `spentBefore` คือยอดที่เบิกจากรายการนั้นไปแล้วก่อนใบนี้ `ruleCategory` ใช้ให้
  rule engine จับคู่รายการกับหมวด ส่วน LLM ได้ตารางทั้งหมด (ไม่มี `ruleCategory`) แล้วเลือกรายการเอง
- ไฟล์แต่ละไฟล์ให้ `path` (ไฟล์จริงในโฟลเดอร์เคส ให้ OCR อ่านจริง) **หรือ** `ocrText` (ข้อความที่เตรียมไว้
  แล้ว ข้ามการเรียก OCR จริง — ใช้กับเคสสังเคราะห์/ทดสอบโค้ด)
- `cases.example/` เป็น**เคสสมมติ**ไว้ทดสอบโค้ดเท่านั้น (ใช้ `ocrText` ล้วน ไม่มีไฟล์จริง) ห้ามรายงานเป็น
  ผลวิจัย

## ข้อมูลจริง

1. วางไฟล์ไว้ใน `research/batch/data/` (gitignored, ห้าม commit — มีรูปใบเสร็จจริงและผลตัดสินของการเงิน)
2. ต้องได้รับอนุมัติจริยธรรมการวิจัย (EC) ก่อนเก็บข้อมูล (ดู `research/eval/README.md` ข้อเดียวกัน)
3. รหัสเอกสาร (`documentTypes`) และหมวดค่าใช้จ่าย (`categories`) ต้องสะกดตรงกับใน `app/js/data.js`

## ไฟล์สแกนทั้งโครงการ (Stage C) — `run-bundle.js`

`run-batch.js` ข้างบนรับเคสที่แยกเป็นใบเสร็จแต่ละรายการไว้แล้ว ส่วน `run-bundle.js` รับไฟล์สแกนที่มีเอกสาร
หลายใบปนกัน (1 ไฟล์ = ทั้งโครงการ หรือ 1 ไฟล์ = เอกสารใบเดียวก็ได้) แล้วทำทุกขั้นเหมือนหน้า
`app/batch-import.html`: OCR ทุกหน้า → แยกเอกสาร+ประเภท → ดึงฟิลด์ → จัดกลุ่มเป็นรายการค่าใช้จ่าย →
จับคู่ประมาณการ + ตัดสิน (`app/js/document-pipeline.js`)

```
node research/batch/run-bundle.js research/batch/bundles.example --verdict-mode rule
```

1 เคส = 1 โครงการ (`meta.json`):

```json
{
  "fundSourceId": "fundsource002",
  "estimate": [ { "id": "line001", "itemName": "ค่าวัสดุสำนักงาน", "total": 10000, "spentBefore": 0, "ruleCategory": "ค่าวัสดุสำนักงาน" } ],
  "files": [ { "fileName": "scan.pdf", "path": "scan.pdf" } ],
  "expectedItems": [ { "fileName": "scan.pdf", "paymentPage": 1, "financeVerdict": "ผ่าน", "note": "" } ]
}
```

- `files[]`: `path` = ไฟล์จริงให้ OCR อ่าน (PDF ส่งทั้งไฟล์ให้ `research/ocr/server.py` ซึ่งอ่านทีละหน้า)
  หรือ `pages: [{ "page": 1, "text": "..." }]` = ข้อความ OCR ที่เตรียมไว้แล้ว (ข้าม OCR)
- `expectedItems` (ไม่บังคับ): ผลของการเงินต่อรายการค่าใช้จ่าย จับคู่กับรายการที่ระบบสร้างด้วย
  (ชื่อไฟล์, หน้าแรกของเอกสารจ่ายเงิน) — รายการของการเงินที่จับคู่ไม่ได้ (ระบบแยก/จัดกลุ่มผิด) นับแยกใน
  `unmatchedExpected` รูปแบบนี้เป็นข้อเสนอ ปรับได้เมื่อได้ข้อมูลจริงจากการเงิน
- แยกเอกสาร/ดึงฟิลด์/จัดกลุ่มใช้ AI ทุกครั้งที่ตั้งค่าไว้ (ทั้งสองโหมด `--verdict-mode` คุมแค่ผู้ตัดสิน)
  **ถ้าไม่มี AI** จะแยกด้วยคำสำคัญ จัดกลุ่มตามลำดับเอกสารจ่ายเงิน และอ่านหมวดค่าใช้จ่ายไม่ได้ ทุกรายการจึง
  ออกมาเป็น "ไม่เข้าเงื่อนไข" (เหมือน `bundles.example` เมื่อรันแบบไม่มี AI)

ผลลัพธ์: `.json` (ผลทุกขั้นของทุกไฟล์ รวมผล LLM ดิบและสาเหตุที่ใช้วิธีสำรอง), `-items.csv` (1 แถวต่อรายการ)
และ `-documents.csv` (1 แถวต่อเอกสาร: ช่วงหน้า ประเภท วิธีที่ใช้แต่ละขั้น) — ใช้ไล่ว่าความผิดพลาดเกิดที่
OCR, การแยกเอกสาร, การจัดประเภท, การดึงฟิลด์ หรือการจัดกลุ่ม
