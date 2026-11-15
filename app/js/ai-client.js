// ─────────────────────────────────────────────────────────────
// js/ai-client.js — จุดเดียวที่เรียก AI (LLM) ทั้งระบบ เปลี่ยนผู้ให้บริการได้โดยแก้ config อย่างเดียว
// ทุกผู้ให้บริการที่รองรับใช้รูปแบบ "OpenAI-compatible chat completions" เหมือนกัน:
//   - openrouter : คีย์ของคลาส (เสียเงิน, ใช้ได้เฉพาะวิชาเรียน)
//   - ollama     : โมเดลรันในเครื่องตัวเอง ฟรี ข้อมูลใบเสร็จไม่ออกจากเครื่อง (เหมาะกับงานวิจัย/EC)
//   - proxy      : เซิร์ฟเวอร์ตัวกลาง (proxy/worker.js) ถือคีย์ไว้ฝั่งเซิร์ฟเวอร์ เบราว์เซอร์ไม่เห็นคีย์
//   - custom     : endpoint อื่นที่เป็น OpenAI-compatible (ระบุ endpoint + model เอง)
// ตั้งค่าใน js/ai-config.local.js (gitignored) — ดูตัวอย่างใน js/ai-config.example.js
// ใช้ได้ทั้งเบราว์เซอร์ (window.AiClient) และ Node (require) เพื่อให้สคริปต์ประเมินผลใช้โค้ดเดียวกัน
// ─────────────────────────────────────────────────────────────
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AiClient = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  var PRESETS = {
    openrouter: { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemini-2.5-flash-lite", needsKey: true },
    ollama: { name: "Ollama (ในเครื่อง)", endpoint: "http://localhost:11434/v1/chat/completions", model: "gemma3:4b", needsKey: false },
    proxy: { name: "Proxy", endpoint: "", model: "", needsKey: false },
    custom: { name: "Custom", endpoint: "", model: "", needsKey: false },
  };

  // config ที่ใช้จริง: AI_CONFIG ถ้ามี, ไม่งั้นรองรับแบบเก่า (OPENROUTER_API_KEY อย่างเดียว)
  function resolveConfig(override) {
    var raw = override || (root && root.AI_CONFIG) || null;
    if (!raw && root && root.OPENROUTER_API_KEY) raw = { provider: "openrouter", apiKey: root.OPENROUTER_API_KEY };
    if (!raw) return null;
    var preset = PRESETS[raw.provider] || PRESETS.custom;
    var cfg = {
      provider: raw.provider || "custom",
      name: raw.name || preset.name,
      endpoint: raw.endpoint || preset.endpoint,
      model: raw.model || preset.model,
      visionModel: raw.visionModel || raw.model || preset.model,
      apiKey: raw.apiKey || "",
      needsKey: preset.needsKey,
    };
    if (!cfg.endpoint || !cfg.model) return null;
    if (cfg.needsKey && (!cfg.apiKey || /your-key-here/.test(cfg.apiKey))) return null;
    return cfg;
  }

  function isConfigured(override) {
    return !!resolveConfig(override);
  }

  // ข้อความสั้นๆ บอกผู้ใช้ว่าใช้ AI ตัวไหน เช่น "OpenRouter · google/gemini-2.5-flash-lite"
  function describe(override, vision) {
    var cfg = resolveConfig(override);
    return cfg ? cfg.name + " · " + (vision ? cfg.visionModel : cfg.model) : "";
  }

  function modelName(override, vision) {
    var cfg = resolveConfig(override);
    return cfg ? (vision ? cfg.visionModel : cfg.model) : null;
  }

  // messages: รูปแบบ OpenAI chat; opts: { vision, temperature, config, fetchImpl }
  async function chat(messages, opts) {
    opts = opts || {};
    var cfg = resolveConfig(opts.config);
    if (!cfg) throw new Error("ยังไม่ได้ตั้งค่า AI (ดู js/ai-config.example.js)");
    var headers = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers.Authorization = "Bearer " + cfg.apiKey;
    // proxy ไม่มีคีย์ฝั่งเว็บ แต่ต้องพิสูจน์ว่าล็อกอินอยู่ด้วย Firebase ID token (ดู proxy/worker.js)
    var idToken = opts.idToken;
    if (!idToken && cfg.provider === "proxy" && root && root.firebase && root.firebase.auth && root.firebase.auth().currentUser) {
      idToken = await root.firebase.auth().currentUser.getIdToken();
    }
    if (idToken) headers.Authorization = "Bearer " + idToken;
    var body = { model: opts.vision ? cfg.visionModel : cfg.model, messages: messages };
    if (typeof opts.temperature === "number") body.temperature = opts.temperature;
    var doFetch = opts.fetchImpl || fetch;
    var response = await doFetch(cfg.endpoint, { method: "POST", headers: headers, body: JSON.stringify(body) });
    if (!response.ok) {
      var errBody = await response.text();
      throw new Error(cfg.name + " error " + response.status + ": " + errBody.slice(0, 200));
    }
    var result = await response.json();
    var content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
    if (!content) throw new Error(cfg.name + " ไม่ส่งข้อความกลับมา");
    return String(content).trim();
  }

  // โมเดลบางตัวห่อ JSON ด้วย ```json ... ``` หรือมีข้อความนำหน้า — ดึงเฉพาะก้อน JSON ก่อน parse
  function extractJson(text) {
    var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    var body = (fenced ? fenced[1] : text).trim();
    if (body[0] !== "{" && body[0] !== "[") {
      var start = body.indexOf("{");
      var end = body.lastIndexOf("}");
      if (start !== -1 && end > start) body = body.slice(start, end + 1);
    }
    return JSON.parse(body);
  }

  return { PRESETS: PRESETS, resolveConfig: resolveConfig, isConfigured: isConfigured, describe: describe, modelName: modelName, chat: chat, extractJson: extractJson };
});
