// Client-side web push subscribe/unsubscribe. Talks directly to Supabase
// (same anon-key client everything else uses) — only the daily send itself
// (api/send-reminders.js) needs elevated privileges, to read across users.
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

// PushManager wants the VAPID key as a Uint8Array, but it's handed out as a
// URL-safe base64 string — this is the standard conversion for that.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function getPushSubscriptionState(): Promise<boolean> {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return false
  const subscription = await registration.pushManager.getSubscription()
  return subscription !== null
}

export async function subscribeToPush(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Not supported on this browser' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'Reminders are misconfigured' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'Notification permission was not granted' }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    const json = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: 'endpoint' }
    )
    if (error) return { ok: false, error: 'Failed to save subscription' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to subscribe' }
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
}
