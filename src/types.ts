export type CategoryKey = 'physical' | 'mental' | 'spiritual'

export type WinEntry = {
  text: string
  completedAt: string // ISO timestamp
  reflection?: string
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
  name: string
  categories: Record<CategoryKey, CategoryConfig>
}

export type WinBank = Record<CategoryKey, string[]>

export type AppData = {
  onboarding: OnboardingData
  days: Record<string, DayEntry> // key: "YYYY-MM-DD"
  bank: WinBank // user-saved reusable wins per category
}
