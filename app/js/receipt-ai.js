// ─────────────────────────────────────────────────────────────
// js/receipt-ai.js — อ่านใบเสร็จจากรูปด้วยโมเดลที่ดูรูปได้ ผ่าน js/ai-client.js (ผู้ให้บริการตั้งใน
// js/ai-config.local.js) รับเฉพาะรูป jpg/png; pdf ถูกแปลงหน้าแรกเป็นรูปก่อนใน new-receipt.js
// ถ้ามีข้อความจาก OCR ในเครื่อง (js/ocr-client.js) จะส่งไปประกอบด้วย
// ─────────────────────────────────────────────────────────────

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// อ่านใบเสร็จจากไฟล์รูปภาพด้วย AI จริง — คืนค่าในรูปแบบเดียวกับ randomAiData()
// ใน new-receipt.js (confirmedAmount/confirmedDate/confirmedCategory/confirmedVendorName)
window.analyzeReceiptWithAI = async function (file, categories, ocrText) {
  var dataUrl = await fileToDataUrl(file);
  var prompt =
    "อ่านใบเสร็จรับเงินในรูปนี้ แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่นนอกเหนือจาก JSON) รูปแบบ:\n" +
    '{"vendorName": string, "date": "YYYY-MM-DD", "amount": number, "category": string}\n' +
    "amount ต้องเป็นตัวเลขล้วน ไม่มีสัญลักษณ์สกุลเงินหรือคอมมา\n" +
    "amount คือยอดรวมทั้งสิ้นที่จ่ายจริงรวมภาษีมูลค่าเพิ่มแล้ว (รวมเงินทั้งสิ้น / Grand total / Net total) " +
    "ห้ามใช้มูลค่าสินค้าก่อนภาษี (รวมมูลค่าสินค้า / Sub total) หรือยอดภาษี\n" +
    "category ต้องเลือกจากรายการนี้เท่านั้น (ตอบตามตัวสะกดเป๊ะๆ): " + categories.join(", ");

  // ocrText (ถ้ามี): ข้อความที่ OCR ในเครื่องอ่านได้ ส่งไปพร้อมรูปเพื่อช่วยให้อ่านตัวเลขแม่นขึ้น
  if (ocrText) prompt += "\n\nข้อความที่ OCR อ่านได้จากรูปเดียวกัน (อาจผิดบางตัว ใช้ประกอบกับรูป):\n" + ocrText;
  var content = await window.AiClient.chat([
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ], { vision: true, temperature: 0 });

  var parsed = window.AiClient.extractJson(content);
  var amount = typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount);
  if (isNaN(amount)) {
    throw new Error("อ่านยอดเงินจากใบเสร็จไม่ได้");
  }

  return {
    confirmedAmount: Math.round(amount * 100) / 100,
    confirmedDate: parsed.date || "",
    confirmedCategory: categories.indexOf(parsed.category) !== -1 ? parsed.category : "",
    confirmedVendorName: parsed.vendorName || "",
  };
};
