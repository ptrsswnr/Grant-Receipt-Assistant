---
name: Grant Receipt Assistant
description: An airy working app with a user-chosen accent and a night mode, which tells a grant researcher, before finance does, whether a receipt will pass and what to do next.
colors:
  ground-sky-grey: "oklch(97.4% 0.01 235)"
  surface-sunken: "oklch(97.8% 0.008 235)"
  raised-white: "#ffffff"
  row-hover: "oklch(98.5% 0.006 240)"
  ink-navy: "oklch(29% 0.055 258)"
  ink-secondary: "oklch(45% 0.04 255)"
  ink-tertiary: "oklch(52% 0.03 250)"
  divider: "oklch(92.5% 0.014 240)"
  divider-strong: "oklch(86% 0.02 240)"
  accent: "oklch(53% 0.13 238)"
  accent-hover: "oklch(47% 0.13 238)"
  accent-deep: "oklch(42% 0.13 238)"
  accent-soft: "oklch(95.5% 0.0312 238)"
  accent-ring: "oklch(82% 0.0806 238)"
  accent-mist: "oklch(96.5% 0.0221 238)"
  accent-wash: "oklch(92% 0.0494 238)"
  accent-ink: "oklch(46% 0.1196 238)"
  accent-ink-deep: "oklch(38% 0.1001 238)"
  on-accent: "#ffffff"
  pane-top: "oklch(51% 0.1248 224)"
  pane-deep: "oklch(43% 0.1196 244)"
  status-pass-bg: "oklch(95% 0.045 155)"
  status-pass-ink: "oklch(37% 0.1 155)"
  status-pass-dot: "oklch(62% 0.15 155)"
  status-pass-edge: "oklch(88% 0.07 155)"
  status-fix-bg: "oklch(96.5% 0.07 100)"
  status-fix-ink: "oklch(42% 0.09 90)"
  status-fix-dot: "oklch(82% 0.16 95)"
  status-fix-edge: "oklch(88% 0.1 98)"
  status-approval-bg: "oklch(94.5% 0.06 55)"
  status-approval-ink: "oklch(45% 0.14 48)"
  status-approval-dot: "oklch(68% 0.18 50)"
  status-approval-edge: "oklch(86% 0.09 55)"
  status-reject-bg: "oklch(95% 0.035 10)"
  status-reject-ink: "oklch(45% 0.17 12)"
  status-reject-dot: "oklch(60% 0.2 12)"
  status-reject-edge: "oklch(88% 0.06 12)"
  status-pending-bg: "oklch(94% 0.012 240)"
  status-pending-ink: "oklch(44% 0.035 240)"
  status-pending-dot: "oklch(66% 0.03 240)"
typography:
  display:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "17.5px"
    fontWeight: 600
    lineHeight: 1.45
  figure:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    fontFeature: "tnum"
  body:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Anuphan, 'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  sp-5: "20px"
  space-6: "24px"
  sp-7: "28px"
  space-8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.raised-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.accent-mist}"
    textColor: "{colors.accent-ink-deep}"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-destructive:
    backgroundColor: "{colors.status-reject-bg}"
    textColor: "{colors.status-reject-ink}"
    rounded: "{rounded.md}"
  button-destructive-hover:
    backgroundColor: "{colors.status-reject-ink}"
    textColor: "{colors.raised-white}"
  button-on-pane:
    backgroundColor: "{colors.raised-white}"
    textColor: "{colors.accent-deep}"
    padding: "7px 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "46px"
  card:
    backgroundColor: "{colors.raised-white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip-status-pass:
    backgroundColor: "{colors.status-pass-bg}"
    textColor: "{colors.status-pass-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 14px 5px 11px"
  chip-status-fix:
    backgroundColor: "{colors.status-fix-bg}"
    textColor: "{colors.status-fix-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 14px 5px 11px"
  chip-status-approval:
    backgroundColor: "{colors.status-approval-bg}"
    textColor: "{colors.status-approval-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 14px 5px 11px"
  chip-status-reject:
    backgroundColor: "{colors.status-reject-bg}"
    textColor: "{colors.status-reject-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 14px 5px 11px"
  chip-status-pending:
    backgroundColor: "{colors.status-pending-bg}"
    textColor: "{colors.status-pending-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 14px 5px 11px"
  nav-rail:
    backgroundColor: "{colors.raised-white}"
    textColor: "{colors.ink-secondary}"
    width: "256px"
  nav-link-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    height: "46px"
  theme-picker-toggle:
    backgroundColor: "{colors.raised-white}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    height: "44px"
  receipt-pane:
    backgroundColor: "{colors.pane-deep}"
    textColor: "{colors.raised-white}"
    rounded: "{rounded.lg}"
    padding: "20px 14px 14px"
---

# Design System: Grant Receipt Assistant

The source of truth is:
- `app/css/style.css`: all tokens are in `:root`, followed by the `html[data-accent]` presets and the `:root[data-theme="dark"]` block.
- `app/js/theme.js`: mode and accent preferences.
- `app/js/nav.js` and `app/js/auth-guard.js`: the shell and the theme picker.
- `app/js/receipts.js`: the list/detail markup.

This file records the "Open Sky" build shipped on 2026-11-15, now with a selectable accent and night mode. It replaces the short-lived indigo-shell version from the same day, the 2026-09-10 "Classical" serif look and the original ZenGrid look. None of those is authority any more.

The frontmatter records the **default resolved values**: light mode with the sky accent (`--accent-h: 238`, `--accent-c: 0.13`). The accent and night-mode values are documented below and in `.impeccable/design.json`.

## Overview

**Creative North Star: "Open Sky, Inked Verdict"**

An airy, light working app. The frame is white, the ground is a pale grey, and the ink is a deep navy. Work sits on white rounded cards, and one accent colour marks the primary action, the current place and the current step. The only saturated block of colour is a single accent gradient. On wide screens it fills the list pane of `receipts.html`; elsewhere it is reduced to the brand-mark circle. The step-3 verdict stays the loudest moment of a check: the result is pressed onto the page like the rubber stamps finance puts on paper documents (ตรายาง "จ่ายแล้ว", "ตรวจรับพัสดุ").

The person decides the mood, and the system guarantees the rest. There are six accents (sky by default, plus lavender, indigo, teal, plum and graphite) and three modes (light by default, dark, or follow the system). Every combination keeps the same structure, the same status colours and the same contrast floors, because the lightness of each accent step is fixed and only the hue and chroma change.

Density is relaxed and type is large because the readers include older researchers and people with weaker eyesight, on phones as often as on desktops. One family, Anuphan, sets both Thai and Latin. Status is always carried by a word and a drawn glyph as well as colour.

The system rejects a heavy, saturated shell (the indigo rail it replaced felt dense, "ทึบ") in favour of a light, open one ("โปร่ง"). It also rejects the editorial-serif look that came before.

**Key Characteristics:**
- White side rail with a hairline divider on desktop. On phones, a white top bar and a white fixed bottom tab bar. All of these turn dark slate in night mode.
- A pale grey ground, cards with soft shadows and deep navy ink. Night mode uses slate surfaces and light ink.
- One accent, chosen by the user from six, computed from a single hue and chroma pair.
- One saturated colour field: the accent-gradient list pane (and the brand-mark circle).
- Five receipt statuses, each with its own soft fill, ink, dot, edge and drawn glyph, identical in every accent.
- A rotated, double-ruled stamp for the step-3 verdict, used nowhere else.
- Anuphan for everything, figures in tabular numerals.

## Colors

A pale, cool neutral family (hue 235 to 258, ink in deep navy) with one accent derived from `--accent-h` and `--accent-c`, and five status hues that appear only where a receipt's status is being stated.

### Primary (the accent family)
All accent tokens are computed from `--accent-h` and `--accent-c`, with a fixed lightness per step. Changing the accent swaps only those two numbers.
- **Accent** (accent): primary buttons, links, the active nav icon, the theme-picker icon, the dropzone icon, the done and current stepper dots, input focus borders, the checkbox accent, neutral bar and usage fills. Hover deepens to accent-hover.
- **Accent Deep** (accent-deep, 42% L): dark accent text that sits on white in both themes, such as the label of the white button on the pane.
- **On-Accent** (on-accent): text on any solid accent fill. It is white in light mode and a near-black accent tint in night mode.
- **Accent Soft, Mist and Wash** (accent-soft, accent-mist, accent-wash): the active nav pill and the checked theme mode (accent-soft); receipt thumbnails, the dropzone, info banners and secondary-button hover (accent-mist and soft); the 4px focus halo (accent-wash). Accent Ring (accent-ring) is the global 3px `:focus-visible` outline.
- **Accent Ink** (accent-ink, accent-ink-deep): the label of the active nav item and the checked theme mode; secondary and ghost hover text.
- **Pane** (`--color-pane`, a 165deg gradient from pane-top at hue −14 to pane-deep at hue +6): the one committed colour field, used only for the receipts list pane and the brand mark. In light mode it runs from 51% to 43% L, deep enough that white text passes at every point.
- **The `--color-accent-100`…`900` ramp** is built from the same pair. It is pale to dark in light mode and inverted (dark to pale) in night mode, so `-100` always means "the quietest tint against the current surface".

### Accent presets
`html[data-accent]` overrides only the hue and chroma pair: **sky** is the default (238 / 0.13), **lavender** 295 / 0.14, **indigo** 268 / 0.15, **teal** 195 / 0.1, **plum** 330 / 0.14, **graphite** 255 / 0.035. In the picker each swatch is labelled with its colour name only: ฟ้า, ลาเวนเดอร์, คราม, เขียวอมฟ้า, พลัม, กราไฟต์.

### Neutral
- **Grey Ground** (ground-sky-grey): the page background.
- **Sunken Surface** (surface-sunken): input fills, table heads, nav hover, the unchecked theme-mode tiles, neutral callouts and banners.
- **Raised White** (raised-white): cards, receipt entries, stat tiles, secondary buttons, the theme-picker toggle and panel, and the whole shell. Row Hover (row-hover) highlights table rows.
- **Navy Ink, Secondary Ink, Tertiary Ink** (ink-navy, ink-secondary, ink-tertiary): text. Secondary ink is also the rail text, and tertiary ink colours inactive nav icons. Both lighter inks are at least 4.5:1 on white.
- **Divider, Strong Divider** (divider, divider-strong): hairlines, the shell's edges, the rule above the account block, and the input, secondary-button and picker strokes.

### Status
Each status has four tokens: a soft **bg**, a readable **ink**, a saturated **dot** used only for non-text marks (bar and usage fills), and an **edge** for the 1px border of its tinted panels. Statuses never change with the accent.
- **ผ่าน (pass)**: green, hue 155. Glyph: check in a circle.
- **ต้องแก้ไข (fix)**: yellow, hue 90 to 100. Glyph: pencil.
- **ต้องชี้แจง/ขออนุมัติ (approval)**: orange, hue 48 to 55. Glyph: question mark in a circle. It also marks over-budget lines in the budget table.
- **ไม่เข้าเงื่อนไข (reject)**: rose-red, hue 10 to 15. Glyph: cross in a circle. It is also used for the destructive button and error banners.
- **รอตรวจสอบ (pending)**: neutral grey. Glyph: clock. It is transient only, never a stored status, and is the fallback for any unrecognised status string.

### Night mode
`:root[data-theme="dark"]` sets `color-scheme: dark` and replaces the token values without renaming any token:
- **Surfaces:** slate around hue 255. The page ground is 19% L, sunken fills sit lower at 16.5%, and cards rise to 23.5%. The shell is 21.5%.
- **Text:** ink at 95%, 82% and 73% L.
- **Accent:** flips to a light tint (73% L, hover 79%) so links and icons stay readable on dark. Solid accent fills therefore carry dark On-Accent text (17% L). The ramp is inverted. The pane is slightly deeper (50% to 40% L) and keeps its white text.
- **Statuses:** become dark fills (about 30% L) with light inks (84 to 89% L) and stronger edges.
- **Shadows:** become black-based.

### Named Rules
**The Never-Colour-Alone Rule.** Every status shows its Thai word and its own drawn glyph (check, pencil, question, cross, clock) as well as its colour. This applies to chips (including chips on the pane), callouts, stat values and banners. A new status needs all four tokens (bg, ink, dot, edge), a glyph and a word.

**The Status-Distance Rule.** Accent hues stay at least 35° away from every status hue (pass 155, fix about 95, approval about 50, reject about 12), so an accent can never be read as a verdict. That is why there is no green, yellow, orange or red accent. The user's first request (orange, pink, green) was replaced for this reason, with the user's agreement. A new accent preset must clear the same distance.

**The Fixed-Lightness Rule.** An accent preset may change only `--accent-h` and `--accent-c`. Lightness per step is fixed in both themes, so the contrast checks done once hold for every accent. Don't give a preset its own lightness values.

**The One Colour Field Rule.** The shell is white (slate at night). The only saturated area in the system is the Pane gradient (`--color-pane`), and it appears in two places only: the receipts list pane and the brand-mark circle. Elsewhere the accent is limited to controls, the current place and focus. Don't paint the rail, page headers or content cards with the gradient. Any new pane must be a list or navigation surface that earns it.

**The White-on-Pane Legibility Rule.** All text on the pane is white and must reach at least 4.5:1 against the colour it actually sits on, in every accent and both themes, including overlays. Overlays on the pane therefore darken (black at 8 to 16%) and never lighten. If a change drops below the floor, darken the gradient. Don't make the text smaller or thinner.

**The Contract-Name Rule.** Every token name and class name in `style.css` is a contract with JS-generated markup and inline styles in `app/*.html` and `app/js/*.js`. Change values, never names. Themes and accents work by reassigning values to the same names.

Older names are kept as aliases at the bottom of `:root`: `--color-stone`, `--color-sage`, `--color-warm-white`, `--color-surface-base/-sunken/-raised`, `--color-content-primary/-secondary/-tertiary`, `--color-border-default/-strong/-focus`, `--color-stone-hover/-active`, `--color-tooltip-bg`, the `--sp-1`…`--sp-8` spacing scale, and `--color-success/-error/-warning/-pending-*`. The `--color-accent-*` names (once indigo, then sky) and the `--color-rail*` names (now the white or slate shell) hold computed values.

Alias, don't rename.

## Typography

**Display Font:** Anuphan (with Noto Sans Thai, then system-ui)
**Body Font:** Anuphan (same stack)
**Label/Mono Font:** none distinct. `--font-mono` equals the body face, and figures align with `font-variant-numeric: tabular-nums`.

**Character:** A single friendly geometric sans that sets Thai and Latin with the same weight and rhythm. It is loaded from Google Fonts by an `@import` at the top of `style.css` at weights 400, 500, 600 and 700.

### Hierarchy
- **Display** (700, 32px, 1.3, -0.01em; 27px below 960px): page titles (h1).
- **Headline** (600, 21px, 1.4; 19.5px below 960px): section and card titles (h2). The pane heading uses 17.5px.
- **Title** (600, 17.5px, 1.45): item titles inside a section (h3). h4 is 600 at 16px.
- **Figure** (700, 22px, tabular): receipt amounts. Amounts in pane rows are 19px, the pane's passed/total figure is 24px, and stat-tile values are 34px, all tabular.
- **Body** (400, 16px, 1.65): all running text. Long prose (`.text-body`) is capped at 68ch. Verdict explanations run 15.5px at 1.75 line height, capped at 75ch.
- **Small** (400, 15px, 1.6): meta lines, banners, nav links, chips, pane row meta, the picker toggle.
- **Label** (500, 14px, 1.5): the smallest UI text: captions, the account badge, stepper labels, citations, bar labels, dates, mobile tab labels, picker labels and mode names.

### Named Rules
**The 14px Floor Rule.** Body copy is 16px, and no UI text goes below 14px. Inputs use 16px text (which also stops iOS from zooming on focus). This was adopted after review for older and low-vision readers.

**The Tabular Figures Rule.** Every amount, percentage, count and date uses tabular numerals so columns of baht figures line up. No separate monospace face.

## Layout

- **Shell.** At 960px and wider there is a fixed 256px rail on the left with a 1px right divider. From top to bottom it holds:
  - the brand: a 40px gradient circle plus "Grant Receipt / Assistant" on two lines;
  - the icon nav;
  - the theme-picker toggle ("ธีมและสี", whose panel opens upward);
  - the account (email and sign-out), separated from the items above by a divider.

  The body is padded left by the rail width. Content sits in a column up to 1080px wide, with 40px side padding, 40px top padding and 72px bottom padding.
- **Phones (below 960px).** The brand and account become a top bar with a bottom divider that scrolls away with the page.
  - **Top bar:** the brand shows only "Grant Receipt" (the `.brand-tail` "Assistant" is hidden). The email (`.nav-email`) is hidden, so the bar holds the brand, a 44px icon-only theme button and the sign-out link. The picker panel hangs from the bottom of the top bar, right-aligned.
  - **Bottom tab bar:** fixed, with a top divider and a faint upward shadow. Four equal tabs, each an icon above a short one-line label (หน้าแรก / โครงการ / ใบเสร็จ / อัปโหลด). At least 58px tall and safe-area aware.
  - **Spacing:** the body gets about 76px of bottom padding so the tab bar never covers content. Page padding drops to 24px top and 16px at the sides.
- **List/detail (receipts.html, 960px and wider).** A two-column grid: the list pane (280 to 340px) and the detail column (the rest), 24px apart. The pane is sticky 24px from the top, never taller than the viewport, and scrolls internally. The detail column shows only the selected receipt entry. Below 960px the pane is hidden and every receipt entry stacks as a full-width card.
- **Grids.** `grid-2` and `grid-3` collapse to one column below 720px. `grid-4` drops to two columns below 1100px.
- **Below 600px.**
  - Right-aligned action rows (`.row` with `justify-content:flex-end`) stack full width in reverse order, so the primary action (last in the markup) sits on top.
  - The budget table turns into stacked cards: one bordered card per line, with each value shown as a label/value pair, and over-budget lines tinted approval orange.
- **Rhythm.** A 4px-based scale (4, 8, 12, 16, 20, 24, 28, 32). Cards pad 24px (20px by 16px below 720px), fields sit 20px apart, and sections 24px apart, with 32px between consecutive sections.

## Elevation & Depth

Light layering: cards float on the ground with very soft shadows that fall downwards. Cards have no borders. The shell is flat and separated by hairlines rather than shadow. Depth goes up only in response to interaction, on the one colour field, and on the floating picker panel. In light mode shadows are tinted blue (hue 245). In night mode they are black-based and stronger, and cards read as raised because they are lighter than the ground.

### Shadow Vocabulary
- **Resting low** (`--shadow-sm`): small resting elements.
- **Card** (`--shadow-md`): cards, receipt entries, stat tiles.
- **Lifted** (`--shadow-lg`): link cards on hover (with a 2px rise) and the theme-picker panel.
- **Accent glow** (`--shadow-accent`, tinted by the accent hue): solid primary buttons.
- **Pane glow** (`0 18px 36px -22px` in the accent hue at 60%): under the receipts list pane. The brand mark has a small equivalent.

The light and dark values are listed in `.impeccable/design.json`.

### Named Rules
**The Soft Shadow Rule.** Shadows are diffuse and fall downwards: blue-tinted in light mode, black-based in night mode. Never use hard offset shadows. The shell uses hairline dividers, not shadows (except the phone tab bar's faint upward edge).

**The Tinted-Panel Rule.** Explanation callouts and banners are tinted panels with a 1px status-edge border and a leading glyph. They never use a thick coloured side stripe.

## Shapes

Corners are gently rounded throughout:
- **8px:** table-head corners.
- **10px:** small buttons.
- **12px:** buttons, inputs, nav items, the picker toggle and mode tiles, pane rows, callouts and banners.
- **18px:** cards, receipt entries, stat tiles, the dropzone, the list pane and the picker panel.
- **Pills:** chips, and the bar, usage and progress tracks.
- **Circles:** stepper dots, the brand mark and the accent swatches.

Receipt thumbnails are 52px squares with 16px corners.

Icons are Lucide-style line icons drawn inline as SVG at a 1.8 stroke (20 to 22px in the nav). They include the palette, sun, moon and monitor icons in the picker and the plus on the pane button. Status glyphs are CSS masks at a 2.2 stroke.

## Components

### Buttons
Solid and confident for the one main action, quiet for the rest.
- **Shape:** 12px corners. Three sizes: small (36px tall, 14px text, 10px corners), medium (44px tall, 15px text) and large (52px tall, 16px text). All are semibold.
- **Primary:** a solid accent fill with On-Accent text and the accent glow. On hover it shifts to accent-hover and rises 1px; when pressed it settles back. In night mode it is a light accent with dark text.
- **Secondary:** a card-colour fill with a strong-divider stroke and ink text. On hover it gets an accent-100 fill, an accent-300 stroke and accent-800 text.
- **Ghost:** no fill and secondary-ink text, with the same accent-100 hover.
- **Destructive:** reject-bg fill with reject ink. On hover it turns solid reject ink with card-colour text (white by day, slate at night).
- **On the pane:** a small white button with an SVG plus icon and Accent Deep text. On hover it gets an accent-soft fill.
- **Disabled:** 45% opacity, no shadow and no pointer events.

### Chips (status)
- **Style:** pill shape, 15px semibold text in the status bg and ink colours, with a 17px drawn glyph before the word in the ink colour. In the admin table, the budget usage cell and the pane rows, chips shrink to 14px. On the pane they keep their own fill, so they read as small badges on the gradient.
- **State:** there are no selected or filter variants. Chips only state a status.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** card colour (white, or 23.5% slate at night) on the ground.
- **Shadow Strategy:** the card shadow at rest. Linked cards lift to the lifted shadow and rise 2px on hover.
- **Border:** none.
- **Internal Padding:** 24px (20px by 16px below 720px). Receipt entries pad 20px and stack a receipt summary row (thumbnail, amount, meta, status) above their explanation callout.

### Inputs / Fields
- **Style:** at least 46px tall with 16px text, a sunken fill, a strong-divider stroke and 12px corners. Labels are 14.5px semibold above the field, and help text is 14.5px tertiary ink below it. Checkboxes are 20px with the accent colour. The file-picker button is styled like a small secondary button. Night mode sets `color-scheme: dark`, so native controls follow.
- **Focus:** the fill switches to the card colour, the stroke turns accent and a 4px accent-200 halo appears.
- **Error / Disabled:** disabled fields drop to 50% opacity. Errors are shown through error banners and the dropzone's error state, not by restyling the input.

### Navigation
- **Desktop rail:** 256px wide, with a 1px right divider.
  - Links are 46px tall, 15px medium, in secondary ink, with icons in tertiary ink. On hover a link takes the sunken fill and ink text.
  - The active link is an accent-soft pill with accent-700 text, semibold weight and an accent icon.
  - The brand mark is a 40px gradient circle with a white receipt icon.
  - At the foot are the theme-picker toggle and then the account block (email and an accent sign-out link, 14px), separated from the items above by a divider.
- **Mobile:** the top bar holds the brand ("Grant Receipt" only), the icon-only theme button and the sign-out link, and scrolls away. The fixed bottom tab bar uses the `.nav-label-short` labels, is at least 58px tall with 14px text, and uses the same accent-soft active pill.
- **Menus:** researcher and admin menus are separate sets; admins see only Dashboard and แหล่งทุน. The nav stays hidden until the admin check finishes, so the wrong menu never flashes.

### Theme Picker
- **Toggle:** a 44px button with a palette icon. On desktop it is a full-width card-colour button labelled "ธีมและสี" with a hairline stroke. On phones it is a 44px square showing only the icon, with the label kept for screen readers.
- **Panel:** a floating card 232px wide with 18px corners, a hairline stroke and the lifted shadow. It holds two labelled radio groups:
  - Mode: สว่าง / มืด / ตามระบบ, shown as three tiles at least 56px tall with sun, moon and monitor icons. The checked tile has an accent stroke, an accent-soft fill and accent-700 text.
  - Accent: six circular swatches in two rows of three. Each is a 30px dot inside a 48px tap target. The checked swatch has a ring in the ink colour and an inner gap the colour of the card. Each swatch has its Thai colour name as its accessible label.
- **Behaviour:** both groups follow the standard radio-group pattern. Tab lands only on the checked option of each group, and the arrow keys move and select within the group. The panel closes on an outside click or Escape, and focus returns to the toggle. Choices are stored per device in localStorage. When nothing is stored, the default is light mode with the sky accent. "ตามระบบ" is an explicit choice; when selected, the theme follows `prefers-color-scheme`, including changes while the page is open.
- **Loading:** `js/theme.js` loads in `<head>` without `defer` on every page, so `html[data-theme]` and `html[data-accent]` are set before the page first paints and there is no flash of the wrong theme.

### Receipts List Pane (signature, receipts.html)
The page's one colour field. It is a sticky gradient panel with 18px corners, white text and the pane glow. From top to bottom it holds:
- **Head:** the h2 "รายการใบเสร็จ" in white and the white upload button for the pane.
- **Summary block** on black at 14%: a 24px tabular passed/total figure, a 15px label, and a 6px progress track (25% white) with a solid white fill.
- **Rows:** full-width button rows with 12px corners. Each row shows the amount (19px tabular), the category (15px), the status chip and the date (14px tabular). Rows are separated by 20%-white hairlines.
- **Row states:** hover adds black at 8%. The selected row adds black at 16% plus an inset 1.5px white outline at 60%. Keyboard focus shows a white outline.

Choosing a row shows that receipt alone in the detail column. Below 960px the pane disappears and the page falls back to the stacked list.

### Stepper
A three-step progress line up to 560px wide. Dots are 36px circles.
- **Done:** solid accent dots with On-Accent numerals; the connector turns accent.
- **Current:** an accent stroke, an accent numeral and a 5px accent-200 halo; the label turns ink and semibold.
- **Upcoming:** card-colour dots with a strong-divider stroke.

### Dropzone
A large target, at least 190px tall, with 18px corners, a 2px dashed accent-300 border, a pale accent fill and a 40px accent upload icon.
- **Hover or drag-over:** the border turns solid accent.
- **Focus:** it gets the accent halo.
- **Error:** it gets a solid reject border and fill.

The real file input invisibly covers the whole zone.

### Verdict Callout and Banners
Tinted panels with 12px corners and a 1px border in the status-edge colour. A 21px status glyph sits in a 52px left gutter. The citation line sits under a hairline in the same edge colour, at 14px. Banners (info / warning / error / success) follow the same pattern with a 20px glyph: info uses accent-soft, warning the fix tones, error the reject tones and success the pass tones.

### Admin Tiles, Bars and Tables
- **Stat tiles:** cards with a 34px tabular value, coloured with the status ink when the tile counts a status.
- **Breakdown bars:** plain CSS. A 12px pill track in neutral-200, filled with the accent or a status dot colour, with a 14px label and a tabular value.
- **Tables:** a sunken head row, 1px dividers, 15px tabular text and Row Hover highlighting. The wide admin receipt table scrolls sideways inside its wrapper rather than squeezing the explanation column.
- **Budget table:** an 8px pill usage bar (accent, or approval orange when over budget) with a tabular percentage.

### The Inked Stamp (signature)
The step-3 verdict on `new-receipt.html` (the status chip inside `#checkResult`) is drawn as a rubber stamp:
- **Look:** a transparent fill in the status ink, a 2.5px solid rule plus a 1px outline offset by 3px (a double rule), 10px corners, 19px bold text with a 21px glyph, and a -2deg tilt. In night mode it uses the light status inks.
- **Motion:** it plays one `stamp-in` animation: 0.5s on the shared ease-out curve, from -9deg, 1.35 scale, blurred and transparent, to its resting tilt.
- **Reduced motion:** under `prefers-reduced-motion` it appears already at rest, and all transitions shorten to near zero.

The stamp is used only for the verdict of a fresh check. Everywhere else the same status is a normal pill chip.

## Do's and Don'ts

### Do:
- **Do** set every surface in Anuphan, with body text at 16px and nothing below 14px.
- **Do** make inputs at least 46px tall with 16px text, and buttons at least 44px tall (52px for the large size).
- **Do** give every status its word, its glyph and its bg/ink/dot/edge tokens. Use the dot colour only for non-text marks.
- **Do** derive any new accent-coloured value from `--accent-h` and `--accent-c` with a fixed lightness, and define its night-mode value in `:root[data-theme="dark"]`.
- **Do** keep every accent preset at least 35° from the status hues.
- **Do** use `--color-on-accent` for text on solid accent fills and `--color-accent-deep` for accent text on white. Never hard-code white on accent.
- **Do** keep the shell plain and separated by hairlines, and keep the Pane gradient to the list pane and the brand mark.
- **Do** check white text on the pane at 4.5:1 or better, in all six accents and both themes, before shipping a pane change.
- **Do** keep the verdict stamp the single loudest element on a result screen, and keep it to `#checkResult`.
- **Do** put the primary action last in the markup of a right-aligned action row, so it sits on the right on desktop and on top when the row stacks on phones.
- **Do** use tabular numerals for every amount, percentage, count and date.
- **Do** change token values freely, but add aliases instead of renaming tokens or classes that JS or inline styles reference.
- **Do** keep icons as inline line SVGs at a 1.8 stroke.

### Don't:
- **Don't** convey a status with colour alone, or invent a status colour without a glyph and a word.
- **Don't** offer a green, yellow, orange or red accent, or any accent that could be mistaken for a verdict.
- **Don't** give an accent preset its own lightness values, or hard-code a single accent hue in a component.
- **Don't** bring back a saturated rail or top bar.
- **Don't** spread the pane gradient onto headers, cards or backgrounds as decoration, or lighten it with white overlays.
- **Don't** use the stamp treatment (rotation, double rule, stamp-in animation) on ordinary chips, badges or headings.
- **Don't** use thick coloured side stripes on callouts or banners. Use the tinted panel with a leading glyph.
- **Don't** use hard offset shadows.
- **Don't** pin anything tall over content on phones other than the bottom tab bar.
- **Don't** bring back the serif display faces or a separate monospace face. Neither carries Thai.
- **Don't** use emoji or text glyphs as icons.
