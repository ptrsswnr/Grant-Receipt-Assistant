// ─────────────────────────────────────────────────────────────
// js/nav.js — แถบเมนูด้านบนที่ใช้ร่วมกันทุกหน้า
// แก้เมนูที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตามพร้อมกัน
//
// วิธีใช้: ทุกหน้ามี <div id="nav"></div> ไว้บนสุดของ body
// ─────────────────────────────────────────────────────────────

(function () {
  var menuItems = [
    { href: "index.html", label: "หน้าแรก" },
    { href: "projects.html", label: "โครงการของฉัน" },
    { href: "receipts.html", label: "ใบเสร็จของฉัน" },
    { href: "new-receipt.html", label: "อัปโหลดใบเสร็จใหม่" },
    { href: "admin-dashboard.html", label: "Admin Dashboard" },
    { href: "fund-sources.html", label: "แหล่งทุน (Admin)" },
    { href: "seed.html", label: "🌱 ใส่ข้อมูลตัวอย่าง" },
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
})();
