import { supabase } from './supabase'

// Minimal first-party product signal — a plain Supabase table, no
// third-party analytics script (see the project's Dependency Rule). Query it
// directly via the Supabase SQL Editor; nothing in the app reads it back.
// Fire-and-forget: a failed insert here must never affect the app itself.
export function logEvent(userId: string, name: string, metadata?: Record<string, unknown>) {
  supabase.from('events').insert({ user_id: userId, name, metadata: metadata ?? {} })
    .then(({ error }) => {
      if (error) console.warn('Failed to log event', name, error)
    })
}
