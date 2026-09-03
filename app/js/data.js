// ─────────────────────────────────────────────────────────────
// js/data.js — ข้อมูลตัวอย่างสำหรับ seed.html และตัวเลือกในฟอร์ม new-receipt.html
// โครงสร้างตรงกับ docs/02-design/02-technical/db-spec.md (แก้ไข 2026-09-03):
// FundSource (แหล่งทุน, ไม่มีเจ้าของ) --< Project (โครงการวิจัย, 1 เจ้าของ/โครงการ) --< Receipt
// ยังไม่มี Rule Engine/OCR/LLM จริง (ดูเหตุผลใน SCOPE.md) — ค่า status/aiExplanation
// ในชุดข้อมูลนี้เป็นค่าที่ "สมมติว่า Rule Engine ตัดสินไปแล้ว" ไม่ใช่ผลจากการตรวจจริง
// ─────────────────────────────────────────────────────────────

window.RECEIPT_DATA = {
  users: [
    { id: "user001", fullName: "สมหญิง วิจัยดี", email: "somying@example.ac.th", roleType: "นักวิจัย/เจ้าของโครงการ" },
  ],

  fundSources: [
    { id: "fundsource001", fundSourceName: "สกว. (สำนักงานกองทุนสนับสนุนการวิจัย)", fundSourceCode: "TRF" },
    { id: "fundsource002", fundSourceName: "ทุนภายในมหาวิทยาลัย ปี 2569", fundSourceCode: "MFU-2569" },
  ],

  projects: [
    { id: "project001", projectName: "พัฒนาโมเดล AI เพื่อการเกษตร", ownerUserId: "user001", fundSourceId: "fundsource001" },
    { id: "project002", projectName: "ศึกษาพฤติกรรมผู้บริโภคยุคดิจิทัล", ownerUserId: "user001", fundSourceId: "fundsource002" },
  ],

  categories: ["ค่าเดินทาง", "ค่าวัสดุ", "ค่าอาหาร", "ค่าตอบแทนวิทยากร", "ค่าจ้างเหมาบริการ"],

  receipts: [
    {
      id: "receipt001", projectId: "project001", confirmedAmount: 350, confirmedDate: "2026-08-20",
      confirmedCategory: "ค่าเดินทาง", confirmedVendorName: "ร้านถ่ายเอกสาร ABC",
      status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด",
      isExported: false,
    },
    {
      id: "receipt002", projectId: "project001", confirmedAmount: 1800, confirmedDate: "2026-08-21",
      confirmedCategory: "ค่าวัสดุ", confirmedVendorName: "ร้านเครื่องเขียนสยาม",
      status: "ต้องแก้ไข", aiExplanation: "ยอดเงินที่ระบุเกินวงเงินสูงสุดของหมวดค่าวัสดุ กรุณาแนบใบเสร็จแยกตามหมวดหรือปรับยอด",
      isExported: false,
    },
    {
      id: "receipt003", projectId: "project001", confirmedAmount: 500, confirmedDate: "2026-08-22",
      confirmedCategory: "ค่าอาหาร", confirmedVendorName: "ร้านอาหารครัวคุณแม่",
      status: "ไม่เข้าเงื่อนไข", aiExplanation: "ระเบียบของแหล่งทุนนี้ไม่อนุญาตให้เบิกค่าอาหารในหมวดนี้ กรุณาตรวจสอบระเบียบของแหล่งทุนอีกครั้ง",
      isExported: false,
    },
    {
      id: "receipt004", projectId: "project002", confirmedAmount: 2500, confirmedDate: "2026-08-23",
      confirmedCategory: "ค่าเดินทาง", confirmedVendorName: "บริษัท ทัวร์แอนด์แทรเวล จำกัด",
      status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์ครบถ้วน มีเอกสารประกอบตามที่ระเบียบกำหนด",
      isExported: false,
    },
    {
      id: "receipt005", projectId: "project002", confirmedAmount: 120, confirmedDate: "2026-08-24",
      confirmedCategory: "ค่าวัสดุ", confirmedVendorName: "ร้านถ่ายเอกสาร ABC",
      status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด",
      isExported: false,
    },
  ],

  files: [
    { receiptId: "receipt001", originalFileName: "receipt_travel_01.jpg", fileType: "jpg", fileSizeBytes: 1200000, sortOrder: 1 },
    { receiptId: "receipt002", originalFileName: "receipt_material_01.pdf", fileType: "pdf", fileSizeBytes: 800000, sortOrder: 1 },
    { receiptId: "receipt003", originalFileName: "receipt_food_01.jpg", fileType: "jpg", fileSizeBytes: 950000, sortOrder: 1 },
    { receiptId: "receipt004", originalFileName: "receipt_van_01.jpg", fileType: "jpg", fileSizeBytes: 1500000, sortOrder: 1 },
    { receiptId: "receipt005", originalFileName: "receipt_material_02.png", fileType: "png", fileSizeBytes: 600000, sortOrder: 1 },
  ],
};

// กฎ mock ง่ายๆ แทน Rule Engine จริง (FR-04) — ใช้เฉพาะตอนกรอกฟอร์มมือใน new-receipt.html
// ของจริงต้องอ้างอิงระเบียบของ FundSource ที่ Project สังกัดอยู่ (เวอร์ชัน active ณ วันตรวจ)
// อันนี้เป็นแค่ mock ให้เห็นสถานะหลากหลายทันทีตอนทดสอบ ไม่ใช่กฎระเบียบทุนวิจัยจริง
window.mockRuleEngine = function (category, amount) {
  if (category === "ค่าอาหาร") {
    return { status: "ไม่เข้าเงื่อนไข", aiExplanation: "ระเบียบของแหล่งทุนนี้ไม่อนุญาตให้เบิกค่าอาหารในหมวดนี้ กรุณาตรวจสอบระเบียบของแหล่งทุนอีกครั้ง" };
  }
  if (amount > 2000) {
    return { status: "ต้องแก้ไข", aiExplanation: "ยอดเงินที่ระบุค่อนข้างสูง กรุณาตรวจสอบว่ามีเอกสารประกอบครบตามระเบียบของแหล่งทุนหรือไม่" };
  }
  return { status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เบื้องต้นเพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด" };
};
