import { byId, EXERCISES } from '../data/exercises.js'

// แชร์แผนแบบไม่ต้องมีเซิร์ฟเวอร์: เนื้อแผนถูกย่อเป็นไบต์แล้วฝังในรหัส/ลิงก์เอง
//   C1 = ไบต์ดิบ · C2 = ไบต์บีบอัด (เลือกอันที่สั้นกว่า)   ← รูปแบบปัจจุบัน
//   B0/B1 = รูปแบบ JSON รุ่นแรก (ยังอ่านได้ เผื่อมีลิงก์เก่า)
//
// ⚠ ตารางด้านล่างต้อง "เพิ่มต่อท้ายเท่านั้น" ห้ามสลับลำดับหรือลบ ไม่งั้นลิงก์ที่แชร์ไปแล้วจะอ่านผิด
//    (ท่าออกกำลังกายก็เช่นกัน: EXERCISES ต้องเพิ่มต่อท้ายเท่านั้น)
const KINDS = ['train', 'rest', 'walk']
const REPS = ['10–12', '12–15', '6–10', '10–15', '20 นาที', '8–12', '40–60 นาที', '15 นาที', '30–60 วินาที', '3–6', '3–5 ต่อข้าง', '5–8', '2–5', '4–8', 'จนหมดแรง'] // index 15 = พิมพ์เอง
const WORDS = [
  'Push 1', 'อก ไหล่ หลังแขน', 'Pull 1', 'หลัง หน้าแขน', 'Legs & Abs', 'ขา หน้าท้อง', 'Push 2', 'อกบน ไหล่ข้าง หลังแขน', 'Pull 2 + RDL', 'หลัง หน้าแขน หลังขา',
  'พัก · เดิน', 'เดินเร็วหรือกิจกรรมเบาๆ', 'พัก', 'พักผ่อนเต็มที่', 'Full Body A', 'ทั้งตัว', 'Full Body B', 'Upper 1', 'ร่างกายส่วนบน', 'Lower 1', 'ร่างกายส่วนล่าง',
  'Upper 2', 'Lower 2', 'Push', 'Pull', 'Legs', 'ขา ก้น หน้าท้อง', 'Upper', 'Lower', 'Legs 1', 'Pull 2', 'Legs 2', 'ฝึกเพิ่ม', 'ฝึกเพิ่มเติม',
  'PPL 5 วัน', ...[3, 4, 5, 6].flatMap((d) => ['ลดไขมัน', 'ฟิตทั่วไป', 'สร้างกล้ามเนื้อ'].map((g) => `${d} วัน · ${g}`)),
] // index 255 = พิมพ์เอง
const MAX_CODE = 8000

const toB64 = (u8) => btoa(String.fromCharCode(...u8)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const fromB64 = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
const run = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer())
const enc = new TextEncoder(), dec = new TextDecoder()

/** รหัสแผน BS-XXXXXX จากเนื้อหาแผน (FNV-1a) — แผนเหมือนกันได้รหัสเหมือนกัน แก้ท่าแล้วรหัสเปลี่ยน */
export function planId(plan) {
  const slim = [plan.name, plan.days.map((d) => [KINDS.indexOf(d.kind), d.name, d.focus, d.items.map((i) => [i.id, i.sets, i.reps])])]
  let h = 0x811c9dc5
  for (const c of JSON.stringify(slim)) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0
  return 'BS-' + h.toString(36).toUpperCase().padStart(6, '0').slice(-6)
}

// ───── เขียน/อ่านไบต์ ─────
const putStr = (out, s, table) => {
  const i = table.indexOf(s)
  if (i >= 0) return out.push(i)
  const b = enc.encode(s)
  out.push(255, b.length, ...b)
}
const reader = (u8) => {
  let p = 0
  const byte = () => { if (p >= u8.length) throw new Error(); return u8[p++] }
  const lit = () => { const n = byte(); if (p + n > u8.length) throw new Error(); const s = dec.decode(u8.subarray(p, p + n)); p += n; return s }
  return { byte, str: (table) => { const i = byte(); return i === 255 ? lit() : table[i] ?? (() => { throw new Error() })() }, lit, done: () => p === u8.length }
}

function pack(plan) {
  const out = []
  putStr(out, plan.name, WORDS)
  for (const d of plan.days) {
    out.push((KINDS.indexOf(d.kind) << 6) | d.items.length)
    putStr(out, d.name, WORDS); putStr(out, d.focus, WORDS)
    for (const it of d.items) {
      const r = REPS.indexOf(it.reps)
      out.push(EXERCISES.findIndex((e) => e.id === it.id), (Math.min(15, it.sets) << 4) | (r < 0 ? 15 : r))
      if (r < 0) { const b = enc.encode(it.reps); out.push(b.length, ...b) }
    }
  }
  return Uint8Array.from(out)
}

export async function encodePlan(plan) {
  const raw = pack(plan)
  const plain = 'C1' + toB64(raw)
  if (typeof CompressionStream !== 'function') return plain
  const zipped = 'C2' + toB64(await run(raw, new CompressionStream('deflate-raw')))
  return zipped.length < plain.length ? zipped : plain
}

// ───── ตรวจและแปลงกลับ (ข้อมูลจากเพื่อนถือว่าไม่น่าเชื่อถือ ตรวจทุกช่อง) ─────
const str = (v, n) => String(v ?? '').slice(0, n)
const int = (v) => Math.min(10, Math.max(1, Math.round(Number(v)) || 1))
const item = (id, sets, reps) => ({ id, sets: int(sets), reps: str(reps, 24) })
const plan = (name, days) => ({ name: str(name, 60) || 'แผนจากเพื่อน', source: 'shared', days })

function unpack(u8) {
  const r = reader(u8)
  const name = r.str(WORDS)
  const days = Array.from({ length: 7 }, () => {
    const h = r.byte(), kind = KINDS[h >> 6]
    if (!kind) throw new Error()
    const dn = r.str(WORDS), focus = r.str(WORDS)
    const items = Array.from({ length: h & 63 }, () => {
      const ex = EXERCISES[r.byte()], b = r.byte(), ri = b & 15
      const reps = ri === 15 ? r.lit() : REPS[ri]
      return ex && reps !== undefined ? item(ex.id, b >> 4, reps) : null
    }).filter(Boolean).slice(0, 15)
    return { kind, name: str(dn, 40), focus: str(focus, 60), items: kind === 'rest' ? [] : items }
  })
  if (!r.done()) throw new Error()
  return plan(name, days)
}

function unpackJson(u8) { // รูปแบบรุ่นแรก B0/B1
  const [name, days] = JSON.parse(dec.decode(u8))
  if (!Array.isArray(days) || days.length !== 7) throw new Error()
  return plan(name, days.map(([k, dn, focus, items]) => {
    if (!KINDS[k]) throw new Error()
    return { kind: KINDS[k], name: str(dn, 40), focus: str(focus, 60), items: KINDS[k] === 'rest' ? [] : (Array.isArray(items) ? items : []).filter(([id]) => byId[id]).slice(0, 15).map(([id, s, r]) => item(id, s, r)) }
  }))
}

/** รับรหัสหรือลิงก์ทั้งเส้น → แผนที่ตรวจแล้ว */
export async function decodePlan(input) {
  const code = String(input).trim().split(/[/#\s]/).filter(Boolean).pop() || ''
  if (!/^(B[01]|C[12])[A-Za-z0-9_-]+$/.test(code) || code.length > MAX_CODE) throw new Error('รหัสแผนไม่ถูกต้อง')
  const zipped = code.startsWith('B1') || code.startsWith('C2')
  if (zipped && typeof DecompressionStream !== 'function') throw new Error('เบราว์เซอร์นี้เปิดรหัสแบบบีบอัดไม่ได้ ลองใช้ Chrome หรือ Safari เวอร์ชันใหม่')
  try {
    let raw = fromB64(code.slice(2))
    if (zipped) raw = await run(raw, new DecompressionStream('deflate-raw'))
    return code[0] === 'C' ? unpack(raw) : unpackJson(raw)
  } catch {
    throw new Error('อ่านรหัสแผนไม่ได้ รหัสอาจถูกตัดหรือคัดลอกไม่ครบ')
  }
}

export const shareUrl = (code) => `${location.origin}${location.pathname}#/import/${code}`
