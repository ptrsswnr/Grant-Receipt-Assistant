# Backlog — Grant Receipt Assistant

สรุป Functional Requirements (FR) และ Non-Functional Requirements (NFR) ทั้งหมดจากทุกเอกสารใน
`01-spec/` จัดกลุ่มตามระดับความสำคัญ

> หมายเหตุ: ณ ตอนนี้มีเอกสาร spec 2 ฉบับ คือ
> [[20260816-01-grant-receipt-verification]] (สร้าง 2026-08-16, FR-01–FR-12/NFR-01–NFR-07) และ
> [[20260816-02-pdpa-compliance]] (สร้าง 2026-08-16, FR-13–FR-18/NFR-08–NFR-11) ตารางด้านล่างนี้
> นำเข้าทุกรายการ FR/NFR จากทั้งสองเอกสารแล้ว

## ระดับความสำคัญ: สูง (ต้องมีใน MVP)

| รหัส | หัวข้อ | เอกสารอ้างอิง | สถานะ |
|------|--------|----------------|--------|
| FR-01 | อัปโหลดใบเสร็จ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-02 | OCR อ่านข้อมูลใบเสร็จอัตโนมัติ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-03 | ตรวจสอบ/แก้ไขข้อมูลจาก OCR ก่อนส่งตรวจ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-04 | ตรวจใบเสร็จด้วย Rule-based Engine | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-05 | LLM สรุปผลตรวจเป็นภาษาที่เข้าใจง่าย | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-06 | แสดงสถานะใบเสร็จรายใบพร้อมเหตุผลอ้างอิงระเบียบ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-07 | แก้ไขและอัปโหลดใบเสร็จซ้ำ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-10 | Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-11 | นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-12 | จำกัดสิทธิ์การเข้าถึงข้อมูลใบเสร็จตามเจ้าของ | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-13 | แสดง Privacy Notice ก่อนใช้งานครั้งแรก/ก่อนอัปโหลดใบเสร็จ | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-14 | ขอความยินยอมชัดแจ้ง (Explicit Consent) ก่อนเก็บ/ประมวลผลข้อมูลใบเสร็จ | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-15 | บันทึกหลักฐานการให้ความยินยอม (Consent Record) | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-16 | ถอนความยินยอม (Withdraw Consent) และจัดการผลกระทบต่อกระบวนการตรวจใบเสร็จ | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |
| FR-18 | ลบ/ขอลบข้อมูลใบเสร็จของตนเองด้วยตนเองผ่าน UI (Right to Erasure) | [[20260816-02-pdpa-compliance#4. Functional Requirements]] | Backlog |

## ระดับความสำคัญ: กลาง

| รหัส | หัวข้อ | เอกสารอ้างอิง | สถานะ |
|------|--------|----------------|--------|
| FR-08 | หน้าสรุปภาพรวมใบเสร็จของทุน (Dashboard) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
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
| NFR-11 | Data Retention & Deletion Policy (รอกำหนดเป้าหมาย) | [[20260816-02-pdpa-compliance#5. Non-Functional Requirements]] | Backlog |

## รายการที่ตัดออกจากขอบเขต (Out of Scope — เพื่ออ้างอิง ไม่ใช่ backlog item)

รายการต่อไปนี้ถูกพิจารณาแล้วและ**ตัดออกจากขอบเขต MVP** ตามการยืนยันของผู้ใช้เมื่อ 2026-08-16
(ดูรายละเอียดที่ [[20260816-01-grant-receipt-verification#2.2 ตัดออกจากขอบเขต MVP นี้ (ยืนยันโดยผู้ใช้เมื่อ 2026-08-16 — ดูหัวข้อ 7)]]):

- Role/action ของ "เจ้าหน้าที่การเงิน" ในระบบ
- Role/workflow ของ "ผู้อนุมัติทุน" ในระบบ
- Deadline tracking รายทุน และการแจ้งเตือนที่อิงกำหนดเวลาส่งหลักฐาน

## Open Point ที่ยังไม่ปิดจากเอกสาร PDPA (เพื่ออ้างอิง — ไม่บล็อกการพัฒนา)

รายการต่อไปนี้ถูกบันทึกไว้ใน [[20260816-02-pdpa-compliance]] แล้วว่าต้องทบทวนเพิ่มเติมก่อนเข้าสู่
ขั้นตอนออกแบบละเอียด (`[[architecture]]`, `[[detailed-design]]`):

- พฤติกรรมของระบบเมื่อนักวิจัยถอนความยินยอม (Withdraw Consent) ต่อข้อมูลที่เคยประมวลผลไปแล้ว
  ก่อนถอน (ดู FR-16)
- ที่ตั้งผู้ให้บริการ OCR/LLM จริง (ในไทย/ต่างประเทศ) ที่กระทบว่าต้องใช้มาตรการ cross-border
  transfer ตาม NFR-08 หรือไม่
- ตัวเลขระยะเวลาเก็บข้อมูล (retention) ที่แน่นอนตาม NFR-11 (รอระเบียบของมหาวิทยาลัย/กรมบัญชีกลาง)
