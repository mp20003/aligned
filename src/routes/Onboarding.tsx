/**
 * Onboarding
 *
 * Guides the user through defining what each of the three categories means to
 * them personally before they ever log a win. Stores their definitions and
 * preferred labels in localStorage via AppContext, then navigates to Today.
 *
 * Never skipped, never shown again after completion. Never collects more than
 * a label choice and a one-sentence personal definition per category.
 *
 * Props: none (reads/writes via useApp context, navigates via React Router).
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const SPIRITUAL_OPTIONS = ['Spiritual', 'Soulful', 'Intentional', 'Creative']

type CategoryDraft = {
  label: string
  customLabel: string
  definition: string
}

const STEPS: CategoryKey[] = ['physical', 'mental', 'spiritual']

const STEP_META: Record<CategoryKey, { defaultLabel: string; colour: string; prompt: string; placeholder: string }> = {
  physical: {
    defaultLabel: 'Physical',
    colour: 'physical',
    prompt: 'Your body carries everything you do.',
    placeholder: 'e.g. Moving my body intentionally, even for 10 minutes.',
  },
  mental: {
    defaultLabel: 'Mental',
    colour: 'mental',
    prompt: 'Your mind shapes how you experience everything.',
    placeholder: 'e.g. Reading, learning, or doing deep focused work.',
  },
  spiritual: {
    defaultLabel: 'Spiritual',
    colour: 'spiritual',
    prompt: 'This one is yours to define.',
    placeholder: 'e.g. Sitting quietly, creating something, or connecting with what matters.',
  },
}

const ACCENT: Record<string, string> = {
  physical: 'text-physical border-physical',
  mental: 'text-mental border-mental',
  spiritual: 'text-spiritual border-spiritual',
}

const ACCENT_BG: Record<string, string> = {
  physical: 'bg-physical',
  mental: 'bg-mental',
  spiritual: 'bg-spiritual',
}

export default function Onboarding() {
  const { completeOnboarding, data } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (data.onboarding.completed) navigate('/today', { replace: true })
  }, [data.onboarding.completed, navigate])

  const [step, setStep] = useState(0) // 0 = intro, 1–3 = categories, 4 = done
  const [drafts, setDrafts] = useState<Record<CategoryKey, CategoryDraft>>({
    physical:  { label: 'Physical',  customLabel: '', definition: '' },
    mental:    { label: 'Mental',    customLabel: '', definition: '' },
    spiritual: { label: 'Spiritual', customLabel: '', definition: '' },
  })

  function updateDraft(key: CategoryKey, patch: Partial<CategoryDraft>) {
    setDrafts(d => ({ ...d, [key]: { ...d[key], ...patch } }))
  }

  function handleContinue() {
    setStep(s => s + 1)
  }

  function handleFinish() {
    completeOnboarding({
      completed: true,
      categories: {
        physical:  { label: drafts.physical.label  || drafts.physical.customLabel,  definition: drafts.physical.definition  },
        mental:    { label: drafts.mental.label    || drafts.mental.customLabel,    definition: drafts.mental.definition    },
        spiritual: { label: drafts.spiritual.label || drafts.spiritual.customLabel, definition: drafts.spiritual.definition },
      },
    })
    // navigation handled by useEffect watching data.onboarding.completed
  }

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <Screen>
        <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center gap-8">
          <div className="flex flex-col gap-3">
            <p className="font-sans text-sm uppercase tracking-widest text-charcoal/50">Three Wins</p>
            <h1 className="font-serif text-4xl leading-tight text-charcoal">
              One win.<br />Three parts of you.<br />Every day.
            </h1>
          </div>
          <p className="font-sans text-base text-charcoal/60 max-w-xs leading-relaxed">
            Before you start, tell us what each category means to you. This takes two minutes and shapes everything that follows.
          </p>
          <button
            onClick={handleContinue}
            className="mt-4 px-8 py-3 bg-charcoal text-beige font-sans text-sm rounded-full tracking-wide"
          >
            Begin
          </button>
        </div>
      </Screen>
    )
  }

  // ── Category steps (1–3) ──────────────────────────────────────────────────
  if (step >= 1 && step <= 3) {
    const categoryKey = STEPS[step - 1]
    const meta = STEP_META[categoryKey]
    const draft = drafts[categoryKey]
    const isSpiritual = categoryKey === 'spiritual'
    const isLast = step === 3
    const accentText = ACCENT[meta.colour]
    const accentBg = ACCENT_BG[meta.colour]
    const definitionOk = draft.definition.trim().length > 0

    return (
      <Screen>
        <div className="flex flex-col min-h-screen px-8 pt-16 pb-12 gap-8">
          {/* Progress dots */}
          <div className="flex gap-2 justify-center">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i < step - 1 ? accentBg : i === step - 1 ? `${accentBg} w-4` : 'bg-charcoal/20'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
              Category {step} of 3
            </p>
            <h2 className={`font-serif text-3xl ${accentText.split(' ')[0]}`}>
              {isSpiritual ? (draft.customLabel || draft.label) : meta.defaultLabel}
            </h2>
            <p className="font-sans text-sm text-charcoal/55 leading-relaxed">
              {meta.prompt}
            </p>
          </div>

          {/* Spiritual label picker */}
          {isSpiritual && (
            <div className="flex flex-col gap-3">
              <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
                What do you want to call this?
              </p>
              <div className="flex flex-wrap gap-2">
                {SPIRITUAL_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateDraft('spiritual', { label: opt, customLabel: '' })}
                    className={`px-4 py-2 rounded-full font-sans text-sm border transition-colors ${
                      draft.label === opt && !draft.customLabel
                        ? `${accentBg} text-white border-transparent`
                        : `bg-transparent border-charcoal/20 text-charcoal/70`
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={draft.customLabel}
                onChange={e => updateDraft('spiritual', { customLabel: e.target.value, label: '' })}
                placeholder="Or type your own…"
                className="w-full bg-transparent border-b border-charcoal/20 py-2 font-sans text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-spiritual"
              />
            </div>
          )}

          {/* Definition input */}
          <div className="flex flex-col gap-3 flex-1">
            <label className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
              For me, a {isSpiritual ? (draft.customLabel || draft.label || 'Spiritual') : meta.defaultLabel} win means…
            </label>
            <textarea
              value={draft.definition}
              onChange={e => updateDraft(categoryKey, { definition: e.target.value })}
              placeholder={meta.placeholder}
              rows={3}
              className="w-full bg-transparent border-b border-charcoal/20 py-2 font-sans text-base text-charcoal placeholder:text-charcoal/30 focus:outline-none resize-none leading-relaxed"
            />
            <p className="font-sans text-xs text-charcoal/30">One sentence is enough.</p>
          </div>

          <button
            onClick={isLast ? handleFinish : handleContinue}
            disabled={!definitionOk}
            className={`w-full py-4 rounded-2xl font-sans text-sm tracking-wide transition-all duration-200 ${
              definitionOk
                ? `${accentBg} text-white`
                : 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'
            }`}
          >
            {isLast ? 'Start my practice' : 'Next'}
          </button>
        </div>
      </Screen>
    )
  }

  return null
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto">
      {children}
    </div>
  )
}
