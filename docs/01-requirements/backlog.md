# Backlog — Grant Receipt Assistant

สรุป Functional Requirements (FR) และ Non-Functional Requirements (NFR) ทั้งหมดจากทุกเอกสารใน
[[20260816-01-grant-receipt-verification|01-spec/]] จัดกลุ่มตามระดับความสำคัญ

> หมายเหตุ: ณ ตอนนี้มีเอกสาร spec เพียงฉบับเดียวคือ
> [[20260816-01-grant-receipt-verification]] (สร้าง 2026-08-16) ตารางด้านล่างนี้นำเข้าทุกรายการ
> FR/NFR จากเอกสารดังกล่าวทั้งหมดแล้ว

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

## ระดับความสำคัญ: กลาง

| รหัส | หัวข้อ | เอกสารอ้างอิง | สถานะ |
|------|--------|----------------|--------|
| FR-08 | หน้าสรุปภาพรวมใบเสร็จของทุน (Dashboard) | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |
| FR-09 | แจ้งเตือนใบเสร็จที่มีปัญหายังไม่แก้ไข | [[20260816-01-grant-receipt-verification#4. Functional Requirements]] | Backlog |

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

## รายการที่ตัดออกจากขอบเขต (Out of Scope — เพื่ออ้างอิง ไม่ใช่ backlog item)

รายการต่อไปนี้ถูกพิจารณาแล้วและ**ตัดออกจากขอบเขต MVP** ตามการยืนยันของผู้ใช้เมื่อ 2026-08-16
(ดูรายละเอียดที่ [[20260816-01-grant-receipt-verification#2.2 ตัดออกจากขอบเขต MVP นี้ (ยืนยันโดยผู้ใช้เมื่อ 2026-08-16 — ดูหัวข้อ 7)]]):

- Role/action ของ "เจ้าหน้าที่การเงิน" ในระบบ
- Role/workflow ของ "ผู้อนุมัติทุน" ในระบบ
- Deadline tracking รายทุน และการแจ้งเตือนที่อิงกำหนดเวลาส่งหลักฐาน
