# Detailed Design — Dashboard สรุปภาพรวมใบเสร็จของทุน

> การออกแบบระดับ component สำหรับ [[feature-list#5. Dashboard สรุปภาพรวมใบเสร็จของทุน|ฟีเจอร์ที่ 5]]
> แปลงจาก [[user-journey#Journey 2: นักวิจัยติดตามภาพรวมทุนและจัดการใบเสร็จที่มีปัญหาผ่าน Dashboard และการแจ้งเตือน|Journey 2 ขั้นตอนที่ 3]]
> อ้างอิง operation จริงจาก [[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)|OP-08]] เท่านั้น

## 0. สถานะเอกสารนี้

สร้างครั้งแรกเมื่อ 2026-08-23 ครอบคลุม FR-08, FR-21 (ส่วน `canExport` flag) ตามที่
[[feature-list#5. Dashboard สรุปภาพรวมใบเสร็จของทุน|ฟีเจอร์ที่ 5]] กำหนดไว้

## 1. ภาพรวม

ฟีเจอร์นี้มี operation เดียวคือ [[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)|OP-08]] เป็น
**read-only aggregation** ทั้งหมด — นับจำนวนใบเสร็จของทุนแยกตามสถานะ และคำนวณ flag `canExport`
(จริง เมื่อมีใบเสร็จ `status` = "ผ่าน" อย่างน้อย 1 ใบ) เพื่อควบคุมว่าปุ่ม Export ของ
[[export-verified-report]] ใช้งานได้หรือไม่ (เชื่อม FR-21)

Component ที่เกี่ยวข้อง: Client, Backend Service, Primary Data Store

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    actor R as นักวิจัย/เจ้าของทุน
    participant C as Client
    participant B as Backend Service
    participant DS as Primary Data Store

    R->>C: เปิด Dashboard ของทุนที่ต้องการดู
    C->>B: OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (fundId)
    B->>DS: ตรวจสอบเจ้าของ fundId (กฎ cross-cutting — ดู [[access-control]])
    alt fundId ไม่ใช่ของผู้เรียก
        B-->>C: ปฏิเสธ (กฎ cross-cutting)
    else เป็นเจ้าของจริง
        DS-->>B: จำนวน Receipt แยกตาม status ทั้งหมดของทุนนี้
        B->>B: คำนวณ canExport = จริง เมื่อมี status = "ผ่าน" อย่างน้อย 1 ใบ
        B-->>C: แสดงจำนวนแยกตามสถานะ + canExport flag
    end
```

## 3. Operation ↔ Entity ที่กระทบ

| Operation | Entity ที่กระทบ | การกระทำ | ลำดับ/เงื่อนไข |
|---|---|---|---|
| [[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)\|OP-08]] | [[db-spec#E-02 ทุนวิจัย (Fund)\|Fund]] (E-02) | อ่าน (`ownerUserId`) | ตรวจสอบเจ้าของก่อนคืนข้อมูล (กฎ cross-cutting) |
| OP-08 | [[db-spec#E-03 ใบเสร็จ (Receipt)\|Receipt]] (E-03) | อ่าน (`status` ทุก record ของทุนนี้) | นับจำนวนแยกตามสถานะ — ไม่มีการแก้ไข entity ใดในฟีเจอร์นี้ |

## 4. State Diagram

ไม่มี — ฟีเจอร์นี้เป็น read-only aggregation ทั้งหมด ไม่มีการเปลี่ยนแปลงสถานะของ entity ใดๆ

## 5. Edge Case และวิธีจัดการ

| # | Edge Case | วิธีจัดการ | อ้างอิง |
|---|---|---|---|
| 1 | `fundId` ไม่ใช่ของผู้เรียก | ปฏิเสธ (กฎ cross-cutting) | [[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)\|OP-08]] |
| 2 | ทุนที่ยังไม่มีใบเสร็จเลย | แสดงจำนวนทุกสถานะเป็น 0 ไม่ใช่ error | FR-08 AC-2 |
| 3 | ทุนมีใบเสร็จหลายสถานะปนกัน | แสดงจำนวนแยกตามสถานะให้ถูกต้องตรงกับข้อมูลจริง | FR-08 AC-1 |
| 4 | ยังไม่มีใบเสร็จสถานะ "ผ่าน" เลย | `canExport` = เท็จ — ปิดปุ่ม Export ที่ [[export-verified-report]] | FR-21 AC-1 |

## เอกสารที่เกี่ยวข้อง

- [[feature-list#5. Dashboard สรุปภาพรวมใบเสร็จของทุน|feature-list ฟีเจอร์ที่ 5]]
- [[user-journey#Journey 2: นักวิจัยติดตามภาพรวมทุนและจัดการใบเสร็จที่มีปัญหาผ่าน Dashboard และการแจ้งเตือน|user-journey Journey 2]]
- [[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)|api-spec OP-08]]
- [[db-spec#E-03 ใบเสร็จ (Receipt)|db-spec E-03]]
- [[pending-issue-notification]] — ฟีเจอร์ที่เกี่ยวข้องกัน (แจ้งเตือนจากสถานะเดียวกัน)
- [[export-verified-report]] — ใช้ `canExport` flag จากฟีเจอร์นี้
- [[access-control]] — กฎ cross-cutting เรื่องเจ้าของ `fundId`
- test case: `docs/03-testing/01-test-plan/test-cases/fund-dashboard.md`
