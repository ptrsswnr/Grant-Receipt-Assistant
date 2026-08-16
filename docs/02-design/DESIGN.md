# Grant Receipt Assistant — Design System

> ปรับจาก ZenGrid Design System (ผู้ใช้แนบมาให้เป็นฐาน) — คงโทนสี/typography/spacing/component
> เดิมไว้เกือบทั้งหมด ปรับเฉพาะจุดที่จำเป็นต่อโดเมนนี้: (1) remap สีสถานะให้ตรงกับสถานะใบเสร็จ
> ของระบบนี้แทน Published/Draft/Archived/Removed เดิม (2) เพิ่ม component เฉพาะโดเมนที่ ZenGrid
> ไม่มี (3) เพิ่มหัวข้อ Accessibility ตาม [[20260816-01-grant-receipt-verification#5. Non-Functional Requirements|NFR-02]]
> ที่กำหนดว่ากลุ่มเป้าหมายไม่มีพื้นฐานการเงิน ต้องสื่อสารด้วยภาษา/UI ที่เข้าใจง่ายเป็นพิเศษ

## Overview

Grant Receipt Assistant ใช้โทนเรียบ สงบ อ่านง่าย (คงคอนเซปต์ "quiet, warm grid" ของ ZenGrid)
เพราะกลุ่มเป้าหมายหลักคือนักวิจัยที่ไม่มีพื้นฐานด้านการเงิน/บัญชี ([[20260816-01-grant-receipt-verification#6. สมมติฐาน/ข้อจำกัด (Assumptions & Constraints)]])
การออกแบบจึงเน้นความชัดเจนของสถานะ (ผ่าน/ต้องแก้ไข/ไม่เข้าเงื่อนไข) มากกว่าความหวือหวา ไม่มีเงา
ไม่มีสีฉูดฉาด ใช้ grid ที่มีจังหวะสม่ำเสมอ และให้เนื้อหา (ใบเสร็จ, คำอธิบายผลตรวจ) เป็นจุดสนใจหลัก
ของทุกหน้าจอ

---

## Colors

- **Stone** (#78716C): ข้อความหลัก, หัวข้อ
- **Sage** (#A8A29E): ข้อความรอง, เส้นขอบ
- **Warm White** (#FAF9F6): พื้นหลัง, surface
- **Surface Base** (#FAF9F6): พื้นหลังแอปทั้งหมด
- **Surface Sunken** (#F5F4F1): พื้นหลังของ input/dropzone (จมลงจาก surface base เล็กน้อย)
- **Success** (#65A30D): สถานะ **ผ่าน**
- **Warning** (#CA8A04): สถานะ **ต้องแก้ไข**
- **Error** (#DC2626): สถานะ **ไม่เข้าเงื่อนไข**
- **Pending** (#A8A29E ที่ 15% opacity fill / #78716C text): สถานะ **รอตรวจสอบ** (ระหว่าง OCR/Rule Engine กำลังประมวลผล)
- **Info** (#78716C): ข้อความให้ข้อมูล/คำอธิบายทั่วไป (ใช้สี stone)

> **หมายเหตุ Accessibility**: ต้องตรวจสอบ contrast ratio ของ Stone (#78716C) บนพื้นหลัง Warm White
> (#FAF9F6) จริงก่อนใช้กับข้อความเนื้อหาหลักขนาดเล็ก (body 15px) — ถ้าต่ำกว่า WCAG AA (4.5:1)
> ให้ปรับเป็นเฉดที่เข้มขึ้น (เช่น #57534E) สำหรับข้อความเนื้อหา คงค่าสี Stone เดิมไว้ได้เฉพาะ heading
> ขนาดใหญ่ (ดูหัวข้อ Accessibility ด้านล่าง)

## Typography

- **Headline Font**: Raleway
- **Body Font**: DM Sans
- **Mono Font**: Fira Code

- **h1**: Raleway 40px light, 1.15 line height
- **h2**: Raleway 32px light, 1.2 line height
- **h3**: Raleway 24px medium, 1.25 line height
- **h4**: Raleway 18px medium, 1.35 line height
- **body**: DM Sans 15px regular, 1.7 line height
- **small**: DM Sans 13px regular, 1.6 line height
- **tiny**: DM Sans 11px medium, 1.4 line height
- **mono**: Fira Code 13px regular, 1.6 line height (ใช้กับตัวเลขยอดเงิน/รหัสอ้างอิงระเบียบ เพื่อให้ตัวเลขอ่านง่าย ไม่บิดเบือน)

> **กฎเฉพาะโปรเจกต์นี้ (จาก NFR-02)**: คำอธิบายผลตรวจจาก LLM และข้อความ error ทุกจุดต้องใช้ระดับ
> `body` เป็นอย่างน้อย (ห้ามใช้ `small`/`tiny` กับคำอธิบายที่กระทบการตัดสินใจของนักวิจัย เช่น
> เหตุผลที่ใบเสร็จไม่ผ่าน) เพื่อไม่ให้ข้อความสำคัญเล็กเกินไปจนถูกมองข้าม

---

## Spacing

Base unit: 12px (spacious)
- **sp-1**: 6px
- **sp-2**: 12px
- **sp-3**: 24px
- **sp-4**: 36px
- **sp-5**: 48px
- **sp-6**: 72px
- **sp-7**: 96px
- **sp-8**: 120px

## Border Radius

- **radius-sm** (2px): องค์ประกอบเล็ก, badge แบบ inline
- **radius-md** (4px): การ์ด, input, ปุ่ม
- **radius-lg** (6px): modal
- **radius-none** (0px): รูปภาพ, ส่วนแบบ full-bleed

## Elevation

ไม่มีเงา (no shadows) ทั้งระบบ ความลึกทางสายตาเกิดจากการเปลี่ยนพื้นหลังและระยะห่างเท่านั้น
- **shadow-none**: ไม่มีเงาทุกองค์ประกอบ
การแบ่งส่วนแสดงผลผ่านเส้นขอบ (border-default) และการสลับพื้นหลังระหว่าง surface-base กับ
surface-raised

---

## Components

### Buttons

ปุ่มทุกแบบใช้มุมโค้ง 4px (radius-md)

- **Primary (Stone)**: พื้น Stone (#78716C) ตัวอักษรขาว (#FFFFFF) ไม่มีขอบ DM Sans medium (500) hover เข้มขึ้นเป็น #57534E, active เข้มขึ้นอีกเป็น #44403C มีขนาด small (ตัวอักษร 12px, สูง 32px, padding 6px 16px), medium (ตัวอักษร 14px, สูง 40px, padding 10px 20px), large (ตัวอักษร 15px, สูง 48px, padding 14px 28px)
- **Secondary**: พื้นโปร่งใส ตัวอักษรสี content-primary ขอบหนา 1px hover เติมพื้นหลัง surface-sunken
- **Ghost**: พื้นโปร่งใส ตัวอักษรสี content-secondary ไม่มีขอบ hover เปลี่ยนตัวอักษรเป็น content-primary
- **Destructive**: พื้นแดง (#DC2626) ตัวอักษรขาว (#FFFFFF) ไม่มีขอบ hover เข้มขึ้นเป็น #B91C1C (ใช้กับปุ่มลบข้อมูล/ถอนความยินยอม — FR-16/FR-18/FR-20)

ปุ่มที่ disabled ลด opacity เหลือ 0.35 พร้อม cursor แบบ disabled (ใช้กับปุ่ม Export เมื่อไม่มีใบเสร็จผ่าน — FR-21)

### Cards

- **Default**: พื้นขาว (#FFFFFF) surface ยกขึ้น ขอบ 1px แบบ default มุมโค้ง 4px padding 36px ไม่มีเงา
- **Elevated**: พื้นขาว (#FFFFFF) surface ยกขึ้น ขอบ 1px แบบหนา มุมโค้ง 4px padding 48px ไม่มีเงา แยกจาก Default ด้วยน้ำหนักเส้นขอบ

### Inputs

Input วางบน surface สีจม (#F5F4F1) มุมโค้ง 4px padding 10px 14px ตัวอักษร DM Sans 15px regular (400) สี content-primary ขอบ 1px สี default

สถานะปกติไม่มีเงา hover ขอบเข้มขึ้นเป็น border-strong focus ขอบเปลี่ยนเป็น border-focus สถานะ error ขอบเป็นสีแดง (error) ไม่มีเงาในทุกสถานะ เมื่อ disabled ขอบกลับเป็น default และ opacity ลดเหลือ 0.35

Label ใช้ DM Sans 12px medium (500) สี content-secondary margin ล่าง 6px ข้อความช่วยเหลือใช้ DM Sans 11px regular (400) สี content-tertiary margin บน 4px ข้อความ error ใช้สี error

### Chips

- **Filter**: พื้นโปร่งใส ตัวอักษรสี content-secondary ขอบ 1px แบบ default มุมโค้ง 4px padding 4px 12px เมื่อ active พื้นเปลี่ยนเป็น stone ตัวอักษรเป็นสีขาว (#FFFFFF)
- **Status** (สถานะใบเสร็จ — FR-06): มุมโค้ง 4px ตัวอักษร 11px medium (500) padding 3px 10px
  - **ผ่าน**: พื้น #65A30D ที่ 8% opacity ตัวอักษร #65A30D
  - **ต้องแก้ไข**: พื้น #CA8A04 ที่ 8% opacity ตัวอักษร #CA8A04
  - **ไม่เข้าเงื่อนไข**: พื้น #DC2626 ที่ 8% opacity ตัวอักษร #DC2626
  - **รอตรวจสอบ**: พื้น #A8A29E ที่ 15% opacity ตัวอักษร #78716C

### Lists

พื้นหลังโปร่งใส เส้นแบ่ง 1px สี default แต่ละรายการ padding 12px 16px ตัวอักษร 15px สี content-secondary hover พื้นหลังเปลี่ยนเป็น surface-sunken แถวที่ active เติมพื้น stone จางๆ (6% opacity) มีองค์ประกอบท้ายแถว เช่น timestamp และ chevron

### Checkboxes

สี่เหลี่ยม 16px มุมโค้ง 2px ขอบหนา 1px พื้นที่ยังไม่ติ๊กคือ surface-raised เมื่อติ๊กแล้วพื้นเป็นสี stone พร้อมเครื่องหมายถูกสีขาว (#FFFFFF) หนา 1.5px focus แสดงกรอบ 2px สี border-focus ห่างออก 2px disabled ลด opacity เหลือ 0.35

### Radio Buttons

วงกลม 16px ขอบหนา 1px พื้นที่ยังไม่เลือกคือ surface-raised เมื่อเลือกแล้วขอบเปลี่ยนเป็นสี stone พร้อมจุดตรงกลางสี stone ขนาด 6px focus แสดงกรอบ 2px สี border-focus ห่างออก 2px disabled ลด opacity เหลือ 0.35

### Tooltips

พื้นหลังเข้ม (#44403C) ตัวอักษรขาว (#FFFFFF) ขนาด 12px มุมโค้ง 2px padding 5px 10px ไม่มีเงา มีลูกศร 4px สีเดียวกับพื้นหลัง กว้างสูงสุด 200px แสดงหลัง 400ms ซ่อนหลัง 100ms

### File Upload / Dropzone _(ใหม่ — สำหรับ FR-01)_

พื้นที่ลากวางไฟล์ ขนาดเต็มความกว้างของ container สูงอย่างน้อย 200px พื้น surface-sunken (#F5F4F1) ขอบเส้นประ (dashed) 2px สี sage มุมโค้ง 4px มีไอคอนอัปโหลดตรงกลาง + ข้อความ body บอกประเภทไฟล์ที่รองรับ (jpg/png/PDF — FR-01) เมื่อลากไฟล์เข้ามา (dragover) ขอบเปลี่ยนเป็นเส้นทึบสี stone และพื้นเปลี่ยนเป็น stone ที่ 4% opacity สถานะ error (ไฟล์ไม่ผ่าน validation — FR-19) ขอบเปลี่ยนเป็นสีแดง (error) พร้อมข้อความ error ระดับ `body` ใต้ dropzone (ไม่ใช้ `small` ตามกฎ NFR-02 ด้านบน)

### Receipt Card _(ใหม่ — สำหรับ FR-06/FR-08)_

การ์ดแนวนอน แสดง thumbnail ใบเสร็จ (หรือไอคอนไฟล์ถ้าเป็น PDF) ทางซ้าย ตรงกลางแสดงยอดเงิน (mono font), วันที่, หมวดค่าใช้จ่าย ทางขวาแสดง Status Chip (ผ่าน/ต้องแก้ไข/ไม่เข้าเงื่อนไข/รอตรวจสอบ) ใช้ Card แบบ Default เป็นฐาน คลิกทั้งการ์ดเพื่อเปิดดูรายละเอียด/คำอธิบายผลตรวจ

### Rule Explanation Callout _(ใหม่ — สำหรับ FR-05/FR-06/NFR-02/NFR-03)_

กล่องคำอธิบายผลตรวจจากระบบ (Rule Engine + LLM) ใช้ Card แบบ Elevated เป็นฐาน มีแถบสีด้านซ้ายหนา 4px ตามสี status (success/warning/error) เนื้อหาแบ่ง 2 ส่วนเสมอ: (1) คำอธิบายภาษาที่เข้าใจง่าย ระดับ `body` ไม่ใช้ศัพท์การเงินโดยไม่อธิบาย (2) ส่วนอ้างอิงระเบียบที่ใช้ตัดสิน ระดับ `small` สี content-tertiary พร้อมไอคอน "อ้างอิง" — ต้องมีเสมอทุกครั้งที่แสดงผลตรวจ ห้ามละไว้ (ตาม NFR-03 Explainability)

### Consent / Privacy Notice Banner _(ใหม่ — สำหรับ FR-13/FR-14)_

แสดงเป็น modal เต็มความสูงหน้าจอ (ไม่ใช่ banner เล็กที่ปิดง่าย) เมื่อเข้าใช้งานครั้งแรก ใช้ Card แบบ Elevated พื้นหลัง overlay สีเข้ม 40% opacity ด้านหลัง เนื้อหาระดับ `body` ปุ่มยืนยัน/ปฏิเสธใช้ Primary/Ghost button ตามลำดับ วางคู่กันด้านล่าง (ปุ่มยืนยันอยู่ขวา) ห้ามปิด modal นี้ด้วยการคลิกนอกกรอบหรือกด Esc (ต้องเลือกตัวเลือกใดตัวเลือกหนึ่งเท่านั้น เพราะเป็น legal consent gate)

### Stepper _(ใหม่ — สำหรับ flow อัปโหลด→ตรวจสอบ→ส่งตรวจ)_

แสดงขั้นตอนแนวนอน 3-4 จุด เชื่อมด้วยเส้นสี sage จุดที่เสร็จแล้วเติมสี stone พร้อมเครื่องหมายถูกขาว จุดปัจจุบันมีขอบ 2px สี stone พื้นขาว จุดที่ยังไม่ถึงเป็น surface-sunken ข้อความกำกับใต้แต่ละจุดระดับ `tiny`

### Stat Tile _(ใหม่ — สำหรับ Dashboard FR-08)_

การ์ดสี่เหลี่ยมขนาดเล็ก ใช้ Card แบบ Default ตัวเลขหลักใช้ h2/h3 พร้อม label ใต้ตัวเลขระดับ `small` สี content-secondary ใช้สีตัวเลขตามความหมาย (ผ่าน=success, ต้องแก้ไข=warning, ไม่เข้าเงื่อนไข=error) จัดเรียงเป็นแถวแนวนอน 3-4 tile ต่อแถว

---

## Do's and Don'ts

1. **ทำ**: ให้ grid กำหนดทุกการจัดวาง ไม่มีองค์ประกอบใดควรทำลายจังหวะของคอลัมน์
2. **ห้าม**: ใส่สีนอกกลุ่ม stone/sage/semantic (success/warning/error/pending) กับองค์ประกอบ UI
3. **ทำ**: ใช้ heading น้ำหนักเบา (300) สำหรับ H1/H2 เพื่อรักษาความรู้สึกสงบ
4. **ห้าม**: ใส่เงาหรือ glow การแบ่งส่วนมาจากขอบและการเปลี่ยนพื้นหลังเท่านั้น
5. **ทำ**: เว้นระยะแนวตั้งระหว่าง section หลักแบบกว้าง (48-120px)
6. **ห้าม**: ใช้น้ำหนักตัวอักษรหนาหรือหนักเกินกับ body text (400-500 มากที่สุด)
7. **ทำ**: เก็บภาพให้เรียบ ไม่มีขอบ ไม่มีมุมโค้ง ไม่มี overlay (ยกเว้น thumbnail ใบเสร็จใน Receipt Card ที่ใช้ radius-sm เพื่อให้ดูเป็นชิ้นเอกสาร)
8. **ห้าม**: จัดกึ่งกลางข้อความยาวเป็นบล็อกใหญ่ ให้ชิดซ้ายเสมอเพื่อการอ่านที่ลื่นไหล
9. **ทำ**: ใช้ content-tertiary กับ timestamp และ metadata เพื่อให้ดูรองลงมา
10. **ห้าม**: ใช้สี semantic (success/warning/error) เพื่อการตกแต่ง สงวนไว้เฉพาะสถานะที่มีความหมายจริงเท่านั้น
11. **ทำ** _(เฉพาะโปรเจกต์นี้)_: อธิบายผลตรวจทุกครั้งด้วยภาษาที่ไม่ใช้ศัพท์การเงิน/บัญชีโดยไม่มีคำอธิบายประกอบ (ตาม NFR-02) — ห้ามแสดงแค่ status chip โดยไม่มี Rule Explanation Callout กำกับ
12. **ทำ** _(เฉพาะโปรเจกต์นี้)_: ทุกจุดที่มีผลตรวจต้องมีการอ้างอิงระเบียบที่ใช้ตัดสิน (ตาม NFR-03) แสดงเป็นส่วนหนึ่งของ Rule Explanation Callout เสมอ

---

## Accessibility

- **Contrast**: ข้อความ body ต้องผ่าน WCAG AA (อัตราส่วนคอนทราสต์อย่างน้อย 4.5:1) กับพื้นหลังที่วางอยู่ — ตรวจสอบสี Stone (#78716C) บน Warm White (#FAF9F6) ก่อนใช้จริง ถ้าไม่ผ่านให้ใช้เฉดเข้มกว่า (#57534E) กับข้อความเนื้อหา
- **Touch target**: ปุ่มและองค์ประกอบที่กดได้ต้องมีขนาดขั้นต่ำ 44x44px (ปุ่มขนาด small ที่สูง 32px ต้องมี padding แนวตั้งเพิ่มเมื่อใช้บนอุปกรณ์สัมผัส หรือสงวนไว้เฉพาะบริบท desktop เท่านั้น)
- **Focus indicator**: ทุกองค์ประกอบที่ interactive ต้องมี focus state ที่มองเห็นชัด (border-focus 2px ตามที่กำหนดไว้ใน checkbox/radio/input) ไม่ลบ outline โดยไม่มีสิ่งทดแทน
- **ภาษาเรียบง่าย** _(กฎเฉพาะโปรเจกต์นี้ ตาม NFR-02)_: ข้อความในระบบทั้งหมด (label, error message, คำอธิบายผลตรวจ) ต้องเขียนในระดับที่คนไม่มีพื้นฐานการเงิน/บัญชีเข้าใจได้ทันที หลีกเลี่ยงศัพท์เฉพาะทางบัญชี-การเงินโดยไม่มีคำอธิบายกำกับ

## เอกสารที่เกี่ยวข้อง

- [[feature-list]] — รายการฟีเจอร์ที่ prototype ต้องครอบคลุม
- [[user-journey]] — flow การใช้งานที่กำหนดลำดับหน้าจอ
- [[20260816-01-grant-receipt-verification]] — NFR-02 (Usability), NFR-03 (Explainability) ที่กำหนดกฎเฉพาะโปรเจกต์นี้ในเอกสารนี้
