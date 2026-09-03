// สคริปต์ใส่ข้อมูลตัวอย่างลง Firestore สำหรับการบ้าน Week 6 (ต้องมี Node.js)
// รันด้วย: npm install && npm run seed
// ถ้าไม่มี Node.js ในเครื่อง ใช้ app/seed.html แทนได้ (กดปุ่มจากเบราว์เซอร์ ไม่ต้องพึ่ง Node)
//
// ก่อนรัน ต้องตั้ง Firestore Security Rules ให้เขียนได้ก่อน (ดู firestore.rules)
//
// โครงสร้างตรงกับ docs/02-design/02-technical/db-spec.md (แก้ไข 2026-09-03):
// FundSource (แหล่งทุน, ไม่มีเจ้าของ) --< Project (โครงการวิจัย, 1 เจ้าของ/โครงการ) --< Receipt

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

// ---------- ข้อมูลตัวอย่าง: users ----------
const users = [
  {
    id: "user001",
    fullName: "สมหญิง วิจัยดี",
    email: "somying@example.ac.th",
    roleType: "นักวิจัย/เจ้าของโครงการ",
  },
];

// ---------- ข้อมูลตัวอย่าง: fundSources (แหล่งทุน — ไม่มีเจ้าของ) ----------
const fundSources = [
  {
    id: "fundsource001",
    fundSourceName: "สกว. (สำนักงานกองทุนสนับสนุนการวิจัย)",
    fundSourceCode: "TRF",
  },
  {
    id: "fundsource002",
    fundSourceName: "ทุนภายในมหาวิทยาลัย ปี 2569",
    fundSourceCode: "MFU-2569",
  },
];

// ---------- ข้อมูลตัวอย่าง: projects (โครงการวิจัย — 1 เจ้าของ/โครงการ) ----------
const projects = [
  {
    id: "project001",
    projectName: "พัฒนาโมเดล AI เพื่อการเกษตร",
    ownerUserId: "user001",
    fundSourceId: "fundsource001",
  },
  {
    id: "project002",
    projectName: "ศึกษาพฤติกรรมผู้บริโภคยุคดิจิทัล",
    ownerUserId: "user001",
    fundSourceId: "fundsource002",
  },
];

// ---------- ข้อมูลตัวอย่าง: receipts (หลัก) พร้อมไฟล์ย่อย 1 ไฟล์ต่อรายการ ----------
const receipts = [
  {
    id: "receipt001",
    projectId: "project001",
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
    projectId: "project001",
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
    projectId: "project001",
    confirmedAmount: 500,
    confirmedDate: "2026-08-22",
    confirmedCategory: "ค่าอาหาร",
    confirmedVendorName: "ร้านอาหารครัวคุณแม่",
    status: "ไม่เข้าเงื่อนไข",
    aiExplanation: "ระเบียบของแหล่งทุนนี้ไม่อนุญาตให้เบิกค่าอาหารในหมวดนี้ กรุณาตรวจสอบระเบียบของแหล่งทุนอีกครั้ง",
    isExported: false,
    file: { originalFileName: "receipt_food_01.jpg", fileType: "jpg", fileSizeBytes: 950000 },
  },
  {
    id: "receipt004",
    projectId: "project002",
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
    projectId: "project002",
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
  console.log("กำลังใส่ข้อมูล users...");
  for (const user of users) {
    const { id, ...data } = user;
    await setDoc(doc(db, "users", id), data);
    console.log(`  + users/${id}`);
  }

  console.log("กำลังใส่ข้อมูล fundSources...");
  for (const fundSource of fundSources) {
    const { id, ...data } = fundSource;
    await setDoc(doc(db, "fundSources", id), data);
    console.log(`  + fundSources/${id}`);
  }

  console.log("กำลังใส่ข้อมูล projects...");
  for (const project of projects) {
    const { id, ...data } = project;
    await setDoc(doc(db, "projects", id), data);
    console.log(`  + projects/${id}`);
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

  console.log("เสร็จแล้ว: seed ข้อมูลตัวอย่างครบทั้ง users, fundSources, projects และ receipts (พร้อม sub-collection files)");
  process.exit(0);
}

seed().catch((err) => {
  console.error("เกิดข้อผิดพลาดระหว่าง seed:", err);
  process.exit(1);
});
