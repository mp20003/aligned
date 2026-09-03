/**
 * WinCard
 *
 * A single category's win input/display for a given date. Shows a labelled
 * example, a personal "bank" of saved reusable wins, past wins as chips, and
 * a free-text field when empty; shows the confirmed win with an edit option
 * once logged. Captures a one-word reflection on confirm. Tapping the
 * category label reveals the user's own onboarding definition of it.
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

// Tappable category label — shows the user's own onboarding definition of
// this category on tap (not hover — mobile-first). Tap again, or the Close
// button, to dismiss.
function CategoryLabel({ label, definition, accentText }: { label: string; definition: string; accentText: string }) {
  const [open, setOpen] = useState(false)

  if (!definition) {
    return <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${accentText}`}>{label}</span>
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 font-sans text-xs lg:text-sm uppercase tracking-widest ${accentText}`}
      >
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50 shrink-0">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4.5M12 8h.01" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute z-30 top-full left-0 mt-2 w-64 max-w-[75vw] rounded-xl px-4 py-3 flex flex-col gap-2"
          style={{ background: 'rgba(15,15,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
        >
          <p className="font-serif text-sm text-white/80 leading-relaxed">{definition}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="self-start font-sans text-xs text-white/30 underline underline-offset-2 hover:text-white/55 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

type WinCardProps = {
  categoryKey: CategoryKey
  label: string
  definition: string
  existing: WinEntry | null
  pastWins: string[]
  dailySuggestions: string[]
  bank: string[]
  onConfirm: (text: string, reflection: string) => void
  onClear?: () => void
  onSaveToBank: (text: string) => void
  onRemoveFromBank: (text: string) => void
}

export default function WinCard({
  categoryKey, label, definition, existing, pastWins, dailySuggestions, bank,
  onConfirm, onClear, onSaveToBank, onRemoveFromBank,
}: WinCardProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(existing?.text ?? '')
  const [reflecting, setReflecting] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [confirmFlash, setConfirmFlash] = useState(false)
  const [previouslyOpen, setPreviouslyOpen] = useState(false)
  const accent = ACCENT[categoryKey]
  const trimmedValue = value.trim()

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

  function handleNoWinToday() {
    onClear?.()
    setValue('')
    setSkipped(true)
    setEditing(false)
  }

  if (skipped && !existing) {
    return (
      <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex items-center justify-between transition-all duration-200">
        <CategoryLabel label={label} definition={definition} accentText={`${accent.text} opacity-50`} />
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
          <CategoryLabel label={label} definition={definition} accentText={accent.text} />
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
        <CategoryLabel label={label} definition={definition} accentText={accent.text} />
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
    <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-3 h-full">
      <CategoryLabel label={label} definition={definition} accentText={accent.text} />

      {/* Example */}
      {dailySuggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs lg:text-sm text-white/20 uppercase tracking-widest">Example</p>
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
        </div>
      )}

      {/* Your bank — wins the user has explicitly saved for reuse */}
      {bank.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-xs lg:text-sm text-white/20 uppercase tracking-widest">Your bank</p>
          <div className="flex flex-wrap gap-2">
            {bank.map(w => (
              <span
                key={w}
                className={`inline-flex items-center rounded-full transition-all duration-150 ${value === w ? `${accent.bg} shadow-sm` : ''}`}
                style={value === w ? {} : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  type="button"
                  onClick={() => setValue(w)}
                  className={`pl-3 pr-1.5 py-1.5 font-sans text-xs lg:text-sm rounded-l-full chip-press ${
                    value === w ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {w}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFromBank(w)}
                  aria-label={`Remove "${w}" from bank`}
                  className={`pr-3 pl-1 py-1.5 rounded-r-full font-sans text-xs lg:text-sm ${
                    value === w ? 'text-white/70 hover:text-white' : 'text-white/25 hover:text-white/60'
                  }`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Past wins — collapsed by default so a long history doesn't bunch
          the card up; opens into the same chip list as before. */}
      {pastWins.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setPreviouslyOpen(v => !v)}
            className="flex items-center gap-1.5 font-sans text-xs lg:text-sm text-white/20 uppercase tracking-widest hover:text-white/40 transition-colors"
          >
            <span>Previously ({pastWins.length})</span>
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={`shrink-0 transition-transform duration-150 ${previouslyOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {previouslyOpen && (
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
          )}
        </div>
      )}

      {/* Absorbs whatever extra height this card was stretched to (to match
          its taller siblings in the row), so the textarea + button row below
          docks to the same bottom edge on every category's card instead of
          floating right under whatever variable content is above it. */}
      <div className="flex-1" />

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

      <div className="flex flex-wrap justify-end items-center gap-x-4 gap-y-2">
        {(editing || !trimmedValue) && (
          <button
            onClick={handleNoWinToday}
            className="font-sans text-xs lg:text-sm text-white/25 underline underline-offset-2 hover:text-white/45 transition-colors"
          >
            No win today
          </button>
        )}
        {trimmedValue && !bank.includes(trimmedValue) && (
          <button
            onClick={() => onSaveToBank(trimmedValue)}
            className="font-sans text-xs lg:text-sm text-white/30 underline underline-offset-2 hover:text-white/55 transition-colors"
          >
            Save to bank
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
