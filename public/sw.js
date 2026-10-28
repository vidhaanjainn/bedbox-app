// Push notifications + installability only. This worker deliberately does NOT
// intercept fetches: the old version wrapped every GET in fetch().catch(->
// cached /portal), which could hand portal HTML to a failed data/page request
// and wedge navigation. Pass-through means the browser talks to the network
// directly, with nothing in between to hang.
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
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
