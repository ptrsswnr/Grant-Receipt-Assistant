# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Researchers holding Mae Fah Luang University (MFU) research grants** who now file their own expense receipts with no interim review from the Finance and Accounting Division. Most have no finance or accounting background and cannot judge on their own whether a receipt meets the grant regulations. Their job: upload a receipt, find out before submitting whether it will pass, and learn exactly what to fix.
- **Grant administrators (admin role)** who manage fund sources and regulation rules and view an overview of everyone's receipts. The project owner does this job in real life.
- Devices are used about equally: phones to photograph and upload receipts on the spot, desktops to manage budget estimates and review reports.
- The audience includes older researchers and researchers with weaker eyesight, and international researchers who may not read Thai.

## Product Purpose

Catch receipt problems early, while they are still easy to fix, instead of at final-installment clearance or a funder audit. Under the earlier cash-advance model, finance reviewed every receipt before filing; that review no longer exists, and errors now surface too late. Success means a researcher submits a complete, compliant set of documents the first time.

This app is also the working prototype for the owner's M.Sc. thesis (Design Science Research) on an LLM-based assistant for receipt verification and compliance guidance for non-finance-expert researchers.

## Positioning

The compliance decision is made by deterministic rules encoded from MFU's actual regulations and the project's own approved budget estimate, never by the LLM. The LLM only explains the result in plain language and suggests fixes. Every verdict records which rule and which engine version produced it, and the interface says plainly when something could not be checked automatically, rather than implying it was verified.

## Operating Context

- A receipt is checked in this order, mirroring how finance staff actually review: the project's approved budget estimate (table 17.2 of the RS-01 proposal) first, then the regulations ("หลักการและวิธีการกำหนดค่าใช้จ่ายและงบประมาณ … ประจำปีงบประมาณ พ.ศ. 2570"), then completeness of supporting documents (forms วจ.1–วจ.8 and the rest of the chain each expense type needs, per "คู่มือการกรอกแบบฟอร์มและตัวอย่างใบเสร็จ ฉบับปรับปรุง").
- The most common real errors are missing attachments, figures that don't match the summary sheet, and a forgotten parcel-inspection stamp (ตรวจรับพัสดุ).
- Five receipt results, least to most severe: ผ่าน, ต้องแก้ไข, ต้องชี้แจง/ขออนุมัติ, ไม่เข้าเงื่อนไข, plus the transient รอตรวจสอบ while a receipt is being read.
- Researchers bring scanned PDFs, phone photos, and the university's budget-estimate spreadsheet (.xlsx).

## Capabilities and Constraints

- Plain HTML, CSS and JavaScript with no framework, bundler or build step. Firebase (Auth, Firestore, Hosting); files stored in the researcher's Google Drive. Must keep working when opened from a local static server.
- Shared stylesheet `app/css/style.css`; JavaScript generates markup that depends on its existing class names and DOM ids, so those are a hard contract.
- Pages: sign-in and sign-up, home, my projects, budget estimate per project, upload receipt (3 steps: upload → confirm fields + document checklist + estimate line → result), my receipts, and admin-only fund sources/rule editor and dashboard.
- UI copy is Thai; code identifiers are English. Any typeface must render Thai properly.
- Real OCR (local OpenThai 2.0 OCR) is research-only and not wired into the web app yet; in-app reading uses a vision LLM when configured and otherwise demo data, which the interface labels honestly.

## Brand Commitments

No university identity is required; this is a research tool, not an official MFU system. The product name is "Grant Receipt Assistant". Voice: plain, calm, specific Thai that a non-finance reader understands, with no accounting jargon left unexplained.

## Evidence on Hand

- Real regulation documents (2570 budget principles, the revised forms manual) are encoded in `app/js/data.js`; the RS-01 proposal template and the 17.2 budget helper spreadsheet are the real input formats.
- No real users, testimonials, usage numbers or evaluation results exist yet. The thesis evaluation has not run. Do not fabricate any.

## Product Principles

1. Rules decide; the LLM explains. Never let presentation imply the AI made the call.
2. Honest about what wasn't checked. "Passed" and "not checked automatically" must never look the same.
3. Tell people what to do next, not just what's wrong: name the missing document, the number over budget, the stamp to get.
4. Plain language first, for someone who has never read a finance regulation.
5. Earn trust that matches actual accuracy (calibrated trust is a thesis research measure), neither overselling nor alarming.

## Accessibility & Inclusion

- Older users and users with weaker eyesight: large, high-contrast readable text and generous touch targets on phone and desktop.
- International researchers who may not read Thai: English UI support is a likely future need; layouts and type should accommodate both Thai and Latin text without breaking.
- Status must never be conveyed by color alone.
