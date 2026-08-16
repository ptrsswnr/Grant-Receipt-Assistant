# Test Plan — Grant Receipt Assistant

เอกสารเดียวต่อโปรเจกต์ สรุปภาพรวมกลยุทธ์การทดสอบทั้งหมดของ **Grant Receipt Assistant** อ้างอิง
[[feature-list]], [[user-journey]], [[backlog]] และเอกสาร spec ต้นทาง
([[20260816-01-grant-receipt-verification]], [[20260816-02-pdpa-compliance]]) รายละเอียดเกณฑ์
ยอมรับต่อ FR/NFR แต่ละตัวอยู่ที่ [[acceptance-criteria]] และ test case แบบ step-by-step ต่อฟีเจอร์
อยู่ที่ไฟล์ใน `test-cases/`

> หมายเหตุสถานะโปรเจกต์: ณ ตอนที่เขียนเอกสารนี้ **ยังไม่มีซอร์สโค้ดของระบบ** เอกสารนี้จึงเป็นแผนกล
> ยุทธ์การทดสอบที่เตรียมไว้ล่วงหน้าก่อนเริ่มพัฒนา ไม่ใช่ผลการรันทดสอบจริง (ผลการรันทดสอบจริงจะถูก
> บันทึกใน `docs/03-testing/02-test-result/` เมื่อมีซอร์สโค้ดให้ทดสอบแล้ว)

## 1. Scope (ขอบเขตการทดสอบ)

### 1.1 อยู่ในขอบเขต

ทดสอบครบทั้ง 12 ฟีเจอร์ตาม [[feature-list]] (จัดกลุ่มจาก FR-01–FR-21 และ NFR-01–NFR-11 ใน
[[backlog]]):

| #   | ฟีเจอร์                                                                | MoSCoW      | บทบาทผู้ใช้                          |
| --- | ------------------------------------------------------------------------ | ----------- | ------------------------------------- |
| 1   | อัปโหลดใบเสร็จและอ่านข้อมูลอัตโนมัติด้วย OCR                            | Must have   | นักวิจัย/เจ้าของทุน                  |
| 2   | ตรวจสอบและแก้ไขข้อมูลก่อนส่งตรวจ                                        | Must have   | นักวิจัย/เจ้าของทุน                  |
| 3   | ตรวจสอบใบเสร็จด้วย Rule Engine พร้อมคำอธิบายจาก LLM                     | Must have   | นักวิจัย/เจ้าของทุน                  |
| 4   | แก้ไขและส่งใบเสร็จที่ไม่ผ่านตรวจซ้ำ                                     | Must have   | นักวิจัย/เจ้าของทุน                  |
| 5   | Dashboard สรุปภาพรวมใบเสร็จของทุน                                       | Should have | นักวิจัย/เจ้าของทุน                  |
| 6   | แจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่                                      | Should have | นักวิจัย/เจ้าของทุน                  |
| 7   | Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว                                 | Must have   | นักวิจัย/เจ้าของทุน                  |
| 8   | นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine (Admin)                 | Must have   | Admin (ผู้ดูแลระบบ/ผู้อัปเดตระเบียบ) |
| 9   | จำกัดสิทธิ์การเข้าถึงข้อมูลตามเจ้าของ (Access Control)                  | Must have   | นักวิจัย/เจ้าของทุน, Admin           |
| 10  | แจ้ง Privacy Notice และจัดการความยินยอม (Consent Management)           | Must have   | นักวิจัย/เจ้าของทุน                  |
| 11  | ขอเข้าถึง/ขอสำเนาข้อมูลส่วนบุคคลของตนเอง (Data Access & Portability)    | Should have | นักวิจัย/เจ้าของทุน                  |
| 12  | ลบข้อมูลใบเสร็จของตนเองด้วยตนเอง (Right to Erasure)                     | Must have   | นักวิจัย/เจ้าของทุน                  |

รวม 7 user journey ตาม [[user-journey]]:
1. นักวิจัยอัปโหลดใบเสร็จและตรวจสอบผลจนผ่านเกณฑ์ (รวม consent gate ครั้งแรก)
2. นักวิจัยติดตามภาพรวมทุนและจัดการใบเสร็จที่มีปัญหาผ่าน Dashboard และการแจ้งเตือน
3. นักวิจัย Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้วเพื่อยื่นเจ้าหน้าที่การเงิน
4. Admin นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine
5. นักวิจัยถอนความยินยอม (Withdraw Consent) และผลกระทบต่อการใช้งานระบบ
6. นักวิจัยขอเข้าถึง/ขอสำเนาข้อมูลส่วนบุคคลของตนเอง (Data Access & Portability)
7. นักวิจัยลบข้อมูลใบเสร็จของตนเองด้วยตนเอง (Right to Erasure)

### 1.2 นอกขอบเขต (Out of Scope)

ตาม [[backlog#รายการที่ตัดออกจากขอบเขต (Out of Scope — เพื่ออ้างอิง ไม่ใช่ backlog item)]]
รายการต่อไปนี้**ไม่มี**ในระบบและ**ไม่ต้องทดสอบ**เพราะไม่มี role/action ใดๆ รองรับเลย:

- บทบาท/action ของ "เจ้าหน้าที่การเงิน" ในระบบ (รับไฟล์ export ภายนอกระบบเท่านั้น)
- บทบาท/workflow ของ "ผู้อนุมัติทุน" ในระบบ
- Deadline tracking รายทุน และการแจ้งเตือนที่อิงกำหนดเวลาส่งหลักฐาน

นอกจากนี้ รายการต่อไปนี้เป็น **Open Point ที่ยังไม่ปิด** (ดู
[[backlog#Open Point ที่ยังไม่ปิดจากเอกสาร PDPA (เพื่ออ้างอิง — ไม่บล็อกการพัฒนา)]]) — ยังไม่มี
พฤติกรรมที่ยืนยันแล้วให้เขียน test case ทดสอบได้ในรอบนี้:

- ที่ตั้งผู้ให้บริการ OCR/LLM จริง (กระทบ NFR-08 cross-border transfer) — ทดสอบเมื่อมีการตัดสินใจ
  vendor แล้วเท่านั้น
- ตัวเลขระยะเวลาเก็บข้อมูล (retention) ตาม NFR-11 — ยังเป็น TBD

> **อัปเดต 2026-08-16:** ประเด็นต่อไปนี้ที่เคยเป็น Open Point/`NEEDS_NEW_REQUIREMENT` ในรอบก่อน
> **ปิดแล้ว** ด้วยรหัส FR ใหม่ที่ finalize แล้ว และมี test case ครอบคลุมในรอบนี้:
> - พฤติกรรมระบบต่อข้อมูลที่เคยประมวลผลไปแล้วก่อนนักวิจัยถอนความยินยอม → ปิดด้วย **FR-20** (ดู
>   [[test-cases/consent-management|consent-management.md]])
> - พฤติกรรมของปุ่ม Export เมื่อทุนยังไม่มีใบเสร็จสถานะผ่านเลย → ปิดด้วย **FR-21** (ดู
>   [[test-cases/export-verified-report|export-verified-report.md]])
> - พฤติกรรมของระบบเมื่ออัปโหลดไฟล์ประเภทที่ไม่รองรับ/ไฟล์เสีย/เกินขนาด → ปิดด้วย **FR-19** (ดู
>   [[test-cases/receipt-upload-ocr|receipt-upload-ocr.md]])

## 2. ประเภทการทดสอบ (Test Types)

### 2.1 Functional Testing (ต่อกลุ่ม FR)

ทดสอบตาม test case ใน `test-cases/{feature-slug}.md` แต่ละไฟล์ ครอบคลุม happy path (จาก
[[user-journey]]) และ negative/edge case (จาก [[acceptance-criteria]]) ของ FR-01–FR-21 ทั้งหมด
แบ่งตามกลุ่มฟีเจอร์:

- **OCR/อัปโหลด** (FR-01, FR-02, FR-19): ทดสอบการอัปโหลดไฟล์ถูกชนิด, การอ่านข้อมูลอัตโนมัติ, และ
  การตรวจสอบ/ปฏิเสธไฟล์ที่ไม่ถูกต้อง (ชนิดไฟล์ผิด/ไฟล์เสียหาย/เกินขนาด — FR-19)
- **ตรวจสอบ/แก้ไขข้อมูล** (FR-03): ทดสอบการแก้ไขค่าที่ OCR อ่านผิดก่อนส่งตรวจ
- **Rule Engine + LLM** (FR-04, FR-05, FR-06): ทดสอบผลตัดสินทั้ง 3 สถานะ (ผ่าน/ต้องแก้ไข/ไม่เข้า
  เงื่อนไข) และคำอธิบายจาก LLM ต้องไม่เปลี่ยนผลตัดสินของ Rule Engine
- **แก้ไข/ส่งซ้ำ** (FR-07): ทดสอบ loop กลับเข้า Rule Engine จนกว่าจะผ่าน
- **Dashboard/แจ้งเตือน** (FR-08, FR-09): ทดสอบการสรุปจำนวนตามสถานะ และการแจ้งเตือนเมื่อมีใบเสร็จ
  ค้าง
- **Export** (FR-10, FR-21): ทดสอบการสร้างรายงาน, เงื่อนไขล็อกการลบหลัง export, และการปิดปุ่ม Export
  เมื่อยังไม่มีใบเสร็จสถานะผ่านเลย (FR-21)
- **Admin/Rule Import** (FR-11): ทดสอบการนำเข้าระเบียบใหม่ไม่กระทบ LLM
- **Access Control** (FR-12): ทดสอบว่าแต่ละบทบาทเห็นเฉพาะข้อมูลที่ได้รับอนุญาต
- **PDPA — Consent** (FR-13, FR-14, FR-15, FR-16, FR-20): ทดสอบ flow Privacy Notice → consent →
  บันทึกหลักฐาน → ถอน consent → ลบข้อมูลทั้งหมดทันทีเมื่อถอนความยินยอม (FR-20)
- **PDPA — Data Subject Rights** (FR-17, FR-18): ทดสอบขอสำเนาข้อมูล และลบข้อมูลตามเงื่อนไข

### 2.2 Non-Functional Testing (ต่อ NFR แต่ละด้าน)

| ด้าน | NFR ที่เกี่ยวข้อง | ประเภทการทดสอบ | หมายเหตุ |
|------|---------------------|-------------------|----------|
| Localization | NFR-01 | Localization Testing | ตรวจว่า OCR และคำอธิบาย LLM รองรับภาษาไทยเต็มรูปแบบ |
| Usability | NFR-02 | Usability Testing | ตรวจว่าคำอธิบายผลตรวจเข้าใจง่ายสำหรับผู้ไม่มีพื้นฐานการเงิน (ควรทำร่วมกับผู้ใช้จริง/ตัวแทนกลุ่มเป้าหมาย) |
| Explainability | NFR-03 | Functional/Compliance Testing | ตรวจว่าทุกผลตรวจมีข้อระเบียบอ้างอิงเสมอ ไม่มีผลตรวจที่ไม่มีเหตุผล |
| Audit Trail | NFR-04 | Audit/Traceability Testing | ตรวจว่าระบบบันทึกกฎ/เวอร์ชันระเบียบ/ผลลัพธ์ต่อใบเสร็จ และเวอร์ชันระเบียบที่ Admin นำเข้า |
| Security/Access Control | NFR-05 | Security Testing | ตรวจสอบการเข้าถึงข้ามบัญชี/ข้ามบทบาทต้องถูกปฏิเสธเสมอ |
| Performance | NFR-06 | Performance Testing | เวลาในการประมวลผล OCR/Rule Engine — **ยังไม่มีตัวเลขเป้าหมายที่ยืนยันแล้ว** ทดสอบเชิง smoke (ไม่ค้าง/ไม่ timeout) ก่อน กำหนดเกณฑ์ตัวเลขเมื่อมีการยืนยันเพิ่มเติม |
| Scalability | NFR-07 | Load/Scalability Testing | ปริมาณใบเสร็จ/ผู้ใช้พร้อมกัน — **ยังไม่มีตัวเลขเป้าหมายที่ยืนยันแล้ว** เช่นเดียวกับ NFR-06 |
| Cross-border Data Transfer | NFR-08 | Compliance/Security Testing (Conditional) | ทดสอบเมื่อมีการตัดสินใจ vendor OCR/LLM แล้วเท่านั้น — ปัจจุบันเป็นรายการตรวจสอบ (checklist) ไม่ใช่ functional test |
| Data Processing Agreement | NFR-09 | Compliance Review (Organizational) | ตรวจสอบเอกสาร ไม่ใช่ functional test ของระบบ |
| Data Breach Notification | NFR-10 | Compliance/Process Review (Organizational) | ตรวจสอบกระบวนการ ไม่ใช่ functional test ของระบบ |
| Data Retention & Deletion | NFR-11 | Compliance Testing | ตรวจว่าเนื้อหา Privacy Notice อ้างอิงนโยบาย retention และเงื่อนไขจำกัดการลบ (FR-18) ถูกบังคับใช้จริง — ตัวเลข retention เองยังเป็น TBD |

## 3. Environment (สภาพแวดล้อมการทดสอบ)

`docs/02-design/02-technical/technology-stack.md` **ยังไม่มีไฟล์/ยังไม่มีการตัดสินใจ tech stack
ใดๆ ในโปรเจกต์นี้** ดังนั้น **รอกำหนด tech stack ก่อน** จึงจะสามารถระบุ environment การทดสอบจริง
(เช่น browser ที่รองรับ, ระบบปฏิบัติการ, วิธี deploy test environment, เครื่องมือ automation ที่ใช้)
ได้ ห้ามสมมติ stack ใดๆ ไว้ล่วงหน้าในเอกสารนี้ (ตามกฎของโปรเจกต์ที่ระบุใน `CLAUDE.md`) — เมื่อมีการ
ตัดสินใจ tech stack แล้ว ให้กลับมาเติมหัวข้อนี้ด้วยรายละเอียด: ประเภท environment (dev/staging/UAT),
เครื่องมือทดสอบอัตโนมัติที่เลือกใช้ (ถ้ามี), และข้อมูลทดสอบ (test data) จำลองใบเสร็จภาษาไทยตัวอย่าง

## 4. Entry Criteria (เกณฑ์เริ่มทดสอบ)

- มีซอร์สโค้ด/build ของฟีเจอร์ที่จะทดสอบพร้อมใช้งานใน environment ทดสอบแล้ว
- FR/NFR ที่เกี่ยวข้องมีสถานะ "Backlog" หรือสูงกว่าใน [[backlog]] (ไม่ใช่รายการที่ถูกตัดออกจาก
  ขอบเขตหรือยังเป็น TBD ที่ไม่มีตัวเลข/พฤติกรรมยืนยันแล้ว)
- [[acceptance-criteria]] ของฟีเจอร์นั้นเขียนเสร็จและอ้างอิงรหัส FR/NFR ที่ถูกต้องครบถ้วนแล้ว
- Test case ในไฟล์ `test-cases/{feature-slug}.md` ที่เกี่ยวข้องเขียนเสร็จและตรวจทานแล้ว
- ข้อมูลทดสอบ (test data) เช่น ใบเสร็จภาษาไทยตัวอย่าง (ผ่าน/ไม่ผ่านเงื่อนไขต่างๆ), บัญชีทดสอบ 2
  บทบาท (นักวิจัย/Admin) พร้อมใช้งาน

## 5. Exit Criteria (เกณฑ์ผ่านการทดสอบ)

- Test case ที่ผูกกับ FR/NFR ระดับความสำคัญ "สูง" (Must have) ทั้งหมดต้องผ่าน 100% ก่อนปล่อยใช้งาน
  จริง (MVP)
- Test case ที่ผูกกับ FR ระดับ "กลาง" (Should have) ผ่านอย่างน้อย 90% หรือมีแผนแก้ไข defect ที่เหลือ
  ก่อนปล่อยใช้งานจริง
- ไม่มี defect ระดับ Critical/High ที่ยังเปิดอยู่ในฟีเจอร์ด้าน Security/Access Control (FR-12,
  NFR-05) และ PDPA (FR-13–FR-18, NFR-08–NFR-11) เนื่องจากกระทบข้อกำหนดทางกฎหมายโดยตรง
- ผลการรันทดสอบถูกบันทึกไว้ใน `docs/03-testing/02-test-result/` ครบถ้วน (เมื่อมีซอร์สโค้ดให้ทดสอบ
  จริงแล้ว)

## 6. บทบาทผู้ทดสอบ (Test Roles)

ตาม [[20260816-01-grant-receipt-verification#3. บทบาทผู้ใช้ (User Roles)]] ระบบมี 2 บทบาทเท่านั้น
จึงต้องมีบัญชีทดสอบครบทั้ง 2 บทบาทเสมอ:

- **นักวิจัย/เจ้าของทุน** (ผู้ใช้หลัก): ทดสอบฟีเจอร์ที่ 1–7, 9 (ฝั่งนักวิจัย), 10–12 ทั้งหมด — ควรมี
  บัญชีทดสอบอย่างน้อย 2 บัญชีเพื่อทดสอบ Access Control (FR-12) ว่าเห็นข้อมูลแยกจากกันจริง
- **Admin (ผู้ดูแลระบบ/ผู้อัปเดตระเบียบ)**: ทดสอบฟีเจอร์ที่ 8 และฝั่ง Admin ของฟีเจอร์ที่ 9 (ต้อง
  ยืนยันว่าเข้าถึงข้อมูลใบเสร็จส่วนบุคคลของนักวิจัยไม่ได้จริง)

ไม่มีบทบาท "เจ้าหน้าที่การเงิน" หรือ "ผู้อนุมัติทุน" ให้ทดสอบ เพราะไม่มี role/login ในระบบ (ดูหัวข้อ
1.2)

## 7. ตารางสรุปฟีเจอร์ ↔ ไฟล์ test case ↔ จำนวน AC ที่ครอบคลุม

| #   | ฟีเจอร์                                                                | ไฟล์ test case                                                          | รหัส FR/NFR                                                                  | จำนวน AC ที่ครอบคลุม |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------- |
| 1   | อัปโหลดใบเสร็จและอ่านข้อมูลอัตโนมัติด้วย OCR                            | [[test-cases/receipt-upload-ocr\|receipt-upload-ocr.md]]                   | FR-01, FR-02, FR-19, NFR-01, NFR-06, NFR-07, NFR-08, NFR-09                   | 13                     |
| 2   | ตรวจสอบและแก้ไขข้อมูลก่อนส่งตรวจ                                        | [[test-cases/review-edit-ocr-data\|review-edit-ocr-data.md]]               | FR-03                                                                          | 2                      |
| 3   | ตรวจสอบใบเสร็จด้วย Rule Engine พร้อมคำอธิบายจาก LLM                     | [[test-cases/rule-engine-verification\|rule-engine-verification.md]]       | FR-04, FR-05, FR-06, NFR-01, NFR-02, NFR-03, NFR-04, NFR-06, NFR-08, NFR-09 | 12                     |
| 4   | แก้ไขและส่งใบเสร็จที่ไม่ผ่านตรวจซ้ำ                                     | [[test-cases/resubmit-failed-receipt\|resubmit-failed-receipt.md]]         | FR-07                                                                          | 2                      |
| 5   | Dashboard สรุปภาพรวมใบเสร็จของทุน                                       | [[test-cases/fund-dashboard\|fund-dashboard.md]]                           | FR-08                                                                          | 2                      |
| 6   | แจ้งเตือนใบเสร็จที่มีปัญหาค้างอยู่                                      | [[test-cases/pending-issue-notification\|pending-issue-notification.md]]   | FR-09                                                                          | 2                      |
| 7   | Export รายงานสรุปใบเสร็จที่ผ่านตรวจแล้ว                                 | [[test-cases/export-verified-report\|export-verified-report.md]]          | FR-10, FR-21                                                                   | 4                      |
| 8   | นำเข้า/อัปเดตระเบียบทุนวิจัยเข้าสู่ Rule Engine (Admin)                 | [[test-cases/admin-rule-management\|admin-rule-management.md]]             | FR-11, NFR-04                                                                  | 2                      |
| 9   | จำกัดสิทธิ์การเข้าถึงข้อมูลตามเจ้าของ (Access Control)                  | [[test-cases/access-control\|access-control.md]]                           | FR-12, NFR-05, NFR-10                                                          | 5                      |
| 10  | แจ้ง Privacy Notice และจัดการความยินยอม (Consent Management)           | [[test-cases/consent-management\|consent-management.md]]                   | FR-13, FR-14, FR-15, FR-16, FR-20, NFR-11                                      | 9                      |
| 11  | ขอเข้าถึง/ขอสำเนาข้อมูลส่วนบุคคลของตนเอง (Data Access & Portability)    | [[test-cases/data-access-portability\|data-access-portability.md]]         | FR-17                                                                          | 2                      |
| 12  | ลบข้อมูลใบเสร็จของตนเองด้วยตนเอง (Right to Erasure)                     | [[test-cases/right-to-erasure\|right-to-erasure.md]]                       | FR-18, NFR-11                                                                  | 3                      |

## เอกสารที่เกี่ยวข้อง

- [[acceptance-criteria]] — เกณฑ์ยอมรับ (Given-When-Then) ต่อ FR/NFR ทุกตัว
- [[feature-list]] — รายการฟีเจอร์ทั้งหมดพร้อม MoSCoW
- [[user-journey]] — flow การใช้งานจริงที่ใช้ออกแบบ happy path ของ test case
- [[backlog]] — สรุป FR/NFR ทั้งหมดพร้อมระดับความสำคัญ
- [[20260816-01-grant-receipt-verification]], [[20260816-02-pdpa-compliance]] — เอกสาร spec ต้นทาง
