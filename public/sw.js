const CACHE = 'triova-v1'

// Pre-cache the app shell on install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['/', '/today', '/history', '/score', '/manifest.json', '/icon.svg'])
    )
  )
  self.skipWaiting()
})

// Delete old caches on activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Serve from cache, update cache from network in the background
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request)
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) cache.put(e.request, res.clone())
        return res
      }).catch(() => cached)
      // Return cached immediately if available, otherwise wait for network
      return cached ?? networkFetch
    })
  )
})

// Daily reminder push, sent by api/send-reminders.js via Vercel Cron.
self.addEventListener('push', e => {
  let payload = {}
  try { payload = e.data ? e.data.json() : {} } catch { /* non-JSON payload, use defaults */ }
  const title = payload.title || 'Triova'
  e.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Show up for one part of you today.',
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      data: { url: payload.url || '/today' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/today'
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const existing = clientList.find(c => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
