import { byId } from '../data/exercises.js'

// แชร์แผนแบบไม่ต้องมีเซิร์ฟเวอร์: เนื้อแผนถูกบีบอัดลงในรหัส/ลิงก์เอง
// รูปแบบ: 'B1' + base64url(deflate(json)) · ถ้าเบราว์เซอร์ไม่มี CompressionStream ใช้ 'B0' + base64url(json)
const KINDS = ['train', 'rest', 'walk']
const MAX_CODE = 8000

const toB64 = (u8) => btoa(String.fromCharCode(...u8)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const fromB64 = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
const run = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer())

const slim = (plan) => [plan.name, plan.days.map((d) => [KINDS.indexOf(d.kind), d.name, d.focus, d.items.map((i) => [i.id, i.sets, i.reps])])]

/** รหัสแผน BS-XXXXXX จากเนื้อหาแผน (FNV-1a) — แผนเหมือนกันได้รหัสเหมือนกัน แก้ท่าแล้วรหัสเปลี่ยน */
export function planId(plan) {
  let h = 0x811c9dc5
  for (const c of JSON.stringify(slim(plan))) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0
  return 'BS-' + h.toString(36).toUpperCase().padStart(6, '0').slice(-6)
}

export async function encodePlan(plan) {
  const raw = new TextEncoder().encode(JSON.stringify(slim(plan)))
  return typeof CompressionStream === 'function'
    ? 'B1' + toB64(await run(raw, new CompressionStream('deflate-raw')))
    : 'B0' + toB64(raw)
}

const str = (v, n) => String(v ?? '').slice(0, n)
const int = (v) => Math.min(10, Math.max(1, Math.round(Number(v)) || 1))

/** รับรหัสหรือลิงก์ทั้งเส้น → แผนที่ตรวจแล้ว (ข้อมูลจากเพื่อนถือว่าไม่น่าเชื่อถือ ตรวจทุกช่อง) */
export async function decodePlan(input) {
  const code = String(input).trim().split(/[/#\s]/).filter(Boolean).pop() || ''
  if (!/^B[01][A-Za-z0-9_-]+$/.test(code) || code.length > MAX_CODE) throw new Error('รหัสแผนไม่ถูกต้อง')
  if (code[1] === '1' && typeof DecompressionStream !== 'function') throw new Error('เบราว์เซอร์นี้เปิดรหัสแบบบีบอัดไม่ได้ ลองใช้ Chrome หรือ Safari เวอร์ชันใหม่')
  try {
    let raw = fromB64(code.slice(2))
    if (code[1] === '1') raw = await run(raw, new DecompressionStream('deflate-raw'))
    const [name, days] = JSON.parse(new TextDecoder().decode(raw))
    if (!Array.isArray(days) || days.length !== 7) throw new Error()
    return {
      name: str(name, 60) || 'แผนจากเพื่อน',
      source: 'shared',
      days: days.map(([k, dn, focus, items]) => {
        if (!KINDS[k]) throw new Error()
        return {
          kind: KINDS[k], name: str(dn, 40), focus: str(focus, 60),
          items: KINDS[k] === 'rest' ? [] : (Array.isArray(items) ? items : []).filter(([id]) => byId[id]).slice(0, 15).map(([id, sets, reps]) => ({ id, sets: int(sets), reps: str(reps, 24) })),
        }
      }),
    }
  } catch {
    throw new Error('อ่านรหัสแผนไม่ได้ รหัสอาจถูกตัดหรือคัดลอกไม่ครบ')
  }
}

export const shareUrl = (code) => `${location.origin}${location.pathname}#/import/${code}`
