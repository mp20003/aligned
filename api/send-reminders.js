// Vercel Cron target (see vercel.json), once/day. Sends an identity-framed
// push nudge to anyone with a saved push subscription who hasn't logged all
// three categories yet for today (server's UTC date — every subscriber gets
// this at the same UTC instant regardless of their own timezone; a
// per-timezone-bucket version is a reasonable future upgrade, not built here).
//
// Uses the service-role key, same as api/delete-account.js, since it has to
// read across every user's data — never exposed to client code.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const CATEGORIES = ['physical', 'mental', 'spiritual']

function todayKey() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildMessage(missing, labels) {
  if (missing.length === 3) return 'Show up for one part of you today.'
  const names = missing.map(k => labels[k]?.label || k)
  return `Show up for your ${names.join(' or ')} today?`
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('send-reminders: missing required env vars')
    res.status(500).json({ error: 'Server misconfigured' })
    return
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
  if (subsError) {
    console.error('send-reminders: failed to load subscriptions', subsError)
    res.status(500).json({ error: 'Failed to load subscriptions' })
    return
  }
  if (!subs || subs.length === 0) {
    res.status(200).json({ sent: 0, skipped: 0 })
    return
  }

  const userIds = [...new Set(subs.map(s => s.user_id))]
  const { data: rows, error: rowsError } = await admin
    .from('app_data')
    .select('user_id, days, onboarding')
    .in('user_id', userIds)
  if (rowsError) {
    console.error('send-reminders: failed to load app_data', rowsError)
    res.status(500).json({ error: 'Failed to load app data' })
    return
  }

  const today = todayKey()
  const rowByUser = new Map(rows.map(r => [r.user_id, r]))

  let sent = 0
  let skipped = 0
  const staleEndpoints = []

  await Promise.allSettled(
    subs.map(async sub => {
      const row = rowByUser.get(sub.user_id)
      const entry = row?.days?.[today]
      const missing = CATEGORIES.filter(c => !entry || entry[c] === null || entry[c] === undefined)
      if (missing.length === 0) {
        skipped++
        return
      }

      const body = buildMessage(missing, row?.onboarding?.categories || {})
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'Triova', body, url: '/today' })
        )
        sent++
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) staleEndpoints.push(sub.endpoint)
        else console.error('send-reminders: push failed', sub.endpoint, err.message)
      }
    })
  )

  if (staleEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  res.status(200).json({ sent, skipped, removedStale: staleEndpoints.length })
}
