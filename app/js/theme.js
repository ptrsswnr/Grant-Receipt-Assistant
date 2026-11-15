// ─────────────────────────────────────────────────────────────
// js/theme.js — โหมดสว่าง/มืด และสีหลักที่ผู้ใช้เลือก จำไว้ในเครื่อง (localStorage) แยกตามอุปกรณ์
// โหลดแบบไม่ defer ใน <head> ของทุกหน้า ก่อนหน้าจะวาด เพื่อไม่ให้หน้าขาวแวบก่อนเปลี่ยนเป็นโหมดมืด
// ผลลัพธ์อยู่ที่ <html data-theme="light|dark" data-accent="..."> — style.css อ่านสองค่านี้
// ตัวเลือกในเมนู (js/nav.js) เรียก window.ThemePrefs.setMode()/setAccent()
// ─────────────────────────────────────────────────────────────
(function () {
  var MODE_KEY = "gra-theme-mode";
  var ACCENT_KEY = "gra-accent";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  // ค่า swatch ต้องตรงกับ --accent-h/--accent-c ใน style.css; ไม่มีสีเขียว/เหลือง/ส้ม/แดง เพราะชนกับสีสถานะใบเสร็จ
  var ACCENTS = [
    { id: "sky", label: "ฟ้า", swatch: "oklch(53% 0.13 238)" },
    { id: "lavender", label: "ลาเวนเดอร์", swatch: "oklch(53% 0.14 295)" },
    { id: "indigo", label: "คราม", swatch: "oklch(53% 0.15 268)" },
    { id: "teal", label: "เขียวอมฟ้า", swatch: "oklch(53% 0.1 195)" },
    { id: "plum", label: "พลัม", swatch: "oklch(53% 0.14 330)" },
    { id: "graphite", label: "กราไฟต์", swatch: "oklch(53% 0.035 255)" },
  ];
  var MODES = ["light", "dark", "auto"];

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode: choice lasts this page only */ }
  }

  function getMode() {
    var mode = read(MODE_KEY);
    // ค่าเริ่มต้นเป็นโหมดสว่างเสมอ (ไม่ตามระบบ) จนกว่าผู้ใช้จะเลือกเอง — ตัดสินใจโดยเจ้าของโปรเจกต์
    return MODES.indexOf(mode) !== -1 ? mode : "light";
  }
  function getAccent() {
    var accent = read(ACCENT_KEY);
    return ACCENTS.some(function (a) { return a.id === accent; }) ? accent : "sky";
  }

  function apply() {
    var mode = getMode();
    var dark = mode === "dark" || (mode === "auto" && media && media.matches);
    root.setAttribute("data-theme", dark ? "dark" : "light");
    var accent = getAccent();
    if (accent === "sky") root.removeAttribute("data-accent");
    else root.setAttribute("data-accent", accent);
    document.dispatchEvent(new CustomEvent("themechange"));
  }

  apply();
  if (media) {
    if (media.addEventListener) media.addEventListener("change", apply);
    else if (media.addListener) media.addListener(apply);
  }

  window.ThemePrefs = {
    ACCENTS: ACCENTS,
    getMode: getMode,
    getAccent: getAccent,
    setMode: function (mode) { write(MODE_KEY, mode); apply(); },
    setAccent: function (accent) { write(ACCENT_KEY, accent); apply(); },
  };
})();
