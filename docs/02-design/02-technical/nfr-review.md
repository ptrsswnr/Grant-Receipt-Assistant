# NFR Review — Grant Receipt Assistant

> ตรวจสอบว่าเอกสารเชิงเทคนิคทั้งหมด ([[architecture]], [[api-spec]], [[db-spec]], และไฟล์ใน
> `detailed-design/` ทั้ง 12 ฟีเจอร์) มีการออกแบบมารองรับทุก NFR ใน [[backlog]] จริงหรือไม่ —
> เอกสารนี้เป็นผลของการ**ตรวจสอบและรายงานเท่านั้น** ไม่ใช่การออกแบบเพิ่มเติม (งานออกแบบจริงเป็นของ
> `sync-architecture`/`sync-api-db`/`sync-detailed-design` เท่านั้น)

## 0. สถานะเอกสารนี้

- สร้างครั้งแรกเมื่อ 2026-08-23 หลัง [[architecture]], [[api-spec]], [[db-spec]] และ
  `detailed-design/` ครบ 12 ฟีเจอร์ ถูกเขียนเสร็จสมบูรณ์ในวันเดียวกัน ครอบคลุม [[backlog]] ล่าสุด
  (FR-01–FR-22, NFR-01–NFR-11)
- **อัปเดต 2026-09-03 (รอบตรวจซ้ำหลังแก้ไขโมเดลข้อมูล FundSource/Project/Researcher + เพิ่ม
  FR-23):** เอกสารเชิงเทคนิคทั้งสาย ([[architecture]] → [[api-spec]]/[[db-spec]] →
  `detailed-design/` ครบ 13 ฟีเจอร์ รวมไฟล์ใหม่ [[project-setup]]) ถูกแก้ไขทั้งหมดในวันเดียวกันเพื่อ
  แยก entity เดิม "Fund" (ปนแนวคิดแหล่งทุน+โครงการ) ออกเป็น **FundSource** (แหล่งทุน — Admin ดูแล,
  1:N Project), **Project** (โครงการวิจัย — เจ้าของ 1 คน, ใบเสร็จผูกกับ Project โดยตรง), **Researcher**
  (= User ที่ roleType = นักวิจัย) ตรวจสอบซ้ำทั้ง **11 รายการ NFR เดิม** (ไม่มี NFR ใหม่จากรอบนี้
  เพราะ backlog ไม่ได้เพิ่ม NFR ใหม่ มีแต่ FR-23) โดยเน้นตรวจ **NFR-03 (Explainability)**,
  **NFR-04 (Audit Trail)**, **NFR-05 (Access Control)** เป็นพิเศษตามที่ผู้ขอให้ตรวจระบุไว้ — พบว่า
  ทั้ง 3 รายการนี้ถูก sync ครบถ้วนสอดคล้องกันทั้ง 4 ชั้นเอกสาร ไม่มีจุดที่ตกหล่น (รายละเอียดดูตาราง
  ด้านล่าง คอลัมน์ "เอกสาร/ส่วนที่พบ" อัปเดตให้ชี้ไปยัง entity/operation ชื่อใหม่ทั้งหมดแล้ว) — grep
  ยืนยันแล้วว่าไม่มีการอ้างอิง `fundId`/`Fund.ownerUserId` ที่เป็นโค้ด/field จริงหลงเหลืออยู่ในเอกสารใด
  เลย (มีเพียงข้อความอธิบายประวัติการแก้ไขที่จงใจอ้างชื่อเดิมไว้เพื่อบันทึกเหตุผล)
- ตรวจสอบ NFR ทั้งหมด **11 รายการ** (NFR-01–NFR-11) จาก [[backlog#Non-Functional Requirements|backlog หัวข้อ Non-Functional Requirements]) เทียบกับเอกสารเชิงเทคนิคทั้ง 4 ชั้น
- ผลสรุป (ไม่เปลี่ยนจากรอบก่อนหน้า แม้ผ่านการแก้ไขโมเดลข้อมูลครั้งใหญ่): **6 รายการรองรับแล้ว
  (Addressed)**, **2 รายการรองรับบางส่วน (Partial)** (NFR-06, NFR-07), **0 รายการยังไม่รองรับเลย
  (Missing)** — อีก 3 รายการ (NFR-08, NFR-09, NFR-10) เป็น NFR เชิงองค์กร/กระบวนการ
  (organizational/process) ที่เอกสารเชิงเทคนิคทำได้เพียงระบุขอบเขตจุดเชื่อมต่อที่ต้องมีมาตรการ ซึ่งถือว่า
  "รองรับแล้ว" ในระดับที่การออกแบบซอฟต์แวร์ทำได้จริง (ดูรายละเอียดต่อรายการด้านล่าง)

## 1. ตารางสรุปผลการตรวจสอบ

| รหัส | คำอธิบายสั้น | สถานะ | เอกสาร/ส่วนที่พบ | สิ่งที่ยังขาด | แนะนำให้รันอะไรต่อ |
|---|---|---|---|---|---|
| NFR-01 | ภาษา (Localization) — OCR/LLM ต้องรองรับภาษาไทยเต็มรูปแบบ | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]] (mapping ไปยัง External OCR/LLM Service), [[api-spec#OP-02 อ่านข้อมูลใบเสร็จด้วย OCR (internal)\|api-spec OP-02]]/[[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|OP-04]] ("ต้องอ่านเป็นภาษาไทยได้เต็มรูปแบบ"/"explanationText ต้องเป็นภาษาไทยทั้งหมด"), [[receipt-upload-ocr]] edge case #8, [[rule-engine-verification]] edge case #8 | ไม่มี — ครอบคลุมทั้ง 3 ชั้น (component/operation/edge case) | ไม่มี |
| NFR-02 | Usability/การสื่อสาร — ภาษาที่เข้าใจง่ายสำหรับคนไม่มีพื้นฐานการเงิน | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]], [[api-spec#OP-01 อัปโหลดใบเสร็จ\|api-spec OP-01]] (error message ภาษาไทยชัดเจน), [[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|OP-04]] (explanationText ต้องแปลงศัพท์การเงิน), [[receipt-upload-ocr]] หัวข้อ 5 (error ภาษาไทยทุก edge case) | ไม่มี | ไม่มี |
| NFR-03 | Explainability — ผลตรวจต้องอ้างอิงข้อระเบียบของ FundSource ที่ถูกต้องได้เสมอ | **รองรับแล้ว** (ตรวจซ้ำ 2026-09-03 หลังแยกโมเดล FundSource/Project — ยังครบถ้วน) | [[architecture#4. NFR Mapping\|architecture 4]], [[db-spec#E-09 ข้อระเบียบที่อ้างอิงในผลตรวจ (VerificationRuleCitation)\|db-spec E-09]] (entity เฉพาะทางรองรับที่ระดับโครงสร้างข้อมูล ไม่ใช่แค่ข้อความลอยๆ — รหัส entity เปลี่ยนจาก E-07 เป็น E-09 ตามการจัดเรียงใหม่ แต่เนื้อหาเดิมไม่เปลี่ยน), [[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|api-spec OP-04]] (บังคับ ≥1 citation เสมอ + ลำดับใหม่: หา `Project.fundSourceId` ก่อนเลือก `RuleVersion` ที่ตรงกับ FundSource นั้น เพื่อให้อ้างอิงระเบียบของ FundSource ที่ถูกต้องจริง ไม่ใช่ระเบียบเดียวรวมทั้งระบบเหมือนเดิม), [[rule-engine-verification]] edge case #6 (และ edge case #3/#10 ใหม่ที่ครอบคลุมกรณี FundSource ไม่มีระเบียบ/Project เปลี่ยน FundSource ภายหลัง) | ไม่มี — รองรับตั้งแต่ระดับ entity ถึงระดับ edge case ครบถ้วนหลังการแยกโมเดล | ไม่มี |
| NFR-04 | Audit Trail — บันทึกกฎ/เวอร์ชันระเบียบของ FundSource/ผลลัพธ์ต่อใบเสร็จ | **รองรับแล้ว** (ตรวจซ้ำ 2026-09-03 — ยังครบถ้วน) | [[architecture#4. NFR Mapping\|architecture 4]] (Audit Trail Store — ระบุชัดว่าเวอร์ชันระเบียบที่บันทึกเป็นของ **FundSource** ที่ **Project** สังกัดอยู่ ณ ขณะตรวจ), [[db-spec#E-08 ผลตรวจใบเสร็จ (VerificationResult)\|db-spec E-08]]/[[db-spec#E-14 บันทึกเหตุการณ์ตรวจสอบย้อนหลัง (AuditLogEntry)\|E-14]] (append-only, `ruleVersionId` เป็น snapshot ของ FundSource ที่ Project สังกัด ณ ขณะตรวจ — ระบุตรงๆ ว่าแม้ Project จะเปลี่ยน FundSource ที่ผูกภายหลัง ผลตรวจเก่าต้องไม่เปลี่ยนตาม, `AuditLogEntry.affectedProjectId` แทน `affectedFundId` เดิม), [[rule-engine-verification]], [[admin-rule-management]], [[right-to-erasure]], [[consent-management]], [[project-setup]] (ทุกไฟล์เขียน AuditLogEntry ในจุดที่เกี่ยวข้อง — รวมถึง OP-20 แก้ไข Project ที่ยืนยันชัดว่าไม่กระทบ `ruleVersionId` เดิมที่ snapshot ไว้) | ไม่มี | ไม่มี |
| NFR-05 | Security/Access Control — ownership check ต้องอยู่ที่ระดับ Project | **รองรับแล้ว** (ตรวจซ้ำ 2026-09-03 — ยืนยันว่า ownership check ย้ายจาก `Fund.ownerUserId` เดิมไป `Project.ownerUserId` ครบทุกจุดแล้ว) | [[architecture#4. NFR Mapping\|architecture 4]] (ระบุตรงๆ ว่าต้องตรวจสอบสิทธิ์ตามเจ้าของ **Project** ทุก request), [[api-spec#2. กฎการเข้าถึงข้อมูลแบบ Cross-Cutting (Access Control)\|api-spec หัวข้อ 2]] (กฎข้อ 1 ระบุตรงๆ ว่า "แก้ไข 2026-09-03: เดิมกฎนี้ตรวจสอบผ่าน `Fund.ownerUserId` ซึ่งผิด" พร้อมเพิ่มกฎข้อ 3 เรื่อง `fundSourceId` ไม่มีเจ้าของเป็นนักวิจัย), [[access-control]] (ตารางบังคับใช้กฎ cross-cutting ครบทั้ง 21 operation รวม OP-18–OP-21 ใหม่ของ Project Setup, edge case #5 ครอบคลุมกรณีอ่าน FundSource ไม่ต้องตรวจ ownership) | ไม่มี | ไม่มี |
| NFR-06 | Performance ของ OCR/Rule Engine (เป้าหมายเวลาตอบสนองโดยรวมยังไม่กำหนด) | **รองรับบางส่วน** | [[architecture#4. NFR Mapping\|architecture 4]] (ระบุตรงๆว่า "ยังไม่มีตัวเลขเป้าหมายด้านเวลาตอบสนองโดยรวม"), [[architecture#5.1 ตำแหน่งของการตรวจสอบไฟล์อัปโหลด (FR-19) — Client หรือ Backend Service\|architecture 5.1]] (มาตรการเดียวที่มี: จำกัดขนาดไฟล์ ≤5MB/ไฟล์ ≤5 ไฟล์/รายการ), [[receipt-upload-ocr]] edge case #3/#7 | ไม่มีเป้าหมายเวลาตอบสนอง (SLA) ที่เป็นรูปธรรมของ pipeline OCR→Rule Engine→LLM; ไม่มีการออกแบบ timeout/retry policy เมื่อ External OCR/LLM ตอบช้า (มีแค่กรณี "ล้มเหลวทางเทคนิคสมบูรณ์" ใน [[rule-engine-verification]] edge case #9 ไม่ใช่กรณี "ช้าแต่ไม่ล้มเหลว") | `sync-architecture` (เพื่อกำหนดเป้าหมายเวลาตอบสนอง/timeout policy ในหัวข้อ 5.2 เมื่อมีตัวเลขจริง) ต่อด้วย `sync-detailed-design` (เพิ่ม edge case กรณี OCR/LLM ตอบช้าแยกจากกรณีล้มเหลวสมบูรณ์) |
| NFR-07 | Scalability ปริมาณใบเสร็จ (เป้าหมายตัวเลขยังไม่กำหนด) | **รองรับบางส่วน** (ตรวจซ้ำ 2026-09-03 — ยังเป็นช่องว่างเดิม โมเดล FundSource/Project เพิ่ม entity ใหม่ 2 ตัวแต่ไม่ได้เพิ่มมาตรการ scale ใดๆ) | [[architecture#4. NFR Mapping\|architecture 4]] (ระบุ component รับผิดชอบ — Backend Service, Primary Data Store — แต่ระบุตรงๆว่า "ยังไม่มีตัวเลขเป้าหมาย" พร้อมเพิ่มข้อความว่าต้องรองรับปริมาณ Researcher/Project/FundSource/ใบเสร็จที่เพิ่มขึ้นตามจำนวนโครงการ), [[architecture#5.2 รูปแบบการสื่อสารระหว่าง Backend Service ↔ OCR/Rule Engine/LLM — Synchronous หรือ Asynchronous\|architecture 5.2]] (ยอมรับความเสี่ยงของ synchronous pipeline ต่อการ scale ไว้ตรงๆ) | ไม่มี detailed-design ไฟล์ใดใน 13 ฟีเจอร์ (รวม [[project-setup]] ใหม่) กล่าวถึงมาตรการรองรับปริมาณผู้ใช้/ใบเสร็จ/โครงการพร้อมกัน (เช่น indexing strategy สำหรับ query `Project` ตาม `ownerUserId`, connection pooling, stateless design) เลยแม้แต่ไฟล์เดียว — เป็น NFR ที่มีการกล่าวถึงเฉพาะระดับ architecture เท่านั้น ไม่เปลี่ยนแปลงจากรอบตรวจก่อนหน้า | `sync-architecture` (กำหนดตัวเลขเป้าหมาย/แนวทาง scale เมื่อมีข้อมูลปริมาณผู้ใช้จริง) ต่อด้วย `sync-api-db`/`sync-detailed-design` เพื่อสะท้อนมาตรการลงในระดับปฏิบัติ |
| NFR-08 | Cross-border Data Transfer (Conditional — รอการตัดสินใจ vendor) | **รองรับแล้ว** (ในระดับที่ NFR เชิงองค์กร/มีเงื่อนไขนี้ทำได้จากการออกแบบซอฟต์แวร์) | [[architecture#1. ภาพรวมสถาปัตยกรรม\|architecture 1]]/[[architecture#4. NFR Mapping\|architecture 4]] (วาด External OCR/LLM Service เป็น "บริการภายนอก" โดยตั้งใจเพื่อชี้จุดเชื่อมต่อที่ต้องพิจารณามาตรการ), [[api-spec#OP-02 อ่านข้อมูลใบเสร็จด้วย OCR (internal)\|api-spec OP-02]]/[[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|OP-04]], [[rule-engine-verification]] edge case #8 | ที่ตั้งจริงของผู้ให้บริการ OCR/LLM (เงื่อนไข vendor) ยังเป็น open point ที่ยังไม่ปิดตาม [[backlog#Open Point ที่ยังไม่ปิดจากเอกสาร PDPA (เพื่ออ้างอิง — ไม่บล็อกการพัฒนา)\|backlog]] — ไม่ใช่ช่องว่างของการออกแบบ แต่เป็นการตัดสินใจ vendor ที่ยังไม่เกิดขึ้น | ไม่ต้องรัน sync agent ใดตอนนี้ — รอผลตัดสินใจ vendor ก่อน แล้วกลับมา `sync-architecture` เพื่อปิด open point นี้ให้ชัดเจนขึ้น |
| NFR-09 | Data Processing Agreement กับผู้ให้บริการภายนอก (Organizational) | **รองรับแล้ว** (ระดับที่ซอฟต์แวร์ทำได้ — ระบุจุดเชื่อมต่อที่ DPA ต้องครอบคลุม) | [[architecture#4. NFR Mapping\|architecture 4]] (ระบุตรงๆว่าเป็น "ข้อตกลงระดับองค์กร ไม่ใช่ฟังก์ชันของ component" แต่ชี้จุดเชื่อมต่อ Backend↔OCR/LLM ชัดเจน), [[rule-engine-verification]] edge case #8 | ไม่มีช่องว่างเชิงออกแบบซอฟต์แวร์ — เป็น process ระดับองค์กร (การเซ็น DPA จริง) ซึ่งอยู่นอกขอบเขตของ architecture/api-spec/db-spec/detailed-design โดยธรรมชาติของ NFR นี้ | ไม่ต้องรัน sync agent ใด — เป็นกระบวนการจัดซื้อ/สัญญาระดับองค์กร ไม่ใช่งานออกแบบเอกสารเชิงเทคนิค |
| NFR-10 | Data Breach Notification (Organizational/Process) | **รองรับแล้ว** (ระดับที่ซอฟต์แวร์ทำได้ — ให้ log สนับสนุนกระบวนการ) | [[architecture#4. NFR Mapping\|architecture 4]] (Audit Trail Store ต้องมี log เพียงพอสนับสนุนกระบวนการแจ้งเหตุละเมิดข้อมูลที่เป็น process ภายนอกซอฟต์แวร์), [[access-control]] edge case #4 (ระบุตรงๆว่าต้องมีกลไก/กระบวนการแจ้งเตือน สคส. ภายใน 72 ชั่วโมง — organizational/process) | ไม่มีช่องว่างเชิงออกแบบซอฟต์แวร์ — กระบวนการแจ้งเหตุละเมิดจริงเป็นหน้าที่ของ DPO/องค์กร ไม่ใช่ฟังก์ชันของระบบ | ไม่ต้องรัน sync agent ใด — เป็นกระบวนการองค์กร (แต่ควรตรวจสอบว่า Audit Trail Store เก็บ log สิทธิ์การเข้าถึงระดับที่เพียงพอเมื่อเข้าสู่ช่วง `technology-stack`/implementation จริง) |
| NFR-11 | Data Retention & Deletion Policy (ตัวเลข TBD) | **รองรับแล้ว** (กลไกพร้อมใช้งาน ตัวเลขจริงยังเป็น TBD จากระดับ requirements ไม่ใช่ช่องว่างของการออกแบบ) | [[architecture#4. NFR Mapping\|architecture 4]] (Backend Service เป็นจุดเดียว trigger การลบ), [[db-spec#E-08 เวอร์ชันประกาศความเป็นส่วนตัว (PrivacyNoticeVersion)\|db-spec E-08]] (`content` ต้องระบุนโยบาย retention), [[consent-management]] edge case #8 (NFR-11 AC-1 — ต้องระบุว่ามีนโยบายอยู่แม้ตัวเลขยังเป็น TBD), กลไกลบจริงผ่าน FR-18/FR-20 ([[right-to-erasure]], [[consent-management]]) | ตัวเลขระยะเวลาเก็บข้อมูลที่แน่นอนยังเป็น TBD ตาม [[backlog#Open Point ที่ยังไม่ปิดจากเอกสาร PDPA (เพื่ออ้างอิง — ไม่บล็อกการพัฒนา)\|backlog]] (รอระเบียบมหาวิทยาลัย/กรมบัญชีกลาง) — ไม่ใช่ช่องว่างของเอกสารเชิงเทคนิค เพราะกลไกลบพร้อมใส่ตัวเลขจริงได้ทันทีที่ทราบ | ไม่ต้องรันตอนนี้ — เมื่อทราบตัวเลข retention จริงแล้ว ให้รัน `sync-api-db` เพื่อเติมตัวเลขลงใน `PrivacyNoticeVersion.content`/นโยบายลบอัตโนมัติ |

## 2. รายละเอียดช่องว่างที่พบ (Partial)

### 2.1 NFR-06 — Performance ของ OCR/Rule Engine

มาตรการที่มีอยู่แล้ว (จำกัดขนาดไฟล์ ≤5MB/ไฟล์, ≤5 ไฟล์/รายการ) เป็นมาตรการป้องกันเชิง input เท่านั้น
ไม่ใช่การกำหนดเป้าหมายเวลาตอบสนอง (response time SLA) ของ pipeline OCR → Rule Engine → LLM
โดยตรง — [[architecture#4. NFR Mapping|architecture หัวข้อ 4]] ยอมรับตรงๆว่า "ยังไม่มีตัวเลขเป้าหมาย"
และ [[architecture#5.2 รูปแบบการสื่อสารระหว่าง Backend Service ↔ OCR/Rule Engine/LLM — Synchronous หรือ Asynchronous|architecture หัวข้อ 5.2]]
เลือก synchronous pipeline โดยรับทราบความเสี่ยงเรื่องนี้ไว้แล้ว แต่ไม่ได้ตามด้วยการออกแบบ
timeout/retry policy ที่ชัดเจนใน `detailed-design/` — [[rule-engine-verification]] edge case #9
กล่าวถึงเฉพาะกรณี "ล้มเหลวทางเทคนิคสมบูรณ์" (เรียกไม่ติด/error) แต่ไม่ได้กล่าวถึงกรณี "ตอบช้าแต่ยังไม่
ล้มเหลว" (เช่น ควร timeout ที่กี่วินาที ควร retry กี่ครั้งก่อนถือว่าล้มเหลว)

### 2.2 NFR-07 — Scalability ปริมาณใบเสร็จ

พบเฉพาะการระบุ component รับผิดชอบ (Backend Service, Primary Data Store) ใน
[[architecture#4. NFR Mapping|architecture หัวข้อ 4]] แต่ไม่มี detailed-design ไฟล์ใดในทั้ง 12
ฟีเจอร์กล่าวถึงมาตรการรองรับปริมาณผู้ใช้/ใบเสร็จพร้อมกันเลย (เช่น indexing strategy สำหรับการนับ
`Receipt` แยกตามสถานะที่ [[fund-dashboard]]/[[pending-issue-notification]] ต้อง query บ่อย,
stateless service design เพื่อรองรับ horizontal scaling) — เป็น NFR ที่มีเพียงการกล่าวถึงระดับ
architecture เท่านั้น ยังไม่ถูกแปลงเป็นแนวทางระดับ detailed-design แม้แต่ฟีเจอร์เดียว

## 3. สรุปคำแนะนำ

- **ผลตรวจซ้ำ 2026-09-03 หลังแก้ไขโมเดลข้อมูล FundSource/Project/Researcher + เพิ่ม FR-23**: ตรวจสอบ
  เจาะจง **NFR-03/NFR-04/NFR-05** ครบทั้ง 4 ชั้นเอกสารแล้ว — ทั้ง 3 รายการยังคง **"รองรับแล้ว"** ไม่มี
  ช่องว่างใหม่เกิดขึ้นจากการแยกโมเดลนี้ (ดูรายละเอียดในตารางหัวข้อ 1) การแก้ไขครั้งใหญ่นี้ถูก sync
  สอดคล้องกันครบทั้ง [[architecture]] → [[api-spec]]/[[db-spec]] → `detailed-design/` รวมไฟล์ใหม่
  [[project-setup]] — grep ยืนยันแล้วว่าไม่มีการอ้างอิง `fundId`/`Fund.ownerUserId` แบบ field/code จริง
  หลงเหลืออยู่ในเอกสารเชิงเทคนิคใดเลย (เจอเฉพาะข้อความอธิบายประวัติการแก้ไขที่จงใจอ้างชื่อเดิม)
- **ไม่มี NFR ใดที่ "ยังไม่รองรับเลย" (Missing)** — ทุก NFR อย่างน้อยถูกระบุ component/entity/
  operation รับผิดชอบไว้แล้วใน [[architecture]] เป็นอย่างต่ำ
- **NFR-06** และ **NFR-07** เป็น "รองรับบางส่วน" — ทั้งคู่มีสาเหตุร่วมกันคือ **ยังไม่มีตัวเลขเป้าหมาย
  เชิงปริมาณ** (response time / concurrent user count) ตามที่ [[backlog]] ระบุไว้แล้วว่า "รอกำหนด
  เป้าหมาย" ดังนั้นช่องว่างนี้ส่วนหนึ่งมาจากระดับ requirements ที่ยังไม่ finalize ตัวเลข ไม่ใช่ความ
  บกพร่องของ `sync-technical-spec` ทั้งหมด — แต่ถึงกระนั้น **detailed-design ควรมีมาตรการเชิงคุณภาพ**
  (เช่น timeout/retry policy, indexing strategy) แม้ไม่มีตัวเลขที่แน่นอน ซึ่งยังขาดอยู่จริงในปัจจุบัน
- **NFR-08, NFR-09, NFR-10** เป็น NFR เชิงองค์กร/กระบวนการที่ขอบเขตซอฟต์แวร์ทำได้เพียงระบุจุด
  เชื่อมต่อ/จุดที่ต้องมีมาตรการเท่านั้น — เอกสารเชิงเทคนิคทำหน้าที่นี้ครบถ้วนแล้ว ไม่ต้องรัน sync
  agent ใดเพิ่มในตอนนี้
- **NFR-11** พร้อมกลไกลบข้อมูลจริงแล้ว (ผ่าน FR-18/FR-20) รอเพียงตัวเลข retention ที่แน่นอนจาก
  ระเบียบมหาวิทยาลัย/กรมบัญชีกลาง (open point เดิมจาก [[backlog]] ไม่ใช่ช่องว่างใหม่)

## เอกสารที่เกี่ยวข้อง

- [[backlog]] — แหล่งความจริงของ NFR ทั้งหมดที่ตรวจสอบในเอกสารนี้ (NFR-01–NFR-11 — ไม่เพิ่ม NFR ใหม่
  ในรอบแก้ไขโมเดลข้อมูล 2026-09-03 มีแต่ FR-23 เพิ่มเข้ามา)
- [[architecture]] — หัวข้อ 4 (NFR Mapping) และหัวข้อ 5 (ประเด็นรอตัดสินใจ) เป็นจุดอ้างอิงหลักของการ
  ตรวจสอบนี้ (รวมโมเดล FundSource/Project/Researcher ที่ finalize เมื่อ 2026-09-03)
- [[api-spec]], [[db-spec]] — ตรวจสอบกฎ/ข้อจำกัดที่ผูกกับ NFR แต่ละตัวในระดับ operation/entity
  (รหัส entity E- ถูกจัดเรียงใหม่ทั้งหมดในรอบ 2026-09-03 — ดู [[db-spec#0. สถานะเอกสารนี้|db-spec หัวข้อ 0]])
- ไฟล์ทั้ง 13 ใน `detailed-design/`: [[receipt-upload-ocr]], [[review-edit-ocr-data]],
  [[rule-engine-verification]], [[resubmit-failed-receipt]], [[fund-dashboard]],
  [[pending-issue-notification]], [[export-verified-report]], [[admin-rule-management]],
  [[access-control]], [[consent-management]], [[data-access-portability]], [[right-to-erasure]],
  [[project-setup]] (ไฟล์ใหม่รองรับ FR-23 — เพิ่มเข้ามาในรอบ 2026-09-03)
- [[20260816-01-grant-receipt-verification]] — spec ต้นทางของ NFR-01–NFR-07 (หัวข้อ 11 คือแหล่งที่มา
  ของการแก้ไขโมเดล FundSource/Project/Researcher)
- [[20260816-02-pdpa-compliance]] — spec ต้นทางของ NFR-08–NFR-11 (PDPA)
