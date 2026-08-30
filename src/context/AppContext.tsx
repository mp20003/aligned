import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AppData, OnboardingData } from '../types'

const STORAGE_KEY = 'three-wins-data'

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
// already birthed its star" as one-time flags in these two localStorage
// sets, so the animation only ever plays once per date. Nothing else in
// the app knows about them — so whenever days are wiped or cleared here,
// their flags have to be wiped too, or a date can stay "dead"/"born"
// forever even after its wins are deleted and relogged.
const DUST_KEY = 'triova-dusts'
const BORN_KEY = 'triova-born'

function clearDateFlags(predicate: (dateStr: string) => boolean) {
  for (const storageKey of [DUST_KEY, BORN_KEY]) {
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

type AppContextValue = {
  data: AppData
  session: Session | null
  authLoading: boolean
  completeOnboarding: (onboarding: OnboardingData) => void
  logWin: (date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => void
  clearDay: (date: string) => void
  clearRange: (startDate: string, endDate: string) => void
  updateSettings: (name: string, categories: AppData['onboarding']['categories']) => void
  resetPractice: () => void
  restoreData: (imported: AppData) => void
  signOut: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocal)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const dataRef = useRef(data)
  dataRef.current = data

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

  // Load remote data whenever a user signs in.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase
        .from('app_data')
        .select('onboarding, days')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to load app data', error)
        return
      }

      if (row) {
        const merged: AppData = { onboarding: row.onboarding, days: row.days }
        setData(merged)
        saveLocal(merged)
      } else {
        // First sign-in: seed a row from whatever's in local storage (or defaults).
        const seed = dataRef.current
        await supabase.from('app_data').insert({
          user_id: session.user.id,
          onboarding: seed.onboarding,
          days: seed.days,
        })
      }
    })()
    return () => { cancelled = true }
  }, [session])

  const update = useCallback((next: AppData) => {
    saveLocal(next)
    setData(next)
    if (session) {
      supabase
        .from('app_data')
        .upsert({ user_id: session.user.id, onboarding: next.onboarding, days: next.days })
        .then(({ error }) => {
          if (error) console.error('Failed to sync app data', error)
        })
    }
  }, [session])

  const completeOnboarding = useCallback((onboarding: OnboardingData) => {
    update({ ...dataRef.current, onboarding })
  }, [update])

  const logWin = useCallback((date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => {
    const current = dataRef.current
    const day = current.days[date] ?? { physical: null, mental: null, spiritual: null }
    // A date that previously exploded into dust (0 wins that day) can be
    // relogged later from History — clear its stale flag so Triova re-evaluates it.
    clearDateFlags(d => d === date)
    update({
      ...current,
      days: {
        ...current.days,
        [date]: { ...day, [category]: { text, completedAt: new Date().toISOString(), reflection } },
      },
    })
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
    update({ ...dataRef.current, days: {} })
  }, [update])

  const restoreData = useCallback((imported: AppData) => {
    // Imported days may not match this device's dust/born flags at all — drop them
    // so Triova re-evaluates every date fresh against the restored data.
    localStorage.removeItem(DUST_KEY)
    localStorage.removeItem(BORN_KEY)
    update(imported)
  }, [update])

  const signOut = useCallback(() => {
    supabase.auth.signOut()
    setData(defaultData)
    saveLocal(defaultData)
    localStorage.removeItem(DUST_KEY)
    localStorage.removeItem(BORN_KEY)
  }, [])

  return (
    <AppContext.Provider value={{ data, session, authLoading, completeOnboarding, logWin, clearDay, clearRange, updateSettings, resetPractice, restoreData, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
