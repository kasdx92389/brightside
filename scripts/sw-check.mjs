// จำลองสภาพแวดล้อม service worker ใน Node เพื่อทดสอบตรรกะแคชของ public/sw.js
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const code = fs.readFileSync('public/sw.js', 'utf8')
function makeWorld({ fetchImpl }) {
  const store = new Map() // url -> Response-like
  const mkRes = (body, ok = true) => ({ ok, body, clone() { return this } })
  const cache = {
    async addAll() {}, async match(req) { const k = typeof req === 'string' ? new URL(req, 'https://x.test/').href : req.url; return store.get(k) },
    async put(req, res) { store.set(req.url, res) }, async keys() { return [...store.keys()].map((url) => ({ url })) }, async delete(req) { store.delete(req.url) },
  }
  const handlers = {}
  const self = { addEventListener: (n, f) => (handlers[n] = f), skipWaiting() {}, clients: { claim() {} }, location: { origin: 'https://x.test' } }
  const ctx = { self, location: self.location, caches: { open: async () => cache, keys: async () => [], delete: async () => {} }, fetch: (r) => fetchImpl(r), URL, Promise, setTimeout, clearTimeout }
  vm.createContext(ctx)
  vm.runInContext(code, ctx)
  const run = (request) => new Promise((resolve, reject) => handlers.fetch({ request, respondWith: (p) => Promise.resolve(p).then(resolve, reject) }))
  return { run, store, mkRes }
}
const req = (url, mode = 'cors') => ({ url: 'https://x.test' + url, method: 'GET', mode })

// 1) นำทาง + ออนไลน์: ได้หน้าใหม่จากเครือข่าย (ไม่ใช่แคชเก่า) และอัปเดตแคช
{
  let net = 'NEW'
  const w = makeWorld({ fetchImpl: async () => w.mkRes(net) })
  w.store.set('https://x.test/', w.mkRes('OLD'))
  assert.equal((await w.run(req('/', 'navigate'))).body, 'NEW')
  assert.equal(w.store.get('https://x.test/').body, 'NEW')
}
// 2) นำทาง + ออฟไลน์: ใช้แคช
{
  const w = makeWorld({ fetchImpl: async () => { throw new Error('offline') } })
  w.store.set('https://x.test/', w.mkRes('CACHED'))
  assert.equal((await w.run(req('/', 'navigate'))).body, 'CACHED')
}
// 3) นำทาง + เครือข่ายช้ากว่า 4 วิ: ใช้แคชก่อน
{
  const w = makeWorld({ fetchImpl: () => new Promise((r) => setTimeout(() => r(w.mkRes('LATE')), 4500)) })
  w.store.set('https://x.test/', w.mkRes('CACHED'))
  const t = Date.now()
  assert.equal((await w.run(req('/', 'navigate'))).body, 'CACHED')
  assert.ok(Date.now() - t >= 3900 && Date.now() - t < 4600)
  await new Promise((r) => setTimeout(r, 800))
  assert.equal(w.store.get('https://x.test/').body, 'LATE', 'cache refreshed in the background')
}
// 4) ไฟล์ hash: แคชก่อน + ของเก่าถูกล้างเมื่อได้ตัวใหม่
{
  const w = makeWorld({ fetchImpl: async (r) => w.mkRes('JS:' + r.url) })
  w.store.set('https://x.test/assets/index-OLD.js', w.mkRes('old'))
  w.store.set('https://x.test/assets/index-OLD.css', w.mkRes('oldcss'))
  const r = await w.run(req('/assets/index-NEW.js'))
  assert.ok(r.body.includes('index-NEW.js'))
  await new Promise((r2) => setTimeout(r2, 50))
  assert.ok(!w.store.has('https://x.test/assets/index-OLD.js'), 'old js pruned')
  assert.ok(w.store.has('https://x.test/assets/index-OLD.css'), 'css not pruned by js')
  assert.ok(w.store.has('https://x.test/assets/index-NEW.js'))
}
console.log('sw ok')
