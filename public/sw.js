// หน้า HTML: เครือข่ายก่อน (รอไม่เกิน 4 วิ ไม่งั้นใช้แคช) เพื่อให้ index.html ตรงกับไฟล์ที่ deploy ล่าสุด ไม่ชี้ไปไฟล์เก่าที่ถูกแทนที่ → หน้าขาว
// ไฟล์อื่น (ไฟล์ที่มี hash/รูปท่า): stale-while-revalidate ใช้ออฟไลน์ได้
const CACHE = 'brightside-v3'
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
  if (request.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then((c) => {
      const fresh = fetch(request).then((r) => { if (r.ok) c.put(request, r.clone()); return r })
      fresh.catch(() => {}) // หมดเวลาแล้วใช้แคช: ปล่อยให้โหลดอัปเดตแคชต่อเงียบๆ
      const wait = new Promise((_, no) => setTimeout(no, 4000))
      return Promise.race([fresh, wait]).catch(async () => (await c.match(request)) || (await c.match('./')) || fresh)
    }))
    return
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(request, { ignoreSearch: false })
    const net = fetch(request).then((r) => { if (r.ok) { c.put(request, r.clone()); prune(c, request) } return r }).catch(() => hit || c.match('./'))
    return hit || net
  }))
})
