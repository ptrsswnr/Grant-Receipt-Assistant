// ─────────────────────────────────────────────────────────────
// js/receipt-check-agent.js — Level 2 Agentic AI (test only — see CLAUDE.md "AI receipt
// checking agent (Level 2, test only)"). Multi-step workflow that explains a submitted
// receipt's rule-engine result and, when something needs fixing, tells the researcher exactly
// which documents the fund source's own rules require:
//   1) read multiple sources — the evidenceChain matched to this rule item, and every
//      documentType it references (gatherEvidenceSources below) — all from Firestore, nothing
//      from the model's own training knowledge
//   2) summarize for user — one AI call (summarizeWithAi) that turns those sources into a
//      plain-language Thai explanation + concrete fix steps, explicitly instructed to use only
//      the data given and never invent a rule/document that isn't in it
//   3) write results — the caller (new-receipt.js) writes the returned explanation onto the
//      receipt doc's aiExplanation field
//   4) log actions — every run is logged to receipts/{receiptId}/agentLogs/{logId}, a
//      subcollection kept separate from the receipt's own fields and from its `files`
//      subcollection, specifically so the agent's reasoning/sources/output has its own audit
//      trail (see firestore.rules for its access rule, same owner-scoped pattern as `files`)
//
// This agent NEVER decides pass/ต้องแก้ไข/ไม่เข้าเงื่อนไข itself — that verdict is always the
// deterministic numeric comparison in new-receipt.js's checkAgainstRules(), passed in as
// opts.deterministicResult. Keeping the compliance decision 100% code-computed (not
// LLM-decided) is what makes "checks only the rules that were entered, never another source,
// never invented" true by construction — the AI's only job is explaining that decision and
// listing the fund source's own required documents, which is also why the prompt below tells
// it not to claim it has seen/verified the actually-attached files (it never receives them).
// ─────────────────────────────────────────────────────────────

// อ่านหลายแหล่งข้อมูล (ขั้นตอนที่ 1 ของ agent): evidenceChain ที่ ruleItem ของหมวดนี้ชี้ไป
// (ถ้ามี) แล้วอ่าน documentTypes ทุกตัวที่ evidenceChain นั้นอ้างถึง (steps + conditionalSteps)
async function gatherEvidenceSources(evidenceChainId) {
  if (!evidenceChainId) {
    return { evidenceChain: null, documentTypes: [] };
  }

  var chainDoc = await db.collection("evidenceChains").doc(evidenceChainId).get();
  if (!chainDoc.exists) {
    return { evidenceChain: null, documentTypes: [] };
  }
  var chain = Object.assign({ id: chainDoc.id }, chainDoc.data());

  var documentTypeIds = [];
  (chain.steps || []).forEach(function (step) {
    (step.documentTypeIds || []).forEach(function (id) {
      if (documentTypeIds.indexOf(id) === -1) documentTypeIds.push(id);
    });
  });
  (chain.conditionalSteps || []).forEach(function (conditionalStep) {
    ((conditionalStep.addStep && conditionalStep.addStep.documentTypeIds) || []).forEach(function (id) {
      if (documentTypeIds.indexOf(id) === -1) documentTypeIds.push(id);
    });
  });

  var documentTypes = [];
  for (var i = 0; i < documentTypeIds.length; i++) {
    var documentTypeDoc = await db.collection("documentTypes").doc(documentTypeIds[i]).get();
    if (documentTypeDoc.exists) {
      documentTypes.push(Object.assign({ id: documentTypeDoc.id }, documentTypeDoc.data()));
    }
  }
  return { evidenceChain: chain, documentTypes: documentTypes };
}

function documentNameById(documentTypes, id) {
  var match = documentTypes.filter(function (d) { return d.id === id; })[0];
  if (!match) return id;
  return match.documentName + (match.formCode && match.formCode !== "-" ? " (" + match.formCode + ")" : "");
}

// ข้อความสำรองแบบไม่ใช้ AI (ไม่มี key หรือ AI เรียกไม่สำเร็จ) — ยังคงแสดงชุดเอกสารที่ต้องเตรียม
// ได้ เพราะข้อมูลนี้มาจาก Firestore ตรงๆ ไม่ต้องพึ่ง AI เลย
function fallbackExplanation(opts, sources) {
  var text = opts.deterministicResult.aiExplanation;
  if (sources.evidenceChain && sources.documentTypes.length > 0) {
    var names = sources.documentTypes.map(function (d) { return d.documentName; }).join(", ");
    text += " เอกสารประกอบที่ระเบียบกำหนดสำหรับหมวดนี้ (\"" + sources.evidenceChain.chainName + "\"): " + names + " — กรุณาตรวจสอบว่าเตรียม/แนบครบตามนี้";
  }
  return text;
}

// สรุปให้ผู้ใช้ (ขั้นตอนที่ 2 ของ agent) — เรียก AI ครั้งเดียว ส่งเฉพาะข้อมูลที่อ่านมาจริงจาก
// Firestore เข้าไปในพรอมต์ พร้อมกำชับชัดเจนว่าห้ามใช้ความรู้อื่น ห้ามสมมติกฎ/เอกสารเพิ่ม
async function summarizeWithAi(opts, sources) {
  var lines = [];
  lines.push("คุณคือผู้ช่วยอธิบายผลตรวจใบเสร็จของมหาวิทยาลัย ข้อมูลด้านล่างนี้คือข้อมูลใบเสร็จและกฎที่เกี่ยวข้องทั้งหมดที่ดึงมาจากฐานข้อมูลจริงของระบบ");
  lines.push("ห้ามใช้ความรู้ภายนอกหรือกฎ/ระเบียบอื่นใดนอกเหนือจากที่ให้มานี้เด็ดขาด ห้ามสมมติกฎ เอกสาร หรือเงื่อนไขเพิ่มเอง ถ้าข้อมูลไม่พอให้บอกตรงๆ ว่าไม่พอ");
  lines.push("");
  lines.push("ข้อมูลใบเสร็จ: หมวด \"" + opts.category + "\" ยอดเงิน " + opts.amount + " บาท");
  lines.push("ผลตรวจตามระเบียบ (ตัดสินแล้วโดยระบบด้วยการเทียบตัวเลขตรงๆ ไม่ใช่หน้าที่ของคุณ ห้ามเปลี่ยนผลนี้): " + opts.deterministicResult.status + " — " + opts.deterministicResult.aiExplanation);

  if (sources.evidenceChain) {
    lines.push("");
    lines.push("ชุดเอกสารประกอบที่ระเบียบกำหนดสำหรับหมวดนี้ (\"" + sources.evidenceChain.chainName + "\"):");
    (sources.evidenceChain.steps || []).forEach(function (step) {
      var docNames = (step.documentTypeIds || []).map(function (id) {
        return documentNameById(sources.documentTypes, id);
      }).join(" หรือ ");
      lines.push("- ลำดับ " + step.order + " (" + step.timing + (step.required ? ", บังคับ" : ", ไม่บังคับ") + "): " + docNames + (step.note ? " — หมายเหตุ: " + step.note : ""));
    });
    (sources.evidenceChain.conditionalSteps || []).forEach(function (conditionalStep) {
      var conditionLabel = window.RuleEngine && window.RuleEngine.describeCondition
        ? window.RuleEngine.describeCondition(conditionalStep.when)
        : conditionalStep.when.field + " " + conditionalStep.when.op + " " + conditionalStep.when.value;
      lines.push("- เงื่อนไขเพิ่มเติม: ถ้า" + conditionLabel +
        " ต้องมีเอกสารเพิ่ม: " + ((conditionalStep.addStep && conditionalStep.addStep.documentTypeIds) || []).map(function (id) {
          return documentNameById(sources.documentTypes, id);
        }).join(", "));
    });
  } else {
    lines.push("");
    lines.push("หมวดนี้ไม่มีชุดเอกสารประกอบ (evidenceChain) กำหนดไว้ในระบบ");
  }

  lines.push("");
  lines.push("หน้าที่ของคุณ: เขียนคำอธิบายภาษาไทยที่เข้าใจง่าย (ไม่ใช้ศัพท์บัญชี) ไม่เกิน 5-6 ประโยค โดย:");
  lines.push("1) สรุปผลตรวจตามที่ระบบตัดสินไว้ข้างต้น (ห้ามเปลี่ยนผลเอง)");
  lines.push("2) ถ้ามีชุดเอกสารประกอบ ให้แจกแจงว่าต้องเตรียม/แนบเอกสารอะไรบ้าง ก่อน/หลังทำรายการเมื่อไหร่ ให้ผู้ใช้ตรวจสอบว่าตัวเองมีครบหรือยัง");
  lines.push("3) คุณไม่เห็นไฟล์ที่ผู้ใช้แนบจริง ห้ามอ้างว่าตรวจสอบไฟล์แนบแล้วหรือครบ/ไม่ครบ — บอกแค่ว่าตามระเบียบต้องมีอะไรบ้าง");
  lines.push("4) ถ้าผลตรวจคือ \"ต้องแก้ไข\" หรือ \"ไม่เข้าเงื่อนไข\" ให้บอกวิธีแก้ไขที่ทำได้จริงจากข้อมูลที่ให้มาเท่านั้น (เช่น ลดยอดเงิน เปลี่ยนหมวด เตรียมเอกสารที่ขาด) ห้ามแนะนำสิ่งที่ไม่มีอยู่ในข้อมูลนี้");

  return window.AiClient.chat([{ role: "user", content: lines.join("\n") }], { temperature: 0.2 });
}

// opts: { receiptRef, evidenceChainId, category, amount, deterministicResult }
// คืนค่าเป็นคำอธิบายสุดท้าย (string) ให้ caller เอาไปเขียนทับ aiExplanation บนเอกสาร receipt —
// ไม่ throw ออกไปนอกฟังก์ชันนี้เอง (ยกเว้นการเขียน agentLogs ล้มเหลว) เพื่อไม่ให้การอธิบายเพิ่มเติม
// ที่ล้มเหลวไปบล็อกการบันทึกใบเสร็จที่ทำสำเร็จไปแล้ว
window.runReceiptCheckAgent = async function (opts) {
  var startedAt = Date.now();
  var sources = await gatherEvidenceSources(opts.evidenceChainId);

  var explanation;
  var usedAi = false;
  try {
    if (window.AiClient && window.AiClient.isConfigured()) {
      explanation = await summarizeWithAi(opts, sources);
      usedAi = true;
    } else {
      explanation = fallbackExplanation(opts, sources);
    }
  } catch (err) {
    explanation = fallbackExplanation(opts, sources);
  }

  // บันทึก log การทำงานของ agent (ขั้นตอนที่ 4) — แยก subcollection จาก field อื่นของ receipt
  // และจาก files โดยเจตนา เพื่อให้มี audit trail ของ agent เองต่างหาก
  await opts.receiptRef.collection("agentLogs").add({
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    usedAi: usedAi,
    model: usedAi ? window.AiClient.describe() : null,
    category: opts.category,
    amount: opts.amount,
    deterministicStatus: opts.deterministicResult.status,
    evidenceChainId: opts.evidenceChainId || null,
    documentTypeIds: sources.documentTypes.map(function (d) { return d.id; }),
    finalExplanation: explanation,
    durationMs: Date.now() - startedAt,
  });

  return explanation;
};
