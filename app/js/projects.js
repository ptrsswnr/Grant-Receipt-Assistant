// ─────────────────────────────────────────────────────────────
// js/projects.js — หน้า "โครงการของฉัน" (FR-23: นักวิจัยสร้าง/แก้ไขโครงการวิจัยเอง)
// อ่าน/เขียน users/{uid}/projects/{projectId} ของผู้ใช้ที่ล็อกอินอยู่เท่านั้น (ดูเหตุผลของ
// โครงสร้างซ้อนนี้ใน js/seed.js) — fundSources เป็นข้อมูลกลาง อ่านได้ทุกคนที่ล็อกอิน แต่เขียนได้
// เฉพาะ admin เท่านั้น (ดู firestore.rules + ACL.md) ดรอปดาวน์นี้จึงมีแค่ read
// ─────────────────────────────────────────────────────────────

(async function () {
  var projectNameInput = document.getElementById("projectName");
  var fundSourceSelect = document.getElementById("fundSourceId");
  var warningBox = document.getElementById("warningBox");
  var addProjectButton = document.getElementById("addProjectButton");
  var loadState = document.getElementById("load-state");
  var projectList = document.getElementById("project-list");

  function warn(message) {
    warningBox.textContent = "⚠️ " + message;
    warningBox.style.display = "block";
  }
  function clearWarning() {
    warningBox.style.display = "none";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var user = await window.AUTH_READY;

  var fundSourcesSnapshot;
  try {
    fundSourcesSnapshot = await db.collection("fundSources").get();
  } catch (err) {
    warn("โหลดรายชื่อแหล่งทุนไม่สำเร็จ: " + err.message);
    fundSourcesSnapshot = { forEach: function () {} };
  }

  var fundSourceNameById = {};
  if (fundSourcesSnapshot.empty) {
    var noFundSourceOption = document.createElement("option");
    noFundSourceOption.value = "";
    noFundSourceOption.textContent = "ยังไม่มีแหล่งทุนในระบบ — รอผู้ดูแลระบบเพิ่ม";
    noFundSourceOption.disabled = true;
    fundSourceSelect.appendChild(noFundSourceOption);
  } else {
    fundSourcesSnapshot.forEach(function (doc) {
      fundSourceNameById[doc.id] = doc.data().fundSourceName;
      var option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().fundSourceName;
      fundSourceSelect.appendChild(option);
    });
  }

  // หารหัสถัดไปแบบ project001, project002, ... จากรหัสเดิมที่มีอยู่จริงของผู้ใช้คนนี้เท่านั้น
  // (แต่ละคนมีลำดับของตัวเอง ไม่ใช่ collection group ข้ามผู้ใช้แบบ receipts)
  async function nextProjectId(existingDocs) {
    var maxNumber = 0;
    existingDocs.forEach(function (doc) {
      var m = doc.id.match(/^project(\d+)$/);
      if (m) maxNumber = Math.max(maxNumber, parseInt(m[1], 10));
    });
    return "project" + String(maxNumber + 1).padStart(3, "0");
  }

  function projectCardHtml(projectId, project) {
    var fundSourceName = fundSourceNameById[project.fundSourceId] || "(ไม่พบแหล่งทุน)";
    return (
      '<div class="card">' +
        '<h4>' + esc(project.projectName) + '</h4>' +
        '<p class="text-small">แหล่งทุน: ' + esc(fundSourceName) + '</p>' +
        '<div class="row" style="margin-top:8px;">' +
          '<a class="btn btn-secondary btn-sm" href="receipts.html?projectId=' + esc(projectId) + '">ใบเสร็จในโครงการนี้</a>' +
          '<a class="btn btn-primary btn-sm" href="new-receipt.html?projectId=' + esc(projectId) + '">อัปโหลดใบเสร็จ</a>' +
        '</div>' +
      '</div>'
    );
  }

  async function loadProjectList() {
    var snapshot = await db.collection("users").doc(user.uid).collection("projects").get();

    if (snapshot.empty) {
      loadState.innerHTML = '<div class="banner banner--info"><p class="text-body">ยังไม่มีโครงการวิจัย — เพิ่มโครงการแรกของคุณด้านบนได้เลย</p></div>';
      projectList.style.display = "none";
      return snapshot.docs;
    }

    projectList.innerHTML = snapshot.docs.map(function (doc) { return projectCardHtml(doc.id, doc.data()); }).join("");
    projectList.style.display = "block";
    loadState.style.display = "none";
    return snapshot.docs;
  }

  var existingDocs;
  try {
    existingDocs = await loadProjectList();
  } catch (err) {
    loadState.innerHTML = '<div class="banner banner--error"><p class="text-body"><strong>โหลดข้อมูลไม่สำเร็จ:</strong> ' + esc(err.message) + '</p></div>';
    existingDocs = [];
  }

  addProjectButton.addEventListener("click", async function () {
    clearWarning();

    var projectName = projectNameInput.value.trim();
    var fundSourceId = fundSourceSelect.value;

    if (!projectName) {
      warn("กรุณากรอกชื่อโครงการวิจัย");
      return;
    }
    if (!fundSourceId) {
      warn("กรุณาเลือกแหล่งทุน");
      return;
    }

    addProjectButton.disabled = true;
    addProjectButton.textContent = "กำลังเพิ่มโครงการ...";
    try {
      var newProjectId = await nextProjectId(existingDocs);
      await db.collection("users").doc(user.uid).collection("projects").doc(newProjectId).set({
        projectName: projectName,
        fundSourceId: fundSourceId,
        ownerUserId: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      projectNameInput.value = "";
      existingDocs = await loadProjectList();
    } catch (err) {
      warn("เพิ่มโครงการไม่สำเร็จ: " + err.message);
    } finally {
      addProjectButton.disabled = false;
      addProjectButton.textContent = "เพิ่มโครงการ";
    }
  });
})();
