// ─────────────────────────────────────────────────────────────
// js/budget-file-reader.js — อ่านไฟล์ประมาณการ (ตาราง 17.2) จาก Excel/CSV, Word (.docx) หรือ PDF
// แล้วคืนเป็น "แถวของช่อง" แบบเดียวกับที่ได้จาก Excel เพื่อส่งต่อให้ js/budget-parser.js
//   - Excel/CSV : SheetJS (ชีตที่ชื่อมี "17.2")
//   - Word      : แตกไฟล์ด้วย JSZip แล้วอ่านตารางใน word/document.xml (ช่องที่ผสานถูกขยายกลับให้ตรงคอลัมน์)
//   - PDF       : ใช้ได้เฉพาะ PDF ที่มีข้อความจริง (export จาก Word/Excel) — ประกอบแถว/คอลัมน์จากตำแหน่ง
//                 ข้อความ โดยยึดตำแหน่งหัวตาราง; PDF ที่สแกนเป็นรูปอ่านไม่ได้
// ส่วนที่แปลง XML/ตำแหน่งข้อความเป็นแถว เป็น pure function ทดสอบใน Node ได้ (tests/budget-file-reader.test.js)
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BudgetFileReader = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  var PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs";
  var PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs";

  function decodeXml(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  // ข้อความในช่องตาราง Word: รวม <w:t> ทุกตัว, แต่ละย่อหน้า (<w:p>) ขึ้นบรรทัดใหม่, <w:tab/> เป็นช่องว่าง
  function cellText(tcXml) {
    var paragraphs = tcXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [tcXml];
    return paragraphs.map(function (p) {
      var parts = [];
      var re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g;
      var m;
      while ((m = re.exec(p))) parts.push(m[1] != null ? decodeXml(m[1]) : " ");
      return parts.join("");
    }).filter(function (t) { return t.trim() !== ""; }).join("\n");
  }

  // ตารางทั้งหมดใน word/document.xml → [ [ [ช่อง, ...], ...แถว ], ...ตาราง ]
  // ช่องที่ผสานแนวนอน (gridSpan) ขยายเป็นช่องว่างต่อท้าย เพื่อให้เลขคอลัมน์ตรงกันทุกแถว
  function docxXmlToTables(xml) {
    var tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
    return tables.map(function (tbl) {
      var rows = tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];
      return rows.map(function (tr) {
        var cells = [];
        var tcs = tr.match(/<w:tc>[\s\S]*?<\/w:tc>|<w:tc [\s\S]*?<\/w:tc>/g) || [];
        tcs.forEach(function (tc) {
          cells.push(cellText(tc));
          var span = tc.match(/<w:gridSpan w:val="(\d+)"/);
          for (var i = 1; span && i < parseInt(span[1], 10); i++) cells.push("");
        });
        return cells;
      });
    });
  }

  // เลือกตารางประมาณการจากหลายตารางในเอกสาร: ตารางที่มีหัว "รายการ" และ "รวม"/"งวด" ใหญ่ที่สุด
  function pickBudgetTable(tables) {
    var scored = tables.map(function (t) {
      var all = t.map(function (r) { return r.join(" "); }).join(" ");
      var score = (/รายการ/.test(all) ? 2 : 0) + (/งวดที่|รวม/.test(all) ? 1 : 0) + (/ตัวคูณ/.test(all) ? 1 : 0);
      return { table: t, score: score, size: t.length };
    });
    scored.sort(function (a, b) { return b.score - a.score || b.size - a.size; });
    return scored.length ? scored[0].table : [];
  }

  var HEADER_KEYS = [
    /^ลำดับ/, /^รายการ/, /ตัวคูณ/, /งวดที่\s*1/, /งวดที่\s*2/, /งวดที่\s*3/, /^รวม/,
  ];

  // ข้อความใน PDF → แถวของช่อง
  // items: [{ str, x, y, w }] — y นับจากบนลงล่าง (หน้าถัดไปบวกความสูงหน้าก่อนแล้ว)
  function pdfItemsToRows(items, lineTolerance) {
    var tol = lineTolerance || 3;
    var sorted = items.filter(function (it) { return it.str && it.str.trim() !== ""; })
      .slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });

    // 1) จับกลุ่มเป็นบรรทัดตามแกน y
    var lines = [];
    sorted.forEach(function (it) {
      var line = lines[lines.length - 1];
      if (!line || Math.abs(it.y - line.y) > tol) lines.push(line = { y: it.y, items: [] });
      line.items.push(it);
    });

    // 2) ในแต่ละบรรทัด รวมชิ้นข้อความที่ติดกันเป็นวลี (ข้อความไทยใน PDF มักแตกเป็นหลายชิ้น)
    lines.forEach(function (line) {
      line.items.sort(function (a, b) { return a.x - b.x; });
      var phrases = [];
      line.items.forEach(function (it) {
        var last = phrases[phrases.length - 1];
        var gap = last ? it.x - (last.x + last.w) : Infinity;
        if (last && gap < 4) {
          last.str += (gap > 1.5 ? " " : "") + it.str;
          last.w = it.x + it.w - last.x;
        } else {
          phrases.push({ str: it.str, x: it.x, w: it.w });
        }
      });
      line.phrases = phrases;
    });

    // 3) หาตำแหน่งคอลัมน์จากหัวตาราง
    var centers = [];
    lines.forEach(function (line) {
      var isHeader = line.phrases.some(function (p) { return /^ลำดับ|^รายการ|งวดที่/.test(p.str.trim()); });
      if (!isHeader) return;
      line.phrases.forEach(function (p) {
        var t = p.str.trim();
        if (HEADER_KEYS.some(function (re) { return re.test(t); })) centers.push(p.x + p.w / 2);
      });
    });
    centers.sort(function (a, b) { return a - b; });
    centers = centers.filter(function (c, i) { return i === 0 || c - centers[i - 1] > 10; });

    if (centers.length < 3) {
      // ไม่เจอหัวตาราง: คืนแต่ละวลีเป็นหนึ่งช่องตามลำดับ (budget-parser จะเตือนว่าหาหัวตารางไม่เจอ)
      return { rows: lines.map(function (l) { return l.phrases.map(function (p) { return p.str.trim(); }); }), headerFound: false };
    }

    // 4) ช่วงของแต่ละคอลัมน์ = จากเส้นแบ่งซ้ายถึงขวา (กึ่งกลางระหว่างหัวคอลัมน์ที่ติดกัน) แล้ววางแต่ละวลี
    //    ลงคอลัมน์ที่ทับซ้อนกับวลีนั้นมากที่สุด — ใช้ได้ทั้งข้อความชิดซ้าย ตัวเลขชิดขวา และชื่อรายการยาว
    var bounds = centers.map(function (c, i) {
      return {
        left: i === 0 ? -Infinity : (centers[i - 1] + c) / 2,
        right: i === centers.length - 1 ? Infinity : (c + centers[i + 1]) / 2,
      };
    });
    var rows = lines.map(function (line) {
      var cells = centers.map(function () { return ""; });
      line.phrases.forEach(function (p) {
        var start = p.x;
        var end = p.x + Math.max(p.w, 0.1);
        var best = 0;
        var bestOverlap = -1;
        bounds.forEach(function (b, i) {
          var overlap = Math.min(end, b.right) - Math.max(start, b.left);
          if (overlap > bestOverlap) { bestOverlap = overlap; best = i; }
        });
        cells[best] = cells[best] ? cells[best] + " " + p.str.trim() : p.str.trim();
      });
      return cells;
    });
    return { rows: rows, headerFound: true };
  }

  function extensionOf(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  // ─── ส่วนที่ใช้ในเบราว์เซอร์ ───
  async function readExcel(file) {
    var workbook = root.XLSX.read(await file.arrayBuffer(), { type: "array" });
    var sheet = workbook.Sheets[root.BudgetParser.pickSheetName(workbook.SheetNames)];
    return root.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  }

  async function readDocx(file) {
    if (!root.JSZip) throw new Error("โหลดตัวอ่านไฟล์ Word ไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง");
    var zip = await root.JSZip.loadAsync(await file.arrayBuffer());
    var doc = zip.file("word/document.xml");
    if (!doc) throw new Error("ไฟล์นี้ไม่ใช่ไฟล์ Word (.docx) ที่ถูกต้อง");
    var tables = docxXmlToTables(await doc.async("string"));
    if (!tables.length) throw new Error("ไม่พบตารางในไฟล์ Word นี้ — ตารางประมาณการต้องเป็นตาราง (Insert → Table) ไม่ใช่ข้อความที่จัดด้วย Tab");
    return pickBudgetTable(tables);
  }

  async function readPdf(file) {
    var pdfjs = await import(PDFJS_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    var pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    var items = [];
    var offset = 0;
    var textLength = 0;
    for (var n = 1; n <= pdf.numPages; n++) {
      var page = await pdf.getPage(n);
      var viewport = page.getViewport({ scale: 1 });
      var content = await page.getTextContent();
      content.items.forEach(function (it) {
        if (!it.str) return;
        textLength += it.str.trim().length;
        items.push({ str: it.str, x: it.transform[4], y: offset + viewport.height - it.transform[5], w: it.width || 0 });
      });
      offset += viewport.height + 50;
    }
    if (textLength < 20) {
      throw new Error("PDF นี้ไม่มีข้อความให้อ่าน (น่าจะเป็นไฟล์สแกน) — กรุณาใช้ไฟล์ Excel หรือ Word ต้นฉบับ หรือ PDF ที่ export จากโปรแกรม");
    }
    return pdfItemsToRows(items).rows;
  }

  // คืน { rows, kind } — kind: "excel" | "word" | "pdf" (ใช้แสดงคำเตือนให้ตรวจผลเป็นพิเศษ)
  async function readBudgetFile(file) {
    var ext = extensionOf(file.name);
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return { rows: await readExcel(file), kind: "excel" };
    if (ext === "docx") return { rows: await readDocx(file), kind: "word" };
    if (ext === "pdf") return { rows: await readPdf(file), kind: "pdf" };
    if (ext === "doc") throw new Error("ไฟล์ Word รุ่นเก่า (.doc) อ่านไม่ได้ — กรุณาเปิดใน Word แล้วบันทึกเป็น .docx");
    throw new Error("รองรับเฉพาะไฟล์ .xlsx, .xls, .csv, .docx และ .pdf");
  }

  return {
    readBudgetFile: readBudgetFile,
    docxXmlToTables: docxXmlToTables,
    pickBudgetTable: pickBudgetTable,
    pdfItemsToRows: pdfItemsToRows,
    extensionOf: extensionOf,
  };
});
