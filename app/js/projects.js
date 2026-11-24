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
    warningBox.textContent = message;
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
      // แหล่งทุนที่ปิดใช้งานแล้ว (FR-35) ยังแสดงชื่อในโครงการเดิมได้ แต่เลือกสร้างโครงการใหม่ไม่ได้
      if (doc.data().isActive === false) return;
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
      '<div class="card" data-project-id="' + esc(projectId) + '" data-project-name="' + esc(project.projectName) + '">' +
        '<h3>' + esc(project.projectName) + '</h3>' +
        '<p class="text-small">แหล่งทุน: ' + esc(fundSourceName) + '</p>' +
        '<div class="row" style="margin-top:8px;">' +
          '<a class="btn btn-secondary btn-sm" href="receipts.html?projectId=' + esc(projectId) + '">ใบเสร็จในโครงการนี้</a>' +
          '<a class="btn btn-secondary btn-sm" href="budget.html?projectId=' + esc(projectId) + '">ประมาณการ</a>' +
          '<a class="btn btn-secondary btn-sm" href="batch-import.html?projectId=' + esc(projectId) + '">นำเข้าไฟล์สแกนทั้งโครงการ</a>' +
          '<a class="btn btn-primary btn-sm" href="new-receipt.html?projectId=' + esc(projectId) + '">อัปโหลดใบเสร็จ</a>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="delete-project">ลบโครงการ</button>' +
        '</div>' +
        '<div class="project-delete-panel"></div>' +
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

  // ─── ลบโครงการ (ลบทุกอย่างที่อยู่ใต้โครงการ) ───
  // Firestore ไม่ลบ subcollection ให้เองเมื่อลบเอกสารแม่ จึงต้องไล่ลบเองทั้งหมด:
  //   receipts/{id}/agentLogs, receipts/{id}/files, receipts/{id}, budgetLines,
  //   importBatches/{id}/pages, importBatches/{id}/documents, importBatches/{id}, แล้วจึงตัวโครงการ
  // ไฟล์จริงใน Google Drive ลบก่อนเสมอ (เหมือนการลบใบเสร็จใน receipts.js) — ลบไม่ได้แม้ไฟล์เดียว = หยุด
  // ไม่ลบอะไรในระบบ ข้อมูลจะได้ไม่หายไปทั้งที่ไฟล์ยังค้างใน Drive
  // คลิกแรกอ่านว่าจะลบอะไรบ้างแล้วแสดงในการ์ด; คลิกยืนยันเป็นการคลิกใหม่ หน้าต่างขอสิทธิ์ Drive จึงเปิดได้
  var deletePlans = {};

  function projectRefOf(projectId) {
    return db.collection("users").doc(user.uid).collection("projects").doc(projectId);
  }

  // collection ที่กฎ Firestore ยังไม่ได้ deploy จะอ่านไม่ได้ — ถ้าอ่านไม่ได้ก็แปลว่าสร้างข้อมูลไว้ไม่ได้เช่นกัน
  async function docsOrEmpty(query) {
    try {
      return (await query.get()).docs;
    } catch (err) {
      if (err.code === "permission-denied") return [];
      throw err;
    }
  }

  async function planProjectDelete(projectId) {
    var ref = projectRefOf(projectId);
    var receipts = await docsOrEmpty(ref.collection("receipts"));
    var driveFileIds = [];
    for (var i = 0; i < receipts.length; i++) {
      var files = await docsOrEmpty(receipts[i].ref.collection("files"));
      files.forEach(function (f) {
        // ไฟล์จากการนำเข้าไฟล์สแกนชี้ไปไฟล์ต้นฉบับของ importBatch — ลบผ่าน importBatch ด้านล่างครั้งเดียว
        if (f.data().importBatchId) return;
        var id = window.googleDriveFileIdOf ? window.googleDriveFileIdOf(f.data()) : null;
        if (id) driveFileIds.push(id);
      });
    }
    var batches = await docsOrEmpty(ref.collection("importBatches"));
    batches.forEach(function (b) { if (b.data().driveFileId) driveFileIds.push(b.data().driveFileId); });
    var budgetLines = await docsOrEmpty(ref.collection("budgetLines"));
    return {
      receipts: receipts, batches: batches, budgetLines: budgetLines,
      driveFileIds: driveFileIds.filter(function (id, k, arr) { return arr.indexOf(id) === k; }),
    };
  }

  function deletePanelHtml(name, plan) {
    var parts = [];
    if (plan.receipts.length) parts.push("ใบเสร็จ " + plan.receipts.length + " ใบ");
    if (plan.budgetLines.length) parts.push("ประมาณการ " + plan.budgetLines.length + " รายการ");
    if (plan.batches.length) parts.push("ผลการนำเข้าไฟล์สแกน " + plan.batches.length + " ครั้ง");
    if (plan.driveFileIds.length) parts.push("ไฟล์ใน Google Drive " + plan.driveFileIds.length + " ไฟล์");
    return (
      '<div class="banner banner--warning" style="margin-top:12px;">' +
        '<p class="text-body"><strong>ลบโครงการ "' + esc(name) + '"?</strong> ' +
        (parts.length ? "จะลบ" + parts.join(", ") + " ไปด้วย" : "โครงการนี้ยังไม่มีข้อมูลอื่น") +
        " — ลบแล้วกู้คืนไม่ได้</p>" +
        '<div class="row" style="margin-top:8px;">' +
          '<button type="button" class="btn btn-primary btn-sm" data-action="confirm-delete-project">ยืนยันลบโครงการ</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="cancel-delete-project">ยกเลิก</button>' +
        '</div>' +
      '</div>'
    );
  }

  // ลบทีละไม่เกิน 400 เอกสารต่อ batch (Firestore จำกัด 500 ต่อ batch)
  async function deleteRefs(refs) {
    for (var i = 0; i < refs.length; i += 400) {
      var wb = db.batch();
      refs.slice(i, i + 400).forEach(function (r) { wb.delete(r); });
      await wb.commit();
    }
  }

  async function deleteProject(projectId, plan) {
    for (var d = 0; d < plan.driveFileIds.length; d++) {
      try {
        await window.googleDriveDeleteFile(plan.driveFileIds[d]);
      } catch (driveErr) {
        throw new Error("ลบไฟล์ใน Google Drive ไม่สำเร็จ (" + driveErr.message + ") — ยังไม่ได้ลบข้อมูลโครงการในระบบ กรุณาเชื่อมต่อ Drive ใหม่แล้วลองอีกครั้ง");
      }
    }
    var refs = [];
    for (var i = 0; i < plan.receipts.length; i++) {
      var r = plan.receipts[i].ref;
      (await docsOrEmpty(r.collection("agentLogs"))).forEach(function (x) { refs.push(x.ref); });
      (await docsOrEmpty(r.collection("files"))).forEach(function (x) { refs.push(x.ref); });
      refs.push(r);
    }
    for (var b = 0; b < plan.batches.length; b++) {
      var br = plan.batches[b].ref;
      (await docsOrEmpty(br.collection("pages"))).forEach(function (x) { refs.push(x.ref); });
      (await docsOrEmpty(br.collection("documents"))).forEach(function (x) { refs.push(x.ref); });
      refs.push(br);
    }
    plan.budgetLines.forEach(function (x) { refs.push(x.ref); });
    refs.push(projectRefOf(projectId));
    await deleteRefs(refs);
  }

  projectList.addEventListener("click", async function (e) {
    var button = e.target.closest("button[data-action]");
    if (!button) return;
    var card = button.closest("[data-project-id]");
    var projectId = card.dataset.projectId;
    var panel = card.querySelector(".project-delete-panel");
    var action = button.dataset.action;

    if (action === "cancel-delete-project") {
      delete deletePlans[projectId];
      panel.innerHTML = "";
      return;
    }

    if (action === "delete-project") {
      button.disabled = true;
      panel.innerHTML = '<p class="help-text" style="margin-top:12px;">กำลังตรวจว่ามีข้อมูลอะไรในโครงการนี้...</p>';
      try {
        deletePlans[projectId] = await planProjectDelete(projectId);
        panel.innerHTML = deletePanelHtml(card.dataset.projectName, deletePlans[projectId]);
      } catch (err) {
        panel.innerHTML = '<div class="banner banner--error" style="margin-top:12px;"><p class="text-body">อ่านข้อมูลโครงการไม่สำเร็จ: ' + esc(err.message) + '</p></div>';
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (action === "confirm-delete-project") {
      var plan = deletePlans[projectId];
      if (!plan) return;
      // เชื่อมต่อ Drive ก่อนเริ่มลบ — หน้าต่างขอสิทธิ์ต้องเปิดจากการคลิกนี้โดยตรง
      if (plan.driveFileIds.length && !window.googleDriveIsConnected()) {
        try {
          await window.googleDriveConnect();
        } catch (err) {
          panel.insertAdjacentHTML("beforeend", '<div class="banner banner--error" style="margin-top:8px;"><p class="text-body">ต้องเชื่อมต่อ Google Drive ก่อน เพื่อลบไฟล์ใน Drive ด้วย (' + esc(err.message) + ') — ยังไม่ได้ลบอะไร</p></div>');
          return;
        }
      }
      panel.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      button.textContent = "กำลังลบ...";
      try {
        await deleteProject(projectId, plan);
        delete deletePlans[projectId];
        existingDocs = await loadProjectList();
        if (!existingDocs.length) loadState.style.display = "block";
      } catch (err) {
        panel.innerHTML = '<div class="banner banner--error" style="margin-top:12px;"><p class="text-body">ลบโครงการไม่สำเร็จ: ' + esc(err.message) + '</p></div>';
      }
    }
  });

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
