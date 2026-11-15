// คัดลอกไฟล์นี้เป็น ai-config.local.js (gitignored — ห้าม commit) แล้วเลือกผู้ให้บริการ AI แบบใดแบบหนึ่ง
// ไม่มีไฟล์นี้ = ระบบใช้ข้อมูลตัวอย่างแทนการอ่านด้วย AI และใช้คำอธิบายจากกฎล้วน (ผลตัดสินไม่เปลี่ยน
// เพราะ rule engine เป็นคนตัดสินเสมอ AI แค่อ่านใบเสร็จและเรียบเรียงคำอธิบาย)

// 1) OpenRouter — คีย์ของคลาส (เสียเงิน ใช้ได้เฉพาะวิชาเรียน) https://openrouter.ai/keys
window.AI_CONFIG = { provider: "openrouter", apiKey: "sk-or-v1-your-key-here" };

// 2) Ollama — รันโมเดลในเครื่องตัวเอง ฟรี ใบเสร็จไม่ออกจากเครื่อง (เหมาะกับงานวิจัยจริง)
//    ติดตั้ง https://ollama.com แล้วรัน: ollama pull gemma3:4b
//    ต้องอนุญาตให้เว็บเรียกได้: ตั้ง env OLLAMA_ORIGINS=http://localhost:4173 ก่อนเปิด ollama
// window.AI_CONFIG = { provider: "ollama", model: "gemma3:4b" };

// 3) Proxy — เซิร์ฟเวอร์ตัวกลางถือคีย์ไว้ (ดู proxy/README.md) เบราว์เซอร์ไม่เห็นคีย์เลย
// window.AI_CONFIG = { provider: "proxy", endpoint: "https://<your-worker>.workers.dev/v1/chat/completions", model: "google/gemini-2.5-flash-lite" };

// 4) Custom — endpoint อื่นที่เป็น OpenAI-compatible
// window.AI_CONFIG = { provider: "custom", name: "ชื่อที่แสดง", endpoint: "https://.../v1/chat/completions", apiKey: "...", model: "..." };
