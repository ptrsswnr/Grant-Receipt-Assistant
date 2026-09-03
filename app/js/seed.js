// ─────────────────────────────────────────────────────────────
// js/seed.js — ใส่ข้อมูลตัวอย่างจาก js/data.js ลง Firestore (ใช้ครั้งเดียว)
// ใช้ .set() กับ id เดิมของแต่ละรายการ (ไม่ใช่ .add()) เพื่อให้กดซ้ำได้อย่างปลอดภัย
// กดกี่ครั้งก็ได้ ข้อมูลจะถูกเขียนทับด้วยชุดเดิม ไม่มีรายการซ้ำ
// โครงสร้างตรงกับ db-spec.md: users, fundSources, projects, receipts (+ files sub-collection)
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
      var { id, ...ฟิลด์ } = fs;
      await db.collection("fundSources").doc(id).set(ฟิลด์);
    }

    for (var p of data.projects) {
      var { id, ...ฟิลด์ } = p;
      await db.collection("projects").doc(id).set(ฟิลด์);
    }

    for (var r of data.receipts) {
      var { id, ...ฟิลด์ } = r;
      await db.collection("receipts").doc(id).set(
        Object.assign({}, ฟิลด์, { uploadedAt: firebase.firestore.FieldValue.serverTimestamp() })
      );
    }

    for (var file of data.files) {
      var { receiptId, ...ฟิลด์ } = file;
      // ใช้ originalFileName เป็น doc id เพื่อให้กดซ้ำแล้วไม่เกิดไฟล์ซ้ำในชุดเดียวกัน
      await db.collection("receipts").doc(receiptId).collection("files").doc(file.originalFileName).set(
        Object.assign({}, ฟิลด์, { uploadedAt: firebase.firestore.FieldValue.serverTimestamp() })
      );
    }

    แสดงผล(
      "✅ ใส่ข้อมูลตัวอย่างเสร็จแล้ว — users " + data.users.length +
      " · fundSources " + data.fundSources.length +
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
