// ─────────────────────────────────────────────────────────────
// js/google-drive.js — อัปโหลดไฟล์แนบใบเสร็จขึ้น Google Drive (แทน Firebase Storage)
// ใช้แทน Firebase Storage ชั่วคราวเพราะโปรเจกต์ยังไม่อัปเกรดเป็น Blaze plan (ดู CLAUDE.md
// หัวข้อ "แนบไฟล์จริงผ่าน Google Drive") — auth คนละชั้นกับ Firebase Auth: ผู้ใช้ต้องกดปุ่ม
// "เชื่อมต่อ Google Drive" เพื่อ authorize บัญชี Google ของตัวเอง (Google Identity Services,
// scope drive.file — แอปเห็นเฉพาะไฟล์ที่แอปสร้างเอง ไม่ใช่ทั้งไดรฟ์) แยกจากการล็อกอินแอปด้วย
// Firebase email/password อีกที ต้องโหลด https://accounts.google.com/gsi/client ก่อนไฟล์นี้
//
// ข้อจำกัดที่รู้อยู่แล้ว (เหมาะกับการทดลอง/สาธิต ไม่ใช่ของจริงระดับโปรดักชัน):
// - access token มีอายุ ~1 ชั่วโมง ไม่มี refresh token (ไม่มี backend เก็บ) — หมดอายุแล้วต้องกด
//   เชื่อมต่อใหม่ ก่อนส่งเข้าตรวจถ้าเผื่อเวลาทำ step 1-2 นานเกิน 1 ชม.
// ความเป็นส่วนตัวของไฟล์ (FR-37/NFR-15 — เพิ่ม 2026-11-17):
// - ไฟล์ไม่ได้แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" อีกแล้ว แชร์เฉพาะบัญชีแอดมินที่อยู่ในเอกสาร
//   appConfig/driveSharing.adminEmails (ไม่ส่งอีเมลแจ้ง) — อ่านรายชื่อไม่ได้ = ไฟล์เป็นของเจ้าของคนเดียว
// - เชื่อมต่อ Drive ครั้งใดก็ตาม ระบบถอนลิงก์สาธารณะของไฟล์เก่าที่แอปเคยสร้างให้อัตโนมัติ
// - ลบใบเสร็จ (receipts.js) ลบไฟล์จริงใน Drive ก่อน ถ้าลบไม่สำเร็จจะไม่ลบข้อมูลใดในระบบเลย
// ─────────────────────────────────────────────────────────────

// OAuth Client ID สร้างไว้ที่ Google Cloud Console (Google Auth Platform → Clients) ของโปรเจกต์
// grant-receipt-assistant แยกต่างหากจาก web client ที่ Firebase สร้างอัตโนมัติให้ Firebase Auth เอง
// (อย่าใช้ตัว auto-created ปนกัน — origins ของมันซิงค์มาจาก Firebase Auth ไม่ใช่ที่ตั้งเอง)
// Authorized JavaScript origins ที่ตั้งไว้: http://localhost:4173 (ตรงพอร์ตที่ scripts/static-server.ps1 ใช้)
var GOOGLE_DRIVE_CLIENT_ID = "748022324743-oov00vjndmbjhqj96qioluakek2u7fi2.apps.googleusercontent.com";
var GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
var GOOGLE_DRIVE_ROOT_FOLDER_NAME = "Grant Receipt Assistant";

var driveAccessToken = null;
var driveTokenExpiresAt = 0;
var driveTokenClient = null;
var driveRootFolderIdCache = null;

function getDriveTokenClient() {
  if (!driveTokenClient) {
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: function () {},
    });
  }
  return driveTokenClient;
}

function requestDriveAccessToken() {
  return new Promise(function (resolve, reject) {
    var client = getDriveTokenClient();
    client.callback = function (response) {
      if (response.error) {
        reject(new Error("เชื่อมต่อ Google Drive ไม่สำเร็จ: " + response.error));
        return;
      }
      driveAccessToken = response.access_token;
      driveTokenExpiresAt = Date.now() + (response.expires_in - 60) * 1000;
      resolve(driveAccessToken);
    };
    client.requestAccessToken({ prompt: driveAccessToken ? "" : "consent" });
  });
}

// เรียกจากปุ่ม "เชื่อมต่อ Google Drive" เท่านั้น (ต้องมาจาก user gesture ตรงๆ ไม่งั้น popup โดนบล็อก)
window.googleDriveConnect = async function () {
  var token = await requestDriveAccessToken();
  // ไม่รอให้เสร็จ — ไม่ควรทำให้การเชื่อมต่อช้า และถ้าล้มเหลวจะลองใหม่รอบหน้าที่เชื่อมต่อ
  restrictLegacyPublicFiles().then(function (count) {
    if (count) console.info("ถอนลิงก์สาธารณะของไฟล์ใบเสร็จเก่าแล้ว " + count + " ไฟล์");
  }).catch(function (err) {
    console.warn("ถอนลิงก์สาธารณะของไฟล์เก่าไม่สำเร็จ จะลองใหม่ตอนเชื่อมต่อครั้งหน้า", err);
  });
  return token;
};

// รหัสไฟล์ Drive จากเอกสาร files: ใบเสร็จใหม่เก็บ driveFileId ไว้ตรงๆ ใบเก่าดึงจากลิงก์ /d/{id}/
window.googleDriveFileIdOf = function (fileDoc) {
  if (fileDoc.driveFileId) return fileDoc.driveFileId;
  var m = String(fileDoc.fileReference || "").match(/drive\.google\.com\/(?:file\/)?d\/([\w-]+)/) ||
    String(fileDoc.fileReference || "").match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);
  return m ? m[1] : null;
};

// ลบไฟล์ใน Drive — ไฟล์ที่ไม่พบแล้ว (404) ถือว่าลบสำเร็จ เพื่อให้ลองซ้ำได้ปลอดภัย
window.googleDriveDeleteFile = async function (fileId) {
  if (!window.googleDriveIsConnected()) throw new Error("ยังไม่ได้เชื่อมต่อ Google Drive หรือหมดอายุแล้ว");
  try {
    await driveApiFetch("https://www.googleapis.com/drive/v3/files/" + fileId, { method: "DELETE" });
  } catch (err) {
    if (err.status === 404) return;
    throw err;
  }
};

window.googleDriveIsConnected = function () {
  return !!driveAccessToken && Date.now() < driveTokenExpiresAt;
};

async function driveApiFetch(url, options) {
  options = options || {};
  options.headers = Object.assign({ Authorization: "Bearer " + driveAccessToken }, options.headers || {});
  var res = await fetch(url, options);
  if (!res.ok) {
    var body = await res.text();
    var error = new Error("Google Drive API error " + res.status + ": " + body);
    error.status = res.status;
    throw error;
  }
  return res.status === 204 ? null : res.json();
}

async function ensureFolder(name, parentId) {
  var q = "name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    + " and '" + (parentId || "root") + "' in parents";
  var listResult = await driveApiFetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) + "&fields=files(id,name)");
  if (listResult.files && listResult.files.length > 0) return listResult.files[0].id;

  var created = await driveApiFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  return created.id;
}

async function ensureReceiptFolder(receiptId) {
  if (!driveRootFolderIdCache) {
    driveRootFolderIdCache = await ensureFolder(GOOGLE_DRIVE_ROOT_FOLDER_NAME, null);
  }
  return ensureFolder(receiptId, driveRootFolderIdCache);
}

async function uploadFileContent(file, folderId) {
  var metadata = { name: file.name, parents: [folderId] };
  var boundary = "grant-receipt-assistant-" + Date.now();
  var fileContent = await file.arrayBuffer();
  var encoder = new TextEncoder();
  var body = new Blob([
    encoder.encode("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n"),
    encoder.encode("--" + boundary + "\r\nContent-Type: " + (file.type || "application/octet-stream") + "\r\n\r\n"),
    fileContent,
    encoder.encode("\r\n--" + boundary + "--"),
  ]);

  return driveApiFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { "Content-Type": "multipart/related; boundary=" + boundary },
    body: body,
  });
}

// รายชื่ออีเมลแอดมินที่ไฟล์ใบเสร็จต้องแชร์ให้ (FR-37: เจ้าของ + แอดมินเท่านั้น) — เก็บที่
// appConfig/driveSharing ให้ผู้ใช้ที่ล็อกอินอ่านได้ เพราะนักวิจัยอ่านเอกสาร users ของคนอื่นไม่ได้
var adminShareEmailsPromise = null;
function getAdminShareEmails() {
  if (!adminShareEmailsPromise) {
    adminShareEmailsPromise = db.collection("appConfig").doc("driveSharing").get().then(function (doc) {
      var me = (firebase.auth().currentUser || {}).email;
      var emails = (doc.exists && doc.data().adminEmails) || [];
      return emails.filter(function (e) { return e && e !== me; });
    }).catch(function (err) {
      console.warn("อ่านรายชื่อแอดมินสำหรับแชร์ไฟล์ไม่ได้ — ไฟล์จะเป็นของเจ้าของคนเดียว", err);
      return [];
    });
  }
  return adminShareEmailsPromise;
}

async function shareWithAdmins(fileId, existingPermissions) {
  var emails = await getAdminShareEmails();
  var already = (existingPermissions || []).map(function (p) { return (p.emailAddress || "").toLowerCase(); });
  for (var i = 0; i < emails.length; i++) {
    if (already.indexOf(emails[i].toLowerCase()) !== -1) continue;
    await driveApiFetch("https://www.googleapis.com/drive/v3/files/" + fileId + "/permissions?sendNotificationEmail=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "user", emailAddress: emails[i] }),
    });
  }
}

// ถอนลิงก์สาธารณะ ("ทุกคนที่มีลิงก์ดูได้") จากไฟล์ใบเสร็จเก่าที่แอปเคยสร้าง แล้วแชร์ให้แอดมินแทน
// (FR-37 ข้อ 5) — scope drive.file เห็นเฉพาะไฟล์ที่แอปนี้สร้าง จึงไม่แตะไฟล์อื่นของผู้ใช้
async function restrictLegacyPublicFiles() {
  var pageToken = null;
  var fixed = 0;
  do {
    var q = "trashed=false and mimeType!='application/vnd.google-apps.folder'";
    var url = "https://www.googleapis.com/drive/v3/files?pageSize=200&q=" + encodeURIComponent(q) +
      "&fields=" + encodeURIComponent("nextPageToken,files(id,permissions(id,type,emailAddress))") +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    var page = await driveApiFetch(url);
    var files = page.files || [];
    for (var i = 0; i < files.length; i++) {
      var perms = files[i].permissions || [];
      var publicPerm = perms.filter(function (p) { return p.type === "anyone"; })[0];
      if (!publicPerm) continue;
      await driveApiFetch("https://www.googleapis.com/drive/v3/files/" + files[i].id + "/permissions/" + publicPerm.id, { method: "DELETE" });
      await shareWithAdmins(files[i].id, perms);
      fixed++;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return fixed;
}

// อัปโหลดไฟล์แนบ 1 ไฟล์ของใบเสร็จ receiptId ไปไว้ใต้โฟลเดอร์ "Grant Receipt Assistant/{receiptId}"
// ในไดรฟ์ของผู้ใช้ที่เชื่อมต่อ (googleDriveConnect) — คืนค่า { id, webViewLink }
window.googleDriveUploadReceiptFile = async function (file, receiptId) {
  if (!window.googleDriveIsConnected()) {
    throw new Error("ยังไม่ได้เชื่อมต่อ Google Drive หรือหมดอายุแล้ว — กดปุ่ม \"เชื่อมต่อ Google Drive\" อีกครั้ง");
  }
  var folderId = await ensureReceiptFolder(receiptId);
  var uploaded = await uploadFileContent(file, folderId);
  await shareWithAdmins(uploaded.id, []);
  return uploaded;
};
