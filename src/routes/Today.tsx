/**
 * Today
 *
 * The core daily loop. Shows a reflective prompt, then three win cards — one
 * per category — each with a text input and a confirm action. Suggestions
 * rotate by day of week so they feel fresh without requiring user interaction.
 * Once all three wins are confirmed, triggers a soft alignment moment and
 * reveals a "you're aligned today" state.
 *
 * Never shows a partial alignment score. Never allows editing a confirmed win
 * (immutable once set — this is a discipline app, not a notes app). Never
 * shows streaks or counts.
 *
 * Props: none. Reads category labels from AppContext onboarding data. Writes
 * wins via logWin(date, category, text).
 */

import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const REFLECTIVE_PROMPTS = [
  'What does your body need today?',
  'Where is your attention being pulled right now?',
  'What would make today feel complete?',
  'What are you carrying into today?',
  'What does it mean to show up well today?',
  'Which part of you needs the most care right now?',
  'What intention do you want to move with today?',
]

const SUGGESTIONS: Record<CategoryKey, string[]> = {
  physical: [
    'A walk without your phone',
    'Stretching for ten minutes',
    'Drinking water and sleeping well',
    'Moving until you feel warm',
    'Something that makes you breathe harder',
    'Time outside, whatever the weather',
    "Rest, if that's what your body needs",
  ],
  mental: [
    'Reading something you chose, not scrolled into',
    'Writing one honest thought down',
    "Learning one thing you didn't know yesterday",
    'Doing deep work without switching tabs',
    'A conversation that stretched your thinking',
    'Finishing something you started',
    'Sitting with a hard problem instead of avoiding it',
  ],
  spiritual: [
    'Five minutes of quiet, no input',
    "Noticing one thing you're grateful for",
    'Creating something with no audience in mind',
    'Doing something kind without being asked',
    'Being fully present in one conversation',
    'Reflecting on what actually matters this week',
    "Letting something go that you've been holding",
  ],
}

const CATEGORY_ACCENT: Record<CategoryKey, { text: string; border: string; bg: string; ring: string }> = {
  physical: {
    text: 'text-physical',
    border: 'border-physical',
    bg: 'bg-physical',
    ring: 'ring-physical',
  },
  mental: {
    text: 'text-mental',
    border: 'border-mental',
    bg: 'bg-mental',
    ring: 'ring-mental',
  },
  spiritual: {
    text: 'text-spiritual',
    border: 'border-spiritual',
    bg: 'bg-spiritual',
    ring: 'ring-spiritual',
  },
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function dayIndex() {
  return new Date().getDay() // 0–6
}

export default function Today() {
  const { data, logWin } = useApp()
  const date = todayKey()
  const day = dayIndex()
  const todayEntry = data.days[date] ?? { physical: null, mental: null, spiritual: null }
  const categories = data.onboarding.categories

  const prompt = REFLECTIVE_PROMPTS[day]

  const allDone =
    todayEntry.physical !== null &&
    todayEntry.mental !== null &&
    todayEntry.spiritual !== null

  const [aligned, setAligned] = useState(allDone)

  function handleWinLogged(justLogged: CategoryKey) {
    const others = (['physical', 'mental', 'spiritual'] as CategoryKey[]).filter(k => k !== justLogged)
    const nowAllDone = others.every(k => todayEntry[k] !== null)
    if (nowAllDone) {
      setTimeout(() => setAligned(true), 600)
    }
  }

  if (aligned) {
    return <AlignedState date={date} categories={categories} todayEntry={todayEntry} />
  }

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-16 flex flex-col gap-10">
      {/* Reflective prompt */}
      <div className="flex flex-col gap-1 pt-4">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Today</p>
        <h1 className="font-serif text-2xl text-charcoal leading-snug">{prompt}</h1>
      </div>

      {/* Win cards */}
      <div className="flex flex-col gap-5">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
          <WinCard
            key={key}
            categoryKey={key}
            label={categories[key].label}
            suggestion={SUGGESTIONS[key][day % SUGGESTIONS[key].length]}
            existing={todayEntry[key]}
            onConfirm={text => {
              logWin(date, key, text)
              handleWinLogged(key)
            }}
          />
        ))}
      </div>

      {/* How many done */}
      <WinsProgress todayEntry={todayEntry} />
    </div>
  )
}

// ── Win Card ──────────────────────────────────────────────────────────────────

type WinCardProps = {
  categoryKey: CategoryKey
  label: string
  suggestion: string
  existing: { text: string; completedAt: string } | null
  onConfirm: (text: string) => void
}

function WinCard({ categoryKey, label, suggestion, existing, onConfirm }: WinCardProps) {
  const [value, setValue] = useState('')
  const accent = CATEGORY_ACCENT[categoryKey]

  if (existing) {
    return (
      <div className={`rounded-2xl border ${accent.border} border-opacity-30 bg-white/40 px-5 py-4 flex flex-col gap-1`}>
        <div className="flex items-center justify-between">
          <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>{label}</span>
          <span className="text-charcoal/30 text-xs">✓</span>
        </div>
        <p className="font-serif text-base text-charcoal leading-snug">{existing.text}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/40 px-5 py-4 flex flex-col gap-3 shadow-sm">
      <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>{label}</span>

      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={suggestion}
        rows={2}
        maxLength={160}
        className="w-full bg-transparent font-serif text-base text-charcoal placeholder:text-charcoal/25 focus:outline-none resize-none leading-snug"
      />

      <div className="flex items-center justify-between">
        <p className="font-sans text-xs text-charcoal/30 italic">{suggestion}</p>
        <button
          onClick={() => { if (value.trim()) onConfirm(value.trim()) }}
          disabled={!value.trim()}
          className={`px-4 py-1.5 rounded-full font-sans text-xs transition-all duration-200 ${
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

// ── Progress indicator ────────────────────────────────────────────────────────

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
  todayEntry: { physical: { text: string } | null; mental: { text: string } | null; spiritual: { text: string } | null }
}

function AlignedState({ date, categories, todayEntry }: AlignedStateProps) {
  const [day, month, year] = [
    new Date(date + 'T12:00:00').getDate(),
    new Date(date + 'T12:00:00').toLocaleString('default', { month: 'long' }),
    new Date(date + 'T12:00:00').getFullYear(),
  ]

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 flex flex-col items-center justify-center gap-10">
      {/* Pulse ring */}
      <div
        className="animate-soft-pulse flex items-center justify-center w-24 h-24 rounded-full p-1"
        style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }}
      >
        <div className="w-full h-full rounded-full bg-beige flex items-center justify-center">
          <div className="w-10 h-10 rounded-full" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)', opacity: 0.4 }} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
          {month} {day}, {year}
        </p>
        <h2 className="font-serif text-3xl text-charcoal">You're aligned today.</h2>
        <p className="font-sans text-sm text-charcoal/50 max-w-xs leading-relaxed">
          You showed up for your body, your mind, and your{' '}
          {categories.spiritual.label.toLowerCase()} practice.
        </p>
      </div>

      {/* Summary */}
      <div className="w-full flex flex-col gap-3">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => {
          const win = todayEntry[key]
          if (!win) return null
          const accent = CATEGORY_ACCENT[key]
          return (
            <div key={key} className="flex gap-3 items-start">
              <span className={`font-sans text-xs uppercase tracking-widest ${accent.text} w-20 shrink-0 pt-0.5`}>
                {categories[key].label}
              </span>
              <p className="font-serif text-sm text-charcoal/70 leading-snug">{win.text}</p>
            </div>
          )
        })}
      </div>

    </div>
  )
}
