// ─────────────────────────────────────────────────────────────
// js/ocr-client.js — เรียก OCR ภาษาไทยที่รันในเครื่องผู้ใช้ (research/ocr/server.py, OpenThai 2.0)
// ใบเสร็จไม่ออกจากเครื่อง ถ้าไม่ได้เปิด server ไว้ หน้าเว็บจะข้าม OCR ไปเอง
// extractFields() ดึงยอดเงิน/วันที่/ชื่อร้านจากข้อความ OCR แบบไม่ใช้ AI — ใช้ตอนไม่ได้ตั้งค่า AI
// ใช้ได้ทั้งเบราว์เซอร์ (window.OcrClient) และ Node (require) เพื่อทดสอบ extractFields
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OcrClient = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  function endpoint() {
    return (root && root.OCR_CONFIG && root.OCR_CONFIG.endpoint) || "http://127.0.0.1:8765";
  }

  var availability = null;
  // เช็คครั้งเดียวต่อการโหลดหน้า รอไม่เกิน 1.5 วินาที เพื่อไม่ให้หน้าเว็บช้าตอนที่ไม่ได้เปิด OCR
  function isAvailable() {
    if (availability) return availability;
    availability = new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(false); } }, 1500);
      fetch(endpoint() + "/health").then(function (r) { return r.ok ? r.json() : null; }).then(function (body) {
        if (!done) { done = true; clearTimeout(timer); resolve(!!(body && body.ok)); }
      }).catch(function () {
        if (!done) { done = true; clearTimeout(timer); resolve(false); }
      });
    });
    return availability;
  }

  async function read(file) {
    var response = await fetch(endpoint() + "/ocr", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!response.ok) throw new Error("OCR error " + response.status);
    return response.json();
  }

  var AMOUNT_KEYWORDS = /(รวมทั้งสิ้น|ยอดสุทธิ|รวมสุทธิ|ยอดรวม|รวมเงิน|จำนวนเงินรวม|จำนวนเงิน|grand\s*total|net\s*total|total|รวม)/i;
  var NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d+/g;

  function toAmount(s) {
    var n = parseFloat(String(s).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }

  // ยอดเงิน: ตัวเลขท้ายสุดในบรรทัดที่มีคำว่า "รวม/ยอดสุทธิ/total" (ไล่จากบรรทัดล่างขึ้นบน เพราะยอดรวมสุดท้ายมักอยู่ล่างสุด)
  // ถ้าไม่เจอ ใช้ตัวเลขที่มีทศนิยมที่มากที่สุดในใบ
  function findAmount(lines) {
    for (var i = lines.length - 1; i >= 0; i--) {
      if (!AMOUNT_KEYWORDS.test(lines[i])) continue;
      var nums = (lines[i].match(NUMBER) || []).map(toAmount).filter(function (n) { return n !== null && n > 0; });
      if (!nums.length && lines[i + 1]) nums = (lines[i + 1].match(NUMBER) || []).map(toAmount).filter(function (n) { return n !== null && n > 0; });
      if (nums.length) return nums[nums.length - 1];
    }
    var decimals = [];
    lines.forEach(function (l) {
      (l.match(/\d{1,3}(?:,\d{3})*\.\d{2}/g) || []).forEach(function (m) { decimals.push(toAmount(m)); });
    });
    return decimals.length ? Math.max.apply(null, decimals) : null;
  }

  var THAI_MONTHS = ["ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค"];

  // ปี พ.ศ. (เช่น 2569 หรือ 69) แปลงเป็น ค.ศ.; ปี 2 หลักถือเป็น พ.ศ. เพราะใบเสร็จไทยส่วนใหญ่ใช้ พ.ศ.
  function toIsoDate(d, m, y) {
    y = Number(y);
    if (y < 100) y += 2500;
    if (y > 2400) y -= 543;
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
    return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }

  function findDate(text) {
    var numeric = text.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2,4})/);
    if (numeric) return toIsoDate(Number(numeric[1]), Number(numeric[2]), numeric[3]);
    var thai = text.match(/(\d{1,2})\s*(ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)\.?\s*(\d{2,4})/);
    if (thai) return toIsoDate(Number(thai[1]), THAI_MONTHS.indexOf(thai[2]) + 1, thai[3]);
    return "";
  }

  // ชื่อร้าน: บรรทัดแรกที่มีตัวอักษรจริง ไม่ใช่หัวเอกสาร ("ใบเสร็จรับเงิน", "ใบกำกับภาษี") และไม่ใช่ตัวเลขล้วน
  function findVendor(lines) {
    for (var i = 0; i < Math.min(lines.length, 6); i++) {
      var l = lines[i].trim();
      if (l.length < 3 || /^[\d\s.,:\/-]+$/.test(l)) continue;
      if (/ใบเสร็จ|ใบกำกับ|receipt|invoice|สำเนา|ต้นฉบับ|เลขที่|วันที่|tax\s*id|เลขประจำตัว/i.test(l)) continue;
      return l;
    }
    return "";
  }

  function extractFields(ocrResult) {
    var lines = (ocrResult.lines || []).map(function (l) { return typeof l === "string" ? l : l.text; });
    var text = ocrResult.text || lines.join("\n");
    return { amount: findAmount(lines), date: findDate(text), vendorName: findVendor(lines) };
  }

  // ข้อความ OCR พร้อมบอกบรรทัดที่ไม่มั่นใจ ใช้แนบไปกับรูปให้ AI ช่วยอ่าน
  function textForAi(ocrResult) {
    return (ocrResult.lines || []).map(function (l) {
      return l.text + (l.confidence < 0.9 ? "  (OCR ไม่มั่นใจ " + Math.round(l.confidence * 100) + "%)" : "");
    }).join("\n");
  }

  return { endpoint: endpoint, isAvailable: isAvailable, read: read, extractFields: extractFields, textForAi: textForAi };
});
