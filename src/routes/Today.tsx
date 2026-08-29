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
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { getDailySuggestions, getPastWins } from '../data/suggestions'
import WinCard, { ACCENT } from '../components/WinCard'
import type { CategoryKey, WinEntry } from '../types'

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('default', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function Today() {
  const { data, logWin } = useApp()
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

  if (aligned) {
    return (
      <AlignedState
        date={date}
        categories={categories}
        todayEntry={entry}
        onEdit={() => setAligned(false)}
      />
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
      {/* Header */}
      <div className="flex items-start justify-between pt-4">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Today</p>
          <p className="font-sans text-xs lg:text-sm text-white/25">{formatDateLabel(date)}</p>
          <h1 className="font-serif text-2xl lg:text-4xl text-white leading-snug mt-1">
            What were your three wins today?
          </h1>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="mt-1 flex items-center gap-2 text-white/25 hover:text-white/55 transition-colors"
          aria-label="Settings"
        >
          <span className="hidden lg:inline font-sans text-sm">Settings</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lg:w-6 lg:h-6 shrink-0">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* First-day welcome */}
      {isFirstDay && (
        <div className="surface rounded-2xl px-5 lg:px-7 py-4 lg:py-5 flex flex-col gap-2">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Day one</p>
          <p className="font-serif text-sm lg:text-base text-white/60 leading-relaxed">
            This is where it begins. Three wins — one for each part of you. There's no right answer, only an honest one.
          </p>
          <p className="font-sans text-xs lg:text-sm text-white/25 italic">— Triova</p>
        </div>
      )}

      {/* Sunday check-in */}
      {isSunday && !sundayDone && (
        <div className="surface rounded-2xl px-5 lg:px-7 py-4 lg:py-5 flex flex-col gap-3">
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
            existing={entry[key]}
            pastWins={getPastWins(data.days, key, date)}
            dailySuggestions={getDailySuggestions(key, date)}
            onConfirm={(text, reflection) => {
              logWin(date, key, text, reflection)
              handleWinLogged(key)
            }}
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
          <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-full" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)', opacity: 0.4 }} />
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
