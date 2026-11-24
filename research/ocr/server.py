"""Local OCR service for the web app — OpenThai 2.0 OCR Text, nothing leaves this machine.

Usage: .venv/Scripts/python server.py [--port 8765]

GET  /health  -> {"ok": true, "engine": ...}
POST /ocr     body = image bytes (png/jpg) -> {"text", "lines": [{"text", "confidence", "box"}], "lowConfidence", "seconds"}
              body = PDF bytes -> same fields for the whole file (pages joined in order), plus
              "pages": [{"page", "text", "lines", "lowConfidence"}] — every page is rendered and read
              one at a time, so a large scan never has to fit in memory as one image

Listens on 127.0.0.1 only. Answers browsers only from the origins in ALLOWED_ORIGINS
(the local static server and the live site). The page in new-receipt.html calls this
before the AI step; when it isn't running, the page simply skips OCR.
"""
import argparse
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "OpenThai2.0-OCR-Text"
sys.path.insert(0, str(MODEL_DIR))
from runtime.line_engine import LineOCR  # noqa: E402

ENGINE = "OpenThai2.0-OCR-Text"
LOW_CONFIDENCE = 0.90
MAX_BYTES = 15 * 1024 * 1024
# A whole project's scanned documents in one PDF; localhost only, pages are read one at a time
MAX_PDF_BYTES = 300 * 1024 * 1024
PDF_DPI = 200
ALLOWED_ORIGINS = {
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://grant-receipt-assistant.web.app",
    "https://grant-receipt-assistant.firebaseapp.com",
}

ocr = None
ocr_lock = threading.Lock()  # one model instance; requests take turns


def bbox_of(corners):
    # Axis-aligned {x, y, w, h} in page pixels, not the engine's 4 corners: receipts store OCR lines in
    # Firestore, which rejects nested arrays. The estimate importer rebuilds table columns from it.
    if not corners:
        return None
    xs = [p[0] for p in corners]
    ys = [p[1] for p in corners]
    return {"x": round(min(xs), 1), "y": round(min(ys), 1),
            "w": round(max(xs) - min(xs), 1), "h": round(max(ys) - min(ys), 1)}


def lines_of(result):
    return [{"text": ln["text"], "confidence": round(float(ln["confidence"]), 4), "box": bbox_of(ln.get("box"))}
            for ln in result["lines"]]


def read_pdf(data):
    import pypdfium2 as pdfium
    try:
        pdf = pdfium.PdfDocument(data)
    except pdfium.PdfiumError as err:
        raise ValueError(f"cannot open PDF: {err}")
    pages = []
    for i in range(len(pdf)):
        image = pdf[i].render(scale=PDF_DPI / 72).to_pil()
        with ocr_lock:
            result = ocr.read(image)
        lines = lines_of(result)
        pages.append({
            "page": i + 1,
            "text": result["text"],
            "lines": lines,
            "lowConfidence": [ln for ln in lines if ln["confidence"] < LOW_CONFIDENCE],
        })
    return pages


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            # Chrome asks a public https page for permission before it may call localhost
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):  # noqa: N802
        origin_ok = self.headers.get("Origin", "") in ALLOWED_ORIGINS
        self.send_response(204 if origin_ok else 403)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            return self._json(200, {"ok": True, "engine": ENGINE})
        return self._json(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/ocr":
            return self._json(404, {"error": "not found"})
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return self._json(403, {"error": "origin not allowed"})
        length = int(self.headers.get("Content-Length") or 0)
        is_pdf = "pdf" in self.headers.get("Content-Type", "")
        if not 0 < length <= (MAX_PDF_BYTES if is_pdf else MAX_BYTES):
            return self._json(413, {"error": "file missing or too large"})
        body = self.rfile.read(length)
        start = time.perf_counter()
        if body[:5] == b"%PDF-":
            try:
                pages = read_pdf(body)
            except ValueError as err:
                return self._json(400, {"error": str(err)})
            lines = [ln for p in pages for ln in p["lines"]]
            return self._json(200, {
                "engine": ENGINE,
                "text": "\n".join(p["text"] for p in pages),
                "lines": lines,
                "lowConfidence": [ln for ln in lines if ln["confidence"] < LOW_CONFIDENCE],
                "pages": pages,
                "seconds": round(time.perf_counter() - start, 3),
            })
        try:
            with ocr_lock:
                result = ocr.read(body)
        except ValueError as err:
            return self._json(400, {"error": str(err)})
        lines = lines_of(result)
        self._json(200, {
            "engine": ENGINE,
            "text": result["text"],
            "lines": lines,
            "lowConfidence": [ln for ln in lines if ln["confidence"] < LOW_CONFIDENCE],
            "seconds": round(time.perf_counter() - start, 3),
        })

    def log_message(self, fmt, *args):
        # don't print request bodies or paths with data; just method + status
        sys.stderr.write("%s %s\n" % (self.command, args[1] if len(args) > 1 else ""))


def main():
    global ocr
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    ocr = LineOCR(str(MODEL_DIR), threads=2)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"OCR ในเครื่องพร้อมใช้ที่ http://127.0.0.1:{args.port} (กด Ctrl+C เพื่อปิด)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
