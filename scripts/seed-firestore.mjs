// สคริปต์ใส่ข้อมูลตัวอย่างลง Firestore สำหรับการบ้าน Week 6
// รันด้วย: npm install && npm run seed
//
// ก่อนรัน ต้องตั้ง Firestore Security Rules เป็นโหมดเปิดเขียนชั่วคราว (test mode) ก่อน
// เช่น:
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /{document=**} { allow read, write: if true; }
//     }
//   }
// (เปลี่ยนกลับเป็น rule ที่รัดกุมก่อนใช้งานจริง — โหมดเปิดนี้ใช้เฉพาะช่วง seed ข้อมูลตัวอย่าง)

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.mjs";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- ข้อมูลตัวอย่าง: funds (ประกอบ) ----------
const funds = [
  {
    id: "fund001",
    fundName: "ทุนวิจัยประเภท ก. ปี 2569",
    fundCode: "RES-2569-001",
    ownerUserId: "user001",
  },
  {
    id: "fund002",
    fundName: "ทุนวิจัยประเภท ข. ปี 2569",
    fundCode: "RES-2569-002",
    ownerUserId: "user001",
  },
];

// ---------- ข้อมูลตัวอย่าง: receipts (หลัก) พร้อมไฟล์ย่อย 1 ไฟล์ต่อรายการ ----------
const receipts = [
  {
    id: "receipt001",
    fundId: "fund001",
    confirmedAmount: 350,
    confirmedDate: "2026-08-20",
    confirmedCategory: "ค่าเดินทาง",
    confirmedVendorName: "ร้านถ่ายเอกสาร ABC",
    status: "ผ่าน",
    aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด",
    isExported: false,
    file: { originalFileName: "receipt_travel_01.jpg", fileType: "jpg", fileSizeBytes: 1200000 },
  },
  {
    id: "receipt002",
    fundId: "fund001",
    confirmedAmount: 1800,
    confirmedDate: "2026-08-21",
    confirmedCategory: "ค่าวัสดุ",
    confirmedVendorName: "ร้านเครื่องเขียนสยาม",
    status: "ต้องแก้ไข",
    aiExplanation: "ยอดเงินที่ระบุเกินวงเงินสูงสุดของหมวดค่าวัสดุ กรุณาแนบใบเสร็จแยกตามหมวดหรือปรับยอด",
    isExported: false,
    file: { originalFileName: "receipt_material_01.pdf", fileType: "pdf", fileSizeBytes: 800000 },
  },
  {
    id: "receipt003",
    fundId: "fund001",
    confirmedAmount: 500,
    confirmedDate: "2026-08-22",
    confirmedCategory: "ค่าอาหาร",
    confirmedVendorName: "ร้านอาหารครัวคุณแม่",
    status: "ไม่เข้าเงื่อนไข",
    aiExplanation: "ระเบียบทุนนี้ไม่อนุญาตให้เบิกค่าอาหารในหมวดนี้ กรุณาตรวจสอบประเภททุนของท่านอีกครั้ง",
    isExported: false,
    file: { originalFileName: "receipt_food_01.jpg", fileType: "jpg", fileSizeBytes: 950000 },
  },
  {
    id: "receipt004",
    fundId: "fund002",
    confirmedAmount: 2500,
    confirmedDate: "2026-08-23",
    confirmedCategory: "ค่าเดินทาง",
    confirmedVendorName: "บริษัท ทัวร์แอนด์แทรเวล จำกัด",
    status: "ผ่าน",
    aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์ครบถ้วน มีเอกสารประกอบตามที่ระเบียบกำหนด",
    isExported: false,
    file: { originalFileName: "receipt_van_01.jpg", fileType: "jpg", fileSizeBytes: 1500000 },
  },
  {
    id: "receipt005",
    fundId: "fund002",
    confirmedAmount: 120,
    confirmedDate: "2026-08-24",
    confirmedCategory: "ค่าวัสดุ",
    confirmedVendorName: "ร้านถ่ายเอกสาร ABC",
    status: "ผ่าน",
    aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด",
    isExported: false,
    file: { originalFileName: "receipt_material_02.png", fileType: "png", fileSizeBytes: 600000 },
  },
];

async function seed() {
  console.log("กำลังใส่ข้อมูล funds...");
  for (const fund of funds) {
    const { id, ...data } = fund;
    await setDoc(doc(db, "funds", id), data);
    console.log(`  + funds/${id}`);
  }

  console.log("กำลังใส่ข้อมูล receipts + files ย่อย...");
  for (const receipt of receipts) {
    const { id, file, ...data } = receipt;
    await setDoc(doc(db, "receipts", id), {
      ...data,
      uploadedAt: Timestamp.now(),
    });
    console.log(`  + receipts/${id}`);

    const fileRef = doc(collection(db, "receipts", id, "files"));
    await setDoc(fileRef, {
      ...file,
      sortOrder: 1,
      uploadedAt: Timestamp.now(),
    });
    console.log(`    + receipts/${id}/files/${fileRef.id}`);
  }

  console.log("เสร็จแล้ว: seed ข้อมูลตัวอย่างครบทั้ง funds และ receipts (พร้อม sub-collection files)");
  process.exit(0);
}

seed().catch((err) => {
  console.error("เกิดข้อผิดพลาดระหว่าง seed:", err);
  process.exit(1);
});
