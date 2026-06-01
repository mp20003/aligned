/**
 * Onboarding
 *
 * Guides the user through defining what each of the three categories means to
 * them personally before they ever log a win. Each step shows an explanation
 * of the category, tappable example wins to inspire the definition, and a
 * free-text definition field. Stores labels and definitions in localStorage.
 *
 * Never skipped, never shown again after completion.
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

const STEP_META: Record<CategoryKey, {
  defaultLabel: string
  colour: string
  explanation: string
  examples: string[]
  placeholder: string
}> = {
  physical: {
    defaultLabel: 'Physical',
    colour: 'physical',
    explanation: 'Your physical win is about your relationship with your body — movement, rest, nourishment, or energy. It doesn\'t have to be intense. It just has to be intentional.',
    examples: [
      'A 20-minute walk',
      'Going to bed on time',
      'Cooking a proper meal',
      'A workout or stretch',
      'Drinking enough water',
      'Time outside',
    ],
    placeholder: 'e.g. Moving my body intentionally, even for 10 minutes.',
  },
  mental: {
    defaultLabel: 'Mental',
    colour: 'mental',
    explanation: 'Your mental win is about your mind — learning, focus, reflection, or creative output. One act of genuine engagement with your thinking.',
    examples: [
      'Reading for 30 minutes',
      'Deep focused work',
      'Writing one honest thought',
      'Learning something new',
      'Finishing something avoided',
      'Reflecting on a decision',
    ],
    placeholder: 'e.g. Reading or learning something that stretches my thinking.',
  },
  spiritual: {
    defaultLabel: 'Spiritual',
    colour: 'spiritual',
    explanation: 'This one is entirely yours to define. It might be stillness, creativity, connection, gratitude, or presence. Whatever fills you up.',
    examples: [
      '5 minutes of quiet',
      'Gratitude journaling',
      'Creating something',
      'Being fully present',
      'Time in nature',
      'Doing something kind',
    ],
    placeholder: 'e.g. Sitting quietly, creating something, or connecting with what matters.',
  },
}

const ACCENT_TEXT: Record<string, string> = {
  physical: 'text-physical',
  mental: 'text-mental',
  spiritual: 'text-spiritual',
}
const ACCENT_BG: Record<string, string> = {
  physical: 'bg-physical',
  mental: 'bg-mental',
  spiritual: 'bg-spiritual',
}
const ACCENT_BORDER: Record<string, string> = {
  physical: 'border-physical',
  mental: 'border-mental',
  spiritual: 'border-spiritual',
}

export default function Onboarding() {
  const { completeOnboarding, data } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (data.onboarding.completed) navigate('/today', { replace: true })
  }, [data.onboarding.completed, navigate])

  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<Record<CategoryKey, CategoryDraft>>({
    physical:  { label: 'Physical',  customLabel: '', definition: '' },
    mental:    { label: 'Mental',    customLabel: '', definition: '' },
    spiritual: { label: 'Spiritual', customLabel: '', definition: '' },
  })

  function updateDraft(key: CategoryKey, patch: Partial<CategoryDraft>) {
    setDrafts(d => ({ ...d, [key]: { ...d[key], ...patch } }))
  }

  function handleFinish() {
    completeOnboarding({
      completed: true,
      categories: {
        physical:  { label: drafts.physical.customLabel  || drafts.physical.label,  definition: drafts.physical.definition  },
        mental:    { label: drafts.mental.customLabel    || drafts.mental.label,    definition: drafts.mental.definition    },
        spiritual: { label: drafts.spiritual.customLabel || drafts.spiritual.label, definition: drafts.spiritual.definition },
      },
    })
  }

  // ── Intro ──
  if (step === 0) {
    return (
      <Screen>
        <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center gap-8">
          <div className="flex flex-col gap-3">
            <p className="font-sans text-sm uppercase tracking-widest text-charcoal/50">Aligned</p>
            <h1 className="font-serif text-4xl leading-tight text-charcoal">
              One win.<br />Three parts of you.<br />Every day.
            </h1>
          </div>
          <p className="font-sans text-base text-charcoal/60 max-w-xs leading-relaxed">
            Before you start, tell us what each category means to you. This takes two minutes and shapes everything that follows.
          </p>
          <button
            onClick={() => setStep(1)}
            className="mt-4 px-8 py-3 bg-charcoal text-beige font-sans text-sm rounded-full tracking-wide"
          >
            Begin
          </button>
        </div>
      </Screen>
    )
  }

  // ── Category steps ──
  if (step >= 1 && step <= 3) {
    const categoryKey = STEPS[step - 1]
    const meta = STEP_META[categoryKey]
    const draft = drafts[categoryKey]
    const isSpiritual = categoryKey === 'spiritual'
    const isLast = step === 3
    const accentText = ACCENT_TEXT[meta.colour]
    const accentBg = ACCENT_BG[meta.colour]
    const accentBorder = ACCENT_BORDER[meta.colour]
    const definitionOk = draft.definition.trim().length > 0

    return (
      <Screen>
        <div className="flex flex-col min-h-screen px-6 pt-14 pb-12 gap-6 overflow-y-auto">
          {/* Progress dots */}
          <div className="flex gap-2 justify-center">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < step - 1
                    ? `${accentBg} w-4`
                    : i === step - 1
                    ? `${accentBg} w-6`
                    : 'bg-charcoal/15 w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Header */}
          <div className="flex flex-col gap-1.5">
            <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
              Category {step} of 3
            </p>
            <h2 className={`font-serif text-3xl ${accentText}`}>
              {isSpiritual ? (draft.customLabel || draft.label) : meta.defaultLabel}
            </h2>
            <p className="font-sans text-sm text-charcoal/55 leading-relaxed">
              {meta.explanation}
            </p>
          </div>

          {/* Spiritual label picker */}
          {isSpiritual && (
            <div className="flex flex-col gap-2.5">
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

          {/* Examples */}
          <div className="flex flex-col gap-2.5">
            <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
              Examples — tap one to use it
            </p>
            <div className="flex flex-wrap gap-2">
              {meta.examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => updateDraft(categoryKey, { definition: ex })}
                  className={`px-3 py-1.5 rounded-full font-sans text-xs border transition-colors ${
                    draft.definition === ex
                      ? `${accentBg} text-white border-transparent`
                      : `border-charcoal/15 text-charcoal/60 bg-white/40`
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Definition input */}
          <div className="flex flex-col gap-2">
            <label className="font-sans text-xs uppercase tracking-widest text-charcoal/40">
              For me, a {isSpiritual ? (draft.customLabel || draft.label || 'Spiritual') : meta.defaultLabel} win means…
            </label>
            <textarea
              value={draft.definition}
              onChange={e => updateDraft(categoryKey, { definition: e.target.value })}
              placeholder={meta.placeholder}
              rows={2}
              className={`w-full bg-transparent border-b py-2 font-sans text-base text-charcoal placeholder:text-charcoal/30 focus:outline-none resize-none leading-relaxed transition-colors ${
                definitionOk ? accentBorder : 'border-charcoal/20'
              }`}
            />
            <p className="font-sans text-xs text-charcoal/30">One sentence is enough.</p>
          </div>

          <button
            onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
            disabled={!definitionOk}
            className={`w-full py-4 rounded-2xl font-sans text-sm tracking-wide transition-all duration-200 mt-auto ${
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
