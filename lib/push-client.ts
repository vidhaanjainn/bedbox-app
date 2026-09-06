'use client'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

// Notification.permission is a one-way ratchet (stays 'granted' even after
// unsubscribing) — check the actual push subscription to know current state.
export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  // Everything here — including requestPermission, which can itself throw/
  // reject on some browsers (e.g. Safari outside a direct user gesture) —
  // MUST resolve to a definite result. A previous version left
  // requestPermission() outside this try/catch: an uncaught rejection there
  // propagated straight through this async function, and callers awaiting
  // it with no try/catch of their own never got past "Enabling..." because
  // their loading-state reset never ran.
  try {
    if (!isPushSupported()) return { ok: false, error: 'Push notifications are not supported on this browser.' }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return { ok: false, error: 'Push notifications are not configured yet.' }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: permission === 'denied' ? 'Notifications are blocked for this site in your browser settings.' : 'Permission was not granted.' }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
    }
    const json = sub.toJSON()
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    })
    if (!res.ok) return { ok: false, error: 'Could not save your subscription.' }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Something went wrong enabling notifications.' }
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
  } catch { /* best-effort */ }
}
