// แคชแบบ stale-while-revalidate: เปิดครั้งแรกออนไลน์ แล้วใช้ออฟไลน์ได้ (รวมรูปท่า)
const CACHE = 'brightside-v2'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './icon.svg', './manifest.webmanifest']))); self.skipWaiting() })
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(request, { ignoreSearch: false })
    const net = fetch(request).then((r) => { if (r.ok) c.put(request, r.clone()); return r }).catch(() => hit || c.match('./'))
    return hit || net
  }))
})
