# Triova — Product & Engineering Reference

---

## Current Build State (handoff note — updated 2026-09-09)

### Vision-doc review, check-in pattern view, and daily push reminder (this session)
A separate vision/pitch document (`Triova Vision Document.docx`, not in this repo — see "Vision document" note further down) was checked against the actual live build rather than taken on faith. Verdict: unusually faithful — every concrete claim in it (score-hidden-until-3/3, no streaks, identity language, five real screens, real Supabase sync, a visualization generated from real data) checked out against the code, not just the pitch. Two real gaps were found between what the vision promises ("watch your universe compound") and what the app delivered on its own:

1. **No aggregate view of weekly check-in answers over time** — fixed. `src/routes/History.tsx` has a new "Your check-ins" section in the side panel, right after the existing "Pattern" (`generateInsight`) block: a closed-by-default disclosure (same `aria-expanded`/chevron pattern as `WinCard`'s "Previously" section) listing every past weekly check-in most-recent-first with its date range and chosen category, plus one aggregate sentence ("{Category} has felt hardest N of your last M weeks") that only appears once there are 4+ weeks of data and only when one category is a strict majority — same not-claiming-a-pattern-from-too-little-data spirit as `generateInsight`. No schema change, no new dependency — `data.checkins` was already synced, just never surfaced as a series.

2. **Nothing brought a user back to the app on its own** — no push notification, no reminder, no nudge of any kind existed anywhere. Fixed with a daily web-push reminder, kept inside the app's existing constraints (no streaks, no guilt copy, identity-framed language):
   - **New dependency**: `web-push` (npm, server-side only — used in `api/send-reminders.js`, never shipped to the client bundle).
   - **New Supabase table**: `push_subscriptions` (endpoint + keys per browser subscription, RLS-scoped to the owning user, no select policy since nothing client-side reads it back — same reasoning as the `events` table). **Needs to be run manually against the live project** — same as every other schema change so far.
   - **Client subscribe/unsubscribe** — new `src/lib/push.ts`, talks directly to Supabase with the existing anon-key client (no new API endpoint needed for this half); exports `isPushSupported`, `getPushSubscriptionState`, `subscribeToPush`, `unsubscribeFromPush`. Wired into a new "Daily reminder" section in `src/routes/Settings.tsx` (session-gated, plain toggle, no confirm-step since it isn't destructive).
   - **Service worker** (`public/sw.js`) — added `push` (shows a notification using `apple-touch-icon.png`, since Chrome doesn't reliably render SVG notification icons) and `notificationclick` (focuses an existing tab or opens `/today`) handlers.
   - **Daily send** — new `api/send-reminders.js`, a Vercel serverless function mirroring `api/delete-account.js`'s structure (service-role client, env-var checks). Triggered once/day by a new Vercel Cron entry in `vercel.json` (`0 19 * * *` — a one-line schedule string, trivially adjustable). Rejects any request whose `Authorization` header isn't `Bearer ${CRON_SECRET}`, the standard way to keep a public cron endpoint from being triggerable by anyone who finds the URL. Fetches everyone with a saved subscription, checks who hasn't logged all three categories for today (server's UTC date), and sends an identity-framed nudge using their **actual category labels** (e.g. *"Show up for your Physical or Spiritual today?"*, or *"Show up for one part of you today."* if all three are open) — never streak or urgency language. Self-cleans: a 404/410 send response (expired subscription) deletes that row.
   - **VAPID keypair generated this session** (`npx web-push generate-vapid-keys`, pure local crypto) — public key already in `.env` as `VITE_VAPID_PUBLIC_KEY` and reused server-side (Vercel exposes `VITE_`-prefixed vars to serverless functions too, same precedent as `VITE_SUPABASE_URL`). **Still needs, as Vercel-only env vars (never in `.env`, same rule as `SUPABASE_SERVICE_ROLE_KEY`)**: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (set to `https://triova.app` — a URL is valid per the VAPID spec, deliberately used instead of a personal email), and `CRON_SECRET` (a random secret generated this session). None of these three have been added to Vercel yet.
   - **Known, deliberate limitations**: single global send time — Hobby-tier cron is once/day only, so every subscriber gets the reminder at the same UTC instant regardless of their own timezone; a per-timezone-bucket version (multiple cron entries + a stored offset) would be a reasonable upgrade later, not built now. iOS Safari still only delivers web push if the PWA is installed to the home screen (16.4+), unchanged by this feature.
   - **Not testable end-to-end locally** — `/api` functions are Vercel-only, same limitation already documented for account deletion. What *was* verified locally (via the same temporary `?dev=1` bypass technique already documented below, fully reverted after): the check-in section's rendering/expand-collapse/aggregate-threshold logic with seeded `localStorage` data, the Settings toggle's full click → permission-request → graceful-error-message path (this sandboxed browser environment denies the permission prompt, which is itself a valid negative-path test), and that the updated service worker registers and serves the new `push`/`notificationclick` handlers. The actual send needs a real deploy plus the SQL migration and the three env vars above.

### Launch-readiness pass (previous session)
Working toward a public web launch (app-store packaging and monetization are explicitly deferred to a later phase; free at launch). Tier-1 blockers identified in a codebase audit, addressed this session:
- **Error boundary** (`src/components/ErrorBoundary.tsx`) — wraps the whole app in `App.tsx`. A render crash now shows a "Reload Triova" screen instead of a blank white page.
- **Security headers** (`vercel.json`) — added CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. CSP required moving the service-worker registration script out of the inline `<script>` in `index.html` and into `src/main.tsx`, so `script-src` can stay `'self'` with no `unsafe-inline`. `style-src` does need `'unsafe-inline'` since the app uses React inline `style={{...}}` extensively.
- **Sync status is now visible** (`AppContext`'s new `syncStatus`/`retrySync`) — a failed or offline Supabase upsert used to only `console.error` silently. Now tracked as `'synced' | 'syncing' | 'error' | 'offline'`, shown in Settings under "Your data" with a Retry button, and auto-retried when the browser's `online` event fires.
- **Privacy Policy + Terms of Service** (`src/routes/Privacy.tsx`, `src/routes/Terms.tsx`, shared shell in `src/components/LegalPage.tsx`) — reachable at `/privacy` and `/terms` **without a session**, since `AppRoutes` in `App.tsx` had to be restructured (those two routes are now checked before the `!session → <Login/>` branch, not after). Linked from Login's footer and Settings' footer. Contact email and the governing-law clause are placeholder-reasonable, not lawyer-reviewed — revisit before real scale.
- **Account deletion** — this was more than a missing button: `supabase/schema.sql` had no `delete` RLS policy at all, and the anon key can never delete an `auth.users` row regardless (needs the service-role key, which must never reach client code). Solved with:
  - A `delete` RLS policy added to `supabase/schema.sql` (**must be run manually against the live project** — Supabase SQL Editor — since there's no CLI/migration tooling set up; nothing in this repo can execute it automatically).
  - `api/delete-account.js` — a Vercel serverless function (plain `.js`, no new dependency — reuses `@supabase/supabase-js` already in `package.json`; works because `package.json` has `"type": "module"`). Verifies the caller's own access token server-side via the service-role client, then calls `auth.admin.deleteUser`, which cascades to delete the `app_data` row via the existing FK. Chosen over a Supabase Edge Function specifically to avoid introducing Supabase CLI tooling that doesn't exist in this project yet — the app already deploys to Vercel on every push, so this is one more file, not a new pipeline.
  - **Still needs a human step before this works in production**: add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard → Project Settings → API) as a Vercel project environment variable. It is not in `.env` and must never be — that file only holds the public anon key. `VITE_SUPABASE_URL` is reused server-side as-is since Vercel exposes all configured env vars to serverless functions regardless of the `VITE_` prefix.
  - Client side: `AppContext`'s new `deleteAccount()` POSTs to `/api/delete-account` with the session's access token, then runs the same local cleanup as `signOut`. UI is in Settings, same two-step-confirm pattern as Reset/Clear-a-month.
  - **Not testable against the local Vite dev server** — `/api` functions are a Vercel-only runtime; there is no local emulation set up (would need `vercel dev`, not currently used). Only verified via `npm run build` (typecheck) — the actual delete-user call needs a real deploy plus the env var above to test end-to-end.

Remaining tier-1/tier-2 items from that audit (accessibility contrast pass, multi-device write conflicts, no error monitoring, no CI, no tests, History's share-card colors) are still open — see "Known safety/compliance gaps" below, which has been updated to match.


### Weekly reflective check-in — completed this session (was half-built, undocumented)
A "Sunday check-in" already existed in `Today.tsx` from an earlier session but was never mentioned in this handoff note — worth flagging since it meant an honest product assessment this session initially (wrongly) reported it as "never built." What actually existed: an inline card shown only on Sundays asking "which part of you felt hardest to show up for?", three category buttons, answer written to **`localStorage` only** — never synced, no skip option (every other prompt in the app has one), and the answer was never referenced again anywhere. Completed properly this session:
- **Persisted through `AppContext`/Supabase**, not just localStorage — new `AppData.checkins: Record<string, CategoryKey>` field (`src/types.ts`), keyed by that week's **Monday** date (`src/lib/date.ts`'s new exported `mondayOf()`, factored out of a duplicate copy that used to live only in `Score.tsx`) so it's stable regardless of which day it's actually answered on. Wired through `AppContext` exactly like `bank`: default `{}`, included in the remote select/insert/upsert, restored with a fallback in `restoreData`, cleared on `resetPractice`. New action: `recordWeeklyCheckin(weekKey, category)`.
  - **Needs the same live-project migration `bank` needed** — `supabase/schema.sql` has the `checkins` column in `create table` plus a commented `alter table ... add column if not exists checkins jsonb not null default '{}'::jsonb` for the already-live database. Not yet run against the live Supabase project as of this note.
- **Added a skip option** ("Skip this week") — device-local only (`localStorage`, `triova-weekly-skipped`), matching the missed-day modal's "that's how the day went" tone. Deliberately not synced: skipping is a "not now," not data worth persisting across devices.
- **Closes the loop instead of vanishing into a void**: answering shows a brief "Noted — thank you for the honesty." acknowledgment (auto-clears after ~2.6s via local state, not persisted), and the *following* Sunday's card shows "Last week, you said {category}." if an answer exists for the prior week — so the ritual now visibly remembers what you told it instead of the answer disappearing forever the moment you tapped a button.
- Verified end-to-end via a temporary `?dev=1` route-guard bypass + a monkey-patched `Date` (to force "Sunday") in the Browser pane — both fully reverted after testing, per the existing dev-environment note below. Confirmed: answer persists to the right week-key, the last-week callback renders, and the card correctly disappears after answering and stays gone on reload.
- Still not consumed anywhere beyond the callback line — there's no screen showing a history of past answers or aggregating them into a pattern insight. That remains a real gap (see "Pending" below) — this session closed the loop for *one week back*, not a running insight.

### Win bank vs. the no-gaming philosophy — considered, kept as-is
A product review this session flagged real tension: the risk table under "Alignment Score Algorithm" warns against "logging trivial wins every day" and names "score hidden until all three done" as the mitigation, but the win bank (see below) lets someone one-tap-reuse the same saved text indefinitely — seemingly a loophole. Looked at again against the actual `WinCard.tsx` code before deciding anything: **every win, bank-sourced or freshly typed, still goes through the "how did it feel?" reflection tap** (Hard/Easy/Meaningful/Routine) before it's logged — the bank isn't actually one-tap-and-done, it's one-tap-to-fill-text-then-still-confirm-honestly. And since Triova never shows a score or streak, there is no visible number for a reused win to inflate — the original risk was specifically about gaming a number that no longer exists on screen.

**Decision: left as-is, deliberately, not by default.** The reflection tap is already sufficient friction, and treating repetition as inherently suspicious would contradict the app's own "trust the user, no judgment" stance applied everywhere else (missed days are framed as data, not failure — the same logic extends to a genuinely-recurring win). If this needs revisiting later, the two lighter-touch options considered and not taken were: (a) a small observational "Same as yesterday" note with no blocking, mirroring the missed-day tone, or (b) leaving `WinCard` untouched and instead having a future pattern-insight feature (see "Pending" below) surface repeated entries as one of its observations. Revisit only if real usage data (once any exists — see analytics gap) suggests the bank is actually being used to coast rather than for genuinely recurring wins.

### First-party event signal — new this session
The app had zero visibility into whether anything works, by deliberate no-third-party-analytics rule — but that also meant no way to answer "does anyone come back," not even privately. Added the minimal option the launch-roadmap doc called "Option A": a plain first-party `events` table (`supabase/schema.sql`), no analytics script, no new dependency. `src/lib/analytics.ts` exports `logEvent(userId, name, metadata?)` — fire-and-forget, swallows its own errors (never allowed to affect the app). Three events wired into `AppContext.tsx`:
- `signed_up` — once, at the "first sign-in, seed a row" branch.
- `app_opened` — once per session (a `useRef` guard, not per-navigation), enough to compute daily-active-user counts / retention without a "last seen" column.
- `all_three_logged` — fires from inside `logWin` only on the actual transition from incomplete to complete for that date (checked by comparing category-completeness before vs. after the write, not just "is it 3/3 now") — the app's actual definition of a successful day.
No select policy — nothing in the app reads this back. Query it directly via the Supabase SQL Editor (which runs as an admin role and bypasses RLS), e.g. `select name, count(*) from events group by name;` or a retention query joining `signed_up` timestamps against `app_opened` dates per user.
**Needs the `events` table created on the live project** — see the `create table if not exists events ...` block in `supabase/schema.sql`, not yet run against production as of this note.

### Multi-device write-conflict mitigation — new this session, partial by design
The real bug was worse than "two devices editing the same day at the same moment": every write did a blind whole-object `upsert` of the entire `days` blob, so a device syncing a stale local snapshot could silently erase days that only ever existed on another device — not just contested ones. A full CRDT-style fix was ruled out as more than warranted, and too risky to ship without being able to test complex merge SQL against the live database first (no Supabase CLI/local DB in this project — any SQL change has to be handed to the user to run untested by me). Shipped instead: a bounded, easy-to-reason-about Postgres function.
- `merge_app_data(...)` (`supabase/schema.sql`) — merges `days` and `checkins` key-by-key via jsonb `||` (a key present remotely but absent from the incoming payload survives; a key present in both takes the incoming value) instead of overwriting the whole object. `onboarding` and `bank` stay last-write-wins inside the function (bank is deliberately never merged — see the win-bank note above; conflicting bank edits are low-stakes).
- **Deliberately used for `logWin` only.** Every action that can delete data — `clearWin`, `clearDay`, `clearRange`, `resetPractice`, `restoreData` — keeps the plain overwrite (`AppContext`'s `update()` without `{ merge: true }`), unchanged from before. This is a real, load-bearing constraint, not an oversight: a jsonb `||` merge structurally cannot represent "remove this key" — a deleted day is just a day *absent* from the payload, which `||` reads as "no new information" and leaves untouched. Merging a delete would silently undo it. `AppContext`'s `update()` now takes an `options?: { merge?: boolean }` second argument; `retrySync()` replays the same mode via a `lastUpdateOptsRef` so a retried write doesn't fall back to overwrite semantics.
- Security note for anyone touching this later: `merge_app_data` deliberately has **no `security definer`** — it runs as the calling user, so the existing RLS insert/update policies on `app_data` (`auth.uid() = user_id`) apply exactly as if the client ran the SQL directly. Adding `security definer` later without also manually re-checking `p_user_id = auth.uid()` inside the function would let any authenticated user overwrite another user's row.
- **What this does not solve**: same-day-same-category edits from two devices within the same instant still resolve last-write-wins (inherent to any non-CRDT approach); a device's own in-memory view still only refreshes from the server once per sign-in (no realtime subscription or refetch-on-focus), so mid-session cross-device visibility is unchanged — this fix protects the *database* from silent data loss, it doesn't give a device live visibility into another device's edits during the same session.
- **Needs the `merge_app_data` function created on the live project** — same SQL block as the `events` table above, not yet run against production as of this note. Until it is, `logWin`'s merge-mode RPC call will fail with "function does not exist," caught by the existing sync-status error handling (shows "Couldn't sync" in Settings, no data corruption) rather than silently doing the wrong thing.

### Correction: History already had a pattern-insight feature — it just wasn't documented
An earlier "honest assessment" this session claimed the original spec's "one insight sentence generated from the pattern" was never built. That was wrong — `generateInsight()` in `src/routes/History.tsx` already implements it in full: weakest/strongest category over the last 30 days, worst day-of-week, alignment-rate thresholds, several phrased-sentence templates, rendered under a "Pattern" heading in the side panel. It was simply never mentioned in this handoff note, which is exactly how the Sunday-check-in confusion happened earlier too — **read the actual file before claiming something doesn't exist, not just this note.** Only real issue found in it: `generateInsight(...)` was being called twice per render (once for the `&&` check, once for the text) — fixed by computing it once into an `insight` variable. No new insight feature was built; none was needed.

### Accessibility pass — contrast + keyboard operability, this session
A real audit, not a guess: computed exact WCAG contrast ratios for every `white/NN` opacity value against this app's background (`#0f0f1a`). Result — **`white/45` is the actual breakeven for normal-text AA (4.5:1)**; `white/35` clears the relaxed 3:1 floor for large text/UI components but nothing lower does. The app used `/15` through `/40` extensively (labels, captions, muted body text) — all failing. Rule applied: bump anything conveying real information or forming an interactive control to a `/50` floor (with hover targets pushed to `/80` so hover stays *brighter* than the new base, not inverted); leave exactly one category exempt — **the small "TRIOVA" brand-wordmark eyebrow** (Login, Settings, LegalPage) and the "— Triova" italic signature on Today's day-one card, both defensible under WCAG's logo/brand-name carve-out. Screen-identifying eyebrows that happen to read "Triova" (the Score screen's own header, since the screen and the app share a name) were **not** exempted — they were bumped like "Today"/"History", since they're telling you which screen you're on, not just branding it.

Touched every route + `WinCard`/`NavBar`/`LegalPage`/`ErrorBoundary`. Two real bugs found along the way, not just low numbers:
- **`WinCard`'s skipped-state category label was doubly-dimmed** — `${accent.text} opacity-50` applied a second opacity multiplier on top of an already-computed accent color, dropping physical/mental/spiritual from a passing ~5:1 down to ~2:1. All three accent colors are barely-AA-compliant at full strength (spiritual is the tightest at 4.92:1) — there is no safe room to dim them further at all. Fixed by removing the multiplier entirely.
- **History's calendar cells were `<div onClick>`, not buttons** — not a contrast problem, a keyboard/screen-reader operability one: nothing made them focusable or activatable without a mouse. Converted all four day-state variants to real `<button type="button">` elements with a computed `aria-label` (e.g. "September 7 — one win logged") and `aria-current="date"` on today. Verified in-browser: cells are now real focusable buttons and clicking still opens the day editor exactly as before.

Also added: `aria-hidden="true"` on purely decorative icons that sit beside already-visible text (NavBar's four icons, the WinCard info/chevron icons, Login's logo and Google-button icon, ErrorBoundary's logo, History's share icon, and Score's two large constellation SVGs — the latter two are complex custom visualizations with no reasonable per-star text alternative, and their adjacent captions/stats already carry the meaningful summary in text); `aria-expanded` on the two disclosure buttons in `WinCard` (definition popover, "Previously" toggle); a clearer `aria-label` on the definition-popover trigger.

**Known, deliberate, not fixed**: the Triova/Score screen's star and cluster tap targets are still delegated-click SVG hit-testing (see the existing note on that screen below) — genuinely keyboard-inaccessible, and fixing it properly would mean the same kind of rearchitecting CLAUDE.md already documents as deliberately avoided once before (per-shape SVG hit targets were tried and reverted for being unreliable). Flagged as a real remaining gap, not silently left out.

### App Store / Play Store launch — decided, not yet started
Discussed but no code written yet. Decisions made, so a future session doesn't need to re-ask:
- **Both platforms** (iOS + Android), via **Capacitor** (wraps the existing Vite/React web app in a native project — no rewrite, since there's nothing native-only required beyond what already works).
- **No local Mac available** — iOS builds/signing need to happen in the cloud. Decided on **Codemagic** over a hand-rolled GitHub Actions + Fastlane pipeline, specifically because its guided code-signing flow matters more when neither the user nor Claude has a Mac to fall back on for troubleshooting.
- **Codemagic cost reality, confirmed against its own docs** (not assumed): the free tier's 500 min/month is **macOS-only** — iOS builds are genuinely free under that quota. Android builds run on Linux machines, which are **not** covered by the free minutes at all and require billing enabled ($0.045/min — a few cents per build for a solo project, but not literally free). No restriction on app-store submission from the free tier; no team-collaborator support on the individual plan (irrelevant, solo project).
- **Known, not-yet-scoped blocker for iOS specifically**: Apple requires offering "Sign in with Apple" if any other third-party social login is offered (Triova currently only has Google) — this is a real engineering task (Apple Services ID, Supabase Apple OAuth provider config, a new button/flow in `Login.tsx`), not paperwork, and Apple will reject the app without it. Not started.
- Also unstarted: Apple Developer Program enrollment ($99/yr), Google Play Developer account ($25 one-time), app icons at required sizes, store-listing screenshots/copy, and the actual `npx cap init`/`cap add ios`/`cap add android` scaffolding in this repo.
- Next concrete step, whenever this resumes: either start the Capacitor groundwork in the codebase (doesn't depend on any account approval), or write out the full phased checklist first — ask which.

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

### Known safety/compliance gaps
Addressed this session (see "Launch-readiness pass" above for detail): Privacy Policy + ToS now exist (`/privacy`, `/terms`); account/data deletion now works end-to-end (pending the manual RLS-policy + Vercel env var steps noted above); custom security headers added in `vercel.json`. Data export already existed (Settings → Export backup, JSON) and wasn't actually a gap — the old note here was wrong to lump it in with the PNG share-card.

Addressed this session: the accessibility/contrast pass (see dedicated section above) — contrast audited and fixed against real computed WCAG ratios, History's calendar made keyboard-operable. One deliberate exception remains open: the Triova/Score screen's star and cluster tap targets are still non-keyboard-operable delegated-click SVG hit-testing (see that screen's notes) — fixing it properly would require the kind of rearchitecture already tried and reverted once. Multi-device write conflicts also addressed (see dedicated section above) for the `logWin` path specifically — not fully solved for deletion actions, by design.

Still open, not yet addressed:
- **No error monitoring** (e.g. Sentry) or uptime check — a production bug is only discovered if a user reports it. Adding one means a new dependency; ask first per the Dependency Rule.
- **No automated tests, no CI** — zero test files, no GitHub Actions. Every push deploys straight to production. Not a launch blocker for a solo-maintained app, but the highest-leverage insurance once real users depend on uptime.
- No SEO/share metadata (no OG/Twitter tags, no meta description, no robots.txt/sitemap) — low priority unless the app starts being link-shared rather than installed directly.

### Known testing limitation (mobile emulation, still relevant)
The Browser-pane's **mobile touch emulation has been unreliable across sessions** — clicks (including on completely unrelated elements like nav `<Link>`s) can time out and the pane reports itself stuck/hidden. Don't trust a single mobile-emulated repro as proof of a real bug without also checking whether *anything* clicks in that tab; test via `preset: "desktop"` first as a sanity check, and prefer architectural fixes (e.g. delegate click handling to a big stable container, or use `onClick` instead of hover — done for both This Week's stars and now Universe's clusters) over chasing specific mobile-touch-event theories when the emulator itself is behaving oddly.

### Dev environment
- `npm run dev` → Vite on port 5173. `npm run build` → `tsc -b && vite build` (also serves as the type-check).
- Node at `C:\Program Files\nodejs\node.exe`; `.claude/launch.json` configured for the preview tool.
- To test authenticated screens without real Google sign-in, a temporary `?dev=1` bypass was added/removed from `src/App.tsx` (`authLoading`/`session` gate) during debugging sessions — **not currently in the code**, re-add-and-revert if needed rather than leaving it in.

### Pending / not yet done
- ~~No aggregate view of weekly check-in answers over time~~ — fixed this session, see "Vision-doc review, check-in pattern view, and daily push reminder" at the top of this doc. History now shows the full weekly check-in list plus an aggregate sentence at 4+ weeks.
- No reminder personalization beyond which categories are still open today — the daily push (see top of doc) always sends the same tone of message; no user-configurable send time, no "skip weekends," no digest options. Not asked for yet, just noting the current send logic is intentionally minimal.
- Basic PWA (installable, offline app-shell caching) **is built** — `public/manifest.json` + `public/sw.js`, registered from `src/main.tsx`. App Store/Play Store packaging (a native wrapper — Capacitor or similar) is explicitly deferred to a later phase, not started.
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
