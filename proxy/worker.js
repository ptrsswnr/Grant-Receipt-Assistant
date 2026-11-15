// ─────────────────────────────────────────────────────────────
// proxy/worker.js — ตัวกลางเรียก AI (Cloudflare Worker) ถือ API key ไว้ฝั่งเซิร์ฟเวอร์ เบราว์เซอร์ไม่เห็นคีย์
//
// รับ POST /v1/chat/completions (รูปแบบ OpenAI-compatible) จากเว็บ แล้วส่งต่อไป UPSTREAM_URL พร้อมคีย์ลับ
// - รับเฉพาะผู้ที่ล็อกอินเว็บอยู่: ต้องแนบ Firebase ID token (Authorization: Bearer ...) ที่ตรวจลายเซ็นแล้ว
// - รับเฉพาะเว็บที่อนุญาต (ALLOWED_ORIGINS) และเฉพาะโมเดลที่อนุญาต (ALLOWED_MODELS)
//
// ตั้งค่า (wrangler.toml [vars] + secret):
//   UPSTREAM_URL      เช่น https://openrouter.ai/api/v1/chat/completions
//   UPSTREAM_API_KEY  (secret: wrangler secret put UPSTREAM_API_KEY)
//   FIREBASE_PROJECT_ID  grant-receipt-assistant
//   ALLOWED_ORIGINS   คั่นด้วยคอมมา เช่น https://grant-receipt-assistant.web.app,http://localhost:4173
//   ALLOWED_MODELS    คั่นด้วยคอมมา (ว่าง = อนุญาตทุกโมเดล)
// ─────────────────────────────────────────────────────────────

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_BODY_BYTES = 8 * 1024 * 1024; // รูปใบเสร็จ base64 ใหญ่ได้ถึงประมาณนี้
let jwksCache = { keys: null, expiresAt: 0 };

function list(value) {
  return String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...(origin ? corsHeaders(origin) : {}) } });
}

function base64UrlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodePart(s) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(s)));
}

async function getJwks(env) {
  if (env.TEST_JWKS) return env.TEST_JWKS; // ใช้ในการทดสอบเท่านั้น
  if (jwksCache.keys && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("โหลดกุญแจของ Firebase ไม่สำเร็จ");
  const body = await res.json();
  const maxAge = Number((/max-age=(\d+)/.exec(res.headers.get("Cache-Control") || "") || [])[1] || 3600);
  jwksCache = { keys: body.keys, expiresAt: Date.now() + maxAge * 1000 };
  return body.keys;
}

// ตรวจ Firebase ID token ตามที่ Firebase กำหนด: RS256, kid ตรงกับกุญแจของ Google, aud/iss เป็นโปรเจกต์นี้, ยังไม่หมดอายุ
export async function verifyFirebaseToken(token, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("token ไม่ถูกรูปแบบ");
  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  if (header.alg !== "RS256") throw new Error("alg ไม่ถูกต้อง");
  const jwk = (await getJwks(env)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("ไม่รู้จักกุญแจของ token");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("ลายเซ็น token ไม่ถูกต้อง");
  const project = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== project || payload.iss !== "https://securetoken.google.com/" + project) throw new Error("token ไม่ได้ออกให้โปรเจกต์นี้");
  if (!(payload.exp > nowSeconds) || payload.iat > nowSeconds + 300) throw new Error("token หมดอายุ");
  if (!payload.sub) throw new Error("token ไม่มีผู้ใช้");
  return payload;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = list(env.ALLOWED_ORIGINS).includes(origin) ? origin : "";

    if (request.method === "OPTIONS") {
      return allowedOrigin ? new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) }) : new Response(null, { status: 403 });
    }
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") return json(404, { error: "not found" }, allowedOrigin);
    if (!allowedOrigin) return json(403, { error: "origin not allowed" });

    const auth = request.headers.get("Authorization") || "";
    try {
      await verifyFirebaseToken(auth.replace(/^Bearer\s+/i, ""), env);
    } catch (err) {
      return json(401, { error: "ต้องล็อกอินเว็บก่อน: " + err.message }, allowedOrigin);
    }

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > MAX_BODY_BYTES) return json(413, { error: "ไฟล์ใหญ่เกินไป" }, allowedOrigin);
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "body ต้องเป็น JSON" }, allowedOrigin);
    }
    const models = list(env.ALLOWED_MODELS);
    if (models.length && !models.includes(body.model)) return json(400, { error: "ไม่อนุญาตโมเดลนี้: " + body.model }, allowedOrigin);

    const upstream = await fetch(env.UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.UPSTREAM_API_KEY },
      body: JSON.stringify({ model: body.model, messages: body.messages, temperature: body.temperature }),
    });
    return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", ...corsHeaders(allowedOrigin) } });
  },
};
