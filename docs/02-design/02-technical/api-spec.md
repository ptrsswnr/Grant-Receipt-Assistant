# API Spec — Grant Receipt Assistant (Operation Contract เชิง Logical)

> เอกสารสัญญาการทำงานระดับ **logical** เท่านั้น แปลงจาก [[architecture]] + [[feature-list]] +
> [[user-journey]] (พร้อม FR/NFR จาก [[backlog]]) — **ห้ามใช้ HTTP method/path (เช่น
> `POST /orders`), ห้ามระบุ REST/GraphQL/gRPC หรือรูปแบบ protocol ใดๆ** เพราะ [[technology-stack]]
> ยังไม่มีเนื้อหา (ตรวจสอบแล้ว ณ 2026-08-23) แต่ละ operation ระบุ: ชื่อ operation (verb+noun),
> ผู้เรียกได้/บทบาท, input, output, กฎทางธุรกิจ, กรณี error หลัก — **field ทุกตัวในเอกสารนี้ต้องตรงกับ
> attribute ใน [[db-spec]] เสมอ** (เขียนคู่กันในงานเดียวกัน)

## 0. สถานะเอกสารนี้

- สร้างครั้งแรกเมื่อ 2026-08-23 คู่กับ [[db-spec]] หลัง [[architecture]] เสร็จสมบูรณ์ — ก่อนหน้านี้
  ไฟล์นี้ไม่มีอยู่เลย จึงถือว่าทุก operation "ขาดหาย" ทั้งหมด (สร้างใหม่ทั้งไฟล์)
- ครอบคลุมทุก FR ที่มีผลต่อการกระทำของผู้ใช้ (FR-01–FR-21 ยกเว้น FR-01 ที่ superseded เข้า FR-19 แล้ว
  ตาม [[backlog]]) ตาม 7 journey ใน [[architecture]] (รวม PDPA consent/erasure flow)
- รูปแบบการสื่อสารทุก operation เป็น **synchronous request-response** ตามที่
  [[architecture#5.2 รูปแบบการสื่อสารระหว่าง Backend Service ↔ OCR/Rule Engine/LLM — Synchronous หรือ Asynchronous|architecture หัวข้อ 5.2]]
  ตัดสินใจไว้แล้ว — ผู้เรียกรอผลลัพธ์ในคำขอเดียวต่อ operation เสมอ ไม่มี operation ใดคืนสถานะ
  "กำลังประมวลผล" แล้วให้ poll ทีหลัง
- **อัปเดต 2026-08-23 (รอบ 2):** เพิ่ม **FR-22 (Multi-file Receipt Bundle)** — แก้ OP-01/OP-02/OP-07
  ให้ input เป็น "รายการไฟล์ (1–5 ไฟล์)" ต่อ 1 ใบเสร็จ ไม่ใช่ไฟล์เดียวอีกต่อไป ตรงกับ entity ใหม่
  `ReceiptFile` (E-13) ใน [[db-spec]] และ finalize ขนาดไฟล์สูงสุดจาก 10 MB (ค่าตั้งต้นชั่วคราวเดิม)
  เป็น **5 MB/ไฟล์** — ครอบคลุม FR-01–FR-22 ทั้งหมด
- **อัปเดต 2026-08-23 (รอบ 3):** `detailed-design-writer` พบว่า `Receipt.status` = "รอผลตรวจ" ไม่มี
  operation ใดในเอกสารนี้ตั้งค่าจริง (เพราะ pipeline OP-04/OP-06 เป็น synchronous ทั้งเส้นตามหัวข้อ
  5.2 ข้างบน) แก้โดยตัดค่านี้ออกจาก `Receipt.status` enum ใน [[db-spec]] แล้วปรับ output ของ OP-08
  ให้ตรงกัน — ดูเหตุผลเต็มที่ [[db-spec#5.4 สถานะ Receipt.status ที่ตัดออก (แก้ไข 2026-08-23)|db-spec หัวข้อ 5.4]]

## 1. บทบาทผู้เรียก (Caller Roles)

| บทบาท | ขอบเขตที่เรียกได้ |
|---|---|
| **นักวิจัย/เจ้าของทุน** | ทุก operation ที่เกี่ยวกับใบเสร็จ/ทุน/consent/สิทธิ์ข้อมูลส่วนบุคคลของตนเองเท่านั้น (บังคับด้วยกฎ cross-cutting ในหัวข้อ 2) |
| **Admin** | จำกัดเฉพาะ operation จัดการระเบียบใน Rule Engine (OP-11, OP-12) เท่านั้น — **ห้ามเรียก operation ที่คืนข้อมูลใบเสร็จส่วนบุคคลของนักวิจัยได้เลยในระดับตรรกะสิทธิ์** ([[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-12]]) |
| **ระบบเรียกเอง (internal, ไม่มีผู้ใช้เรียกตรง)** | OP-02 เท่านั้น — เป็นขั้นตอนภายใน pipeline ที่ Backend Service orchestrate ต่อจาก OP-01 โดยอัตโนมัติ |

## 2. กฎการเข้าถึงข้อมูลแบบ Cross-Cutting (Access Control)

ฟีเจอร์ที่ 9 ใน [[feature-list#9. จำกัดสิทธิ์การเข้าถึงข้อมูลตามเจ้าของ (Access Control)|จำกัดสิทธิ์การเข้าถึงข้อมูลตามเจ้าของ]]
ไม่มี operation เฉพาะของตัวเอง (cross-cutting) แต่บังคับกับ**ทุก operation** ในเอกสารนี้ที่มี
`fundId`/`receiptId` เป็น input:

1. ก่อนประมวลผล operation ใดๆ ที่อ้างถึง `fundId`/`receiptId` ต้องตรวจสอบว่า `Fund.ownerUserId`
   (หรือ `Fund` ที่ `Receipt.fundId` ชี้ไป) เท่ากับผู้เรียกปัจจุบันเสมอ — ถ้าไม่ตรง ต้องปฏิเสธการเข้าถึง
   โดยไม่เปิดเผยว่าข้อมูลนั้นมีอยู่จริงหรือไม่ (ป้องกันการเดา ID)
2. Admin ต้องถูกปฏิเสธจากทุก operation ในหมวดที่ 1–7, 10–12 (ใบเสร็จ/ทุน/consent/สิทธิ์ข้อมูล
   ส่วนบุคคล) ที่ระดับตรรกะสิทธิ์ ไม่ใช่แค่ซ่อนปุ่มใน UI
3. อ้างอิง: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-12]],
   [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-05]],
   [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-10]]

## 3. Operation Catalog

| # | Operation | ผู้เรียกได้ | FR/NFR |
|---|---|---|---|
| OP-01 | อัปโหลดใบเสร็จ | นักวิจัย | FR-01, FR-19, FR-22, NFR-06 |
| OP-02 | อ่านข้อมูลใบเสร็จด้วย OCR (internal) | ระบบเรียกเอง | FR-02, FR-22, NFR-01, NFR-06, NFR-08, NFR-09 |
| OP-03 | ดึงข้อมูลใบเสร็จเพื่อตรวจทาน | นักวิจัย | FR-02, FR-03 |
| OP-04 | ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ | นักวิจัย | FR-03, FR-04, FR-05, FR-06, NFR-01–04, NFR-06, NFR-08, NFR-09 |
| OP-05 | ดูรายละเอียดผลตรวจใบเสร็จ | นักวิจัย | FR-06, NFR-03 |
| OP-06 | แก้ไขข้อมูลใบเสร็จแล้วส่งตรวจซ้ำ | นักวิจัย | FR-07 |
| OP-07 | อัปโหลดไฟล์ใบเสร็จใหม่แทนใบเดิม | นักวิจัย | FR-07, FR-19, FR-22 |
| OP-08 | ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard) | นักวิจัย | FR-08, FR-21 |
| OP-09 | ดูรายการแจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่ | นักวิจัย | FR-09 |
| OP-10 | Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว | นักวิจัย | FR-10, FR-21 |
| OP-11 | นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine | Admin | FR-11, NFR-04 |
| OP-12 | ดูเวอร์ชันระเบียบที่ active ปัจจุบัน | Admin | FR-11, NFR-04 |
| OP-13 | ดูสถานะและเนื้อหา Privacy Notice ปัจจุบัน | นักวิจัย | FR-13 |
| OP-14 | ให้ความยินยอมชัดแจ้ง | นักวิจัย | FR-14, FR-15 |
| OP-15 | ถอนความยินยอม (รวมการลบข้อมูลทั้งหมดทันที) | นักวิจัย | FR-16, FR-20 |
| OP-16 | ขอสำเนาข้อมูลส่วนบุคคลของตนเอง | นักวิจัย | FR-17 |
| OP-17 | ลบใบเสร็จของตนเอง | นักวิจัย | FR-18 |

## 4. รายละเอียด Operation

### 4.1 ฟีเจอร์ที่ 1 — อัปโหลดใบเสร็จและอ่านข้อมูลอัตโนมัติด้วย OCR

#### OP-01 อัปโหลดใบเสร็จ

รับไฟล์ **ทั้งชุด** ของค่าใช้จ่าย 1 เรื่องในคำขอเดียว (ไม่ใช่ไฟล์เดียวอีกต่อไปตั้งแต่ FR-22 — Multi-file
Receipt Bundle) เพื่อสร้าง `Receipt` (record ระดับค่าใช้จ่าย) พร้อม `ReceiptFile` ทุกไฟล์ในชุดผูกกัน
ในการดำเนินการเดียว

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (ต้องมีความยินยอมสถานะ "ให้ความยินยอม" ล่าสุดตาม `ConsentRecord`
  ก่อนเสมอ — ดู OP-14)
- **Input**: รายการไฟล์ใบเสร็จ **1 ถึง 5 ไฟล์** (แต่ละไฟล์มี `originalFileName`, ขนาดไฟล์จริง — ตรงกับ
  attribute ของ [[db-spec#E-13 ไฟล์ประกอบใบเสร็จ (ReceiptFile)|ReceiptFile]] ทุกไฟล์ในชุดถือเป็น
  ค่าใช้จ่ายเรื่องเดียวกัน), `fundId` (อ้างอิงถึง [[db-spec#E-02 ทุนวิจัย (Fund)|Fund]] ที่ต้องการผูก)
- **Output**: `Receipt` ใหม่ 1 record (`id`, `fundId`, `uploadedAt`, `status` = "รอ OCR") พร้อม
  `ReceiptFile` ใหม่ 1 record ต่อไฟล์ที่ส่งมา (`fileReference`, `originalFileName`, `fileType`,
  `fileSizeBytes`, `sortOrder`) ทั้งหมดผูกกับ `Receipt.id` เดียวกัน แล้วส่งต่อเข้า OP-02 โดยอัตโนมัติ
  ทันที (synchronous)
- **กฎทางธุรกิจ/Validation** (จุดเดียวที่ authoritative — Client ไม่ตรวจสอบไฟล์เอง ตาม
  [[architecture#5.1 ตำแหน่งของการตรวจสอบไฟล์อัปโหลด (FR-19) — Client หรือ Backend Service|architecture 5.1]]
  — Client แสดงคำเตือน "อัปโหลดครั้งละ 1 รายการเท่านั้น" ให้ผู้ใช้เห็นก่อนเลือกไฟล์ ตาม FR-22 แต่ไม่ใช่
  การตรวจสอบที่ authoritative):
  1. `fundId` ต้องเป็นของผู้เรียกเท่านั้น (กฎ cross-cutting หัวข้อ 2)
  2. จำนวนไฟล์ในคำขอต้องมี **อย่างน้อย 1 ไฟล์ และไม่เกิน 5 ไฟล์** (FR-22, FR-19(4) — finalize แล้ว
     ดู [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 9]])
  3. ทุกไฟล์ในชุดต้องเป็นชนิด jpg/png/pdf เท่านั้น
  4. ทุกไฟล์ในชุดต้องเปิดได้ ไม่เสียหาย
  5. ทุกไฟล์ในชุดต้องมี `fileSizeBytes` ไม่เกิน **5 MB ต่อไฟล์** (finalize แล้ว ไม่ใช่ค่าตั้งต้นชั่วคราว
     10 MB เดิมอีกต่อไป — ดู [[db-spec#5.1 ขนาดไฟล์อัปโหลดสูงสุดและจำนวนไฟล์สูงสุดต่อรายการ (finalize แล้ว)|db-spec หัวข้อ 5.1]])
  6. ผู้เรียกต้องมีสถานะ consent = "ให้ความยินยอม" ล่าสุดแล้วเท่านั้น (FR-14)
- **กรณี Error หลัก**:
  - ยังไม่ให้ความยินยอม → ปฏิเสธ พร้อมนำทางไปหน้า Privacy Notice/Consent (FR-14)
  - จำนวนไฟล์เกิน 5 ไฟล์ → ปฏิเสธทั้งคำขอ (ไม่ใช่แค่ไฟล์ส่วนเกิน) พร้อม error ภาษาไทยแนะนำให้ลดจำนวน
    ไฟล์หรือแยกเป็นใบเสร็จรายการใหม่ (FR-22, FR-19(4))
  - ไฟล์ใดไฟล์หนึ่งในชุดเป็นชนิดที่ไม่รองรับ → ปฏิเสธทั้งคำขอทันที พร้อม error ภาษาไทยระบุชนิดไฟล์ที่
    รองรับ (FR-19 AC-1)
  - ไฟล์ใดไฟล์หนึ่งในชุดเสียหาย/เปิดไม่ได้ → ปฏิเสธทั้งคำขอทันที พร้อม error ภาษาไทยแจ้งให้อัปโหลดใหม่
    (FR-19 AC-2)
  - ไฟล์ใดไฟล์หนึ่งในชุดเกิน 5 MB → ปฏิเสธทั้งคำขอทันที พร้อม error ภาษาไทยแจ้งขนาดที่กำหนด (FR-19
    AC-3, FR-22)
  - `fundId` ไม่ใช่ของผู้เรียก → ปฏิเสธ ไม่เปิดเผยว่าทุนนั้นมีอยู่จริงหรือไม่ (NFR-05)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-01]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-19]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-22]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-06]]

#### OP-02 อ่านข้อมูลใบเสร็จด้วย OCR (internal)

- **ผู้เรียกได้**: ระบบเรียกเองต่อจาก OP-01 สำเร็จทันที (ไม่มีผู้ใช้เรียกตรง) — Backend Service ส่งไฟล์
  ให้ External OCR Service ตาม [[architecture#2. Component Diagram|component diagram]]
- **Input**: `ReceiptFile.fileReference` ของ**ทุกไฟล์**ในชุดที่ผูกกับ `Receipt` นี้ (1–5 ไฟล์ — FR-22)
- **Output**: อัปเดต `Receipt.ocrAmount`, `ocrDate`, `ocrCategory`, `ocrVendorName` เป็น**ค่าเดียวต่อ
  record** โดยรวมผลลัพธ์ที่อ่านได้จากทุกไฟล์ในชุดเข้าด้วยกัน (เช่น อ่านยอดเงินจากไฟล์ที่มีตัวเลข อ่าน
  ชื่อผู้รับจากไฟล์บัตรประชาชนถ้าจำเป็น — field ใดอ่านไม่ได้จากไฟล์ใดเลยในชุดปล่อยว่าง — FR-02 AC-2,
  FR-22) และเปลี่ยน `status` เป็น "รอตรวจทาน"
- **กฎทางธุรกิจ/Validation**: ต้องอ่านเป็นภาษาไทยได้เต็มรูปแบบ (NFR-01) หากผู้ให้บริการ OCR ประมวลผล
  ข้อมูลนอกราชอาณาจักรไทย ต้องผ่านมาตรการ cross-border ตาม NFR-08/NFR-09 ก่อน (organizational,
  ไม่ใช่ logic ในโค้ด) — ใบเสร็จ 1 แผ่นที่มีสินค้าหลายชิ้นจากร้านเดียวกันในไฟล์เดียว **ไม่ต้องแยก
  รายการสินค้าออกจากกัน** (FR-22 — ยังนับเป็น `Receipt`/`ReceiptFile` เดิม ไม่กระทบ pipeline นี้)
- **กรณี Error หลัก**: OCR อ่านไม่ได้เลยทุก field จากทุกไฟล์ในชุด → ยัง set `status` เป็น "รอตรวจทาน"
  โดยปล่อยทุกช่องว่างให้นักวิจัยกรอกเองทั้งหมด (ไม่ถือเป็น error ที่ block flow — สอดคล้อง FR-02 AC-2)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-02]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-22]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-01]],
  [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-08]],
  [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-09]]

### 4.2 ฟีเจอร์ที่ 2 — ตรวจสอบและแก้ไขข้อมูลก่อนส่งตรวจ

#### OP-03 ดึงข้อมูลใบเสร็จเพื่อตรวจทาน

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของใบเสร็จนั้นเท่านั้น)
- **Input**: `receiptId`
- **Output**: `Receipt.ocrAmount`, `ocrDate`, `ocrCategory`, `ocrVendorName` (ค่าดิบให้แสดงเป็นค่า
  ตั้งต้นในฟอร์มแก้ไข)
- **กฎทางธุรกิจ/Validation**: ต้องเรียกได้เฉพาะใบเสร็จที่ `status` = "รอตรวจทาน" เท่านั้น
- **กรณี Error หลัก**: `receiptId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-03]]

### 4.3 ฟีเจอร์ที่ 3 — ตรวจสอบใบเสร็จด้วย Rule Engine พร้อมคำอธิบายจาก LLM

#### OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ

รวม FR-03 (ยืนยัน/แก้ไขค่า), FR-04 (ตัดสินโดย Rule Engine), FR-05 (LLM แปลผล) และ FR-06 (แสดงผล)
เป็น operation เดียวเพราะ [[architecture#5.2 รูปแบบการสื่อสารระหว่าง Backend Service ↔ OCR/Rule Engine/LLM — Synchronous หรือ Asynchronous|architecture 5.2]]
กำหนดให้ pipeline นี้เป็น synchronous request-response ต่อเนื่องกันในคำขอเดียว

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของใบเสร็จนั้นเท่านั้น)
- **Input**: `receiptId`, `confirmedAmount`, `confirmedDate`, `confirmedCategory`,
  `confirmedVendorName` (ค่าที่นักวิจัยยืนยัน/แก้ไขแล้ว — อาจเท่ากับค่า OCR ดิบเดิมถ้าไม่แก้ไขอะไร)
- **Output**: `VerificationResult` ใหม่ 1 record (`decisionStatus`, `explanationText`,
  `ruleVersionId`, รายการ `VerificationRuleCitation` ที่อ้างอิง) และอัปเดต `Receipt.status` ตาม
  `decisionStatus`
- **ลำดับการประมวลผล (บังคับตามหลักการกัน hallucination ของ [[architecture]])**:
  1. บันทึก `confirmedAmount/Date/Category/VendorName` ลง `Receipt` (ไม่ทับค่า `ocr*` เดิม — ดู
     [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 1]])
  2. ส่งค่าที่ยืนยันแล้ว + `RuleVersion` ที่ `isActive = จริง` ปัจจุบัน ให้ Verification Rule Engine
     ตัดสิน — **Rule Engine เท่านั้นที่กำหนด `decisionStatus`**
  3. บันทึก `VerificationResult.ruleVersionId` เป็น snapshot ของเวอร์ชันที่ใช้ตัดสินจริง (ไม่ใช่
     reference ไปยังเวอร์ชัน active "ปัจจุบัน" ที่อาจเปลี่ยนไปในอนาคต)
  4. ส่ง `decisionStatus` + ข้อระเบียบที่อ้างอิงให้ External LLM Explanation Service แปลเป็น
     `explanationText` ภาษาไทยเข้าใจง่าย — **LLM ห้ามเปลี่ยน `decisionStatus`**
  5. คืนผลให้นักวิจัยเห็นทันที (ผ่าน / ต้องแก้ไข / ไม่เข้าเงื่อนไข) พร้อมคำอธิบายและข้ออ้างอิงระเบียบ
- **กฎทางธุรกิจ/Validation**:
  - ทุกผลตรวจต้องมี `VerificationRuleCitation` อย่างน้อย 1 รายการเสมอ ห้ามมีผลตรวจที่ไม่มีข้อระเบียบ
    อ้างอิง (NFR-03)
  - `explanationText` ต้องเป็นภาษาไทยทั้งหมด ไม่ใช้ศัพท์การเงิน/บัญชีโดยไม่มีคำอธิบายประกอบ (NFR-01,
    NFR-02)
  - หากผู้ให้บริการ LLM ประมวลผลข้อมูลนอกราชอาณาจักรไทย ต้องผ่านมาตรการ cross-border ตาม
    NFR-08/NFR-09 ก่อน (organizational)
- **กรณี Error หลัก**:
  - `receiptId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting)
  - `receiptId` ไม่อยู่ในสถานะที่ส่งตรวจได้ (เช่นเคยผ่านแล้ว) → ปฏิเสธพร้อมอธิบายสถานะปัจจุบัน
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-03]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-04]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-05]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-06]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-01]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-02]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-03]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-06]],
  [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-08]],
  [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-09]]

#### OP-05 ดูรายละเอียดผลตรวจใบเสร็จ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของใบเสร็จนั้นเท่านั้น)
- **Input**: `receiptId`
- **Output**: `Receipt.status` ปัจจุบัน + `VerificationResult` ล่าสุด (`decisionStatus`,
  `explanationText`, `decidedAt`) พร้อมรายการ `RuleItem.ruleText` ที่ถูกอ้างอิงผ่าน
  `VerificationRuleCitation`
- **กฎทางธุรกิจ/Validation**: ต้องแสดงข้ออ้างอิงระเบียบควบคู่กับสถานะเสมอ ไม่มีข้อยกเว้น (NFR-03)
- **กรณี Error หลัก**: `receiptId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-06]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-03]]

### 4.4 ฟีเจอร์ที่ 4 — แก้ไขและส่งใบเสร็จที่ไม่ผ่านตรวจซ้ำ

#### OP-06 แก้ไขข้อมูลใบเสร็จแล้วส่งตรวจซ้ำ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของใบเสร็จนั้นเท่านั้น)
- **Input**: `receiptId`, `confirmedAmount`, `confirmedDate`, `confirmedCategory`,
  `confirmedVendorName` (ค่าใหม่ที่แก้ไข)
- **Output**: เหมือน OP-04 (เรียกใช้ลำดับประมวลผลเดียวกันซ้ำ สร้าง `VerificationResult` record ใหม่
  อีก 1 รายการ — ไม่แก้ไข record เดิม ดู [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 3]])
- **กฎทางธุรกิจ/Validation**: เรียกได้เฉพาะใบเสร็จที่ `status` = "ต้องแก้ไข" หรือ "ไม่เข้าเงื่อนไข"
  เท่านั้น
- **กรณี Error หลัก**: ใบเสร็จมีสถานะ "ผ่าน" อยู่แล้ว → ปฏิเสธ (ไม่มีเหตุผลให้ตรวจซ้ำ)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-07]]

#### OP-07 อัปโหลดไฟล์ใบเสร็จใหม่แทนใบเดิม

แทนที่ไฟล์**ทั้งชุด**ของใบเสร็จเดิมด้วยไฟล์ชุดใหม่ (ไม่ใช่แทนที่ทีละไฟล์ — ตาม db-spec กฎข้อ 9 ที่ไม่
รองรับการเพิ่ม/ลบไฟล์แยกทีละไฟล์)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของใบเสร็จนั้นเท่านั้น)
- **Input**: `receiptId` (ใบเดิมที่มีสถานะ "ต้องแก้ไข"/"ไม่เข้าเงื่อนไข"), รายการไฟล์ใบเสร็จใหม่ทั้งชุด
  **1 ถึง 5 ไฟล์** (แทนที่ชุดเดิมทั้งหมด — FR-22)
- **Output**: `Receipt` เดิม (คง `id` เดิมไว้) — ลบ `ReceiptFile` ชุดเดิมทั้งหมดที่ผูกกับ `receiptId`
  นี้ออก แล้วสร้าง `ReceiptFile` ใหม่ตามไฟล์ที่ส่งมา (เหมือน OP-01) ล้างค่า `Receipt.ocr*`/
  `confirmed*` เดิมทั้งหมด ตั้ง `status` = "รอ OCR" แล้วส่งต่อเข้า OP-02 โดยอัตโนมัติ (วนกลับไปยังฟีเจอร์
  ที่ 1–3 ทั้งหมด)
- **กฎทางธุรกิจ/Validation**: ใช้กฎการตรวจสอบไฟล์ชุดเดียวกับ OP-01 ทุกข้อ (จำนวนไฟล์ 1–5 ไฟล์/ชนิด/
  ไม่เสียหาย/ไม่เกิน 5 MB ต่อไฟล์) เรียกได้เฉพาะใบเสร็จที่ `status` = "ต้องแก้ไข" หรือ "ไม่เข้าเงื่อนไข"
  เท่านั้น
- **กรณี Error หลัก**: เหมือน OP-01 ทุกกรณี (FR-19, FR-22 — รวมกรณีจำนวนไฟล์เกิน 5 ไฟล์) + ใบเสร็จมี
  สถานะ "ผ่าน" อยู่แล้ว → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-07]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-19]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-22]]

### 4.5 ฟีเจอร์ที่ 5 — Dashboard สรุปภาพรวมใบเสร็จของทุน

#### OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของทุนนั้นเท่านั้น)
- **Input**: `fundId`
- **Output**: จำนวนใบเสร็จของทุนนั้น แยกตาม `Receipt.status` ("รอ OCR"/"รอตรวจทาน"/"ผ่าน"/"ต้องแก้ไข"/
  "ไม่เข้าเงื่อนไข" — **ไม่มีค่า "รอผลตรวจ"** เพราะ pipeline OP-04/OP-06 เป็น synchronous ทั้งเส้น ไม่มี
  ช่วงที่สถานะนี้ถูก persist จริง ดู [[db-spec#5.4 สถานะ Receipt.status ที่ตัดออก (แก้ไข 2026-08-23)|db-spec หัวข้อ 5.4]])
  และ flag `canExport` (จริง เมื่อมีใบเสร็จ `status` = "ผ่าน" อย่างน้อย 1 ใบ — เชื่อมกับ FR-21/OP-10)
- **กฎทางธุรกิจ/Validation**: ทุนที่ยังไม่มีใบเสร็จเลยต้องแสดงจำนวนทุกสถานะเป็น 0 ไม่ใช่ error
- **กรณี Error หลัก**: `fundId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-08]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-21]]

### 4.6 ฟีเจอร์ที่ 6 — แจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่

#### OP-09 ดูรายการแจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เฉพาะของตนเอง)
- **Input**: ไม่มี (implicit: ผู้เรียกปัจจุบัน)
- **Output**: รายการ `Receipt` ที่ `status` ∈ {"ต้องแก้ไข", "ไม่เข้าเงื่อนไข"} ของทุนทั้งหมดที่ผู้เรียก
  เป็นเจ้าของ — ไม่มี entity การแจ้งเตือนแยกต่างหาก (คำนวณจากสถานะใบเสร็จ ณ เวลาที่เรียก ตรงกับที่
  [[architecture#3.2 Journey 2 — ติดตามภาพรวมทุนและจัดการใบเสร็จที่มีปัญหา (Dashboard + แจ้งเตือน)|architecture Journey 2]] ออกแบบไว้)
- **กฎทางธุรกิจ/Validation**: ไม่รวมการแจ้งเตือนที่อิงกำหนดเวลาส่งหลักฐาน (ตัดออกจากขอบเขต MVP)
- **กรณี Error หลัก**: ไม่มีใบเสร็จค้างอยู่ → คืนรายการเปล่า ไม่ใช่ error
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-09]]

### 4.7 ฟีเจอร์ที่ 7 — Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว

#### OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของทุนนั้นเท่านั้น)
- **Input**: `fundId`
- **Output**: `ExportBatch` ใหม่ (`fileReference` ให้ดาวน์โหลด) พร้อม `ExportBatchReceipt` ที่รวม
  `Receipt` ทุกใบที่ `status` = "ผ่าน" ของทุนนั้น ณ ขณะนี้ (รูปแบบไฟล์จริงยังไม่ระบุ — ดู
  [[db-spec#5.2 รูปแบบไฟล์รายงาน Export (FR-10) และรูปแบบไฟล์สำเนาข้อมูลส่วนบุคคล (FR-17)|db-spec หัวข้อ 5.2]])
- **กฎทางธุรกิจ/Validation**:
  1. ต้องมี `Receipt.status` = "ผ่าน" อย่างน้อย 1 ใบของทุนนั้น (FR-21) — ถ้าไม่มี **ต้องปิดการใช้งาน
     ปุ่ม Export ไว้ก่อน** (ดู OP-08 `canExport`) ไม่ปล่อยให้เรียก operation นี้ได้เลยตั้งแต่ระดับ UI
  2. หลัง export สำเร็จ ตั้ง `Receipt.isExported` = จริง และ `firstExportedAt` (ถ้ายังไม่เคยมีค่า) ให้
     ทุกใบเสร็จที่ถูกรวมใน batch นี้ — ล็อกไม่ให้ลบเองผ่าน UI ต่อจากนี้ (เชื่อมกับ OP-17/FR-18)
  3. export ครั้งถัดๆ ไปของทุนเดียวกันรวบรวม "ใบเสร็จสถานะผ่านทั้งหมด" ใหม่เสมอ (รวมใบเก่าที่เคย
     export แล้วด้วย) ไม่ใช่แค่ใบที่ผ่านใหม่ล่าสุด
- **กรณี Error หลัก**:
  - ไม่มีใบเสร็จสถานะผ่านเลย → ปฏิเสธพร้อมข้อความอธิบายเหตุผล (เช่น "ยังไม่มีใบเสร็จที่ผ่านการตรวจ
    สำหรับทุนนี้") (FR-21 AC-1)
  - `fundId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-10]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-21]]

### 4.8 ฟีเจอร์ที่ 8 — นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine (Admin)

#### OP-11 นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine

- **ผู้เรียกได้**: Admin เท่านั้น
- **Input**: `versionLabel`, รายการ `RuleItem` ใหม่ (`categoryName`, `maxAmount`,
  `requiredDocumentDescription`, `ruleText` ต่อรายการ)
- **Output**: `RuleVersion` ใหม่ (`isActive` = จริง) พร้อม `RuleItem` ทั้งหมดที่แนบมา
- **กฎทางธุรกิจ/Validation**:
  1. เมื่อสร้าง `RuleVersion` ใหม่สำเร็จ ต้องตั้ง `RuleVersion.isActive` เดิมเป็นเท็จในการดำเนินการ
     เดียวกันเสมอ (มีได้เพียง 1 เวอร์ชัน active พร้อมกันทั้งระบบ — ดู
     [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 7]])
  2. ไม่ retrain/แก้ไข External LLM Explanation Service ใดๆ ในขั้นตอนนี้ (LLM ไม่เกี่ยวกับการนำเข้า
     ระเบียบ)
  3. ใบเสร็จที่ยังไม่ถูกส่งตรวจ ณ ขณะนี้จะใช้เวอร์ชันใหม่ทันทีในการตรวจครั้งต่อไป (ไม่กระทบ
     `VerificationResult` ที่มีอยู่แล้วก่อนหน้า — เป็น snapshot คนละ record)
- **กรณี Error หลัก**: ผู้เรียกไม่ใช่ Admin → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-11]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

#### OP-12 ดูเวอร์ชันระเบียบที่ active ปัจจุบัน

- **ผู้เรียกได้**: Admin (สำหรับตรวจสอบก่อน/หลังนำเข้า) — Rule Engine เรียกใช้ภายในเองด้วยตอน OP-04
- **Input**: ไม่มี
- **Output**: `RuleVersion` ที่ `isActive` = จริง พร้อม `RuleItem` ทั้งหมดของเวอร์ชันนั้น
- **กฎทางธุรกิจ/Validation**: ต้องมีผลลัพธ์เพียง 1 เวอร์ชันเสมอ (ตาม db-spec กฎข้อ 7) — ถ้าไม่มีเวอร์ชัน
  active เลย (เช่นระบบยังไม่เคยนำเข้าระเบียบ) ให้คืนค่าว่างพร้อมสถานะ "ยังไม่มีระเบียบให้ใช้ตรวจ"
  (บล็อก OP-04/OP-06/OP-07 ไม่ให้ตัดสินใบเสร็จได้จนกว่า Admin จะนำเข้าระเบียบแรก)
- **กรณี Error หลัก**: ผู้เรียกไม่ใช่ Admin/ระบบภายใน → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-11]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

### 4.9 ฟีเจอร์ที่ 10 — แจ้ง Privacy Notice และจัดการความยินยอม (Consent Management)

#### OP-13 ดูสถานะและเนื้อหา Privacy Notice ปัจจุบัน

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน
- **Input**: ไม่มี (implicit: ผู้เรียกปัจจุบัน)
- **Output**: `PrivacyNoticeVersion` ปัจจุบัน (`versionLabel`, `content`, `effectiveDate`) และสถานะ
  ความยินยอมล่าสุดของผู้เรียก (จาก `ConsentRecord` ที่มี `actionAt` ล่าสุด — "ให้ความยินยอม" /
  "ถอนความยินยอม" / ยังไม่เคยมี record)
- **กฎทางธุรกิจ/Validation**: ต้องแสดงก่อนให้ใช้งานฟีเจอร์อื่นเมื่อเข้าระบบครั้งแรก และก่อนอัปโหลด
  ใบเสร็จครั้งแรก (FR-13 AC-1, AC-2)
- **กรณี Error หลัก**: ไม่มี — operation นี้เป็น read-only เสมอเปิดให้เรียกได้
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-13]]

#### OP-14 ให้ความยินยอมชัดแจ้ง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน
- **Input**: `privacyNoticeVersionId` (เวอร์ชันที่เพิ่งเห็นจาก OP-13)
- **Output**: `ConsentRecord` ใหม่ (`actionType` = "ให้ความยินยอม", `actionAt` = ปัจจุบัน) — ปลดล็อก
  OP-01 ให้เรียกได้
- **กฎทางธุรกิจ/Validation**: ต้องบันทึกคู่กับเวอร์ชัน Privacy Notice ที่ผู้ใช้เห็นจริง ณ ตอนนั้นเสมอ
  (FR-15, Accountability)
- **กรณี Error หลัก**: ไม่มี (การไม่ให้ความยินยอมไม่ใช่ error แต่เป็นทางเลือกที่ไม่เรียก operation นี้ —
  ผลคือ OP-01 ยังถูกปฏิเสธต่อไป ตาม FR-14 AC-2)
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-14]],
  [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-15]]

#### OP-15 ถอนความยินยอม (รวมการลบข้อมูลทั้งหมดทันที)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน
- **Input**: ไม่มี (implicit: ผู้เรียกปัจจุบัน)
- **Output**: `ConsentRecord` ใหม่ (`actionType` = "ถอนความยินยอม") — ระงับ OP-01/OP-06/OP-07 ทันที
  และลบข้อมูลตามลำดับด้านล่าง
- **ลำดับการประมวลผล (บังคับ — ต่างจาก OP-17 โดยเจตนา)**:
  1. บันทึก `ConsentRecord` ("ถอนความยินยอม")
  2. ระงับสิทธิ์อัปโหลด/ประมวลผลใบเสร็จใหม่ของผู้เรียกทันที (FR-16)
  3. ลบ `Receipt` ทุกใบของผู้เรียก **โดยไม่ตรวจสอบ `isExported` เลย** (ต่างจาก OP-17 ที่ต้องตรวจ) พร้อม
     `ReceiptFile`/`VerificationResult`/`VerificationRuleCitation`/`ExportBatchReceipt` ที่ผูกอยู่
     ทั้งหมด — **ไม่ลบ** `Fund` (ดูสมมติฐานที่ [[db-spec#E-02 ทุนวิจัย (Fund)|db-spec E-02]]) และไม่ลบ
     `ExportBatch` ตัวมันเอง (คงไว้เป็นหลักฐาน meta)
  4. สร้าง `AuditLogEntry` (`eventType` = "ถอนความยินยอม+ลบข้อมูลทั้งหมด (FR-20)",
     `affectedReceiptCount`) — บันทึกเฉพาะจำนวน ไม่บันทึกเนื้อหาใบเสร็จ
- **กฎทางธุรกิจ/Validation**: การลบนี้**ไม่มีเงื่อนไขจำกัดตามสถานะ export** (ต่างจาก FR-18/OP-17 โดย
  เจตนา — เหตุผล: ระบบเป็น pre-check gate ไม่ใช่ archival system ดู
  [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-20]] และ [[backlog#Open Point ที่ยังไม่ปิดจากเอกสาร PDPA (เพื่ออ้างอิง — ไม่บล็อกการพัฒนา)|backlog: ปิดแล้ว 2026-08-16 รอบ 3]])
- **กรณี Error หลัก**: ไม่มี — operation นี้ทำงานได้เสมอสำหรับผู้เรียกที่มีสถานะ "ให้ความยินยอม" อยู่
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-16]],
  [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-20]]

### 4.10 ฟีเจอร์ที่ 11 — ขอเข้าถึง/ขอสำเนาข้อมูลส่วนบุคคลของตนเอง (Data Access & Portability)

#### OP-16 ขอสำเนาข้อมูลส่วนบุคคลของตนเอง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน
- **Input**: ไม่มี (implicit: ผู้เรียกปัจจุบัน)
- **Output**: ไฟล์/ข้อมูลสำเนาที่ดาวน์โหลดได้ ครอบคลุม `Receipt` **ทุกสถานะ** ของทุกทุนที่ผู้เรียกถือ
  (ไม่ใช่แค่สถานะ "ผ่าน" แบบ OP-10), `VerificationResult` ทั้งหมดที่เกี่ยวข้อง, และ `ConsentRecord`
  ทั้งหมด (ประวัติให้/ถอนความยินยอม) — รูปแบบไฟล์จริงยังไม่ระบุ (ดู
  [[db-spec#5.2 รูปแบบไฟล์รายงาน Export (FR-10) และรูปแบบไฟล์สำเนาข้อมูลส่วนบุคคล (FR-17)|db-spec หัวข้อ 5.2]])
- **กฎทางธุรกิจ/Validation**: ต้องครบถ้วนกว่ารายงานของ OP-10 เสมอ (รวมทุกสถานะ+ผลตรวจ+ประวัติ consent
  ไม่ใช่แค่ใบเสร็จผ่านตรวจ) — แยกจตเจตนาจาก OP-10 อย่างชัดเจน (FR-17 AC-2)
- **กรณี Error หลัก**: ไม่มี — แม้ไม่มีข้อมูลใบเสร็จเลยก็คืนสำเนาที่มีแต่ประวัติ consent ได้ ไม่ใช่ error
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-17]]

### 4.11 ฟีเจอร์ที่ 12 — ลบข้อมูลใบเสร็จของตนเองด้วยตนเอง (Right to Erasure)

#### OP-17 ลบใบเสร็จของตนเอง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของทุน (เจ้าของใบเสร็จนั้นเท่านั้น)
- **Input**: `receiptId`
- **Output**: ลบ `Receipt`, `ReceiptFile` ทุกไฟล์ในชุด (E-13), และ `VerificationResult`/
  `VerificationRuleCitation` ที่ผูกอยู่ทั้งหมด พร้อมสร้าง `AuditLogEntry` (`eventType` =
  "ลบใบเสร็จรายเดียว (FR-18)")
- **กฎทางธุรกิจ/Validation**:
  1. อนุญาตเฉพาะเมื่อ `Receipt.isExported` = เท็จเท่านั้น (ดู
     [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 5]])
  2. เหตุผลของเงื่อนไขนี้คือ Audit Trail/ป้องกันการลบหลักฐานหนีความรับผิดหลังยื่นเบิกไปแล้ว **ไม่ใช่**
     ข้อกำหนดเก็บหลักฐานทางการเงินอย่างเป็นทางการ (ดู
     [[20260816-02-pdpa-compliance#8.2 ทบทวนเหตุผลของ FR-18 หลังคำชี้แจงเรื่องบทบาทระบบ (ประเมินเมื่อ 2026-08-16 รอบ 3)|pdpa spec หัวข้อ 8.2]])
- **กรณี Error หลัก**:
  - `Receipt.isExported` = จริง → ปฏิเสธการลบผ่าน operation นี้ พร้อมข้อความแจ้งให้ยื่นคำร้องผ่าน
    ช่องทาง Admin/DPO ภายนอกระบบแทน แล้วสร้าง `AuditLogEntry` (`eventType` =
    "ปฏิเสธการลบเพราะถูก export แล้ว (FR-18)") (FR-18 AC-2)
  - `receiptId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting)
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-18]]

## 5. ประเด็นรอตัดสินใจ

เอกสารนี้ไม่มีประเด็น tech stack ที่ต้องตัดสินใจเพิ่มเติมนอกจากที่ [[db-spec#5. ประเด็นรอตัดสินใจ|db-spec หัวข้อ 5]]
ระบุไว้แล้ว — **ขนาดไฟล์อัปโหลดสูงสุด (5 MB/ไฟล์) และจำนวนไฟล์สูงสุดต่อรายการ (5 ไฟล์) finalize แล้ว
ตั้งแต่ 2026-08-23 (รอบ FR-22)** ไม่ใช่ประเด็นเปิดอีกต่อไป เหลือเพียงรูปแบบไฟล์ export/สำเนาข้อมูล
(FR-10/FR-17) ที่ยังเป็น open point — โปรดอ่านคู่กับ db-spec เสมอ

## เอกสารที่เกี่ยวข้อง

- [[db-spec]] — โมเดลข้อมูลเชิง logical ที่ operation ในเอกสารนี้ใช้ field ตรงกันทุกจุด
- [[architecture]] — component/data flow ต้นทางของการออกแบบนี้ (รวมการตัดสินใจ synchronous
  pipeline ในหัวข้อ 5.2 ที่ operation หลายตัวในเอกสารนี้อ้างอิงถึง)
- [[backlog]] — สรุป FR/NFR ทั้งหมด (FR-01–FR-22, NFR-01–NFR-11)
- [[feature-list]] — 12 ฟีเจอร์ที่ operation ในเอกสารนี้ map ตรงกัน 1:1
- [[user-journey]] — 7 journey ที่ operation ในเอกสารนี้ประกอบกันเป็น flow ให้ครบ
- [[20260816-01-grant-receipt-verification]] — spec ต้นทางของ FR-01–FR-12/FR-19/FR-21/FR-22/NFR-01–NFR-07
- [[20260816-02-pdpa-compliance]] — spec ต้นทางของ FR-13–FR-18/FR-20/NFR-08–NFR-11 (PDPA)
- [[technology-stack]] — ยังไม่มีเนื้อหา — จุดที่จะกำหนด protocol/format จริงในอนาคต
