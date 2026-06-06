---
target: yaqu.app public + auth (landing, login, register) @390px
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-05T22-12-08Z
slug: yaqu-app-public-auth-landing-login-register
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Login has strong feedback (Enviando…, countdown, alerts); landing solid |
| 2 | Match System / Real World | 3 | Clear LATAM/ES copy; "enlace mágico" mild jargon but explained |
| 3 | User Control and Freedom | 3 | Login offers reenviar / cambiar email; good escape hatches |
| 4 | Consistency and Standards | 2 | Button shape, card/input radii, borders and badge color drift between landing and auth |
| 5 | Error Prevention | 3 | type=email + required; little client-side guidance beyond that |
| 6 | Recognition Rather Than Recall | 3 | Magic link removes password recall; no autofocus on first field |
| 7 | Flexibility and Efficiency | 3 | Fine for simple forms; no autofocus / remembered email |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and luminous; two green CTAs on fold + faint register inputs + auth dead space |
| 9 | Error Recovery | 3 | Login error messages specific and actionable |
| 10 | Help and Documentation | 3 | "Ver cómo funciona", trust lines, cross-links between login/register |
| **Total** | | **29/40** | **Solid — dragged down by cross-surface inconsistency** |

## Anti-Patterns Verdict

**LLM assessment:** Does not look AI-generated. The pages honor the stated North Star ("recibo de confianza"): luminous, one-column, green used sparingly, warm neutrals, clear hierarchy. No gradient text, no glassmorphism, no eyebrow scaffolding, no side-stripe borders. The tell here is the opposite of slop — it's *handcrafted drift*: three pages built by hand that quietly diverge from their own design tokens.

**Deterministic scan:** detect.mjs returned only warnings, all false positives against this project's committed system: `overused-font` / `single-font` (Inter) is an explicit DESIGN.md decision and permitted in the product register; `flat-type-hierarchy` on the auth pages (13–22px) is a small contained form, not a hierarchy failure. No P0/P1 from the scanner.

## Overall Impression
A clean, trustworthy set of pages that mostly lives up to the brand. The biggest opportunity is the cheapest to fix: the conversion path (landing → register → login) renders the same components in three slightly different shapes. A user crossing from the marketing site into signup meets a primary button that changed shape, inputs that got fainter, and a blue badge on an otherwise all-green brand. None of it is broken; all of it erodes the "es el mismo producto y está cuidado" promise from Design Principle 5.

## What's Working
- **Hero hierarchy and CTA clarity (landing).** "Cotiza por WhatsApp. Firma digital. Cobra antes de empezar." with the payoff line in brand green, one strong primary CTA, plus the trust line ("Sin tarjeta · Configurado en 5 minutos"). Textbook Stripe-style single-action clarity.
- **Login feedback loop.** Sending state, 60s resend countdown, change-email path, and specific error strings (link_expired, invalid_token, connection error) — genuinely better than most auth screens.
- **Brand discipline.** Green stays an accent, neutrals are warm, surfaces are white, shadows are soft. The "Una Sola Voz" rule is mostly respected.

## Priority Issues

- **[P1] Primary button changes shape between marketing and auth.** Landing `.btn` is `border-radius:999px` (pill, per DESIGN.md "Buttons: pastilla, radius full"). Login/register `.btn` is `border-radius:12px` (rounded rectangle). The first interactive control a converting user touches contradicts the site they just left.
  - *Why it matters:* Directly undermines Design Principle 5 ("una identidad coherente") at the exact trust-sensitive moment (handing over an email to sign up). Shape inconsistency on the primary action reads as "different/cheaper page."
  - *Fix:* Make auth `.btn` a pill (radius full). Align card radius to the 16px (lg) token (currently 20px) and input radius to 12px (md) (currently 10px).
  - *Suggested command:* $impeccable polish public/login.html public/register.html

- **[P1] Register inputs are nearly borderless, and differ from login.** Register inputs use `border:1px #e7e9e5` (the lightest token) on a white card — the edges almost vanish. Login uses `#cdd2cb`, clearly visible. So affordance is both *weak* and *inconsistent* between the two auth pages.
  - *Why it matters:* Violates the explicit "pulgar en obra, a pleno sol" principle — faint field edges are the first thing to disappear in bright light. And the login/register mismatch is exactly the handcrafted-drift tell.
  - *Fix:* Standardize one input border across both pages at a visible value (login's `#cdd2cb` or a dedicated `--input-border`), with the green focus ring already in place.
  - *Suggested command:* $impeccable polish public/register.html

- **[P2] Blue trial badge dilutes the single-voice green on the top conversion screen.** Register's "🎉 14 días gratis, sin tarjeta" badge is blue (`#eff6ff` / `#1d4ed8`). It's the most eye-catching non-CTA element on the highest-intent page, and it introduces a competing accent the brand reserves for info/count badges.
  - *Why it matters:* "14 días gratis" is a *positive/reward* message — green tint reinforces brand and the free-trial value; blue fights the green CTA for attention.
  - *Fix:* Recolor the badge to the positive tint (`#ecfdf5` bg / `#047857` text), matching the landing's price tag.
  - *Suggested command:* $impeccable colorize public/register.html

- **[P2] Auth cards float mid-screen with large dead space on mobile.** Both pages use `min-height:100vh; align-items:center`. On a 390×844 phone the card starts ~450px down; the top half is empty grey. For a hurried thumb on a worksite, the form should sit higher.
  - *Why it matters:* Wastes the most valuable above-the-fold space and makes a short form feel oddly weightless; contradicts "lo importante arriba."
  - *Fix:* On mobile, anchor higher — `align-items:flex-start` with a top padding (e.g. `padding-top: clamp(24px, 12vh, 96px)`), keeping centered behavior on larger screens via media query.
  - *Suggested command:* $impeccable adapt public/login.html public/register.html

- **[P2] Two green primary CTAs on the landing fold.** Nav "Probar gratis" and hero "Empezar gratis" are both brand-green, competing on first paint — against the "Una Sola Voz: una pantalla = un botón verde primario" rule.
  - *Why it matters:* Splits attention on the single most important screen; the rule exists precisely to make the one CTA feel premium.
  - *Fix:* Demote the nav CTA to ghost/secondary (white + border), or keep nav green and make the hero secondary. One green per fold.
  - *Suggested command:* $impeccable polish public/index.html

## Persona Red Flags

**Jordan (First-Timer / non-technical tradesperson, on phone, in the field):**
- Register input borders nearly invisible in bright light — may not perceive the fields as tappable. Hits the field by chance, not by design.
- Card floating in mid-screen on mobile: first impression is "is the page still loading?" before scrolling/registering it's centered.
- "enlace mágico" is unusual phrasing for the audience, though the follow-on "para entrar sin contraseña" rescues it.

**Sam (Conversion-focused founder/PM viewing this as a funnel):**
- Brand identity visibly shifts marketing→signup (button shape, input weight, accent color). Erodes trust at the worst moment.
- Two green CTAs above the fold dilute the primary action's pull.
- No autofocus on the first field — one extra tap on every login/registration.

## Minor Observations
- Label color `#333c37` on auth pages isn't a DESIGN.md token (system has ink/body/muted). Map it to a token.
- No `autofocus` on the email (login) / business-name (register) first field — easy efficiency win.
- Landing trust line ("Sin tarjeta · Configurado en 5 minutos") is pale grey over the mint hero tint — verify ≥4.5:1; nudge toward body ink if borderline.
- `#6b756f` body/description text on white sits right at the 4.5:1 line — fine, but don't lighten it further.
- Landing feature blocks are an identical card grid (acceptable for a landing, but the most "templated" stretch of the page).

## Questions to Consider
- If the marketing site and the app shared one CSS token file, would any of these P1/P2 drifts even be possible? (The fix may be structural, not per-page.)
- What would the register screen look like if the trial offer were the hero of the card rather than a small badge — green, confident, "14 días gratis por delante"?
- On the fold, which single action do you most want a plumber to take — and does the current two-green-buttons layout make that obvious?
