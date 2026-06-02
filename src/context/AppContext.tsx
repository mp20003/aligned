import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
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

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    return { ...defaultData, ...JSON.parse(raw) }
  } catch {
    return defaultData
  }
}

function save(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

type AppContextValue = {
  data: AppData
  completeOnboarding: (onboarding: OnboardingData) => void
  logWin: (date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)

  const update = useCallback((next: AppData) => {
    save(next)
    setData(next)
  }, [])

  const completeOnboarding = useCallback((onboarding: OnboardingData) => {
    update({ ...data, onboarding })
  }, [data, update])

  const logWin = useCallback((date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => {
    const day = data.days[date] ?? { physical: null, mental: null, spiritual: null }
    update({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day, [category]: { text, completedAt: new Date().toISOString(), reflection } },
      },
    })
  }, [data, update])

  return (
    <AppContext.Provider value={{ data, completeOnboarding, logWin }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
