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
 * Never shows streaks or counts. Never forces all three wins.
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
  const [confirmFlash, setConfirmFlash] = useState(false)
  const accent = ACCENT[categoryKey]

  function handleDone() {
    if (value.trim()) setReflecting(true)
  }

  function handleReflection(word: string) {
    setConfirmFlash(true)
    setTimeout(() => setConfirmFlash(false), 500)
    onConfirm(value.trim(), word)
    setReflecting(false)
    setEditing(false)
  }

  if (skipped && !existing) {
    return (
      <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex items-center justify-between transition-all duration-200">
        <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text} opacity-50`}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm lg:text-base text-white/25 italic">No win today</span>
          <button
            onClick={() => setSkipped(false)}
            className="font-sans text-xs lg:text-sm text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
          >
            Add one
          </button>
        </div>
      </div>
    )
  }

  if (existing && !editing) {
    return (
      <div className={`rounded-2xl border px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-1 transition-all duration-300 ${confirmFlash ? 'confirm-ring' : ''}`}
        style={{ borderColor: `${accent.border.replace('border-', '')}40`, background: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text}`}>{label}</span>
          <button
            onClick={() => { setValue(existing.text); setEditing(true); setReflecting(false) }}
            className="font-sans text-xs lg:text-sm text-white/25 underline underline-offset-2 hover:text-white/50 transition-colors"
          >
            Edit
          </button>
        </div>
        <p className="font-serif text-base lg:text-lg text-white/90 leading-snug">{existing.text}</p>
        {existing.reflection && (
          <p className="font-sans text-xs lg:text-sm text-white/25 mt-0.5">{existing.reflection}</p>
        )}
      </div>
    )
  }

  if (reflecting) {
    return (
      <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-4">
        <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text}`}>{label}</span>
        <p className="font-serif text-sm lg:text-base text-white/50 leading-snug">"{value}"</p>
        <div className="flex flex-col gap-2">
          <p className="font-sans text-xs lg:text-sm text-white/25 uppercase tracking-widest">How did it feel?</p>
          <div className="grid grid-cols-2 gap-2">
            {REFLECTION_WORDS.map(word => (
              <button
                key={word}
                onClick={() => handleReflection(word)}
                className="py-2.5 lg:py-3 rounded-xl font-sans text-sm lg:text-base text-white/70 transition-all duration-150 btn-lift hover:text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-3">
      <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accent.text}`}>{label}</span>

      {/* Daily suggestions */}
      <div className="flex flex-wrap gap-2">
        {dailySuggestions.map(s => (
          <button
            key={s}
            onClick={() => setValue(s)}
            className={`px-3 py-1.5 rounded-full font-sans text-xs lg:text-sm transition-all duration-150 chip-press ${
              value === s
                ? `${accent.bg} text-white border-transparent shadow-sm`
                : 'text-white/50 hover:text-white/80'
            }`}
            style={value === s ? {} : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Past wins */}
      {pastWins.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs lg:text-sm text-white/20 uppercase tracking-widest">Previously</p>
          <div className="flex flex-wrap gap-2">
            {pastWins.map(w => (
              <button
                key={w}
                onClick={() => setValue(w)}
                className={`px-3 py-1.5 rounded-full font-sans text-xs lg:text-sm transition-all duration-150 chip-press ${
                  value === w
                    ? `${accent.bg} text-white border-transparent shadow-sm`
                    : 'text-white/40 hover:text-white/70'
                }`}
                style={value === w ? {} : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
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
        className="w-full bg-transparent font-serif text-base lg:text-lg text-white/90 focus:outline-none resize-none leading-snug pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      />

      <div className="flex justify-end items-center gap-4">
        {!value.trim() && (
          <button
            onClick={() => setSkipped(true)}
            className="font-sans text-xs lg:text-sm text-white/25 underline underline-offset-2 hover:text-white/45 transition-colors"
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
              : 'text-white/20 cursor-not-allowed'
          }`}
          style={value.trim() ? {} : { background: 'rgba(255,255,255,0.06)' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
