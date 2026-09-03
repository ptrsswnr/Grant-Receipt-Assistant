# Backlog — Grant Receipt Assistant

สรุป Functional Requirements (FR) และ Non-Functional Requirements (NFR) ทั้งหมดจากทุกเอกสารใน
`01-spec/` จัดกลุ่มตามระดับความสำคัญ

> หมายเหตุ: ณ ตอนนี้มีเอกสาร spec 2 ฉบับ คือ
> [[20260816-01-grant-receipt-verification]] (สร้าง 2026-08-16, FR-01–FR-12/FR-19/FR-21,
> NFR-01–NFR-07) และ [[20260816-02-pdpa-compliance]] (สร้าง 2026-08-16, FR-13–FR-18/FR-20,
> NFR-08–NFR-11) ตารางด้านล่างนี้นำเข้าทุกรายการ FR/NFR จากทั้งสองเอกสารแล้ว
>
> **อัปเดต 2026-08-16 (รอบ 2):** เพิ่ม FR-19, FR-21 (ขยายรายละเอียด FR-01/FR-10 เรื่อง validation
> การอัปโหลด/export) และ FR-20 (ข้อเสนอตั้งต้น ยังไม่ finalize — ปิด open point การถอนความยินยอม
> ต่อข้อมูลที่เคยประมวลผลไปแล้ว รอการยืนยันจากผู้ใช้) หลัง `test-writer` พบช่องว่างระหว่างเขียน
> Acceptance Criteria (`sync-test-plan`)
>
> **อัปเดต 2026-08-16 (รอบ 3):** ผู้ใช้ยืนยันคำตอบ FR-20 แล้ว (ลบข้อมูลทั้งหมดทันทีเมื่อถอนความยินยอม
> ไม่แยกตามสถานะ export) — **FR-20 finalize แล้ว** พร้อมทบทวนเหตุผลของ FR-18 ที่เกี่ยวข้อง (คงเงื่อนไข
> เดิมไว้ แต่เปลี่ยนเหตุผลรองรับเป็น Audit Trail — ดู [[20260816-02-pdpa-compliance#8.2 ทบทวนเหตุผลของ FR-18 หลังคำชี้แจงเรื่องบทบาทระบบ (ประเมินเมื่อ 2026-08-16 รอบ 3)]])
>
> **อัปเดต 2026-08-23:** เพิ่ม **FR-22** (Multi-file Receipt Bundle — ขยายรายละเอียด FR-01/FR-19
> เรื่องนิยาม "ใบเสร็จ 1 รายการ" แบบมีหลายไฟล์/แผ่น + finalize ตัวเลขจำกัดจำนวนไฟล์สูงสุด 5 ไฟล์/
> รายการ และขนาดไฟล์สูงสุด 5 MB/ไฟล์ เดิมเป็น TBD) ยืนยันโดยผู้ใช้จากการคุยหลายรอบก่อนหน้า — ดู
> [[20260816-01-grant-receipt-verification#10. ส่วนขยายจาก Requirement เพิ่มเติมของผู้ใช้ (2026-08-23) — นิยาม "ใบเสร็จ 1 รายการ" แบบหลายไฟล์]]
>
> **อัปเดต 2026-09-03:** แก้ไขโมเดลข้อมูลผิด — เดิม "Fund" ปนแนวคิดแหล่งทุนกับโครงการ ผู้ใช้เลือกทาง
> "ปรับเต็มรูปแบบ" แยกเป็น **FundSource** (แหล่งทุน — 1 แหล่ง : หลายโครงการ), **Project** (โครงการวิจัย
> — เจ้าของคือนักวิจัย, ใบเสร็จผูกกับ Project ไม่ใช่ FundSource), **Researcher** (นักวิจัย) เพิ่ม
> **FR-23** (Project Setup) และแก้ไข FR-01/FR-04/FR-08/FR-11/FR-12 ให้สะท้อนโมเดลใหม่ — ดู
> [[20260816-01-grant-receipt-verification#11. ส่วนแก้ไขจากการชี้ประเด็นของผู้ใช้ (2026-09-03) — แยกนิยาม "แหล่งทุน" ออกจาก "โครงการวิจัย"]]
>
> **อัปเดต 2026-09-03 (รอบ 2):** ผู้ใช้ยืนยันคำตอบ 2 ประเด็นที่ค้างไว้แล้ว — (1) 1 โครงการมีนักวิจัย
> เจ้าของ **1 คน** และ (2) Rule Engine อ้างอิงระเบียบของแหล่งทุนเวอร์ชันที่ **active ณ วันที่ตรวจ
> ใบเสร็จ** — ทั้งสองประเด็น **finalize แล้ว** (ดูหัวข้อ 11.1 ของเอกสารข้างต้น)

## ระดับความสำคัญ: สูง (ต้องมีใน MVP)

| รหัส | หัวข้อ | เอกสารอ้างอิง | สถานะ |
|------|--------|----------------|--------|
| FR-01 | อัปโหลดใบเสร็จ (ผูกกับโครงการวิจัย ไม่ใช่แหล่งทุนโดยตรง) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-02 | OCR อ่านข้อมูลใบเสร็จอัตโนมัติ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-03 | ตรวจสอบ/แก้ไขข้อมูลจาก OCR ก่อนส่งตรวจ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-04 | ตรวจใบเสร็จด้วย Rule-based Engine (อ้างอิงระเบียบของแหล่งทุนที่โครงการสังกัด) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-05 | LLM สรุปผลตรวจเป็นภาษาที่เข้าใจง่าย | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-06 | แสดงสถานะใบเสร็จรายใบพร้อมเหตุผลอ้างอิงระเบียบ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-07 | แก้ไขและอัปโหลดใบเสร็จซ้ำ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-10 | Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-11 | นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine (ต่อแหล่งทุนแต่ละแหล่ง) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-12 | จำกัดสิทธิ์การเข้าถึงข้อมูลใบเสร็จตามเจ้าของโครงการ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-13 | แสดง Privacy Notice ก่อนใช้งานครั้งแรก/ก่อนอัปโหลดใบเสร็จ | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-14 | ขอความยินยอมชัดแจ้ง (Explicit Consent) ก่อนเก็บ/ประมวลผลข้อมูลใบเสร็จ | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-15 | บันทึกหลักฐานการให้ความยินยอม (Consent Record) | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-16 | ถอนความยินยอม (Withdraw Consent) และจัดการผลกระทบต่อกระบวนการตรวจใบเสร็จ | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-18 | ลบ/ขอลบข้อมูลใบเสร็จของตนเองด้วยตนเองผ่าน UI (Right to Erasure) | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-19 | ตรวจสอบและปฏิเสธไฟล์อัปโหลดที่ไม่ถูกต้อง (File Upload Validation) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-20 | ลบข้อมูลใบเสร็จ/ผลตรวจทั้งหมดทันทีเมื่อถอนความยินยอม (Withdraw Consent — Full Immediate Erasure) | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-21 | ป้องกันการ Export รายงานเมื่อยังไม่มีใบเสร็จสถานะผ่าน | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-22 | อัปโหลดใบเสร็จแบบหลายไฟล์ต่อ 1 รายการ (Multi-file Receipt Bundle) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-23 | จัดการข้อมูลโครงการวิจัยและผูกกับแหล่งทุน (Project Setup) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |

## ระดับความสำคัญ: กลาง

| รหัส | หัวข้อ | เอกสารอ้างอิง | สถานะ |
|------|--------|----------------|--------|
| FR-08 | หน้าสรุปภาพรวมใบเสร็จของโครงการ (Dashboard) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-09 | แจ้งเตือนใบเสร็จที่มีปัญหายังไม่แก้ไข | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-17 | ขอเข้าถึง/ขอสำเนาข้อมูลใบเสร็จส่วนบุคคลของตนเอง (Data Subject Access & Portability) | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |

## ระดับความสำคัญ: ต่ำ

_(ยังไม่มีรายการ)_

## Non-Functional Requirements

| รหัส | ด้าน | เอกสารอ้างอิง | สถานะ |
|------|------|----------------|--------|
| NFR-01 | ภาษา (Localization) | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-02 | Usability/การสื่อสาร | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-03 | Explainability | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-04 | Audit Trail | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-05 | Security/Access Control | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-06 | Performance (รอกำหนดเป้าหมาย) | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-07 | Scalability (รอกำหนดเป้าหมาย) | [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements]] | Backlog |
| NFR-08 | Cross-border Data Transfer (Conditional — รอการตัดสินใจ vendor) | [[20260816-02-pdpa-compliance#5. Non-Functional Requirements]] | Backlog |
| NFR-09 | Data Processing Agreement กับผู้ให้บริการภายนอก (Organizational) | [[20260816-02-pdpa-compliance#5. Non-Functional Requirements]] | Backlog |
| NFR-10 | Data Breach Notification (Organizational/Process) | [[20260816-02-pdpa-compliance#5. Non-Functional Requirements]] | Backlog |
| NFR-11 | Data Retention & Deletion Policy (รอกำหนดเป้าหมาย — TBD) | [[20260816-02-pdpa-compliance#5. Non-Functional Requirements]] | Backlog |

## รายการที่ตัดออกจากขอบเขต (Out of Scope — เพื่ออ้างอิง ไม่ใช่ backlog item)

รายการต่อไปนี้ถูกพิจารณาแล้วและ**ตัดออกจากขอบเขต MVP** ตามการยืนยันของผู้ใช้เมื่อ 2026-08-16
(ดูรายละเอียดที่ [[20260816-01-grant-receipt-verification#2.2 ตัดออกจากขอบเขต MVP นี้ (ยืนยันโดยผู้ใช้เมื่อ 2026-08-16 — ดูหัวข้อ 7)]]):

- Role/action ของ "เจ้าหน้าที่การเงิน" ในระบบ
- Role/workflow ของ "ผู้อนุมัติทุน" ในระบบ
- Deadline tracking รายทุน และการแจ้งเตือนที่อิงกำหนดเวลาส่งหลักฐาน

## Open Point ที่ยังไม่ปิดจากเอกสาร PDPA (เพื่ออ้างอิง — ไม่บล็อกการพัฒนา)

รายการต่อไปนี้ถูกบันทึกไว้ใน [[20260816-02-pdpa-compliance]] แล้วว่าต้องทบทวนเพิ่มเติมก่อนเข้าสู่
ขั้นตอนออกแบบละเอียด (`[[architecture]]`, `[[detailed-design]]`):

- ที่ตั้งผู้ให้บริการ OCR/LLM จริง (ในไทย/ต่างประเทศ) ที่กระทบว่าต้องใช้มาตรการ cross-border
  transfer ตาม NFR-08 หรือไม่
- ตัวเลขระยะเวลาเก็บข้อมูล (retention) ที่แน่นอนตาม NFR-11 (รอระเบียบของมหาวิทยาลัย/กรมบัญชีกลาง) —
  **หมายเหตุ 2026-08-16 (รอบ 3):** แม้ตัวเลขยังเป็น TBD แต่ NFR-11 ไม่ใช่เหตุผลจำกัดสิทธิ์การลบ
  ข้อมูลของเจ้าของข้อมูลอีกต่อไป (ดู FR-18/FR-20 หัวข้อ 8.2 ของ [[20260816-02-pdpa-compliance]])
  เป็นเพียงนโยบายการเก็บ/ลบข้อมูลตามปกติของระบบเองเท่านั้น

**ปิดแล้ว 2026-08-16 (รอบ 3):** พฤติกรรมของระบบเมื่อนักวิจัยถอนความยินยอม (Withdraw Consent) ต่อข้อมูล
ที่เคยประมวลผลไปแล้วก่อนถอน (เดิมอ้างอิง FR-16) — ผู้ใช้ยืนยันเป็น **FR-20**: ลบข้อมูลใบเสร็จ/ผลตรวจ
ทั้งหมดทันที ไม่แยกตามสถานะ export เพราะระบบเป็นเพียง pre-check gate ไม่ใช่ archival/official
retention system (ดู [[20260816-02-pdpa-compliance#8.1 คำถามเรื่อง FR-20 — ถามเมื่อ 2026-08-16 รอบ 2, ผู้ใช้ยืนยันคำตอบแล้วในรอบ 3]]) การชี้แจงนี้ยังทำให้ต้องทบทวนเหตุผล (ไม่ใช่พฤติกรรม) ของ FR-18
ด้วย — สรุปคือคงเงื่อนไขเดิมไว้ แต่เปลี่ยนเหตุผลรองรับเป็น Audit Trail/ป้องกันการลบหลักฐานหนีความรับผิด
(ดู [[20260816-02-pdpa-compliance#8.2 ทบทวนเหตุผลของ FR-18 หลังคำชี้แจงเรื่องบทบาทระบบ (ประเมินเมื่อ 2026-08-16 รอบ 3)]])

## Open Point ใหม่จาก FR-22 (2026-08-23 — ยังไม่บล็อกการพัฒนา แต่ต้อง sync ก่อน design ถัดไป)

FR-22 (Multi-file Receipt Bundle) เพิ่งถูก finalize วันนี้ ในขณะที่ `docs/02-design/02-technical/`
(`architecture.md`, `api-spec.md`, `db-spec.md`) ถูกเขียนเสร็จไปแล้วก่อนหน้าในวันเดียวกันโดยยังไม่รู้จัก
FR-22 นี้ ทำให้เกิดความไม่ตรงกัน 2 จุดที่ต้องแก้ผ่าน `sync-technical-spec`:

- `db-spec.md` หัวข้อ 5.1 เคยตั้งค่าเริ่มต้นชั่วคราวขนาดไฟล์สูงสุดไว้ที่ 10 MB — ต้องปรับเป็น **5 MB**
  ให้ตรงกับ FR-19(3)/FR-22 ที่ finalize แล้ว
- โครงสร้างข้อมูล `Receipt` ใน `db-spec.md` ปัจจุบันยังไม่รองรับ "1 รายการใบเสร็จ = หลายไฟล์" (multi-file
  bundle, สูงสุด 5 ไฟล์/รายการ) ต้องเพิ่ม entity/attribute รองรับ พร้อมทบทวน `architecture.md`/
  `api-spec.md` ที่เกี่ยวข้อง (Upload Validation ของ Backend Service, operation อัปโหลดใบเสร็จ)

## Open Point จากการแก้ไขโมเดลข้อมูล Fund/Project/Researcher (2026-09-03 — ปิดแล้ว, ต้อง sync ก่อน design ถัดไป)

ผู้ใช้ชี้ประเด็นว่าโมเดลข้อมูลเดิม (entity "Fund" ผูก `ownerUserId` ตรงกับนักวิจัย) ปนแนวคิด "แหล่งทุน"
กับ "โครงการวิจัย" เข้าด้วยกัน — แก้ไขแล้วในสเปคหลัก (เพิ่ม FR-23, แก้ FR-01/FR-04/FR-08/FR-11/FR-12
ดู [[20260816-01-grant-receipt-verification#11. ส่วนแก้ไขจากการชี้ประเด็นของผู้ใช้ (2026-09-03) — แยกนิยาม "แหล่งทุน" ออกจาก "โครงการวิจัย"]])

**ปิดแล้ว 2026-09-03 (รอบ 2):** ผู้ใช้ยืนยันคำตอบทั้ง 2 ประเด็นที่เคยค้างแล้ว:

- **จำนวนนักวิจัยเจ้าของต่อ 1 โครงการ** = **1 คนต่อโครงการ** (finalize แล้ว)
- **เวอร์ชันระเบียบของแหล่งทุนที่ Rule Engine อ้างอิง** = **เวอร์ชันที่ active ณ วันที่ตรวจใบเสร็จ**
  (finalize แล้ว)

ดูรายละเอียดที่ [[20260816-01-grant-receipt-verification#11.1 ประเด็นที่ถามผู้ใช้เพิ่มเติมและคำตอบที่ยืนยันแล้ว (finalize 2026-09-03)]]
— ยังคงต้องรัน `sync-technical-spec` ต่อไปเพื่อออกแบบ schema ของ Researcher/Project/FundSource ใน
`db-spec.md`/`architecture.md`/`api-spec.md` ให้ตรงกับคำตอบที่ finalize แล้วนี้ (ดูหัวข้อ 11.3 ของ
เอกสารข้างต้น) — ไม่ใช่ open point ที่บล็อกอีกต่อไป เป็นเพียงงานที่ต้องส่งต่อ
