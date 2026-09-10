// ─────────────────────────────────────────────────────────────
// js/seed.js — ใส่ข้อมูลตัวอย่างจาก js/data.js ลง Firestore (ใช้ครั้งเดียว)
// ใช้ .set() กับ id เดิมของแต่ละรายการ (ไม่ใช่ .add()) เพื่อให้กดซ้ำได้อย่างปลอดภัย
// กดกี่ครั้งก็ได้ ข้อมูลจะถูกเขียนทับด้วยชุดเดิม ไม่มีรายการซ้ำ
//
// ตั้งแต่มี Firebase Auth จริงแล้ว: users/projects/receipts/files ทั้งหมดถูก seed ลงบัญชีที่
// ล็อกอินอยู่ ณ ตอนกดปุ่ม (firebase.auth().currentUser.uid) แทน data.users[0].id ("user001") ที่
// hardcode ไว้เดิม — data.js ยังเก็บ id/ownerUserId แบบ mock ไว้เหมือนเดิม แต่ค่าพวกนั้นถูกละเว้น
// ตอนเขียนจริง (ใช้แค่เป็น "แม่แบบ" ของ field อื่นๆ เช่น projectName/fundSourceId) เพื่อให้ auth-guard.js
// การันตีว่ามีคนล็อกอินอยู่แล้วก่อนปุ่มนี้กดได้ (ไม่ต้อง await window.AUTH_READY ในนี้ซ้ำ)
//
// users/{uid} เขียนด้วย { merge: true } เสมอ — ไม่ใช้ .set() เขียนทับทั้งเอกสารเหมือนเดิมอีกต่อไป
// เพราะจะลบ field isAdmin ของบัญชี admin ทิ้งโดยไม่ได้ตั้งใจ (data.users[0] ใน data.js ไม่มี field
// นี้) fundSources/ruleVersions/ruleItems ตอนนี้เขียนได้เฉพาะบัญชีที่มี isAdmin: true เท่านั้น (ดู
// firestore.rules) ผู้ใช้ทั่วไปกดปุ่มนี้จะข้ามส่วนนั้นไปเงียบๆ แล้ว seed เฉพาะ projects/receipts/
// files ของตัวเอง โดยอ้างอิง fundSourceId ที่ (สมมติว่า) admin เพิ่มไว้แล้วผ่าน fund-sources.html
//
// โครงสร้าง Firestore จริง (นับจาก 2026-09-05 — nest ตามความเป็นเจ้าของใน db-spec.md):
//   users/{userId}
//   users/{userId}/projects/{projectId}                (Project เจ้าของเดียวคือ User)
//   users/{userId}/projects/{projectId}/receipts/{id}   (Receipt เจ้าของเดียวคือ Project)
//   .../receipts/{id}/files/{fileName}                  (ReceiptFile เจ้าของเดียวคือ Receipt)
//   fundSources/{fundSourceId}
//   fundSources/{fundSourceId}/ruleVersions/{id}        (RuleVersion เจ้าของเดียวคือ FundSource)
//   .../ruleVersions/{id}/ruleItems/{id}                (RuleItem เจ้าของเดียวคือ RuleVersion)
//
// fundSourceId บน Project ยังเก็บเป็น field อ้างอิงธรรมดา (ไม่ nest) เพราะ 1 แหล่งทุนให้ทุนได้
// หลายโครงการของหลายเจ้าของ ไม่ใช่ความสัมพันธ์แบบเจ้าของเดียว — ดูเหตุผลเต็มในแชทตอนคุยกับผู้ใช้
// (db-spec.md ยังคงเก็บโมเดลแบบ logical/engine-agnostic เดิมไว้ ไม่แก้ให้ผูก Firestore เพราะ
// technology-stack.md ยังไม่ตัดสินใจ — path จริงข้างบนนี้เป็นรายละเอียดระดับ implementation เท่านั้น)
// ─────────────────────────────────────────────────────────────

var seedButton = document.getElementById("seedButton");
var resultBox = document.getElementById("seedResult");

seedButton.addEventListener("click", seedData);

async function seedData() {
  seedButton.disabled = true;
  showResult("กำลังใส่ข้อมูล…");

  try {
    var data = window.RECEIPT_DATA;
    var currentUser = firebase.auth().currentUser;
    var uid = currentUser.uid;

    // เขียนเอกสาร users/{uid} ของบัญชีที่ล็อกอินอยู่จริง (ไม่ใช่ user001 จาก data.js) — ใช้ fullName/
    // roleType จากแม่แบบ แต่ email ใช้ค่าจริงจากบัญชีที่ล็อกอินอยู่ — merge: true เพื่อไม่ลบ isAdmin เดิม
    var { id: _mockUserId, ...userFields } = data.users[0];
    await db.collection("users").doc(uid).set(Object.assign({}, userFields, { email: currentUser.email }), { merge: true });

    // fundSources/ruleVersions/ruleItems เขียนได้เฉพาะบัญชี admin (isAdmin: true) — ผู้ใช้ทั่วไปจะ
    // โดน permission-denied ที่นี่ ข้ามไปเงียบๆ แล้วเดินหน้า seed projects/receipts/files ของตัวเองต่อ
    var fundSourcesSeeded = true;
    try {
      for (var fs of data.fundSources) {
        var { id: fsId, ...fsFields } = fs;
        await db.collection("fundSources").doc(fsId).set(fsFields);
      }

      for (var rv of data.ruleVersions) {
        var { id: rvId, fundSourceId: rvFundSourceId, ...rvFields } = rv;
        await db.collection("fundSources").doc(rvFundSourceId)
          .collection("ruleVersions").doc(rvId)
          .set(Object.assign({}, rvFields, {
            fundSourceId: rvFundSourceId,
            importedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }));
      }

      for (var ri of data.ruleItems) {
        var { id: riId, ruleVersionId: riRuleVersionId, ...riFields } = ri;
        var versionForThisItem = data.ruleVersions.find(function (x) { return x.id === riRuleVersionId; });
        await db.collection("fundSources").doc(versionForThisItem.fundSourceId)
          .collection("ruleVersions").doc(riRuleVersionId)
          .collection("ruleItems").doc(riId)
          .set(Object.assign({}, riFields, { ruleVersionId: riRuleVersionId }));
      }
    } catch (fsErr) {
      fundSourcesSeeded = false;
    }

    var projectOwner = {}; // projectId -> uid (ไว้ใช้ต่อ path ของ receipts/files) — ทุกโครงการ
    // seed ลงบัญชีที่ล็อกอินอยู่เสมอ ไม่ใช้ ownerUserId (user001) จาก data.js อีกต่อไป
    for (var p of data.projects) {
      var { id: projectId, ownerUserId: _mockOwnerUserId, ...pFields } = p;
      projectOwner[projectId] = uid;
      await db.collection("users").doc(uid)
        .collection("projects").doc(projectId)
        .set(Object.assign({}, pFields, { ownerUserId: uid }));
    }

    for (var r of data.receipts) {
      var { id: receiptId, projectId: rProjectId, ...rFields } = r;
      var owner = projectOwner[rProjectId];
      await db.collection("users").doc(owner)
        .collection("projects").doc(rProjectId)
        .collection("receipts").doc(receiptId)
        .set(Object.assign({}, rFields, {
          projectId: rProjectId,
          ownerUserId: owner,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }));
    }

    for (var file of data.files) {
      var { receiptId: fReceiptId, ...fFields } = file;
      var receiptForThisFile = data.receipts.find(function (x) { return x.id === fReceiptId; });
      var fileOwner = projectOwner[receiptForThisFile.projectId];
      // ใช้ originalFileName เป็น doc id เพื่อให้กดซ้ำแล้วไม่เกิดไฟล์ซ้ำในชุดเดียวกัน
      await db.collection("users").doc(fileOwner)
        .collection("projects").doc(receiptForThisFile.projectId)
        .collection("receipts").doc(fReceiptId)
        .collection("files").doc(file.originalFileName)
        .set(Object.assign({}, fFields, { uploadedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    }

    showResult(
      "✅ ใส่ข้อมูลตัวอย่างเสร็จแล้ว (โครงสร้างใหม่: users>projects>receipts>files, fundSources>ruleVersions>ruleItems)\n\n" +
      "users " + data.users.length +
      " · fundSources " + (fundSourcesSeeded ? data.fundSources.length : "ข้าม") +
      " · ruleVersions " + (fundSourcesSeeded ? data.ruleVersions.length : "ข้าม") +
      " · ruleItems " + (fundSourcesSeeded ? data.ruleItems.length : "ข้าม") +
      " · projects " + data.projects.length +
      " · receipts " + data.receipts.length +
      " · files " + data.files.length +
      (fundSourcesSeeded ? "" : "\n\n⚠️ ข้ามการใส่ fundSources/ruleVersions/ruleItems เพราะบัญชีนี้ไม่มีสิทธิ์ admin (isAdmin: true) — ให้ผู้ดูแลระบบเพิ่มแหล่งทุนที่หน้า fund-sources.html แทน") +
      "\n\nเปิด Firebase Console หรือหน้า receipts.html ตรวจดูได้เลย"
    );
  } catch (err) {
    showResult("❌ ใส่ข้อมูลไม่สำเร็จ: " + err.message + "\n\n(เช็ค Firestore Rules ว่าเปิดให้เขียนได้หรือยัง)");
  } finally {
    seedButton.disabled = false;
  }
}

function showResult(message) {
  resultBox.textContent = message;
}
