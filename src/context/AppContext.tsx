import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/analytics'
import type { AppData, CategoryKey, OnboardingData } from '../types'

const STORAGE_KEY = 'three-wins-data'
const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

const defaultData: AppData = {
  onboarding: {
    completed: false,
    name: '',
    categories: {
      physical:  { label: 'Physical',  definition: '' },
      mental:    { label: 'Mental',    definition: '' },
      spiritual: { label: 'Spiritual', definition: '' },
    },
  },
  days: {},
  bank: { physical: [], mental: [], spiritual: [] },
  checkins: {},
}

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    return { ...defaultData, ...JSON.parse(raw) }
  } catch {
    return defaultData
  }
}

function saveLocal(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// The Triova screen tracks "has this date already exploded into dust /
// already birthed its star" as one-time flags in these localStorage sets,
// so the animation only ever plays once per date. Today also tracks "has
// the user already been asked about this missed date" the same way, so the
// prompt doesn't nag on every load. Nothing else in the app knows about
// them — so whenever days are wiped or cleared here, their flags have to be
// wiped too, or a date can stay "dead"/"born"/"already asked about" forever
// even after its wins are deleted and relogged.
const DUST_KEY = 'triova-dusts'
const BORN_KEY = 'triova-born'
const MISSED_PROMPT_KEY = 'triova-missed-prompted'

function clearDateFlags(predicate: (dateStr: string) => boolean) {
  for (const storageKey of [DUST_KEY, BORN_KEY, MISSED_PROMPT_KEY]) {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) continue
      const dates: string[] = JSON.parse(raw)
      const kept = dates.filter(d => !predicate(d))
      if (kept.length !== dates.length) localStorage.setItem(storageKey, JSON.stringify(kept))
    } catch {
      localStorage.removeItem(storageKey)
    }
  }
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline'

type AppContextValue = {
  data: AppData
  session: Session | null
  authLoading: boolean
  syncStatus: SyncStatus
  retrySync: () => void
  completeOnboarding: (onboarding: OnboardingData) => void
  logWin: (date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => void
  clearWin: (date: string, category: CategoryKey) => void
  clearDay: (date: string) => void
  clearRange: (startDate: string, endDate: string) => void
  updateSettings: (name: string, categories: AppData['onboarding']['categories']) => void
  resetPractice: () => void
  restoreData: (imported: AppData) => void
  signOut: () => void
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string }>
  addToBank: (category: CategoryKey, text: string) => void
  removeFromBank: (category: CategoryKey, text: string) => void
  recordWeeklyCheckin: (weekKey: string, category: CategoryKey) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocal)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const dataRef = useRef(data)
  dataRef.current = data
  const sessionRef = useRef(session)
  sessionRef.current = session
  const openedLoggedRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Once per session (not per render/navigation) — enough to compute daily-
  // active-user counts and retention without needing a "last seen" column.
  useEffect(() => {
    if (session && !openedLoggedRef.current) {
      openedLoggedRef.current = true
      logEvent(session.user.id, 'app_opened')
    }
  }, [session])

  // Load remote data whenever a user signs in.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase
        .from('app_data')
        .select('onboarding, days, bank, checkins')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to load app data', error)
        return
      }

      if (row) {
        const merged: AppData = {
          onboarding: row.onboarding,
          days: row.days,
          bank: row.bank ?? defaultData.bank,
          checkins: row.checkins ?? defaultData.checkins,
        }
        setData(merged)
        saveLocal(merged)
      } else {
        // First sign-in: seed a row from whatever's in local storage (or defaults).
        const seed = dataRef.current
        await supabase.from('app_data').insert({
          user_id: session.user.id,
          onboarding: seed.onboarding,
          days: seed.days,
          bank: seed.bank,
          checkins: seed.checkins,
        })
        logEvent(session.user.id, 'signed_up')
      }
    })()
    return () => { cancelled = true }
  }, [session])

  // options.merge picks the server-side jsonb-merge RPC instead of a plain
  // upsert — see merge_app_data in supabase/schema.sql for exactly what it
  // does and doesn't protect against. Only logWin uses it; every other
  // action keeps the plain overwrite since a merge can't represent deletion.
  const lastUpdateOptsRef = useRef<{ merge?: boolean }>({})

  const update = useCallback((next: AppData, options?: { merge?: boolean }) => {
    lastUpdateOptsRef.current = options ?? {}
    saveLocal(next)
    setData(next)
    if (session) {
      if (!navigator.onLine) {
        setSyncStatus('offline')
        return
      }
      setSyncStatus('syncing')
      const request = options?.merge
        ? supabase.rpc('merge_app_data', {
            p_user_id: session.user.id,
            p_onboarding: next.onboarding,
            p_days: next.days,
            p_bank: next.bank,
            p_checkins: next.checkins,
          })
        : supabase
            .from('app_data')
            .upsert({ user_id: session.user.id, onboarding: next.onboarding, days: next.days, bank: next.bank, checkins: next.checkins })
      request.then(({ error }) => {
        if (error) {
          console.error('Failed to sync app data', error)
          setSyncStatus('error')
        } else {
          setSyncStatus('synced')
        }
      })
    }
  }, [session])

  // Retry the most recent local state against Supabase — used after a failed
  // or offline sync. Re-running update() with the current data and the same
  // merge/overwrite mode is safe/idempotent since it's the same write the
  // last (unsynced) attempt already tried.
  const retrySync = useCallback(() => {
    if (!sessionRef.current) return
    update(dataRef.current, lastUpdateOptsRef.current)
  }, [update])

  // If a write failed or happened while offline, retry automatically the
  // moment the browser reports connectivity again, rather than leaving the
  // user's data silently unsynced until their next edit.
  useEffect(() => {
    function handleOnline() {
      if (syncStatus === 'error' || syncStatus === 'offline') retrySync()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncStatus, retrySync])

  const completeOnboarding = useCallback((onboarding: OnboardingData) => {
    update({ ...dataRef.current, onboarding })
  }, [update])

  const logWin = useCallback((date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => {
    const current = dataRef.current
    const day = current.days[date] ?? { physical: null, mental: null, spiritual: null }
    const wasComplete = CATEGORIES.every(k => day[k] !== null)
    const nextDay = { ...day, [category]: { text, completedAt: new Date().toISOString(), reflection } }
    const nowComplete = CATEGORIES.every(k => nextDay[k] !== null)
    // A date that previously exploded into dust (0 wins that day) can be
    // relogged later from History — clear its stale flag so Triova re-evaluates it.
    clearDateFlags(d => d === date)
    // merge: true — this is the frequent, high-stakes write (a device could
    // easily be syncing a stale local snapshot of unrelated days), so it goes
    // through the server-side jsonb merge instead of a blind overwrite.
    update({
      ...current,
      days: { ...current.days, [date]: nextDay },
    }, { merge: true })
    if (!wasComplete && nowComplete && sessionRef.current) {
      logEvent(sessionRef.current.user.id, 'all_three_logged', { date })
    }
  }, [update])

  const clearWin = useCallback((date: string, category: CategoryKey) => {
    const current = dataRef.current
    const day = current.days[date]
    if (!day || day[category] === null) return
    const nextDay = { ...day, [category]: null }
    const days = { ...current.days }
    if (CATEGORIES.every(k => nextDay[k] === null)) delete days[date]
    else days[date] = nextDay
    clearDateFlags(d => d === date)
    update({ ...current, days })
  }, [update])

  const clearDay = useCallback((date: string) => {
    const current = dataRef.current
    if (!(date in current.days)) return
    const days = { ...current.days }
    delete days[date]
    clearDateFlags(d => d === date)
    update({ ...current, days })
  }, [update])

  const clearRange = useCallback((startDate: string, endDate: string) => {
    const current = dataRef.current
    const days = { ...current.days }
    let changed = false
    for (const key of Object.keys(days)) {
      if (key >= startDate && key <= endDate) {
        delete days[key]
        changed = true
      }
    }
    clearDateFlags(d => d >= startDate && d <= endDate)
    if (changed) update({ ...current, days })
  }, [update])

  const updateSettings = useCallback((name: string, categories: AppData['onboarding']['categories']) => {
    update({ ...dataRef.current, onboarding: { ...dataRef.current.onboarding, name, categories } })
  }, [update])

  const resetPractice = useCallback(() => {
    localStorage.removeItem(DUST_KEY)
    localStorage.removeItem(BORN_KEY)
    localStorage.removeItem(MISSED_PROMPT_KEY)
    update({ ...dataRef.current, days: {}, checkins: {} })
  }, [update])

  const restoreData = useCallback((imported: AppData) => {
    // Imported days may not match this device's dust/born/prompted flags at
    // all — drop them so Triova re-evaluates every date fresh against the
    // restored data.
    localStorage.removeItem(DUST_KEY)
    localStorage.removeItem(BORN_KEY)
    localStorage.removeItem(MISSED_PROMPT_KEY)
    update({ ...imported, bank: imported.bank ?? defaultData.bank, checkins: imported.checkins ?? defaultData.checkins })
  }, [update])

  // Records the answer to the weekly "which felt hardest?" check-in, keyed
  // by that week's Monday so it's stable regardless of which day it's
  // actually answered on and lines up with how Score identifies weeks.
  const recordWeeklyCheckin = useCallback((weekKey: string, category: CategoryKey) => {
    const current = dataRef.current
    update({ ...current, checkins: { ...current.checkins, [weekKey]: category } })
  }, [update])

  const addToBank = useCallback((category: CategoryKey, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const current = dataRef.current
    const existing = current.bank[category] ?? []
    if (existing.includes(trimmed)) return
    update({ ...current, bank: { ...current.bank, [category]: [trimmed, ...existing] } })
  }, [update])

  const removeFromBank = useCallback((category: CategoryKey, text: string) => {
    const current = dataRef.current
    const existing = current.bank[category] ?? []
    update({ ...current, bank: { ...current.bank, [category]: existing.filter(w => w !== text) } })
  }, [update])

  const signOut = useCallback(() => {
    supabase.auth.signOut()
    setData(defaultData)
    saveLocal(defaultData)
    setSyncStatus('synced')
    localStorage.removeItem(DUST_KEY)
    localStorage.removeItem(BORN_KEY)
    localStorage.removeItem(MISSED_PROMPT_KEY)
  }, [])

  const deleteAccount = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const current = sessionRef.current
    if (!current) return { ok: false, error: 'Not signed in' }

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${current.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { ok: false, error: body.error ?? 'Failed to delete account' }
      }
    } catch {
      return { ok: false, error: 'Network error — check your connection and try again' }
    }

    // The account is gone server-side; clear everything locally too.
    signOut()
    return { ok: true }
  }, [signOut])

  return (
    <AppContext.Provider value={{ data, session, authLoading, syncStatus, retrySync, completeOnboarding, logWin, clearWin, clearDay, clearRange, updateSettings, resetPractice, restoreData, signOut, deleteAccount, addToBank, removeFromBank, recordWeeklyCheckin }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
