// ─────────────────────────────────────────────────────────────
// js/receipt-store.js — การอ่าน Firestore ที่หน้าอัปโหลดใบเดียว (new-receipt.js) และหน้านำเข้าไฟล์สแกน
// ทั้งโครงการ (batch-import.js) ใช้ร่วมกัน: ข้อมูลอ้างอิงกลาง, ชุดกฎที่ active, ประมาณการ, เลขใบเสร็จถัดไป
// ใช้ตัวแปร db จาก js/firebase-config.js — ผู้เรียกต้อง await window.AUTH_READY ก่อนทุกครั้ง
// ─────────────────────────────────────────────────────────────
window.ReceiptStore = (function () {
  // ชุดเอกสาร (evidenceChains) และประเภทเอกสาร (documentTypes) เป็นข้อมูลกลางของมหาวิทยาลัย ไม่ผูกแหล่งทุน
  // documentTypesById เก็บฟิลด์เต็ม (formCode, requiredFields) เพราะตัวจัดประเภท/ดึงฟิลด์ต้องใช้
  async function loadReferenceData() {
    var evidenceChainsById = {};
    var documentNames = {};
    var documentTypesById = {};
    var snaps = await Promise.all([db.collection("evidenceChains").get(), db.collection("documentTypes").get()]);
    snaps[0].forEach(function (d) { evidenceChainsById[d.id] = d.data(); });
    snaps[1].forEach(function (d) {
      documentNames[d.id] = d.data().documentName;
      documentTypesById[d.id] = d.data();
    });
    return { evidenceChainsById: evidenceChainsById, documentNames: documentNames, documentTypesById: documentTypesById };
  }

  // ชุดกฎของเวอร์ชันที่ active ทั้งชุด ในรูปที่ js/rule-engine.js และ js/llm-verdict.js รับ — null = ไม่พบแหล่งทุน
  async function loadActiveRuleSet(fundSourceId, evidenceChainsById) {
    if (!fundSourceId) return null;
    var fundSourceDoc = await db.collection("fundSources").doc(fundSourceId).get();
    if (!fundSourceDoc.exists) return null;
    // แหล่งทุนปิดใช้งาน (FR-35): ยังตรวจด้วยกฎเดิม แต่ rule engine จะแจ้งเตือนในคำอธิบาย
    var fundSourceActive = fundSourceDoc.data().isActive !== false;
    var versionsSnap = await db.collection("fundSources").doc(fundSourceId)
      .collection("ruleVersions").where("isActive", "==", true).limit(1).get();
    if (versionsSnap.empty) {
      return { fundSourceId: fundSourceId, fundSourceActive: fundSourceActive, ruleVersionId: null, versionLabel: null, ruleItems: [], evidenceChains: evidenceChainsById };
    }
    var versionDoc = versionsSnap.docs[0];
    var itemsSnap = await versionDoc.ref.collection("ruleItems").get();
    return {
      fundSourceId: fundSourceId,
      fundSourceActive: fundSourceActive,
      ruleVersionId: versionDoc.id,
      versionLabel: versionDoc.data().versionLabel || null,
      ruleItems: itemsSnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }),
      evidenceChains: evidenceChainsById,
    };
  }

  function projectRef(uid, projectId) {
    return db.collection("users").doc(uid).collection("projects").doc(projectId);
  }

  async function loadBudgetLines(uid, projectId) {
    var snap = await projectRef(uid, projectId).collection("budgetLines").orderBy("order").get();
    return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
  }

  // ประมาณการทั้งโครงการพร้อมยอดที่เบิกไปแล้วต่อรายการ (นับจาก budgetLineId บนใบเสร็จที่บันทึกไว้แล้ว)
  // เป็นทั้งข้อมูลดิบให้ LLM และรายการให้ rule engine จับคู่ (ruleCategory, quantity)
  async function estimateWithSpent(uid, projectId, lines) {
    var spent = {};
    var snap = await projectRef(uid, projectId).collection("receipts").get();
    snap.forEach(function (d) {
      var r = d.data();
      if (r.budgetLineId) spent[r.budgetLineId] = (spent[r.budgetLineId] || 0) + (r.confirmedAmount || 0);
    });
    return lines.map(function (l) {
      return {
        id: l.id, group: l.group || "", itemName: l.itemName, multiplierText: l.multiplierText || "",
        total: l.total, quantity: typeof l.quantity === "number" ? l.quantity : null,
        ruleCategory: l.ruleCategory || null, spentBefore: spent[l.id] || 0,
      };
    });
  }

  // ประมาณการสำหรับตรวจใบเสร็จที่บันทึกไว้แล้วซ้ำ (ตรวจซ้ำ/ฉบับแก้ไข): หักยอดของใบนี้ออกจากรายการเดิมของมัน
  // เพราะตอนตรวจ ใบนี้ยังไม่นับว่าเบิกแล้ว — ไม่งั้นยอดของตัวเองถูกนับซ้ำ
  async function estimateExcluding(uid, projectId, lines, receipt) {
    return (await estimateWithSpent(uid, projectId, lines)).map(function (l) {
      if (l.id === receipt.budgetLineId && typeof receipt.confirmedAmount === "number") {
        return Object.assign({}, l, { spentBefore: Math.max(0, l.spentBefore - receipt.confirmedAmount) });
      }
      return l;
    });
  }

  // เลขสูงสุดของ receipt001, receipt002, ... ของผู้ใช้คนนี้ข้ามทุกโครงการ (รหัสเรียงต่อกันต่อเจ้าของ)
  async function maxReceiptNumber(uid) {
    var snapshot = await db.collectionGroup("receipts").where("ownerUserId", "==", uid).get();
    var max = 0;
    snapshot.forEach(function (doc) {
      var m = doc.id.match(/^receipt(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return max;
  }

  function receiptIdFor(n) {
    return "receipt" + String(n).padStart(3, "0");
  }

  return {
    loadReferenceData: loadReferenceData,
    loadActiveRuleSet: loadActiveRuleSet,
    projectRef: projectRef,
    loadBudgetLines: loadBudgetLines,
    estimateWithSpent: estimateWithSpent,
    estimateExcluding: estimateExcluding,
    maxReceiptNumber: maxReceiptNumber,
    receiptIdFor: receiptIdFor,
  };
})();
