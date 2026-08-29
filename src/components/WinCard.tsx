/**
 * WinCard
 *
 * A single category's win input/display for a given date. Shows daily
 * suggestion chips, past wins as chips, and a free-text field when empty;
 * shows the confirmed win with an edit option once logged. Captures a
 * one-word reflection on confirm.
 *
 * Used on Today (for the current day) and History (for any past day).
 *
 * Props: categoryKey, label, existing win, pastWins, dailySuggestions,
 * onConfirm callback.
 */

import { useState } from 'react'
import type { CategoryKey, WinEntry } from '../types'

export const ACCENT: Record<CategoryKey, { text: string; border: string; bg: string; bar: string }> = {
  physical:  { text: 'text-physical',  border: 'border-physical',  bg: 'bg-physical',  bar: 'bg-physical'  },
  mental:    { text: 'text-mental',    border: 'border-mental',    bg: 'bg-mental',    bar: 'bg-mental'    },
  spiritual: { text: 'text-spiritual', border: 'border-spiritual', bg: 'bg-spiritual', bar: 'bg-spiritual' },
}

const REFLECTION_WORDS = ['Hard', 'Easy', 'Meaningful', 'Routine']

type WinCardProps = {
  categoryKey: CategoryKey
  label: string
  existing: WinEntry | null
  pastWins: string[]
  dailySuggestions: string[]
  onConfirm: (text: string, reflection: string) => void
}

export default function WinCard({ categoryKey, label, existing, pastWins, dailySuggestions, onConfirm }: WinCardProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(existing?.text ?? '')
  const [reflecting, setReflecting] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const accent = ACCENT[categoryKey]

  function handleDone() {
    if (value.trim()) setReflecting(true)
  }

  function handleReflection(word: string) {
    onConfirm(value.trim(), word)
    setReflecting(false)
    setEditing(false)
  }

  // Skipped state — deliberately no win for this category
  if (skipped && !existing) {
    return (
      <div className="rounded-2xl border border-charcoal/10 bg-white/20 px-5 lg:px-6 py-4 lg:py-5 flex items-center justify-between">
        <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text} opacity-50`}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm lg:text-base text-charcoal/30 italic">No win today</span>
          <button
            onClick={() => setSkipped(false)}
            className="font-sans text-xs lg:text-sm text-charcoal/30 underline underline-offset-2"
          >
            Add one
          </button>
        </div>
      </div>
    )
  }

  // Confirmed state
  if (existing && !editing) {
    return (
      <div className={`rounded-2xl border ${accent.border} border-opacity-30 bg-white/40 px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-1`}>
        <div className="flex items-center justify-between">
          <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text}`}>{label}</span>
          <button
            onClick={() => { setValue(existing.text); setEditing(true); setReflecting(false) }}
            className="font-sans text-xs lg:text-sm text-charcoal/30 underline underline-offset-2"
          >
            Edit
          </button>
        </div>
        <p className="font-serif text-base lg:text-lg text-charcoal leading-snug">{existing.text}</p>
        {existing.reflection && (
          <p className="font-sans text-xs lg:text-sm text-charcoal/30 mt-0.5">{existing.reflection}</p>
        )}
      </div>
    )
  }

  // Reflection state
  if (reflecting) {
    return (
      <div className="rounded-2xl bg-white/40 px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-4 shadow-sm">
        <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text}`}>{label}</span>
        <p className="font-serif text-sm lg:text-base text-charcoal/70 leading-snug">"{value}"</p>
        <div className="flex flex-col gap-2">
          <p className="font-sans text-xs lg:text-sm text-charcoal/40 uppercase tracking-widest">How did it feel?</p>
          <div className="grid grid-cols-2 gap-2">
            {REFLECTION_WORDS.map(word => (
              <button
                key={word}
                onClick={() => handleReflection(word)}
                className="py-2.5 lg:py-3 rounded-xl border border-charcoal/15 font-sans text-sm lg:text-base text-charcoal/70 bg-white/50 hover:bg-white/90 hover:border-charcoal/25 hover:text-charcoal transition-all duration-150 btn-lift"
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
    <div className="rounded-2xl bg-white/40 px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-3 shadow-sm">
      <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text}`}>{label}</span>

      {/* Daily suggestions */}
      <div className="flex flex-wrap gap-2">
        {dailySuggestions.map(s => (
          <button
            key={s}
            onClick={() => setValue(s)}
            className={`px-3 py-1.5 rounded-full font-sans text-xs lg:text-sm border transition-all duration-150 chip-press ${
              value === s
                ? `${accent.bg} text-white border-transparent shadow-sm`
                : 'border-charcoal/15 text-charcoal/60 bg-white/50 hover:bg-white/80 hover:border-charcoal/25'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Past wins */}
      {pastWins.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs lg:text-sm text-charcoal/30 uppercase tracking-widest">Previously</p>
          <div className="flex flex-wrap gap-2">
            {pastWins.map(w => (
              <button
                key={w}
                onClick={() => setValue(w)}
                className={`px-3 py-1.5 rounded-full font-sans text-xs lg:text-sm border transition-all duration-150 chip-press ${
                  value === w
                    ? `${accent.bg} text-white border-transparent shadow-sm`
                    : 'border-charcoal/15 text-charcoal/50 bg-white/30 hover:bg-white/60 hover:border-charcoal/25'
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
        className="w-full bg-transparent font-serif text-base lg:text-lg text-charcoal placeholder:text-charcoal/25 focus:outline-none resize-none leading-snug border-t border-charcoal/10 pt-3"
      />

      <div className="flex justify-end items-center gap-4">
        {!value.trim() && (
          <button
            onClick={() => setSkipped(true)}
            className="font-sans text-xs lg:text-sm text-charcoal/30 underline underline-offset-2"
          >
            No win today
          </button>
        )}
        <button
          onClick={handleDone}
          disabled={!value.trim()}
          className={`px-5 lg:px-6 py-1.5 lg:py-2 rounded-full font-sans text-xs lg:text-sm transition-all duration-150 ${
            value.trim()
              ? `${accent.bg} text-white btn-lift`
              : 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'
          }`}
        >
          Done
        </button>
      </div>
    </div>
  )
}
