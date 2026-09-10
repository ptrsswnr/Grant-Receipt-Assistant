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
  html += '<a href="index.html" class="proto-bar__brand" style="text-decoration:none;">🧾 Grant Receipt Assistant</a>';
  html += '<nav class="proto-bar__nav">';
  menuItems.forEach(function (m) {
    var active = m.href === currentPage ? ' class="active"' : "";
    html += '<a href="' + m.href + '"' + active + ">" + m.label + "</a>";
  });
  html += '</nav>';
  html += '<div class="proto-bar__meta"><span class="role-badge" id="navUser">นักวิจัย/เจ้าของทุน</span></div>';
  html += '</header>';

  var navContainer = document.getElementById("nav");
  if (navContainer) {
    navContainer.innerHTML = html;
    navContainer.style.visibility = "hidden"; // ซ่อนไว้จนกว่า auth-guard.js จะเช็ค isAdmin เสร็จ
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
    navEl.innerHTML = ""; // แทนที่เมนูนักวิจัยทั้งหมด — admin เห็นแค่ลิงก์ admin เท่านั้น
    window.ADMIN_NAV_ITEMS.forEach(function (m) {
      var a = document.createElement("a");
      a.href = m.href;
      a.textContent = m.label;
      if (m.href === currentPage) a.className = "active";
      navEl.appendChild(a);
    });
  };
})();
