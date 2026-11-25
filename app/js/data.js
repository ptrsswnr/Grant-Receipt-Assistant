// ─────────────────────────────────────────────────────────────
// js/data.js — ข้อมูลตัวอย่างสำหรับ seed.html และตัวเลือกในฟอร์ม new-receipt.html
// โครงสร้างเชิงตรรกะตรงกับ docs/02-design/02-technical/db-spec.md (แก้ไข 2026-09-03):
// FundSource (แหล่งทุน, ไม่มีเจ้าของ) --< Project (โครงการวิจัย, 1 เจ้าของ/โครงการ) --< Receipt
// FundSource --< RuleVersion --< RuleItem
// (การจัดเก็บจริงใน Firestore เป็น subcollection ซ้อนตามความเป็นเจ้าของ — ดู js/seed.js ที่ path
// จริง เอกสารนี้เก็บแค่รายการข้อมูลตัวอย่างแบบ flat ไว้ก่อน ยังไม่ผูก path)
// ยังไม่มี Rule Engine/OCR/LLM จริง (ดูเหตุผลใน SCOPE.md) — ค่า status/aiExplanation ของ receipts
// เป็นข้อมูลตัวอย่างที่คำนวณไว้ล่วงหน้าให้ตรงกับ ruleItems ด้านล่าง (ไม่ได้รันผ่าน checkAgainstRules()
// จริงตอน seed — ดู js/seed.js ซึ่งเขียนค่าตรงๆ ลง Firestore)
// ─────────────────────────────────────────────────────────────

window.RECEIPT_DATA = {
  users: [
    { id: "user001", fullName: "สมหญิง วิจัยดี", email: "somying@example.ac.th", roleType: "นักวิจัย/เจ้าของโครงการ" },
  ],

  // มีแหล่งทุนเดียว (ตัดสินใจโดยผู้ใช้ 2026-09-16 — ลบแหล่งทุน "สกว." ออกจากเว็บจริงแล้ว เพราะไม่มี
  // เอกสารระเบียบจริงของ สกว. ให้ใช้ในโปรเจกต์นี้) ระเบียบทั้งหมดของแหล่งทุนนี้อ้างอิงตัวเลขจริงจาก
  // "หลักการและวิธีการกำหนดค่าใช้จ่ายและงบประมาณ โครงการวิจัยที่เสนอขอรับเงินอุดหนุนจากมหาวิทยาลัย
  // แม่ฟ้าหลวง ประจำปีงบประมาณ พ.ศ. 2570" (คนละฉบับกับคู่มือปี 2566 ที่เคยอ้างอิงตอนออกแบบ schema
  // rateType เดิม — ตัวเลขบางตัวต่างกัน เช่น ค่าพาหนะส่วนตัว 4 บาท/กม. ไม่ใช่ 3.5 บาท/กม., ค่าที่พัก
  // ตามจริงไม่เกิน 1,800 บาท/วัน ไม่ใช่ 1,600 บาท/วัน — ให้ถือฉบับ 2570 นี้เป็นตัวอ้างอิงล่าสุด)
  fundSources: [
    { id: "fundsource002", fundSourceName: "ทุนภายในมหาวิทยาลัย ปี 2569", fundSourceCode: "MFU-2569" },
  ],

  projects: [
    { id: "project001", projectName: "พัฒนาโมเดล AI เพื่อการเกษตร", ownerUserId: "user001", fundSourceId: "fundsource002" },
    { id: "project002", projectName: "ศึกษาพฤติกรรมผู้บริโภคยุคดิจิทัล", ownerUserId: "user001", fundSourceId: "fundsource002" },
  ],

  // รายการหมวดค่าใช้จ่ายตรงตามรายการย่อยจริงในคู่มือฉบับ 2570 (ไม่ใช่แค่ 5 หมวดใหญ่ระดับบัญชี — คู่มือ
  // ใช้ 5 หมวดใหญ่ตอนตั้งงบล่วงหน้าเท่านั้น แต่ใบเสร็จแต่ละใบต้องเทียบกับ "รายการย่อย" ที่มีอัตรา/เพดาน
  // ของตัวเอง เช่น ค่าเดินทางมี 5 รายการย่อยคนละอัตรากัน จึงแยกเป็นหมวดคนละหมวดในระบบนี้ ไม่รวมเป็น
  // "ค่าเดินทาง" หมวดเดียวเหมือนก่อนหน้านี้) "ค่าตอบแทนคณะผู้วิจัย" ใส่ไว้ในรายการนี้โดยเจตนาแต่ไม่มี
  // ruleItem คู่กันเลย (ดู ruleItems ด้านล่าง) เพราะคู่มือระบุชัดว่ามหาวิทยาลัย "ไม่สนับสนุนให้ตั้ง
  // งบประมาณ" รายการนี้ — ใช้เป็นตัวอย่าง "ไม่เข้าเงื่อนไข" แทนที่ "ค่าอาหาร" แบบเดิม (ซึ่งจริงๆ คู่มือ
  // อนุญาตค่าอาหารในบริบทประชุม/อบรม จึงย้ายไปเป็นหมวดที่มีเพดานจริงแทนการปฏิเสธเสมอ)
  categories: [
    // ── ค่าจ้าง/ค่าตอบแทน ──
    "ค่าตอบแทนนักศึกษาช่วยงาน (วิชาการ)",
    "ค่าตอบแทนนักศึกษาช่วยงาน (ทั่วไป)",
    "ค่าตอบแทนอาสาสมัคร/ผู้ให้ข้อมูล",
    "ค่าตอบแทนผู้ทรงคุณวุฒิพิจารณาเครื่องมือ",
    "ค่าตอบแทนผู้ทรงคุณวุฒิ (ตรวจทาน Manuscript)",
    // ── ค่าใช้สอย ──
    "ค่าจ้างเหมาบริการ",
    "ค่าธรรมเนียมห้องปฏิบัติการ/เครื่องมือ",
    "ค่าอาหารกลางวัน (ประชุม/อบรม)",
    "ค่าอาหารว่างและเครื่องดื่ม (ประชุม/อบรม)",
    "ค่าเช่ายานพาหนะ (รถตู้)",
    "ค่าเบี้ยเลี้ยงเดินทาง",
    "ค่าที่พัก (โรงแรม)",
    "ค่าที่พัก (เหมาจ่าย พักบ้านญาติ/บ้านตนเอง)",
    "ค่าเครื่องบิน (ชั้นประหยัด)",
    "ค่าแท็กซี่ (เดินทางปฏิบัติงาน)",
    "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)",
    "ค่าธรรมเนียมการขอจริยธรรมการวิจัยในมนุษย์",
    "ค่าธรรมเนียมอื่นๆ",
    "ค่าถ่ายเอกสาร",
    "ค่าจัดทำรูปเล่มรายงานวิจัย",
    // ── ค่าวัสดุ ──
    "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ในจังหวัด)",
    "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ต่างจังหวัด)",
    "ค่าวัสดุคอมพิวเตอร์",
    "ค่าวัสดุโปรแกรมคอมพิวเตอร์/ค่าลิขสิทธิ์โปรแกรม",
    "ค่าวัสดุสำนักงาน",
    "ค่าวัสดุอื่นๆ",
    // ── ค่าสาธารณูปโภค ──
    "ค่าสาธารณูปโภค",
    // ── ค่าครุภัณฑ์ ──
    "ค่าครุภัณฑ์",
    // ── รายการที่คู่มือระบุว่ามหาวิทยาลัยไม่สนับสนุนให้ตั้งงบ (ไม่มี ruleItem คู่กันโดยเจตนา) ──
    "ค่าตอบแทนคณะผู้วิจัย",
  ],

  ruleVersions: [
    { id: "ruleversion002", fundSourceId: "fundsource002", versionLabel: "2570.5", isActive: true, importedByUserId: "user001" },
  ],

  // rateType: "เพดานตามจริง" (เบิกตามจริงไม่เกิน rateAmount) | "เหมาจ่าย" (จ่ายคงที่ rateAmount ต่อ unit)
  // | "ต่อหน่วย" (rateAmount ต่อ unit เช่น ต่อกิโลเมตร — ไม่มี cap ตายตัว, ระบบยังไม่เก็บ field ปริมาณ
  // จึงยังคูณจำนวนหน่วยให้อัตโนมัติไม่ได้) | "ตามข้อเสนอโครงการ" (ไม่มีเพดานระดับแหล่งทุนตายตัว — คู่มือ
  // ให้เป็นดุลยพินิจคณะกรรมการ หรือเป็น % ของงบ ไม่ใช่ตัวเลขบาทคงที่)
  // evidenceChainId: อ้างอิง evidenceChains[] ด้านล่าง — "ต้องมีเอกสารชุดไหนประกอบ" แยกจาก
  // rateType/rateAmount ("เกินวงเงินไหม") โดยเจตนา ดูหัวคอมเมนต์ evidenceChains/documentTypes
  //
  // ทุก ruleItem ด้านล่างอ้างอิง "หลักการและวิธีการกำหนดค่าใช้จ่ายและงบประมาณ ... ปีงบประมาณ พ.ศ. 2570"
  // (แชร์ให้ 2026-09-16) — note ของทุกตัวใส่ชื่อคู่มือกำกับไว้เสมอ เพื่อให้ checkAgainstRules()/
  // Level 2 agent อ้างอิงแหล่งที่มาได้เวลาอธิบายผลตรวจ
  // averaging: false (2570.5, 2026-11-25) = ห้ามถัวเฉลี่ยกับรายการอื่นในหมวด ใช้ได้ไม่เกินยอดของรายการตัวเองใน
  // ประมาณการ — ค่าเดินทาง (เจ้าของโครงการ: ตารางจัดทำประมาณการกำหนดไม่เกิน 25% ยังไม่ได้ตรวจกับเอกสาร) และ
  // รายการที่ระเบียบกำหนดเป็น % ของงบ ส่วนหมวดค่าตอบแทนและครุภัณฑ์ถัวไม่ได้ทั้งหมวดอยู่แล้ว (rule-engine.js)
  ruleItems: [
    { id: "ruleitem001", ruleVersionId: "ruleversion002", categoryName: "ค่าตอบแทนนักศึกษาช่วยงาน (วิชาการ)", rateType: "ต่อหน่วย", rateAmount: 60, unit: "ชั่วโมง", requiredEvidenceType: "แบบลงเวลาปฏิบัติงาน (วจ.7/วจ.8)", note: "คู่มือฯ ปีงบประมาณ 2570: จ้างได้ไม่เกิน 25% ของงบประมาณทั้งโครงการ", evidenceChainId: "chain-research-assistant", averaging: false },
    { id: "ruleitem002", ruleVersionId: "ruleversion002", categoryName: "ค่าตอบแทนนักศึกษาช่วยงาน (ทั่วไป)", rateType: "ต่อหน่วย", rateAmount: 30, unit: "ชั่วโมง", requiredEvidenceType: "แบบลงเวลาปฏิบัติงาน (วจ.7/วจ.8)", note: "คู่มือฯ ปีงบประมาณ 2570: จ้างได้ไม่เกิน 25% ของงบประมาณทั้งโครงการ", evidenceChainId: "chain-research-assistant", averaging: false },
    { id: "ruleitem003", ruleVersionId: "ruleversion002", categoryName: "ค่าตอบแทนอาสาสมัคร/ผู้ให้ข้อมูล", rateType: "เพดานตามจริง", rateAmount: 100, unit: "คน/ครั้ง", requiredEvidenceType: "ใบสำคัญรับเงิน (วจ.1)", note: "คู่มือฯ ปีงบประมาณ 2570 (ระดมสมอง/สัมภาษณ์/แบบสอบถาม — กรณีมีความเสี่ยงด้านสุขภาพให้เป็นดุลยพินิจคณะกรรมการพิจารณาข้อเสนอโครงการ)", evidenceChainId: "chain-honorarium" },
    { id: "ruleitem004", ruleVersionId: "ruleversion002", categoryName: "ค่าตอบแทนผู้ทรงคุณวุฒิพิจารณาเครื่องมือ", rateType: "เพดานตามจริง", rateAmount: 2000, unit: "คน", requiredEvidenceType: "ใบสำคัญรับเงิน สำหรับบุคคลภายนอก (วจ.6)", note: "คู่มือฯ ปีงบประมาณ 2570: พิจารณาตามความจำเป็นเหมาะสม", evidenceChainId: "chain-honorarium" },
    { id: "ruleitem005", ruleVersionId: "ruleversion002", categoryName: "ค่าตอบแทนผู้ทรงคุณวุฒิ (ตรวจทาน Manuscript)", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบสำคัญรับเงิน สำหรับบุคคลภายนอก (วจ.6) + CV ผู้ทรงคุณวุฒิ", note: "คู่มือฯ ปีงบประมาณ 2570: สนับสนุนไม่เกิน 10% ของงบประมาณโครงการ ต้องเป็นผู้ทรงคุณวุฒิที่มีความเชี่ยวชาญตรงสาขา แนบ CV ประกอบ", evidenceChainId: "chain-honorarium", averaging: false },

    { id: "ruleitem006", ruleVersionId: "ruleversion002", categoryName: "ค่าจ้างเหมาบริการ", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน/สัญญาจ้าง + TOR", note: "คู่มือฯ ปีงบประมาณ 2570: จ้างได้ไม่เกิน 25% ของงบประมาณในหมวดค่าใช้สอย เป็นไปตามดุลยพินิจคณะกรรมการพิจารณาข้อเสนอโครงการ ต้องแนบรายละเอียดคุณลักษณะงานจ้าง (TOR)", evidenceChainId: "chain-service-hire", averaging: false },
    { id: "ruleitem007", ruleVersionId: "ruleversion002", categoryName: "ค่าธรรมเนียมห้องปฏิบัติการ/เครื่องมือ", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570: เป็นไปตามอัตราที่หน่วยงานผู้ให้บริการกำหนด ทั้งภายในและภายนอกมหาวิทยาลัย", evidenceChainId: "chain-fee-payment" },
    { id: "ruleitem008", ruleVersionId: "ruleversion002", categoryName: "ค่าอาหารกลางวัน (ประชุม/อบรม)", rateType: "เพดานตามจริง", rateAmount: 150, unit: "คน/มื้อ", requiredEvidenceType: "ใบเสร็จรับเงิน + รายชื่อผู้เข้าร่วม", note: "คู่มือฯ ปีงบประมาณ 2570 (ค่าใช้จ่ายจัดประชุม/อบรมที่เกี่ยวข้องกับโครงการวิจัย — Focus group)", evidenceChainId: "chain-meeting-refreshment" },
    { id: "ruleitem009", ruleVersionId: "ruleversion002", categoryName: "ค่าอาหารว่างและเครื่องดื่ม (ประชุม/อบรม)", rateType: "เพดานตามจริง", rateAmount: 50, unit: "คน/มื้อ", requiredEvidenceType: "ใบเสร็จรับเงิน + รายชื่อผู้เข้าร่วม", note: "คู่มือฯ ปีงบประมาณ 2570 (ค่าใช้จ่ายจัดประชุม/อบรมที่เกี่ยวข้องกับโครงการวิจัย — Focus group)", evidenceChainId: "chain-meeting-refreshment" },
    { id: "ruleitem010", ruleVersionId: "ruleversion002", categoryName: "ค่าเช่ายานพาหนะ (รถตู้)", rateType: "เหมาจ่าย", rateAmount: 2000, unit: "คัน/วัน", requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570 (ยานพาหนะอื่นนอกจากรถตู้ ให้เป็นไปตามข้อตกลงระหว่างผู้ให้บริการ)", evidenceChainId: "chain-service-hire" },
    { id: "ruleitem011", ruleVersionId: "ruleversion002", categoryName: "ค่าเบี้ยเลี้ยงเดินทาง", rateType: "เหมาจ่าย", rateAmount: 350, unit: "วัน", requiredEvidenceType: "แบบรายงานการเดินทางไปปฏิบัติงาน (วจ.4)", note: "คู่มือฯ ปีงบประมาณ 2570 อ้างอิงระเบียบมหาวิทยาลัยแม่ฟ้าหลวง ว่าด้วยค่าใช้จ่ายในการเดินทางไปปฏิบัติงาน (ฉบับที่ 8) พ.ศ. 2566 — สนับสนุนเฉพาะนักวิจัย/ผู้ร่วมวิจัยที่เป็นผู้เดินทาง", evidenceChainId: "chain-travel-domestic", averaging: false },
    { id: "ruleitem012", ruleVersionId: "ruleversion002", categoryName: "ค่าที่พัก (โรงแรม)", rateType: "เพดานตามจริง", rateAmount: 1800, unit: "วัน", requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570: พักโรงแรม/ที่พักทั่วไปในประเทศ จ่ายตามจริงไม่เกิน 1,800 บาท/วัน (ถ้าพักบ้านญาติหรือบ้านตนเอง ให้ใช้หมวดค่าที่พักแบบเหมาจ่ายแทน)", evidenceChainId: "chain-travel-domestic", averaging: false },
    { id: "ruleitem013", ruleVersionId: "ruleversion002", categoryName: "ค่าเครื่องบิน (ชั้นประหยัด)", rateType: "เพดานตามจริง", rateAmount: 5500, unit: "เที่ยวไป-กลับ", requiredEvidenceType: "ใบเสร็จรับเงิน/ตั๋วโดยสาร", note: "คู่มือฯ ปีงบประมาณ 2570: ไม่เกินชั้นประหยัด ไป-กลับ ไม่เกิน 5,500 บาท", evidenceChainId: "chain-travel-domestic", averaging: false },
    { id: "ruleitem014", ruleVersionId: "ruleversion002", categoryName: "ค่าแท็กซี่ (เดินทางปฏิบัติงาน)", rateType: "เหมาจ่าย", rateAmount: 700, unit: "คน", requiredEvidenceType: "ใบรับรองการจ่ายเงิน (วจ.2)", note: "คู่มือฯ ปีงบประมาณ 2570: เหมาจ่ายเป็นรายบุคคลรวมเที่ยวไป-กลับ ไม่เกิน 700 บาท/คน (เฉพาะการเดินทางระหว่างที่พัก/สถานที่ปฏิบัติงานกับสถานียานพาหนะ)", evidenceChainId: "chain-travel-domestic", averaging: false },
    { id: "ruleitem015", ruleVersionId: "ruleversion002", categoryName: "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)", rateType: "ต่อหน่วย", rateAmount: 4, unit: "กม.", requiredEvidenceType: "สำเนาทะเบียนรถ", note: "คู่มือฯ ปีงบประมาณ 2570: อัตรา 4 บาท/กิโลเมตร (ประมาณการระยะทางจากกรมทางหลวง DOH to Travel หรือ Google Map) เฉพาะหัวหน้าโครงการ/ผู้ร่วมวิจัยที่เป็นผู้เดินทาง", evidenceChainId: "chain-travel-domestic", averaging: false },

    { id: "ruleitem016", ruleVersionId: "ruleversion002", categoryName: "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ในจังหวัด)", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570: 1,500 บาท/คัน/วัน เป็นอัตราเพื่อการตั้งคำของบประมาณเท่านั้น การเบิกจ่ายจริงให้จ่ายตามจริงโดยใช้หลักฐานใบเสร็จรับเงิน จึงตรวจยอดกับประมาณการที่อนุมัติแล้ว ไม่ใช้ตัวเลขนี้เป็นเพดาน", evidenceChainId: "chain-purchase" },
    { id: "ruleitem017", ruleVersionId: "ruleversion002", categoryName: "ค่าน้ำมันเชื้อเพลิงพาหนะเช่า (ต่างจังหวัด)", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570: 2,000 บาท/คัน/วัน เป็นอัตราเพื่อการตั้งคำของบประมาณเท่านั้น การเบิกจ่ายจริงให้จ่ายตามจริงโดยใช้หลักฐานใบเสร็จรับเงิน จึงตรวจยอดกับประมาณการที่อนุมัติแล้ว ไม่ใช้ตัวเลขนี้เป็นเพดาน", evidenceChainId: "chain-purchase" },
    { id: "ruleitem018", ruleVersionId: "ruleversion002", categoryName: "ค่าวัสดุคอมพิวเตอร์", rateType: "เพดานตามจริง", rateAmount: 5000, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570 (มูลค่าต่อหน่วย/ชุดไม่เกิน 20,000 บาท จึงจัดเป็นวัสดุ ไม่ใช่ครุภัณฑ์ — เช่น internal hard disk, หมึกเครื่องพิมพ์)", evidenceChainId: "chain-purchase" },
    { id: "ruleitem019", ruleVersionId: "ruleversion002", categoryName: "ค่าวัสดุสำนักงาน", rateType: "เพดานตามจริง", rateAmount: 5000, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570", evidenceChainId: "chain-purchase" },
    { id: "ruleitem020", ruleVersionId: "ruleversion002", categoryName: "ค่าวัสดุอื่นๆ", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "คู่มือฯ ปีงบประมาณ 2570 (วัสดุวิทยาศาสตร์/ไฟฟ้า/การเกษตร/งานบ้านงานครัว/เวชภัณฑ์ยาและไม่ใช่ยา) — ให้เป็นไปตามดุลยพินิจคณะกรรมการพิจารณาข้อเสนอโครงการ โดยคำนึงถึงความประหยัดและความเหมาะสม", evidenceChainId: "chain-purchase" },

    { id: "ruleitem021", ruleVersionId: "ruleversion002", categoryName: "ค่าสาธารณูปโภค", rateType: "เพดานตามจริง", rateAmount: 3000, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน/ใบแจ้งค่าบริการ", note: "คู่มือฯ ปีงบประมาณ 2570 (ไปรษณีย์/ขนส่งพัสดุ/โทรศัพท์/บัตรเติมเงิน/อินเทอร์เน็ต รวมกันไม่เกิน 3,000 บาท)", evidenceChainId: "chain-fee-payment" },

    { id: "ruleitem022", ruleVersionId: "ruleversion002", categoryName: "ค่าครุภัณฑ์", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสนอราคาอย่างน้อย 3 ราย + TOR", note: "คู่มือฯ ปีงบประมาณ 2570: ขอรับงบประมาณได้ไม่เกิน 25% ของงบประมาณโครงการ มหาวิทยาลัยสนับสนุนตามความสำคัญ/ความจำเป็นเร่งด่วน พิจารณาเป็นรายกรณี กรรมสิทธิ์เป็นของมหาวิทยาลัยเมื่อโครงการเสร็จสิ้น", evidenceChainId: "chain-equipment", averaging: false },
    // ── เพิ่ม 2026-11-15: รายการทางการในไฟล์ตัวช่วยทำตาราง 17.2 ที่ยังไม่มีกฎ ──
    { id: "ruleitem023", ruleVersionId: "ruleversion002", categoryName: "ค่าธรรมเนียมการขอจริยธรรมการวิจัยในมนุษย์", rateType: "เพดานตามจริง", rateAmount: 1500, unit: "โครงการ", requiredEvidenceType: "ใบเสร็จรับเงิน", note: "แบบเสนอโครงการวิจัย RS-01 ปีงบประมาณ 2570 ข้อ 17.2: ค่าธรรมเนียมการขอจริยธรรมการวิจัยในมนุษย์ (ถ้ามี 1,500 บาท/โครงการ)", evidenceChainId: "chain-fee-payment" },
    { id: "ruleitem024", ruleVersionId: "ruleversion002", categoryName: "ค่าธรรมเนียมอื่นๆ", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน + อัตราค่าบริการหรือใบเสนอราคา", note: "ไฟล์ตัวช่วยทำตาราง 17.2: ค่าธรรมเนียมอื่น - ระบุ (แนบอัตราค่าบริการหรือใบเสนอราคา) ไม่มีเพดานระดับแหล่งทุน", evidenceChainId: "chain-fee-payment" },
    { id: "ruleitem025", ruleVersionId: "ruleversion002", categoryName: "ค่าถ่ายเอกสาร", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "แบบเสนอโครงการ RS-01 ข้อ 17.2: ค่าบริการถ่ายเอกสาร ไม่มีเพดานระดับแหล่งทุน", evidenceChainId: "chain-fee-payment" },
    { id: "ruleitem026", ruleVersionId: "ruleversion002", categoryName: "ค่าจัดทำรูปเล่มรายงานวิจัย", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน", note: "แบบเสนอโครงการ RS-01 ข้อ 17.2: ค่าบริการจัดทำรูปเล่มรายงานวิจัยฯ ไม่มีเพดานระดับแหล่งทุน", evidenceChainId: "chain-fee-payment" },
    { id: "ruleitem027", ruleVersionId: "ruleversion002", categoryName: "ค่าวัสดุโปรแกรมคอมพิวเตอร์/ค่าลิขสิทธิ์โปรแกรม", rateType: "ตามข้อเสนอโครงการ", rateAmount: null, unit: null, requiredEvidenceType: "ใบเสร็จรับเงิน + TOR", note: "คู่มือการกรอกแบบฟอร์มฯ ฉบับปรับปรุง หน้า 47: จัดซื้อทุกรายการไม่ว่าราคาเท่าใด ต้องเสนอขอความเห็นชอบจากคณะกรรมการส่งเสริมและพัฒนางานวิจัยฯ ก่อนดำเนินการจัดซื้อเสมอ", evidenceChainId: "chain-equipment" },
    { id: "ruleitem028", ruleVersionId: "ruleversion002", categoryName: "ค่าที่พัก (เหมาจ่าย พักบ้านญาติ/บ้านตนเอง)", rateType: "เหมาจ่าย", rateAmount: 800, unit: "วัน", requiredEvidenceType: "ใบรับรองการจ่ายเงิน (วจ.2)", note: "คู่มือฯ ปีงบประมาณ 2570: เลือกเหมาจ่าย 800 บาท/วันแทนการจ่ายตามจริงได้ ใช้เมื่อพักบ้านญาติหรือบ้านตนเองที่ต่างจังหวัด ไม่มีใบเสร็จค่าที่พัก หลักฐานคือใบรับรองการจ่ายเงิน (วจ.2) อย่างเดียว (ฝ่ายการเงินยืนยัน 2026-11-17)", evidenceChainId: "chain-travel-flat-lodging", averaging: false },

    // "ค่าตอบแทนคณะผู้วิจัย" ไม่มี ruleItem คู่กันโดยเจตนา — คู่มือฯ ปีงบประมาณ 2570 ระบุชัดว่าเป็นรายการ
    // ที่ "มหาวิทยาลัยไม่สนับสนุนให้ตั้งงบประมาณ" checkAgainstRules() จะคืน "ไม่เข้าเงื่อนไข" ให้เองเพราะ
    // หาหมวดนี้ใน ruleItems ไม่เจอ (ดู categories ด้านบน)
  ],

  // ─────────────────────────────────────────────────────────────
  // documentTypes / evidenceChains — เพิ่ม 2026-09-12 หลังอ่านคู่มือจริงของมหาวิทยาลัยแม่ฟ้าหลวง
  // "คู่มือการกรอกแบบฟอร์มและตัวอย่างใบเสร็จโครงการวิจัย" (47 หน้า, แบบฟอร์ม วจ.1–วจ.9) พบว่าระเบียบจริง
  // ไม่ได้เช็คแค่ "ยอดเงินเกินวงเงินไหม" (ruleItems ด้านบน) แต่ทุกรายจ่ายต้องมีเอกสารมาเป็น "ชุด"
  // (เช่น ค่าเดินทาง = ขออนุมัติก่อนเดินทาง + ใบลา + รายงานเดินทางหลังกลับ + ใบเสร็จ/ใบสำคัญรับเงิน +
  // สำเนาบัตร ปชช.) — สองคอลเลกชันนี้แยกความกังวลนั้นออกจาก ruleItems โดยเจตนา ไม่ผูกกับแหล่งทุนใด
  // แหล่งทุนหนึ่ง (เป็น top-level collection เหมือน fundSources ไม่ nest) เพราะแบบฟอร์ม วจ.1–วจ.9
  // เป็นของมหาวิทยาลัยกลาง ใช้ร่วมกันได้ทุกแหล่งทุน ดู CLAUDE.md หัวข้อ "documentTypes/evidenceChains"
  // ─────────────────────────────────────────────────────────────

  // documentType: นิยาม "เอกสาร 1 ใบ" ว่าต้องมี field/ลายเซ็นอะไรถึงจะถือว่าสมบูรณ์ — ใช้ซ้ำได้ข้าม
  // หมวด/ข้ามแหล่งทุน (เช่น id-card-copy ใช้ทุกครั้งที่จ่ายเงินสดให้บุคคล ไม่ผูกกับหมวดใดหมวดหนึ่ง)
  documentTypes: [
    { id: "voucher-vj1", documentName: "ใบสำคัญรับเงิน (วจ.1)", formCode: "วจ.1", requiredFields: ["เลขที่ข้อตกลง/สัญญา", "ชื่อ-เลขบัตรประชาชนผู้รับเงิน", "ที่อยู่ตามบัตรประชาชน", "รายการและจำนวนเงิน", "ตราประทับจ่ายแล้ว", "ลายเซ็นผู้รับเงิน", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: ["บัตรประชาชนต้องไม่หมดอายุ ณ วันรับ-จ่ายเงิน", "ลายเซ็นผู้รับเงินต้องตรงกับสำเนาบัตรประชาชนที่แนบ"], sourceExcerpt: "ใช้เมื่อผู้รับเงินไม่สามารถออกใบเสร็จรับเงินได้ (บุคคลทั่วไป)" },
    { id: "payment-cert-vj2", documentName: "ใบรับรองการจ่ายเงิน (วจ.2)", formCode: "วจ.2", requiredFields: ["เลขที่ข้อตกลง/สัญญา", "รายละเอียดการจ่าย", "จำนวนเงิน", "ตราประทับจ่ายแล้ว", "ลายเซ็นหัวหน้าโครงการ", "วันที่"], validityChecks: [], sourceExcerpt: "ใช้เมื่อไม่อาจเรียกใบเสร็จ/ใบสำคัญรับเงินจากผู้รับเงินได้เลย (เช่น ค่าแท็กซี่) — หัวหน้าโครงการรับรองการจ่ายเอง" },
    { id: "travel-approval-vj3", documentName: "แบบขออนุมัติเดินทางไปปฏิบัติงานวิจัย (วจ.3)", formCode: "วจ.3", requiredFields: ["ข้อมูลผู้เดินทาง", "วัตถุประสงค์และสถานที่ปฏิบัติงาน", "ช่วงวันที่เดินทาง", "ประมาณการค่าใช้จ่ายรายรายการ", "ลายเซ็นผู้เดินทาง", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: ["ต้องจัดทำและอนุมัติก่อนวันเดินทางจริง"], sourceExcerpt: "เอกสารขออนุมัติล่วงหน้า — ไม่มีเอกสารนี้ ค่าเดินทางเบิกไม่ได้ไม่ว่ายอดเงินจะถูกเพดานแค่ไหน" },
    { id: "hr-leave-form", documentName: "แบบใบลา/ขอหยุดงาน", formCode: "-", requiredFields: ["เหตุผลการลา (เดินทางไปปฏิบัติงานวิจัย)", "ช่วงวันที่ลา", "ลายเซ็นผู้ลา", "ผลการพิจารณาอนุมัติ"], validityChecks: [], sourceExcerpt: "พิมพ์จากระบบ HR ของมหาวิทยาลัย (hr.mfu.ac.th) แนบคู่กับ วจ.3/วจ.4" },
    { id: "travel-report-vj4", documentName: "แบบรายงานการเดินทางไปปฏิบัติงาน (วจ.4)", formCode: "วจ.4", requiredFields: ["อ้างอิงเลขที่ วจ.3 ที่ได้รับอนุมัติ", "รายการค่าใช้จ่ายจริงตามจ่ายจริง/เหมาจ่าย", "ยอดรวม", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: ["ยอดรวมต้องอ้างอิงตามใบเสร็จที่แนบจริง"], sourceExcerpt: "จัดทำหลังเดินทางกลับ สรุปค่าใช้จ่ายจริงเทียบกับที่ขออนุมัติไว้ใน วจ.3" },
    { id: "id-card-copy", documentName: "สำเนาบัตรประจำตัวประชาชนผู้รับเงิน", formCode: "-", requiredFields: ["ลายเซ็นรับรองสำเนาถูกต้อง"], validityChecks: ["บัตรต้องไม่หมดอายุในวันรับ-จ่ายเงินโครงการ", "ลายเซ็นต้องตรงกับผู้รับเงินในใบสำคัญรับเงิน"], sourceExcerpt: "แนบทุกครั้งที่จ่ายเงินสดให้บุคคล (คู่กับ วจ.1/วจ.2/วจ.5/วจ.6/วจ.7/วจ.8)" },
    { id: "vehicle-registration-copy", documentName: "สำเนาใบข้อมูลทะเบียนรถ", formCode: "-", requiredFields: ["ลายเซ็นรับรองสำเนาถูกต้อง"], validityChecks: [], sourceExcerpt: "เฉพาะกรณีเบิกค่าน้ำมัน/ระยะทางโดยใช้รถยนต์ส่วนตัว" },
    { id: "receipt-return-vj5", documentName: "ใบสำคัญรับ (คืนเงิน) (วจ.5)", formCode: "วจ.5", requiredFields: ["ชื่อผู้คืนเงิน", "รายละเอียดยอดที่คืน", "ชื่อบัญชี/เลขที่บัญชีโครงการ", "ลายเซ็นผู้รับเงินคืน", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: [], sourceExcerpt: "ใช้เมื่อคืนเงินยืมทดรองที่เบิกเกินจริงเข้าบัญชีโครงการ" },
    { id: "honorarium-voucher-vj6", documentName: "ใบสำคัญรับเงิน สำหรับบุคคลภายนอก (วจ.6)", formCode: "วจ.6", requiredFields: ["รายการค่าตอบแทน/ที่พัก/พาหนะ (เลือกตามจริง)", "จำนวนเงินรวม", "ตราประทับจ่ายแล้ว", "ลายเซ็นผู้รับเงิน", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: [], sourceExcerpt: "ใช้กับอาสาสมัคร/ผู้ทรงคุณวุฒิ/วิทยากรที่ปฏิบัติงานให้โครงการ รวมค่าใช้จ่ายหลายประเภทในใบเดียว" },
    { id: "timesheet-fulltime-vj7", documentName: "แบบลงเวลาปฏิบัติงานผู้ช่วยวิจัย (Full Time) (วจ.7)", formCode: "วจ.7", requiredFields: ["วันเวลาเข้า-ออกรายวัน", "ภาระงานที่ปฏิบัติ", "ลายเซ็นผู้ปฏิบัติงานทุกวัน", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: ["ลงเวลาและลายเซ็นด้วยปากกาหมึกแห้งเท่านั้น"], sourceExcerpt: "ใช้ประกอบการเบิกค่าตอบแทนผู้ช่วยวิจัยเต็มเวลารายเดือน" },
    { id: "timesheet-parttime-vj8", documentName: "แบบลงเวลาปฏิบัติงานผู้ช่วยวิจัย (นักศึกษาช่วยงาน) (วจ.8)", formCode: "วจ.8", requiredFields: ["วันเวลาเข้า-ออกรายครั้ง", "ภาระงานที่ปฏิบัติ", "ลายเซ็นผู้ปฏิบัติงาน", "ลายเซ็นผู้รับรองการทำงาน", "ลายเซ็นหัวหน้าโครงการ"], validityChecks: ["ระบุเดือนที่ดำเนินการเพียง 1 เดือนต่อคนต่อฉบับ"], sourceExcerpt: "ใช้ประกอบการเบิกค่าตอบแทนนักศึกษาช่วยงาน (part-time)" },
    { id: "tax-invoice-full", documentName: "ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ", formCode: "-", requiredFields: ["เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)", "ชื่อ-ที่อยู่ผู้ขาย", "เลขที่เอกสารและวันที่", "รายการ+ปริมาณ+ราคาต่อหน่วย", "ภาษีมูลค่าเพิ่มแยกแสดง", "ยอดรวมสุทธิ", "ตราประทับจ่ายแล้ว"], validityChecks: ["กรณีซื้อสินค้า/บริการต้องมีตราประทับตรวจรับพัสดุ ลงนามโดยหัวหน้าโครงการเพิ่มด้วย", "ต้องเป็นใบเสร็จรับเงิน — ใบกำกับสินค้า/ใบส่งของ/ใบแจ้งหนี้อย่างเดียวใช้เบิกไม่ได้ (คู่มือฉบับปรับปรุง หน้า 40)"], sourceExcerpt: "รูปแบบใบเสร็จมาตรฐานสำหรับร้านค้า/บริษัทที่จดทะเบียนภาษีมูลค่าเพิ่ม" },
    { id: "tax-invoice-abbreviated", documentName: "ใบกำกับภาษีอย่างย่อ", formCode: "-", requiredFields: ["เลขประจำตัวผู้เสียภาษีอากร", "รายการและจำนวนเงิน", "วันที่"], validityChecks: ["ค่าไปรษณีย์: แนบใบรับรองการจ่ายเงิน และสำเนาใบเสร็จที่ลงนามรับรองสำเนาถูกต้อง เพราะต้นฉบับเป็นกระดาษคาร์บอนที่ตัวอักษรเลือนได้ (คู่มือฉบับปรับปรุง หน้า 41)"], sourceExcerpt: "เช่น ใบเสร็จค่าไปรษณีย์ — ถ้าไม่มีรายละเอียดสินค้าครบ ต้องแนบใบกำกับภาษี/ใบส่งของ/ใบแจ้งหนี้ประกอบเพิ่ม" },
    { id: "procurement-committee-cert", documentName: "ใบตรวจรับพัสดุ (กรรมการ 3 คน)", formCode: "-", requiredFields: ["ลายเซ็นกรรมการตรวจรับอย่างน้อย 3 คน"], validityChecks: [], sourceExcerpt: "บังคับเฉพาะกรณีซื้อ/จ้างเกิน 100,000 บาท — แทนที่การลงนามคนเดียวของหัวหน้าโครงการตามปกติ (คู่มือฉบับปรับปรุง หน้า 37; ฝ่ายการเงินยืนยัน 2026-11-17 ว่าไม่ต้องใช้ทุกครั้ง ตัวอย่างหน้า 50 ที่มีกรรมการ 3 คนเป็นเพียงตัวอย่าง)" },
    { id: "attendee-signin-sheet", documentName: "รายชื่อผู้เข้าร่วมกิจกรรมพร้อมลายมือชื่อ", formCode: "-", requiredFields: ["ชื่อ-นามสกุลผู้เข้าร่วมทุกคน", "ลายมือชื่อผู้เข้าร่วมทุกคน", "วันที่และชื่อกิจกรรม"], validityChecks: [], sourceExcerpt: "แนบคู่กับค่าอาหารว่าง/ค่าตอบแทนวิทยากรของกิจกรรมกลุ่ม (ประชุม/อบรม/สัมภาษณ์กลุ่ม)" },
    // เพิ่ม 2026-11-15 ตามคู่มือฉบับปรับปรุง
    { id: "committee-pre-approval", documentName: "หนังสืออนุมัติจากคณะกรรมการส่งเสริมและพัฒนางานวิจัยฯ (ก่อนดำเนินการ)", formCode: "-", requiredFields: ["รายการที่ขออนุมัติ", "วันที่อนุมัติ (ก่อนวันดำเนินการ)"], validityChecks: ["วันที่อนุมัติต้องก่อนวันที่ดำเนินการ/จ่ายเงินจริง", "รายการที่ไม่อยู่ในข้อเสนอโครงการต้องขออนุมัติเพิ่มรายการ"], sourceExcerpt: "ค่าตอบแทน ค่าจ้างเหมาที่มี TOR ค่าเดินทาง และงบครุภัณฑ์ ต้องได้รับอนุมัติก่อนการดำเนินการทุกกรณี (คู่มือฉบับปรับปรุง หน้า 3, 47–48)" },
    { id: "tor-document", documentName: "รายละเอียดงานจ้าง (TOR)", formCode: "-", requiredFields: ["ขอบเขตงาน", "ผลงานที่ต้องส่งมอบ", "ระยะเวลา", "ค่าจ้าง"], validityChecks: [], sourceExcerpt: "แนบกับค่าจ้างเหมาบริการและค่าเช่ายานพาหนะ (รายการตัวเลือกในไฟล์ตัวช่วยทำตาราง 17.2 ระบุ \"แนบ TOR\")" },
    { id: "inspection-photos", documentName: "รูปถ่ายพัสดุ ณ เวลาที่ตรวจรับ", formCode: "-", requiredFields: ["เห็นพัสดุที่ตรวจรับชัดเจนและถูกต้อง", "เห็นคณะกรรมการ/ผู้ตรวจรับขณะตรวจรับหรือทดสอบการใช้งาน"], validityChecks: [], sourceExcerpt: "ทุกครั้งที่มีการตรวจรับพัสดุ ให้ถ่ายรูปพัสดุ ณ เวลาที่ตรวจรับ แนบประกอบใบตรวจรับพัสดุหรือใบเสร็จรับเงิน (คู่มือฉบับปรับปรุง หน้า 49)" },
  ],

  // evidenceChain: นิยาม "ชุดเอกสาร" ที่ต้องมาครบสำหรับค่าใช้จ่ายประเภทหนึ่ง — ruleItems.evidenceChainId
  // อ้างมาที่นี่ (many ruleItems ต่อ 1 chain ได้) steps[].documentTypeIds เป็น array เพราะบางขั้นตอนมีเอกสาร
  // ทางเลือกที่ใช้แทนกันได้ (เช่น จ่ายเงินสดให้บุคคลใช้ วจ.1 หรือ วจ.2 อย่างใดอย่างหนึ่ง)
  // ปรับตาม "คู่มือการกรอกแบบฟอร์มและตัวอย่างใบเสร็จ ฉบับปรับปรุง" (52 หน้า) เมื่อ 2026-11-15:
  //  - ทุกชุดต้องยืนยันตรา "จ่ายแล้ว" (หน้า 6, 8, 23, 25–27)
  //  - ค่าตอบแทน ค่าจ้างเหมาที่มี TOR ค่าเดินทาง และครุภัณฑ์ ต้องได้รับอนุมัติจากคณะกรรมการส่งเสริมฯ
  //    ก่อนดำเนินการทุกกรณี (หน้า 3) — โปรแกรมคอมพิวเตอร์/ลิขสิทธิ์ก็เช่นกัน ไม่ว่าราคาเท่าใด (หน้า 47)
  //  - ซื้อสินค้า/จ้างทำของ: ตรา "ตรวจรับพัสดุ" ลงนามโดยหัวหน้าโครงการ (หน้า 6) และรูปถ่ายพัสดุขณะ
  //    ตรวจรับทุกครั้ง (หน้า 49)
  //  - ค่าธรรมเนียม/ค่าบริการที่ไม่ใช่พัสดุ แยกเป็น chain-fee-payment จึงไม่ต้องมีตราตรวจรับพัสดุ
  // attestations: สิ่งที่ต้องมี "บนตัวเอกสาร" (ตราประทับ/ลายเซ็น) ไม่ใช่เอกสารแยกใบ ให้นักวิจัยยืนยันเอง
  // จนกว่าจะตรวจจับจากภาพได้อัตโนมัติ
  evidenceChains: [
    {
      id: "chain-travel-domestic", chainName: "เดินทางในประเทศ",
      steps: [
        { order: 1, timing: "before", required: true, documentTypeIds: ["committee-pre-approval"], note: "ค่าเดินทางต้องได้รับอนุมัติก่อนเดินทาง (คู่มือฉบับปรับปรุง หน้า 3)" },
        { order: 2, timing: "before", required: true, documentTypeIds: ["travel-approval-vj3"] },
        { order: 3, timing: "before", required: true, documentTypeIds: ["hr-leave-form"] },
        { order: 4, timing: "after", required: true, documentTypeIds: ["travel-report-vj4"] },
        { order: 5, timing: "with", required: true, documentTypeIds: ["tax-invoice-full", "voucher-vj1", "payment-cert-vj2"], note: "หลักฐานการจ่ายจริงต่อรายการ (ที่พัก/ตั๋ว/แท็กซี่/น้ำมัน) เลือกตามประเภทผู้รับเงิน" },
        { order: 6, timing: "with", required: false, documentTypeIds: ["id-card-copy"], note: "จำเป็นเฉพาะกรณีจ่ายเงินสดให้บุคคลด้วย วจ.1/วจ.2" },
        { order: 7, timing: "with", required: false, documentTypeIds: ["vehicle-registration-copy"], note: "จำเป็นเฉพาะกรณีเบิกค่าน้ำมัน/ระยะทางด้วยรถยนต์ส่วนตัว" },
      ],
      conditionalSteps: [],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
      ],
    },
    {
      id: "chain-travel-flat-lodging", chainName: "ค่าที่พักแบบเหมาจ่าย (เดินทางในประเทศ)",
      steps: [
        { order: 1, timing: "before", required: true, documentTypeIds: ["committee-pre-approval"], note: "ค่าเดินทางต้องได้รับอนุมัติก่อนเดินทาง (คู่มือฉบับปรับปรุง หน้า 3)" },
        { order: 2, timing: "before", required: true, documentTypeIds: ["travel-approval-vj3"] },
        { order: 3, timing: "before", required: true, documentTypeIds: ["hr-leave-form"] },
        { order: 4, timing: "after", required: true, documentTypeIds: ["travel-report-vj4"] },
        { order: 5, timing: "with", required: true, documentTypeIds: ["payment-cert-vj2"], note: "พักบ้านญาติ/บ้านตนเองไม่มีใบเสร็จค่าที่พัก ใช้ใบรับรองการจ่ายเงิน (วจ.2) แทนได้เลย (ฝ่ายการเงินยืนยัน 2026-11-17)" },
      ],
      conditionalSteps: [],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
      ],
    },
    {
      id: "chain-honorarium", chainName: "ค่าตอบแทนบุคคลภายนอก (วิทยากร/ผู้ทรงคุณวุฒิ/อาสาสมัคร)",
      steps: [
        { order: 1, timing: "before", required: true, documentTypeIds: ["committee-pre-approval"], note: "ค่าตอบแทนต้องได้รับอนุมัติก่อนดำเนินการ (คู่มือฉบับปรับปรุง หน้า 3)" },
        { order: 2, timing: "with", required: true, documentTypeIds: ["honorarium-voucher-vj6", "voucher-vj1"] },
        { order: 3, timing: "with", required: true, documentTypeIds: ["id-card-copy"] },
        { order: 4, timing: "with", required: false, documentTypeIds: ["attendee-signin-sheet"], note: "จำเป็นเฉพาะกิจกรรมกลุ่ม (ประชุม/อบรม/สัมภาษณ์กลุ่ม) ไม่ใช่การจ่ายรายบุคคลทั่วไป" },
      ],
      conditionalSteps: [],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
      ],
    },
    {
      id: "chain-research-assistant", chainName: "ค่าตอบแทนผู้ช่วยวิจัย/นักศึกษาช่วยงาน",
      steps: [
        { order: 1, timing: "before", required: true, documentTypeIds: ["committee-pre-approval"], note: "ค่าตอบแทนต้องได้รับอนุมัติก่อนดำเนินการ (คู่มือฉบับปรับปรุง หน้า 3)" },
        { order: 2, timing: "with", required: true, documentTypeIds: ["timesheet-fulltime-vj7", "timesheet-parttime-vj8"], note: "เลือกตามประเภทการจ้าง (เต็มเวลา/นักศึกษาช่วยงาน)" },
        { order: 3, timing: "with", required: true, documentTypeIds: ["voucher-vj1"] },
        { order: 4, timing: "with", required: true, documentTypeIds: ["id-card-copy"] },
      ],
      conditionalSteps: [],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
      ],
    },
    {
      id: "chain-purchase", chainName: "ซื้อวัสดุ",
      steps: [
        { order: 1, timing: "with", required: true, documentTypeIds: ["tax-invoice-full", "tax-invoice-abbreviated", "voucher-vj1"], note: "ใบกำกับสินค้า/ใบส่งของ/ใบแจ้งหนี้อย่างเดียวใช้เบิกไม่ได้ (คู่มือฉบับปรับปรุง หน้า 40)" },
        { order: 2, timing: "with", required: true, documentTypeIds: ["inspection-photos"] },
      ],
      conditionalSteps: [
        { when: { field: "amount", op: ">", value: 100000 }, addStep: { documentTypeIds: ["procurement-committee-cert"], note: "ซื้อเกิน 100,000 บาท ต้องมีกรรมการตรวจรับพัสดุอย่างน้อย 3 คนลงนาม แทนหัวหน้าโครงการคนเดียว (ไม่เกินแสนไม่ต้องใช้ — ฝ่ายการเงินยืนยัน 2026-11-17)" } },
      ],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
        { id: "inspection-stamp", text: "ใบเสร็จมีตราประทับตรวจรับพัสดุ และหัวหน้าโครงการลงนามแล้ว" },
      ],
    },
    {
      id: "chain-service-hire", chainName: "จ้างเหมาบริการ / เช่ายานพาหนะ (มี TOR)",
      steps: [
        { order: 1, timing: "before", required: true, documentTypeIds: ["committee-pre-approval"], note: "ค่าจ้างเหมาที่มี TOR ต้องได้รับอนุมัติก่อนดำเนินการ (คู่มือฉบับปรับปรุง หน้า 3)" },
        { order: 2, timing: "before", required: true, documentTypeIds: ["tor-document"] },
        { order: 3, timing: "with", required: true, documentTypeIds: ["tax-invoice-full", "voucher-vj1"], note: "ใบแจ้งหนี้อย่างเดียวใช้เบิกไม่ได้ (คู่มือฉบับปรับปรุง หน้า 40)" },
        { order: 4, timing: "with", required: false, documentTypeIds: ["id-card-copy"], note: "จำเป็นเฉพาะกรณีผู้รับจ้างเป็นบุคคลและใช้ วจ.1" },
        { order: 5, timing: "with", required: false, documentTypeIds: ["inspection-photos"], note: "แนบเมื่องานจ้างมีชิ้นงานให้ตรวจรับ (คู่มือฉบับปรับปรุง หน้า 49)" },
      ],
      conditionalSteps: [
        { when: { field: "amount", op: ">", value: 100000 }, addStep: { documentTypeIds: ["procurement-committee-cert"], note: "จ้างเกิน 100,000 บาท ต้องมีกรรมการตรวจรับพัสดุอย่างน้อย 3 คนลงนาม (ไม่เกินแสนไม่ต้องใช้ — ฝ่ายการเงินยืนยัน 2026-11-17)" } },
      ],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
        { id: "inspection-stamp", text: "ใบเสร็จมีตราประทับตรวจรับพัสดุ และหัวหน้าโครงการลงนามแล้ว" },
      ],
    },
    {
      id: "chain-equipment", chainName: "ครุภัณฑ์ / โปรแกรมคอมพิวเตอร์",
      steps: [
        { order: 1, timing: "before", required: true, documentTypeIds: ["committee-pre-approval"], note: "ต้องได้รับความเห็นชอบก่อนจัดซื้อทุกรายการ ไม่ว่าราคาเท่าใด และรายการนอกข้อเสนอโครงการต้องขออนุมัติเพิ่ม (คู่มือฉบับปรับปรุง หน้า 47–48)" },
        { order: 2, timing: "with", required: true, documentTypeIds: ["tax-invoice-full", "tax-invoice-abbreviated"] },
        { order: 3, timing: "with", required: true, documentTypeIds: ["inspection-photos"] },
      ],
      conditionalSteps: [
        { when: { field: "amount", op: ">", value: 100000 }, addStep: { documentTypeIds: ["procurement-committee-cert"], note: "ซื้อเกิน 100,000 บาท ต้องมีกรรมการตรวจรับพัสดุอย่างน้อย 3 คนลงนาม (ไม่เกินแสนไม่ต้องใช้ — ฝ่ายการเงินยืนยัน 2026-11-17)" } },
      ],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
        { id: "inspection-stamp", text: "ใบเสร็จมีตราประทับตรวจรับพัสดุ และหัวหน้าโครงการลงนามแล้ว" },
      ],
    },
    {
      id: "chain-fee-payment", chainName: "ค่าธรรมเนียม / ค่าบริการ / สาธารณูปโภค",
      steps: [
        { order: 1, timing: "with", required: true, documentTypeIds: ["tax-invoice-full", "tax-invoice-abbreviated"], note: "ใบแจ้งหนี้อย่างเดียวใช้เบิกไม่ได้ ใบกำกับภาษีอย่างย่อค่าไปรษณีย์ให้แนบใบรับรองการจ่ายเงินและสำเนาใบเสร็จที่ลงนามรับรอง (คู่มือฉบับปรับปรุง หน้า 40–41)" },
      ],
      conditionalSteps: [],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
      ],
    },
    {
      id: "chain-meeting-refreshment", chainName: "ค่าอาหารว่างและเครื่องดื่ม/ค่าอาหาร (กิจกรรมกลุ่ม)",
      steps: [
        { order: 1, timing: "with", required: true, documentTypeIds: ["tax-invoice-full", "voucher-vj1"] },
        { order: 2, timing: "with", required: false, documentTypeIds: ["id-card-copy"], note: "จำเป็นเฉพาะกรณีใช้ วจ.1 (ผู้ขายไม่มีใบเสร็จ)" },
        { order: 3, timing: "with", required: true, documentTypeIds: ["attendee-signin-sheet"] },
      ],
      conditionalSteps: [],
      attestations: [
        { id: "paid-stamp", text: "เอกสารการจ่ายเงินทุกใบประทับตรา \"จ่ายแล้ว\" แล้ว" },
      ],
    },
  ],

  receipts: [
    {
      id: "receipt001", projectId: "project001", confirmedAmount: 350, confirmedDate: "2026-08-20",
      confirmedCategory: "ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)", confirmedVendorName: "-",
      status: "ผ่าน", aiExplanation: "หมวด \"ค่าพาหนะส่วนตัว (ต่อกิโลเมตร)\" เป็นประเภทต่อหน่วย (อัตราอ้างอิง ฿4.00 / กม.) — ระบบยังตรวจอัตโนมัติแบบเต็มรูปแบบไม่ได้ กรุณาให้เจ้าหน้าที่การเงินตรวจสอบยอดเงินอีกครั้ง หมายเหตุ: คู่มือฯ ปีงบประมาณ 2570: อัตรา 4 บาท/กิโลเมตร",
      isExported: false,
    },
    {
      id: "receipt002", projectId: "project001", confirmedAmount: 6500, confirmedDate: "2026-08-21",
      confirmedCategory: "ค่าวัสดุสำนักงาน", confirmedVendorName: "ร้านเครื่องเขียนสยาม",
      status: "ต้องแก้ไข", aiExplanation: "ยอดเงินที่ระบุ (฿6,500.00) เกินเพดานของหมวด \"ค่าวัสดุสำนักงาน\" ซึ่งกำหนดไว้ไม่เกิน ฿5,000.00 กรุณาตรวจสอบว่ามีเอกสารประกอบครบตามระเบียบของแหล่งทุนหรือไม่ หมายเหตุ: คู่มือฯ ปีงบประมาณ 2570",
      isExported: false,
    },
    {
      id: "receipt003", projectId: "project001", confirmedAmount: 5000, confirmedDate: "2026-08-22",
      confirmedCategory: "ค่าตอบแทนคณะผู้วิจัย", confirmedVendorName: "-",
      status: "ไม่เข้าเงื่อนไข", aiExplanation: "ระเบียบของแหล่งทุนนี้ไม่มีหมวด \"ค่าตอบแทนคณะผู้วิจัย\" กรุณาตรวจสอบว่าเลือกหมวดค่าใช้จ่ายถูกต้องหรือไม่ — คู่มือฯ ปีงบประมาณ 2570 ระบุว่ามหาวิทยาลัยไม่สนับสนุนให้ตั้งงบประมาณรายการนี้",
      isExported: false,
    },
    {
      id: "receipt004", projectId: "project002", confirmedAmount: 1500, confirmedDate: "2026-08-23",
      confirmedCategory: "ค่าที่พัก (โรงแรม)", confirmedVendorName: "บริษัท ทัวร์แอนด์แทรเวล จำกัด",
      status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด (฿1,800.00 / วัน) หมายเหตุ: คู่มือฯ ปีงบประมาณ 2570: จ่ายตามจริงไม่เกิน 1,800 บาท/วัน หรือเลือกเหมาจ่าย 800 บาท/วันแทนก็ได้ (เลือกวิธีใดวิธีหนึ่ง)",
      isExported: false,
    },
    {
      id: "receipt005", projectId: "project002", confirmedAmount: 3000, confirmedDate: "2026-08-24",
      confirmedCategory: "ค่าวัสดุคอมพิวเตอร์", confirmedVendorName: "ร้านถ่ายเอกสาร ABC",
      status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด (฿5,000.00) หมายเหตุ: คู่มือฯ ปีงบประมาณ 2570 (มูลค่าต่อหน่วย/ชุดไม่เกิน 20,000 บาท จึงจัดเป็นวัสดุ ไม่ใช่ครุภัณฑ์ — เช่น internal hard disk, หมึกเครื่องพิมพ์)",
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

// กฎ mock เก่า (ก่อน 2026-09-10) — **ไม่มีอะไรเรียกใช้ฟังก์ชันนี้แล้ว** เก็บไว้แค่เป็นตัวอย่างอ้างอิง
// เดิม `app/js/new-receipt.js` เคยเรียกฟังก์ชันนี้ตรงๆ แต่ตอนนี้เปลี่ยนไปใช้ checkAgainstRules()
// (ในไฟล์ new-receipt.js เอง) ที่อ่านจาก ruleItems ของแหล่งทุนจริงใน Firestore แทน hardcode ด้านล่าง
// (data-driven mock — ดู docs/05-log/20260910-log.md)
window.mockRuleEngine = function (category, amount) {
  if (category === "ค่าตอบแทนคณะผู้วิจัย") {
    return { status: "ไม่เข้าเงื่อนไข", aiExplanation: "ระเบียบของแหล่งทุนนี้ไม่อนุญาตให้เบิกหมวดนี้ กรุณาตรวจสอบระเบียบของแหล่งทุนอีกครั้ง" };
  }
  if (amount > 2000) {
    return { status: "ต้องแก้ไข", aiExplanation: "ยอดเงินที่ระบุค่อนข้างสูง กรุณาตรวจสอบว่ามีเอกสารประกอบครบตามระเบียบของแหล่งทุนหรือไม่" };
  }
  return { status: "ผ่าน", aiExplanation: "ใบเสร็จนี้ผ่านเกณฑ์เบื้องต้นเพราะอยู่ในหมวดที่อนุญาตและไม่เกินวงเงินที่กำหนด" };
};
