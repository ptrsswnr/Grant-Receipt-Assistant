// ─────────────────────────────────────────────────────────────
// js/document-pipeline.js — ไฟล์สแกน (PDF หลายหน้า) ที่มีเอกสารหลายใบปนกัน → รายการค่าใช้จ่าย
// ขั้นตอน (ผลแต่ละขั้นเก็บแยกกัน เพื่อวิเคราะห์ว่าความผิดพลาดเกิดที่ขั้นไหน):
//   1) OCR รายหน้า            — ทำนอกโมดูลนี้ (js/ocr-client.js) ส่งเข้ามาเป็น pages
//   2) แยกเอกสาร + จัดประเภท   — splitAndClassify: LLM บอกช่วงหน้าและประเภทของแต่ละใบ (เรียกครั้งเดียว)
//                               สำรองด้วยคำสำคัญ (js/document-classifier.js) เมื่อไม่มี AI หรือ LLM ตอบผิดรูป
//   3) ดึงฟิลด์                — extractDocumentFields: เอกสารจ่ายเงินใช้ฟิลด์ใบเสร็จเดิม (ยอด/วันที่/ร้าน/หมวด)
//                               เอกสารอื่นใช้ requiredFields ของ documentTypes (ไม่สร้าง schema ใหม่ต่อประเภท)
//   4) จัดกลุ่มเป็นรายการ       — groupIntoExpenses: LLM จัดกลุ่ม (เอกสารประกอบใบเดียวอยู่ได้หลายรายการ)
//                               สำรองด้วย "เอกสารจ่ายเงินขึ้นรายการใหม่ เอกสารที่ตามมาผูกกับใบก่อนหน้า"
//   5) จับคู่ประมาณการ + ตัดสิน — evaluateGroup: ใช้ rule engine / llm-verdict / receipt-pipeline ตัวเดียวกับ
//                               การอัปโหลดใบเดียว (js/new-receipt.js)
// ไม่มีขั้นตอนให้ผู้ใช้ยืนยันในขั้นใด ใช้ได้ทั้งเบราว์เซอร์ (window.DocumentPipeline) และ Node (require)
// ทุกฟังก์ชันที่เรียก AI รับ deps เข้ามา (DI) จึงทดสอบด้วย fake client ได้ และไม่ throw
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DocumentPipeline = api;
})(typeof self !== "undefined" ? self : this, function () {
  // เพิ่มเลขนี้ทุกครั้งที่แก้ prompt ของการแยก/ดึงฟิลด์/จัดกลุ่ม (prompt ตัดสินผลมีเลขของตัวเองใน llm-verdict.js)
  var PROMPT_VERSION = "1.0.0";
  // ตัดข้อความแต่ละหน้าตอนส่งให้ LLM แยกเอกสาร (หัวเอกสารอยู่ต้นหน้าเสมอ) เพื่อให้ไฟล์ร้อยหน้ายังส่งได้
  var SPLIT_CHARS_PER_PAGE = 1200;

  // เอกสารที่ "จ่ายเงิน" จริง — 1 รายการค่าใช้จ่าย (= ใบเสร็จ 1 รายการในระบบเดิม) มีเอกสารแบบนี้ 1 ใบ
  var PAYMENT_TYPE_IDS = ["tax-invoice-full", "tax-invoice-abbreviated", "voucher-vj1", "payment-cert-vj2", "honorarium-voucher-vj6"];

  function isPaymentType(id) {
    return PAYMENT_TYPE_IDS.indexOf(id) !== -1;
  }

  function noAi(deps) {
    return !deps || !deps.AiClient || !deps.AiClient.isConfigured(deps.config);
  }

  function aiModel(deps) {
    return deps && deps.AiClient ? deps.AiClient.modelName(deps.config, false) : null;
  }

  async function askJson(deps, prompt) {
    var raw = await deps.AiClient.chat([{ role: "user", content: prompt }], { config: deps.config, temperature: 0, fetchImpl: deps.fetchImpl });
    return { raw: raw, parsed: deps.AiClient.extractJson(raw) };
  }

  function typeListText(documentTypesById) {
    return Object.keys(documentTypesById).map(function (id) {
      var t = documentTypesById[id];
      return "[" + id + "] " + t.documentName + (t.formCode && t.formCode !== "-" ? " (แบบฟอร์ม " + t.formCode + ")" : "");
    }).join("\n");
  }

  // ข้อความของเอกสารหนึ่งใบ = ข้อความ OCR ของทุกหน้าในช่วงของมัน
  function documentText(pages, doc) {
    return pages.filter(function (p) { return p.page >= doc.pageFrom && p.page <= doc.pageTo; })
      .map(function (p) { return p.text || ""; }).join("\n");
  }

  // ─── ขั้นที่ 2: แยกเอกสาร + จัดประเภท ───

  // สำรอง: หน้าที่เจอหัวเอกสาร (คำสำคัญ) = เริ่มเอกสารใบใหม่; หน้าที่ไม่เจอ = หน้าต่อของใบก่อนหน้า
  function splitByKeywords(pages, documentTypesById, DocumentClassifier) {
    var docs = [];
    pages.forEach(function (p) {
      var typeId = DocumentClassifier.classifyDocument(p.text, documentTypesById);
      var last = docs[docs.length - 1];
      if (!last || typeId) docs.push({ pageFrom: p.page, pageTo: p.page, documentTypeId: typeId || null });
      else last.pageTo = p.page;
    });
    return docs;
  }

  // ผลแยกจาก LLM ต้องครอบคลุมหน้า 1..N พอดี เรียงต่อกัน ไม่ซ้อน — ประเภทที่ไม่มีในระบบเปลี่ยนเป็น null
  function validateSplit(documents, pageCount, documentTypesById) {
    if (!Array.isArray(documents) || !documents.length) return { ok: false, error: "ไม่มีรายการเอกสาร" };
    var docs = documents.map(function (d) {
      return {
        pageFrom: Number(d.pageFrom), pageTo: Number(d.pageTo),
        documentTypeId: d.documentTypeId && documentTypesById[d.documentTypeId] ? d.documentTypeId : null,
      };
    }).sort(function (a, b) { return a.pageFrom - b.pageFrom; });
    var expected = 1;
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (!Number.isInteger(d.pageFrom) || !Number.isInteger(d.pageTo) || d.pageFrom !== expected || d.pageTo < d.pageFrom) {
        return { ok: false, error: "ช่วงหน้าไม่ต่อเนื่องหรือซ้อนกันที่เอกสารลำดับ " + (i + 1) };
      }
      expected = d.pageTo + 1;
    }
    if (expected !== pageCount + 1) return { ok: false, error: "ช่วงหน้าไม่ครบ " + pageCount + " หน้า" };
    return { ok: true, documents: docs };
  }

  function buildSplitPrompt(pages, documentTypesById) {
    var parts = [
      "ด้านล่างคือข้อความ OCR ของไฟล์สแกนเอกสารเบิกจ่ายโครงการวิจัย ทีละหน้า ไฟล์เดียวอาจมีเอกสารหลายใบ และเอกสาร 1 ใบอาจมีหลายหน้า",
      "งาน: บอกว่าหน้าไหนถึงหน้าไหนคือเอกสาร 1 ใบ และเอกสารแต่ละใบเป็นประเภทใด เลือกประเภทจากรายการนี้เท่านั้น (ไม่ตรงประเภทใดให้ใช้ null):",
      typeListText(documentTypesById),
      "",
    ];
    pages.forEach(function (p) {
      var text = String(p.text || "").slice(0, SPLIT_CHARS_PER_PAGE);
      parts.push("=== หน้า " + p.page + " ===", text || "(หน้านี้ OCR อ่านไม่ได้)");
    });
    parts.push(
      "",
      "ทุกหน้าต้องอยู่ในเอกสารใบใดใบหนึ่งพอดี เรียงตามหน้า ไม่ซ้อนกัน ตอบเป็น JSON เท่านั้น:",
      '{"documents": [{"pageFrom": 1, "pageTo": 2, "documentTypeId": "<รหัสในวงเล็บเหลี่ยม หรือ null>"}]}'
    );
    return parts.join("\n");
  }

  // pages: [{ page (เริ่ม 1), text }] — คืน { documents, method: "llm"|"keyword", model, raw, error, promptVersion }
  // error ไม่ว่าง + method "keyword" = ลองใช้ LLM แล้วไม่สำเร็จ จึงใช้คำสำคัญแทน (เก็บสาเหตุไว้วิเคราะห์)
  async function splitAndClassify(pages, documentTypesById, deps) {
    var fallback = function (error, raw) {
      return { documents: splitByKeywords(pages, documentTypesById, deps.DocumentClassifier), method: "keyword", model: null, raw: raw || null, error: error, promptVersion: PROMPT_VERSION };
    };
    if (noAi(deps)) return fallback(null);
    var raw = null;
    try {
      var answer = await askJson(deps, buildSplitPrompt(pages, documentTypesById));
      raw = answer.raw;
      var checked = validateSplit(answer.parsed.documents, pages.length, documentTypesById);
      if (!checked.ok) return fallback("ผลแยกเอกสารจาก LLM ใช้ไม่ได้: " + checked.error, raw);
      return { documents: checked.documents, method: "llm", model: aiModel(deps), raw: raw, error: null, promptVersion: PROMPT_VERSION };
    } catch (err) {
      return fallback(err.message, raw);
    }
  }

  // ─── ขั้นที่ 3: ดึงฟิลด์ ───

  function cleanReceiptFields(obj, categories) {
    obj = obj || {};
    var amount = typeof obj.amount === "number" ? obj.amount : parseFloat(String(obj.amount == null ? "" : obj.amount).replace(/[,\s฿]/g, ""));
    return {
      amount: isFinite(amount) && amount > 0 ? amount : null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(obj.date || "") ? obj.date : null,
      vendorName: obj.vendorName ? String(obj.vendorName) : null,
      category: categories.indexOf(obj.category) !== -1 ? obj.category : null,
    };
  }

  function cleanRequiredFields(obj, requiredFields) {
    var out = {};
    requiredFields.forEach(function (name) {
      var v = obj && obj[name];
      out[name] = v == null || v === "" ? null : String(v);
    });
    return out;
  }

  function buildExtractPrompt(text, docType, categories, payment) {
    var name = docType ? docType.documentName : "เอกสารไม่ทราบประเภท";
    var head = [
      "ข้อความ OCR ของเอกสาร \"" + name + "\" จากโครงการวิจัย (อาจมีจุดที่ OCR อ่านผิด):",
      text || "(ไม่มีข้อความ)",
      "",
      "ดึงข้อมูลจากข้อความนี้เท่านั้น ห้ามเดา ถ้าไม่พบให้ใส่ null",
    ];
    if (payment) {
      return head.concat([
        "วันที่ตอบเป็นปี ค.ศ. รูปแบบ YYYY-MM-DD (ถ้าเอกสารเป็น พ.ศ. ให้ลบ 543) ยอดเงินคือยอดรวมสุทธิที่จ่ายจริง",
        "หมวดค่าใช้จ่ายต้องเป็นหนึ่งในรายการนี้เท่านั้น หรือ null:",
        categories.join(", "),
        "ตอบเป็น JSON เท่านั้น: {\"amount\": <ตัวเลข|null>, \"date\": \"YYYY-MM-DD\"|null, \"vendorName\": \"...\"|null, \"category\": \"...\"|null}",
      ]).join("\n");
    }
    var required = (docType && docType.requiredFields) || [];
    return head.concat([
      "ฟิลด์ที่ต้องดึง: " + (required.length ? required.join(", ") : "(ไม่มี)"),
      "ตอบเป็น JSON เท่านั้น: {\"fields\": {\"<ชื่อฟิลด์ตามรายการ>\": \"ค่าที่พบ\"|null}}",
    ]).join("\n");
  }

  // doc: { pageFrom, pageTo, documentTypeId } — คืน { kind: "payment"|"supporting", receipt, fields, method, model, raw, error }
  // receipt = ฟิลด์ใบเสร็จเดิม (เฉพาะเอกสารจ่ายเงิน) / fields = map ตาม requiredFields (เฉพาะเอกสารประกอบ)
  async function extractDocumentFields(doc, text, lines, documentTypesById, categories, deps) {
    var docType = (doc.documentTypeId && documentTypesById[doc.documentTypeId]) || null;
    var payment = isPaymentType(doc.documentTypeId);
    var required = (docType && docType.requiredFields) || [];
    var base = { kind: payment ? "payment" : "supporting", receipt: null, fields: null, method: null, model: null, raw: null, error: null, promptVersion: PROMPT_VERSION };

    var fallback = function (error, raw) {
      var out = Object.assign({}, base, { method: payment ? "ocr-heuristic" : "none", error: error, raw: raw || null });
      if (payment) {
        // OCR ที่เตรียมไว้ล่วงหน้า (batch) อาจมีแต่ข้อความ ไม่มีรายบรรทัด — แยกบรรทัดจากข้อความแทน
        var lineList = lines && lines.length ? lines : String(text || "").split("\n").map(function (t) { return { text: t }; });
        var f = deps.OcrClient ? deps.OcrClient.extractFields({ lines: lineList, text: text }) : {};
        out.receipt = { amount: f.amount || null, date: f.date || null, vendorName: f.vendorName || null, category: null };
      } else {
        out.fields = cleanRequiredFields({}, required);
      }
      return out;
    };
    if (noAi(deps)) return fallback(null);
    var raw = null;
    try {
      var answer = await askJson(deps, buildExtractPrompt(text, docType, categories, payment));
      raw = answer.raw;
      var out = Object.assign({}, base, { method: "llm", model: aiModel(deps), raw: raw });
      if (payment) out.receipt = cleanReceiptFields(answer.parsed, categories);
      else out.fields = cleanRequiredFields(answer.parsed && answer.parsed.fields, required);
      return out;
    } catch (err) {
      return fallback(err.message, raw);
    }
  }

  // ─── ขั้นที่ 4: จัดกลุ่มเป็นรายการค่าใช้จ่าย ───

  // สำรอง: เอกสารจ่ายเงินขึ้นรายการใหม่ เอกสารประกอบที่ตามมาผูกกับรายการล่าสุด (ก่อนเจอเอกสารจ่ายเงินใบแรก = ไม่ได้ผูก)
  function groupByPaymentDocuments(documents) {
    var groups = [];
    var unassigned = [];
    documents.forEach(function (d, i) {
      if (isPaymentType(d.documentTypeId)) groups.push({ documentIndexes: [i], paymentDocumentIndex: i });
      else if (groups.length) groups[groups.length - 1].documentIndexes.push(i);
      else unassigned.push(i);
    });
    return { groups: groups, unassigned: unassigned };
  }

  // กติกา: แต่ละรายการมีเอกสารจ่ายเงิน 1 ใบพอดี และเอกสารจ่ายเงินใบหนึ่งอยู่ได้รายการเดียว
  // เอกสารประกอบใบเดียวอยู่ได้หลายรายการ (เช่น วจ.3 ฉบับเดียวใช้กับทั้งค่าที่พักและค่าแท็กซี่ของทริปเดียวกัน)
  // เอกสารที่ไม่อยู่ในรายการใดเลยถูกเก็บเป็น unassigned ไม่ทิ้ง
  function validateGroups(parsed, documents) {
    if (!parsed || !Array.isArray(parsed.groups)) return { ok: false, error: "ไม่มี groups" };
    var usedPayments = {};
    var groups = [];
    for (var g = 0; g < parsed.groups.length; g++) {
      var idx = (parsed.groups[g].documentIndexes || []).map(Number).filter(function (i, k, arr) {
        return Number.isInteger(i) && i >= 0 && i < documents.length && arr.indexOf(i) === k;
      });
      var payments = idx.filter(function (i) { return isPaymentType(documents[i].documentTypeId); });
      if (payments.length !== 1) return { ok: false, error: "รายการที่ " + (g + 1) + " มีเอกสารจ่ายเงิน " + payments.length + " ใบ (ต้องมี 1 ใบ)" };
      if (usedPayments[payments[0]]) return { ok: false, error: "เอกสารจ่ายเงิน #" + payments[0] + " อยู่หลายรายการ" };
      usedPayments[payments[0]] = true;
      groups.push({ documentIndexes: idx.sort(function (a, b) { return a - b; }), paymentDocumentIndex: payments[0] });
    }
    var covered = {};
    groups.forEach(function (gr) { gr.documentIndexes.forEach(function (i) { covered[i] = true; }); });
    var missedPayments = documents.map(function (d, i) { return i; })
      .filter(function (i) { return isPaymentType(documents[i].documentTypeId) && !usedPayments[i]; });
    if (missedPayments.length) return { ok: false, error: "เอกสารจ่ายเงิน #" + missedPayments.join(", #") + " ไม่อยู่ในรายการใด" };
    var unassigned = documents.map(function (d, i) { return i; }).filter(function (i) { return !covered[i]; });
    return { ok: true, groups: groups, unassigned: unassigned };
  }

  function documentSummary(d, i, documentTypesById) {
    var t = documentTypesById[d.documentTypeId];
    var s = "#" + i + " หน้า " + d.pageFrom + (d.pageTo !== d.pageFrom ? "–" + d.pageTo : "") + ": " +
      (t ? t.documentName : "ไม่ทราบประเภท") + (isPaymentType(d.documentTypeId) ? " [เอกสารจ่ายเงิน]" : "");
    var r = d.extraction && d.extraction.receipt;
    if (r) s += " — ยอด " + (r.amount == null ? "?" : r.amount) + " บาท, วันที่ " + (r.date || "?") + ", ผู้รับเงิน/ร้าน " + (r.vendorName || "?") + ", หมวด " + (r.category || "?");
    var f = d.extraction && d.extraction.fields;
    if (f) {
      var known = Object.keys(f).filter(function (k) { return f[k]; }).map(function (k) { return k + ": " + f[k]; });
      if (known.length) s += " — " + known.join("; ");
    }
    return s;
  }

  function buildGroupPrompt(documents, documentTypesById) {
    return [
      "รายการเอกสารที่แยกได้จากไฟล์สแกนของโครงการวิจัย (เรียงตามหน้า):",
      documents.map(function (d, i) { return documentSummary(d, i, documentTypesById); }).join("\n"),
      "",
      "จัดกลุ่มเป็นรายการค่าใช้จ่าย: รายการละ 1 เอกสารจ่ายเงิน (ที่มีป้าย [เอกสารจ่ายเงิน]) พร้อมเอกสารประกอบของรายการนั้น",
      "เอกสารประกอบใบเดียวใส่ได้หลายรายการถ้าใช้ร่วมกันจริง (เช่น แบบขออนุมัติเดินทางฉบับเดียวของหลายค่าใช้จ่ายในทริปเดียว)",
      "เอกสารจ่ายเงินทุกใบต้องอยู่ในรายการของตัวเอง 1 รายการพอดี เอกสารที่ไม่เป็นของรายการใดให้ใส่ใน unassigned",
      "ตอบเป็น JSON เท่านั้น: {\"groups\": [{\"documentIndexes\": [0, 1], \"paymentDocumentIndex\": 0}], \"unassigned\": []}",
    ].join("\n");
  }

  // documents: ผลขั้นที่ 2+3 ({ pageFrom, pageTo, documentTypeId, extraction }) — คืน { groups, unassigned, method, model, raw, error }
  async function groupIntoExpenses(documents, documentTypesById, deps) {
    var fallback = function (error, raw) {
      var g = groupByPaymentDocuments(documents);
      return { groups: g.groups, unassigned: g.unassigned, method: "payment-order", model: null, raw: raw || null, error: error, promptVersion: PROMPT_VERSION };
    };
    if (noAi(deps)) return fallback(null);
    if (!documents.some(function (d) { return isPaymentType(d.documentTypeId); })) return fallback(null);
    var raw = null;
    try {
      var answer = await askJson(deps, buildGroupPrompt(documents, documentTypesById));
      raw = answer.raw;
      var checked = validateGroups(answer.parsed, documents);
      if (!checked.ok) return fallback("ผลจัดกลุ่มจาก LLM ใช้ไม่ได้: " + checked.error, raw);
      return { groups: checked.groups, unassigned: checked.unassigned, method: "llm", model: aiModel(deps), raw: raw, error: null, promptVersion: PROMPT_VERSION };
    } catch (err) {
      return fallback(err.message, raw);
    }
  }

  // ─── ขั้นที่ 5: จับคู่ประมาณการ + ตัดสิน ───

  // รายการแรกในประมาณการที่หมวดตรงกับหมวดของเอกสารจ่ายเงิน (วิธีเดียวกับการอัปโหลดใบเดียว)
  function matchBudgetLine(category, estimate) {
    if (!category || !estimate) return null;
    return estimate.filter(function (l) { return l.ruleCategory === category; })[0] || null;
  }

  // group: { documentIndexes, paymentDocumentIndex }; documents: ผลขั้นที่ 2+3 พร้อม text
  // ctx: { ruleSet, documentNames, documentTypesById, estimate (มี spentBefore ต่อรายการ — ผู้เรียกต้องบวกยอด
  //        ของรายการที่ตัดสินไปแล้วในไฟล์เดียวกันเข้าไปก่อนเรียกรายการถัดไป), verdictMode }
  // deps: { RuleEngine, LlmVerdict, ReceiptPipeline, DocumentClassifier, AiClient, config, fetchImpl }
  async function evaluateGroup(group, documents, ctx, deps) {
    var members = group.documentIndexes.map(function (i) { return documents[i]; });
    var payment = documents[group.paymentDocumentIndex];
    var r = (payment.extraction && payment.extraction.receipt) || {};
    var category = r.category || "";
    var amount = typeof r.amount === "number" && isFinite(r.amount) ? r.amount : null;

    var documentTypeIds = members.map(function (d) { return d.documentTypeId; })
      .filter(function (id, k, arr) { return id && arr.indexOf(id) === k; });
    var evidence = { documentTypeIds: documentTypeIds, attestationIds: deps.DocumentClassifier.detectAttestations(members.map(function (d) { return d.text; })) };

    var estimate = ctx.estimate || [];
    // รายการในประมาณการ + ยอดรวมของหมวด (ใช้ตรวจการถัวเฉลี่ยในหมวด) — ฟังก์ชันเดียวกับหน้าอัปโหลดใบเดียว
    var budget = deps.RuleEngine.budgetFromEstimate(category, estimate);

    var ruleCheck = deps.RuleEngine.evaluate({ category: category, amount: amount, evidence: evidence, budget: budget }, ctx.ruleSet, ctx.documentNames);
    ruleCheck.aiExplanation = ruleCheck.explanation;

    var ocrText = group.documentIndexes.map(function (i) {
      var d = documents[i];
      var t = ctx.documentTypesById[d.documentTypeId];
      return "เอกสาร #" + i + " หน้า " + d.pageFrom + (d.pageTo !== d.pageFrom ? "–" + d.pageTo : "") + " (" + (t ? t.documentName : "ไม่ทราบประเภท") + "):\n" + (d.text || "(OCR อ่านไม่ได้)");
    }).join("\n\n");

    var llm = null;
    if (ctx.verdictMode === "llm") {
      llm = await deps.LlmVerdict.evaluateWithLlm(ocrText, ctx.ruleSet, ctx.documentNames,
        { category: category, amount: amount, estimate: estimate }, { aiClient: deps.AiClient, config: deps.config, fetchImpl: deps.fetchImpl });
    }
    var decided = deps.ReceiptPipeline.decideVerdict(ctx.verdictMode, ruleCheck, llm, deps.RuleEngine.STATUS);
    return {
      category: category, amount: amount, date: r.date || "", vendorName: r.vendorName || "",
      evidence: evidence, budgetLineId: ruleCheck.budgetLineId || null,
      ruleCheck: ruleCheck, llmVerdict: llm, status: decided.status, explanation: decided.explanation,
    };
  }

  return {
    PROMPT_VERSION: PROMPT_VERSION,
    PAYMENT_TYPE_IDS: PAYMENT_TYPE_IDS,
    isPaymentType: isPaymentType,
    documentText: documentText,
    splitByKeywords: splitByKeywords,
    validateSplit: validateSplit,
    buildSplitPrompt: buildSplitPrompt,
    splitAndClassify: splitAndClassify,
    buildExtractPrompt: buildExtractPrompt,
    extractDocumentFields: extractDocumentFields,
    groupByPaymentDocuments: groupByPaymentDocuments,
    validateGroups: validateGroups,
    buildGroupPrompt: buildGroupPrompt,
    groupIntoExpenses: groupIntoExpenses,
    matchBudgetLine: matchBudgetLine,
    evaluateGroup: evaluateGroup,
  };
});
