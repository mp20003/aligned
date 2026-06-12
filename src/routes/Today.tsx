/**
 * Today
 *
 * Core daily loop. Shows a personalised reflective prompt, then three win
 * cards. Each card offers daily-rotating suggestions, previous wins from
 * history, and a free-text input. After confirming a win, a one-word
 * reflection is captured. Once all three are confirmed, shows the alignment
 * state. The alignment state allows navigating back to edit wins.
 *
 * Never shows a partial score. Never shows streaks.
 *
 * Props: none. Reads/writes via AppContext.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import type { CategoryKey, WinEntry } from '../types'

// ── Curated suggestion lists ──────────────────────────────────────────────────

const SUGGESTIONS: Record<CategoryKey, string[]> = {
  physical: [
    'Walked before checking my phone',
    'Stretched for 10 minutes',
    'Drank 2 litres of water',
    'Got to bed before midnight',
    'Moved my body for 20 minutes',
    'Took the stairs',
    'Cooked a proper meal',
    'Spent 30 minutes outside',
    'Did a workout or exercise class',
    'Rested with no screens',
    'Went for a short run',
    'Did yoga or breathwork',
  ],
  mental: [
    'Read for 30 minutes',
    'Wrote one honest thought down',
    'Learned one new thing',
    'Did 90 minutes of focused work',
    'Listened to a podcast or lecture',
    'Finished something I had been avoiding',
    'Planned tomorrow the night before',
    'Reflected on a decision I made',
    'Had a conversation that challenged me',
    'Turned off notifications for 2 hours',
    'Wrote in a journal',
    'Worked through a hard problem',
  ],
  spiritual: [
    'Sat quietly for 5 minutes',
    'Wrote three things I am grateful for',
    'Created something with no audience',
    'Was fully present in one conversation',
    'Went for a walk without my phone',
    'Did something kind without being asked',
    'Reflected on what matters this week',
    'Let something go',
    'Spent time in nature',
    'Called someone I care about',
    'Meditated for 10 minutes',
    'Read something that inspired me',
  ],
}

const REFLECTION_WORDS = ['Hard', 'Easy', 'Meaningful', 'Routine']

// ── Daily reflective prompts ──────────────────────────────────────────────────

// Each template receives the label of one category (physical / mental / spiritual).
// Category cycles daily: day % 3 picks which one is referenced.
const PROMPT_TEMPLATES: Array<(label: string) => string> = [
  l => `Where is your ${l.toLowerCase()} practice calling you today?`,
  l => `What would a genuine ${l.toLowerCase()} win feel like today?`,
  l => `What does your ${l.toLowerCase()} need from you right now?`,
  l => `What ${l.toLowerCase()} act would feel most intentional today?`,
  l => `What's one honest step forward in your ${l.toLowerCase()} practice?`,
  l => `What would it mean to truly show up for your ${l.toLowerCase()} today?`,
  l => `How can you honour your ${l.toLowerCase()} practice today?`,
  l => `What ${l.toLowerCase()} choice would you be proud of tonight?`,
  l => `What does your ${l.toLowerCase()} practice need most from you this week?`,
]

function getDailyPrompt(
  categories: Record<CategoryKey, { label: string }>,
  dateStr: string
): string {
  const seed = dateSeed(dateStr)
  const categoryOrder: CategoryKey[] = ['physical', 'mental', 'spiritual']
  const key = categoryOrder[seed % 3]
  const label = categories[key].label
  const template = PROMPT_TEMPLATES[seed % PROMPT_TEMPLATES.length]
  return template(label)
}

const ACCENT: Record<CategoryKey, { text: string; border: string; bg: string; bar: string }> = {
  physical:  { text: 'text-physical',  border: 'border-physical',  bg: 'bg-physical',  bar: 'bg-physical'  },
  mental:    { text: 'text-mental',    border: 'border-mental',    bg: 'bg-mental',    bar: 'bg-mental'    },
  spiritual: { text: 'text-spiritual', border: 'border-spiritual', bg: 'bg-spiritual', bar: 'bg-spiritual' },
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function dateSeed(dateStr: string) {
  return dateStr.split('-').reduce((acc, n) => acc + parseInt(n), 0)
}

function getDailySuggestions(key: CategoryKey, dateStr: string): string[] {
  const list = SUGGESTIONS[key]
  const seed = dateSeed(dateStr)
  return [0, 1, 2].map(i => list[(seed + i) % list.length])
}


// ── Main screen ───────────────────────────────────────────────────────────────

export default function Today() {
  const { data, logWin } = useApp()
  const navigate = useNavigate()
  const date = todayKey()
  const todayEntry = data.days[date] ?? { physical: null, mental: null, spiritual: null }
  const categories = data.onboarding.categories

  const allDone =
    todayEntry.physical !== null &&
    todayEntry.mental !== null &&
    todayEntry.spiritual !== null

  const [aligned, setAligned] = useState(allDone)
  const [fading, setFading] = useState(false)

  function handleWinLogged(justLogged: CategoryKey) {
    const others = (['physical', 'mental', 'spiritual'] as CategoryKey[]).filter(k => k !== justLogged)
    if (others.every(k => todayEntry[k] !== null)) {
      setFading(true)
      setTimeout(() => setAligned(true), 500)
    }
  }

  if (aligned) {
    return (
      <AlignedState
        date={date}
        categories={categories}
        todayEntry={todayEntry}
        onEdit={() => setAligned(false)}
      />
    )
  }

  return (
    <div
      className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-28 flex flex-col gap-8"
      style={{
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
      }}
    >
      <div className="flex items-start justify-between pt-4">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Today</p>
          <h1 className="font-serif text-2xl text-charcoal leading-snug">{getDailyPrompt(categories, date)}</h1>
          <p className="font-sans text-xs text-charcoal/30 mt-1">— Triova</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="mt-1 text-charcoal/25 hover:text-charcoal/50 transition-colors"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
          <WinCard
            key={key}
            categoryKey={key}
            label={categories[key].label}
            date={date}
            existing={todayEntry[key]}
            pastWins={getPastWins(data.days, key, date)}
            dailySuggestions={getDailySuggestions(key, date)}
            onConfirm={(text, reflection) => {
              logWin(date, key, text, reflection)
              handleWinLogged(key)
            }}
          />
        ))}
      </div>

      <WinsProgress todayEntry={todayEntry} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPastWins(
  days: Record<string, { physical: { text: string } | null; mental: { text: string } | null; spiritual: { text: string } | null }>,
  key: CategoryKey,
  excludeDate: string
): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  const sorted = Object.keys(days).sort().reverse()
  for (const d of sorted) {
    if (d === excludeDate) continue
    const win = days[d][key]
    if (win && !seen.has(win.text)) {
      seen.add(win.text)
      results.push(win.text)
      if (results.length >= 4) break
    }
  }
  return results
}

// ── Win Card ──────────────────────────────────────────────────────────────────

type WinCardProps = {
  categoryKey: CategoryKey
  label: string
  date: string
  existing: WinEntry | null
  pastWins: string[]
  dailySuggestions: string[]
  onConfirm: (text: string, reflection: string) => void
}

function WinCard({ categoryKey, label, existing, pastWins, dailySuggestions, onConfirm }: WinCardProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(existing?.text ?? '')
  const [reflecting, setReflecting] = useState(false)
  const accent = ACCENT[categoryKey]

  function handleDone() {
    if (value.trim()) setReflecting(true)
  }

  function handleReflection(word: string) {
    onConfirm(value.trim(), word)
    setReflecting(false)
    setEditing(false)
  }

  // Confirmed state
  if (existing && !editing) {
    return (
      <div className={`rounded-2xl border ${accent.border} border-opacity-30 bg-white/40 px-5 py-4 flex flex-col gap-1`}>
        <div className="flex items-center justify-between">
          <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>{label}</span>
          <button
            onClick={() => { setValue(existing.text); setEditing(true); setReflecting(false) }}
            className="font-sans text-xs text-charcoal/30 underline underline-offset-2"
          >
            Edit
          </button>
        </div>
        <p className="font-serif text-base text-charcoal leading-snug">{existing.text}</p>
        {existing.reflection && (
          <p className="font-sans text-xs text-charcoal/30 mt-0.5">{existing.reflection}</p>
        )}
      </div>
    )
  }

  // Reflection state
  if (reflecting) {
    return (
      <div className="rounded-2xl bg-white/40 px-5 py-4 flex flex-col gap-4 shadow-sm">
        <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>{label}</span>
        <p className="font-serif text-sm text-charcoal/70 leading-snug">"{value}"</p>
        <div className="flex flex-col gap-2">
          <p className="font-sans text-xs text-charcoal/40 uppercase tracking-widest">How did it feel?</p>
          <div className="grid grid-cols-2 gap-2">
            {REFLECTION_WORDS.map(word => (
              <button
                key={word}
                onClick={() => handleReflection(word)}
                className="py-2.5 rounded-xl border border-charcoal/15 font-sans text-sm text-charcoal/70 bg-white/50 hover:bg-white/80 transition-colors"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Input state
  return (
    <div className="rounded-2xl bg-white/40 px-5 py-4 flex flex-col gap-3 shadow-sm">
      <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>{label}</span>

      {/* Daily suggestions */}
      <div className="flex flex-wrap gap-2">
        {dailySuggestions.map(s => (
          <button
            key={s}
            onClick={() => setValue(s)}
            className={`px-3 py-1.5 rounded-full font-sans text-xs border transition-colors ${
              value === s
                ? `${accent.bg} text-white border-transparent`
                : 'border-charcoal/15 text-charcoal/60 bg-white/50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Past wins */}
      {pastWins.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs text-charcoal/30 uppercase tracking-widest">Previously</p>
          <div className="flex flex-wrap gap-2">
            {pastWins.map(w => (
              <button
                key={w}
                onClick={() => setValue(w)}
                className={`px-3 py-1.5 rounded-full font-sans text-xs border transition-colors ${
                  value === w
                    ? `${accent.bg} text-white border-transparent`
                    : 'border-charcoal/15 text-charcoal/50 bg-white/30'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Free text */}
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Or write your own…"
        rows={2}
        maxLength={160}
        className="w-full bg-transparent font-serif text-base text-charcoal placeholder:text-charcoal/25 focus:outline-none resize-none leading-snug border-t border-charcoal/10 pt-3"
      />

      <div className="flex justify-end">
        <button
          onClick={handleDone}
          disabled={!value.trim()}
          className={`px-5 py-1.5 rounded-full font-sans text-xs transition-all duration-200 ${
            value.trim()
              ? `${accent.bg} text-white`
              : 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'
          }`}
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ── Progress ──────────────────────────────────────────────────────────────────

type DayEntry = { physical: unknown; mental: unknown; spiritual: unknown }

function WinsProgress({ todayEntry }: { todayEntry: DayEntry }) {
  const done = [todayEntry.physical, todayEntry.mental, todayEntry.spiritual].filter(Boolean).length
  if (done === 0) return null
  return (
    <p className="font-sans text-xs text-charcoal/35 text-center">
      {done === 1 && 'One win logged. Two more to align.'}
      {done === 2 && 'Two wins logged. One more to align.'}
    </p>
  )
}

// ── Aligned state ─────────────────────────────────────────────────────────────

type AlignedStateProps = {
  date: string
  categories: Record<CategoryKey, { label: string; definition: string }>
  todayEntry: { physical: WinEntry | null; mental: WinEntry | null; spiritual: WinEntry | null }
  onEdit: () => void
}

function AlignedState({ date, categories, todayEntry, onEdit }: AlignedStateProps) {
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('default', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 flex flex-col items-center justify-center gap-10 pb-28 animate-fade-up-in">
      <div
        className="animate-soft-pulse flex items-center justify-center w-24 h-24 rounded-full p-1"
        style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }}
      >
        <div className="w-full h-full rounded-full bg-beige flex items-center justify-center">
          <div className="w-10 h-10 rounded-full" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)', opacity: 0.4 }} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">{formatted}</p>
        <h2 className="font-serif text-3xl text-charcoal">You're aligned today.</h2>
        <p className="font-sans text-sm text-charcoal/50 max-w-xs leading-relaxed">
          You showed up for your {categories.physical.label.toLowerCase()},{' '}
          your {categories.mental.label.toLowerCase()}, and your{' '}
          {categories.spiritual.label.toLowerCase()} practice today.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => {
          const win = todayEntry[key]
          if (!win) return null
          return (
            <div key={key} className="flex rounded-2xl bg-white/50 overflow-hidden">
              <div className={`w-1 shrink-0 ${ACCENT[key].bar}`} />
              <div className="flex flex-col gap-0.5 px-4 py-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-sans text-xs uppercase tracking-widest ${ACCENT[key].text}`}>
                    {categories[key].label}
                  </span>
                  {win.reflection && (
                    <span className="font-sans text-xs text-charcoal/30">{win.reflection}</span>
                  )}
                </div>
                <p className="font-serif text-base text-charcoal leading-snug">{win.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={onEdit}
        className="font-sans text-xs text-charcoal/35 underline underline-offset-4"
      >
        Edit today's wins
      </button>
    </div>
  )
}
