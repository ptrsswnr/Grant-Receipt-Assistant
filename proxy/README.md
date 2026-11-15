# AI proxy (Cloudflare Worker)

ตอนนี้ API key อยู่ใน `app/js/ai-config.local.js` ซึ่งถูก deploy ขึ้นเว็บด้วย ใครเปิด dev tools ก็เห็นคีย์
proxy นี้ย้ายคีย์ไปไว้ฝั่งเซิร์ฟเวอร์แทน

```
เว็บ (ล็อกอินแล้ว) ──Firebase ID token──▶ Worker (ถือคีย์ลับ) ──คีย์──▶ OpenRouter หรือผู้ให้บริการอื่น
```

Worker จะตรวจ 3 อย่างก่อนส่งต่อ:

1. ต้องเป็นผู้ใช้ที่ล็อกอินเว็บอยู่ (ตรวจลายเซ็น Firebase ID token)
2. ต้องมาจากเว็บที่อนุญาต
3. ต้องใช้โมเดลที่อนุญาต

คนนอกจึงเอา proxy ไปใช้เปลืองเครดิตไม่ได้

Cloudflare Workers แบบฟรีรับได้ 100,000 ครั้งต่อวัน และไม่ต้องผูกบัตรเครดิต

## ติดตั้ง (ทำครั้งเดียว ต้องใช้บัญชี Cloudflare ของคุณเอง)

```
cd proxy
npx wrangler login
npx wrangler secret put UPSTREAM_API_KEY
npx wrangler deploy
```

- `wrangler login` เปิดเบราว์เซอร์ให้ล็อกอิน Cloudflare
- `wrangler secret put UPSTREAM_API_KEY` ให้วางคีย์ตอนที่ระบบถาม
- `wrangler deploy` จะได้ URL แบบ `https://grant-receipt-ai-proxy.<ชื่อบัญชี>.workers.dev`

จากนั้นแก้ `app/js/ai-config.local.js` เป็น:

```js
window.AI_CONFIG = {
  provider: "proxy",
  endpoint: "https://grant-receipt-ai-proxy.<ชื่อบัญชี>.workers.dev/v1/chat/completions",
  model: "google/gemini-2.5-flash-lite",
};
```

แล้ว `firebase deploy --only hosting` อีกครั้ง หลังจากนี้ไฟล์บนเว็บจะไม่มีคีย์แล้ว

ควรสร้างคีย์ใหม่ที่ผู้ให้บริการด้วย เพราะคีย์เดิมเคยเปิดเผยบนเว็บไปแล้ว

## เปลี่ยนผู้ให้บริการ

แก้ `UPSTREAM_URL` และ `ALLOWED_MODELS` ใน `wrangler.toml` แล้ว `npx wrangler deploy` ใหม่

ผู้ให้บริการต้องรองรับรูปแบบ OpenAI-compatible
