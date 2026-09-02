import type { CategoryKey, DayEntry } from '../types'

export const SUGGESTIONS: Record<CategoryKey, string[]> = {
  physical: [
    'Walked before checking my phone',
    'Stretched for 10 minutes',
    'Drank 2 litres of water',
    'Got to bed before midnight',
    'Moved my body for 20 minutes',
    'Took the stairs',
    'Cooked a proper meal',
    'Spent 30 minutes outside',
    'Did a workout or exercise class',
    'Rested with no screens',
    'Went for a short run',
    'Did yoga or breathwork',
  ],
  mental: [
    'Read for 30 minutes',
    'Wrote one honest thought down',
    'Learned one new thing',
    'Did 90 minutes of focused work',
    'Listened to a podcast or lecture',
    'Finished something I had been avoiding',
    'Planned tomorrow the night before',
    'Reflected on a decision I made',
    'Had a conversation that challenged me',
    'Turned off notifications for 2 hours',
    'Wrote in a journal',
    'Worked through a hard problem',
  ],
  spiritual: [
    'Sat quietly for 5 minutes',
    'Wrote three things I am grateful for',
    'Created something with no audience',
    'Was fully present in one conversation',
    'Went for a walk without my phone',
    'Did something kind without being asked',
    'Reflected on what matters this week',
    'Let something go',
    'Spent time in nature',
    'Called someone I care about',
    'Meditated for 10 minutes',
    'Read something that inspired me',
  ],
}

export function dateSeed(dateStr: string) {
  return dateStr.split('-').reduce((acc, n) => acc + parseInt(n), 0)
}

// One clear example per day — was previously 2-3 rotating chips, which read
// as a menu of options rather than a single illustrative example.
export function getDailySuggestions(key: CategoryKey, dateStr: string): string[] {
  const list = SUGGESTIONS[key]
  const seed = dateSeed(dateStr)
  return [list[seed % list.length]]
}

export function getPastWins(
  days: Record<string, DayEntry>,
  key: CategoryKey,
  excludeDate: string
): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  const sorted = Object.keys(days).sort().reverse()
  for (const d of sorted) {
    if (d === excludeDate) continue
    const win = days[d][key]
    if (win && !seen.has(win.text)) {
      seen.add(win.text)
      results.push(win.text)
      if (results.length >= 4) break
    }
  }
  return results
}
