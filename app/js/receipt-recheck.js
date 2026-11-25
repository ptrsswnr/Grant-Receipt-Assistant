// ─────────────────────────────────────────────────────────────
// js/receipt-recheck.js — ตรวจใบเสร็จที่บันทึกไว้แล้วซ้ำด้วยระเบียบ ประมาณการ คำสำคัญ และ prompt ปัจจุบัน
// ใช้เฉพาะตอนพัฒนา/ปรับ prompt (ปุ่มแสดงเฉพาะ localhost — ดู budget.js) ผู้ใช้จริงตรวจซ้ำไม่ได้
//   - ไม่ OCR และไม่อ่านยอด/หมวด/ประเภทเอกสารใหม่ ใช้ค่าที่บันทึกไว้ (confirmed*, providedDocumentTypeIds)
//     และข้อความ OCR ที่เก็บไว้ (ocrRaw ของใบที่อัปโหลดทีละใบ หรือ importBatches/{id}/pages ของใบที่มาจาก
//     ไฟล์สแกนทั้งโครงการ)
//   - ตราประทับ (attestations) หาใหม่จากข้อความ OCR ที่เก็บไว้ด้วยคำสำคัญชุดปัจจุบัน เพราะคำสำคัญปรับได้
//     ระหว่างพัฒนา (เช่น เพิ่ม "ได้รับพัสดุ" 2026-11-25)
//   - ยอดที่ "เบิกไปแล้ว" ของประมาณการคิดจากใบเสร็จทุกใบในโครงการตอนนี้ ไม่รวมใบที่กำลังตรวจ
//   - ผลเดิมไม่ถูกทิ้ง: ย้ายไปต่อท้ายใน verdictHistory ก่อนเขียนผลใหม่ (ใช้เทียบในงานวิจัยได้)
// ขั้นตรวจใช้โมดูลเดียวกับการอัปโหลด: RuleEngine, LlmVerdict, ReceiptPipeline.decideVerdict, DocumentClassifier
// ─────────────────────────────────────────────────────────────
window.ReceiptRecheck = (function () {
  var Store = window.ReceiptStore;

  function verdictMode() {
    return (window.VERDICT_CONFIG && window.VERDICT_CONFIG.mode) || "llm";
  }

  function llmRecord(llm) {
    return window.LlmVerdict.record(llm);
  }

  function ruleCheckRecord(rc) {
    return {
      engineVersion: rc.engineVersion, reasonCode: rc.reasonCode, autoVerified: rc.autoVerified,
      fundSourceId: rc.fundSourceId, ruleVersionId: rc.ruleVersionId, ruleItemId: rc.ruleItemId,
      status: rc.status, explanation: rc.explanation,
      findings: rc.findings.map(function (f) { return { code: f.code, message: f.message }; }),
    };
  }

  // ข้อความ OCR ที่เก็บไว้ ในรูปเดียวกับตอนตรวจครั้งแรก
  // คืน { text: ข้อความรวมที่ส่งให้ LLM, parts: [ข้อความของแต่ละไฟล์/เอกสาร] ใช้หาคำบนตราประทับซ้ำ }
  async function storedOcr(receiptRef, r, documentNames) {
    if (r.ocrRaw && r.ocrRaw.length) {
      return {
        text: r.ocrRaw.map(function (f) { return f.fileName + ":\n" + (f.text || "(OCR อ่านไม่ได้/ไม่ได้เปิด OCR)"); }).join("\n\n"),
        parts: r.ocrRaw.map(function (f) { return f.text || ""; }),
      };
    }
    if (r.importBatchId) {
      var batchRef = receiptRef.parent.parent.collection("importBatches").doc(r.importBatchId);
      var pagesSnap = await batchRef.collection("pages").get();
      var textByPage = {};
      pagesSnap.forEach(function (d) { textByPage[d.data().page] = d.data().text || ""; });
      var members = r.documentClassification || [];
      var parts = members.map(function (m) {
        var texts = [];
        for (var p = m.pageFrom; p <= m.pageTo; p++) texts.push(textByPage[p] || "");
        return texts.join("\n").trim();
      });
      return {
        text: members.map(function (m, i) {
          return "เอกสาร #" + i + " หน้า " + m.pageFrom + (m.pageTo !== m.pageFrom ? "–" + m.pageTo : "") +
            " (" + (documentNames[m.documentTypeId] || "ไม่ทราบประเภท") + "):\n" + (parts[i] || "(OCR อ่านไม่ได้)");
        }).join("\n\n"),
        parts: parts,
      };
    }
    return { text: "", parts: [] };
  }

  // receiptRef: DocumentReference ของใบเสร็จ (users/{uid}/projects/{projectId}/receipts/{id})
  // คืน { status, explanation, previousStatus }
  // opts.dryRun: ตรวจแต่ไม่บันทึก — คืนผลเต็มเพื่อรันซ้ำหลายรอบตอนทดลอง prompt (ดู research/prompt-log.md)
  //   โดยไม่ทำให้ verdictHistory ยาวขึ้นทุกรอบ
  async function recheck(receiptRef, uid, opts) {
    opts = opts || {};
    var snap = await receiptRef.get();
    if (!snap.exists) throw new Error("ไม่พบใบเสร็จนี้");
    var r = snap.data();
    var projectRef = receiptRef.parent.parent;
    var projectId = projectRef.id;
    var project = (await projectRef.get()).data() || {};

    var ref = await Store.loadReferenceData();
    var ruleSet = await Store.loadActiveRuleSet(project.fundSourceId, ref.evidenceChainsById);
    var lines = await Store.loadBudgetLines(uid, projectId);
    // ยอดที่ใช้ไปของทุกรายการตอนนี้ แล้วหักใบนี้ออกจากรายการเดิมของมัน (ตอนตรวจ ใบนี้ยังไม่นับว่าเบิกแล้ว)
    var estimate = (await Store.estimateWithSpent(uid, projectId, lines)).map(function (l) {
      if (l.id === r.budgetLineId && typeof r.confirmedAmount === "number") {
        return Object.assign({}, l, { spentBefore: Math.max(0, l.spentBefore - r.confirmedAmount) });
      }
      return l;
    });

    var category = r.confirmedCategory || "";
    var amount = typeof r.confirmedAmount === "number" ? r.confirmedAmount : null;
    var ocr = await storedOcr(receiptRef, r, ref.documentNames);
    var attestationIds = ocr.parts.length && window.DocumentClassifier
      ? window.DocumentClassifier.detectAttestations(ocr.parts)
      : (r.confirmedAttestations || []);
    var evidence = { documentTypeIds: r.providedDocumentTypeIds || [], attestationIds: attestationIds };
    var budget = window.RuleEngine.budgetFromEstimate(category, estimate);
    var summary = typeof r.summaryAmount === "number" ? { amount: r.summaryAmount } : undefined;

    var ruleCheck = window.RuleEngine.evaluate(
      { category: category, amount: amount, evidence: evidence, budget: budget, summary: summary },
      ruleSet, ref.documentNames);
    ruleCheck.aiExplanation = ruleCheck.explanation;

    var mode = verdictMode();
    var llm = null;
    if (mode === "llm") {
      llm = ruleSet && window.AiClient && window.AiClient.isConfigured()
        ? await window.LlmVerdict.evaluateWithLlm(ocr.text, ruleSet, ref.documentNames,
            { category: category, amount: amount, estimate: estimate }, { config: window.AI_CONFIG })
        : { verdict: null, issues: [], rule_refs: [], recommendation: "", raw: null, model: null,
            promptVersion: window.LlmVerdict.PROMPT_VERSION, durationMs: 0,
            error: ruleSet ? "ไม่ได้ตั้งค่า AI" : "ไม่พบแหล่งทุนของโครงการนี้" };
    }
    var decided = window.ReceiptPipeline.decideVerdict(mode, ruleCheck, llm, window.RuleEngine.STATUS);
    if (opts.dryRun) {
      return { status: decided.status, explanation: decided.explanation, previousStatus: r.status || null,
        attestationIds: attestationIds, llmVerdict: llmRecord(llm), ruleCheck: ruleCheckRecord(ruleCheck), dryRun: true };
    }

    // ผลเดิมเก็บไว้ใน verdictHistory (serverTimestamp ใช้ในอาร์เรย์ไม่ได้ จึงใช้เวลาที่บันทึกไว้เดิม)
    var previous = {
      status: r.status || null, aiExplanation: r.aiExplanation || null, verdictMode: r.verdictMode || null,
      ruleCheck: r.ruleCheck || null, llmVerdict: r.llmVerdict || null, budgetLineId: r.budgetLineId || null,
      confirmedAttestations: r.confirmedAttestations || null,
      checkedAt: r.recheckedAt || r.uploadedAt || null,
    };
    await receiptRef.update({
      status: decided.status,
      aiExplanation: decided.explanation,
      verdictMode: mode,
      ruleCheck: ruleCheckRecord(ruleCheck),
      llmVerdict: llmRecord(llm),
      budgetLineId: ruleCheck.budgetLineId || null,
      confirmedAttestations: attestationIds,
      recheckedAt: firebase.firestore.FieldValue.serverTimestamp(),
      verdictHistory: firebase.firestore.FieldValue.arrayUnion(previous),
    });
    return { status: decided.status, explanation: decided.explanation, previousStatus: r.status || null, attestationIds: attestationIds };
  }

  return { recheck: recheck, storedOcr: storedOcr };
})();
