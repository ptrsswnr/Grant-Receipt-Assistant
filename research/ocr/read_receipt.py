"""Read receipts with OpenThai 2.0 OCR Text, locally (nothing leaves this machine).

Usage: .venv/Scripts/python read_receipt.py samples/receipt1.jpg [more files ...]
Prints each line with its confidence, and saves output/<file>.json (text, lines,
confidence, seconds) for the evaluation harness to compare against ground truth.
"""
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "OpenThai2.0-OCR-Text"
sys.path.insert(0, str(MODEL_DIR))
from runtime.line_engine import LineOCR  # noqa: E402

LOW_CONFIDENCE = 0.90


def pages(path):
    if path.suffix.lower() == ".pdf":
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(path))
        for i in range(len(pdf)):
            yield pdf[i].render(scale=200 / 72).to_pil()
    else:
        yield str(path)


def main(files):
    sys.stdout.reconfigure(encoding="utf-8")
    ocr = LineOCR(str(MODEL_DIR), threads=2)
    out_dir = HERE / "output"
    out_dir.mkdir(exist_ok=True)

    for name in files:
        path = Path(name)
        result_pages = []
        for number, page in enumerate(pages(path), start=1):
            start = time.perf_counter()
            result = ocr.read(page)
            seconds = time.perf_counter() - start
            lines = [{"text": ln["text"], "confidence": ln["confidence"]} for ln in result["lines"]]
            result_pages.append({"page": number, "seconds": round(seconds, 3), "text": result["text"], "lines": lines})

            print(f"\n=== {path.name} page {number} — {len(lines)} lines, {seconds:.2f} s ===")
            for ln in lines:
                flag = "  <-- low confidence" if ln["confidence"] < LOW_CONFIDENCE else ""
                print(f"[{ln['confidence']:.2f}] {ln['text']}{flag}")

        (out_dir / (path.name + ".json")).write_text(
            json.dumps({"file": path.name, "engine": "OpenThai2.0-OCR-Text", "pages": result_pages}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
