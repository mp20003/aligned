# Aligned — Product & Engineering Reference

---

## Current Build State (handoff note — updated at context limit)

### App name
**Aligned** — confirmed. GitHub repo: `https://github.com/mp20003/aligned`

### What is built and deployed (Vercel)
All four screens are complete and live:

| Screen | File | Status |
|---|---|---|
| Onboarding | `src/routes/Onboarding.tsx` | ✅ Complete |
| Today | `src/routes/Today.tsx` | ✅ Complete |
| History | `src/routes/History.tsx` | ✅ Complete |
| Pulse | `src/routes/Score.tsx` | ✅ Complete |

### Key decisions made (not in original brief)
- **App name:** Aligned
- **"Score" screen renamed to "Pulse"** — Pulse is also the name of the app's guiding entity
- **Pulse entity** — a non-human presence that guides the user. Introduced on the onboarding intro screen. Signs the weekly letter. Attribution shown on Today prompts ("— Pulse"). Not a character, not an AI — a presence.
- **Node.js path** — installed at `C:\Program Files\nodejs`. The `.claude/launch.json` uses the full path: `C:\\Program Files\\nodejs\\node.exe`
- **Routing:** React Router v7 (user confirmed)
- **Fonts:** Lora (serif) + Inter (sans-serif) via Google Fonts

### State shape (actual, as built)
```ts
type AppData = {
  onboarding: {
    completed: boolean
    name: string                          // user's name, asked on intro screen
    categories: Record<CategoryKey, { label: string; definition: string }>
  }
  days: Record<string, DayEntry>          // key: "YYYY-MM-DD"
}

type DayEntry = {
  physical:  WinEntry | null
  mental:    WinEntry | null
  spiritual: WinEntry | null
}

type WinEntry = {
  text: string
  completedAt: string    // ISO timestamp
  reflection?: string    // one word: Hard / Easy / Meaningful / Routine
}
```

### Today screen behaviour
- Reflective prompt built from user's category labels (e.g. "Where is your physical practice calling you today?"), attributed "— Pulse"
- Win cards show: daily-rotating suggestion chips (3 per category, curated list in Today.tsx), previous wins from history as chips, free text input
- After tapping Done: one-word reflection prompt (Hard / Easy / Meaningful / Routine)
- After all 3 wins: soft pulse animation → aligned state with stacked colour-bar cards
- Aligned state has "Edit today's wins" link to go back

### Pulse screen behaviour
- Three concentric SVG rings (Physical=outer, Mental=middle, Spiritual=inner)
- Each ring fills based on days logged / 7 for current week
- Rings breathe (expand/contract) at staggered rates — keyframe in `src/index.css`
- Static background track ring always visible so progress is clear
- 7-day dot grid per category below rings
- Weekly letter: personal, opens "Dear [name]," generated from pattern logic, signed "With you, Pulse"

### History screen behaviour
- 30-day grid, date numbers inside each cell circle
- Balanced = conic gradient (all three colours), Partial = muted, Missed = very light
- One insight sentence from pattern analysis
- No streaks, no percentages

### Onboarding screen behaviour
- Intro screen: Pulse introduction, breathing orb, "What should Pulse call you?" name field, Begin button
- 3 category steps: explanation, tappable example chips, definition textarea
- Spiritual step has label picker (Spiritual/Soulful/Intentional/Creative/custom)
- Navigates to Today on completion, never shown again

### Dev environment
- `npm run dev` starts Vite on port 5173
- `C:\Program Files\nodejs\node.exe` must be in PATH or used directly
- `.claude/launch.json` configured for preview tool

### Pending / next session ideas
- The `"You said: ..."` hint below the input on win cards may be redundant since definition is already the placeholder — consider removing
- Could add a name setting (allow user to change their name after onboarding)
- Claude API integration was mentioned in the brief as a future feature — not yet wired

---

## What This App Is

A mobile-first daily alignment app. The user logs one intentional win per day across three categories — Physical, Mental, and Spiritual. This is **not** a habit tracker. It is a discipline and mindfulness system built around balance, not streaks or productivity volume.

The unit of success is **alignment** (all three categories touched), not volume or frequency.

---

## Tech Stack

- **Framework:** Vite + React (TypeScript)
- **Styling:** Tailwind CSS with custom theme (see below)
- **Routing:** React Router v7
- **Persistence:** localStorage only — no backend
- **Fonts:** Lora (serif, headings) + Inter (sans-serif, UI) via Google Fonts
- **Deployment:** Vercel via GitHub

### Dependency Rule
Do not add a backend, authentication, or any third-party analytics. Do not install unnecessary dependencies. If unsure whether to add something, ask first.

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

## App Name (TBC)

Working title: **Three Wins**. Alternatives under consideration: Triad, Aligned, Still.

---

## State Shape (localStorage)

```ts
// Key: "three-wins-data"
type AppData = {
  onboarding: {
    completed: boolean;
    categories: {
      physical: { label: string; definition: string };
      mental:   { label: string; definition: string };
      spiritual: { label: string; definition: string };
    };
  };
  days: Record<string, DayEntry>; // key: "YYYY-MM-DD"
};

type DayEntry = {
  physical:  WinEntry | null;
  mental:    WinEntry | null;
  spiritual: WinEntry | null;
};

type WinEntry = {
  text: string;
  completedAt: string; // ISO timestamp
};
```
