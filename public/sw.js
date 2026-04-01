const CACHE = 'bedbox-v1'
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/portal','/manifest.json']))); self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', e => {
  if (e.request.method!=='GET'||e.request.url.includes('supabase.co')) return
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok&&e.request.mode==='navigate'){const c=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c))} return r }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/portal'))))
})
