# ACL.md — ใครเข้าถึงอะไรได้บ้าง (Firestore + Storage)

เอกสารออกแบบเท่านั้น — **ยังไม่ได้ deploy จริง** ไฟล์ `firestore.rules` และ `storage.rules` ในโปรเจกต์ยังเปิดหมด (`if true`) เหมือนเดิม ยังไม่มีการ copy อะไรไปวางใน Firebase Console

**สาเหตุที่ต้องทำ**: ตอนนี้แอปมีระบบล็อกอินจริงแล้ว (`app/login.html`) แต่ตัวรูล (กฎความปลอดภัย) ยังไม่เช็คว่าใครเป็นใครเลย ทุกคนยังอ่าน/เขียนข้อมูลของคนอื่นตรงๆ ได้อยู่ ตารางด้านล่างคือแผนที่จะสลับไปใช้ตอนพร้อม

## ตารางสรุปสิทธิ์

| ข้อมูล | ใครอ่านได้ | ใครเขียนได้ | เช็คจากอะไร |
|---|---|---|---|
| ข้อมูลโปรไฟล์ตัวเอง (`users/{userId}`) | เจ้าของเท่านั้น | เจ้าของเท่านั้น | `uid` ที่ล็อกอิน = `userId` ใน path |
| โครงการวิจัย (`.../projects/{projectId}`) | เจ้าของโครงการเท่านั้น | เจ้าของโครงการเท่านั้น | `uid` ที่ล็อกอิน = `userId` ใน path |
| ใบเสร็จ — เปิดดูทีละใบ/ในโครงการเดียว (`.../receipts/{receiptId}`) | เจ้าของเท่านั้น | เจ้าของเท่านั้น | `uid` ที่ล็อกอิน = `userId` ใน path |
| ไฟล์แนบใบเสร็จ (`.../files/{fileId}`) | เจ้าของเท่านั้น | เจ้าของเท่านั้น | `uid` ที่ล็อกอิน = `userId` ใน path |
| ใบเสร็จ — ดูรวมข้ามทุกโครงการ (หน้า "ใบเสร็จของฉัน") | เจ้าของเท่านั้น | เจ้าของเท่านั้น | field `ownerUserId` ในตัวเอกสาร = `uid` ที่ล็อกอิน |
| ระเบียบแหล่งทุน (`fundSources`, `ruleVersions`, `ruleItems`) | ผู้ล็อกอินทุกคน | เฉพาะ admin เท่านั้น | อ่าน: แค่เช็คว่าล็อกอินอยู่ · เขียน: field `isAdmin == true` บน `users/{uid}` ของตัวเอง |
| ไฟล์แนบใน Storage (`receipts/{userId}/...`) | เจ้าของเท่านั้น | เจ้าของเท่านั้น + ต้องเป็น jpg/png/pdf และ ≤ 5 MB | `uid` ที่ล็อกอิน = `userId` ใน path ของไฟล์ |
| อย่างอื่นที่ไม่อยู่ในตารางนี้ | ไม่มีใครอ่านได้ | ไม่มีใครเขียนได้ | ปิดหมด (deny by default) |

สรุปสั้นๆ: **ใครก็เห็นได้แค่ข้อมูลของตัวเอง** ยกเว้น "ระเบียบแหล่งทุน" ที่เป็นข้อมูลกลางให้ทุกคน**อ่าน**ร่วมกันได้ แต่**เขียน**ได้เฉพาะ admin (เพิ่มเมื่อสร้าง `app/fund-sources.html` — ก่อนหน้านี้ผู้ล็อกอินทุกคนเขียนได้หมดเพราะยังไม่มีระบบสิทธิ์ผู้ดูแลระบบ)

**ยังไม่มี UI ตั้ง admin คนแรก** — ต้องเปิด Firebase Console → Firestore Database → เอกสาร `users/{uid}` ของบัญชีที่จะให้เป็น admin → เพิ่ม/แก้ field `isAdmin` เป็น `true` ด้วยมือ บัญชีสมัครใหม่ทุกบัญชีได้ `isAdmin: false` เป็นค่าเริ่มต้นเสมอ (ดู `app/js/signup.js`)

**⚠️ เจอช่องโหว่ระหว่างตั้ง admin คนแรกจริง (แก้แล้ว 2026-09-10):** กฎเดิมของ `users/{userId}` เป็น `allow read, write` เดียวเช็คแค่ `uid == userId` — แปลว่าผู้ใช้ทุกคนเขียน `isAdmin: true` ให้ตัวเองผ่าน client SDK ได้ตรงๆ ทำให้การจำกัดสิทธิ์เขียน `fundSources` เฉพาะ admin ไม่มีความหมาย ตอนนี้แก้แล้วโดยแยก `create`/`update` ออกจาก `read`/`delete` และบังคับว่า field `isAdmin` ต้องเท่าเดิมเสมอในทุกการเขียนจาก client (ดูโค้ดรูลด้านล่าง) — จะเปลี่ยน `isAdmin` ได้เฉพาะผ่าน Firebase Console/Admin SDK เท่านั้น

## ทำไมใบเสร็จถึงมี 2 แถวในตาราง (เช็คคนละแบบ)

โครงสร้างข้อมูลจริงคือ `users/{userId}/projects/{projectId}/receipts/{receiptId}` แต่หน้า "ใบเสร็จของฉัน" ต้องดึงใบเสร็จของทุกโครงการมารวมกันในครั้งเดียว (เรียกว่า collection-group query) ซึ่งวิธีอ่านแบบนี้ไม่มี `userId` ให้เทียบตรงๆ จึงต้องใช้ field ชื่อ `ownerUserId` ที่ฝังไว้ในตัวเอกสารใบเสร็จแต่ละใบแทน — เพราะแบบนี้ **ทุกครั้งที่บันทึกใบเสร็จใหม่ ต้องไม่ลืมใส่ field `ownerUserId`** (โค้ดปัจจุบันใส่ไว้ให้แล้วทั้ง `app/js/new-receipt.js` และ `app/js/seed.js`)

## โค้ดรูลจริงที่จะเอาไปวางตอน publish

<details>
<summary>Firestore rules (คลิกเพื่อดู)</summary>

```
match /users/{userId} {
  allow read, delete: if request.auth != null && request.auth.uid == userId;

  // create/update แยกจาก read/delete เพื่อกันไม่ให้เจ้าของบัญชีเปลี่ยน isAdmin ของตัวเองได้
  allow create: if request.auth != null && request.auth.uid == userId
    && request.resource.data.get('isAdmin', false) == false;
  allow update: if request.auth != null && request.auth.uid == userId
    && request.resource.data.get('isAdmin', false) == resource.data.get('isAdmin', false);

  match /projects/{projectId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;

    // ห้าม nest ใต้ wildcard — ดูหัวข้อ "Known Firestore Security Rules gotcha"
    // ใน CLAUDE.md (ถ้า nest /files ไว้ใต้ match แบบ `{path=**}` จะอ่านไม่ได้)
    match /receipts/{receiptId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /files/{fileId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}

// สำหรับ collection-group query ("ใบเสร็จของฉัน" ข้ามทุกโครงการ) — เช็คจาก field แทน path
match /{path=**}/receipts/{receiptId} {
  allow read: if request.auth != null && resource.data.ownerUserId == request.auth.uid;
  allow write: if request.auth != null
    && request.resource.data.ownerUserId == request.auth.uid;
}

// ระเบียบแหล่งทุน — ข้อมูลกลาง อ่านได้ทุกคนที่ล็อกอิน เขียนได้เฉพาะ admin (isAdmin == true)
match /fundSources/{fundSourceId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;

  match /ruleVersions/{ruleVersionId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;

    match /ruleItems/{ruleItemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
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
