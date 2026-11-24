// ─────────────────────────────────────────────────────────────
// js/budget-file-reader.js — อ่านไฟล์ประมาณการ (ตาราง 17.2) จาก Excel/CSV, Word (.docx) หรือ PDF
// แล้วคืนเป็น "แถวของช่อง" แบบเดียวกับที่ได้จาก Excel เพื่อส่งต่อให้ js/budget-parser.js
//   - Excel/CSV : SheetJS (ชีตที่ชื่อมี "17.2")
//   - Word      : แตกไฟล์ด้วย JSZip แล้วอ่านตารางใน word/document.xml (ช่องที่ผสานถูกขยายกลับให้ตรงคอลัมน์)
//   - PDF       : PDF ที่มีข้อความ (export จาก Word/Excel) — ประกอบแถว/คอลัมน์จากตำแหน่งข้อความ โดยยึด
//                 ตำแหน่งหัวตาราง
//   - สแกน      : PDF ที่ไม่มีข้อความ หรือรูป .jpg/.png — ส่งให้ OCR ในเครื่อง (research/ocr/server.py)
//                 แล้วประกอบตารางจากตำแหน่งบรรทัดที่ OCR ส่งกลับ ด้วยวิธีเดียวกับ PDF
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

  // "งวด(ที่)? 1" — แบบเสนอโครงการ RS-01 ใช้ "งวด 1" ส่วนไฟล์ตัวช่วยใช้ "งวดที่ 1"; OCR มักทำไม้เอกหาย
  var HEADER_KEYS = [
    /^ลำดับ/, /^รายการ/, /ตัวคูณ/, /งวด(?:ที่?)?\s*1/, /งวด(?:ที่?)?\s*2/, /งวด(?:ที่?)?\s*3/, /^รวม/,
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

    // 3) หาตำแหน่งคอลัมน์จากหัวตาราง — นับเป็นแถวหัวตารางเมื่อมีหัวคอลัมน์อย่างน้อย 2 ช่อง กันข้อความทั่วไป
    //    ที่ขึ้นต้นด้วย "รายการ..." ในเอกสารข้อเสนอโครงการทั้งเล่มมาปนเป็นคอลัมน์
    var isHeaderText = function (t) { return HEADER_KEYS.some(function (re) { return re.test(t); }); };
    var centers = [];
    var firstHeader = -1;
    lines.forEach(function (line, li) {
      var heads = line.phrases.filter(function (p) { return isHeaderText(p.str.trim()); });
      if (heads.length < 2) return;
      if (firstHeader === -1) firstHeader = li;
      heads.forEach(function (p) { centers.push(p.x + p.w / 2); });
    });
    // ข้อเสนอโครงการทั้งเล่มมีข้อความหลายหน้าก่อนตาราง — ตัดทิ้งเพื่อให้หัวตารางอยู่ช่วงแถวแรกๆ ที่ budget-parser ไล่หา
    if (firstHeader > 0) lines = lines.slice(firstHeader);
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

  // ผล OCR ของไฟล์สแกน (research/ocr/server.py) → แถวของช่อง ด้วยตัวประกอบตารางเดียวกับ PDF ที่มีข้อความ
  // pages: [{ lines: [{ text, box: { x, y, w, h } }] }] — box เป็นพิกเซลของหน้า; หน้าถัดไปเลื่อนลงต่อจากหน้าก่อน
  // ระยะที่ถือว่าอยู่บรรทัดเดียวกัน = ครึ่งหนึ่งของความสูงบรรทัดทั่วไป (ภาพสแกนเอียงเล็กน้อยได้)
  // คอลัมน์มาตรฐานที่ส่งต่อให้ budget-parser (แถวหัวตารางสังเคราะห์ด้านล่างทำให้ detectColumns หาเจอเสมอ)
  var SCAN_COLUMNS = [
    { key: "order", re: /^ลำดับ/ },
    { key: "item", re: /^รายการ/ },
    { key: "mult", re: /ตัวคูณ/ },
    { key: "inst1", re: /งวด(?:ที่?)?\s*1/ },
    { key: "inst2", re: /งวด(?:ที่?)?\s*2/ },
    { key: "inst3", re: /งวด(?:ที่?)?\s*3/ },
    { key: "total", re: /^รวม/ },
  ];
  var SCAN_HEADER_ROW = ["ลำดับ", "รายการ", "ตัวคูณ", "งวดที่ 1", "งวดที่ 2", "งวดที่ 3", "รวม"];

  // หาหัวตาราง 17.2 ในหน้าเดียว: ต้องมี "รายการ..." และหัวคอลัมน์เงิน (งวด/รวม) อย่างน้อย 2 ช่อง ในแถบความสูง
  // ไม่เกิน 4 บรรทัดนับจาก "รายการ" — หน้าที่มีแต่ตารางสรุปงบประมาณ (ข้อ 17) ไม่มี "รายการ" จึงไม่ถูกนับ
  function findScanHeader(boxes, lineHeight) {
    for (var i = 0; i < boxes.length; i++) {
      if (!/^รายการ/.test(boxes[i].text)) continue;
      var top = boxes[i].y - lineHeight;
      var limit = boxes[i].y + 4 * lineHeight;
      var cols = {};
      var bottom = 0;
      boxes.forEach(function (b) {
        if (b.y < top || b.y > limit) return;
        SCAN_COLUMNS.forEach(function (c) {
          if (cols[c.key] == null && c.re.test(b.text)) {
            cols[c.key] = b.x + b.w / 2;
            bottom = Math.max(bottom, b.y + b.h);
          }
        });
      });
      var money = ["inst1", "inst2", "inst3", "total"].filter(function (k) { return cols[k] != null; }).length;
      if (cols.item != null && money >= 2) return { centers: cols, bottom: bottom };
    }
    return null;
  }

  // ผล OCR ของไฟล์สแกน (research/ocr/server.py) → แถวของช่องในคอลัมน์มาตรฐาน
  // pages: [{ lines: [{ text, box: { x, y, w, h } }] }] — box เป็นพิกเซลของหน้า
  // - หาหัวตารางแยกทีละหน้า เพราะแต่ละหน้าสแกนมาขนาด/ตำแหน่งไม่เท่ากัน และข้อเสนอโครงการมีตารางอื่นปนอยู่
  // - ข้อความเหนือหัวตาราง (หัวกระดาษ RS-01, ข้อความก่อนตาราง) ถูกตัดทิ้ง
  // - จัดบรรทัด: กล่องที่จุดกึ่งกลางอยู่ไม่ต่ำกว่าขอบล่างของกล่องแรกในบรรทัดเกิน 1/4 ความสูง ถือเป็นแถวเดียวกัน
  //   (ในแบบฟอร์มจริง ตัวเลขมักอยู่ต่ำกว่าชื่อรายการเล็กน้อย)
  // - วางแต่ละกล่องลงคอลัมน์ที่ทับซ้อนกันมากที่สุด เส้นแบ่งคอลัมน์อยู่กึ่งกลางระหว่างหัวคอลัมน์ที่ติดกัน
  function ocrPagesToRows(pages) {
    var rows = [];
    var headerFound = false;
    (pages || []).forEach(function (p) {
      var boxes = (p.lines || []).filter(function (l) { return l.box && l.text && String(l.text).trim(); })
        .map(function (l) { return { text: String(l.text).trim(), x: l.box.x, y: l.box.y, w: l.box.w, h: l.box.h }; });
      if (!boxes.length) return;
      var hs = boxes.map(function (b) { return b.h; }).sort(function (a, b) { return a - b; });
      var lineHeight = hs[Math.floor(hs.length / 2)];
      var header = findScanHeader(boxes, lineHeight);
      if (!header) return;
      headerFound = true;

      var present = SCAN_COLUMNS.filter(function (c) { return header.centers[c.key] != null; })
        .map(function (c) { return { index: SCAN_COLUMNS.indexOf(c), center: header.centers[c.key] }; })
        .sort(function (a, b) { return a.center - b.center; });
      var bounds = present.map(function (c, i) {
        return {
          index: c.index,
          left: i === 0 ? -Infinity : (present[i - 1].center + c.center) / 2,
          right: i === present.length - 1 ? Infinity : (c.center + present[i + 1].center) / 2,
        };
      });

      var body = boxes.filter(function (b) { return b.y + b.h / 2 > header.bottom; })
        .sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x; });
      var lines = [];
      body.forEach(function (b) {
        var line = lines[lines.length - 1];
        var center = b.y + b.h / 2;
        if (!line || center > line.anchor.y + line.anchor.h * 1.25) lines.push(line = { anchor: b, boxes: [] });
        line.boxes.push(b);
      });
      lines.forEach(function (line) {
        var cells = SCAN_COLUMNS.map(function () { return ""; });
        line.boxes.sort(function (a, b) { return a.x - b.x; }).forEach(function (b) {
          var best = bounds[0];
          var bestOverlap = -Infinity;
          bounds.forEach(function (c) {
            var overlap = Math.min(b.x + b.w, c.right) - Math.max(b.x, c.left);
            if (overlap > bestOverlap) { bestOverlap = overlap; best = c; }
          });
          cells[best.index] = cells[best.index] ? cells[best.index] + " " + b.text : b.text;
        });
        rows.push(cells);
      });
    });
    return { rows: headerFound ? [SCAN_HEADER_ROW.slice()].concat(rows) : rows, headerFound: headerFound };
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

  // ไฟล์สแกน (PDF ที่ไม่มีข้อความ หรือรูปภาพ) → ส่งให้ OCR ในเครื่อง แล้วประกอบตารางจากตำแหน่งบรรทัด
  async function readScan(file, what) {
    var ocr = root.OcrClient;
    if (!ocr || !(await ocr.isAvailable())) {
      throw new Error(what + " ต้องอ่านด้วย OCR ในเครื่อง แต่ยังต่อ OCR ไม่ได้ — เปิด research/ocr/server.py ก่อน แล้วเลือกไฟล์ใหม่อีกครั้ง");
    }
    var result = await ocr.read(file);
    var pages = result.pages || [{ lines: result.lines || [] }];
    var hasBoxes = pages.some(function (p) { return (p.lines || []).some(function (l) { return l.box; }); });
    if (!hasBoxes) throw new Error("OCR ไม่ส่งตำแหน่งบรรทัดกลับมา — ปิดแล้วเปิด research/ocr/server.py ใหม่ (ต้องเป็นรุ่นล่าสุด)");
    var out = ocrPagesToRows(pages);
    if (!out.headerFound) {
      throw new Error("OCR อ่านไฟล์ได้ แต่หาหัวตาราง 17.2 (ลำดับ / รายการ / งวดที่ / รวม) ไม่เจอ — ลองสแกนให้ชัดขึ้น หรือใช้ไฟล์ Excel/Word ต้นฉบับ");
    }
    return out.rows;
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
    // ไม่มีข้อความ = ไฟล์สแกน → ใช้ OCR แทน
    if (textLength < 20) return null;
    return pdfItemsToRows(items).rows;
  }

  // คืน { rows, kind } — kind: "excel" | "word" | "pdf" | "scan" (ใช้แสดงคำเตือนให้ตรวจผลเป็นพิเศษ)
  async function readBudgetFile(file) {
    var ext = extensionOf(file.name);
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return { rows: await readExcel(file), kind: "excel" };
    if (ext === "docx") return { rows: await readDocx(file), kind: "word" };
    if (ext === "pdf") {
      var rows = await readPdf(file);
      if (rows) return { rows: rows, kind: "pdf" };
      return { rows: await readScan(file, "PDF นี้เป็นไฟล์สแกน (ไม่มีข้อความในไฟล์)"), kind: "scan" };
    }
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return { rows: await readScan(file, "ไฟล์รูปภาพ"), kind: "scan" };
    if (ext === "doc") throw new Error("ไฟล์ Word รุ่นเก่า (.doc) อ่านไม่ได้ — กรุณาเปิดใน Word แล้วบันทึกเป็น .docx");
    throw new Error("รองรับเฉพาะไฟล์ .xlsx, .xls, .csv, .docx, .pdf และรูปภาพ .jpg/.png");
  }

  return {
    readBudgetFile: readBudgetFile,
    docxXmlToTables: docxXmlToTables,
    pickBudgetTable: pickBudgetTable,
    pdfItemsToRows: pdfItemsToRows,
    ocrPagesToRows: ocrPagesToRows,
    extensionOf: extensionOf,
  };
});
