# NFR Review — Grant Receipt Assistant

> ตรวจสอบว่าเอกสารเชิงเทคนิคทั้งหมด ([[architecture]], [[api-spec]], [[db-spec]], และไฟล์ใน
> `detailed-design/` ทั้ง 12 ฟีเจอร์) มีการออกแบบมารองรับทุก NFR ใน [[backlog]] จริงหรือไม่ —
> เอกสารนี้เป็นผลของการ**ตรวจสอบและรายงานเท่านั้น** ไม่ใช่การออกแบบเพิ่มเติม (งานออกแบบจริงเป็นของ
> `sync-architecture`/`sync-api-db`/`sync-detailed-design` เท่านั้น)

## 0. สถานะเอกสารนี้

- สร้างครั้งแรกเมื่อ 2026-08-23 หลัง [[architecture]], [[api-spec]], [[db-spec]] และ
  `detailed-design/` ครบ 12 ฟีเจอร์ ถูกเขียนเสร็จสมบูรณ์ในวันเดียวกัน ครอบคลุม [[backlog]] ล่าสุด
  (FR-01–FR-22, NFR-01–NFR-11)
- ตรวจสอบ NFR ทั้งหมด **11 รายการ** (NFR-01–NFR-11) จาก [[backlog#Non-Functional Requirements|backlog หัวข้อ Non-Functional Requirements]) เทียบกับเอกสารเชิงเทคนิคทั้ง 4 ชั้น
- ผลสรุป: **6 รายการรองรับแล้ว (Addressed)**, **2 รายการรองรับบางส่วน (Partial)**
  (NFR-06, NFR-07), **0 รายการยังไม่รองรับเลย (Missing)** — อีก 3 รายการ (NFR-08, NFR-09, NFR-10)
  เป็น NFR เชิงองค์กร/กระบวนการ (organizational/process) ที่เอกสารเชิงเทคนิคทำได้เพียงระบุขอบเขต
  จุดเชื่อมต่อที่ต้องมีมาตรการ ซึ่งถือว่า "รองรับแล้ว" ในระดับที่การออกแบบซอฟต์แวร์ทำได้จริง (ดูรายละเอียด
  ต่อรายการด้านล่าง)

## 1. ตารางสรุปผลการตรวจสอบ

| รหัส | คำอธิบายสั้น | สถานะ | เอกสาร/ส่วนที่พบ | สิ่งที่ยังขาด | แนะนำให้รันอะไรต่อ |
|---|---|---|---|---|---|
| NFR-01 | ภาษา (Localization) — OCR/LLM ต้องรองรับภาษาไทยเต็มรูปแบบ | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]] (mapping ไปยัง External OCR/LLM Service), [[api-spec#OP-02 อ่านข้อมูลใบเสร็จด้วย OCR (internal)\|api-spec OP-02]]/[[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|OP-04]] ("ต้องอ่านเป็นภาษาไทยได้เต็มรูปแบบ"/"explanationText ต้องเป็นภาษาไทยทั้งหมด"), [[receipt-upload-ocr]] edge case #8, [[rule-engine-verification]] edge case #8 | ไม่มี — ครอบคลุมทั้ง 3 ชั้น (component/operation/edge case) | ไม่มี |
| NFR-02 | Usability/การสื่อสาร — ภาษาที่เข้าใจง่ายสำหรับคนไม่มีพื้นฐานการเงิน | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]], [[api-spec#OP-01 อัปโหลดใบเสร็จ\|api-spec OP-01]] (error message ภาษาไทยชัดเจน), [[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|OP-04]] (explanationText ต้องแปลงศัพท์การเงิน), [[receipt-upload-ocr]] หัวข้อ 5 (error ภาษาไทยทุก edge case) | ไม่มี | ไม่มี |
| NFR-03 | Explainability — ผลตรวจต้องอ้างอิงข้อระเบียบได้เสมอ | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]], [[db-spec#E-07 ข้อระเบียบที่อ้างอิงในผลตรวจ (VerificationRuleCitation)\|db-spec E-07]] (entity เฉพาะทางรองรับที่ระดับโครงสร้างข้อมูล ไม่ใช่แค่ข้อความลอยๆ), [[api-spec#OP-04 ยืนยันข้อมูลใบเสร็จและส่งเข้าตรวจ\|api-spec OP-04]] (บังคับ ≥1 citation เสมอ), [[rule-engine-verification]] edge case #6 | ไม่มี — รองรับตั้งแต่ระดับ entity ถึงระดับ edge case | ไม่มี |
| NFR-04 | Audit Trail — บันทึกกฎ/เวอร์ชันระเบียบ/ผลลัพธ์ต่อใบเสร็จ | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]] (Audit Trail Store), [[db-spec#E-06 ผลตรวจใบเสร็จ (VerificationResult)\|db-spec E-06]]/[[db-spec#E-12 บันทึกเหตุการณ์ตรวจสอบย้อนหลัง (AuditLogEntry)\|E-12]] (append-only, snapshot ruleVersionId), [[rule-engine-verification]], [[admin-rule-management]], [[right-to-erasure]], [[consent-management]] (ทุกไฟล์เขียน AuditLogEntry ในจุดที่เกี่ยวข้อง) | ไม่มี | ไม่มี |
| NFR-05 | Security/Access Control | **รองรับแล้ว** | [[architecture#4. NFR Mapping\|architecture 4]], [[api-spec#2. กฎการเข้าถึงข้อมูลแบบ Cross-Cutting (Access Control)\|api-spec หัวข้อ 2]], [[access-control]] (ตารางบังคับใช้กฎ cross-cutting ต่อทุก 17 operation ครบถ้วน) | ไม่มี | ไม่มี |
| NFR-06 | Performance ของ OCR/Rule Engine (เป้าหมายเวลาตอบสนองโดยรวมยังไม่กำหนด) | **รองรับบางส่วน** | [[architecture#4. NFR Mapping\|architecture 4]] (ระบุตรงๆว่า "ยังไม่มีตัวเลขเป้าหมายด้านเวลาตอบสนองโดยรวม"), [[architecture#5.1 ตำแหน่งของการตรวจสอบไฟล์อัปโหลด (FR-19) — Client หรือ Backend Service\|architecture 5.1]] (มาตรการเดียวที่มี: จำกัดขนาดไฟล์ ≤5MB/ไฟล์ ≤5 ไฟล์/รายการ), [[receipt-upload-ocr]] edge case #3/#7 | ไม่มีเป้าหมายเวลาตอบสนอง (SLA) ที่เป็นรูปธรรมของ pipeline OCR→Rule Engine→LLM; ไม่มีการออกแบบ timeout/retry policy เมื่อ External OCR/LLM ตอบช้า (มีแค่กรณี "ล้มเหลวทางเทคนิคสมบูรณ์" ใน [[rule-engine-verification]] edge case #9 ไม่ใช่กรณี "ช้าแต่ไม่ล้มเหลว") | `sync-architecture` (เพื่อกำหนดเป้าหมายเวลาตอบสนอง/timeout policy ในหัวข้อ 5.2 เมื่อมีตัวเลขจริง) ต่อด้วย `sync-detailed-design` (เพิ่ม edge case กรณี OCR/LLM ตอบช้าแยกจากกรณีล้มเหลวสมบูรณ์) |
| NFR-07 | Scalability ปริมาณใบเสร็จ (เป้าหมายตัวเลขยังไม่กำหนด) | **รองรับบางส่วน** | [[architecture#4. NFR Mapping\|architecture 4]] (ระบุ component รับผิดชอบ — Backend Service, Primary Data Store — แต่ระบุตรงๆว่า "ยังไม่มีตัวเลขเป้าหมาย"), [[architecture#5.2 รูปแบบการสื่อสารระหว่าง Backend Service ↔ OCR/Rule Engine/LLM — Synchronous หรือ Asynchronous\|architecture 5.2]] (ยอมรับความเสี่ยงของ synchronous pipeline ต่อการ scale ไว้ตรงๆ) | ไม่มี detailed-design ไฟล์ใดใน 12 ฟีเจอร์กล่าวถึงมาตรการรองรับปริมาณผู้ใช้/ใบเสร็จพร้อมกัน (เช่น connection pooling, indexing strategy, stateless design) เลยแม้แต่ไฟล์เดียว — เป็น NFR ที่มีการกล่าวถึงเฉพาะระดับ architecture เท่านั้น | `sync-architecture` (กำหนดตัวเลขเป้าหมาย/แนวทาง scale เมื่อมีข้อมูลปริมาณผู้ใช้จริง) ต่อด้วย `sync-api-db`/`sync-detailed-design` เพื่อสะท้อนมาตรการลงในระดับปฏิบัติ |
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

- [[backlog]] — แหล่งความจริงของ NFR ทั้งหมดที่ตรวจสอบในเอกสารนี้ (NFR-01–NFR-11)
- [[architecture]] — หัวข้อ 4 (NFR Mapping) และหัวข้อ 5 (ประเด็นรอตัดสินใจ) เป็นจุดอ้างอิงหลักของการ
  ตรวจสอบนี้
- [[api-spec]], [[db-spec]] — ตรวจสอบกฎ/ข้อจำกัดที่ผูกกับ NFR แต่ละตัวในระดับ operation/entity
- ไฟล์ทั้ง 12 ใน `detailed-design/`: [[receipt-upload-ocr]], [[review-edit-ocr-data]],
  [[rule-engine-verification]], [[resubmit-failed-receipt]], [[fund-dashboard]],
  [[pending-issue-notification]], [[export-verified-report]], [[admin-rule-management]],
  [[access-control]], [[consent-management]], [[data-access-portability]], [[right-to-erasure]]
- [[20260816-01-grant-receipt-verification]] — spec ต้นทางของ NFR-01–NFR-07
- [[20260816-02-pdpa-compliance]] — spec ต้นทางของ NFR-08–NFR-11 (PDPA)
