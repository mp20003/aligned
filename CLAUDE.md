# Triova — Product & Engineering Reference

---

## Current Build State (handoff note — updated 2026-09-04)

### App name & domain
**Triova** (renamed from "Aligned"/"Three Wins"). GitHub repo: `https://github.com/mp20003/aligned` (repo name predates the rename, left as-is). Deployed on Vercel, auto-deploys on push to `main`. Live at **triova.app** (bought directly through Vercel, not Cloudflare — DNS auto-configured, no manual records needed).

Two real infra bugs hit and fixed while setting the domain up, worth knowing if domain/auth issues resurface:
- **Google sign-in was bouncing back to the old `aligned-wine.vercel.app` URL** after adding the custom domain. Not a code bug — `Login.tsx`'s `redirectTo: window.location.origin` was already correct. Root cause was Supabase Auth's **Site URL / Redirect URLs allow-list** (Dashboard → Authentication → URL Configuration) still only listing the old domain; Supabase silently falls back to Site URL when the requested redirect isn't allow-listed. Fixed by updating that config to `triova.app`.
- **One push didn't trigger a Vercel deploy at all** — confirmed via GitHub's commit-status API that Vercel's GitHub App never received that push event (not "still building," zero record). Pushing a fresh empty commit triggered a normal deploy immediately after. Concluded it was a one-off dropped webhook delivery, not a broken Git integration — if it happens again, an empty-commit push is the fastest way to confirm/retrigger before digging into GitHub App reinstalls.

### Stack (current, not the original brief)
Vite + React + TypeScript + Tailwind CSS + React Router v7 + **Supabase** (Google OAuth + Postgres). `localStorage` is now a local cache/offline fallback, not the source of truth — `AppContext` (`src/context/AppContext.tsx`) syncs to a Supabase `app_data` table keyed by `user_id` on every write. Signed-out users hit a `Login` screen (`src/routes/Login.tsx`, Google sign-in only). No email/magic-link auth (removed). `app_data` now has a third jsonb column, **`bank`** (see Win bank section below) — migration already run against the live Supabase project.

### Screens — 5 total, all live
| Screen | File | Route |
|---|---|---|
| Onboarding | `src/routes/Onboarding.tsx` | `/onboarding` |
| Today | `src/routes/Today.tsx` | `/today` |
| History | `src/routes/History.tsx` | `/history` |
| **Triova** (was "Pulse", was rings) | `src/routes/Score.tsx` | `/score` |
| Settings | `src/routes/Settings.tsx` | `/settings` |

Bottom nav (`src/components/NavBar.tsx`) has all 4 navigable items — **Today, History, Triova, Settings**. Settings used to only be reachable via a header button on Today's pre-aligned view (a real bug — once a day was aligned, or on any other screen, there was no way back to it). It's now in the nav bar permanently.

### Visual identity — full dark theme (not the original beige/light spec)
The "Colour Palette" section further down in this doc describes the **original light-theme spec and is stale** — the app pivoted to dark. Actual values in use:
- Background: `#0a0a14` / `#0f0f1a` (near-black navy)
- Surfaces: `rgba(255,255,255,0.05)` with `rgba(255,255,255,0.08–0.15)` borders
- Text: `rgba(255,255,255,0.9)` primary, down to `rgba(255,255,255,0.15–0.35)` for muted/label text
- Category accents unchanged: Physical `#1D9E75`, Mental `#7F77DD`, Spiritual `#D85A30`
- Page transitions via `AnimatedRoutes` in `src/App.tsx`; micro-interactions `.btn-lift`, `.chip-press`, `.confirm-ring` in `src/index.css`

### Win bank (`bank` field, WinCard) — new this session
Users can save a typed win as reusable via a **"Save to bank"** link that appears once they've typed something not already saved; saved items show as removable chips under **"Your bank"** in `WinCard`. Backed by `AppData.bank: Record<CategoryKey, string[]>` (see `src/types.ts`), synced through `AppContext`'s `addToBank`/`removeFromBank`, same `update()` path as everything else. Requires the Supabase `bank` jsonb column — already migrated on the live project; `supabase/schema.sql` has the `alter table` statement for any other environment.

### WinCard (`src/components/WinCard.tsx`) — shared by Today and History
- Tapping a category label (small **(i)** icon) pops up the user's own onboarding **definition** of that category — this is the "what does this category mean" affordance, deliberately separate from the single **Example** chip shown below it (example ≠ explanation).
- **"Previously"** (past logged wins for that category) is a **closed-by-default dropdown** now, not always-expanded chips — a long history used to visually bunch the card up.
- The textarea + button row (**No win today / Save to bank / Done**) docks to the **bottom** of the card via a `flex-1` spacer, so all three category cards' bottom rows align across the row on desktop regardless of how much Example/Bank/Previously content sits above each one. Relies on the parent grid's default `align-items: stretch` — don't add `items-start` to that grid or this breaks.
- **Fixed bug:** "No win today" used to be hidden whenever editing an already-logged win (its guard only checked for empty textarea text, and Edit pre-fills the text). Now shown whenever `editing || !trimmedValue`, and wired to a real `onClear` prop that calls the new `clearWin(date, category)` AppContext action — previously there was no way to un-set a single category's win short of clearing the whole day.

### Today screen (`src/routes/Today.tsx`) — missed-day prompt, new this session
On load, if **yesterday** was completely missed (0 wins) and the user hasn't been asked about it before, shows a modal: *"Yesterday's a blank"* with two options — **"I forgot, let me add it"** (navigates to `/history` with that date pre-selected via router state, History scrolls the editor into view) or **"That's how the day went"** (dismiss). Either way it's marked in a new one-time flag set (`triova-missed-prompted`, localStorage) so it never nags about the same date twice. Dismissing doesn't force anything — the day just proceeds to explode into dust naturally next time the Triova page's `WeekConstellation` mounts, exactly as it always did; the prompt only removes the surprise. Portaled to `document.body` (see stacking-context note under Triova screen below — same root cause, same fix).

### The "Pulse" concept from the original spec is gone
There is no "Pulse" guiding-entity character anymore. The Score screen (renamed **Triova**, not "Pulse") is a star/universe visualization, not concentric breathing rings, a 0–100 score, or a weekly letter. Further down, "## Screens (MVP)" → "### 3. Alignment Score" and any onboarding-intro-entity mentions describe that replaced version — ignore them in favor of this note.

### Triova screen (`src/routes/Score.tsx`) — how it actually works
**This Week panel** (`WeekConstellation`): SVG viewBox 220×200. 7 day-positions seeded from the Monday date string, packed with a minimum 44-unit spacing so nothing overlaps. Each fully-aligned day (3/3 wins) is a **realistic star** — exactly one glow style (`diffraction` spike or `giant` corona, 50/50, both single-core-dot — two other styles, `binary`/`cluster`, used to draw 2-3 dots per star and were removed for looking like multiple stars). Star colour is seeded from `{orange, red, blue, white}`. Each star can have **0–3 orbiting planets** (weighted 45/30/18/7% for 0/1/2/3), each on its own concentric ring with independently seeded angle/colour/speed via SVG `animateTransform`, clearly smaller than the star. **Today renders/fires its star immediately once it hits 3/3** — it used to be hard-excluded until the next day, which meant the "watch a star get born" payoff was invisible on the day you actually earned it; fixed. 1–2 win days render a `Comet`; fully-missed *past* days explode once into `DustRemnant` (orange dust) — today never explodes while still in progress. A `NovaBurst` flash plays once per star via a one-time flag.

Every star and (if any) its planets get procedurally-generated names, seeded from the date (`getStarName`/`getPlanetNames` — e.g. "Vantor-482", planets suffixed "b"/"c"/"d"). **Tap a star** (not hover — mobile-first, hover doesn't work on touch) to see its name/date; tap again or tap elsewhere to dismiss. Tapping is a **single delegated click handler on the whole panel** that does distance-math against seeded star positions, not per-star SVG hit targets — two earlier attempts at per-star invisible hit-circles were unreliable (worth knowing if this ever needs revisiting: don't go back to per-shape SVG click targets for this, delegate at the panel level).

**Universe panel** (`UniversePanel`): one small cluster per week (including the current week, live), cluster centers seeded per-Monday but packed with 56-unit minimum spacing (they used to be placed independently with no collision avoidance, which could land two clusters on top of each other — likely the cause of "stray"-looking dots reported once). Each week gets a procedural two-word name (`getClusterName`, e.g. "Ember Drift"). **Exactly one dot per aligned day** (used to be two layered circles per day). Hover a cluster to see its name + date range **or click/tap it** to open a full-size expanded view of that week's constellation in a modal overlay (`ExpandedWeekModal`, "Back to this week" to close) — click works on both desktop and mobile, so this also covers what used to be a known mobile-tap gap.

**One-time animation flags**: a date that's exploded into dust, had its star born, or been asked about in the missed-day prompt (see Today section above) gets a permanent flag in `localStorage` (`triova-dusts` / `triova-born` / `triova-missed-prompted`) so it doesn't repeat. This is easy to get wrong — nothing that mutates `days` should leave these stale. `AppContext.tsx` clears them correctly: `logWin`/`clearWin`/`clearDay`/`clearRange` clear just the affected date(s); `resetPractice`/`signOut`/`restoreData` clear all three sets entirely. If you add any new way to mutate `data.days`, make sure it also calls the relevant clear.

**Fixed bug — `getDeadDates` (missed-day dust specks in Universe):** used to require `days[dk] !== undefined` before counting a day as missed, but the app never actually creates a stored entry for a day unless at least one win was logged (`logWin` always sets a category; `clearDay`/`clearWin` delete the day rather than nulling it out) — so a genuinely missed day essentially never matched, and Universe's dead specks silently never rendered for real usage. Now just checks `getWins(...) === 0`, matching what `WeekConstellation` already used for the dust-explosion animation. Verified live: a week with 2 missed days now shows 2 dust remnants in This Week **and** 2 dead specks in Universe (previously 2 vs 0).

**This session's other visual/layout changes to this screen:**
- **Desktop layout**: This Week and Your Universe now sit **side-by-side** (`lg:grid-cols-2`) in a `max-w-6xl` container, matching Today/History's width, instead of both being stuck in a narrow `max-w-2xl` centered column with big empty margins.
- **Background seam fixed**: the page and both panel containers used `#0a0a14` while the shared `body`/`html` background is `#0f0f1a` (see index.css) — visible as a mismatched band whenever content was narrower than the viewport. Everything on this screen now uses `#0f0f1a` to match.
- **Caption alignment**: This Week and Universe have different SVG aspect ratios, so their captions used to land at different heights. Fixed via `lg:items-stretch` on the grid + a `flex-1` spacer above each caption, so both now sit on the same baseline regardless of panel height.
- **Star glow tightened**: outer glow radius was 36–44 units (diffraction/giant), close enough to the 44-unit minimum star spacing that neighbouring stars' glows regularly blended into one hazy cloud. Shrunk to 16–20 units; the bright white core and diffraction spikes are untouched.
- **Planets spaced further apart** (16/30 units instead of 16/24/32) with **Kepler-scaled orbit durations** (period ∝ distance^1.5) — outer planets visibly crawl, inner ones zip, instead of all orbiting at similar random speeds regardless of distance.
- **Asteroids** now drag a small 3-dot fading trail behind them in their direction of travel.
- **Background star sprinkles** added to This Week (Universe already had them via `NebulaField`).
- Section labels/headings are bolder (`font-medium`/`font-semibold`, higher opacity) instead of very faint regular-weight text; the transient "log your first win..." status line under This Week was removed and replaced with a fixed explanatory caption under each panel; Your Universe's header now has a matching stat ("N stars across your journey") for structural symmetry with This Week's header.
- **Stacking-context gotcha, worth remembering for any new fixed-position overlay on any route**: the page-transition wrapper (`AnimatedRoutes` in `src/App.tsx`, class `.page-enter`) applies `transform: translateY(...)` which — even at `translateY(0)` after the animation finishes — becomes the containing block for any `position: fixed` descendant per the CSS spec. A plain fixed modal anywhere in a routed page renders trapped behind the (also fixed) nav bar instead of above it. Fix: `createPortal(..., document.body)`. Both `ExpandedWeekModal` (this screen) and `MissedDayModal` (Today) do this now — if a new full-screen overlay is added anywhere, it needs the same treatment.

### History screen (`src/routes/History.tsx`) — recent changes
- Day-cell states are now visually distinct by **size**, not just opacity: 3 wins = full conic-gradient circle; 2 wins = large filled disc; 1 win = small "ember" dot; 0 wins = **genuinely blank**, just a faint outline (used to be a barely-different faint grey dot for all three non-full states — that was the actual complaint).
- **Cell/legend colours now reflect the actual completed categories**, not a generic shade: a two-win day shows a conic split of the two categories actually done that day (`buildConicGradient`), a one-win day shows that category's own accent colour, instead of generic white — same for the legend swatches (using representative physical+mental / physical examples).
- Selecting a day with any wins shows a **"Clear day"** link (confirms via `window.confirm`, calls `clearDay` from `AppContext`).
- Reads a `selectDate` value from React Router navigation state (set by Today's missed-day prompt) to auto-select a day and scroll its editor into view on arrival — see Today section above.
- Share-card canvas export mirrors the pre-this-session visual language (not yet updated to match the new per-category cell colours — worth doing if it's noticed as inconsistent).

### Settings screen (`src/routes/Settings.tsx`) — recent addition
**"Clear a month"** tool: native `<input type="month">` + two-step confirm (same pattern as "Reset practice"), calls `clearRange(startDate, endDate)` in `AppContext`. Added because a user had stray/test data in a specific month they wanted gone and there was no way to do that short of a full reset.

### AppContext (`src/context/AppContext.tsx`) — data-mutation surface
`logWin`, `clearWin(date, category)`, `clearDay(date)`, `clearRange(start, end)`, `updateSettings`, `resetPractice`, `restoreData(imported)`, `signOut`, `addToBank(category, text)`, `removeFromBank(category, text)`. All funnel through a single `update()` that writes `localStorage` + upserts to Supabase when a session exists. See the "one-time animation flags" note under the Triova screen above — every date-mutating action except `updateSettings`/bank actions also has to reconcile `triova-dusts`/`triova-born`/`triova-missed-prompted`.

### Onboarding intro copy (`src/routes/Onboarding.tsx`) — rewritten this session
The old intro framed Triova as an "AI presence" watching the user ("It watches your practice without judgment... it has always been there"). That's gone — replaced with four short, spaced-out standalone lines (not paragraphs — that was tried first and read as too dense): what the practice actually is, what *Tri*/*Nova* means, why small effort compounds (this is where the Atomic-Habits identity-based-habits idea and the 1%-compounding idea are seamlessly worked in, deliberately never named/cited in-app — contrast with the vision doc below, which does cite them directly since that's for collaborators, not end users), and "Welcome to Triova." as its own closing line. The name field label was also depersonalized: "What should we call you?" not "What should Triova call you?".

### Vision document — produced this session, not app code
A persuasion-style vision/pitch document (for onboarding collaborators, not users) was written and delivered as an editable **Word doc** (`docx` skill, not an Artifact — user asked for something they could edit directly). Covers the problem framing, the product's actual hard constraints (no streaks/scores/partial credit, listed as enforced code behaviour not aspirational values), the Tri/Nova name story, and explicitly cites James Clear's identity-based-habits framing and the 1%-compounding rule as the behavioural grounding — the opposite choice from the in-app onboarding copy above, and intentionally so (pitch doc for adults recruiting collaborators vs. product copy for end users). Not stored in the repo — was a one-off deliverable sent directly to the user. If asked to update it, there's no source file to edit; treat it as a fresh regeneration from the latest chat-approved draft, or ask the user to paste back the version they want edited.

### Known safety/compliance gaps — flagged, not yet addressed
No Privacy Policy or Terms of Service. No account/data-deletion flow (`signOut` clears the local session only; the Supabase `app_data` row is never deleted, so there's currently no way for a user to actually exercise a GDPR/CCPA-style erasure request from the app itself). No accessibility/contrast audit — a lot of the UI uses low-opacity white text (`white/25`, `white/30`) on a near-black background, some of which likely fails WCAG AA contrast. No data export/portability feature beyond the History share-card PNG (that's an image, not a data export). No cookie/consent disclosure (arguably low-risk since there's no third-party tracking, but nothing states that anywhere). No custom security headers beyond Vercel's defaults. None of this matters while the app has one user; all of it matters the moment it has real other users, especially EU/UK/California ones, or gets submitted to an app store.

### Known testing limitation (mobile emulation, still relevant)
The Browser-pane's **mobile touch emulation has been unreliable across sessions** — clicks (including on completely unrelated elements like nav `<Link>`s) can time out and the pane reports itself stuck/hidden. Don't trust a single mobile-emulated repro as proof of a real bug without also checking whether *anything* clicks in that tab; test via `preset: "desktop"` first as a sanity check, and prefer architectural fixes (e.g. delegate click handling to a big stable container, or use `onClick` instead of hover — done for both This Week's stars and now Universe's clusters) over chasing specific mobile-touch-event theories when the emulator itself is behaving oddly.

### Dev environment
- `npm run dev` → Vite on port 5173. `npm run build` → `tsc -b && vite build` (also serves as the type-check).
- Node at `C:\Program Files\nodejs\node.exe`; `.claude/launch.json` configured for the preview tool.
- To test authenticated screens without real Google sign-in, a temporary `?dev=1` bypass was added/removed from `src/App.tsx` (`authLoading`/`session` gate) during debugging sessions — **not currently in the code**, re-add-and-revert if needed rather than leaving it in.

### Pending / not yet done
- PWA / App Store packaging — not built.
- Claude API integration for smarter prompts — mentioned in the original brief, still not wired.
- No way to change name post-onboarding (Settings has category editing but the name field wiring should already work — double check `updateSettings` covers it before assuming this needs building).
- The "You said: ..." hint on win cards may be redundant with the definition-as-placeholder — noted but never actioned.
- History's share-card PNG export doesn't reflect the new per-category cell colours (see History section above).
- Safety/compliance gaps — see dedicated section above (privacy policy, account deletion, accessibility, data export).
- ~~Universe cluster hover isn't tap-friendly on mobile~~ — fixed this session, clusters are click/tap now.

---

## What This App Is

A mobile-first daily alignment app. The user logs one intentional win per day across three categories — Physical, Mental, and Spiritual. This is **not** a habit tracker. It is a discipline and mindfulness system built around balance, not streaks or productivity volume.

The unit of success is **alignment** (all three categories touched), not volume or frequency.

---

## Tech Stack

- **Framework:** Vite + React (TypeScript)
- **Styling:** Tailwind CSS with custom theme (see below — note the theme has since gone full dark, see handoff note)
- **Routing:** React Router v7
- **Persistence:** Supabase (Postgres + Google OAuth) is the source of truth; localStorage is a local cache/offline fallback. This superseded the original "localStorage only, no backend" plan — see handoff note.
- **Fonts:** Lora (serif, headings) + Inter (sans-serif, UI) via Google Fonts
- **Deployment:** Vercel via GitHub

### Dependency Rule
Do not add third-party analytics. Do not install unnecessary dependencies. If unsure whether to add something, ask first. (The original "no backend/auth" rule was superseded when Supabase + Google OAuth were added — that was an explicit decision, not a violation of this rule; it doesn't reopen the door to adding other backends/auth providers without asking.)

### Decision Rule
Before making any architectural decision — routing library, state management, animation library — stop and propose two options with a one-line tradeoff. Don't pick without explicit user approval.

---

## Colour Palette

| Token | Hex | Usage |
|---|---|---|
| Background | `#F5F0E8` | Warm beige — app background |
| Primary text | `#2C2C2A` | Charcoal — all body text |
| Physical accent | `#1D9E75` | Deep sage |
| Mental accent | `#7F77DD` | Muted purple |
| Spiritual accent | `#D85A30` | Warm coral |

No primary colours (no red/blue/green primaries) anywhere in the UI. No confetti. No gamification chrome.

---

## Typography

- **Headings:** Lora (serif) — all screen titles, reflective prompts, win category names
- **UI / body:** Inter (sans-serif) — inputs, labels, buttons, metadata

---

## Core Product Decisions

1. **Alignment over volume** — logging one win per category per day is the complete act. There is no "more."
2. **Score hidden until complete** — the alignment score (0–100) is never shown until all three wins are logged for the day. No partial scores. Ever.
3. **Identity language** — copy uses identity framing ("you prioritised your mind today") not task framing ("3/3 complete").
4. **Missed days are data** — framed as observation ("you skipped Physical on weekdays — is that intentional?"), never as failure.
5. **No streaks** — streak counters are explicitly prohibited anywhere in the UI.
6. **Reflective prompts are brief** — never open-ended essays. One sentence inputs only.

---

## Screens (MVP)

### 1. Onboarding
- User defines what each category means to them before anything else
- Spiritual label offers alternatives: Spiritual / Soulful / Intentional / Creative — user picks or types their own
- Each category has a short personal definition: "For me, a Physical win means..."
- Stored in localStorage, used to personalise prompts throughout the app
- **This is non-negotiable — never skip or defer onboarding**

### 2. Today
- Opens with a rotating reflective prompt before categories are visible (e.g. "What does your body need today?")
- Three win cards: Physical, Mental, Spiritual
- Each card: single text input (one sentence max) + tap-to-complete toggle
- Below each empty input: 2–3 rotating win suggestions (prompts, not tasks)
- On completing the third win: slow subtle "alignment moment" animation — soft pulse, not confetti
- Alignment score only appears after all three wins are done

### 3. Alignment Score
- Large circular score ring (0–100)
- Per-category breakdown for the week (e.g. Body 6/7, Mind 7/7, Spirit 4/7)
- One reflective nudge based on the weakest category
- Optional Sunday check-in: "Which of the three felt hardest this week?" — three buttons only

### 4. History
- 30-day grid, one row per week, one cell per day
- Cells colour-coded: balanced / partial / missed
- No streaks. No percentage breakdowns. Just the visual truth.
- One insight sentence generated from the pattern (e.g. "You skip Physical on weekends")

---

## Alignment Score Algorithm (to design before building)

> When we build the Score screen, design the algorithm as a constraint problem first. A user logging three low-effort wins every day must not outscore someone who logs two genuine wins and misses one day. The formula must be shown and approved before implementation.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vagueness — users don't know what counts as a win | Onboarding definition step is mandatory. Never skip or defer. |
| Empty inputs feel intimidating | Never show a blank input without 2–3 rotating suggestions nearby |
| Score gaming — logging trivial wins every day | Score hidden until all three done. No partial scores. |
| Journal drift — feature creep beyond the three-win loop | Every feature must serve the three-win loop. Reject anything that doesn't. |
| Retention cliff at day 10 | Weekly pattern insight must be surfaced proactively by day 7 — not buried in settings |

---

## Component Contract Rule

Once each screen is built, a one-paragraph component contract is written at the top of the file:
- What the component does
- What it **never** does
- What props it accepts

---

## Reviewer Rule

After each build session, review what was built as a skeptical product designer who thinks most apps are too complex. Call out what you'd cut.

---

## App Name — resolved

**Triova.** (This section originally listed working titles under consideration — Three Wins, Triad, Aligned, Still. Decided; see the handoff note at the top.)

---

## State Shape

Superseded by the handoff note at the top of this doc, which has the actual current shape (includes `name` and `reflection`, and notes that localStorage is now a cache backed by Supabase, not the source of truth). Authoritative source: `src/types.ts`.
