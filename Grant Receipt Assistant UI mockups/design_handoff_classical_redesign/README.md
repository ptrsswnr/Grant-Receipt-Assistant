# Handoff: Grant Receipt Assistant — Classical Redesign

## Overview
A full visual redesign of the Grant Receipt Assistant app (receipt upload/verification tool for university researchers) using the "Classical" design system — an editorial, serif, hairline-and-stroke aesthetic. Covers all 8 primary screens: home, login, signup, the 3-step receipt upload flow, my receipts, admin dashboard, fund sources (admin), and projects.

## About the Design Files
The file in this bundle (`Grant Receipt Assistant — Classical.dc.html`) is a **design reference built in HTML** — a static mockup showing intended look, layout and content states. It is not production code. The task is to **recreate this design inside the existing codebase** at `github.com/ptrsswnr/Grant-Receipt-Assistant` — plain HTML/CSS/vanilla JS + Firebase (Auth/Firestore/Storage), no framework/build step — by:
- Updating `app/css/style.css` tokens (currently Raleway/DM Sans/stone-sage) to the Classical tokens below.
- Updating each `app/*.html` page's markup/classes to match the new layout and component structure shown in the mockup.
- Keeping all existing JS behavior in `app/js/*.js` (auth guard, Firestore reads/writes, mock rule engine, form validation) untouched — this is a styling/layout pass, not a logic change.

## Fidelity
**High-fidelity.** Exact colors, typography, spacing and component structure are specified below and in the mockup file — recreate pixel-close using plain CSS (no CSS framework needed; port the token values directly into `style.css`).

## Design Tokens

Colors:
- `--color-bg: #f3f2f2` (page background, replaces `--color-surface-base`)
- `--color-surface: #eae9e9`
- `--color-text: #201f1d` (replaces `--color-content-primary`)
- `--color-accent: #b68235` (single accent — replaces `--color-stone` as the interactive/heading accent; used as a stroke color, not a fill)
- `--color-divider: color-mix(in srgb, #201f1d 16%, transparent)` (all borders/hairlines)
- Neutral ramp 100–900: `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`
- Accent ramp 100–900: `#fff3e4 #ffe3bf #facb8d #e1ad66 #c28d41 #a06f24 #7d5411 #5a3b0a #3a270d`
- Status colors (new — not in the base Classical system, added to match its OKLCH/muted character since Classical is single-accent):
  - Success (ผ่าน): `oklch(58% 0.10 148)` / bg `oklch(94% 0.02 148)` / text `oklch(33% 0.07 148)`
  - Error (ไม่เข้าเงื่อนไข): `oklch(56% 0.15 25)` / bg `oklch(94% 0.02 25)` / text `oklch(35% 0.11 25)`
  - Warning (ต้องแก้ไข): reuses the accent ramp — bg `--color-accent-100`, text `--color-accent-800`
  - Pending (รอตรวจสอบ): neutral ramp — bg `--color-neutral-200`, text `--color-neutral-700`

Typography:
- Headings: Cormorant Garamond, weight 600 (semibold ceiling — never bolder), letter-spacing -0.015em. h1 42px, h2 32px, h3 25px, h4 20px.
- Body: Lora, 400/600, 15px base, line-height 1.55.
- Numbers (amounts, stat tiles, table figures): use **Lora with `font-variant-numeric: tabular-nums`**, NOT the heading font — Cormorant Garamond's numerals are old-style/lowercase-figure and read informally at display sizes, which is wrong for financial figures. This was corrected during review (see Admin Dashboard stat tiles).

Spacing scale (1.15× density): 4.6 / 9.2 / 13.8 / 18.4 / 27.6 / 36.8px.
Radius: sm 2px, md 4px, lg 7px.
Shadows: sm/md/lg per Classical tokens — used sparingly (whisper-level elevation only), never on flat page backgrounds.

## Components (see mockup file for exact markup/inline styles per instance)

- **Nav bar**: brand left, text links, one outlined button right (login/logout). Active link = accent color text, no underline.
- **Buttons**: outlined only — accent border + accent text on transparent for primary; divider-color border for secondary; no-border text-only for ghost. Never solid-filled.
- **Cards**: 1px divider border, transparent background, 4px radius, no shadow (unless "elevated" like the rule-explanation callout, which gets `--shadow-sm`).
- **Status tags**: pill, 11px text, 3px/10px padding, tinted background per status colors above.
- **Stepper** (upload flow): 3 circular nodes connected conceptually by position; done = filled accent circle + check; current = white bg + 2px accent border; upcoming = divider-color 1.5px border, neutral text.
- **Rule Explanation Callout**: bordered card, 4px accent/success/error/warning left border, `--color-neutral-100` background, `--shadow-sm`. Always has two parts: plain-language explanation (body text) + a reference/citation line below a hairline divider, in tertiary neutral text with a small document icon.
- **Receipt card row**: horizontal flex — icon thumbnail box (file-text icon) → amount (tabular Lora) + metadata line → status tag, right-aligned.
- **Stat tile**: bordered card, large tabular-Lora number, small label beneath, color-coded by status where relevant.
- **Bar chart rows** (admin breakdown): label, track (neutral-200 bg), fill (status color), value — plain flex/div, no charting library, matches existing app's "no charting library" architecture note in `app/css/style.css`.
- **Table**: 1px divider row/header rules, uppercase 11px tracked header, right-align numeric columns.
- **Icons**: Lucide-style line icons (stroke=currentColor, ~1.6–2px stroke width), used for: file/receipt, upload-cloud, users, folder, plus, arrow/chevron. See inline `<svg>` markup in the mockup for exact paths.

## Screens / Views

1. **หน้าแรก (Home)** — `app/index.html`. Hero (h1 + justified intro paragraph + 2 CTA buttons), 3-card "ขั้นตอนการใช้งาน" step explainer, status-legend card with 4 tags (pass/fix/reject/pending).
2. **เข้าสู่ระบบ (Login)** — `app/login.html`. Centered ~380px column, icon + h1 + subhead, bordered card with email/password fields + primary button + signup link.
3. **สมัครสมาชิก (Signup)** — `app/signup.html`. Same shell as login; adds full name, password confirm, min-length helper text.
4. **อัปโหลดใบเสร็จ (Upload, 3 steps)** — `app/new-receipt.html` + `app/js/new-receipt.js`. Step 1: project select + dropzone (dashed divider-color border, upload-cloud icon) + submit. Step 2: file thumbnail + pending tag, amount (tabular numerals)/date/category/vendor fields, back/submit buttons. Step 3: receipt-summary row + Rule Explanation Callout colored by result status, with "upload again" / "go to my receipts" actions. Mockup shows the "ต้องแก้ไข" (needs-fix) outcome as the example, using the app's real `checkAgainstRules()` message format.
5. **ใบเสร็จของฉัน (My receipts)** — `app/receipts.html`. Vertical list of receipt-card rows, one per status (pass/fix/reject/pending) to demonstrate all four.
6. **Admin Dashboard** — `app/admin-dashboard.html` + `app/js/admin-dashboard.js`. 2 rows of 3 stat tiles, a status breakdown bar chart, and the full receipts admin table (columns trimmed to fit the mockup width — production table keeps all existing columns from `admin-dashboard.html`: also แหล่งทุน, ผู้ขาย, ไฟล์แนบ, คำอธิบาย).
7. **จัดการแหล่งทุน (Fund sources, admin)** — `app/fund-sources.html`. "Add fund source" bordered card (name + code fields, submit), list of existing fund sources (name + mono/tabular code).
8. **โครงการของฉัน (Projects)** — `app/projects.html`. "Add project" card (name + fund-source select, submit), list of existing projects with fund source + code subtext and a chevron affordance.

## Interactions & Behavior
No new interactions — behavior is unchanged from the existing app (see `app/js/*.js`): step navigation in the upload flow, Firestore reads/writes, `auth-guard.js` redirect-if-signed-out, admin role check gating the dashboard/fund-sources pages. Only hover/focus states are newly specified:
- Buttons: hover tints from the accent/divider ramp (12% accent tint for primary, 7% text tint for secondary), no color-shift on ghost besides a soft accent tint.
- Inputs: `:focus-visible` border becomes `--color-accent` (2px keyboard-focus ring elsewhere per Classical spec).
- Links: default `--color-accent`, hover `--color-accent-700`.

## State Management
No changes — the mockup is presented in fixed example states per screen (one static outcome per upload-flow step, a representative set of 4 receipt statuses in the list). Wire up to the existing Firestore-backed state in `app/js/data.js`, `new-receipt.js`, `receipts.js`, `admin-dashboard.js`, `fund-sources.js`, `projects.js` unchanged.

## Assets
No external image assets. All icons are inline hand-built Lucide-style SVGs (see markup). No photography used (Classical's `.plate` image treatment does not apply here — this app has no product photography).

## Files
- `Grant Receipt Assistant — Classical.dc.html` — the full mockup, all 8 screens, in this folder.
