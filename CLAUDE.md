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

Editing `firestore.rules`/`storage.rules` locally has **zero effect** on the live database/bucket until they're actually deployed — there are two ways to do that:

- **Manual (always works, no setup):** copy `firestore.rules` into Firebase Console → Firestore Database → **Rules** tab → Publish, and `storage.rules` into Console → **Storage** → Rules tab (a different page) → Publish.
- **CLI (`firebase deploy --only firestore:rules,storage:rules`):** `firebase.json` + `.firebaserc` (project `grant-receipt-assistant`) are already committed, wired to deploy exactly these two rule files. Requires Node.js + `npm install -g firebase-tools` + an interactive `firebase login` once (opens a browser against the developer's own Google account — not something an agent can do unattended) — none of that is guaranteed to be present in every dev environment for this repo (see "Running the app locally" above), so treat the manual path as the reliable fallback.

Both rule sets are **owner-scoped** locally (`request.auth.uid` must match the `userId`/`uid` path segment) now that Firebase Auth (email/password) is wired in — but check which deploy method above was actually used before assuming the live rules match what's in the repo:

- **`firestore.rules` is deployed and live** (via `firebase deploy --only firestore:rules`, 2026-09-05) — Firestore genuinely enforces owner-based access now.
- **`storage.rules` is NOT deployed** — Firebase Storage itself was never provisioned on this project (Console → Storage now requires upgrading to the Blaze billing plan first, a deliberate user decision involving a credit card, not something to do as a side effect of a rules deploy). File attachment in `new-receipt.html` is optional/demo-only anyway (see `SCOPE.md`), so this was deferred rather than blocking on it — `receipts.js` already renders a "no real file attached — demo mode" fallback when a receipt has no `fileReference`. Revisit if/when Storage is actually set up.

`ACL.md` documents the design/reasoning behind this rule set. Every collection-group `receipts` query/rule additionally relies on a denormalized `ownerUserId` field on the receipt doc itself (see below) — a query without a matching `.where("ownerUserId", "==", uid)` clause gets rejected outright, not silently filtered.

## Auth (Firebase email/password) — added 2026-09-05

- `app/login.html`/`app/js/login.js` and `app/signup.html`/`app/js/signup.js` are standalone pages (no `nav.js`/app chrome). Signup writes the new user's own `users/{uid}` doc, then redirects to `seed.html` (a fresh account owns zero projects — there's still no "create project" UI, see `BACKLOG.md` FR-23).
- `app/js/auth-guard.js` is loaded after `js/nav.js` on every other page in `app/`. It redirects to `login.html` if there's no signed-in user, injects the signed-in email + a logout control into the nav bar's `#navUser` badge, and resolves `window.AUTH_READY` with the current user — **every page script that calls Firestore must `await window.AUTH_READY` first** (see `app/js/receipts.js`, `app/js/new-receipt.js`) since `onAuthStateChanged` resolves asynchronously even for an already-signed-in session.
- `app/js/seed.js` seeds `app/js/data.js`'s template data under `firebase.auth().currentUser.uid` (safe to read synchronously there — the button can't be reached without `auth-guard.js` already having let the page through) instead of the old hardcoded `user001`. `app/js/data.js` itself is unchanged and still just template data.
- **`ownerUserId` convention**: any code that writes a `receipts` doc (`new-receipt.js`, `seed.js`) must set an `ownerUserId` field equal to the owning uid — this is what the collection-group Firestore rule checks, since a wildcard `{path=**}/receipts/{receiptId}` rule has no `{userId}` path variable to compare against. Adding a new collection-group query on another nested collection later will need the same pattern (a denormalized owner field + a matching `.where(...)` + a matching wildcard rule).

## UI/shared code conventions

- `app/js/nav.js` renders the top nav bar into every page's `<div id="nav"></div>`; the link list lives in that one file only — edit it there, not per-page. The `#navUser` badge it renders is overwritten by `app/js/auth-guard.js` once auth state resolves (see above) — don't hardcode role/user text there anymore.
- `app/css/style.css` is a hand-maintained copy of the design tokens in `docs/02-design/DESIGN.md` (colors, type scale, spacing, component classes like `.card`, `.chip-status--*`, `.receipt-card`, `.rule-callout`, `.stepper`, `.dropzone`). There's no build step linking the two — if `DESIGN.md` changes, `style.css` must be hand-updated to match, and vice versa new components should be documented in `DESIGN.md` before/when added to `style.css`.
- Firestore doc IDs are sequential (`receipt001`, `receipt002`, ...), not auto-IDs, **scoped per owner** — `app/js/new-receipt.js` scans existing IDs of the current user only (via `collectionGroup` + `.where("ownerUserId", ...)`) and increments, specifically so seeded/manually-created data stays human-readable in the Console.

## The `docs/` folder is a separate concern: an Obsidian SDLC vault

`docs/` follows a numbered-phase structure (`01-requirements/` → `02-design/` → `03-testing/` → `04-retrospectives/` → `05-log/`) cross-linked with Obsidian `[[wikilinks]]`, kept in sync by paired agents/skills in `.claude/agents/` and `.claude/skills/` (e.g. `sync-architecture`, `sync-api-db`, `sync-test-plan`, `audit-pipeline`). When asked to update architecture/API/DB/test-plan/prototype docs, prefer invoking the matching skill/agent over hand-editing those files directly, so cross-file consistency and the `docs/05-log/{date}-log.md` write-up stay consistent with how this vault has been maintained.

`docs/02-design/01-prototypes/20260816-01-v1/` is a static clickable-HTML mockup covering the *full* planned scope (7 journeys). It is not the running app — `app/` only implements the "Journey 1" slice (upload → review → verify → my receipts) that `SCOPE.md` scoped in for this week, deliberately restyled to match the prototype's design system rather than sharing its markup.

Ignore `.claude/worktrees/` — it holds stale git worktrees from earlier agent sessions, not part of the live app or docs tree. One entry there (`agent-and-agent-skill-41e4fa`) has an **uncommitted, not-yet-applied** edit to `.claude/agents/api-db-writer.md`: it adds a rule requiring that agent to stop and ask the user (with ≥3 options + tradeoffs) before making an irreversible data-modeling call it can't derive from existing docs. None of the committed `.claude/agents/*.md` files currently have this rule at all — this diff is the only place it exists. Don't delete that worktree without either applying the diff to the real file first or explicitly confirming with the user that it's no longer wanted.
