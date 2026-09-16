// Copy this file to ai-config.local.js (gitignored — never commit it) and put your own
// OpenRouter API key in it. new-receipt.html loads ai-config.local.js if present, before
// receipt-ai.js — without it, window.OPENROUTER_API_KEY stays undefined and the upload flow
// falls back to demo/random data instead of calling the real AI. Get a key at
// https://openrouter.ai/keys
window.OPENROUTER_API_KEY = "sk-or-v1-your-key-here";
