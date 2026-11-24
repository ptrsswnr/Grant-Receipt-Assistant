// ─────────────────────────────────────────────────────────────
// js/pdf-to-image.js — แปลงหน้าแรกของไฟล์ pdf ใบเสร็จเป็นรูปภาพ (canvas → PNG) ก่อนส่งให้
// js/receipt-ai.js อ่าน เพราะ OpenRouter's image_url content type รับแค่รูปภาพ ไม่รับ pdf ตรงๆ —
// นี่คือ "แปลงไฟล์" ไม่ใช่ OCR แยกต่างหาก ตัว AI (vision model) ยังเป็นตัวอ่านตัวหนังสือเหมือนเดิม
// ใช้ pdf.js จาก CDN (ES module — ต้องรันผ่าน http(s), ไม่ใช่ file://, ซึ่งหน้านี้ต้องรันผ่าน
// local server อยู่แล้วเพราะ Firestore/Google Drive OAuth ก็ต้องการ http(s) origin เหมือนกัน)
// convertPdfFirstPageToImageFile ใช้แค่หน้าแรก (ส่งให้ vision model อ่านยอด/วันที่) — OCR อ่านทุกหน้า
// (new-receipt ส่ง PDF ทั้งไฟล์ให้ OCR server, batch-import แปลงทีละหน้าด้วย forEachPdfPageImage)
// ─────────────────────────────────────────────────────────────
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs";

async function renderPage(pdf, pageNumber, baseName) {
  var page = await pdf.getPage(pageNumber);
  var viewport = page.getViewport({ scale: 2 });
  var canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
  var blob = await new Promise(function (resolve) {
    canvas.toBlob(resolve, "image/png");
  });
  canvas.width = canvas.height = 0;
  return new File([blob], baseName + "-p" + pageNumber + ".png", { type: "image/png" });
}

window.convertPdfFirstPageToImageFile = async function (pdfFile) {
  var pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
  var image = await renderPage(pdf, 1, pdfFile.name.replace(/\.pdf$/i, ""));
  return new File([image], pdfFile.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
};

// ไฟล์สแกนทั้งโครงการ (js/batch-import.js): แปลงทีละหน้าแล้วส่งให้ onPage(imageFile, pageNumber, pageCount)
// ทันที แทนการแปลงทั้งไฟล์ก่อน — ไฟล์ร้อยหน้าไม่ต้องเก็บรูปทุกหน้าไว้ในหน่วยความจำ และแต่ละหน้าที่ส่งให้ OCR
// มีขนาดเล็ก (ไม่ติดเพดานขนาดของ OCR) ผลรวมกลับตามลำดับหน้าเพราะ onPage ถูกเรียกเรียงหน้าทีละหน้า
window.forEachPdfPageImage = async function (pdfFile, onPage) {
  var pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
  var baseName = pdfFile.name.replace(/\.pdf$/i, "");
  for (var n = 1; n <= pdf.numPages; n++) {
    await onPage(await renderPage(pdf, n, baseName), n, pdf.numPages);
  }
  return pdf.numPages;
};
