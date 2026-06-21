/**
 * Settings
 *
 * Allows the user to update their name, redefine category labels and
 * definitions, export their data as JSON, import a previously exported
 * backup, and reset their practice (clears all logged days, keeps
 * onboarding config).
 *
 * Never shown during onboarding. Accessible via gear icon on Today screen.
 *
 * Props: none. Reads/writes via AppContext, navigates via React Router.
 */

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import type { CategoryKey, AppData } from '../types'

const ACCENT_TEXT: Record<CategoryKey, string> = {
  physical: 'text-physical',
  mental: 'text-mental',
  spiritual: 'text-spiritual',
}
const ACCENT_BORDER: Record<CategoryKey, string> = {
  physical: 'border-physical',
  mental: 'border-mental',
  spiritual: 'border-spiritual',
}

export default function Settings() {
  const { data, updateSettings, resetPractice, restoreData } = useApp()
  const navigate = useNavigate()

  const [name, setName] = useState(data.onboarding.name)
  const [categories, setCategories] = useState({ ...data.onboarding.categories })
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  function updateCategory(key: CategoryKey, field: 'label' | 'definition', value: string) {
    setCategories(c => ({ ...c, [key]: { ...c[key], [field]: value } }))
    setSaved(false)
  }

  function handleSave() {
    updateSettings(name.trim(), categories)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleExport() {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `triova-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as AppData
        if (!imported.onboarding || !imported.days) throw new Error('Invalid file')
        restoreData(imported)
        navigate('/today')
      } catch {
        alert('That file doesn\'t look like a Triova backup.')
      }
    }
    reader.readAsText(file)
  }

  function handleReset() {
    resetPractice()
    setConfirmReset(false)
    navigate('/today')
  }

  const dayCount = Object.keys(data.days).length

  return (
    <div className="min-h-screen bg-beige max-w-md lg:max-w-xl mx-auto px-6 pt-12 pb-28 flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Triova</p>
          <h1 className="font-serif text-2xl text-charcoal">Settings</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="font-sans text-xs text-charcoal/40 underline underline-offset-4"
        >
          Done
        </button>
      </div>

      {/* Name */}
      <section className="flex flex-col gap-3">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Your name</p>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setSaved(false) }}
          className="w-full bg-transparent border-b border-charcoal/20 py-2 font-serif text-lg text-charcoal placeholder:text-charcoal/25 focus:outline-none focus:border-charcoal/50"
        />
      </section>

      {/* Categories */}
      <section className="flex flex-col gap-5">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Your categories</p>
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
          <div key={key} className="flex flex-col gap-2">
            <input
              type="text"
              value={categories[key].label}
              onChange={e => updateCategory(key, 'label', e.target.value)}
              className={`bg-transparent border-b py-1.5 font-sans text-sm font-medium focus:outline-none ${ACCENT_TEXT[key]} ${ACCENT_BORDER[key]} border-opacity-40`}
            />
            <textarea
              value={categories[key].definition}
              onChange={e => updateCategory(key, 'definition', e.target.value)}
              rows={2}
              className="w-full bg-white/40 rounded-xl px-3 py-2 font-sans text-sm text-charcoal/70 placeholder:text-charcoal/25 focus:outline-none resize-none leading-relaxed border border-charcoal/10 focus:border-charcoal/25"
            />
          </div>
        ))}
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`w-full py-3.5 rounded-2xl font-sans text-sm tracking-wide transition-all duration-200 ${
          saved ? 'bg-physical text-white' : 'bg-charcoal text-beige'
        }`}
      >
        {saved ? 'Saved' : 'Save changes'}
      </button>

      {/* Data */}
      <section className="flex flex-col gap-3 border-t border-charcoal/10 pt-6">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Your data</p>
        <p className="font-sans text-xs text-charcoal/40 leading-relaxed">
          {dayCount === 0
            ? 'No wins logged yet.'
            : `${dayCount} day${dayCount === 1 ? '' : 's'} logged. Export to keep a backup before switching devices.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 py-3 rounded-xl border border-charcoal/20 font-sans text-sm text-charcoal/70 bg-white/40 hover:bg-white/70 transition-colors"
          >
            Export backup
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex-1 py-3 rounded-xl border border-charcoal/20 font-sans text-sm text-charcoal/70 bg-white/40 hover:bg-white/70 transition-colors"
          >
            Import backup
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </section>

      {/* Reset */}
      <section className="flex flex-col gap-3 border-t border-charcoal/10 pt-6">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Reset</p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-3 rounded-xl border border-charcoal/15 font-sans text-sm text-charcoal/40 bg-transparent hover:border-charcoal/30 transition-colors"
          >
            Reset practice
          </button>
        ) : (
          <div className="flex flex-col gap-3 bg-white/50 rounded-2xl px-4 py-4">
            <p className="font-serif text-sm text-charcoal/70 leading-relaxed">
              This will delete all {dayCount} logged day{dayCount === 1 ? '' : 's'}. Your name and category definitions are kept. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl border border-charcoal/15 font-sans text-sm text-charcoal/50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-spiritual text-white font-sans text-sm"
              >
                Yes, reset
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
