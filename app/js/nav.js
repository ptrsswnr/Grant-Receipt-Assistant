// ─────────────────────────────────────────────────────────────
// js/nav.js — แถบเมนูด้านบนที่ใช้ร่วมกันทุกหน้า
// แก้เมนูที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตามพร้อมกัน
//
// วิธีใช้: ทุกหน้ามี <div id="nav"></div> ไว้บนสุดของ body
//
// เมนูสำหรับ admin เท่านั้น (Admin Dashboard, แหล่งทุน) **ไม่ได้เรนเดอร์ไว้ที่นี่ตั้งแต่แรก** — เดิม
// แสดงให้ทุกคนเห็นแต่กันสิทธิ์แค่ตอนเข้าเนื้อหาในหน้า ทำให้ user ทั่วไปเห็นลิงก์ทั้งที่กดแล้วโดนบล็อก
// ตั้งแต่ 2026-09-10 ย้ายไปให้ app/js/auth-guard.js เป็นคนเพิ่มลิงก์เหล่านี้เข้ามาแทน หลังเช็ค isAdmin
// จาก Firestore แล้วว่าเป็น true จริง (เรียก window.showAdminNavLinks() ที่ไฟล์นี้ export ไว้)
// ─────────────────────────────────────────────────────────────

(function () {
  var menuItems = [
    { href: "index.html", label: "หน้าแรก" },
    { href: "projects.html", label: "โครงการของฉัน" },
    { href: "receipts.html", label: "ใบเสร็จของฉัน" },
    { href: "new-receipt.html", label: "อัปโหลดใบเสร็จใหม่" },
  ];

  window.ADMIN_NAV_ITEMS = [
    { href: "admin-dashboard.html", label: "Admin Dashboard" },
    { href: "fund-sources.html", label: "แหล่งทุน (Admin)" },
  ];

  var currentPage = location.pathname.split("/").pop() || "index.html";

  var html = '<header class="proto-bar">';
  html += '<div class="proto-bar__brand">🧾 Grant Receipt Assistant</div>';
  html += '<nav class="proto-bar__nav">';
  menuItems.forEach(function (m) {
    var active = m.href === currentPage ? ' class="active"' : "";
    html += '<a href="' + m.href + '"' + active + ">" + m.label + "</a>";
  });
  html += '</nav>';
  html += '<div class="proto-bar__meta"><span class="role-badge" id="navUser">นักวิจัย/เจ้าของทุน</span></div>';
  html += '</header>';

  var navContainer = document.getElementById("nav");
  if (navContainer) navContainer.innerHTML = html;

  // เรียกจาก auth-guard.js เท่านั้น หลังยืนยันแล้วว่าบัญชีนี้ isAdmin === true จริง — เพิ่มลิงก์ admin
  // เข้าไปในแถบเมนูที่เรนเดอร์ไว้แล้ว (ไม่ได้ทำตอนโหลดหน้าปกติ เพราะตอนนั้นยังไม่รู้สถานะ admin)
  window.showAdminNavLinks = function () {
    var navEl = document.querySelector(".proto-bar__nav");
    if (!navEl) return;
    window.ADMIN_NAV_ITEMS.forEach(function (m) {
      var a = document.createElement("a");
      a.href = m.href;
      a.textContent = m.label;
      if (m.href === currentPage) a.className = "active";
      navEl.appendChild(a);
    });
  };
})();
