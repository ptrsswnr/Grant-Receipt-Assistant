// ─────────────────────────────────────────────────────────────
// js/receipt-ai.js — real receipt reading via OpenRouter's vision-capable chat completions API
// (test only — see CLAUDE.md "AI receipt reading (test only)"). Only handles image files
// (jpg/jpeg/png); PDF receipts still fall back to demo/random data in new-receipt.js since
// OpenRouter's image_url content type expects an image, not a PDF. Requires
// window.OPENROUTER_API_KEY (see js/ai-config.example.js) — new-receipt.js checks for that
// before calling this and falls back to demo data if it's missing.
// ─────────────────────────────────────────────────────────────

var OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";
var OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// โมเดลบางตัวห่อ JSON ด้วย ```json ... ``` ทั้งที่ขอให้ตอบ JSON ล้วนแล้ว — ตัดออกก่อน parse
function extractJson(text) {
  var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced ? fenced[1] : text).trim());
}

// อ่านใบเสร็จจากไฟล์รูปภาพด้วย AI จริงผ่าน OpenRouter — คืนค่าในรูปแบบเดียวกับ randomAiData()
// ใน new-receipt.js (confirmedAmount/confirmedDate/confirmedCategory/confirmedVendorName)
window.analyzeReceiptWithAI = async function (file, categories) {
  var dataUrl = await fileToDataUrl(file);
  var prompt =
    "อ่านใบเสร็จรับเงินในรูปนี้ แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่นนอกเหนือจาก JSON) รูปแบบ:\n" +
    '{"vendorName": string, "date": "YYYY-MM-DD", "amount": number, "category": string}\n' +
    "amount ต้องเป็นตัวเลขล้วน ไม่มีสัญลักษณ์สกุลเงินหรือคอมมา\n" +
    "category ต้องเลือกจากรายการนี้เท่านั้น (ตอบตามตัวสะกดเป๊ะๆ): " + categories.join(", ");

  var response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + window.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error("OpenRouter API error " + response.status + ": " + errBody.slice(0, 200));
  }

  var result = await response.json();
  var content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
  if (!content) {
    throw new Error("OpenRouter ไม่ส่งข้อความกลับมา");
  }

  var parsed = extractJson(content);
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
