/**
 * Today
 *
 * Core daily loop. Three win cards — Physical, Mental, Spiritual.
 * Each card offers daily-rotating suggestions and free-text input.
 * After confirming a win, a one-word reflection is captured.
 * Once all three are confirmed, shows the aligned state.
 *
 * Never shows a partial score. Never shows streaks.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { getDailySuggestions, getPastWins } from '../data/suggestions'
import WinCard, { ACCENT } from '../components/WinCard'
import { dateKey } from '../lib/date'
import type { CategoryKey, WinEntry } from '../types'

// Same key AppContext clears on resetPractice/restoreData/signOut and on any
// date-level mutation — keep this string in sync with MISSED_PROMPT_KEY there.
const MISSED_PROMPT_KEY = 'triova-missed-prompted'

function getMissedPromptSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(MISSED_PROMPT_KEY) ?? '[]')) }
  catch { return new Set() }
}

function markMissedPrompted(dateStr: string) {
  const set = getMissedPromptSet()
  set.add(dateStr)
  localStorage.setItem(MISSED_PROMPT_KEY, JSON.stringify([...set]))
}

function todayKey() {
  return dateKey(new Date())
}

// Portaled straight to <body>: the page-transition wrapper around every
// route applies a persistent transform after its enter animation finishes,
// which per the CSS spec becomes the containing block for any
// position:fixed descendant — a plain fixed overlay here would render
// trapped behind the (also fixed) nav bar instead of above it.
function MissedDayModal({ dateStr, onFix, onDismiss }: { dateStr: string; onFix: () => void; onDismiss: () => void }) {
  const formatted = new Date(dateStr + 'T12:00:00').toLocaleDateString('default', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(5,5,12,0.88)' }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl px-6 py-6 flex flex-col gap-4"
        style={{ background: 'rgba(15,15,26,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs uppercase tracking-widest text-white/30">{formatted}</p>
          <h2 className="font-serif text-xl text-white">Yesterday's a blank.</h2>
        </div>
        <p className="font-sans text-sm text-white/50 leading-relaxed">
          No wins logged. If that's just how the day went, there's nothing to do here. But if you forgot to record it, you can still add it.
        </p>
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={onFix}
            className="w-full py-3 rounded-xl font-sans text-sm text-white btn-lift"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            I forgot, let me add it
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 font-sans text-xs text-white/30 hover:text-white/55 transition-colors"
          >
            That's how the day went
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('default', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function Today() {
  const { data, logWin, clearWin, addToBank, removeFromBank } = useApp()
  const navigate = useNavigate()

  const date = todayKey()
  const entry = data.days[date] ?? { physical: null, mental: null, spiritual: null }
  const categories = data.onboarding.categories
  const isFirstDay = Object.keys(data.days).length === 0

  const allDone = entry.physical !== null && entry.mental !== null && entry.spiritual !== null

  const isSunday = new Date().getDay() === 0
  const sundayCheckinKey = `triova-sunday-${date}`
  const [sundayDone, setSundayDone] = useState(() => !!localStorage.getItem(sundayCheckinKey))
  const [aligned, setAligned] = useState(allDone)
  const [fading, setFading] = useState(false)

  // If yesterday was completely missed and the user hasn't been asked about
  // it yet, offer a chance to fix it before its star quietly explodes on
  // the Triova page. Decided once per mount — a fresh load re-evaluates it.
  const [missedPrompt] = useState<string | null>(() => {
    if (Object.keys(data.days).length === 0) return null // brand new account, nothing to have missed
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yKey = dateKey(yesterday)
    const yEntry = data.days[yKey]
    const yWins = yEntry ? (['physical', 'mental', 'spiritual'] as CategoryKey[]).filter(k => yEntry[k] !== null).length : 0
    if (yWins > 0) return null
    return getMissedPromptSet().has(yKey) ? null : yKey
  })
  const [missedPromptOpen, setMissedPromptOpen] = useState(missedPrompt !== null)

  function handleDismissMissed() {
    if (missedPrompt) markMissedPrompted(missedPrompt)
    setMissedPromptOpen(false)
  }

  function handleFixMissed() {
    if (!missedPrompt) return
    markMissedPrompted(missedPrompt)
    navigate('/history', { state: { selectDate: missedPrompt } })
  }

  function handleWinLogged(justLogged: CategoryKey) {
    const others = (['physical', 'mental', 'spiritual'] as CategoryKey[]).filter(k => k !== justLogged)
    const currentEntry = data.days[date] ?? { physical: null, mental: null, spiritual: null }
    if (others.every(k => currentEntry[k] !== null)) {
      setFading(true)
      setTimeout(() => setAligned(true), 500)
    }
  }

  function handleSundayCheckin(key: CategoryKey) {
    localStorage.setItem(sundayCheckinKey, key)
    setSundayDone(true)
  }

  const missedModal = missedPrompt && missedPromptOpen && (
    <MissedDayModal dateStr={missedPrompt} onFix={handleFixMissed} onDismiss={handleDismissMissed} />
  )

  if (aligned) {
    return (
      <>
        {missedModal}
        <AlignedState
          date={date}
          categories={categories}
          todayEntry={entry}
          onEdit={() => setAligned(false)}
        />
      </>
    )
  }

  return (
    <div
      className="min-h-screen max-w-md lg:max-w-5xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-8 lg:gap-10"
      style={{
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
      }}
    >
      {missedModal}
      {/* Header */}
      <div className="flex flex-col gap-1 pt-4">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Today</p>
        <p className="font-sans text-xs lg:text-sm text-white/25">{formatDateLabel(date)}</p>
        <h1 className="font-serif text-2xl lg:text-4xl text-white leading-snug mt-1">
          What were your three wins today?
        </h1>
      </div>

      {/* First-day welcome */}
      {isFirstDay && (
        <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-2">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Day one</p>
          <p className="font-serif text-sm lg:text-base text-white/60 leading-relaxed">
            This is where it begins. Three wins — one for each part of you. There's no right answer, only an honest one.
          </p>
          <p className="font-sans text-xs lg:text-sm text-white/25 italic">— Triova</p>
        </div>
      )}

      {/* Sunday check-in */}
      {isSunday && !sundayDone && (
        <div className="surface rounded-2xl px-5 lg:px-6 py-4 lg:py-5 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">This week</p>
            <p className="font-serif text-sm lg:text-base text-white/60">Which part of you felt hardest to show up for?</p>
          </div>
          <div className="flex gap-2">
            {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
              <button
                key={key}
                onClick={() => handleSundayCheckin(key)}
                className="flex-1 py-2 lg:py-2.5 rounded-xl font-sans text-xs lg:text-sm text-white/50 hover:text-white/80 transition-all duration-150 btn-lift"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {categories[key].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Win cards */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
          <WinCard
            key={key}
            categoryKey={key}
            label={categories[key].label}
            definition={categories[key].definition}
            existing={entry[key]}
            pastWins={getPastWins(data.days, key, date)}
            dailySuggestions={getDailySuggestions(key, date)}
            bank={data.bank[key]}
            onConfirm={(text, reflection) => {
              logWin(date, key, text, reflection)
              handleWinLogged(key)
            }}
            onClear={() => clearWin(date, key)}
            onSaveToBank={text => addToBank(key, text)}
            onRemoveFromBank={text => removeFromBank(key, text)}
          />
        ))}
      </div>

      <WinsProgress todayEntry={entry} />
    </div>
  )
}

type DayEntry = { physical: unknown; mental: unknown; spiritual: unknown }

function WinsProgress({ todayEntry }: { todayEntry: DayEntry }) {
  const done = [todayEntry.physical, todayEntry.mental, todayEntry.spiritual].filter(Boolean).length
  if (done === 0) return null
  return (
    <p className="font-sans text-xs lg:text-sm text-white/25 text-center">
      {done === 1 && 'One win logged. Two more to align.'}
      {done === 2 && 'Two wins logged. One more to align.'}
    </p>
  )
}

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
    <div className="min-h-screen max-w-md lg:max-w-xl mx-auto px-6 flex flex-col items-center justify-center gap-10 lg:gap-12 pb-28 animate-fade-up-in">
      <div
        className="animate-soft-pulse flex items-center justify-center w-24 h-24 lg:w-32 lg:h-32 rounded-full p-1"
        style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }}
      >
        <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: '#0f0f1a' }}>
          <div className="relative w-10 h-10 lg:w-14 lg:h-14 rounded-full" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)', opacity: 0.9 }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0) 75%)' }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">{formatted}</p>
        <h2 className="font-serif text-3xl lg:text-4xl text-white">You're aligned today.</h2>
        <p className="font-sans text-sm lg:text-base text-white/45 max-w-xs lg:max-w-sm leading-relaxed">
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
            <div key={key} className="flex rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className={`w-1 shrink-0 ${ACCENT[key].bar}`} />
              <div className="flex flex-col gap-0.5 px-4 lg:px-5 py-3 lg:py-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest ${ACCENT[key].text}`}>
                    {categories[key].label}
                  </span>
                  {win.reflection && (
                    <span className="font-sans text-xs lg:text-sm text-white/25">{win.reflection}</span>
                  )}
                </div>
                <p className="font-serif text-base lg:text-lg text-white/90 leading-snug">{win.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={onEdit}
        className="font-sans text-xs lg:text-sm text-white/25 underline underline-offset-4 hover:text-white/45 transition-colors"
      >
        Edit today's wins
      </button>
    </div>
  )
}
