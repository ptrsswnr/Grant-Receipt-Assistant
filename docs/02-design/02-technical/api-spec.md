# API Spec — Grant Receipt Assistant (Operation Contract เชิง Logical)

> เอกสารสัญญาการทำงานระดับ **logical** เท่านั้น แปลงจาก [[architecture]] + [[feature-list]] +
> [[user-journey]] (พร้อม FR/NFR จาก [[backlog]]) — **ห้ามใช้ HTTP method/path (เช่น
> `POST /orders`), ห้ามระบุ REST/GraphQL/gRPC หรือรูปแบบ protocol ใดๆ** เพราะ [[technology-stack]]
> ยังไม่มีเนื้อหา (ตรวจแล้วเมื่อ 2026-11-17: ไฟล์นี้ยังไม่มีอยู่จริง) แต่ละ operation ระบุ: ชื่อ operation (verb+noun),
> ผู้เรียกได้/บทบาท, input, output, กฎทางธุรกิจ, กรณี error หลัก, **สถานะการสร้าง** — **field ทุกตัวในเอกสารนี้ต้องตรงกับ
> attribute ใน [[db-spec]] เสมอ** (เขียนคู่กันในงานเดียวกัน) operation ที่ระบุว่า "ผู้เรียก = Client" หมายถึงฝั่งหน้าจอทำงานภายใต้สิทธิ์ของผู้ใช้
> โดยกฎสิทธิ์ของที่เก็บข้อมูลหลักเป็นผู้บังคับ (ตาม [[architecture#5.4 ตำแหน่งฝั่งเซิร์ฟเวอร์ — ตัดสินใจแล้ว 2026-11-17: แบบผสม (ยืนยันโดยผู้ใช้ผ่าน AskUserQuestion)|architecture 5.4]]) ไม่ได้หมายความว่ามีบริการเซิร์ฟเวอร์รองรับ

## 0. สถานะเอกสารนี้

- สร้างครั้งแรก 2026-08-23 (FR-01–FR-22) รอบ 2 (FR-22 หลายไฟล์ 1–5 ไฟล์ ≤5 MB/ไฟล์), รอบ 3 (ตัดสถานะ "รอผลตรวจ"), 2026-09-03
  (แยก FundSource/Project, เพิ่ม OP-18–OP-21 สำหรับ FR-23 ใช้ `projectId` แทน `fundId`) — รายละเอียดเหตุผลอยู่ใน [[db-spec#5. ประเด็นรอตัดสินใจ|db-spec หัวข้อ 5]]
- **อัปเดต 2026-11-17 (รอบนี้):** sync กับ [[architecture]] (อัปเดตวันเดียวกัน), [[feature-list]] (23 ฟีเจอร์), [[backlog]] (FR-01–FR-37, NFR-01–NFR-15),
  [[20261117-01-implemented-rule-engine-ai-and-admin]] (FR-24–FR-34 สร้างแล้ว) และ
  [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy]] (FR-35–FR-37 Backlog) คู่กับ [[db-spec]] การเปลี่ยนแปลง:
  1. **สิทธิ์ Admin กลับคำตัดสิน (FR-33):** Admin เรียก operation อ่านข้อมูลใบเสร็จของทุกคนได้แบบอ่านอย่างเดียว (เดิมห้ามเด็ดขาด) — แก้หัวข้อ 1, 2
  2. **ผลตรวจ 4 ระดับ** (FR-25) — แก้ OP-04/05/06/07/08/09; เพิ่ม reasonCode/engineVersion/autoVerified/ข้อค้นพบรายกลุ่ม (FR-24)
  3. **ปรับขั้นตอนอัปโหลดให้ตรงระบบที่สร้างแล้ว:** ใบเสร็จถูกสร้างตอน **ส่งตรวจ** (OP-04) ไม่ใช่ตอนเลือกไฟล์ OP-02 (อ่านค่าด้วย AI/OCR) ไม่บันทึกข้อมูลและมีผู้เรียกเป็นนักวิจัยผ่าน Receipt Reader
     OP-03 ถูกรวมเข้า OP-02/OP-04 (คงเลขไว้ ไม่ใช้ซ้ำ) สถานะ "รอ OCR"/"รอตรวจทาน" ไม่บันทึกถาวร (db-spec 5.4)
  4. **เพิ่ม operation ใหม่ OP-22–OP-39:** ประมาณการและเวอร์ชันประมาณการ (FR-26/FR-36), ชุดเอกสาร (FR-27), agent อธิบายผล + agent log (FR-31),
     ที่เก็บไฟล์ภายนอก (FR-32/FR-37), Admin อ่านภาพรวม (FR-33) และจัดการกฎ (FR-29)/แหล่งทุน (FR-35), operation ของ Trusted Server Service (Backlog), ตัวกลางถือคีย์ AI (NFR-12)
  5. **ระบุสถานะ** สร้างแล้ว / สร้างบางส่วน / Backlog ของทุก operation ตาม [[architecture#2.1 ขอบเขตความรับผิดชอบต่อ Component|architecture 2.1]]
- **การตัดสินใจที่กำหนดแล้วโดยผู้ใช้ (ไม่ถามซ้ำ):** FR-36 เก็บเวอร์ชันประมาณการแบบสำเนาทั้งชุดต่อเวอร์ชัน; ใบเสร็จอ้างรายการของเวอร์ชันล่าสุดหลังจับคู่ใหม่; ผลตรวจบันทึกเวอร์ชันประมาณการที่ใช้ตอนตรวจ
- **การสื่อสาร:** ทุก operation เป็นแบบ **synchronous request-response** (ผู้เรียกรอผลในคำขอเดียว ไม่มีสถานะ "กำลังประมวลผล" ให้ poll) ตาม [[architecture#5.2 รูปแบบการสื่อสารกับ OCR/Rule Engine/LLM — ตัดสินใจแล้ว 2026-08-23: Synchronous|architecture 5.2]]
- ประเด็นที่ค้างจากรอบแรกได้รับคำตอบแล้ว บันทึกในหัวข้อ 5 และ [[db-spec#5.6 ประเด็นที่ตัดสินแล้วและช่องว่างที่ทราบ (อัปเดต 2026-11-17 ตามคำตอบผู้ประสานงาน)|db-spec 5.6]]

## 1. บทบาทผู้เรียก (Caller Roles)

| บทบาท | ขอบเขตที่เรียกได้ |
|---|---|
| **นักวิจัย/เจ้าของโครงการ** | ทุก operation เกี่ยวกับใบเสร็จ/โครงการ/ประมาณการ/consent/สิทธิ์ข้อมูลของตนเองเท่านั้น และอ่านรายการแหล่งทุนที่ใช้งานอยู่ (OP-21) |
| **Admin** | (1) operation จัดการแหล่งทุน/ระเบียบ/ชุดเอกสาร (OP-11, OP-12, OP-21, OP-31, OP-32, OP-33) เขียนได้เฉพาะ Admin; (2) **อ่านอย่างเดียว** ข้อมูลใบเสร็จ/โครงการ/ประมาณการ/ผลตรวจ/agent log/ผู้ใช้ของทุกคน (OP-30, และ OP-05/OP-26 ในฐานะผู้อ่าน) ตาม FR-33; **ห้ามเรียก operation ที่เขียน/แก้/ลบข้อมูลใบเสร็จหรือโครงการของผู้อื่น** (OP-04, OP-06, OP-07, OP-17, OP-19, OP-20, OP-23 ฯลฯ) และเลื่อนสิทธิ์ตนเองไม่ได้ |
| **ระบบเรียกเอง (internal)** | OP-36 (ส่งอีเมลแจ้งเตือน) และ OP-39 (ตัวกลางถือคีย์ AI) ไม่มีผู้ใช้เรียกตรง |
| **Client ในนามนักวิจัย → Trusted Server Service** | OP-34, OP-35 (Backlog) Client ส่งคำขอในนามผู้ใช้ที่ล็อกอิน เซิร์ฟเวอร์ตรวจตัวตนเองและทำงานแทน |
| **ผู้วิจัย/เจ้าของระบบ (นอกแอป)** | ชุดประเมินผล (FR-34) เป็นเครื่องมือนอกแอป ไม่มี operation ในเอกสารนี้ — ใช้โมดูล Rule Engine ตัวเดียวกับ OP-04 กับไฟล์เคสที่ไม่อยู่ในที่เก็บข้อมูลของแอป |

## 2. กฎการเข้าถึงข้อมูลแบบ Cross-Cutting (Access Control)

ฟีเจอร์ที่ 9 ([[feature-list#9. จำกัดสิทธิ์การเข้าถึงข้อมูลตามเจ้าของ (Access Control)|จำกัดสิทธิ์การเข้าถึงข้อมูลตามเจ้าของ]]) ไม่มี operation เฉพาะ แต่บังคับกับทุก operation ที่มี `projectId`/`receiptId`:

1. **เจ้าของ:** ก่อนประมวลผล operation ที่เขียน/แก้/ลบ หรืออ่านข้อมูลส่วนบุคคลของผู้ใช้ ต้องตรวจว่า `Project.ownerUserId` (หรือ `Receipt.ownerUserId`) เท่ากับผู้เรียก ถ้าไม่ตรงปฏิเสธโดยไม่เปิดเผยว่าข้อมูลมีอยู่จริงหรือไม่
2. **Admin (แก้ไขตาม FR-33 เมื่อ 2026-11-17 — เดิมห้ามเข้าถึงเลย):** อนุญาตให้ **อ่านอย่างเดียว** ข้อมูลของทุกคน (ใบเสร็จ ไฟล์อ้างอิง โครงการ ประมาณการ ผลตรวจ ข้อค้นพบ agent log ผู้ใช้) ปฏิเสธการเขียน/แก้/ลบของผู้อื่นทุกกรณี
   บังคับที่ชั้นกฎสิทธิ์ของที่เก็บข้อมูลหลัก ไม่ใช่แค่ซ่อนเมนูใน UI นักวิจัยต้องได้รับแจ้งก่อนอัปโหลดครั้งแรก (OP-13/OP-14, FR-13/FR-14)
3. **ตัวระบุเจ้าของซ้ำ:** การค้นข้ามโครงการของนักวิจัยต้องระบุเงื่อนไขเจ้าของ (`Receipt.ownerUserId` = ผู้เรียก) เสมอ ถ้าไม่ระบุจะถูกปฏิเสธ ไม่ใช่กรองเงียบๆ ส่วนการค้นแบบไม่กรองเจ้าของ (OP-30) ทำได้เฉพาะ Admin
4. **`fundSourceId`/ระเบียบ/ชุดเอกสาร/ประเภทเอกสาร** ไม่มีเจ้าของรายคน: ทุกคนที่ล็อกอินอ่านได้ (นักวิจัยต้องเห็นแหล่งทุนเพื่อเลือกผูกโครงการ) การเขียนเฉพาะ Admin
5. **การเลื่อนสิทธิ์เป็น Admin** ทำนอกระบบเท่านั้น ผู้ใช้เขียนทับ `roleType` ของตนเองไม่ได้ (บังคับที่ชั้นกฎสิทธิ์)
6. **ไฟล์ในที่เก็บไฟล์ภายนอก:** ปัจจุบันใครมีลิงก์ดูได้ — ปลายทางจำกัดเจ้าของ+Admin (FR-37/NFR-15 Backlog ดู OP-29/OP-37)
7. อ้างอิง: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-12]],
   [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]],
   [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-05]],
   [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-10]]

## 3. Operation Catalog

| # | Operation | ผู้เรียกได้ | FR/NFR | สถานะ |
|---|---|---|---|---|
| OP-01 | ตรวจสอบชุดไฟล์ใบเสร็จก่อนใช้งาน | นักวิจัย (Client) | FR-19, FR-22, NFR-06 | Backlog |
| OP-02 | อ่านใบเสร็จด้วย AI/OCR เพื่อเสนอค่า | นักวิจัย (Client) | FR-02, FR-30, NFR-01, NFR-14 | สร้างแล้ว |
| OP-03 | ~~ดึงข้อมูลใบเสร็จเพื่อตรวจทาน~~ (รวมเข้า OP-02/OP-04) | — | FR-03 | ยกเลิกเลข |
| OP-04 | ยืนยันข้อมูลใบเสร็จ ส่งตรวจ และบันทึกใบเสร็จ | นักวิจัย | FR-03, FR-04, FR-06, FR-24–FR-28, NFR-01–04 | สร้างแล้ว (ที่ Client) |
| OP-05 | ดูรายละเอียดผลตรวจใบเสร็จ | นักวิจัย (+Admin อ่านอย่างเดียว) | FR-06, FR-24, FR-25, NFR-03 | สร้างแล้ว |
| OP-06 | แก้ไขข้อมูลใบเสร็จแล้วส่งตรวจซ้ำ | นักวิจัย | FR-07 | Backlog |
| OP-07 | อัปโหลดไฟล์ใบเสร็จใหม่แทนชุดเดิม | นักวิจัย | FR-07, FR-19, FR-22 | Backlog |
| OP-08 | ดูภาพรวมสถานะใบเสร็จของโครงการ (Dashboard) | นักวิจัย | FR-08, FR-21 | Backlog |
| OP-09 | ดูรายการแจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่ | นักวิจัย | FR-09 | Backlog |
| OP-10 | Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว | นักวิจัย | FR-10, FR-21 | Backlog |
| OP-11 | นำเข้า/แก้ไขระเบียบของแหล่งทุน (หมวด/อัตรา/ชุดเอกสาร) | Admin | FR-11, FR-29, FR-33, NFR-04 | สร้างบางส่วน |
| OP-12 | ดูเวอร์ชันระเบียบที่ active ของแหล่งทุน | Admin (+ผู้ตรวจใบเสร็จ) | FR-11, FR-23, NFR-04 | สร้างแล้ว |
| OP-13 | ดูสถานะยินยอมและ Privacy Notice | นักวิจัย | FR-13 | สร้างบางส่วน |
| OP-14 | ให้ความยินยอม | นักวิจัย | FR-14, FR-15 | สร้างบางส่วน |
| OP-15 | ถอนความยินยอม (ฝั่ง Client: บันทึก+ลบไฟล์ภายนอกก่อน) | นักวิจัย | FR-16, FR-20, FR-37 | Backlog |
| OP-16 | ขอสำเนาข้อมูลส่วนบุคคลของตนเอง | นักวิจัย | FR-17 | Backlog |
| OP-17 | ลบใบเสร็จของตนเอง | นักวิจัย | FR-18, FR-37 | สร้างบางส่วน |
| OP-18 | ดูรายการโครงการวิจัยของตนเอง | นักวิจัย | FR-23 | สร้างแล้ว |
| OP-19 | สร้างโครงการวิจัยใหม่ผูกกับแหล่งทุน | นักวิจัย | FR-23, FR-35 | สร้างแล้ว (กรอง isActive Backlog) |
| OP-20 | แก้ไขข้อมูลโครงการวิจัย | นักวิจัย | FR-23 | Backlog |
| OP-21 | ดูรายการแหล่งทุน | นักวิจัย, Admin | FR-23, FR-11, FR-35 | สร้างแล้ว |
| OP-22 | นำเข้าและแปลงไฟล์ประมาณการ 17.2 (ดูตัวอย่างก่อนบันทึก) | นักวิจัย | FR-26 | สร้างแล้ว |
| OP-23 | บันทึกประมาณการของโครงการ | นักวิจัย | FR-26, FR-36 | สร้างแล้ว (แทนที่ทั้งชุด) / เวอร์ชัน FR-36 Backlog |
| OP-24 | เสนอการจับคู่ใบเสร็จเดิมกับรายการของเวอร์ชันใหม่ | นักวิจัย | FR-36 | Backlog |
| OP-25 | ดูประวัติเวอร์ชันประมาณการ | นักวิจัย (+Admin อ่านอย่างเดียว) | FR-36 | Backlog |
| OP-26 | ดูสรุปยอดใช้ไป/คงเหลือ/% รายรายการ | นักวิจัย (+Admin อ่านอย่างเดียว) | FR-26 | สร้างแล้ว |
| OP-27 | ดูรายการเอกสาร/ตราที่ต้องมีของหมวดและยอด | นักวิจัย | FR-27 | สร้างแล้ว |
| OP-28 | อธิบายผลด้วย AI agent และบันทึกประวัติการทำงาน | นักวิจัย (Client) | FR-31, NFR-03 | สร้างแล้ว |
| OP-29 | เชื่อมต่อที่เก็บไฟล์ภายนอกของผู้ใช้ | นักวิจัย | FR-32, FR-37, NFR-15 | สร้างแล้ว (ส่วนถอนแชร์ไฟล์เก่า Backlog) |
| OP-30 | ดูภาพรวมใบเสร็จของทุกคน (Admin อ่านอย่างเดียว) | Admin | FR-33 | สร้างแล้ว |
| OP-31 | อัปเดตชุดกฎ ชุดเอกสาร และประเภทเอกสารตามรหัสคงที่ | Admin | FR-29, FR-27 | สร้างแล้ว |
| OP-32 | ปิดใช้งาน/เปิดใช้งานแหล่งทุน | Admin | FR-35 | Backlog |
| OP-33 | ลบแหล่งทุนถาวร (พฤติกรรมปัจจุบัน จะถูกแทนที่ด้วย OP-32) | Admin | FR-33 | สร้างแล้ว |
| OP-34 | คำนวณและบันทึกผลตรวจใบเสร็จโดย Trusted Server Service | Client ในนามนักวิจัย | FR-04, FR-24, NFR-04, NFR-05 | **Backlog** |
| OP-35 | ลบข้อมูลทั้งหมดของผู้ใช้โดย Trusted Server Service | Client ในนามนักวิจัย | FR-20, NFR-11 | **Backlog** |
| OP-36 | ส่งอีเมลแจ้งเตือนใบเสร็จที่ค้างอยู่ | ระบบเรียกเอง | FR-09 | **Backlog** |
| OP-37 | ลบไฟล์แนบในที่เก็บไฟล์ภายนอกของผู้ใช้ | นักวิจัย (Client) | FR-37, FR-18, FR-20, NFR-15 | **Backlog** |
| OP-38 | อัปโหลดไฟล์ใบเสร็จไปยังที่เก็บไฟล์ภายนอกและบันทึกข้อมูลอ้างอิง | นักวิจัย (Client) | FR-32, FR-22 | สร้างแล้ว |
| OP-39 | ส่งต่อคำขอ AI ผ่านตัวกลางถือคีย์ | ระบบเรียกเอง (AI Gateway) | NFR-12 | สร้างบางส่วน (ยังไม่ deploy) |
| OP-40 | ดูรายการใบเสร็จของตนเอง (ทั้งหมดหรือกรองตามโครงการ) | นักวิจัย | FR-06, FR-23 | สร้างแล้ว |

## 4. รายละเอียด Operation

### 4.0 Project Setup (ฟีเจอร์ที่ 13)

รองรับ FR-23 ต้องทำ**ก่อน**อัปโหลดใบเสร็จเสมอ เพราะ `Receipt.projectId` ต้องชี้ไป `Project` ที่มีอยู่

#### OP-18 ดูรายการโครงการวิจัยของตนเอง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เฉพาะของตนเอง) — **สถานะ: สร้างแล้ว**
- **Input**: ไม่มี (implicit: ผู้เรียก)
- **Output**: รายการ `Project` ที่ `ownerUserId` = ผู้เรียก (`id`, `projectName`, `fundSourceId` พร้อม `fundSourceName` ของแหล่งทุนที่ผูก) — โครงการที่ผูกแหล่งทุนซึ่งปิดใช้งาน (FR-35) ต้องยังแสดงชื่อแหล่งทุนตามปกติ ไม่ใช่ "ไม่พบแหล่งทุน"
- **กฎทางธุรกิจ**: คืนรายการเปล่าได้ ไม่ใช่ error (Client พาไปสร้างโครงการผ่าน OP-19)
- **กรณี Error หลัก**: ไม่มี
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]]

#### OP-19 สร้างโครงการวิจัยใหม่ผูกกับแหล่งทุน

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: สร้างแล้ว** (การกรองเฉพาะแหล่งทุนที่ใช้งานอยู่ตาม FR-35 เป็น Backlog)
- **Input**: `projectName`, `fundSourceId`
- **Output**: `Project` ใหม่ (`id`, `projectName`, `ownerUserId` = ผู้เรียก, `fundSourceId`, `createdAt`)
- **กฎทางธุรกิจ/Validation**:
  1. `fundSourceId` ต้องอ้างถึง `FundSource` ที่มีอยู่จริง **และ `isActive` = จริง** (FR-35 ปลายทาง — แหล่งทุนปิดใช้งานเลือกไม่ได้สำหรับโครงการใหม่)
  2. `ownerUserId` = ผู้เรียกเสมอ (ไม่รับจากภายนอก) — 1 โครงการ 1 เจ้าของ; นักวิจัย 1 คนมีได้หลายโครงการ
  3. สร้างโครงการได้โดยไม่ต้องมีประมาณการก่อน (ประมาณการนำเข้าภายหลังผ่าน OP-22/OP-23)
- **กรณี Error หลัก**: `fundSourceId` ไม่มีอยู่จริงหรือปิดใช้งาน → ปฏิเสธ พร้อม error ภาษาไทยให้เลือกจากรายการ (NFR-02)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-35]]

#### OP-20 แก้ไขข้อมูลโครงการวิจัย (ชื่อ/แหล่งทุนที่ผูก)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของโครงการนั้นเท่านั้น) — **สถานะ: Backlog** (ตรวจกับโค้ดแล้ว ยังไม่มีหน้าจอแก้ไขโครงการ มีเฉพาะแสดงรายการและสร้างโครงการ)
- **Input**: `projectId`, `projectName` (ถ้าแก้ชื่อ), `fundSourceId` (ถ้าเปลี่ยนแหล่งทุน)
- **Output**: `Project` ที่อัปเดต (`id`, `projectName`, `fundSourceId`)
- **กฎทางธุรกิจ/Validation**:
  1. `fundSourceId` ใหม่ต้องมีอยู่จริงและ `isActive` = จริงเช่นเดียวกับ OP-19
  2. การเปลี่ยนแหล่งทุน **ไม่กระทบ** `VerificationResult` เดิม (`ruleVersionId` เป็น snapshot — [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 2/11]]) ใบเสร็จที่ยังไม่ส่งตรวจใช้ระเบียบของแหล่งทุนใหม่ในครั้งถัดไป
- **กรณี Error หลัก**: `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ; `fundSourceId` ไม่มี/ปิดใช้งาน → ปฏิเสธ (NFR-02)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]]

#### OP-21 ดูรายการแหล่งทุน

- **ผู้เรียกได้**: นักวิจัย (เลือกตอน OP-19/OP-20), Admin (จัดการ) — **สถานะ: สร้างแล้ว** (ตัวกรองใช้งาน/ปิดใช้งาน FR-35 Backlog)
- **Input**: `includeInactive` (จริง/เท็จ, ไม่บังคับ ค่าตั้งต้น เท็จ — **เฉพาะ Admin** ตั้งเป็นจริงได้ [FR-35 Backlog])
- **Output**: รายการ `FundSource` (`id`, `fundSourceName`, `fundSourceCode`, `isActive` [FR-35 Backlog]) ไม่รวมรายละเอียดกฎ (ดู OP-12) นักวิจัยได้เฉพาะ `isActive` = จริง; Admin เห็นทั้งหมดเมื่อ `includeInactive` = จริง
- **กฎทางธุรกิจ**: ไม่กรองตามเจ้าของ (ข้อมูลระดับองค์กร) การอ่านชื่อแหล่งทุนของ**โครงการที่มีอยู่แล้ว** ต้องทำได้แม้แหล่งทุนปิดใช้งาน (ใช้ OP-18 ไม่ใช่ตัวกรองของ OP-21)
- **กรณี Error หลัก**: ไม่มี — คืนรายการเปล่าได้
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-11]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-35]]

### 4.1 ฟีเจอร์ที่ 1, 2 และ 17 — อัปโหลด อ่านด้วย AI/OCR และตรวจทาน

#### OP-01 ตรวจสอบชุดไฟล์ใบเสร็จก่อนใช้งาน

**แก้ไข 2026-11-17:** เดิม OP-01 สร้าง `Receipt` สถานะ "รอ OCR" ทันที แต่ระบบที่สร้างแล้วสร้างใบเสร็จตอนส่งตรวจ (OP-04) และตามมติสถาปัตยกรรมผสม การตรวจไฟล์ (FR-19/FR-22) อยู่ที่ **Client** (ไม่ใช่เซิร์ฟเวอร์) จึงเหลือเป็น operation ตรวจสอบล้วน

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (Client ตรวจในเครื่อง) — **สถานะ: Backlog** (FR-19/FR-22 ยังไม่ได้สร้าง ปัจจุบันตรวจไม่ครบเงื่อนไขเหล่านี้)
- **Input**: รายการไฟล์ใบเสร็จ **1–5 ไฟล์** (แต่ละไฟล์: `originalFileName`, `fileType`, `fileSizeBytes`), `projectId`
- **Output**: ผ่าน/ไม่ผ่าน พร้อมรายการข้อผิดพลาดเป็นภาษาไทยต่อไฟล์ — ไม่บันทึกข้อมูลใดๆ
- **กฎทางธุรกิจ/Validation**:
  1. ผู้เรียกต้องยินยอมแล้ว (OP-14)
  2. จำนวนไฟล์ 1–5 (เกิน → ปฏิเสธทั้งชุด); ชนิด jpg/png/pdf; เปิดได้ไม่เสียหาย; `fileSizeBytes` ≤ **5 MB ต่อไฟล์** ([[db-spec#5.1 ขนาดไฟล์อัปโหลดสูงสุดและจำนวนไฟล์สูงสุดต่อรายการ (finalize แล้ว)|db-spec 5.1]])
  3. Client แสดงคำเตือน "อัปโหลดครั้งละ 1 รายการเท่านั้น" ก่อนเลือกไฟล์ (FR-22)
  4. **ข้อจำกัดที่ยอมรับตามมติสถาปัตยกรรมผสม:** การตรวจที่ Client ไม่ใช่ authoritative (เบราว์เซอร์หลีกเลี่ยงได้)
- **กรณี Error หลัก**: ยังไม่ยินยอม → ปฏิเสธและนำไปหน้ายินยอม (FR-14); ไฟล์ผิดชนิด/เสียหาย/เกินขนาด/เกินจำนวน → ปฏิเสธทั้งชุดพร้อมเหตุผลเป็นไทย (FR-19 AC-1–AC-3, FR-22); `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (NFR-05)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-19]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-22]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-06]]

#### OP-02 อ่านใบเสร็จด้วย AI/OCR เพื่อเสนอค่า

**แก้ไข 2026-11-17:** เดิมเป็น operation ภายในของ Backend Service ที่เขียนค่า `ocr*` ลงใบเสร็จ — ตอนนี้ Receipt Reader ทำงานที่เครื่องผู้ใช้ เสนอค่าให้ผู้ใช้ตรวจแก้ **ไม่บันทึกค่าที่เสนอ** (ตรวจกับโค้ดแล้ว: เก็บเฉพาะค่าที่ผู้ใช้ยืนยันตอน OP-04)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (ผ่าน Receipt Reader) — **สถานะ: สร้างแล้ว**
- **Input**: ไฟล์ใบเสร็จ (ภาพ jpg/png หรือ PDF — ใช้หน้าแรกแปลงเป็นภาพ)
- **Output**: ค่าที่เสนอ `confirmedAmount`, `confirmedDate` (พ.ศ.→ค.ศ.), `confirmedCategory`, `confirmedVendorName` (ค่าเริ่มต้นของฟอร์มตรวจทาน), **เส้นทางที่ใช้จริง** (AI+OCR / AI อย่างเดียว / สกัดจากข้อความ OCR เอง / กรอกเอง-ข้อมูลสาธิต) และ `isAiSuggestion` (จริงเมื่อ AI ทำงานจริง เพื่อแสดงป้าย "AI suggestion") — ค่าที่อ่านไม่ได้ปล่อยว่าง
- **กฎทางธุรกิจ/Validation**:
  1. ตรวจสถานะ OCR ในเครื่องด้วยเวลาจำกัดสั้นก่อน; ถ้าเปิดอยู่ส่งบรรทัดข้อความ (พร้อมความมั่นใจ) + ภาพให้ AI Gateway
  2. ผู้ให้บริการ AI สลับได้ 4 รูปแบบเชิงบทบาท (ภายนอกด้วยคีย์ / ในเครื่อง / ผ่านตัวกลาง OP-39 / ปลายทางกำหนดเอง) การประมวลผลในเครื่องไม่ส่งใบเสร็จออกนอกเครื่อง (NFR-14)
  3. ไม่มี AI/OCR หรือเรียกล้มเหลว → ถอยกลับเป็นกรอกเอง/ข้อมูลสาธิต **พร้อมแจ้งผู้ใช้ว่าใช้เส้นทางใด** ไม่ขวาง flow
  4. ค่าที่เสนอไม่ใช่ผลตัดสิน — ผู้ใช้ต้องตรวจแก้ได้ทุกค่า (FR-03) และ AI ไม่ตัดสินสถานะ
  5. OCR ภาษาไทยอาจตกวรรณยุกต์ ผู้ใช้จึงต้องตรวจทานเสมอ; ผู้ให้บริการภายนอกต้องผ่านมาตรการ NFR-08/NFR-09
- **กรณี Error หลัก**: AI/OCR ล้มเหลวหรือไม่ได้ตั้งค่า → ถอยกลับ (ไม่ใช่ error ที่ขวาง) ไฟล์ที่แปลงเป็นภาพไม่ได้ → แจ้งและให้กรอกเอง
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-02]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-30]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-01]],
  [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-08]],
  [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-09]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#3. Non-Functional Requirements|NFR-14]]

#### OP-03 (ยกเลิกเลข — รวมเข้า OP-02/OP-04)

เดิม "ดึงข้อมูลใบเสร็จเพื่อตรวจทาน" อ่านค่า `ocr*` จากใบเสร็จที่สถานะ "รอตรวจทาน" ซึ่งไม่มีอยู่แล้ว (ใบเสร็จไม่ถูกสร้างจนกว่าจะส่งตรวจ) ขั้นตรวจแก้ค่าเกิดบนฟอร์มที่ Client โดยใช้ค่าจาก OP-02 แล้วส่งเข้า OP-04 เลขนี้ไม่ใช้ซ้ำเพื่อไม่กระทบเอกสารที่อ้างอิงอยู่ ([[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-03]])

### 4.2 ฟีเจอร์ที่ 3, 14, 15, 16, 18, 19 — ตรวจใบเสร็จด้วย Rule Engine

#### OP-04 ยืนยันข้อมูลใบเสร็จ ส่งตรวจ และบันทึกใบเสร็จ

รวม FR-03 (ยืนยันค่า), FR-04 (กฎตัดสิน), FR-06 (แสดงผล) เป็น operation เดียวแบบ synchronous — **ปัจจุบัน Client โหลดกฎ เรียกโมดูล Rule Engine และบันทึกผลเอง; ปลายทาง Trusted Server Service ทำแทน (OP-34)**

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของโครงการนั้นเท่านั้น) — **สถานะ: สร้างแล้ว (คำนวณที่ Client)**
- **Input**: `projectId`, `confirmedAmount`, `confirmedDate`, `confirmedCategory`, `confirmedVendorName` (ไม่บังคับ),
  `estimateLineId` (**บังคับเมื่อโครงการมีประมาณการ** — เลือกรายการของเวอร์ชันล่าสุด หรือระบุ "ไม่อยู่ในประมาณการ" อย่างชัดเจนซึ่งบันทึกเป็นค่าว่าง),
  `providedDocumentTypeIds` และ `confirmedAttestationKeys` (จากรายการตรวจของ OP-27 ไม่บังคับ — ไม่ส่ง = ตรวจเอกสารไม่ได้), `summaryAmount` (ไม่บังคับ),
  ข้อมูลไฟล์อ้างอิงของชุดไฟล์ (ถ้ามี — บันทึกผ่าน OP-38)
- **Output**: `Receipt` ใหม่ (`id`, `projectId`, `ownerUserId` = ผู้เรียก, ค่าที่ยืนยัน, `estimateLineId`, `summaryAmount`, `providedDocumentTypeIds`, `confirmedAttestationKeys`, `status`, `uploadedAt`) และ
  `VerificationResult` ใหม่ (`decisionStatus`, `reasonCode`, `autoVerified`, `engineVersion`, `ruleVersionId`, `ruleItemId`, `estimateVersionId`, `decidedAt`, `explanationText`) พร้อม `VerificationFinding` รายกลุ่ม
  และ `VerificationRuleCitation` และตัวบ่งชี้ `fundSourceInactiveWarning` (คำนวณจาก `FundSource.isActive` ตอนแสดงผล ไม่บันทึก) — `Receipt.status` = `decisionStatus`
- **ลำดับการประมวลผล (บังคับตามหลัก "กฎตัดสิน AI ไม่ตัดสิน")**:
  1. ตรวจความเป็นเจ้าของโครงการ และตรวจว่าผู้เรียกยินยอมแล้ว (OP-13/OP-14)
  2. หา `FundSource` ของ `Project.fundSourceId` แล้วโหลดกฎ **ทั้ง `RuleVersion` ที่ `isActive` = จริง ณ เวลานี้** พร้อม `RuleItem` ทั้งหมด ชุดเอกสาร ประเภทเอกสาร (OP-12) — แหล่งทุนที่ปิดใช้งานยังตรวจต่อด้วยกฎที่เก็บไว้ (ตัดสินแล้ว)
  3. โหลดบริบทประมาณการของโครงการ (เวอร์ชันที่ `isLatest`) และยอดสะสมก่อนใบนี้ของ `estimateLineId` เดียวกัน (`spentBefore` = ผลรวม `confirmedAmount` ของใบเสร็จอื่นที่ตัดรายการนั้น)
  4. เรียกโมดูล Rule Engine (บริสุทธิ์ ไม่แตะที่เก็บข้อมูล/หน้าจอ/เครือข่าย) ตรวจตามลำดับกลุ่ม **ประมาณการ → ระเบียบ → ใบสรุป → เอกสารแนบ**:
     - ประมาณการ: ไม่อยู่ในประมาณการ (`NOT_IN_ESTIMATE`) หรือยอดสะสมเกิน 100% ของ `EstimateLine.total` (`OVER_ESTIMATE`) → **ต้องชี้แจง/ขออนุมัติ**; ไม่มีประมาณการ → `ESTIMATE_NOT_CHECKED` ไม่อัตโนมัติ
     - ระเบียบ: เทียบ `RuleItem` ของ `confirmedCategory` ตาม `rateType` (เพดานตามจริง/เหมาจ่าย/ต่อหน่วย/ตามข้อเสนอโครงการ) — เพดานต่อหน่วยที่ผูกรายการที่มี `quantity` ใช้ `rateAmount × quantity` (`OVER_RATE_ALLOWANCE`/`WITHIN_RATE_ALLOWANCE`) ไม่มี `quantity` → ยังไม่ถือว่าตรวจตัวเลขได้และข้อความบอกให้นำเข้าประมาณการใหม่ที่ระบุจำนวน; หมวดไม่อยู่ในกฎ (`CATEGORY_NOT_IN_RULES`) → **ไม่เข้าเงื่อนไข**; ยอดไม่เป็นบวก (`INVALID_AMOUNT`) → ต้องแก้ไข
     - ใบสรุป: `summaryAmount` ไม่เท่ากับ `confirmedAmount` → `SUMMARY_AMOUNT_MISMATCH` ต้องแก้ไข; ว่างไม่มีข้อค้นพบ
     - เอกสารแนบ: ขั้นบังคับที่ไม่มีเอกสารที่ติ๊กอย่างน้อย 1 ประเภท (`MISSING_EVIDENCE`) หรือตราที่ขาด (`MISSING_ATTESTATION`) → ต้องแก้ไข; ขั้นแบบมีเงื่อนไข (เช่น ยอด > 100,000) มีผลเมื่อยอดตรงเงื่อนไข; ไม่ได้ส่งข้อมูลเอกสาร → `EVIDENCE_NOT_CHECKED`
     ผลตรวจ = ข้อค้นพบที่รุนแรงที่สุด (ผ่าน < ต้องแก้ไข < ต้องชี้แจง/ขออนุมัติ < ไม่เข้าเงื่อนไข) `reasonCode` = ข้อค้นพบหลักตามลำดับกลุ่ม แสดงข้อค้นพบทุกกลุ่ม
  5. บันทึก `Receipt` (สถานะตั้งครั้งเดียวและคงอยู่), `VerificationResult` (snapshot `ruleVersionId`/`estimateVersionId`/`ruleItemId`/`engineVersion`), `VerificationFinding`, `VerificationRuleCitation`
  6. คืนผลทันที จากนั้น Client เรียก OP-38 (ถ้ามีไฟล์) และ OP-28 (อธิบายผล แยกขอบเขต ล้มเหลวได้โดยไม่ขวางการบันทึก)
- **กฎทางธุรกิจ/Validation**:
  - ทุกผลตรวจที่มีกฎเกี่ยวข้องต้องมี `VerificationRuleCitation` ≥ 1 (NFR-03) — ยกเว้นผลที่ไม่มีกฎเกี่ยวข้อง (ไม่มีแหล่งทุน/ไม่มี `RuleVersion` active/หมวดไม่อยู่ในกฎ) ต้องมีคำอธิบายแทน
  - `explanationText` ภาษาไทย บอกผู้ใช้ว่าต้องทำอะไรต่อ ไม่ปล่อยผ่านเงียบเมื่อตรวจไม่ได้ (NFR-01/NFR-02) และอ้างที่มาของกฎ (หมายเหตุของ `RuleItem` ซึ่งต้องระบุเมื่อตัวเลขไม่ได้มาจากคู่มือ)
  - **`autoVerified` = เท็จ** เมื่อผ่านเพราะตรงหมวดเท่านั้นหรือมีด้านที่ตรวจไม่ได้
  - **ไม่ใช้ผู้ให้บริการ AI ในการตัดสิน** ความล้มเหลวของ AI/agent ต้องไม่ขวางการบันทึกใบเสร็จ
  - ผู้ใช้เปลี่ยนค่าของผลตรวจหลังบันทึกไม่ได้ (append-only ยกเว้น `explanationText` — [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 3]])
- **กรณี Error หลัก**:
  - `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ (กฎ cross-cutting); Admin เรียกไม่ได้ (เขียนของผู้อื่น)
  - โครงการมีประมาณการแต่ไม่ได้เลือก `estimateLineId`/"ไม่อยู่ในประมาณการ" → ปฏิเสธพร้อมให้เลือก (FR-26)
  - แนบไฟล์แต่ยังไม่เชื่อมต่อที่เก็บไฟล์ภายนอก (หรือสิทธิ์หมดอายุ) → ปฏิเสธการส่งพร้อมคำเตือนให้เชื่อมต่อ (OP-29) ไม่ล้มเหลวเงียบ
  - แหล่งทุนไม่มีเวอร์ชันระเบียบ active หรือโครงการไม่มีแหล่งทุน → **ไม่บล็อกการส่ง** (ตรวจกับโค้ดแล้ว) บันทึกใบเสร็จด้วย `status` = "ไม่เข้าเงื่อนไข" และ `reasonCode` = `NO_ACTIVE_RULE_VERSION` / `NO_FUND_SOURCE` พร้อมคำอธิบาย (ไม่มี citation)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-03]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-04]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-06]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-24]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-25]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-26]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-27]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-28]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-01]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-02]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-03]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

#### OP-05 ดูรายละเอียดผลตรวจใบเสร็จ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของใบเสร็จ); **Admin อ่านอย่างเดียว** (FR-33) — **สถานะ: สร้างแล้ว**
- **Input**: `receiptId` (ได้จากรายการของ OP-40; Admin จาก OP-30)
- **Output**: `Receipt.status` + `VerificationResult` ล่าสุด (`decisionStatus`, `reasonCode`, `autoVerified`, `engineVersion`, `explanationText`, `decidedAt`), `VerificationFinding` ทุกกลุ่ม, `RuleItem.note` ของกฎที่ถูกอ้างอิง (ผ่าน `VerificationRuleCitation`),
  `fundSourceInactiveWarning` (FR-35) และ **เวอร์ชันประมาณการที่ใช้ตรวจ** (`estimateVersionId`) — ใบเสร็จก่อน 2026-11-14 ไม่มีฟิลด์ย้อนรอย (reasonCode/engineVersion/ข้อค้นพบ) ต้องแสดงได้เท่าที่มี
- **กฎทางธุรกิจ**: แสดงข้ออ้างอิงระเบียบควบคู่สถานะเสมอ (NFR-03); สถานะแสดงด้วยสี+ไอคอน+ข้อความ ไม่พึ่งสีอย่างเดียว (NFR-13)
- **กรณี Error หลัก**: `receiptId` ไม่ใช่ของผู้เรียกที่ไม่ใช่ Admin → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-06]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-24]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-25]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-03]]

#### OP-27 ดูรายการเอกสาร/ตราที่ต้องมีของหมวดและยอด

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: สร้างแล้ว** — ใช้แสดง checklist ที่หน้าตรวจทาน (เรียกซ้ำเมื่อเปลี่ยนหมวด/ยอด โดยเก็บค่าที่ติ๊กไว้)
- **Input**: `projectId`, `confirmedCategory`, `confirmedAmount`
- **Output**: ขั้นที่ต้องมีของ `EvidenceChain` ที่ `RuleItem` ของหมวดนั้นชี้ (`stepOrder`, `timing`, `isRequired`, รายการ `DocumentType` ที่รับได้ในขั้น พร้อม `documentName`/`formCode`) รวมขั้นแบบมีเงื่อนไขที่มีผลตาม `confirmedAmount` และรายการ `Attestation` (`attestationKey`, `attestationText`) — หมวดที่ไม่มี `evidenceChainId` ได้ผลว่าง (ไม่ตรวจเอกสาร)
- **กฎทางธุรกิจ**: ใช้โมดูล Rule Engine ตัวเดียวกับ OP-04 เพื่อให้ checklist ตรงกับสิ่งที่ถูกตรวจจริง; อ่านอย่างเดียว ไม่บันทึกข้อมูล; ขั้นทางเลือกต้องแสดงว่าเลือกอย่างใดอย่างหนึ่งก็ครบ; **ไม่ตรวจว่าไฟล์ที่แนบเป็นเอกสารนั้นจริง** (นักวิจัยยืนยันเอง)
- **กรณี Error หลัก**: ไม่มีแหล่งทุน/ระเบียบ → คืนว่างพร้อมข้อความ (ไม่ถือเป็น error ที่ขวาง)
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-27]]

#### OP-28 อธิบายผลด้วย AI agent และบันทึกประวัติการทำงาน

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (Client เรียกต่อจาก OP-04 แยกขอบเขตความล้มเหลว) — **สถานะ: สร้างแล้ว**
- **Input**: `receiptId` (พร้อมผลตรวจที่เพิ่งบันทึก)
- **Output**: `VerificationResult.explanationText` ที่ถูกเขียนทับด้วยคำอธิบายภาษาไทยพร้อมวิธีแก้ และ `AgentLog` ใหม่ 1 record (`createdAt`, `usedAi`, `model`, `category`, `amount`, `deterministicStatus`, `evidenceChainId`, `documentTypeIds`, `finalExplanation`, `durationMs`)
- **ลำดับ**: (1) อ่าน `EvidenceChain` ของหมวดและ `DocumentType` ที่เกี่ยวข้องจากที่เก็บข้อมูล (2) ให้ AI สรุป (3) เขียนทับ `explanationText` **โดยไม่แตะ `decisionStatus`/`Receipt.status`** (4) บันทึก `AgentLog`
- **กฎทางธุรกิจ/Validation**:
  1. ข้อมูลที่ส่งให้ AI มีเฉพาะ หมวด/ยอด ผลตัดสินและคำอธิบายจากกฎ และชุดเอกสาร/ประเภทเอกสารจากระบบ — **ห้ามใช้ความรู้ภายนอก ห้ามแต่งกฎ/เอกสาร ห้ามอ้างว่าเห็นหรือตรวจไฟล์ที่แนบ** (agent ไม่ได้รับไฟล์)
  2. ถ้า AI ใช้ไม่ได้ → ถอยกลับเป็นคำอธิบายจากกฎ + รายการเอกสารที่ต้องมี (`usedAi` = เท็จ) และยังบันทึก `AgentLog`
  3. `AgentLog` เขียนทุกครั้ง (append-only)
  4. ความล้มเหลวทั้งหมดของ operation นี้ (รวมการเขียน `AgentLog`) ต้องไม่ย้อนกลับหรือขวางใบเสร็จที่บันทึกสำเร็จแล้ว — ผู้ใช้เห็นคำอธิบายจากกฎล้วน
- **กรณี Error หลัก**: `receiptId` ไม่ใช่ของผู้เรียก → ปฏิเสธ; AI ล้มเหลว → ถอยกลับ (ไม่ใช่ error)
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-31]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-05]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-03]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

### 4.3 ฟีเจอร์ที่ 4 — แก้ไขและส่งใบเสร็จที่ไม่ผ่านตรวจซ้ำ (Backlog FR-07)

#### OP-06 แก้ไขข้อมูลใบเสร็จแล้วส่งตรวจซ้ำ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของใบเสร็จ) — **สถานะ: Backlog**
- **Input**: `receiptId` (ได้จากรายการของ OP-40), `confirmedAmount`, `confirmedDate`, `confirmedCategory`, `confirmedVendorName`, `estimateLineId`, `providedDocumentTypeIds`, `confirmedAttestationKeys`, `summaryAmount`
- **Output**: เหมือน OP-04 (เรียกลำดับประมวลผลเดียวกัน สร้าง `VerificationResult` ใหม่ ไม่แก้ record เดิม — [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 3]]) และอัปเดต `Receipt.status` ตามผลใหม่ (ครั้งแรกที่ระบบอนุญาตให้สถานะเปลี่ยนหลังสร้าง)
- **กฎทางธุรกิจ**: เรียกได้เฉพาะใบเสร็จที่ `status` ∈ {"ต้องแก้ไข", "ต้องชี้แจง/ขออนุมัติ", "ไม่เข้าเงื่อนไข"} (4 ระดับ — เดิม 3); ใช้กฎ/ประมาณการเวอร์ชัน active/ล่าสุด ณ เวลาส่งตรวจซ้ำ
- **กรณี Error หลัก**: ใบเสร็จ "ผ่าน" อยู่แล้ว → ปฏิเสธ; ไม่ใช่ของผู้เรียก → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-07]]

#### OP-07 อัปโหลดไฟล์ใบเสร็จใหม่แทนชุดเดิม

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของใบเสร็จ) — **สถานะ: Backlog**
- **Input**: `receiptId` (ได้จากรายการของ OP-40; สถานะ "ต้องแก้ไข"/"ต้องชี้แจง/ขออนุมัติ"/"ไม่เข้าเงื่อนไข"), ชุดไฟล์ใหม่ทั้งชุด 1–5 ไฟล์
- **Output**: คง `Receipt.id`/`projectId` เดิม ลบ `ReceiptFile` ชุดเดิมทั้งชุด (รวมไฟล์ในที่เก็บไฟล์ภายนอกตาม OP-37) สร้างชุดใหม่ผ่าน OP-38 แล้วให้ผู้ใช้ตรวจทาน (OP-02) และส่งตรวจซ้ำ (OP-06)
- **กฎทางธุรกิจ**: ใช้กฎตรวจไฟล์เดียวกับ OP-01 ทุกข้อ; แทนที่ทั้งชุดเท่านั้น (ไม่แทนทีละไฟล์ — [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 9]])
- **กรณี Error หลัก**: เหมือน OP-01 + ใบเสร็จ "ผ่าน" → ปฏิเสธ; ลบไฟล์เดิมในที่เก็บภายนอกไม่สำเร็จ → ไม่แทนที่ (แจ้งให้เชื่อมต่อใหม่)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-07]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-19]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-22]]

### 4.4 ฟีเจอร์ที่ 5 และ 6 — Dashboard และแจ้งเตือน (Backlog)

#### OP-08 ดูภาพรวมสถานะใบเสร็จของโครงการ (Dashboard ของนักวิจัย)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: Backlog** (ปัจจุบันมีเฉพาะ Admin Dashboard OP-30 และหน้ารายการใบเสร็จรายโครงการ + OP-26)
- **Input**: `projectId`
- **Output**: จำนวนใบเสร็จของโครงการแยกตาม `Receipt.status` 4 ค่า ("ผ่าน"/"ต้องแก้ไข"/"ต้องชี้แจง/ขออนุมัติ"/"ไม่เข้าเงื่อนไข" — ไม่มี "รอ OCR"/"รอตรวจทาน"/"รอผลตรวจ" ซึ่งไม่บันทึกถาวร) และ flag `canExport` (จริงเมื่อมีใบเสร็จ "ผ่าน" ≥ 1 — FR-21/OP-10)
- **กฎทางธุรกิจ**: โครงการที่ไม่มีใบเสร็จแสดงทุกสถานะเป็น 0 ไม่ใช่ error
- **กรณี Error หลัก**: `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-08]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-21]]

#### OP-09 ดูรายการแจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: Backlog**
- **Input**: ไม่มี
- **Output**: รายการ `Receipt` ที่ `status` ∈ {"ต้องแก้ไข", "ต้องชี้แจง/ขออนุมัติ", "ไม่เข้าเงื่อนไข"} ของทุกโครงการของผู้เรียก (คำนวณจากสถานะ ไม่มี entity แจ้งเตือน)
- **กฎทางธุรกิจ**: ไม่รวมการแจ้งเตือนตามกำหนดเวลาส่งหลักฐาน (ตัดออกจาก MVP); ช่องทางอีเมลคือ OP-36
- **กรณี Error หลัก**: ไม่มี — คืนรายการเปล่าได้
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-09]]

#### OP-36 ส่งอีเมลแจ้งเตือนใบเสร็จที่ค้างอยู่

- **ผู้เรียกได้**: ระบบเรียกเอง (Trusted Server Service) — **สถานะ: Backlog** (หน้าที่ (ค) ของ [[architecture#5.4 ตำแหน่งฝั่งเซิร์ฟเวอร์ — ตัดสินใจแล้ว 2026-11-17: แบบผสม (ยืนยันโดยผู้ใช้ผ่าน AskUserQuestion)|architecture 5.4]])
- **Input**: ไม่มีจากผู้ใช้ — ระบบหา `Receipt` ที่ `status` ∈ {"ต้องแก้ไข", "ต้องชี้แจง/ขออนุมัติ", "ไม่เข้าเงื่อนไข"} แล้วจัดกลุ่มตามเจ้าของ (`Receipt.ownerUserId` → `User.email`)
- **Output**: อีเมลแจ้งเตือนต่อเจ้าของ 1 ฉบับต่อรอบ (ผ่านบริการส่งอีเมลภายนอก) ไม่แก้ข้อมูลใบเสร็จ
- **กฎทางธุรกิจ/Validation**: ส่งเฉพาะผู้ที่ยังมีสถานะยินยอมอยู่ (ไม่ส่งให้ผู้ที่ถอนความยินยอมแล้ว); ไม่ส่งรายการที่ `status` = "ผ่าน"; ผู้ให้บริการส่งอีเมลเป็นบริการภายนอก ต้องพิจารณา NFR-08/NFR-09
- **ประเด็นที่ยังเปิด (รอออกแบบ FR-09 — ดูหัวข้อ 5):** กำหนดเวลา/ความถี่ในการส่ง, การไม่ส่งซ้ำใบเดิม และเนื้อหาอีเมลที่เหมาะสมกับความเป็นส่วนตัว — FR-09 ไม่ระบุ จึงยังไม่เพิ่ม entity เก็บประวัติการส่ง
- **กรณี Error หลัก**: ส่งอีเมลไม่สำเร็จ → สร้าง `AuditLogEntry` (`eventType` = "ส่งอีเมลแจ้งเตือนไม่สำเร็จ", `actorUserId` = เจ้าของใบเสร็จที่ควรได้รับอีเมล, `detailText` = เหตุผลเชิง meta ไม่มีเนื้อหาใบเสร็จ) และไม่กระทบข้อมูลใบเสร็จ [Backlog]
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-09]], [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-10]]

### 4.5 ฟีเจอร์ที่ 7 — Export (Backlog)

#### OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: Backlog**
- **Input**: `projectId`
- **Output**: `ExportBatch` ใหม่ (`fileReference`) พร้อม `ExportBatchReceipt` ของ `Receipt` ทุกใบที่ `status` = "ผ่าน" ของโครงการ (รูปแบบไฟล์ยังไม่ระบุ — [[db-spec#5.2 รูปแบบไฟล์รายงาน Export (FR-10) และสำเนาข้อมูลส่วนบุคคล (FR-17)|db-spec 5.2]])
- **กฎทางธุรกิจ/Validation**: (1) ต้องมีใบเสร็จ "ผ่าน" ≥ 1 มิฉะนั้นปิดปุ่ม (FR-21; OP-08 `canExport`) (2) หลัง export ตั้ง `isExported` = จริง และ `firstExportedAt` (ถ้ายังไม่มี) ล็อกการลบเอง (OP-17) (3) export ครั้งถัดไปรวมใบ "ผ่านทั้งหมด" ใหม่เสมอ
- **กรณี Error หลัก**: ไม่มีใบ "ผ่าน" → ปฏิเสธพร้อมเหตุผล (FR-21 AC-1); ไม่ใช่ของผู้เรียก → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-10]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-21]]

### 4.6 ฟีเจอร์ที่ 8, 20, 22 — ระเบียบ แหล่งทุน และ Admin

#### OP-11 นำเข้า/แก้ไขระเบียบของแหล่งทุน (หมวด/อัตรา/ชุดเอกสาร)

**อัปเดต 2026-11-17:** `RuleItem` เปลี่ยนเป็นโครงสร้างอัตราตามที่ระบบใช้จริง (เดิมมี `maxAmount`, `requiredDocumentDescription`, `ruleText`)

- **ผู้เรียกได้**: Admin เท่านั้น — **สถานะ: สร้างบางส่วน** (เพิ่ม/ลบแหล่งทุน และเพิ่ม/แก้/ลบกฎรายหมวดผ่านหน้าจอใต้ `RuleVersion` active ชุดเดียวที่สร้างให้อัตโนมัติ; ไม่มี UI ประวัติเวอร์ชัน และไม่นำเข้าจากไฟล์ระเบียบโดยตรง)
- **Input**: `fundSourceId` (แหล่งทุนเดิม) **หรือ** `fundSourceName` + `fundSourceCode` (สร้างแหล่งทุนใหม่), `versionLabel`, รายการ `RuleItem`: `categoryName`, `rateType`, `rateAmount`, `unit`, `requiredEvidenceType`, `evidenceChainId`, `note`
- **Output**: `FundSource` (สร้างใหม่หรือของเดิม) กับ `RuleVersion` ที่ `isActive` = จริง และ `RuleItem` ที่แนบ
- **กฎทางธุรกิจ/Validation**:
  1. สร้าง `RuleVersion` ใหม่ของแหล่งทุนเดิมต้องตั้งเวอร์ชันเดิมของแหล่งทุนนั้นเป็นเท็จในการดำเนินการเดียวกัน (active ได้ 1 ต่อแหล่งทุน — [[db-spec#4. กฎทางธุรกิจที่กระทบโครงสร้างข้อมูล (Business Rules)|db-spec กฎข้อ 7]])
  2. `rateType` ∈ {"เพดานตามจริง", "เหมาจ่าย", "ต่อหน่วย", "ตามข้อเสนอโครงการ"}; `rateAmount` ว่างได้เมื่อ "ตามข้อเสนอโครงการ"; **ห้ามแต่งตัวเลขที่ไม่มีในคู่มือ** ให้ระบุใน `note`
  3. `evidenceChainId` ต้องอ้าง `EvidenceChain` ที่มีอยู่จริง (ไม่บังคับ)
  4. ข้อมูลกฎเดิมที่มีแต่เพดานเดี่ยว (`maxAmount`) ตีความเป็น `rateType` = "เพดานตามจริง", `rateAmount` = ค่านั้น และ `evidenceChainId` ว่าง
  5. ใบเสร็จที่ยังไม่ส่งตรวจใช้เวอร์ชันใหม่ทันทีในการตรวจครั้งต่อไป ไม่กระทบ `VerificationResult` เดิม (snapshot)
  6. ไม่ย้อนปรับ LLM ใดๆ (กฎตัดสินเสมอ AI ไม่ตัดสิน)
  6a. **การลบ `RuleItem` ต้องไม่ทำลายการย้อนรอย (NFR-04) [Backlog]:** `RuleItem` เป็นแบบ **ปิดใช้งานเท่านั้น** (`RuleItem.isActive` = เท็จ) เมื่อมี `VerificationResult` หรือ `VerificationRuleCitation` อ้างอิงอยู่แล้ว ห้ามลบจริง; รายการที่ยังไม่มีใครอ้างอิงลบจริงได้ `RuleItem` ที่ปิดใช้งานไม่ถูกใช้ตัดสินใบเสร็จใหม่ (หมวดนั้นถือว่าไม่อยู่ในกฎ) แต่ยังอ่านได้เพื่ออธิบายผลตรวจเก่า — สอดคล้องกับแนวทาง FR-35 (ปิดใช้งานแทนลบ)
     **ช่องว่างที่ทราบ (พฤติกรรมปัจจุบัน):** การลบกฎรายหมวดเป็นการลบจริงทุกกรณี ทำให้ผลตรวจเก่าอาจชี้ไปยังกฎที่ไม่มีแล้ว
  7. ปลายทาง: เขียน `AuditLogEntry` (`eventType` = "นำเข้า/เปลี่ยนระเบียบ (NFR-04)") เมื่อ Audit Trail Store สร้างแล้ว (Backlog)
- **กรณี Error หลัก**: ผู้เรียกไม่ใช่ Admin → ปฏิเสธ; `fundSourceId` ไม่มีอยู่และไม่ได้ส่งชื่อ/รหัสสร้างใหม่ → ปฏิเสธ; `rateType` นอกเซต → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-11]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-29]],
  [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

#### OP-12 ดูเวอร์ชันระเบียบที่ active ของแหล่งทุน

- **ผู้เรียกได้**: Admin (ตรวจก่อน/หลังนำเข้า) และ Client/นักวิจัยในฐานะผู้ตรวจใบเสร็จ (โหลดกฎตอน OP-04 — ข้อมูลระดับองค์กรที่ทุกคนที่ล็อกอินอ่านได้) — **สถานะ: สร้างแล้ว**
- **Input**: `fundSourceId`
- **Output**: `RuleVersion` ที่ `fundSourceId` ตรงและ `isActive` = จริง พร้อม `RuleItem` ทั้งหมด (`categoryName`, `rateType`, `rateAmount`, `unit`, `requiredEvidenceType`, `evidenceChainId`, `note`) และ `EvidenceChain`/`EvidenceChainStep`/`DocumentType`/`Attestation` ที่ `RuleItem` เหล่านั้นอ้างถึง; ใช้ได้กับแหล่งทุนที่ปิดใช้งานด้วย (FR-35: กฎเก็บไว้ครบ)
- **กฎทางธุรกิจ**: ผลลัพธ์ต้องมี `RuleVersion` active เพียง 1 ต่อแหล่งทุน; ถ้าไม่มี คืนว่างพร้อมสถานะ "ยังไม่มีระเบียบให้ใช้ตรวจสำหรับแหล่งทุนนี้"
- **กรณี Error หลัก**: ผู้เรียกไม่ได้ล็อกอิน → ปฏิเสธ
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-11]],
  [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]],
  [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

#### OP-31 อัปเดตชุดกฎ ชุดเอกสาร และประเภทเอกสารตามรหัสคงที่

- **ผู้เรียกได้**: Admin เท่านั้น — **สถานะ: สร้างแล้ว** (ปุ่ม "อัปเดตเฉพาะระเบียบ/กฎ" แยกจากการใส่ข้อมูลตัวอย่าง ซึ่งไม่แตะข้อมูลผู้ใช้/โครงการ/ใบเสร็จ)
- **Input**: ชุดข้อมูลมาตรฐาน: `DocumentType` (`documentName`, `formCode`, `requiredFields`, `validityChecks`, `sourceExcerpt`), `EvidenceChain` (`chainName`) พร้อม `EvidenceChainStep` (+ รายการ `documentTypeId` ที่รับได้, `timing`, `isRequired`, เงื่อนไข) และ `Attestation`, `FundSource`/`RuleVersion` (`versionLabel`)/`RuleItem` — ทุกตัวมีรหัสคงที่
- **Output**: เพิ่ม/เขียนทับระเบียนตามรหัสคงที่ (ทำซ้ำได้ ผลเหมือนเดิม)
- **กฎทางธุรกิจ**: **เพิ่ม/ทับเท่านั้น ไม่ลบ** ระเบียนเก่าที่รหัสไม่อยู่ในชุดใหม่ (เช่น หมวดที่เปลี่ยนชื่อ) — ต้องลบแยกด้วยตนเอง; ตัวเลขทุกตัวต้องมีที่มาใน `note` และห้ามแต่ง; ระเบียนที่ไม่ใช่ Admin เขียนไม่ได้ (ปฏิเสธที่ชั้นกฎสิทธิ์) ผู้ที่ไม่ใช่ Admin กดแล้วถูกข้ามและแจ้งผล "ข้าม"
  ชุดกฎปัจจุบันคือ "2570.4" (28 หมวดรายการ) และชุดเอกสารที่ยังไม่อัปเดตในระบบจริงจนกว่า Admin กดปุ่มนี้ (กฎที่ engine ต้องการแต่ไม่มีในข้อมูลจะถูกข้ามอย่างปลอดภัย)
- **กรณี Error หลัก**: ผู้เรียกไม่ใช่ Admin → ปฏิเสธ/ข้าม
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-29]], [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-27]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-03]]

#### OP-32 ปิดใช้งาน/เปิดใช้งานแหล่งทุน

- **ผู้เรียกได้**: Admin เท่านั้น — **สถานะ: Backlog** (FR-35)
- **Input**: `fundSourceId`, `isActive` (เท็จ = ปิดใช้งาน, จริง = เปิดกลับ)
- **Output**: `FundSource` ที่อัปเดต (`isActive`, `deactivatedAt` — ตั้งตอนปิด ล้างตอนเปิดกลับ)
- **กฎทางธุรกิจ/Validation**:
  1. ปิดใช้งาน **ไม่ลบ** `RuleVersion`/`RuleItem` (เก็บครบเพื่อย้อนตรวจใบเสร็จเก่าและตรวจต่อ — NFR-04)
  2. แหล่งทุนปิดใช้งานไม่ปรากฏใน OP-21/OP-19/OP-20 สำหรับนักวิจัย; โครงการเดิมยังแสดงชื่อแหล่งทุนตามปกติ (OP-18)
  3. ใบเสร็จใหม่ในโครงการเดิมที่ผูกแหล่งทุนที่ปิดใช้งาน **ตรวจต่อด้วยกฎที่เก็บไว้ พร้อมคำเตือนว่าแหล่งทุนปิดใช้งาน** (ตัดสินแล้ว — OP-04/OP-05 `fundSourceInactiveWarning`)
  4. เปิดกลับได้เสมอ
- **กรณี Error หลัก**: ผู้เรียกไม่ใช่ Admin → ปฏิเสธ; `fundSourceId` ไม่มีอยู่ → ปฏิเสธ
- **FR/NFR**: [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-35]], [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

#### OP-33 ลบแหล่งทุนถาวร (พฤติกรรมปัจจุบัน)

- **ผู้เรียกได้**: Admin เท่านั้น — **สถานะ: สร้างแล้ว** — **จะถูกแทนที่ด้วย OP-32** เมื่อ FR-35 สร้างแล้ว
- **Input**: `fundSourceId`
- **Output**: ลบ `FundSource` พร้อม `RuleVersion`/`RuleItem` ทั้งหมดของมัน
- **กฎทางธุรกิจ**: **ไม่ตรวจว่ามีโครงการใช้อยู่** โครงการที่ผูกอยู่จะแสดงเป็น "ไม่พบแหล่งทุน" และใบเสร็จเดิมสูญเสียกฎที่ใช้ย้อนตรวจ (ขัดกับ NFR-04) — นี่คือช่องว่างที่ FR-35 มีไว้ปิด
- **กรณี Error หลัก**: ไม่ใช่ Admin → ปฏิเสธ
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-35]]

#### OP-30 ดูภาพรวมใบเสร็จของทุกคน (Admin อ่านอย่างเดียว)

- **ผู้เรียกได้**: Admin เท่านั้น — **สถานะ: สร้างแล้ว** (กลับคำตัดสินใจเดิมของ FR-12 — [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]])
- **Input**: ไม่มี (ค้นใบเสร็จทั้งระบบโดยไม่กรองเจ้าของ — ทำได้เฉพาะ Admin)
- **Output**: สรุปจำนวน/ยอดตามสถานะ 4 ระดับ ตามหมวด `confirmedCategory` และตามแหล่งทุน และรายละเอียดรายใบ: `Receipt` (ค่าที่ยืนยัน, `status`), เจ้าของ (`User.fullName`, `User.email`), `Project.projectName`, `FundSource.fundSourceName` (แสดงต่อได้แม้ปิดใช้งาน), ผลตรวจ/คำอธิบาย และ `ReceiptFile` (`fileReference` เป็นลิงก์)
- **กฎทางธุรกิจ/Validation**: **อ่านอย่างเดียว** — ไม่มีการเขียน/แก้/ลบใบเสร็จของผู้อื่น; ผู้ใช้ทั่วไปไม่เห็นเมนู Admin และถูกปฏิเสธที่ชั้นกฎสิทธิ์; นักวิจัยต้องได้รับแจ้งก่อนอัปโหลดครั้งแรก (OP-13/OP-14); ปลายทาง FR-37 ลิงก์ไฟล์เปิดได้เฉพาะเจ้าของ+Admin
- **กรณี Error หลัก**: ผู้เรียกไม่ใช่ Admin → ปฏิเสธ
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-12]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-05]]

### 4.7 ฟีเจอร์ที่ 14 — ประมาณการโครงการและเวอร์ชัน (FR-26/FR-36)

> **การตัดสินใจที่กำหนดแล้ว:** เวอร์ชันประมาณการเก็บแบบ **สำเนาทั้งชุดต่อเวอร์ชัน** (ดู [[db-spec#E-15 เวอร์ชันประมาณการ (EstimateVersion) — [FR-26 สร้างแล้ว แบบเวอร์ชันเดียว / FR-36 Backlog]|db-spec E-15]]) ใบเสร็จอ้างรายการของเวอร์ชันล่าสุด และ `VerificationResult.estimateVersionId` บันทึกเวอร์ชันที่ใช้ตอนตรวจ

#### OP-22 นำเข้าและแปลงไฟล์ประมาณการ 17.2 (ดูตัวอย่างก่อนบันทึก)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (โครงการของตน) — **สถานะ: สร้างแล้ว** ไม่บันทึกข้อมูล
- **Input**: `projectId`, ไฟล์ตารางประมาณการ (ตาราง/ข้อความคั่น)
- **Output**: รายการ `EstimateLine` ที่แปลงแล้ว (`orderNo`, `groupName`, `itemName`, `multiplierText`, `installmentAmounts`, `total`, `unitPrice`, `quantity`), หมวดระเบียบที่ระบบเสนอ `ruleCategory` ต่อรายการ และคำเตือน
- **กฎทางธุรกิจ/Validation**: (1) เลือกแผ่นที่เกี่ยวข้องกับตาราง 17.2 อ่านหัวกลุ่มและแถวรายการ ข้ามแถวว่าง/ยอดรวมย่อย (2) แยก `unitPrice` (ตัวประกอบที่มีหน่วยบาท) และ `quantity` (ผลคูณตัวประกอบอื่น) จาก `multiplierText` ว่างเมื่อแยกไม่ได้ (ข้อความตัวคูณว่าง/ไม่มีรูปแบบคูณ) (3) เตือนเมื่อผลรวมงวด ≠ `total` และเมื่อ `unitPrice` × `quantity` ≠ `total` (4) เสนอ `ruleCategory` ให้ครบทุกรายการตามรายการอย่างเป็นทางการของมหาวิทยาลัย ผู้ใช้แก้ได้ก่อนบันทึก
- **กรณี Error หลัก**: ไฟล์ไม่ใช่ตาราง 17.2/ไม่พบแผ่น → แจ้งเป็นภาษาไทย; `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-26]]

#### OP-23 บันทึกประมาณการของโครงการ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของโครงการเท่านั้น; Admin เขียนไม่ได้) — **สถานะ: สร้างแล้วแบบแทนที่ทั้งชุด**; การสร้างเวอร์ชันใหม่ + จับคู่ใบเสร็จ (FR-36) **Backlog**
- **Input**: `projectId`, รายการ `EstimateLine` ที่ยืนยันแล้ว (รวม `ruleCategory` ที่แก้แล้ว), `sourceFileName`, และ (ถ้าโครงการมีใบเสร็จที่ผูกรายการอยู่) ผลจับคู่ใหม่ต่อใบเสร็จจาก OP-24: `receiptId` + `toEstimateLineId` (หรือ "ไม่อยู่ในประมาณการ" = ว่าง)
- **Output**:
  - **พฤติกรรมปัจจุบัน:** แทนที่ `EstimateLine` ทั้งโครงการด้วยชุดใหม่ (ตามลำดับ `orderNo`) ใบเสร็จที่ผูกอยู่เดิมอาจผูกผิดรายการ — ระบบแสดงคำเตือนเท่านั้น
  - **ปลายทาง FR-36:** `EstimateVersion` ใหม่ (`versionNumber` = ล่าสุด+1, `isLatest` = จริง, `importedByUserId`, `importedAt`, `sourceFileName`) พร้อม `EstimateLine` ชุดใหม่ทั้งชุด; ตั้ง `isLatest` ของเวอร์ชันเดิมเป็นเท็จ; ย้าย `Receipt.estimateLineId` ของใบเสร็จที่ผูกอยู่ไปรายการใหม่; สร้าง `EstimateLineRemap` ต่อการย้าย
- **กฎทางธุรกิจ/Validation (FR-36)**:
  1. เก็บเวอร์ชันเก่าเป็นประวัติ ไม่เขียนทับ (สำเนาทั้งชุดต่อเวอร์ชัน)
  2. **บล็อกการบันทึกจนกว่าใบเสร็จที่ผูกรายการอยู่ทุกใบจะถูกจับคู่ครบ** — ไม่มีใบเสร็จผูกผิดรายการโดยไม่มีใครรู้
  3. ยอดใช้ไป/คงเหลือและการตรวจ "เกิน 100%" ใช้เวอร์ชัน `isLatest` เสมอ; `VerificationResult` เดิมไม่เปลี่ยน (ยังชี้ `estimateVersionId` เดิม)
  4. การย้ายและการสร้างเวอร์ชันเป็นการดำเนินการเดียว ล้มเหลวกลางทางต้องไม่เหลือสถานะครึ่งๆ กลางๆ
  5. รายการที่ไม่มี `quantity` ยังบันทึกได้ แต่การตรวจอัตรา×จำนวนจะไม่ถือว่าตรวจตัวเลขได้จนกว่านำเข้าใหม่ที่ระบุจำนวนหน่วย
- **กรณี Error หลัก**: `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ; มีใบเสร็จที่ยังจับคู่ไม่ครบ → ปฏิเสธการบันทึก (ปลายทาง); ไม่มีรายการเลย → ปฏิเสธ
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-26]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-36]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]]

#### OP-24 เสนอการจับคู่ใบเสร็จเดิมกับรายการของเวอร์ชันใหม่

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: Backlog** (FR-36)
- **Input**: `projectId`, รายการ `EstimateLine` ของเวอร์ชันใหม่ (จาก OP-22)
- **Output**: ต่อใบเสร็จที่ผูกรายการของเวอร์ชันล่าสุดอยู่ (`Receipt.estimateLineId` ไม่ว่าง): `receiptId`, รายการเดิม, ผลจับคู่ `toEstimateLineId` ที่เสนอ หรือ "จับคู่ไม่ได้" พร้อม `matchMethod` ("จับคู่อัตโนมัติด้วยชื่อรายการ+หมวดระเบียบ")
- **กฎทางธุรกิจ**: จับคู่ด้วย **`itemName` + `ruleCategory`** ที่ตรงกัน (ไม่ใช้ลำดับแถว); มีผู้สมัครมากกว่า 1 หรือไม่มี → ถือว่าจับคู่ไม่ได้ ให้ผู้ใช้เลือกเอง; อ่านอย่างเดียว ไม่บันทึก
- **กรณี Error หลัก**: `projectId` ไม่ใช่ของผู้เรียก → ปฏิเสธ
- **FR/NFR**: [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-36]]

#### OP-25 ดูประวัติเวอร์ชันประมาณการ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (โครงการของตน); Admin อ่านอย่างเดียว — **สถานะ: Backlog** (FR-36)
- **Input**: `projectId`, `estimateVersionId` (ไม่บังคับ — ระบุเพื่อดูรายการของเวอร์ชันนั้น)
- **Output**: รายการ `EstimateVersion` (`versionNumber`, `isLatest`, `sourceFileName`, `importedByUserId`, `importedAt`) และเมื่อระบุเวอร์ชัน → `EstimateLine` ของเวอร์ชันนั้น รวมจำนวนผลตรวจที่ใช้เวอร์ชันนั้นตรวจ (จาก `VerificationResult.estimateVersionId`) และร่องรอยการย้าย (`EstimateLineRemap`)
- **กฎทางธุรกิจ**: อ่านอย่างเดียว; เวอร์ชันเก่าแก้ไม่ได้
- **กรณี Error หลัก**: ไม่ใช่ของผู้เรียก (และไม่ใช่ Admin) → ปฏิเสธ
- **FR/NFR**: [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-36]]

#### OP-26 ดูสรุปยอดใช้ไป/คงเหลือ/% รายรายการ

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ; Admin อ่านอย่างเดียว — **สถานะ: สร้างแล้ว**
- **Input**: `projectId`
- **Output**: ต่อ `EstimateLine` ของเวอร์ชัน `isLatest`: `itemName`, `ruleCategory` (หน้าตรวจทานใช้ตั้งหมวดล่วงหน้าเมื่อผู้ใช้เลือกรายการ — สร้างแล้ว), `total`, ยอดใช้ไป (ผลรวม `confirmedAmount` ของใบเสร็จที่ `estimateLineId` ตรงรายการ), คงเหลือ, เปอร์เซ็นต์ที่ใช้ไป เทียบยอดรวมทั้งโครงการของรายการ (ไม่เทียบรายงวด); คำเตือนรายการที่ไม่มี `quantity`
- **กฎทางธุรกิจ**: โครงการยังไม่มีประมาณการคืนว่างพร้อมคำแนะนำให้นำเข้า ไม่ใช่ error; ปัจจุบันยังมีคำเตือนเมื่อนำเข้าซ้ำแล้วมีใบเสร็จผูกอยู่ (ก่อน FR-36)
- **กรณี Error หลัก**: ไม่ใช่ของผู้เรียก (และไม่ใช่ Admin) → ปฏิเสธ
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-26]]

### 4.8 ฟีเจอร์ที่ 10 — ความยินยอม (สร้างบางส่วน)

#### OP-13 ดูสถานะยินยอมและ Privacy Notice

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: สร้างบางส่วน** (ยินยอมแบบเบา ไม่มีหน้า Privacy Notice แยกและไม่มีเวอร์ชันประกาศ)
- **Input**: ไม่มี (implicit: ผู้เรียก)
- **Output**: สถานะยินยอม = มี/ไม่มี `User.privacyConsentAcceptedAt` และข้อความแจ้งว่า Admin อ่านข้อมูลใบเสร็จได้แบบอ่านอย่างเดียว (FR-33); **ปลายทาง FR-13/FR-15:** `PrivacyNoticeVersion` ปัจจุบัน (`versionLabel`, `content`, `effectiveDate`) และสถานะจาก `ConsentRecord` ล่าสุด
- **กฎทางธุรกิจ**: แสดงก่อนอัปโหลดครั้งแรกเมื่อยังไม่เคยยินยอม
- **กรณี Error หลัก**: ไม่มี (อ่านอย่างเดียว)
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-13]], [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-33]]

#### OP-14 ให้ความยินยอมชัดแจ้ง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: สร้างบางส่วน**
- **Input**: ปัจจุบัน — ผู้ใช้ติ๊กยืนยัน; **ปลายทาง FR-15** — `privacyNoticeVersionId` (เวอร์ชันที่เพิ่งเห็นจาก OP-13)
- **Output**: ปัจจุบัน — ตั้ง `User.privacyConsentAcceptedAt` = ปัจจุบัน (ครั้งเดียว ผู้ที่ติ๊กแล้วไม่ถูกถามอีก; ไม่ใช่การเปลี่ยน `roleType`); ปลายทาง — `ConsentRecord` ใหม่ (`actionType` = "ให้ความยินยอม") ปลดล็อก OP-04
- **กฎทางธุรกิจ**: ต้องยินยอมก่อนส่งตรวจ/อัปโหลดครั้งแรก (บล็อกพร้อมคำเตือนจนกว่าจะติ๊ก); ปลายทางต้องบันทึกเวอร์ชันที่เห็นจริงคู่กับการยินยอม (Accountability)
- **กรณี Error หลัก**: ไม่มี (ไม่ยินยอม = ไม่เรียก operation นี้ → OP-04 ถูกบล็อก)
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-14]], [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-15]]

#### OP-15 ถอนความยินยอม (ฝั่ง Client — ลำดับบังคับ)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: Backlog** (FR-16/FR-20/FR-37)
- **Input**: ไม่มี (implicit: ผู้เรียก)
- **Output**: `ConsentRecord` ใหม่ (`actionType` = "ถอนความยินยอม") แล้วขอลบข้อมูลทั้งหมดผ่าน OP-35 — **OP-15 ไม่เขียน `AuditLogEntry`** ผู้เขียนเหตุการณ์ถอนความยินยอม+ลบข้อมูลทั้งหมดเพียงรายเดียวคือ OP-35
- **ลำดับการประมวลผล (บังคับ — [[architecture#3.5 Journey 5 และ 7 — ถอนความยินยอม / ลบใบเสร็จของตนเอง (ปลายทางตาม FR-37)|architecture 3.5]], FR-37 ข้อ 4)**:
  1. ระงับสิทธิ์อัปโหลด/ประมวลผลใบเสร็จใหม่ของผู้เรียกทันที (FR-16)
  2. **ลบไฟล์ทั้งชุดที่ระบบสร้างในที่เก็บไฟล์ภายนอกก่อน** ผ่าน OP-37 ด้วยสิทธิ์ระยะสั้นของผู้ใช้เอง ถ้าไม่สำเร็จ (เช่น สิทธิ์หมดอายุ) **หยุด ไม่ลบข้อมูลใดในระบบ** แจ้งเหตุผลให้ผู้ใช้เชื่อมต่อใหม่แล้วลองอีกครั้ง (ไม่มีไฟล์กำพร้า ไม่ล้มเหลวเงียบ)
  3. เมื่อลบไฟล์สำเร็จครบ จึงสั่ง OP-35 ให้ Trusted Server Service ลบข้อมูลในระบบจนเสร็จ (แม้ผู้ใช้ปิดหน้าจอแล้ว)
- **กฎทางธุรกิจ**: ไม่มีเงื่อนไขตามสถานะ export (ต่างจาก OP-17 โดยเจตนา — ระบบเป็นด่านตรวจก่อนสอบ ไม่ใช่ที่เก็บหลักฐานทางการ — [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-20]])
- **กรณี Error หลัก**: ลบไฟล์ภายนอกไม่สำเร็จ → ตามข้อ 2; ไม่มีสถานะ "ให้ความยินยอม" → ไม่มีอะไรให้ถอน
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-16]], [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-20]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-37]]

#### OP-35 ลบข้อมูลทั้งหมดของผู้ใช้โดย Trusted Server Service

- **ผู้เรียกได้**: Client ในนามนักวิจัย (หลัง OP-15 ข้อ 2 สำเร็จ) — **สถานะ: Backlog** (หน้าที่ (ข) ของ [[architecture#5.4 ตำแหน่งฝั่งเซิร์ฟเวอร์ — ตัดสินใจแล้ว 2026-11-17: แบบผสม (ยืนยันโดยผู้ใช้ผ่าน AskUserQuestion)|architecture 5.4]])
- **Input**: ไม่มี (ตัวตนผู้ขอมาจากข้อมูลยืนยันตัวตนของผู้เรียก เซิร์ฟเวอร์ตรวจเอง)
- **Output**: ลบ `Receipt` ทุกใบของผู้ขอ (ทุกโครงการที่เป็นเจ้าของ) พร้อม `ReceiptFile`, `VerificationResult`/`VerificationFinding`/`VerificationRuleCitation`, `AgentLog`, `EstimateLineRemap`, `ExportBatchReceipt` — **ไม่ลบ** `Project`, `FundSource`, `EstimateVersion`/`EstimateLine` (ตัดสินแล้ว: เป็นข้อมูลโครงการ ไม่ใช่ข้อมูลส่วนบุคคล — db-spec 5.6 ข้อ 5) และไม่ลบ `ExportBatch`; สร้าง `AuditLogEntry` (`eventType` = "ถอนความยินยอม+ลบข้อมูลทั้งหมด (FR-20)", `affectedReceiptCount`, ไม่เก็บเนื้อหาใบเสร็จ) — **OP-35 เป็นผู้เขียน `AuditLogEntry` ของการถอนความยินยอมเพียงรายเดียว** (OP-15 ไม่เขียน)
- **กฎทางธุรกิจ/Validation**:
  1. ทำงานต่อจนเสร็จแม้ผู้ใช้ปิดหน้าจอ (เหตุผลที่ต้องอยู่เซิร์ฟเวอร์)
  2. ไม่ตรวจ `isExported`
  3. **ลบเฉพาะข้อมูลในระบบ** เซิร์ฟเวอร์ไม่ถือข้อมูลรับรองของผู้ใช้ต่อที่เก็บไฟล์ภายนอก จึงทำหน้าที่ลบไฟล์ภายนอกไม่ได้ — ลำดับที่ Client ลบไฟล์ก่อนเป็นข้อบังคับของขั้นตอน (OP-15) ไม่ใช่สิ่งที่เซิร์ฟเวอร์ตรวจได้
  4. ทำซ้ำได้โดยผลเหมือนเดิม (ถ้าล้มเหลวกลางทาง เรียกซ้ำเพื่อลบส่วนที่เหลือได้)
- **กรณี Error หลัก**: ตัวตนผู้ขอตรวจไม่ผ่าน → ปฏิเสธ; ลบไม่เสร็จ → แจ้งสถานะและให้ลองใหม่ ไม่ปล่อยให้เหลือข้อมูลครึ่งๆ โดยไม่แจ้ง
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-20]], [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-11]], [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-10]]

### 4.9 ฟีเจอร์ที่ 11 และ 12 — สำเนาข้อมูล และลบใบเสร็จ

#### OP-16 ขอสำเนาข้อมูลส่วนบุคคลของตนเอง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: Backlog**
- **Input**: ไม่มี (implicit: ผู้เรียก)
- **Output**: ไฟล์สำเนาที่ดาวน์โหลดได้ครอบคลุม ข้อมูลโปรไฟล์ของผู้ขอ (`User`: `fullName`, `email`, `roleType`, `privacyConsentAcceptedAt`, `createdAt`), `Receipt` **ทุกสถานะ (4 ระดับ)** ของทุกโครงการ, ข้อมูลอ้างอิงไฟล์ (`ReceiptFile` พร้อม `fileReference` ลิงก์ — **ตัวไฟล์จริงยังอยู่ในที่เก็บไฟล์ภายนอกของผู้ใช้เอง ไม่รวมในสำเนา**), ผลตรวจ + ข้อค้นพบ, `AgentLog`, ประมาณการ (`EstimateVersion`/`EstimateLine`) ของโครงการที่เป็นเจ้าของ และประวัติยินยอม (รูปแบบไฟล์ยังไม่ระบุ — [[db-spec#5.2 รูปแบบไฟล์รายงาน Export (FR-10) และสำเนาข้อมูลส่วนบุคคล (FR-17)|db-spec 5.2]])
- **กฎทางธุรกิจ**: ครบถ้วนกว่า OP-10 เสมอ ไม่ใช่เฉพาะใบเสร็จผ่าน (FR-17 AC-2)
- **กรณี Error หลัก**: ไม่มี — ไม่มีใบเสร็จก็คืนสำเนาประวัติยินยอมได้
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-17]]

#### OP-17 ลบใบเสร็จของตนเอง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เจ้าของใบเสร็จ) — **สถานะ: สร้างบางส่วน** (ปัจจุบัน: ปุ่มลบทันทีลบใบเสร็จและข้อมูลอ้างอิงไฟล์ ยังไม่ลบไฟล์ในที่เก็บไฟล์ภายนอก ไม่มีเงื่อนไข export-lock ไม่มี Audit Trail ลบเฉพาะระเบียบไฟล์แล้วตัวใบเสร็จ (ผลตรวจอยู่ในตัวใบเสร็จ จึงหายไปด้วย) **แต่ไม่ลบ `AgentLog` — ช่องว่างที่ทราบของ FR-18:** เจตนาคือลบ `AgentLog` ด้วย ปัจจุบันตกค้างอยู่)
- **Input**: `receiptId` (ได้จากรายการของ OP-40)
- **Output**: ลบ `Receipt`, `ReceiptFile`, `VerificationResult`/`VerificationFinding`/`VerificationRuleCitation`, `AgentLog`, `EstimateLineRemap` ที่ผูกอยู่ (ยอดใช้ไป/คงเหลือของประมาณการถูกคำนวณใหม่จากใบเสร็จที่เหลือ) และสร้าง `AuditLogEntry` ("ลบใบเสร็จรายเดียว (FR-18)")
- **กฎทางธุรกิจ/Validation**:
  1. อนุญาตเมื่อ `isExported` = เท็จ เท่านั้น (เมื่อ Export สร้างแล้ว) เหตุผล: Audit Trail/ป้องกันการลบหลักฐานหนีความรับผิดหลังยื่นเบิก ไม่ใช่ข้อกำหนดเก็บหลักฐานทางการเงิน ([[20260816-02-pdpa-compliance#8.2 ทบทวนเหตุผลของ FR-18 หลังคำชี้แจงเรื่องบทบาทระบบ (ประเมินเมื่อ 2026-08-16 รอบ 3)|pdpa spec หัวข้อ 8.2]])
  2. **ปลายทาง FR-37:** ลบไฟล์ในที่เก็บไฟล์ภายนอกให้สำเร็จก่อน (OP-37) ถ้าไม่สำเร็จไม่ลบข้อมูลใดๆ แจ้งผู้ใช้ให้เชื่อมต่อใหม่แล้วลองอีกครั้ง
  3. ทำที่ Client ภายใต้กฎสิทธิ์ของที่เก็บข้อมูลหลัก (ไม่ใช่ Trusted Server Service)
- **กรณี Error หลัก**: `isExported` = จริง → ปฏิเสธและแจ้งให้ยื่นคำร้องผ่านช่องทางภายนอก (FR-18 AC-2); ไม่ใช่ของผู้เรียก → ปฏิเสธ (Admin ลบของผู้อื่นไม่ได้); ลบไฟล์ภายนอกไม่สำเร็จ → ตามข้อ 2
- **FR/NFR**: [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-18]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-37]]

### 4.10 ฟีเจอร์ที่ 21 — ไฟล์แนบในที่เก็บไฟล์ภายนอกของผู้ใช้ (FR-32/FR-37)

#### OP-29 เชื่อมต่อที่เก็บไฟล์ภายนอกของผู้ใช้

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ — **สถานะ: สร้างแล้ว** (ส่วนปรับไฟล์เก่า Backlog)
- **Input**: การอนุญาตของผู้ใช้ต่อที่เก็บไฟล์ของตนเอง ขอบเขตแคบ (เห็น/จัดการเฉพาะไฟล์ที่ระบบสร้างเอง)
- **Output**: สถานะ "เชื่อมต่อแล้ว" ในหน้านั้น (การอนุญาตอยู่ในหน่วยความจำ ไม่บันทึกที่เซิร์ฟเวอร์)
- **กฎทางธุรกิจ**: (1) การอนุญาตหมดอายุภายในไม่นานและไม่มีตัวต่ออายุ — ต้องเชื่อมต่อใหม่ (2) ถ้าแนบไฟล์แต่ยังไม่เชื่อมต่อ ต้องเตือนและบล็อกการส่ง ไม่ล้มเหลวเงียบ (3) เซิร์ฟเวอร์ไม่เก็บข้อมูลรับรองของผู้ใช้
  **[Backlog FR-37 ข้อ 5]:** เมื่อเชื่อมต่อครั้งถัดไป ระบบต้อง**ถอนการแชร์แบบลิงก์สาธารณะของไฟล์ใบเสร็จเดิมโดยอัตโนมัติ** และตั้ง `ReceiptFile.sharingScope` เป็น "เจ้าของและ Admin เท่านั้น" — วิธีให้ Admin ดูไฟล์ ตัดสินแล้ว: แชร์ตรงให้บัญชี Admin (ทบทวนได้ภายหลัง)
- **กรณี Error หลัก**: ผู้ใช้ไม่อนุญาต/การอนุญาตล้มเหลว → แจ้งผล ไม่ส่งไฟล์
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-32]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-37]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#3. Non-Functional Requirements|NFR-15]]

#### OP-38 อัปโหลดไฟล์ใบเสร็จไปยังที่เก็บไฟล์ภายนอกและบันทึกข้อมูลอ้างอิง

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (Client เรียกต่อจาก OP-04) — **สถานะ: สร้างแล้ว**
- **Input**: `receiptId`, ชุดไฟล์ (1–5 ไฟล์: `originalFileName`, `fileType`, `fileSizeBytes`, `sortOrder`) — ต้องเชื่อมต่อแล้ว (OP-29)
- **Output**: `ReceiptFile` 1 record ต่อไฟล์ (`id`, `receiptId`, `fileReference` = ลิงก์ไปไฟล์ในโฟลเดอร์ตามรหัสใบเสร็จ, `sharingScope`, `originalFileName`, `fileType`, `fileSizeBytes`, `sortOrder`, `uploadedAt`; ปลายทางเพิ่ม `externalFileId`)
- **กฎทางธุรกิจ**: **ปัจจุบัน** ตั้ง `sharingScope` = "ผู้ที่มีลิงก์ดูได้" เพื่อให้ลิงก์เปิดได้ในหน้ารายการ/Admin ซึ่งขัดกับเจตนาความเป็นส่วนตัว (ปิดช่องโหว่ด้วย FR-37/NFR-15 — Backlog); **ปลายทาง** ตั้ง "เจ้าของและ Admin เท่านั้น" และบันทึก `externalFileId`
- **กรณี Error หลัก**: ยังไม่เชื่อมต่อ/สิทธิ์หมดอายุ → ปฏิเสธพร้อมคำเตือน (OP-29); อัปโหลดล้มเหลว → ไม่สร้าง `ReceiptFile` และแจ้งผู้ใช้
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-32]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-22]]

#### OP-37 ลบไฟล์แนบในที่เก็บไฟล์ภายนอกของผู้ใช้

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (Client ด้วยสิทธิ์ระยะสั้นของผู้ใช้เอง — ตัดสินแล้ว) — **สถานะ: Backlog** (FR-37)
- **Input**: `receiptId` (ลบรายใบ จาก OP-17/OP-07) หรือ "ทั้งหมดของผู้ใช้" (จาก OP-15)
- **Output**: ผลสำเร็จ/ล้มเหลวต่อไฟล์ และจำนวนไฟล์ที่ลบ (อาศัย `ReceiptFile.externalFileId`/`fileReference`)
- **กฎทางธุรกิจ/Validation**: (1) ต้องสำเร็จครบก่อนผู้เรียกจะลบข้อมูลในระบบ (OP-17/OP-15 → OP-35) (2) ล้มเหลว (เช่น สิทธิ์หมดอายุ) → แจ้งเหตุผลให้เชื่อมต่อใหม่ (OP-29) แล้วลองอีกครั้ง ไม่ลบข้อมูลใดในระบบ ไม่เหลือไฟล์กำพร้า ไม่ล้มเหลวเงียบ (3) เซิร์ฟเวอร์ไม่ทำแทน
- **กรณี Error หลัก**: ไม่ได้เชื่อมต่อ/สิทธิ์หมดอายุ → ขอให้เชื่อมต่อใหม่
- **FR/NFR**: [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#2. Functional Requirements|FR-37]], [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy#3. Non-Functional Requirements|NFR-15]], [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-18]], [[20260816-02-pdpa-compliance#4. Functional Requirements|FR-20]]

### 4.11 Trusted Server Service และตัวกลางถือคีย์ AI

#### OP-34 คำนวณและบันทึกผลตรวจใบเสร็จโดย Trusted Server Service

- **ผู้เรียกได้**: Client ในนามนักวิจัย — **สถานะ: Backlog** (หน้าที่ (ก) ของ [[architecture#5.4 ตำแหน่งฝั่งเซิร์ฟเวอร์ — ตัดสินใจแล้ว 2026-11-17: แบบผสม (ยืนยันโดยผู้ใช้ผ่าน AskUserQuestion)|architecture 5.4]]; ปัจจุบัน Client คำนวณและบันทึกผลเอง)
- **Input**: ข้อมูลที่ผู้ใช้ยืนยันเท่านั้น: `projectId`, `confirmedAmount`, `confirmedDate`, `confirmedCategory`, `confirmedVendorName`, `estimateLineId`, `providedDocumentTypeIds`, `confirmedAttestationKeys`, `summaryAmount` — **ไม่รับกฎหรือผลตัดสินจาก Client**
- **Output**: เหมือน OP-04 (`Receipt` + `VerificationResult` + `VerificationFinding` + `VerificationRuleCitation`)
- **กฎทางธุรกิจ/Validation**:
  1. เซิร์ฟเวอร์ตรวจตัวตนผู้เรียกและความเป็นเจ้าของโครงการเอง แล้ว**โหลดกฎ/ประมาณการ/ยอดสะสมเอง** เรียกโมดูล Rule Engine ตัวเดียวกับ OP-04 (เวอร์ชัน engine เดียวกัน) และบันทึกผลเอง — ทำให้เบราว์เซอร์แก้ผลตัดสินไม่ได้ (NFR-04, NFR-05)
  2. เมื่อ operation นี้สร้างแล้ว กฎสิทธิ์ของที่เก็บข้อมูลหลักต้องห้าม Client เขียน `Receipt.status` และ `VerificationResult` เอง (เหลือเฉพาะบริการเซิร์ฟเวอร์) — ข้อกำหนดนี้ยังไม่สร้าง
  3. ไม่ถือข้อมูลรับรองผู้ใช้ต่อที่เก็บไฟล์ภายนอก; การอัปโหลดไฟล์ (OP-38), การเรียก agent (OP-28) และการตรวจไฟล์ (OP-01) ยังอยู่ที่ Client
  4. ความล้มเหลวของ agent/AI ไม่กระทบการบันทึก
- **กรณี Error หลัก**: ตัวตน/ความเป็นเจ้าของไม่ผ่าน → ปฏิเสธ; ไม่มีเวอร์ชันระเบียบ active → ตาม OP-04; เซิร์ฟเวอร์ใช้งานไม่ได้ → ไม่บันทึก แจ้งผู้ใช้ให้ลองใหม่ (ไม่ถอยกลับไปให้ Client คำนวณเอง เพราะขัดวัตถุประสงค์)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-04]], [[20261117-01-implemented-rule-engine-ai-and-admin#2. Functional Requirements|FR-24]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-04]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-05]]

#### OP-39 ส่งต่อคำขอ AI ผ่านตัวกลางถือคีย์

- **ผู้เรียกได้**: ระบบเรียกเอง (AI Gateway ในเครื่องผู้ใช้ เมื่อเลือกเส้นทางผ่านตัวกลาง) — **สถานะ: สร้างบางส่วน** (เขียนและทดสอบแล้ว ยังไม่ deploy; คีย์ที่ใช้อยู่ปัจจุบันเป็นของคลาสเท่านั้น)
- **Input**: ตั๋วยืนยันตัวตนของผู้ใช้ที่ล็อกอิน (แทนการส่งคีย์), ชื่อโมเดล, ข้อความ/ภาพที่ขอ (รูปแบบถามตอบเดียวกับเส้นทางอื่น)
- **Output**: คำตอบของผู้ให้บริการ LLM ส่งต่อตรง
- **กฎทางธุรกิจ/Validation**: (1) ตรวจลายเซ็น ผู้รับ ผู้ออก และอายุของตั๋ว — รับเฉพาะผู้ล็อกอิน (2) จำกัดต้นทาง (เว็บที่เรียก) และ**รายชื่อโมเดลที่อนุญาต** (3) คีย์ของผู้ให้บริการถือฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ปรากฏฝั่ง Client (NFR-12) (4) ไม่เปลี่ยนผลตัดสิน (เป็นเพียงทางผ่านคำขอ AI)
- **กรณี Error หลัก**: ตั๋วไม่ถูกต้อง/หมดอายุ → ปฏิเสธ; ต้นทางหรือโมเดลไม่อยู่ในรายการอนุญาต → ปฏิเสธ; ผู้ให้บริการล้มเหลว → ส่งความล้มเหลวกลับให้ AI Gateway (ผู้เรียกถอยกลับตาม OP-02/OP-28)
- **FR/NFR**: [[20261117-01-implemented-rule-engine-ai-and-admin#3. Non-Functional Requirements|NFR-12]], [[20260816-02-pdpa-compliance#5. Non-Functional Requirements|NFR-08]]

### 4.12 รายการใบเสร็จของตนเอง (ทางเข้าของ OP-05/06/07/17)

#### OP-40 ดูรายการใบเสร็จของตนเอง (ทั้งหมดหรือกรองตามโครงการ)

- **ผู้เรียกได้**: นักวิจัย/เจ้าของโครงการ (เฉพาะของตนเอง) — **สถานะ: สร้างแล้ว** Admin ดูใบเสร็จของทุกคนผ่าน OP-30 ไม่ใช้ operation นี้
- **Input**: `projectId` (ไม่บังคับ — ระบุเพื่อกรองเฉพาะโครงการนั้น ไม่ระบุ = ทุกโครงการของผู้เรียก)
- **Output**: รายการ `Receipt` ของผู้เรียก เรียงตาม `uploadedAt` ใหม่ไปเก่า แต่ละใบมี `id`, `projectId` (พร้อม `projectName`), ค่าที่ยืนยัน (`confirmedAmount`, `confirmedDate`, `confirmedCategory`, `confirmedVendorName`), `status`, `uploadedAt`, ผลตรวจ/คำอธิบายโดยย่อ และ `ReceiptFile` (`fileReference`) — คืนรายการเปล่าได้ ไม่ใช่ error
- **กฎทางธุรกิจ/Validation**:
  1. ค้นข้ามโครงการโดย**ต้องกรองเงื่อนไขเจ้าของ** (`Receipt.ownerUserId` = ผู้เรียก) เสมอ ไม่ระบุจะถูกปฏิเสธที่ชั้นกฎสิทธิ์ (กฎ cross-cutting ข้อ 3)
  2. การกรองตาม `projectId` ทำที่ฝั่ง Client จากรายการที่ค้นมาแล้ว (ไม่ใช่เงื่อนไขค้นเพิ่ม)
  3. ใบเสร็จที่หาโครงการเจ้าของไม่พบ (ข้อมูลเก่าที่ไม่อยู่ใต้โครงการ) ต้องแสดงได้โดยไม่ล้ม
  4. เป็นทางเข้าสู่ OP-05 (ดูผลตรวจ), OP-06/OP-07 (แก้/ส่งซ้ำ — Backlog) และ OP-17 (ลบ) โดย `receiptId` ของ operation เหล่านั้นมาจากรายการนี้
- **กรณี Error หลัก**: ไม่ได้ล็อกอิน → ปฏิเสธ; `projectId` ไม่ใช่ของผู้เรียก → ผลว่าง (ไม่เปิดเผยว่ามีอยู่จริง)
- **FR/NFR**: [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-06]], [[20260816-01-grant-receipt-verification#4. Functional Requirements|FR-23]], [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-05]]

## 5. ประเด็นรอตัดสินใจ

เอกสารนี้ไม่มีประเด็น tech stack ที่ต้องตัดสินเพิ่ม (รอ [[technology-stack]] เหมือนเดิม) ประเด็นที่ค้างจากรอบแรกได้รับคำตอบแล้ว (รายละเอียดที่ [[db-spec#5.6 ประเด็นที่ตัดสินแล้วและช่องว่างที่ทราบ (อัปเดต 2026-11-17 ตามคำตอบผู้ประสานงาน)|db-spec 5.6]]):

- **ตัดสินแล้ว:** ไม่เก็บค่าดิบ AI/OCR (OP-02); AgentLog ตามฟิลด์จริง (OP-28); ไม่มีแหล่งทุน/ระเบียบ active ไม่บล็อก บันทึกเป็น "ไม่เข้าเงื่อนไข" (OP-04); OP-20 เป็น Backlog; Admin ดูไฟล์หลัง FR-37 ด้วยการแชร์ตรงให้บัญชี Admin (OP-29/OP-30); คง `EstimateLineRemap` เป็น entity แยก (OP-23–OP-25); ประมาณการไม่ถูกลบตอนถอนความยินยอม (OP-35) — ทบทวนได้ภายหลัง
- **ช่องว่างที่ทราบ (FR-18, OP-17):** เจตนาคือลบ `AgentLog` พร้อมใบเสร็จ แต่ปุ่มลบปัจจุบันลบเฉพาะระเบียบไฟล์และตัวใบเสร็จ ทิ้ง `AgentLog` ไว้
- **ยังเปิด:** อีเมลแจ้งเตือน (OP-36) ความถี่ การไม่ส่งซ้ำต่อใบเสร็จ และเนื้อหา รอออกแบบ FR-09

ขนาดไฟล์ 5 MB/ไฟล์และ 5 ไฟล์/รายการ finalize แล้ว และโมเดล FundSource/Project/Researcher finalize แล้ว ไม่ใช่ประเด็นเปิด; รูปแบบไฟล์ export/สำเนาข้อมูล (FR-10/FR-17) ยังเป็น open point ([[db-spec#5.2 รูปแบบไฟล์รายงาน Export (FR-10) และสำเนาข้อมูลส่วนบุคคล (FR-17)|db-spec 5.2]])

## เอกสารที่เกี่ยวข้อง

- [[db-spec]] — โมเดลข้อมูลเชิง logical ที่ operation ในเอกสารนี้ใช้ field ตรงกันทุกจุด
- [[architecture]] — component/data flow ต้นทาง (อัปเดต 2026-11-17: Admin อ่านอย่างเดียว, ผลตรวจ 4 ระดับ, มติสถาปัตยกรรมผสม)
- [[backlog]] — FR/NFR ทั้งหมด (FR-01–FR-37, NFR-01–NFR-15)
- [[feature-list]] — 23 ฟีเจอร์ที่ operation ในเอกสารนี้ map เข้าด้วย
- [[user-journey]] — 10 journey
- [[20260816-01-grant-receipt-verification]] — spec ต้นทาง FR-01–FR-12/FR-19/FR-21/FR-22/FR-23/NFR-01–NFR-07
- [[20260816-02-pdpa-compliance]] — spec ต้นทาง FR-13–FR-18/FR-20/NFR-08–NFR-11 (PDPA)
- [[20261117-01-implemented-rule-engine-ai-and-admin]] — spec ต้นทาง FR-24–FR-34/NFR-12–NFR-14 (สร้างแล้ว)
- [[20261117-02-fund-source-deactivation-estimate-versioning-drive-privacy]] — spec ต้นทาง FR-35–FR-37/NFR-15 (Backlog)
- [[technology-stack]] — ยังไม่มีเนื้อหา — จุดที่จะกำหนด protocol/format จริงในอนาคต
