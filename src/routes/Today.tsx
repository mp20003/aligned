/**
 * Today
 *
 * The core daily loop. Shows a reflective prompt built from the user's own
 * category labels, then three win cards. Suggestions are drawn from the user's
 * onboarding definitions — their words, not generic ones. Confirmed wins can
 * be edited. Once all three are confirmed, shows the alignment state with
 * stacked colour-bar cards.
 *
 * Never shows a partial alignment score. Never shows streaks or counts.
 *
 * Props: none. Reads from AppContext. Writes via logWin(date, category, text).
 */

import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const CATEGORY_ACCENT: Record<CategoryKey, { text: string; border: string; bg: string; bar: string }> = {
  physical: { text: 'text-physical', border: 'border-physical', bg: 'bg-physical', bar: 'bg-physical' },
  mental:   { text: 'text-mental',   border: 'border-mental',   bg: 'bg-mental',   bar: 'bg-mental'   },
  spiritual:{ text: 'text-spiritual',border: 'border-spiritual',bg: 'bg-spiritual', bar: 'bg-spiritual'},
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function buildPrompts(labels: Record<CategoryKey, { label: string }>) {
  const p = labels.physical.label.toLowerCase()
  const m = labels.mental.label.toLowerCase()
  const s = labels.spiritual.label.toLowerCase()
  return [
    `What will your ${p}, ${m}, and ${s} look like today?`,
    `Where is your ${p} practice calling you today?`,
    `What does your ${m} need from you right now?`,
    `How will you honour your ${s} today?`,
    `Which of your three feels most neglected this week?`,
    `What small act could serve your ${p} today?`,
    `What would make today feel whole?`,
  ]
}

export default function Today() {
  const { data, logWin } = useApp()
  const date = todayKey()
  const day = new Date().getDay()
  const todayEntry = data.days[date] ?? { physical: null, mental: null, spiritual: null }
  const categories = data.onboarding.categories

  const prompts = buildPrompts(categories)
  const prompt = prompts[day % prompts.length]

  const allDone =
    todayEntry.physical !== null &&
    todayEntry.mental !== null &&
    todayEntry.spiritual !== null

  const [aligned, setAligned] = useState(allDone)

  function handleWinLogged(justLogged: CategoryKey) {
    const others = (['physical', 'mental', 'spiritual'] as CategoryKey[]).filter(k => k !== justLogged)
    if (others.every(k => todayEntry[k] !== null)) {
      setTimeout(() => setAligned(true), 600)
    }
  }

  if (aligned) {
    return <AlignedState date={date} categories={categories} todayEntry={todayEntry} />
  }

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-28 flex flex-col gap-10">
      <div className="flex flex-col gap-1 pt-4">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Today</p>
        <h1 className="font-serif text-2xl text-charcoal leading-snug">{prompt}</h1>
      </div>

      <div className="flex flex-col gap-5">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
          <WinCard
            key={key}
            categoryKey={key}
            label={categories[key].label}
            definition={categories[key].definition}
            existing={todayEntry[key]}
            onConfirm={text => {
              logWin(date, key, text)
              handleWinLogged(key)
            }}
          />
        ))}
      </div>

      <WinsProgress todayEntry={todayEntry} />
    </div>
  )
}

// ── Win Card ──────────────────────────────────────────────────────────────────

type WinCardProps = {
  categoryKey: CategoryKey
  label: string
  definition: string
  existing: { text: string; completedAt: string } | null
  onConfirm: (text: string) => void
}

function WinCard({ categoryKey, label, definition, existing, onConfirm }: WinCardProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(existing?.text ?? '')
  const accent = CATEGORY_ACCENT[categoryKey]

  if (existing && !editing) {
    return (
      <div className={`rounded-2xl border ${accent.border} border-opacity-30 bg-white/40 px-5 py-4 flex flex-col gap-1`}>
        <div className="flex items-center justify-between">
          <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>{label}</span>
          <button
            onClick={() => { setValue(existing.text); setEditing(true) }}
            className="font-sans text-xs text-charcoal/30 underline underline-offset-2"
          >
            Edit
          </button>
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
        placeholder={definition}
        rows={2}
        maxLength={160}
        className="w-full bg-transparent font-serif text-base text-charcoal placeholder:text-charcoal/25 focus:outline-none resize-none leading-snug"
      />

      <div className="flex items-center justify-between">
        <p className="font-sans text-xs text-charcoal/30 italic leading-snug max-w-[70%]">
          You said: "{definition}"
        </p>
        <button
          onClick={() => { if (value.trim()) { onConfirm(value.trim()); setEditing(false) } }}
          disabled={!value.trim()}
          className={`px-4 py-1.5 rounded-full font-sans text-xs transition-all duration-200 shrink-0 ${
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
  todayEntry: { physical: { text: string } | null; mental: { text: string } | null; spiritual: { text: string } | null }
}

function AlignedState({ date, categories, todayEntry }: AlignedStateProps) {
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('default', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 flex flex-col items-center justify-center gap-10 pb-28">
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
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">{formatted}</p>
        <h2 className="font-serif text-3xl text-charcoal">You're aligned today.</h2>
        <p className="font-sans text-sm text-charcoal/50 max-w-xs leading-relaxed">
          You showed up for your body, your mind, and your{' '}
          {categories.spiritual.label.toLowerCase()} practice.
        </p>
      </div>

      {/* Stacked colour-bar cards */}
      <div className="w-full flex flex-col gap-3">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => {
          const win = todayEntry[key]
          if (!win) return null
          const accent = CATEGORY_ACCENT[key]
          return (
            <div key={key} className="flex rounded-2xl bg-white/50 overflow-hidden">
              <div className={`w-1 shrink-0 ${accent.bar}`} />
              <div className="flex flex-col gap-0.5 px-4 py-3">
                <span className={`font-sans text-xs uppercase tracking-widest ${accent.text}`}>
                  {categories[key].label}
                </span>
                <p className="font-serif text-base text-charcoal leading-snug">{win.text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
