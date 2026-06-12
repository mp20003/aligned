import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { AppData, OnboardingData } from '../types'

const STORAGE_KEY = 'three-wins-data'
const DARK_KEY = 'triova-dark'

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
  darkMode: boolean
  toggleDarkMode: () => void
  completeOnboarding: (onboarding: OnboardingData) => void
  logWin: (date: string, category: 'physical' | 'mental' | 'spiritual', text: string, reflection?: string) => void
  updateSettings: (name: string, categories: AppData['onboarding']['categories']) => void
  resetPractice: () => void
  restoreData: (imported: AppData) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(DARK_KEY) === 'true')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const toggleDarkMode = useCallback(() => {
    setDarkMode(d => {
      const next = !d
      localStorage.setItem(DARK_KEY, String(next))
      return next
    })
  }, [])

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

  const updateSettings = useCallback((name: string, categories: AppData['onboarding']['categories']) => {
    update({ ...data, onboarding: { ...data.onboarding, name, categories } })
  }, [data, update])

  const resetPractice = useCallback(() => {
    update({ ...data, days: {} })
  }, [data, update])

  const restoreData = useCallback((imported: AppData) => {
    update(imported)
  }, [update])

  return (
    <AppContext.Provider value={{ data, darkMode, toggleDarkMode, completeOnboarding, logWin, updateSettings, resetPractice, restoreData }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
