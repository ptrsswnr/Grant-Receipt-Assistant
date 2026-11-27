// ─────────────────────────────────────────────────────────────
// js/budget.js — หน้าประมาณการค่าใช้จ่ายของโครงการ (budget.html?projectId=...)
// อ่าน/นำเข้า users/{uid}/projects/{projectId}/budgetLines/{lineId} จากไฟล์ตาราง 17.2 (แปลงด้วย
// js/budget-parser.js) และแสดงยอดใช้จ่ายสะสมต่อรายการจากใบเสร็จที่ผูก budgetLineId ไว้
// ─────────────────────────────────────────────────────────────
(async function () {
  var warningBox = document.getElementById("warningBox");
  var currentBudget = document.getElementById("currentBudget");
  var importPreview = document.getElementById("importPreview");
  var fileInput = document.getElementById("budgetFile");

  var projectId = new URLSearchParams(location.search).get("projectId");
  // ตรวจใหม่ใช้เฉพาะตอนพัฒนา/ปรับ prompt (เจ้าของโครงการ 2026-11-25) — ผู้ใช้จริงตรวจซ้ำไม่ได้ จึงแสดงปุ่ม
  // เฉพาะตอนเปิดผ่านเครื่องตัวเอง (localhost) ไม่แสดงบนเว็บจริง
  var DEV_TOOLS = ["localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) !== -1;
  var user = await window.AUTH_READY;

  function warn(message) {
    warningBox.textContent = message;
    warningBox.style.display = "block";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return "฿" + Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  }

  if (!projectId) {
    warn("ไม่ได้ระบุโครงการ — กรุณาเข้าหน้านี้จากปุ่ม \"ประมาณการและใบเสร็จ\" ในหน้าโครงการของฉัน");
    currentBudget.innerHTML = "";
    return;
  }

  var projectRef = db.collection("users").doc(user.uid).collection("projects").doc(projectId);
  var projectDoc = await projectRef.get();
  if (!projectDoc.exists) {
    warn("ไม่พบโครงการนี้ในบัญชีของคุณ");
    currentBudget.innerHTML = "";
    return;
  }
  document.getElementById("projectNameLine").textContent = "โครงการ: " + projectDoc.data().projectName;
  // ลบใบเสร็จทำที่หน้ารายการใบเสร็จ (มีขั้นตอนลบไฟล์ใน Drive ด้วย) จึงลิงก์ไว้ให้
  document.getElementById("pageActions").innerHTML =
    '<a class="btn btn-primary btn-sm" href="new-receipt.html?projectId=' + esc(projectId) + '">อัปโหลดใบเสร็จ</a>' +
    '<a class="btn btn-secondary btn-sm" href="receipts.html?projectId=' + esc(projectId) + '">ดูแบบรายการใบเสร็จ / ลบใบเสร็จ</a>' +
    (DEV_TOOLS ? '<button type="button" class="btn btn-secondary btn-sm" id="recheckAllButton" title="(เฉพาะตอนพัฒนา) ตรวจใบเสร็จทุกใบในโครงการนี้ใหม่ด้วยระเบียบ ประมาณการ และ prompt ปัจจุบัน">ตรวจใหม่ทุกใบ (dev)</button>' : '');

  var linesSnap = await projectRef.collection("budgetLines").orderBy("order").get();
  var receiptsSnap = await projectRef.collection("receipts").get();
  var spentByLine = {};
  var linkedReceiptCount = 0;
  var allReceipts = [];
  receiptsSnap.forEach(function (doc) {
    var r = doc.data();
    allReceipts.push({ id: doc.id, ref: doc.ref, data: r, files: [] });
    if (!r.budgetLineId) return;
    linkedReceiptCount++;
    spentByLine[r.budgetLineId] = (spentByLine[r.budgetLineId] || 0) + (r.confirmedAmount || 0);
  });
  allReceipts.sort(function (a, b) { return String(a.data.confirmedDate || "").localeCompare(String(b.data.confirmedDate || "")); });
  // ลิงก์ไฟล์แนบของแต่ละใบ — อ่านพร้อมกันทุกใบ อ่านไม่ได้ก็แสดงใบเสร็จต่อโดยไม่มีลิงก์
  await Promise.all(allReceipts.map(function (rec) {
    return rec.ref.collection("files").get().then(function (s) {
      rec.files = s.docs.map(function (d) { return d.data(); });
    }).catch(function () {});
  }));

  // ใบเสร็จของแต่ละรายการในประมาณการ (แสดงต่อท้ายรายการนั้นพร้อมคำแนะนำ) — ใบที่ไม่ผูกรายการที่มีอยู่จริงอยู่ใน "none"
  // จัดกลุ่มใหม่ทุกครั้งที่วาด เพราะนำเข้าประมาณการใหม่แล้วรายการเปลี่ยนได้
  var receiptsByLine = {};
  // ชื่ออ้างอิงสำหรับแปลงคำแนะนำ — รวมชื่อรายการในประมาณการปัจจุบัน
  var adviceNames = {};
  function adviceText(text) {
    return window.ReceiptPipeline ? window.ReceiptPipeline.humanizeAdvice(text, adviceNames) : text;
  }

  function groupReceipts() {
    adviceNames = window.ReceiptPipeline
      ? window.ReceiptPipeline.referenceNames(window.RECEIPT_DATA, linesSnap.docs.map(function (d) { return { id: d.id, itemName: d.data().itemName }; }))
      : {};
    var lineIds = {};
    linesSnap.forEach(function (doc) { lineIds[doc.id] = true; });
    receiptsByLine = {};
    allReceipts.forEach(function (rec) {
      var key = rec.data.budgetLineId && lineIds[rec.data.budgetLineId] ? rec.data.budgetLineId : "none";
      (receiptsByLine[key] = receiptsByLine[key] || []).push(rec);
    });
  }

  var STATUS_CHIP_CLASS = {
    "ผ่าน": "chip-status--pass",
    "ต้องแก้ไข": "chip-status--fix",
    "ต้องชี้แจง/ขออนุมัติ": "chip-status--approval",
    "ไม่เข้าเงื่อนไข": "chip-status--reject",
  };

  function fileLinksHtml(files) {
    // ไฟล์จากการนำเข้าไฟล์สแกนมีช่วงหน้าอยู่ในชื่อไฟล์แล้ว
    // ไฟล์ที่ถูกแทนที่ด้วยฉบับแก้ไข (supersededAt) ไม่แสดง
    var links = (files || []).filter(function (f) { return f.fileReference && !f.supersededAt; }).map(function (f) {
      return '<a href="' + esc(f.fileReference) + '" target="_blank" rel="noopener">' + esc(f.originalFileName || "ไฟล์แนบ") + '</a>';
    });
    return links.length ? '<span class="text-small">' + links.join(" · ") + '</span>' : "";
  }

  // ใบเสร็จ 1 ใบใต้รายการ: สถานะ ยอด วันที่ ร้าน ไฟล์ และคำแนะนำ
  // คำแนะนำพับไว้เสมอ (ยาวมากเมื่อ AI อธิบายหลายข้อ) — ตอนพับเห็นตัวอย่าง 2 บรรทัดแรก กดแล้วเห็นทั้งหมด
  function lineReceiptHtml(rec) {
    var r = rec.data;
    var chip = STATUS_CHIP_CLASS[r.status] || "chip-status--pending";
    var calloutKind = chip.replace("chip-status--", "").replace("pending", "reject");
    var html = '<li class="line-receipt"><div class="line-receipt__head">' +
      '<span class="chip-status ' + chip + '">' + esc(r.status || "ไม่ทราบสถานะ") + '</span>' +
      '<span class="line-receipt__amount">' + (typeof r.confirmedAmount === "number" ? money(r.confirmedAmount) : "-") + '</span>' +
      '<span class="text-small">' + esc([r.confirmedDate, r.confirmedVendorName, r.revisionCount ? "แก้ไขแล้ว " + r.revisionCount + " ครั้ง" : ""].filter(Boolean).join(" · ")) + '</span>' +
      fileLinksHtml(rec.files) +
      (window.ReceiptPipeline.isRevisable(r.status)
        ? '<a class="btn btn-secondary btn-sm" href="new-receipt.html?projectId=' + encodeURIComponent(projectId) + '&revise=' + encodeURIComponent(rec.id) + '">ส่งฉบับแก้ไข</a>'
        : '') +
      (DEV_TOOLS ? '<button type="button" class="btn btn-ghost btn-sm line-receipt__recheck" data-action="recheck-receipt" data-receipt-path="' + esc(rec.ref.path) + '" title="(เฉพาะตอนพัฒนา) ตรวจใบนี้ใหม่ด้วยระเบียบ ประมาณการ และ prompt ปัจจุบัน">ตรวจใหม่</button>' : '') +
      '</div>';
    if (r.aiExplanation) {
      var advice = adviceText(r.aiExplanation);
      html += '<details class="line-receipt__advice">' +
        '<summary><span class="line-receipt__advice-label">คำแนะนำ</span>' +
          '<span class="line-receipt__advice-preview">' + esc(advice.replace(/\s*\n\s*/g, " ")) + '</span>' +
          '<span class="line-receipt__advice-toggle"></span></summary>' +
        '<div class="rule-callout rule-callout--' + calloutKind + '"><p class="rule-callout__explain">' + esc(advice) + '</p></div>' +
        '</details>';
    }
    return html + '</li>';
  }

  // คอลัมน์สุดท้ายของแต่ละรายการ: ใบเสร็จที่เบิกจากรายการนั้นพร้อมคำแนะนำ
  function receiptsCellHtml(list) {
    var inner = list && list.length
      ? '<ul class="line-receipts">' + list.map(lineReceiptHtml).join("") + '</ul>'
      : '<span class="line-receipts--none">ยังไม่มีใบเสร็จ</span>';
    return '<td class="receipts-cell">' + inner + '</td>';
  }

  // ใบเสร็จที่ไม่ได้ผูกกับรายการใดในประมาณการ (ไม่อยู่ในประมาณการ หรืออัปโหลดก่อนมีประมาณการ)
  function unlinkedHtml() {
    var list = receiptsByLine.none;
    if (!list || !list.length) return "";
    return '<h3 style="margin-top:24px;">ใบเสร็จที่ไม่อยู่ในประมาณการ (' + list.length + ' ใบ)</h3>' +
      '<p class="text-small">ไม่ตรงกับรายการใดในประมาณการ — ต้องชี้แจงเหตุผลและขออนุมัติ</p>' +
      '<ul class="line-receipts" style="margin-top:8px;">' + list.map(lineReceiptHtml).join("") + '</ul>';
  }

  function renderCurrent() {
    groupReceipts();
    if (linesSnap.empty) {
      currentBudget.innerHTML = '<p class="text-body">ยังไม่ได้นำเข้าประมาณการ — นำเข้าจากไฟล์ด้านล่างก่อน แล้วจึงอัปโหลดใบเสร็จได้</p>' + unlinkedHtml();
      return;
    }
    // data-label ใช้ตอนจอแคบ: style.css แปลงแต่ละแถวเป็นการ์ดที่มีป้ายกำกับตัวเลขทุกช่อง
    var html = '<div class="budget-table-wrap"><table class="admin-table budget-table"><thead><tr>' +
      '<th>รายการ</th><th>ตั้งไว้</th><th>ใช้ไปแล้ว</th><th>คงเหลือ</th><th>ใช้ไป</th><th>ใบเสร็จและคำแนะนำ</th></tr></thead><tbody>';
    var group = null;
    var totals = { budget: 0, spent: 0 };
    // ยอดรวมรายหมวด — ใช้แสดงในแถวหัวหมวด และตัดสินว่ารายการที่เกินถัวจ่ายในหมวดได้หรือไม่
    // (กติกาเดียวกับ RuleEngine: หมวดค่าตอบแทน/ครุภัณฑ์ถัวไม่ได้ และรายการที่ระเบียบห้ามถัว averaging: false)
    var groupSums = {};
    linesSnap.forEach(function (doc) {
      var l = doc.data();
      var g = groupSums[l.group || ""] = groupSums[l.group || ""] || { total: 0, spent: 0 };
      g.total += l.total || 0;
      g.spent += spentByLine[doc.id] || 0;
    });
    var noAveragingCategories = {};
    ((window.RECEIPT_DATA && window.RECEIPT_DATA.ruleItems) || []).forEach(function (ri) {
      if (ri.averaging === false) noAveragingCategories[ri.categoryName] = true;
    });
    function groupAverages(name) {
      return window.RuleEngine ? window.RuleEngine.groupAllowsAveraging(name) : false;
    }
    linesSnap.forEach(function (doc) {
      var line = doc.data();
      if (line.group !== group) {
        group = line.group;
        var gs = groupSums[group || ""];
        var gOver = gs.spent > gs.total;
        html += '<tr class="group-row"><td colspan="6">' + esc(group || "(ไม่ระบุหมวด)") +
          '<span class="group-row__sum">ตั้งไว้ ' + money(gs.total) + ' · ใช้ไป ' + money(gs.spent) +
          ' · คงเหลือ ' + money(gs.total - gs.spent) + '</span>' +
          '<span class="group-row__rule">' + (groupAverages(group) ? "ถัวเฉลี่ยระหว่างรายการในหมวดได้" : "หมวดนี้ถัวเฉลี่ยไม่ได้") + '</span>' +
          (gOver ? '<span class="chip-status chip-status--approval">หมวดเกินประมาณการ</span>' : '') +
          '</td></tr>';
      }
      var spent = spentByLine[doc.id] || 0;
      var percent = line.total > 0 ? Math.round((spent / line.total) * 1000) / 10 : 0;
      totals.budget += line.total;
      totals.spent += spent;
      var overLine = spent > line.total;
      var gSum = groupSums[line.group || ""];
      var averaged = overLine && groupAverages(line.group) && !noAveragingCategories[line.ruleCategory] && gSum.spent <= gSum.total;
      var over = overLine && !averaged;
      html += '<tr class="line-row' + (over ? ' is-over' : '') + '">' +
        '<td class="line-name">' + esc(line.itemName) + (line.multiplierText ? '<div class="text-small">' + esc(line.multiplierText) + '</div>' : '') +
          (line.ruleCategory ? '' : '<div class="text-small" style="color:var(--color-error);">ยังไม่ได้จับคู่หมวดตามระเบียบ</div>') + '</td>' +
        '<td data-label="ตั้งไว้">' + money(line.total) + '</td>' +
        '<td data-label="ใช้ไปแล้ว">' + money(spent) + '</td>' +
        '<td data-label="คงเหลือ">' + money(line.total - spent) + '</td>' +
        '<td data-label="ใช้ไป" class="usage-cell"><div class="usage">' +
          '<span class="usage__track"><span class="usage__fill" style="width:' + Math.min(percent, 100) + '%"></span></span>' +
          '<span class="usage__pct">' + percent + '%</span>' +
          (over ? '<span class="chip-status chip-status--approval">เกินประมาณการ</span>' : '') +
          (averaged ? '<span class="chip-status chip-status--pass">ถัวจ่ายในหมวด</span>' : '') +
          (noAveragingCategories[line.ruleCategory] && groupAverages(line.group) ? '<span class="text-small">ห้ามถัว</span>' : '') +
        '</div></td>' + receiptsCellHtml(receiptsByLine[doc.id]) + '</tr>';
    });
    html += '<tr class="total-row"><td>รวม</td><td data-label="ตั้งไว้">' + money(totals.budget) + '</td><td data-label="ใช้ไปแล้ว">' + money(totals.spent) +
      '</td><td data-label="คงเหลือ">' + money(totals.budget - totals.spent) + '</td><td></td><td></td></tr></tbody></table></div>';
    var source = linesSnap.docs[0].data().sourceFileName;
    if (source) html += '<p class="text-small">นำเข้าจากไฟล์: ' + esc(source) + '</p>';
    html += unlinkedHtml();
    currentBudget.innerHTML = html;
  }
  renderCurrent();

  // ─── ตรวจใบเสร็จที่บันทึกไว้แล้วซ้ำ (js/receipt-recheck.js) — ผลเดิมเก็บไว้ใน verdictHistory ───
  async function recheckPaths(paths, button) {
    var label = button.textContent;
    button.disabled = true;
    warningBox.style.display = "none";
    try {
      for (var i = 0; i < paths.length; i++) {
        button.textContent = paths.length > 1 ? "กำลังตรวจ " + (i + 1) + "/" + paths.length + "..." : "กำลังตรวจ...";
        await window.ReceiptRecheck.recheck(db.doc(paths[i]), user.uid);
      }
      location.reload();
    } catch (err) {
      warn("ตรวจใหม่ไม่สำเร็จ: " + err.message);
      button.disabled = false;
      button.textContent = label;
    }
  }

  currentBudget.addEventListener("click", function (e) {
    var b = e.target.closest('button[data-action="recheck-receipt"]');
    if (b) recheckPaths([b.dataset.receiptPath], b);
  });
  if (DEV_TOOLS) document.getElementById("recheckAllButton").addEventListener("click", function (e) {
    var paths = allReceipts.map(function (rec) { return rec.ref.path; });
    if (!paths.length) { warn("โครงการนี้ยังไม่มีใบเสร็จ"); return; }
    if (!confirm("ตรวจใบเสร็จทั้ง " + paths.length + " ใบใหม่ด้วยระเบียบและประมาณการปัจจุบัน? ผลเดิมจะเก็บไว้ในประวัติ" +
      ((window.VERDICT_CONFIG && window.VERDICT_CONFIG.mode) === "rule" ? "" : " (เรียก AI ใบละ 1 ครั้ง)"))) return;
    recheckPaths(paths, e.target);
  });

  // ─── นำเข้าจากไฟล์ ───
  var parsed = null;
  var parsedFileName = null;
  var parsedKind = null;

  function categoryOptions(selected) {
    var html = '<option value="">(ยังไม่มีหมวดนี้ในระเบียบ)</option>';
    window.RECEIPT_DATA.categories.forEach(function (c) {
      html += '<option value="' + esc(c) + '"' + (c === selected ? " selected" : "") + '>' + esc(c) + '</option>';
    });
    return html;
  }

  function renderPreview() {
    var html = "";
    if (parsedKind === "word" || parsedKind === "pdf") {
      html += '<div class="banner banner--info" style="margin:12px 0;">อ่านตารางจากไฟล์ ' + (parsedKind === "pdf" ? "PDF" : "Word") +
        ' — ตรวจชื่อรายการ ยอดเงิน และหมวดของทุกแถวให้ตรงกับเอกสารก่อนบันทึก' +
        (parsedKind === "pdf" ? ' (PDF ไม่มีเส้นตารางให้อ่าน ระบบเรียงคอลัมน์จากตำแหน่งข้อความ จึงพลาดได้มากกว่า)' : '') + '</div>';
    }
    if (parsedKind === "scan") {
      html += '<div class="banner banner--error" style="margin:12px 0;">อ่านตารางจากไฟล์สแกนด้วย OCR — ตัวเลข ชื่อรายการ และตัวคูณอาจอ่านผิด ' +
        'ชื่อรายการที่ยาวหลายบรรทัดอาจเหลือแค่บรรทัดแรก ตรวจทุกแถวเทียบกับเอกสารจริงก่อนบันทึก</div>';
    }
    if (parsed.warnings.length) {
      html += '<div class="banner banner--error" style="margin:12px 0;">' + parsed.warnings.map(esc).join("<br>") + '</div>';
    }
    if (!parsed.lines.length) {
      importPreview.innerHTML = html;
      return;
    }
    var total = parsed.lines.reduce(function (sum, l) { return sum + l.total; }, 0);
    html += '<p class="text-body">พบ ' + parsed.lines.length + ' รายการ รวม ' + money(total) +
      ' — ตรวจ "หมวดตามระเบียบ" ของแต่ละรายการก่อนบันทึก (ระบบเดาให้จากชื่อรายการ ใช้ตัดสินเพดานและชุดเอกสาร)</p>';
    html += '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th style="min-width:220px;">รายการ</th><th>ยอดรวม</th><th>หมวดตามระเบียบ</th></tr></thead><tbody>';
    parsed.lines.forEach(function (line, i) {
      html += '<tr><td>' + esc(line.itemName) + '<div class="text-small">' + esc(line.group || "") + (line.multiplierText ? " · " + esc(line.multiplierText) : "") + '</div></td>' +
        '<td>' + money(line.total) + '</td>' +
        '<td><select data-line-index="' + i + '">' + categoryOptions(line.ruleCategory) + '</select></td></tr>';
    });
    html += '</tbody></table></div>';
    if (linkedReceiptCount) {
      html += '<p class="text-small" style="color:var(--color-error);">มีใบเสร็จ ' + linkedReceiptCount +
        ' ใบผูกกับประมาณการเดิมอยู่ — ถ้าลำดับรายการเปลี่ยน ใบเสร็จเหล่านั้นอาจผูกผิดรายการ</p>';
    }
    html += '<div class="row" style="justify-content:flex-end; margin-top:12px;"><button type="button" class="btn btn-primary btn-md" id="saveBudgetButton">บันทึกประมาณการนี้</button></div>';
    importPreview.innerHTML = html;
  }

  importPreview.addEventListener("change", function (e) {
    var i = e.target.getAttribute("data-line-index");
    if (i != null) parsed.lines[i].ruleCategory = e.target.value || null;
  });

  fileInput.addEventListener("change", async function () {
    warningBox.style.display = "none";
    importPreview.innerHTML = "";
    var file = fileInput.files[0];
    if (!file) return;
    try {
      // อ่านได้ทั้ง Excel/CSV, Word (.docx), PDF และไฟล์สแกน/รูปภาพผ่าน OCR (js/budget-file-reader.js)
      // ไฟล์สแกนใช้ OCR ทีละหน้า อาจใช้เวลาหลายวินาที
      importPreview.innerHTML = '<p class="help-text" style="margin-top:12px;">กำลังอ่านไฟล์...</p>';
      var read = await window.BudgetFileReader.readBudgetFile(file);
      parsed = window.BudgetParser.parseRows(read.rows, { orderOptional: read.kind === "scan" });
      parsedFileName = file.name;
      parsedKind = read.kind;
      renderPreview();
    } catch (err) {
      importPreview.innerHTML = "";
      warn("อ่านไฟล์ไม่สำเร็จ: " + err.message);
    }
  });

  importPreview.addEventListener("click", async function (e) {
    if (e.target.id !== "saveBudgetButton") return;
    var button = e.target;
    button.disabled = true;
    button.textContent = "กำลังบันทึก...";
    try {
      var batch = db.batch();
      linesSnap.forEach(function (doc) { batch.delete(doc.ref); });
      parsed.lines.forEach(function (line, i) {
        var id = "line" + String(i + 1).padStart(3, "0");
        batch.set(projectRef.collection("budgetLines").doc(id), {
          order: i + 1,
          group: line.group,
          itemName: line.itemName,
          multiplierText: line.multiplierText,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          installmentAmounts: line.installmentAmounts,
          total: line.total,
          ruleCategory: line.ruleCategory,
          sourceFileName: parsedFileName,
          importedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      linesSnap = await projectRef.collection("budgetLines").orderBy("order").get();
      parsed = null;
      fileInput.value = "";
      importPreview.innerHTML = '<div class="banner banner--success">บันทึกประมาณการแล้ว</div>';
      renderCurrent();
    } catch (err) {
      warn("บันทึกไม่สำเร็จ: " + err.message + " (ถ้าเป็น permission-denied แปลว่ายังไม่ได้ deploy firestore.rules ที่มีกฎ budgetLines)");
      button.disabled = false;
      button.textContent = "บันทึกประมาณการนี้";
    }
  });
})();
