// Run: node --test tests/proxy.test.js
// ทดสอบ proxy/worker.js ด้วยกุญแจที่สร้างขึ้นเองในเทสต์ (แทนกุญแจจริงของ Google) และ upstream ปลอม
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ORIGIN = "https://grant-receipt-assistant.web.app";
let worker;
let env;
let privateKey;

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function makeToken(overrides = {}, kid = "k1") {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })));
  const payload = b64url(Buffer.from(JSON.stringify({
    aud: "grant-receipt-assistant", iss: "https://securetoken.google.com/grant-receipt-assistant",
    sub: "uid123", iat: now - 10, exp: now + 3600, ...overrides,
  })));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(header + "." + payload));
  return header + "." + payload + "." + b64url(new Uint8Array(sig));
}

test.before(async () => {
  worker = await import(pathToFileURL(path.join(__dirname, "../proxy/worker.js")).href);
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  privateKey = pair.privateKey;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  env = {
    TEST_JWKS: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" }],
    FIREBASE_PROJECT_ID: "grant-receipt-assistant",
    ALLOWED_ORIGINS: ORIGIN + ",http://localhost:4173",
    ALLOWED_MODELS: "google/gemini-2.5-flash-lite",
    UPSTREAM_URL: "https://upstream.test/v1/chat/completions",
    UPSTREAM_API_KEY: "secret-key",
  };
});

function request(token, body = { model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: "hi" }] }, origin = ORIGIN) {
  return new Request("https://proxy.test/v1/chat/completions", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
}

test("a valid signed-in request is forwarded with the secret key, not the user's token", async () => {
  const realFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, init) => { forwarded = { url, init }; return new Response('{"choices":[]}', { status: 200 }); };
  try {
    const res = await worker.default.fetch(request(await makeToken()), env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.equal(forwarded.url, env.UPSTREAM_URL);
    assert.equal(forwarded.init.headers.Authorization, "Bearer secret-key");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("rejects missing, expired, forged and other-project tokens", async () => {
  assert.equal((await worker.default.fetch(request(null), env)).status, 401);
  assert.equal((await worker.default.fetch(request(await makeToken({ exp: 1 })), env)).status, 401);
  assert.equal((await worker.default.fetch(request(await makeToken({ aud: "other-project" })), env)).status, 401);
  assert.equal((await worker.default.fetch(request(await makeToken({}, "unknown-kid")), env)).status, 401);
  const good = await makeToken();
  const forged = good.split(".").slice(0, 2).join(".") + "." + good.split(".")[2].split("").reverse().join("");
  assert.equal((await worker.default.fetch(request(forged), env)).status, 401);
});

test("rejects other websites and models that aren't allowed", async () => {
  const token = await makeToken();
  assert.equal((await worker.default.fetch(request(token, undefined, "https://evil.example"), env)).status, 403);
  assert.equal((await worker.default.fetch(request(token, { model: "expensive/model", messages: [] }), env)).status, 400);
});

test("CORS preflight only for allowed origins", async () => {
  const pre = (origin) => worker.default.fetch(new Request("https://proxy.test/v1/chat/completions", { method: "OPTIONS", headers: { Origin: origin } }), env);
  assert.equal((await pre(ORIGIN)).status, 204);
  assert.equal((await pre("https://evil.example")).status, 403);
});
