import { merge } from './merge.js'

// แกนซิงก์ (ไม่แตะ browser/store จึงทดสอบใน Node ได้)
// รหัสเชื่อม (secret) 256 บิต อยู่แค่ในเครื่องผู้ใช้ — จากนั้นคำนวณสามอย่าง:
//   id    = ที่อยู่ของก้อนข้อมูลบนเซิร์ฟเวอร์        (เซิร์ฟเวอร์เห็น แต่ย้อนกลับเป็นรหัสไม่ได้)
//   token = สิทธิ์เขียน/อ่าน                         (เซิร์ฟเวอร์เก็บเฉพาะค่าแฮชของมัน)
//   key   = กุญแจเข้ารหัส AES-GCM                   (ไม่ออกจากเครื่องเลย → เซิร์ฟเวอร์อ่านข้อมูลไม่ออก)
const enc = new TextEncoder(), dec = new TextDecoder()
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))

const toB64 = (u8) => {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
const fromB64 = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
const pipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer())

export const newSecret = () => toB64(crypto.getRandomValues(new Uint8Array(32)))
export const validSecret = (s) => /^[A-Za-z0-9_-]{43}$/.test(s)

export async function derive(secret) {
  // เบราว์เซอร์เปิดระบบเข้ารหัสเฉพาะหน้า https:// หรือ localhost (เปิดผ่าน http://192.168… จะไม่มี crypto.subtle)
  if (!globalThis.crypto?.subtle) throw new SyncError('insecure', 'หน้านี้เปิดผ่าน http:// เบราว์เซอร์จึงไม่ให้เข้ารหัสข้อมูล ให้เปิดผ่าน https://brightside.sudomont.com แทน')
  return {
    id: hex(await sha('bs:id:' + secret)),
    token: hex(await sha('bs:auth:' + secret)),
    key: await crypto.subtle.importKey('raw', await sha('bs:enc:' + secret), 'AES-GCM', false, ['encrypt', 'decrypt']),
  }
}

// รูปแบบ: [flag 1 ไบต์ (1=บีบอัด)] [iv 12 ไบต์] [ciphertext]
export async function seal(key, obj) {
  let raw = enc.encode(JSON.stringify(obj)), flag = 0
  if (typeof CompressionStream === 'function') { raw = await pipe(raw, new CompressionStream('deflate-raw')); flag = 1 }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw))
  const out = new Uint8Array(13 + ct.length)
  out[0] = flag; out.set(iv, 1); out.set(ct, 13)
  return toB64(out)
}
export async function open(key, text) {
  const u8 = fromB64(text)
  let raw
  try { raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(1, 13) }, key, u8.subarray(13))) }
  catch { throw new SyncError('decrypt', 'ถอดรหัสไม่ได้ รหัสเชื่อมไม่ตรงกับข้อมูลบนคลาวด์') }
  if (u8[0] === 1) raw = await pipe(raw, new DecompressionStream('deflate-raw'))
  return JSON.parse(dec.decode(raw))
}

export class SyncError extends Error {
  constructor(kind, message) { super(message); this.kind = kind }
}

const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))

async function call(url, id, token, method, body) {
  let res
  try {
    res = await fetch(`${url}/s/${id}`, {
      method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    })
  } catch { throw new SyncError('network', 'เชื่อมต่อเซิร์ฟเวอร์ซิงก์ไม่ได้') }
  let json = null
  try { json = await res.json() } catch { /* ว่าง */ }
  return { status: res.status, ok: res.ok, json }
}

/**
 * ซิงก์หนึ่งรอบ: ดึง → รวม → (ถ้ามีอะไรใหม่) ส่งกลับ  · ถ้าสองเครื่องส่งพร้อมกัน เซิร์ฟเวอร์ตอบ 409 แล้วเริ่มรอบใหม่
 * @param mustExist true = ตอนเชื่อมเครื่องใหม่ ถ้าไม่พบรหัสนี้บนคลาวด์ให้ error แทนที่จะสร้างใหม่ (กันพิมพ์รหัสผิดแล้วเงียบ)
 */
export async function syncOnce({ url, secret, local, mustExist = false }) {
  const { id, token, key } = await derive(secret)
  for (let attempt = 0; attempt < 4; attempt++) {
    const got = await call(url, id, token, 'GET')
    let remote = null, rev = 0
    if (got.status === 404) { if (mustExist) throw new SyncError('notfound', 'ไม่พบรหัสเชื่อมนี้บนคลาวด์ ตรวจรหัสอีกครั้ง') }
    else if (got.status === 403) throw new SyncError('forbidden', 'รหัสเชื่อมไม่ถูกต้อง')
    else if (got.ok) { remote = await open(key, got.json.data); rev = got.json.rev }
    else throw new SyncError('server', `เซิร์ฟเวอร์ตอบผิดปกติ (${got.status})`)

    const merged = remote ? merge(local, remote) : local
    if (remote && canon(merged) === canon(remote)) return { state: merged, pushed: false }

    const put = await call(url, id, token, 'PUT', { baseRev: rev, data: await seal(key, merged) })
    if (put.ok) return { state: merged, pushed: true }
    if (put.status !== 409) throw new SyncError('server', `ส่งข้อมูลไม่สำเร็จ (${put.status})`)
    local = merged // มีเครื่องอื่นส่งมาก่อนเรา → ดึงใหม่แล้วรวมอีกรอบ
  }
  throw new SyncError('busy', 'ซิงก์ชนกันหลายรอบ ลองใหม่อีกครั้ง')
}

export const deleteCloud = async ({ url, secret }) => {
  const { id, token } = await derive(secret)
  const r = await call(url, id, token, 'DELETE')
  if (!r.ok) throw new SyncError('server', `ลบข้อมูลบนคลาวด์ไม่สำเร็จ (${r.status})`)
}
