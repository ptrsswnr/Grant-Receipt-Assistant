---
version: 1
slug: "app-new-receipt-html"
primary_target: "app/new-receipt.html"
related_targets: ["app/css/style.css","app/js/nav.js","app/index.html","app/receipts.html","app/projects.html","app/budget.html"]
---

## Scope

Whole web app (all pages share app/css/style.css and the nav rendered by app/js/nav.js). Mode: Operate. Researchers and grant admins completing receipt checks on phone and desktop equally; older readers and future English UI must be served.

## Direction contract

THESIS: A calm working app with a committed indigo shell, refusing both the old editorial-serif look and the grey-screen-with-one-accent default. The verdict is the hero of every check.

OWN-WORLD: Deep indigo side rail (white text, white active pill with indigo label), cool lavender-grey ground, white 14px-radius cards with soft indigo-tinted offset shadows, solid indigo primary buttons, pill status chips in full status colours with a leading dot. Anuphan (Thai+Latin) at a 16px base.

STORY: The researcher sees where they are, uploads, confirms fields and attachments, and reads a verdict that says plainly what to do next.

FIRST VIEWPORT: Desktop: 256px indigo rail left (brand, icon nav, account at the foot); content column up to 1080px on the right with page title, short intro, then the task card. Mobile: indigo top bar with brand and account, horizontally scrolling nav pills beneath, content full width.

FORM: User-pinned from three reference images (modern productivity SaaS dashboards with side rail, white cards, one saturated shell colour); concept-seed not run because the user pinned the direction. Signature move: the step-3 verdict chip rendered as an inked rubber stamp (ตรายาง) in its status colour, echoing the "จ่ายแล้ว"/"ตรวจรับพัสดุ" stamps finance requires.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
