'use client'

// Reports "this resident's browser now has the app installed" back to their
// own record, so admins can see who's actually installed it instead of
// guessing from who's dismissed the banner. Fires on the real `appinstalled`
// event, and also opportunistically on any portal page load that's already
// running in standalone display mode (covers someone who installed before
// this tracking existed, or via a path that never fired the event).
// Deduped client-side via localStorage so a resident who's already marked
// installed doesn't hit this endpoint on every page load - the API itself
// is also idempotent (only ever sets the timestamp once), this is just to
// avoid the pointless network call.

const MARKED_KEY = 'bb_pwa_installed_marked'

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export function markPwaInstalled() {
  try {
    if (localStorage.getItem(MARKED_KEY) === '1') return
  } catch { /* private browsing etc - just proceed and let the API dedupe */ }
  fetch('/api/portal/mark-installed', { method: 'POST' })
    .then(res => { if (res.ok) { try { localStorage.setItem(MARKED_KEY, '1') } catch {} } })
    .catch(() => {})
}

// Call once from a component mounted on every resident portal page.
export function initPwaInstallTracking() {
  if (typeof window === 'undefined') return () => {}

  if (isStandalone()) markPwaInstalled()

  const onInstalled = () => markPwaInstalled()
  window.addEventListener('appinstalled', onInstalled)
  return () => window.removeEventListener('appinstalled', onInstalled)
}
