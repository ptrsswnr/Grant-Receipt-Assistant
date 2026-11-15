// ─────────────────────────────────────────────────────────────
// js/nav.js — แถบเมนูที่ใช้ร่วมกันทุกหน้า (แถบด้านซ้ายบนจอใหญ่ แถบด้านบนบนมือถือ — จัดวางใน style.css)
// แก้เมนูที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตามพร้อมกัน
//
// วิธีใช้: ทุกหน้ามี <div id="nav"></div> ไว้บนสุดของ body
//
// เมนูสำหรับ admin เท่านั้น (Admin Dashboard, แหล่งทุน) **ไม่ได้เรนเดอร์ไว้ที่นี่ตั้งแต่แรก** — เดิม
// แสดงให้ทุกคนเห็นแต่กันสิทธิ์แค่ตอนเข้าเนื้อหาในหน้า ทำให้ user ทั่วไปเห็นลิงก์ทั้งที่กดแล้วโดนบล็อก
// ตั้งแต่ 2026-09-10 ย้ายไปให้ app/js/auth-guard.js เป็นคนเพิ่มลิงก์เหล่านี้เข้ามาแทน หลังเช็ค isAdmin
// จาก Firestore แล้วว่าเป็น true จริง (เรียก window.showAdminNavLinks() ที่ไฟล์นี้ export ไว้)
//
// บัญชี admin เห็น**เฉพาะ** 2 ลิงก์นี้ในเมนู (ไม่เห็นเมนูของนักวิจัยเลย — โครงการของฉัน/ใบเสร็จของฉัน/
// อัปโหลดใบเสร็จใหม่ เป็นเครื่องมือของนักวิจัย ไม่ใช่ของ admin) — showAdminNavLinks() จึงแทนที่เมนูเดิม
// ทั้งหมด ไม่ใช่แค่เพิ่มต่อท้าย ชื่อแบรนด์ (มุมซ้ายบน) ยังคงเป็นลิงก์กลับ index.html ให้เสมอ กันไม่ให้
// admin ติดอยู่โดยไม่มีทางออกจากหน้า admin เลย
//
// **ซ่อนแถบเมนูไว้ก่อน** (visibility:hidden) ตอนเรนเดอร์ครั้งแรก เพราะตอนนั้นยังไม่รู้ว่า user เป็น
// admin หรือไม่ (auth-guard.js ต้องเช็ค Firestore แบบ async ก่อน) — ถ้าไม่ซ่อนไว้ ทุกครั้งที่เปิดหน้า
// ใหม่ admin จะเห็นเมนูนักวิจัยโผล่มาแวบหนึ่งก่อนเสมอ แล้วค่อยสลับเป็นเมนู admin (เจอจริงตอนทดสอบ)
// auth-guard.js ต้องเรียก window.revealNav() หลังเช็ค isAdmin เสร็จแล้วเสมอ (ทั้งกรณี admin/ไม่ใช่
// admin) ไม่งั้นเมนูจะซ่อนค้างตลอดไป
// ─────────────────────────────────────────────────────────────

(function () {
  // ไอคอนเส้น (Lucide) ขนาด 24 — ใช้ร่วมกันทั้งเมนูนักวิจัยและเมนู admin
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    landmark: '<path d="M3 21h18"/><path d="M5 21V10M9 21V10M15 21V10M19 21V10"/><path d="m12 3 9 5H3Z"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H16a2 2 0 0 0-1.5 3.3A1.8 1.8 0 0 1 12 22Z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10.5" cy="7.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  };

  function icon(name) {
    return '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  var menuItems = [
    { href: "index.html", label: "หน้าแรก", short: "หน้าแรก", icon: "home" },
    { href: "projects.html", label: "โครงการของฉัน", short: "โครงการ", icon: "folder" },
    { href: "receipts.html", label: "ใบเสร็จของฉัน", short: "ใบเสร็จ", icon: "receipt" },
    { href: "new-receipt.html", label: "อัปโหลดใบเสร็จใหม่", short: "อัปโหลด", icon: "upload" },
  ];

  // short = ป้ายบนแถบเมนูด้านล่างจอมือถือ (ต้องพอดีบรรทัดเดียว)
  window.ADMIN_NAV_ITEMS = [
    { href: "admin-dashboard.html", label: "Admin Dashboard", short: "Dashboard", icon: "dashboard" },
    { href: "fund-sources.html", label: "แหล่งทุน (Admin)", short: "แหล่งทุน", icon: "landmark" },
  ];

  var currentPage = location.pathname.split("/").pop() || "index.html";

  function linkHtml(m) {
    var active = m.href === currentPage ? ' class="active" aria-current="page"' : "";
    return '<a href="' + m.href + '"' + active + ' title="' + m.label + '">' + icon(m.icon) +
      '<span class="nav-label">' + m.label + '</span><span class="nav-label-short">' + m.short + "</span></a>";
  }

  // ─── ตัวเลือกธีม: โหมดสว่าง/มืด/ตามระบบ + สีหลัก 6 สี (ค่าเก็บและนำไปใช้ใน js/theme.js) ───
  var MODE_OPTIONS = [
    { id: "light", label: "สว่าง", icon: "sun" },
    { id: "dark", label: "มืด", icon: "moon" },
    { id: "auto", label: "ตามระบบ", icon: "monitor" },
  ];

  function themePickerHtml() {
    if (!window.ThemePrefs) return "";
    var html = '<div class="theme-picker">' +
      '<button type="button" class="theme-picker__toggle" aria-expanded="false" aria-controls="themePanel">' +
        icon("palette") + '<span>ธีมและสี</span></button>' +
      '<div class="theme-picker__panel" id="themePanel" hidden>' +
        '<div class="theme-picker__label" id="themeModeLabel">โหมดหน้าจอ</div>' +
        '<div class="theme-picker__modes" role="radiogroup" aria-labelledby="themeModeLabel">';
    MODE_OPTIONS.forEach(function (m) {
      html += '<button type="button" role="radio" data-theme-mode="' + m.id + '">' + icon(m.icon) + '<span>' + m.label + '</span></button>';
    });
    html += '</div><div class="theme-picker__label" id="themeAccentLabel">สีหลัก</div>' +
      '<div class="theme-picker__swatches" role="radiogroup" aria-labelledby="themeAccentLabel">';
    window.ThemePrefs.ACCENTS.forEach(function (a) {
      html += '<button type="button" role="radio" data-theme-accent="' + a.id + '" aria-label="' + a.label + '" title="' + a.label + '">' +
        '<span class="theme-picker__swatch" style="background:' + a.swatch + '"></span></button>';
    });
    return html + '</div></div></div>';
  }

  function syncThemePicker(container) {
    if (!window.ThemePrefs) return;
    var mode = window.ThemePrefs.getMode();
    var accent = window.ThemePrefs.getAccent();
    // radiogroup แบบมาตรฐาน: Tab เข้าได้ทีละกลุ่ม (เฉพาะตัวที่เลือกอยู่), ลูกศรเลื่อนเลือกในกลุ่ม
    container.querySelectorAll("[data-theme-mode]").forEach(function (b) {
      var on = b.getAttribute("data-theme-mode") === mode;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    container.querySelectorAll("[data-theme-accent]").forEach(function (b) {
      var on = b.getAttribute("data-theme-accent") === accent;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }

  function wireThemePicker(container) {
    var toggle = container.querySelector(".theme-picker__toggle");
    var panel = container.querySelector(".theme-picker__panel");
    if (!toggle || !panel) return;
    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    toggle.addEventListener("click", function () { setOpen(panel.hidden); });
    panel.addEventListener("click", function (e) {
      var modeBtn = e.target.closest("[data-theme-mode]");
      var accentBtn = e.target.closest("[data-theme-accent]");
      if (modeBtn) window.ThemePrefs.setMode(modeBtn.getAttribute("data-theme-mode"));
      if (accentBtn) window.ThemePrefs.setAccent(accentBtn.getAttribute("data-theme-accent"));
    });
    panel.addEventListener("keydown", function (e) {
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      var current = e.target.closest('[role="radio"]');
      if (!step || !current) return;
      var group = Array.prototype.slice.call(current.parentElement.querySelectorAll('[role="radio"]'));
      var next = group[(group.indexOf(current) + step + group.length) % group.length];
      e.preventDefault();
      next.click();
      next.focus();
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !e.target.closest(".theme-picker")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("themechange", function () { syncThemePicker(container); });
    syncThemePicker(container);
  }

  var html = '<header class="proto-bar">';
  html += '<a href="index.html" class="proto-bar__brand">' +
    '<span class="brand-mark">' + icon("receipt") + '</span>' +
    '<span class="brand-name">Grant Receipt <br><span class="brand-tail">Assistant</span></span></a>';
  html += '<nav class="proto-bar__nav" aria-label="เมนูหลัก">';
  menuItems.forEach(function (m) { html += linkHtml(m); });
  html += '</nav>';
  html += '<div class="proto-bar__meta">' + themePickerHtml() + '<span class="role-badge" id="navUser">นักวิจัย/เจ้าของทุน</span></div>';
  html += '</header>';

  var navContainer = document.getElementById("nav");
  if (navContainer) {
    navContainer.innerHTML = html;
    navContainer.style.visibility = "hidden"; // ซ่อนไว้จนกว่า auth-guard.js จะเช็ค isAdmin เสร็จ
    wireThemePicker(navContainer);
  }

  // เรียกจาก auth-guard.js เท่านั้น หลังเช็ค isAdmin เสร็จแล้ว (ไม่ว่าจะเป็น admin หรือไม่ก็ตาม) —
  // แสดงแถบเมนูที่ซ่อนไว้ตอนแรก กันเมนูผิดโผล่มาแวบก่อนสลับ (ดูหัวคอมเมนต์ไฟล์นี้)
  window.revealNav = function () {
    var navContainer = document.getElementById("nav");
    if (navContainer) navContainer.style.visibility = "visible";
  };

  // เรียกจาก auth-guard.js เท่านั้น หลังยืนยันแล้วว่าบัญชีนี้ isAdmin === true จริง — เพิ่มลิงก์ admin
  // เข้าไปในแถบเมนูที่เรนเดอร์ไว้แล้ว (ไม่ได้ทำตอนโหลดหน้าปกติ เพราะตอนนั้นยังไม่รู้สถานะ admin)
  window.showAdminNavLinks = function () {
    var navEl = document.querySelector(".proto-bar__nav");
    if (!navEl) return;
    // แทนที่เมนูนักวิจัยทั้งหมด — admin เห็นแค่ลิงก์ admin เท่านั้น
    navEl.innerHTML = window.ADMIN_NAV_ITEMS.map(linkHtml).join("");
  };
})();
