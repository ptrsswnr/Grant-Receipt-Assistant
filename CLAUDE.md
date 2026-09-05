# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Grant Receipt Assistant** — a plain HTML/CSS/JS web app (no framework, no bundler, no build step) backed by Firebase (Firestore + Storage). It helps a researcher upload grant-expense receipts and see a pass/needs-fix/rejected verdict before submitting to the finance office.

This is a homework project (`SCOPE.md` literally calls it "Week 6 homework"). Real OCR, the Rule Engine, and the LLM explanation are **not implemented** — they're faked:
- `app/js/data.js`'s `window.mockRuleEngine()` fakes the pass/fix/reject decision.
- `app/new-receipt.html`'s step 2 ("ตรวจสอบข้อมูล") randomly fills in amount/date/category/vendor and pretends AI/OCR read them from an attached file.

Read `SCOPE.md` and `BACKLOG.md` before assuming a feature is real vs. mocked/deferred — they're the authoritative list of what's actually built this week vs. intentionally cut to a later sprint. Don't trust older doc prose in `docs/` about "what this system is" without checking these two files and the dated spec files in `docs/01-requirements/01-spec/` first (there can be more than one spec file; list the directory rather than assuming a filename).

## Running the app locally

There's no dev server config committed for Node or Python — **check what's actually installed before assuming `npm`/`node`/`python` work** (in at least one dev environment for this repo none of them were present, only PowerShell). Fallback used previously: `scripts/static-server.ps1`, a dependency-free static file server:

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/static-server.ps1 -Port 4173
```
Then open `http://localhost:4173/index.html`. Opening `app/*.html` directly via `file://` also works for viewing, but the Firestore/Storage SDK is loaded as classic `<script>` tags (compat build) specifically so it *can* run over `file://` — don't switch these to ES module imports.

Seeding sample data into Firestore is done exclusively from the browser: `app/seed.html`'s button, backed by `app/js/data.js` (the data) + `app/js/seed.js` (the writer). There used to be a Node-based alternative (`package.json` + `scripts/seed-firestore.mjs`) but it was removed — it wrote the old flat top-level structure and had drifted out of sync with the nested structure below; keeping two parallel sources of seed data/structure was more of a liability than a convenience given Node isn't reliably available in this repo's dev environments anyway.

No lint/test/build commands exist in this repo.

## Firestore data model — nested by ownership

Collections are nested to mirror the ownership cardinalities in `docs/02-design/02-technical/db-spec.md`'s ER model (not a flat/FK style):

```
users/{userId}/projects/{projectId}/receipts/{receiptId}/files/{fileId}
fundSources/{fundSourceId}/ruleVersions/{ruleVersionId}/ruleItems/{ruleItemId}
```

`Project.fundSourceId` stays a plain reference field (not a path segment) — one fund source funds many projects owned by different users, so it isn't an ownership relationship. `db-spec.md` deliberately stays engine-agnostic (no Firestore paths in it) because `docs/02-design/02-technical/technology-stack.md` was never formally decided; the physical nesting above is an implementation detail layered on top, not something to add back into `db-spec.md`.

Practical consequences of this nesting, all handled in `app/js/receipts.js` and `app/js/new-receipt.js`:
- Listing "all my receipts across every project" requires `db.collectionGroup("receipts")`, not `db.collection("receipts")`.
- `collectionGroup(...).orderBy(...)` needs a Firestore index created once via the Firebase Console (the error Firestore throws includes a direct link — that link only appears at runtime, in the browser, the first time the exact query executes).
- The owning project for a receipt fetched via a collection-group query is `doc.ref.parent.parent` (parent of the `receipts` collection), which is `null` for a legacy top-level receipt doc — code must handle that.

### Known Firestore Security Rules gotcha (already hit twice — don't reintroduce it)

A `match` block **nested inside** a recursive-wildcard block does not reliably grant access to that nested subcollection, even though the path is exactly what you'd expect:

```
// This does NOT work for reading receipts/{id}/files — tested against the live project:
match /{path=**}/receipts/{receiptId} {
  allow read, write: if true;
  match /files/{fileId} { allow read, write: if true; }  // <- denied at runtime
}
```

The fix (already applied in `firestore.rules`) is to declare the full concrete path separately from the wildcard rule:

```
match /users/{userId}/projects/{projectId} {
  match /receipts/{receiptId} {
    allow read, write: if true;
    match /files/{fileId} { allow read, write: if true; }
  }
}
// separate rule, needed only for the collectionGroup("receipts") query itself:
match /{path=**}/receipts/{receiptId} {
  allow read, write: if true;
}
```

## Deploying rules — two separate Console pages, and edits do nothing until Published

- `firestore.rules` → Firebase Console → Firestore Database → **Rules** tab.
- `storage.rules` → Firebase Console → **Storage** → Rules tab (a different page).

Editing either file locally has **zero effect** on the live database/bucket until someone manually copies the file's content into the corresponding Console editor and clicks **Publish**. There is no `firebase.json`/`.firebaserc`/Firebase CLI wired up in this repo, so this manual copy-paste is currently the only deploy path. Both rule sets intentionally allow open read/write (`if true`) for now — there's no real auth yet (see the "เมื่อมี Auth จริงแล้ว" block at the bottom of `firestore.rules` for the owner-scoped version to switch to once auth exists).

## UI/shared code conventions

- `app/js/nav.js` renders the top nav bar into every page's `<div id="nav"></div>`; the link list lives in that one file only — edit it there, not per-page.
- `app/css/style.css` is a hand-maintained copy of the design tokens in `docs/02-design/DESIGN.md` (colors, type scale, spacing, component classes like `.card`, `.chip-status--*`, `.receipt-card`, `.rule-callout`, `.stepper`, `.dropzone`). There's no build step linking the two — if `DESIGN.md` changes, `style.css` must be hand-updated to match, and vice versa new components should be documented in `DESIGN.md` before/when added to `style.css`.
- Firestore doc IDs are sequential (`receipt001`, `receipt002`, ...), not auto-IDs — `app/js/new-receipt.js` scans existing IDs (via `collectionGroup`) and increments, specifically so seeded/manually-created data stays human-readable in the Console.

## The `docs/` folder is a separate concern: an Obsidian SDLC vault

`docs/` follows a numbered-phase structure (`01-requirements/` → `02-design/` → `03-testing/` → `04-retrospectives/` → `05-log/`) cross-linked with Obsidian `[[wikilinks]]`, kept in sync by paired agents/skills in `.claude/agents/` and `.claude/skills/` (e.g. `sync-architecture`, `sync-api-db`, `sync-test-plan`, `audit-pipeline`). When asked to update architecture/API/DB/test-plan/prototype docs, prefer invoking the matching skill/agent over hand-editing those files directly, so cross-file consistency and the `docs/05-log/{date}-log.md` write-up stay consistent with how this vault has been maintained.

`docs/02-design/01-prototypes/20260816-01-v1/` is a static clickable-HTML mockup covering the *full* planned scope (7 journeys). It is not the running app — `app/` only implements the "Journey 1" slice (upload → review → verify → my receipts) that `SCOPE.md` scoped in for this week, deliberately restyled to match the prototype's design system rather than sharing its markup.

Ignore `.claude/worktrees/` — it holds stale git worktrees from earlier agent sessions, not part of the live app or docs tree. One entry there (`agent-and-agent-skill-41e4fa`) has an **uncommitted, not-yet-applied** edit to `.claude/agents/api-db-writer.md`: it adds a rule requiring that agent to stop and ask the user (with ≥3 options + tradeoffs) before making an irreversible data-modeling call it can't derive from existing docs. None of the committed `.claude/agents/*.md` files currently have this rule at all — this diff is the only place it exists. Don't delete that worktree without either applying the diff to the real file first or explicitly confirming with the user that it's no longer wanted.
