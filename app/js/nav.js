// ─────────────────────────────────────────────────────────────
// js/nav.js — แถบเมนูด้านบนที่ใช้ร่วมกันทุกหน้า
// แก้เมนูที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตามพร้อมกัน
//
// วิธีใช้: ทุกหน้ามี <div id="nav"></div> ไว้บนสุดของ body
// ─────────────────────────────────────────────────────────────

(function () {
  var เมนู = [
    { href: "index.html", ชื่อ: "หน้าแรก" },
    { href: "receipts.html", ชื่อ: "ใบเสร็จของฉัน" },
    { href: "new-receipt.html", ชื่อ: "อัปโหลดใบเสร็จใหม่" },
    { href: "seed.html", ชื่อ: "🌱 ใส่ข้อมูลตัวอย่าง" },
  ];

  var หน้าปัจจุบัน = location.pathname.split("/").pop() || "index.html";

  var html = '<header class="proto-bar">';
  html += '<div class="proto-bar__brand">🧾 Grant Receipt Assistant</div>';
  html += '<nav class="proto-bar__nav">';
  เมนู.forEach(function (m) {
    var active = m.href === หน้าปัจจุบัน ? ' class="active"' : "";
    html += '<a href="' + m.href + '"' + active + ">" + m.ชื่อ + "</a>";
  });
  html += '</nav>';
  html += '<div class="proto-bar__meta"><span class="role-badge" id="navUser">นักวิจัย/เจ้าของทุน</span></div>';
  html += '</header>';

  var ที่วาง = document.getElementById("nav");
  if (ที่วาง) ที่วาง.innerHTML = html;
})();
