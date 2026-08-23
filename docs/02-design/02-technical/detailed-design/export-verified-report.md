# Detailed Design — Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว

> การออกแบบระดับ component สำหรับ [[feature-list#7. Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว|ฟีเจอร์ที่ 7]]
> แปลงจาก [[user-journey#Journey 3: นักวิจัย Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้วเพื่อยื่นเจ้าหน้าที่การเงิน|Journey 3]]
> อ้างอิง operation จริงจาก [[api-spec#OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว|OP-10]] เท่านั้น
> (ใช้ผลลัพธ์ `canExport` จาก [[fund-dashboard]]/[[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)|OP-08]])

## 0. สถานะเอกสารนี้

สร้างครั้งแรกเมื่อ 2026-08-23 ครอบคลุม FR-10, FR-21 ตามที่
[[feature-list#7. Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว|ฟีเจอร์ที่ 7]] กำหนดไว้

## 1. ภาพรวม

ฟีเจอร์นี้มี operation เดียวคือ [[api-spec#OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว|OP-10]] —
สร้าง `ExportBatch` ใหม่พร้อม `ExportBatchReceipt` รวม `Receipt` ทุกใบที่ `status` = "ผ่าน" ของทุนนั้น
ณ ขณะ export (รวมใบเก่าที่เคย export แล้วด้วยเสมอ ไม่ใช่แค่ใบใหม่) แล้วล็อกใบเสร็จเหล่านั้นไม่ให้ลบเอง
ผ่าน UI ต่อจากนี้ (เชื่อมกับ [[right-to-erasure]]) — ปุ่ม Export ถูกปิดตั้งแต่ระดับ UI (จาก `canExport`
ของ [[fund-dashboard]]) ถ้ายังไม่มีใบเสร็จสถานะผ่านเลย ไม่ปล่อยให้เรียก operation นี้ได้เลย

Component ที่เกี่ยวข้อง: Client, Backend Service, Primary Data Store

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    actor R as นักวิจัย/เจ้าของทุน
    participant C as Client
    participant B as Backend Service
    participant DS as Primary Data Store

    R->>C: เข้าสู่ระบบ เลือกทุนที่ต้องการยื่น
    C->>B: OP-08 ขอสถานะใบเสร็จของทุน (ดู [[fund-dashboard]])
    B-->>C: canExport flag
    alt canExport = เท็จ (ไม่มีใบเสร็จสถานะผ่านเลย)
        C-->>R: ปุ่ม Export ถูกปิดการใช้งาน พร้อมข้อความแจ้งเหตุผล (FR-21 AC-1) — กลับไปแก้ไขใบเสร็จก่อน
    else canExport = จริง
        R->>C: กด Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว
        C->>B: OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว (fundId)
        B->>DS: ตรวจสอบเจ้าของ fundId (กฎ cross-cutting)
        alt fundId ไม่ใช่ของผู้เรียก
            B-->>C: ปฏิเสธ (กฎ cross-cutting)
        else ไม่มีใบเสร็จสถานะผ่านเลย (race condition — สถานะเปลี่ยนไปตั้งแต่เปิดหน้าจนถึงกด Export)
            B-->>C: ปฏิเสธพร้อมข้อความอธิบายเหตุผล (FR-21 AC-1)
        else มีใบเสร็จสถานะผ่านอย่างน้อย 1 ใบ
            B->>DS: รวบรวม Receipt ทุกใบ status = "ผ่าน" ของทุนนี้ ณ ขณะนี้ (รวมใบที่เคย export แล้วด้วย)
            B->>DS: สร้าง ExportBatch ใหม่ (fileReference, exportedByUserId, exportedAt)
            B->>DS: สร้าง ExportBatchReceipt ต่อ Receipt ที่รวมทุกใบ
            B->>DS: ตั้ง Receipt.isExported = จริง + firstExportedAt (ถ้ายังไม่เคยมีค่า) ให้ทุกใบที่รวมใน batch นี้
            DS-->>B: บันทึกสำเร็จ + ไฟล์รายงานพร้อม
            B-->>C: ส่งไฟล์ให้ดาวน์โหลด (FR-10 AC-1)
            C-->>R: ดาวน์โหลดไฟล์ นำไปยื่นเจ้าหน้าที่การเงินของมหาวิทยาลัยเอง (นอกระบบ)
        end
    end
```

## 3. Operation ↔ Entity ที่กระทบ

| Operation | Entity ที่กระทบ | การกระทำ | ลำดับ/เงื่อนไข |
|---|---|---|---|
| [[api-spec#OP-08 ดูภาพรวมสถานะใบเสร็จของทุน (Dashboard)\|OP-08]] | [[db-spec#E-03 ใบเสร็จ (Receipt)\|Receipt]] (E-03) | อ่าน (`canExport` คำนวณจาก `status`) | เกิดก่อน OP-10 เสมอ เพื่อควบคุมปุ่ม Export ที่ UI |
| [[api-spec#OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว\|OP-10]] | [[db-spec#E-02 ทุนวิจัย (Fund)\|Fund]] (E-02) | อ่าน (`ownerUserId`) | ตรวจสอบเจ้าของก่อนดำเนินการ (กฎ cross-cutting) |
| OP-10 | Receipt (E-03) | อ่าน (`status` = "ผ่าน" ทุกใบของทุนนี้) แล้วแก้ไข (`isExported`, `firstExportedAt`) | รวบรวมก่อน แล้วล็อกทุกใบที่รวมในการดำเนินการเดียวกัน — `isExported` เปลี่ยนทางเดียว (db-spec กฎข้อ 4) |
| OP-10 | [[db-spec#E-10 รอบการ Export (ExportBatch)\|ExportBatch]] (E-10) | สร้าง | 1 record ต่อการกด Export 1 ครั้ง |
| OP-10 | [[db-spec#E-11 ใบเสร็จในรอบ Export (ExportBatchReceipt)\|ExportBatchReceipt]] (E-11) | สร้าง (N records) | ผูกกับ `ExportBatch` ที่สร้างในคำขอเดียวกัน — ใบเสร็จหนึ่งใบอาจถูกรวมได้หลายรอบ |

## 4. State Diagram

```mermaid
stateDiagram-v2
    state "isExported = เท็จ" as s_notexported
    state "isExported = จริง" as s_exported

    [*] --> s_notexported : Receipt ถูกสร้าง (ค่าตั้งต้น — ดู [[receipt-upload-ocr]])
    s_notexported --> s_exported : OP-10 export สำเร็จ (เมื่อ Receipt.status = "ผ่าน" และถูกรวมใน batch)
    s_exported --> s_exported : OP-10 ครั้งถัดไป (ยังคง "จริง" — เปลี่ยนทางเดียวเท่านั้น, db-spec กฎข้อ 4)
```

> หมายเหตุ: `isExported` เปลี่ยนกลับเป็นเท็จไม่ได้ ยกเว้น record ถูกลบทั้งแถวไปเลย (กรณีถอนความยินยอม
> ทั้งหมด — ดู [[consent-management]])

## 5. Edge Case และวิธีจัดการ

| # | Edge Case | วิธีจัดการ | อ้างอิง |
|---|---|---|---|
| 1 | ยังไม่มีใบเสร็จสถานะ "ผ่าน" เลย | ปิดปุ่ม Export ที่ระดับ UI ตั้งแต่ [[fund-dashboard]] ไม่ปล่อยให้เรียก OP-10 ได้เลย | FR-21 AC-1 |
| 2 | `fundId` ไม่ใช่ของผู้เรียก | ปฏิเสธ (กฎ cross-cutting) | [[api-spec#OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว\|OP-10]] |
| 3 | สถานะเปลี่ยนไปหลังเปิดหน้า (race condition ระหว่างเปิด Dashboard กับกด Export จริง) | Backend ตรวจสอบซ้ำที่ OP-10 เอง ไม่พึ่ง `canExport` จาก UI เพียงอย่างเดียว — ถ้าไม่มีใบผ่านแล้วจริง ปฏิเสธพร้อมข้อความอธิบาย | FR-21 AC-1 (ตีความการตรวจสอบซ้ำนี้จากหลักการ authoritative validation เดียวกับที่ [[architecture#5.1 ตำแหน่งของการตรวจสอบไฟล์อัปโหลด (FR-19) — Client หรือ Backend Service\|architecture 5.1]] ใช้กับ OP-01) |
| 4 | Export ครั้งถัดไปของทุนเดียวกัน | รวบรวม "ใบเสร็จสถานะผ่านทั้งหมด" ใหม่เสมอ (รวมใบเก่าที่เคย export แล้วด้วย) ไม่ใช่แค่ใบที่ผ่านใหม่ล่าสุด | [[api-spec#OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว\|OP-10]] กฎทางธุรกิจข้อ 3 |
| 5 | ใบเสร็จที่ export แล้วถูกพยายามลบผ่าน UI | ล็อกไม่ให้ลบ (เชื่อมกับ [[right-to-erasure]]/FR-18) | FR-10 AC-2 |

## เอกสารที่เกี่ยวข้อง

- [[feature-list#7. Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว|feature-list ฟีเจอร์ที่ 7]]
- [[user-journey#Journey 3: นักวิจัย Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้วเพื่อยื่นเจ้าหน้าที่การเงิน|user-journey Journey 3]]
- [[api-spec#OP-10 Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว|api-spec OP-10]]
- [[db-spec#E-10 รอบการ Export (ExportBatch)|db-spec E-10]], [[db-spec#E-11 ใบเสร็จในรอบ Export (ExportBatchReceipt)|E-11]]
- [[fund-dashboard]] — ที่มาของ `canExport` flag
- [[right-to-erasure]] — ผลกระทบของ `isExported` ต่อการลบใบเสร็จ
- [[access-control]] — กฎ cross-cutting เรื่องเจ้าของ `fundId`
- test case: `docs/03-testing/01-test-plan/test-cases/export-verified-report.md`
