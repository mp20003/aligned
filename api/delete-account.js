// Vercel serverless function. Deletes the requesting user's Supabase auth
// account (and, via `app_data`'s `on delete cascade` FK, their data row)
// using the service-role key — which must only ever live in Vercel's
// project env vars, never in client code or this repo.
//
// The caller is identified from their own Supabase access token, verified
// server-side with the service-role client, so one user can never delete
// another's account by guessing a user id.
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('delete-account: missing Supabase server env vars')
    res.status(500).json({ error: 'Server misconfigured' })
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id)
  if (deleteError) {
    console.error('delete-account: failed to delete user', deleteError)
    res.status(500).json({ error: 'Failed to delete account' })
    return
  }

  res.status(200).json({ ok: true })
}
