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
    warn("ไม่ได้ระบุโครงการ — กรุณาเข้าหน้านี้จากปุ่ม \"ประมาณการ\" ในหน้าโครงการของฉัน");
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

  var linesSnap = await projectRef.collection("budgetLines").orderBy("order").get();
  var receiptsSnap = await projectRef.collection("receipts").get();
  var spentByLine = {};
  var linkedReceiptCount = 0;
  receiptsSnap.forEach(function (doc) {
    var r = doc.data();
    if (!r.budgetLineId) return;
    linkedReceiptCount++;
    spentByLine[r.budgetLineId] = (spentByLine[r.budgetLineId] || 0) + (r.confirmedAmount || 0);
  });

  function renderCurrent() {
    if (linesSnap.empty) {
      currentBudget.innerHTML = '<p class="text-body">ยังไม่ได้นำเข้าประมาณการ — ใบเสร็จของโครงการนี้จะยังไม่ถูกเทียบกับประมาณการ</p>';
      return;
    }
    // data-label ใช้ตอนจอแคบ: style.css แปลงแต่ละแถวเป็นการ์ดที่มีป้ายกำกับตัวเลขทุกช่อง
    var html = '<div class="budget-table-wrap"><table class="admin-table budget-table"><thead><tr>' +
      '<th>รายการ</th><th>ตั้งไว้</th><th>ใช้ไปแล้ว</th><th>คงเหลือ</th><th>ใช้ไป</th></tr></thead><tbody>';
    var group = null;
    var totals = { budget: 0, spent: 0 };
    linesSnap.forEach(function (doc) {
      var line = doc.data();
      if (line.group !== group) {
        group = line.group;
        html += '<tr class="group-row"><td colspan="5">' + esc(group || "(ไม่ระบุหมวด)") + '</td></tr>';
      }
      var spent = spentByLine[doc.id] || 0;
      var percent = line.total > 0 ? Math.round((spent / line.total) * 1000) / 10 : 0;
      totals.budget += line.total;
      totals.spent += spent;
      var over = spent > line.total;
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
        '</div></td></tr>';
    });
    html += '<tr class="total-row"><td>รวม</td><td data-label="ตั้งไว้">' + money(totals.budget) + '</td><td data-label="ใช้ไปแล้ว">' + money(totals.spent) +
      '</td><td data-label="คงเหลือ">' + money(totals.budget - totals.spent) + '</td><td></td></tr></tbody></table></div>';
    var source = linesSnap.docs[0].data().sourceFileName;
    if (source) html += '<p class="text-small">นำเข้าจากไฟล์: ' + esc(source) + '</p>';
    currentBudget.innerHTML = html;
  }
  renderCurrent();

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
