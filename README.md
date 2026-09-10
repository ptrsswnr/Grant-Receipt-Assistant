# Grant Receipt Assistant

🌐 **Live app:** https://grant-receipt-assistant.web.app

Grant Receipt Assistant is a web app that helps university researchers upload
grant-expense receipts and see an instant pass/needs-fix/rejected verdict —
with a plain-language explanation — before submitting them to the finance
office. Admins manage each fund source's receipt rules and can view an
aggregate/detail dashboard of every researcher's receipts for reporting.

## Tech stack

Plain HTML/CSS/vanilla JavaScript (no framework, no build step) + Firebase
(Authentication, Firestore, Hosting).

## Key docs

- [`CLAUDE.md`](CLAUDE.md) — full technical reference: Firestore data model
  (every collection path), all receipt status values, auth/admin conventions,
  deploy process.
- [`ACL.md`](ACL.md) — access control: who can read/write what, by role.
- [`SCOPE.md`](SCOPE.md) / [`BACKLOG.md`](BACKLOG.md) — what's in scope this
  week vs. deferred, and what's mocked (no real OCR/LLM yet) vs. real.
- [`docs/`](docs/) — requirements, design, and test-plan notes (an Obsidian
  vault); `docs/unauthorized-access-denied.png` is evidence that Firestore
  Security Rules reject unauthenticated reads/writes.

## Running locally

No Node/Python dev-server dependency — see `scripts/static-server.ps1` and
the "Running the app locally" section of `CLAUDE.md`.
