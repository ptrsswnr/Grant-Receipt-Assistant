# ACL.md — ใครเข้าถึงอะไรได้บ้าง (Firestore + Storage)

**สถานะ: `firestore.rules` deploy จริงแล้ว** (owner-scoped + admin read bypass ตามที่เอกสารนี้อธิบาย) — ตรวจสอบล่าสุด 2026-09-10 ด้วยบัญชีทดสอบจริง (ดู `docs/unauthorized-access-denied.png` เป็นหลักฐานว่าคำขอที่ไม่ได้ login โดน Firestore ปฏิเสธจริง) ส่วน `storage.rules` **ยังไม่ได้ deploy** เพราะ Firebase Storage เองยังไม่ได้ provision บนโปรเจกต์นี้ (ต้องอัปเกรด Blaze plan ก่อน — ดู `CLAUDE.md`) โค้ดรูลที่จะใช้ก็เขียนไว้พร้อมแล้วด้านล่าง

## สรุปสิทธิ์ตาม Role

| Role | ทำอะไรได้ (Can Do) | ทำอะไรไม่ได้ (Cannot Do) |
|---|---|---|
| **นักวิจัย** (Researcher — เจ้าของโครงการ/ผู้สร้างใบเสร็จ) | สร้าง/ดูโครงการวิจัยของตัวเอง (`projects.html`) · อัปโหลด/ดู/**ลบ**ใบเสร็จของตัวเอง (`new-receipt.html`, `receipts.html`) · ดูรายชื่อแหล่งทุนที่มีอยู่ (อ่านอย่างเดียว ใช้เลือกตอนสร้างโครงการ) | ดู/แก้ไข/ลบข้อมูลโครงการหรือใบเสร็จของนักวิจัยคนอื่น (แม้จะเดา path/ID ถูกก็เข้าไม่ได้ — บังคับที่ระดับ Firestore rules ไม่ใช่แค่ซ่อนปุ่ม) · เพิ่ม/แก้ไข/ลบแหล่งทุนหรือกฎใบเสร็จ (`ruleItems`) · ตั้งค่า `isAdmin` ให้ตัวเอง (ถูกบล็อกไว้เฉพาะ) · เข้าหน้า Admin Dashboard/จัดการแหล่งทุน (ไม่เห็นแม้แต่ในเมนู) |
| **Admin** (ผู้ดูแลระบบ) | **อ่าน**ข้อมูลโครงการ/ใบเสร็จของนักวิจัย**ทุกคน**ผ่าน Admin Dashboard (รวมชื่อ-อีเมลเจ้าของ) สำหรับรายงาน/ปรับปรุงระบบ · เพิ่ม/แก้ไข/**ลบ**แหล่งทุนและกฎใบเสร็จ (`ruleItems`) ผ่าน `fund-sources.html` | **เขียน/แก้ไข/ลบข้อมูลโครงการหรือใบเสร็จของนักวิจัยคนใดเลย** (สิทธิ์เป็นอ่านอย่างเดียวล้วนๆ นอกเหนือจาก fundSources/ruleItems) · สร้าง/แก้ไขโครงการหรือใบเสร็จแทนนักวิจัย · ตั้ง `isAdmin` ให้ตัวเองหรือคนอื่นผ่านแอป (ต้องตั้งผ่าน Firebase Console ด้วยมือเท่านั้น — ไม่มี UI ในแอป) |

(รายละเอียดระดับ field/path แบบเต็ม ดูตาราง "ตารางสรุปสิทธิ์" ด้านล่าง — ตารางนี้สรุปมุมมองระดับ role สำหรับใช้ตรวจสอบเร็วๆ)

## ตารางสรุปสิทธิ์ (ละเอียดระดับ path/field)

| ข้อมูล | ใครอ่านได้ | ใครเขียนได้ | เช็คจากอะไร |
|---|---|---|---|
| ข้อมูลโปรไฟล์ตัวเอง (`users/{userId}`) | เจ้าของ + admin | เจ้าของเท่านั้น (admin เขียนไม่ได้) | อ่าน: `uid`=`userId` หรือ `isAdmin()` · เขียน: `uid`=`userId` เท่านั้น |
| โครงการวิจัย (`.../projects/{projectId}`) | เจ้าของโครงการ + admin | เจ้าของโครงการเท่านั้น (admin เขียนไม่ได้) | อ่าน: `uid`=`userId` หรือ `isAdmin()` · เขียน: `uid`=`userId` เท่านั้น |
| ใบเสร็จ — เปิดดูทีละใบ/ในโครงการเดียว (`.../receipts/{receiptId}`) | เจ้าของ + admin | เจ้าของเท่านั้น (admin เขียนไม่ได้) | อ่าน: `uid`=`userId` หรือ `isAdmin()` · เขียน: `uid`=`userId` เท่านั้น |
| ไฟล์แนบใบเสร็จ (`.../files/{fileId}`) | เจ้าของ + admin | เจ้าของเท่านั้น (admin เขียนไม่ได้) | อ่าน: `uid`=`userId` หรือ `isAdmin()` · เขียน: `uid`=`userId` เท่านั้น |
| ใบเสร็จ — ดูรวมข้ามทุกโครงการ (หน้า "ใบเสร็จของฉัน" / Admin Dashboard) | เจ้าของ + admin | เจ้าของเท่านั้น (admin เขียนไม่ได้) | อ่าน: field `ownerUserId` = `uid` หรือ `isAdmin()` (Admin Dashboard ไม่กรอง `ownerUserId` เลย — อ่านของทุกคน) · เขียน: `ownerUserId` = `uid` เท่านั้น |
| ระเบียบแหล่งทุน (`fundSources`, `ruleVersions`, `ruleItems`) | ผู้ล็อกอินทุกคน | เฉพาะ admin เท่านั้น | อ่าน: แค่เช็คว่าล็อกอินอยู่ · เขียน: field `isAdmin == true` บน `users/{uid}` ของตัวเอง |
| ไฟล์แนบใน Storage (`receipts/{userId}/...`) | เจ้าของเท่านั้น | เจ้าของเท่านั้น + ต้องเป็น jpg/png/pdf และ ≤ 5 MB | `uid` ที่ล็อกอิน = `userId` ใน path ของไฟล์ |
| อย่างอื่นที่ไม่อยู่ในตารางนี้ | ไม่มีใครอ่านได้ | ไม่มีใครเขียนได้ | ปิดหมด (deny by default) |

สรุปสั้นๆ: **ใครก็เห็นได้แค่ข้อมูลของตัวเอง** ยกเว้น (1) "ระเบียบแหล่งทุน" ที่เป็นข้อมูลกลางให้ทุกคน**อ่าน**ร่วมกันได้ แต่**เขียน**ได้เฉพาะ admin (เพิ่มเมื่อสร้าง `app/fund-sources.html`) และ (2) **admin อ่านได้ทุกอย่างข้ามผู้ใช้** (เพิ่ม 2026-09-10 สำหรับ `app/admin-dashboard.html` — ดูเหตุผลเต็มใน `docs/05-log/20260910-log.md`, เป็นการกลับคำตัดสินใจ FR-12/NFR-05 เดิมโดยตรง) — **admin เขียนข้อมูลของผู้ใช้คนอื่นไม่ได้เลย ไม่ว่าจะเป็น users/projects/receipts/files** สิทธิ์ของ admin ในทุกจุดที่ไม่ใช่ `fundSources`/`ruleVersions`/`ruleItems` เป็น**อ่านอย่างเดียว**

**ยังไม่มี UI ตั้ง admin คนแรก** — ต้องเปิด Firebase Console → Firestore Database → เอกสาร `users/{uid}` ของบัญชีที่จะให้เป็น admin → เพิ่ม/แก้ field `isAdmin` เป็น `true` ด้วยมือ บัญชีสมัครใหม่ทุกบัญชีได้ `isAdmin: false` เป็นค่าเริ่มต้นเสมอ (ดู `app/js/signup.js`)

**⚠️ เจอช่องโหว่ระหว่างตั้ง admin คนแรกจริง (แก้แล้ว 2026-09-10):** กฎเดิมของ `users/{userId}` เป็น `allow read, write` เดียวเช็คแค่ `uid == userId` — แปลว่าผู้ใช้ทุกคนเขียน `isAdmin: true` ให้ตัวเองผ่าน client SDK ได้ตรงๆ ทำให้การจำกัดสิทธิ์เขียน `fundSources` เฉพาะ admin ไม่มีความหมาย ตอนนี้แก้แล้วโดยแยก `create`/`update` ออกจาก `read`/`delete` และบังคับว่า field `isAdmin` ต้องเท่าเดิมเสมอในทุกการเขียนจาก client (ดูโค้ดรูลด้านล่าง) — จะเปลี่ยน `isAdmin` ได้เฉพาะผ่าน Firebase Console/Admin SDK เท่านั้น

## ทำไมใบเสร็จถึงมี 2 แถวในตาราง (เช็คคนละแบบ)

โครงสร้างข้อมูลจริงคือ `users/{userId}/projects/{projectId}/receipts/{receiptId}` แต่หน้า "ใบเสร็จของฉัน" ต้องดึงใบเสร็จของทุกโครงการมารวมกันในครั้งเดียว (เรียกว่า collection-group query) ซึ่งวิธีอ่านแบบนี้ไม่มี `userId` ให้เทียบตรงๆ จึงต้องใช้ field ชื่อ `ownerUserId` ที่ฝังไว้ในตัวเอกสารใบเสร็จแต่ละใบแทน — เพราะแบบนี้ **ทุกครั้งที่บันทึกใบเสร็จใหม่ ต้องไม่ลืมใส่ field `ownerUserId`** (โค้ดปัจจุบันใส่ไว้ให้แล้วทั้ง `app/js/new-receipt.js` และ `app/js/seed.js`)

## โค้ดรูลจริงที่จะเอาไปวางตอน publish

<details>
<summary>Firestore rules (คลิกเพื่อดู)</summary>

```
// helper: ล็อกอินอยู่ และมี field isAdmin == true บน users/{uid} ของตัวเอง — ตั้งได้เฉพาะผ่าน
// Firebase Console/Admin SDK เท่านั้น (ห้าม self-promote ผ่าน client write ดู users/{userId} ด้านล่าง)
function isAdmin() {
  return request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('isAdmin', false) == true;
}

match /users/{userId} {
  // อ่านได้ทั้งเจ้าของบัญชีเองและ admin (admin ใช้หา fullName/email เจ้าของใบเสร็จใน
  // admin-dashboard.js) — delete/create/update ยังคงจำกัดเฉพาะเจ้าของเท่านั้น (admin เขียนไม่ได้)
  allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
  allow delete: if request.auth != null && request.auth.uid == userId;

  // create/update แยกจาก read/delete เพื่อกันไม่ให้เจ้าของบัญชีเปลี่ยน isAdmin ของตัวเองได้
  allow create: if request.auth != null && request.auth.uid == userId
    && request.resource.data.get('isAdmin', false) == false;
  allow update: if request.auth != null && request.auth.uid == userId
    && request.resource.data.get('isAdmin', false) == resource.data.get('isAdmin', false);

  match /projects/{projectId} {
    // อ่าน: เจ้าของหรือ admin · เขียน: เจ้าของเท่านั้น (admin แก้ไขโครงการของผู้อื่นไม่ได้)
    allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
    allow write: if request.auth != null && request.auth.uid == userId;

    // ห้าม nest ใต้ wildcard — ดูหัวข้อ "Known Firestore Security Rules gotcha"
    // ใน CLAUDE.md (ถ้า nest /files ไว้ใต้ match แบบ `{path=**}` จะอ่านไม่ได้)
    match /receipts/{receiptId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if request.auth != null && request.auth.uid == userId;

      match /files/{fileId} {
        allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}

// สำหรับ collection-group query ("ใบเสร็จของฉัน" ข้ามทุกโครงการ, และ Admin Dashboard ข้ามทุกคน)
// เช็คจาก field แทน path — Admin Dashboard ไม่มี .where("ownerUserId",...) เลย เพราะต้องการอ่าน
// ของทุกคน จึงอาศัย isAdmin() bypass แทน
match /{path=**}/receipts/{receiptId} {
  allow read: if request.auth != null && (resource.data.ownerUserId == request.auth.uid || isAdmin());
  allow write: if request.auth != null
    && request.resource.data.ownerUserId == request.auth.uid;
}

// ระเบียบแหล่งทุน — ข้อมูลกลาง อ่านได้ทุกคนที่ล็อกอิน เขียนได้เฉพาะ admin
match /fundSources/{fundSourceId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();

  match /ruleVersions/{ruleVersionId} {
    allow read: if request.auth != null;
    allow write: if isAdmin();

    match /ruleItems/{ruleItemId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}

// ปิดทุกอย่างที่ไม่ได้ระบุไว้ข้างบน
match /{document=**} {
  allow read, write: if false;
}
```

</details>

<details>
<summary>Storage rules (คลิกเพื่อดู)</summary>

```
match /receipts/{userId}/{receiptId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.size <= 5 * 1024 * 1024
    && request.resource.contentType.matches('image/jpeg|image/png|application/pdf');
}

match /{allPaths=**} {
  allow read, write: if false;
}
```

`app/js/new-receipt.js` อัปโหลดไฟล์ไปที่ path รูปแบบ `receipts/{uid}/{receiptId}/...` อยู่แล้ว จึงไม่ต้องแก้โค้ดแอปฝั่งนี้ แก้แค่ตัวรูล

</details>

## ก่อนกด Publish จริง เช็คให้ครบ

| ขั้นตอน | ทำอะไร |
|---|---|
| 1 | copy โค้ด Firestore ด้านบนไปวางใน Firebase Console → Firestore Database → **Rules** → กด Publish |
| 2 | copy โค้ด Storage ด้านบนไปวางใน Firebase Console → **Storage** → Rules → กด Publish (คนละหน้ากับ Firestore) |
| 3 | เช็คว่าใบเสร็จที่ seed ไว้แล้วทุกใบมี field `ownerUserId` ครบ — ถ้ามีใบเก่าก่อน 2026-09-05 ที่ไม่มี field นี้ ให้กดปุ่มใน `app/seed.html` ใหม่อีกครั้ง (ใบเก่าที่ไม่มี field นี้จะหายไปจากมุมมอง ถือว่าถูกต้องตามที่ตั้งใจ) |
| 4 | ทดสอบด้วย 2 บัญชีจริง: แต่ละบัญชีต้องเห็นแค่รายการของตัวเองในหน้า "ใบเสร็จของฉัน" และลองอ่าน path ของอีกบัญชีตรงๆ ต้องขึ้น error `permission-denied` |
