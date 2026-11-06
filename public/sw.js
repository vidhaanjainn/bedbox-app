// Push notifications, installability, and ONE safety net: if a page itself
// can't load (no internet, the phone can't reach our site), show a friendly
// "reconnecting" page that opens the app by itself once the connection is
// back - instead of a blank/black screen or Safari's error page.
//
// Deliberately narrow. Only full page loads (request.mode === 'navigate') are
// touched, always network-first, and nothing else is ever cached or served
// from cache: the old version wrapped every GET in fetch().catch(-> cached
// /portal), which could hand portal HTML to a failed data/page request and
// wedge navigation. Data, scripts and API calls go straight to the network.
const OFFLINE_CACHE = 'bb-offline-v1'
const OFFLINE_URL = '/offline.html'
const PAGE_TIMEOUT_MS = 15000

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(c => c.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => {})   // offline during install: no safety net yet, never block install
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== OFFLINE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  e.respondWith(new Promise(resolve => {
    let settled = false
    const fallback = () => {
      if (settled) return
      settled = true
      resolve(caches.match(OFFLINE_URL).then(r => r || fetch(req)))
    }
    // A hung network gets the reconnecting page instead of a frozen blank screen.
    const timer = setTimeout(fallback, PAGE_TIMEOUT_MS)
    fetch(req).then(res => {
      clearTimeout(timer)
      if (!settled) { settled = true; resolve(res) }
    }, () => { clearTimeout(timer); fallback() })
  }))
})

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'TheBedBox', body: e.data ? e.data.text() : '' } }
  const title = data.title || 'TheBedBox'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus() }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  }))
})
