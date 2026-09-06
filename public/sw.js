const CACHE = 'bedbox-v1'
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/portal','/manifest.json']))); self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', e => {
  if (e.request.method!=='GET'||e.request.url.includes('supabase.co')) return
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok&&e.request.mode==='navigate'){const c=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c))} return r }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/portal'))))
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
