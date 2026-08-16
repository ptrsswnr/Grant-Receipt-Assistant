# Prototype v1 — Grant Receipt Assistant

> Clickable HTML Prototype เวอร์ชันแรกของโปรเจกต์ (ยังไม่เคยมีเวอร์ชันใดมาก่อน) สร้างจาก
> [[feature-list]] (12 ฟีเจอร์) และ [[user-journey]] (7 journey) ยึด [[DESIGN.md]] เป็น
> single source of truth ของภาพทั้งหมด (สี, ตัวอักษร, ระยะห่าง, องค์ประกอบ UI) ทุกจุด — ไม่มีการ
> กำหนดสี/สไตล์ใหม่นอกเหนือ token ที่มีอยู่ในเอกสารนั้น

## ขอบเขต

ครอบคลุมทุก 7 journey / 12 ฟีเจอร์ (default ตามที่ผู้ใช้ยืนยัน ไม่ลดขอบเขต) แบ่งเป็น 12 หน้า HTML
+ `style.css` + ไฟล์นี้

## ตาราง ไฟล์ ↔ Journey ↔ FR/NFR ↔ บทบาท

| ไฟล์ | Journey ที่ครอบคลุม | FR/NFR หลัก | บทบาท |
|------|----------------------|-------------|--------|
| `index.html` | หน้ารวมลิงก์ทุกหน้าจอ จัดกลุ่มตาม journey พร้อม badge บทบาท | — | ทั้งสอง |
| `login.html` | จุดเริ่มต้นของทุก journey (เลือกบทบาทเพื่อทดลอง flow) | FR-12, NFR-05 | นักวิจัย/Admin |
| `consent-notice.html` | Journey 1 ขั้นตอน 2-3 — Privacy Notice + consent gate เต็มจอ (ปิดไม่ได้นอกจากเลือกตัวเลือก) | FR-13, FR-14, FR-15 | นักวิจัย/เจ้าของทุน |
| `upload-receipt.html` | Journey 1 ขั้นตอน 4-5 — dropzone อัปโหลด + ตัวอย่าง validation error 3 กรณี | FR-01, FR-19 | นักวิจัย/เจ้าของทุน |
| `review-ocr-data.html` | Journey 1 ขั้นตอน 6-8 — ฟอร์มตรวจ/แก้ไขข้อมูลที่ OCR อ่านได้ก่อนส่งตรวจ | FR-02, FR-03, NFR-01 | นักวิจัย/เจ้าของทุน |
| `verification-result.html` | Journey 1 ขั้นตอน 9-10, Journey 2 ขั้นตอน 4 — Rule Explanation Callout ครบ 3 สถานะ (ผ่าน/ต้องแก้ไข/ไม่เข้าเงื่อนไข) + resubmit | FR-04, FR-05, FR-06, FR-07, NFR-02, NFR-03, NFR-04 | นักวิจัย/เจ้าของทุน |
| `dashboard.html` | Journey 2 ทั้งหมด — Stat Tile ต่อทุน + สัดส่วนสถานะแบบ segmented bar + แจ้งเตือนปัญหาค้าง | FR-08, FR-09 | นักวิจัย/เจ้าของทุน |
| `my-receipts.html` | Journey 7 ทั้งหมด — รายการใบเสร็จ + ลบใบเสร็จ (อนุญาต/ปิดกั้นตามสถานะ export) | FR-18 | นักวิจัย/เจ้าของทุน |
| `export-report.html` | Journey 3 ทั้งหมด — ปุ่ม Export ปิด/เปิดตามเงื่อนไขว่ามีใบเสร็จผ่านหรือไม่ | FR-10, FR-21 | นักวิจัย/เจ้าของทุน |
| `privacy-consent-management.html` | Journey 5 ทั้งหมด — ดูสถานะ consent ปัจจุบัน + ถอนความยินยอม + คำเตือนลบข้อมูลทั้งหมดทันที | FR-16, FR-20 | นักวิจัย/เจ้าของทุน |
| `data-access-request.html` | Journey 6 ทั้งหมด — ขอสำเนาข้อมูลส่วนบุคคลทั้งหมด (แยกจาก Export รายงาน) | FR-17 | นักวิจัย/เจ้าของทุน |
| `admin-rule-management.html` | Journey 4 ทั้งหมด — นำเข้า/อัปเดตระเบียบเวอร์ชันใหม่ + ประวัติ Audit Trail | FR-11, NFR-04 | Admin |

รวม **FR-01–FR-21 และ NFR-01–NFR-11 ทั้งหมด** อย่างน้อย 1 จุดต่อรหัส (NFR-06/07/08/09/10/11
เป็น requirement เชิง performance/organizational/TBD ที่ไม่มีองค์ประกอบ UI เฉพาะ จึงสะท้อนผ่านข้อความ
อธิบายในหน้าที่เกี่ยวข้องแทนการมีหน้าจอแยก — เช่น NFR-11 ถูกอ้างถึงในเนื้อหา Privacy Notice)

## หมายเหตุการออกแบบที่เน้นตาม NFR/หลักการออกแบบ

- **NFR-02 (Usability)**: ข้อความ error และคำอธิบายผลตรวจทุกจุดใช้ระดับ `body` (15px) ไม่ใช่
  `small`/`tiny` ตามกฎเฉพาะโปรเจกต์ใน DESIGN.md — ตรวจสอบแล้วในทุกหน้าที่มี error/Rule Explanation
  Callout
- **NFR-03 (Explainability)**: ทุกจุดที่แสดงผลตรวจ (`verification-result.html`) มี Rule Explanation
  Callout ครบทั้ง 2 ส่วนเสมอ (คำอธิบายภาษาเข้าใจง่าย + ส่วนอ้างอิงระเบียบ) ไม่มีจุดใดแสดงแค่ status
  chip โดยไม่มีคำอธิบายกำกับ
- **NFR-04 (Audit Trail)**: อ้างอิงเวอร์ชันระเบียบที่ใช้ตัดสินในทุก Rule Explanation Callout และมี
  หน้า Audit Trail แยกใน `admin-rule-management.html`
- **Consent gate (FR-13/FR-14)**: `consent-notice.html` ออกแบบเป็น modal เต็มจอปิดไม่ได้ตาม
  component "Consent / Privacy Notice Banner" ใน DESIGN.md — ไม่มีปุ่มปิด (X) และไม่มี backdrop ที่
  คลิกปิดได้ ต้องเลือก "ยืนยัน" หรือ "ไม่ยินยอม" เท่านั้น
- **1 primary action ต่อหน้าจอ**: ทุกหน้าเน้นปุ่ม Primary เดียวเป็น action หลัก (เช่น "ส่งเข้าตรวจกับ
  Rule Engine", "Export รายงาน") ปุ่มรองใช้ Secondary/Ghost เสมอ
- **สัดส่วนสถานะใบเสร็จใน `dashboard.html`**: เรียก Skill `dataviz` ก่อนออกแบบ ใช้เฉพาะสี status ที่มี
  อยู่แล้วใน DESIGN.md (success/warning/error) + sage สำหรับ "รอตรวจสอบ" ไม่มีการสร้างสี categorical
  ใหม่ ใช้ spacer 2px ระหว่าง segment ตาม mark spec ของ dataviz skill พร้อม legend ที่ไม่พึ่งสีอย่าง
  เดียว (มีตัวเลข/label กำกับทุก segment) และมี Stat Tile ทำหน้าที่เป็น textual fallback ของข้อมูล
  เดียวกัน
- **Placeholder รูปภาพ**: ใช้ไอคอนเอกสาร (🧾) บนพื้น surface-sunken แทนรูปถ่ายจริงทุกจุด (thumbnail
  ใบเสร็จ, ไอคอนอัปโหลด) เพราะ spec ไม่ได้ระบุว่ามีรูปถ่ายจริงมาให้
- **Access Control (FR-12) เป็น cross-cutting**: ไม่มีหน้าจอเฉพาะของตัวเอง แต่สะท้อนผ่าน role badge
  ในทุกหน้า (นักวิจัย/เจ้าของทุน vs Admin) และข้อความกำกับใน `login.html`/`admin-rule-management.html`
  ว่า Admin ไม่มีสิทธิ์เข้าถึงข้อมูลใบเสร็จส่วนบุคคล

## ข้อจำกัดที่ทราบอยู่แล้ว (ไม่บล็อก prototype นี้)

- ตัวเลขจริง (วงเงินสูงสุดต่อหมวด, ขนาดไฟล์สูงสุด, ระยะเวลาเก็บข้อมูล) ยังเป็น TBD ตาม spec ต้นทาง —
  ใช้ตัวเลขสมมติเพื่อสาธิต UI เท่านั้น ไม่ใช่ตัวเลข finalize
- ยังไม่มีการเชื่อมต่อ backend ใดๆ ปุ่ม/ฟอร์มทั้งหมดเป็น static navigation ระหว่างหน้า (บาง state เช่น
  "ยืนยันการลบ", "ถอน consent สำเร็จ" แสดงเป็นตัวอย่าง state คงที่ในหน้าเดียวกันแทนการ toggle จริง)

## ยังไม่ได้ตรวจสอบ

ไม่มีเครื่องมือเปิดเบราว์เซอร์ในเซสชันนี้ — ตรวจสอบได้เพียงการอ่านไฟล์ HTML/CSS กลับมาดูโครงสร้าง,
ลิงก์ระหว่างหน้า (href ตรงกับชื่อไฟล์จริงทุกจุด, ตรวจด้วย Grep แล้ว), และการอ้างอิง `style.css`
(ตรวจครบทั้ง 12 ไฟล์) ยังไม่ได้เปิดดูผลจริงในเบราว์เซอร์ — เป็น follow-up ที่ทำได้ในเทรดหลัก

## เอกสารที่เกี่ยวข้อง

- [[feature-list]] — รายการฟีเจอร์ที่ prototype นี้ครอบคลุมครบทั้งหมด
- [[user-journey]] — flow การใช้งานที่กำหนดลำดับหน้าจอ
- [[DESIGN.md]] — Design System ต้นทางของ token/component ทั้งหมดที่ใช้ในไฟล์นี้
- [[backlog]] — สรุป FR/NFR ทั้งหมดของโปรเจกต์
