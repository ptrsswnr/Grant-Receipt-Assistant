// ─────────────────────────────────────────────────────────────
// js/seed.js — ใส่ข้อมูลตัวอย่างจาก js/data.js ลง Firestore (ใช้ครั้งเดียว)
// ใช้ .set() กับ id เดิมของแต่ละรายการ (ไม่ใช่ .add()) เพื่อให้กดซ้ำได้อย่างปลอดภัย
// กดกี่ครั้งก็ได้ ข้อมูลจะถูกเขียนทับด้วยชุดเดิม ไม่มีรายการซ้ำ
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

var ปุ่ม = document.getElementById("ปุ่มใส่ข้อมูล");
var กล่องผล = document.getElementById("ผลลัพธ์การใส่ข้อมูล");

ปุ่ม.addEventListener("click", ใส่ข้อมูลตัวอย่าง);

async function ใส่ข้อมูลตัวอย่าง() {
  ปุ่ม.disabled = true;
  แสดงผล("กำลังใส่ข้อมูล…");

  try {
    var data = window.RECEIPT_DATA;

    for (var u of data.users) {
      var { id, ...ฟิลด์ } = u;
      await db.collection("users").doc(id).set(ฟิลด์);
    }

    for (var fs of data.fundSources) {
      var { id: fsId, ...fsฟิลด์ } = fs;
      await db.collection("fundSources").doc(fsId).set(fsฟิลด์);
    }

    for (var rv of data.ruleVersions) {
      var { id: rvId, fundSourceId: rvFundSourceId, ...rvฟิลด์ } = rv;
      await db.collection("fundSources").doc(rvFundSourceId)
        .collection("ruleVersions").doc(rvId)
        .set(Object.assign({}, rvฟิลด์, {
          fundSourceId: rvFundSourceId,
          importedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }));
    }

    for (var ri of data.ruleItems) {
      var { id: riId, ruleVersionId: riRuleVersionId, ...riฟิลด์ } = ri;
      var เวอร์ชันของข้อนี้ = data.ruleVersions.find(function (x) { return x.id === riRuleVersionId; });
      await db.collection("fundSources").doc(เวอร์ชันของข้อนี้.fundSourceId)
        .collection("ruleVersions").doc(riRuleVersionId)
        .collection("ruleItems").doc(riId)
        .set(Object.assign({}, riฟิลด์, { ruleVersionId: riRuleVersionId }));
    }

    var เจ้าของโครงการ = {}; // projectId -> ownerUserId (ไว้ใช้ต่อ path ของ receipts/files)
    for (var p of data.projects) {
      var { id: projectId, ownerUserId, ...pฟิลด์ } = p;
      เจ้าของโครงการ[projectId] = ownerUserId;
      await db.collection("users").doc(ownerUserId)
        .collection("projects").doc(projectId)
        .set(Object.assign({}, pฟิลด์, { ownerUserId }));
    }

    for (var r of data.receipts) {
      var { id: receiptId, projectId: rProjectId, ...rฟิลด์ } = r;
      var เจ้าของ = เจ้าของโครงการ[rProjectId];
      await db.collection("users").doc(เจ้าของ)
        .collection("projects").doc(rProjectId)
        .collection("receipts").doc(receiptId)
        .set(Object.assign({}, rฟิลด์, {
          projectId: rProjectId,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }));
    }

    for (var file of data.files) {
      var { receiptId: fReceiptId, ...fฟิลด์ } = file;
      var ใบเสร็จของไฟล์นี้ = data.receipts.find(function (x) { return x.id === fReceiptId; });
      var เจ้าของไฟล์ = เจ้าของโครงการ[ใบเสร็จของไฟล์นี้.projectId];
      // ใช้ originalFileName เป็น doc id เพื่อให้กดซ้ำแล้วไม่เกิดไฟล์ซ้ำในชุดเดียวกัน
      await db.collection("users").doc(เจ้าของไฟล์)
        .collection("projects").doc(ใบเสร็จของไฟล์นี้.projectId)
        .collection("receipts").doc(fReceiptId)
        .collection("files").doc(file.originalFileName)
        .set(Object.assign({}, fฟิลด์, { uploadedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    }

    แสดงผล(
      "✅ ใส่ข้อมูลตัวอย่างเสร็จแล้ว (โครงสร้างใหม่: users>projects>receipts>files, fundSources>ruleVersions>ruleItems)\n\n" +
      "users " + data.users.length +
      " · fundSources " + data.fundSources.length +
      " · ruleVersions " + data.ruleVersions.length +
      " · ruleItems " + data.ruleItems.length +
      " · projects " + data.projects.length +
      " · receipts " + data.receipts.length +
      " · files " + data.files.length +
      "\n\nเปิด Firebase Console หรือหน้า receipts.html ตรวจดูได้เลย"
    );
  } catch (err) {
    แสดงผล("❌ ใส่ข้อมูลไม่สำเร็จ: " + err.message + "\n\n(เช็ค Firestore Rules ว่าเปิดให้เขียนได้หรือยัง)");
  } finally {
    ปุ่ม.disabled = false;
  }
}

function แสดงผล(ข้อความ) {
  กล่องผล.textContent = ข้อความ;
}
