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
// - ไฟล์ที่อัปโหลดถูกตั้งสิทธิ์ "ทุกคนที่มีลิงก์ดูได้" (เหมือนพฤติกรรมเดิมของ Storage downloadURL
//   ที่ฝัง token ในลิงก์) เพื่อให้ admin dashboard เปิดดูไฟล์ของผู้ใช้คนอื่นได้เหมือนเดิม
// - ลบใบเสร็จ (receipts.js) ไม่ได้ลบไฟล์จริงใน Drive ด้วย (ลบแค่เอกสารอ้างอิงใน Firestore) —
//   เหมือนพฤติกรรมเดิมตอนใช้ Storage ยังไม่ provision เป็นข้อจำกัดที่รู้อยู่แล้ว ไม่ใช่บั๊ก
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
window.googleDriveConnect = function () {
  return requestDriveAccessToken();
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
    throw new Error("Google Drive API error " + res.status + ": " + body);
  }
  return res.json();
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

async function makeFileViewableByAnyoneWithLink(fileId) {
  await driveApiFetch("https://www.googleapis.com/drive/v3/files/" + fileId + "/permissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

// อัปโหลดไฟล์แนบ 1 ไฟล์ของใบเสร็จ receiptId ไปไว้ใต้โฟลเดอร์ "Grant Receipt Assistant/{receiptId}"
// ในไดรฟ์ของผู้ใช้ที่เชื่อมต่อ (googleDriveConnect) — คืนค่า { id, webViewLink }
window.googleDriveUploadReceiptFile = async function (file, receiptId) {
  if (!window.googleDriveIsConnected()) {
    throw new Error("ยังไม่ได้เชื่อมต่อ Google Drive หรือหมดอายุแล้ว — กดปุ่ม \"เชื่อมต่อ Google Drive\" อีกครั้ง");
  }
  var folderId = await ensureReceiptFolder(receiptId);
  var uploaded = await uploadFileContent(file, folderId);
  await makeFileViewableByAnyoneWithLink(uploaded.id);
  return uploaded;
};
