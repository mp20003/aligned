/**
 * Settings
 *
 * Name, category labels/definitions, export/import, reset, sign out.
 * Never shown during onboarding.
 */

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../context/AppContext'
import { dateKey } from '../lib/date'
import type { CategoryKey, AppData } from '../types'

const ACCENT_TEXT: Record<CategoryKey, string> = {
  physical: 'text-physical',
  mental: 'text-mental',
  spiritual: 'text-spiritual',
}

function monthRange(monthStr: string): [string, string] {
  const [y, m] = monthStr.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return [`${monthStr}-01`, `${monthStr}-${String(lastDay).padStart(2, '0')}`]
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Settings() {
  const { data, updateSettings, resetPractice, clearRange, restoreData, signOut } = useApp()
  const navigate = useNavigate()

  const [name, setName] = useState(data.onboarding.name)
  const [categories, setCategories] = useState({ ...data.onboarding.categories })
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [clearMonth, setClearMonth] = useState('')
  const [confirmClearMonth, setConfirmClearMonth] = useState(false)
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
    a.download = `triova-backup-${dateKey(new Date())}.json`
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
        alert("That file doesn't look like a Triova backup.")
      }
    }
    reader.readAsText(file)
  }

  function handleReset() {
    resetPractice()
    setConfirmReset(false)
    navigate('/today')
  }

  function handleClearMonth() {
    if (!clearMonth) return
    const [start, end] = monthRange(clearMonth)
    clearRange(start, end)
    setConfirmClearMonth(false)
    setClearMonth('')
  }

  const dayCount = Object.keys(data.days).length

  const divider = { borderTop: '1px solid rgba(255,255,255,0.08)' }
  const surfaceBtn = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen max-w-md lg:max-w-2xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-8 lg:gap-10">

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Triova</p>
          <h1 className="font-serif text-2xl lg:text-4xl text-white">Settings</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="font-sans text-xs lg:text-sm text-white/30 underline underline-offset-4 hover:text-white/55 transition-colors"
        >
          Done
        </button>
      </div>

      {/* Name */}
      <section className="flex flex-col gap-3">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Your name</p>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setSaved(false) }}
          className="w-full bg-transparent py-2 font-serif text-lg lg:text-xl text-white/90 focus:outline-none"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}
        />
      </section>

      {/* Categories */}
      <section className="flex flex-col gap-5 lg:gap-6">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Your categories</p>
        {(['physical', 'mental', 'spiritual'] as CategoryKey[]).map(key => (
          <div key={key} className="flex flex-col gap-2">
            <input
              type="text"
              value={categories[key].label}
              onChange={e => updateCategory(key, 'label', e.target.value)}
              className={`bg-transparent py-1.5 font-sans text-sm lg:text-base font-medium focus:outline-none ${ACCENT_TEXT[key]}`}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}
            />
            <textarea
              value={categories[key].definition}
              onChange={e => updateCategory(key, 'definition', e.target.value)}
              rows={2}
              className="w-full rounded-xl px-3 py-2 font-sans text-sm lg:text-base text-white/55 focus:outline-none resize-none leading-relaxed"
              style={surfaceBtn}
            />
          </div>
        ))}
      </section>

      <button
        onClick={handleSave}
        className={`w-full py-3.5 lg:py-4 rounded-2xl font-sans text-sm lg:text-base tracking-wide transition-all duration-200 btn-lift ${
          saved ? 'bg-physical text-white' : 'text-white'
        }`}
        style={saved ? {} : { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        {saved ? 'Saved' : 'Save changes'}
      </button>

      {/* Data */}
      <section className="flex flex-col gap-3 pt-6" style={divider}>
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Your data</p>
        <p className="font-sans text-xs lg:text-sm text-white/30 leading-relaxed">
          {dayCount === 0
            ? 'No wins logged yet.'
            : `${dayCount} day${dayCount === 1 ? '' : 's'} logged. Export to keep a backup.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 py-3 lg:py-3.5 rounded-xl font-sans text-sm lg:text-base text-white/55 hover:text-white/80 transition-colors"
            style={surfaceBtn}
          >
            Export backup
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex-1 py-3 lg:py-3.5 rounded-xl font-sans text-sm lg:text-base text-white/55 hover:text-white/80 transition-colors"
            style={surfaceBtn}
          >
            Import backup
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </section>

      {/* Clear a month */}
      <section className="flex flex-col gap-3 pt-6" style={divider}>
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Clear a month</p>
        <p className="font-sans text-xs lg:text-sm text-white/30 leading-relaxed">
          Remove every win logged in one month — useful for wiping out test data or a month you'd rather not keep.
        </p>
        <div className="flex gap-3">
          <input
            type="month"
            value={clearMonth}
            onChange={e => { setClearMonth(e.target.value); setConfirmClearMonth(false) }}
            className="flex-1 rounded-xl px-3 py-3 lg:py-3.5 font-sans text-sm lg:text-base text-white/70 focus:outline-none"
            style={surfaceBtn}
          />
          {!confirmClearMonth ? (
            <button
              onClick={() => clearMonth && setConfirmClearMonth(true)}
              disabled={!clearMonth}
              className="px-5 py-3 lg:py-3.5 rounded-xl font-sans text-sm lg:text-base text-white/55 hover:text-white/80 transition-colors disabled:opacity-30 disabled:hover:text-white/55"
              style={surfaceBtn}
            >
              Clear
            </button>
          ) : null}
        </div>
        {confirmClearMonth && (
          <div className="flex flex-col gap-3 rounded-2xl px-4 py-4" style={surfaceBtn}>
            <p className="font-serif text-sm lg:text-base text-white/55 leading-relaxed">
              This will delete every win logged in {monthLabel(clearMonth)}. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClearMonth(false)}
                className="flex-1 py-2.5 lg:py-3 rounded-xl font-sans text-sm lg:text-base text-white/40"
                style={surfaceBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleClearMonth}
                className="flex-1 py-2.5 lg:py-3 rounded-xl bg-spiritual text-white font-sans text-sm lg:text-base"
              >
                Yes, clear it
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Reset */}
      <section className="flex flex-col gap-3 pt-6" style={divider}>
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Reset</p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-3 lg:py-3.5 rounded-xl font-sans text-sm lg:text-base text-white/30 hover:text-white/50 transition-colors"
            style={surfaceBtn}
          >
            Reset practice
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl px-4 py-4" style={surfaceBtn}>
            <p className="font-serif text-sm lg:text-base text-white/55 leading-relaxed">
              This will delete all {dayCount} logged day{dayCount === 1 ? '' : 's'}. Your name and categories are kept. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 lg:py-3 rounded-xl font-sans text-sm lg:text-base text-white/40"
                style={surfaceBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 lg:py-3 rounded-xl bg-spiritual text-white font-sans text-sm lg:text-base"
              >
                Yes, reset
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sign out */}
      <section className="flex flex-col gap-3 pt-6" style={divider}>
        <button
          onClick={signOut}
          className="w-full py-3 lg:py-3.5 rounded-xl font-sans text-sm lg:text-base text-white/30 hover:text-white/50 transition-colors"
          style={surfaceBtn}
        >
          Sign out
        </button>
      </section>

    </div>
  )
}
