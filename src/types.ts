export type CategoryKey = 'physical' | 'mental' | 'spiritual'

export type WinEntry = {
  text: string
  completedAt: string // ISO timestamp
}

export type DayEntry = {
  physical: WinEntry | null
  mental: WinEntry | null
  spiritual: WinEntry | null
}

export type CategoryConfig = {
  label: string
  definition: string
}

export type OnboardingData = {
  completed: boolean
  categories: Record<CategoryKey, CategoryConfig>
}

export type AppData = {
  onboarding: OnboardingData
  days: Record<string, DayEntry> // key: "YYYY-MM-DD"
}
