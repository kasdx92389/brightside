// แคชแบบ stale-while-revalidate: เปิดครั้งแรกออนไลน์ แล้วใช้ออฟไลน์ได้ (รวมรูปท่า)
const CACHE = 'brightside-v2'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './icon.svg', './manifest.webmanifest']))); self.skipWaiting() })
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
// ไฟล์ /assets/index-<hash>.js|css ของ build เก่า ลบทิ้งเมื่อได้ตัวใหม่
const HASHED = /\/assets\/index-[^/]+\.(js|css)$/
const prune = async (c, req) => {
  const p = new URL(req.url).pathname
  if (!HASHED.test(p)) return
  for (const k of await c.keys()) { const kp = new URL(k.url).pathname; if (kp !== p && HASHED.test(kp) && kp.endsWith('.css') === p.endsWith('.css')) c.delete(k) }
}
self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(request, { ignoreSearch: false })
    const net = fetch(request).then((r) => { if (r.ok) { c.put(request, r.clone()); prune(c, request) } return r }).catch(() => hit || c.match('./'))
    return hit || net
  }))
})
