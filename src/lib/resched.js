// ตารางปรับตัวเมื่อผู้ใช้กดข้ามวันเพราะ "ปวดขา" — ฟังก์ชันบริสุทธิ์ (ไม่แตะ store/เบราว์เซอร์ ทดสอบใน Node ได้)
// หลักฐาน (Europe PMC): ปวดสูงสุดวันที่ 2–3 หลังออกแรง และท่าที่ลงช้าๆ ปวดมากสุด (Clarkson 1992 · Cheung 2003) ·
// หลังปวดหนักให้ลดขาลง 1–2 วันแล้วเล่นกล้ามเนื้อส่วนอื่นแทน (Cheung 2003) · ความถี่ต่อกลุ่มกล้ามเนื้อยืดหยุ่นได้เมื่อปริมาณรวมเท่ากัน (Schoenfeld 2019)
// ตัวเลข "3 วัน" เป็นค่าที่เลือกเอง (เลยจุดปวดสูงสุด) ไม่ใช่ค่าจากงานวิจัยโดยตรง ไม่มีงานไหนทดสอบการจัดตารางใหม่หลังข้ามวัน
import { byId } from '../data/exercises.js'
import { addDays } from './coach.js'
import { dayIdx, DAY_SHORT } from './calc.js'

export const RECOVER_DAYS = 3 // ขาไม่ลงซ้ำก่อนครบกี่วันหลังเล่นขาครั้งล่าสุด
export const SORE_DAYS = 3 // …และก่อนครบกี่วันหลังวันที่กดว่าปวดขา (รายงานซ้ำ = เลื่อนตามอีก)
export const LEG_SHARE = 0.4 // เซสชันที่ท่าใช้ขา ≥ สัดส่วนนี้ = "ขาเป็นหลัก" ย้ายทั้งวัน · ต่ำกว่านั้นตัดเฉพาะท่าขา
const HORIZON = 7 // ปรับเฉพาะ 7 วันหลังวันข้าม

const LEG_GROUPS = ['legs', 'full'] // คาร์ดิโอเดิน/วิ่ง (cardio) ไม่นับ
export const usesLegs = (id) => LEG_GROUPS.includes(byId[id]?.g)
export function legShare(day) {
  const items = day?.items || []
  return items.length ? items.filter((it) => usesLegs(it.id)).length / items.length : 0
}

const idx = (d) => dayIdx(new Date(d + 'T00:00:00'))
const started = (log) => !!log && (log.finished === true || Object.values(log.sets || {}).some((a) => Array.isArray(a) && a.some((x) => x?.done)))

/** วันล่าสุดก่อน `before` ที่ฝึกจบและมีเซ็ตที่ทำแล้วในท่าใช้ขา */
export function lastLegDate(logs, before) {
  let best = null
  for (const [d, l] of Object.entries(logs || {})) {
    if (d >= before || !l?.finished || (best && d <= best)) continue
    if (Object.entries(l.sets || {}).some(([id, a]) => usesLegs(id) && Array.isArray(a) && a.some((x) => x?.done))) best = d
  }
  return best
}

/**
 * @param {{ plan, logs, sore: string[], today: string }} o  sore = วันที่กด "ปวดขา" (YYYY-MM-DD)
 * @returns {{ [date: string]: { as?: number, drop?: string[] } }}  as = ใช้เซสชันของวัน (จ.=0) ในแม่แบบ · drop = ท่าที่ตัดออก · คืนเฉพาะวันที่ต่างจากแม่แบบ
 * วันที่แก้ได้ = หลังวันข้าม, ไม่ก่อนวันนี้, ยังไม่ฝึก/ไม่จบ · ไล่ทีละวันข้ามจากเก่าไปใหม่ (วางทับผลของครั้งก่อน) จึงคำนวณใหม่ทั้งชุดได้ผลเดิมเสมอ
 */
export function planSore({ plan, logs, sore, today }) {
  const days = plan?.days
  if (!Array.isArray(days) || days.length !== 7) return {}
  const sched = new Map() // date → { src, drop } (สร้างตอนอ่านครั้งแรกจากวันตามปฏิทิน)
  const get = (d) => { if (!sched.has(d)) sched.set(d, { src: idx(d), drop: [] }); return sched.get(d) }
  const eff = (d) => { const e = get(d), day = days[e.src]; return e.drop.length ? { ...day, items: day.items.filter((it) => !e.drop.includes(it.id)) } : day }
  const isHeavy = (d) => { const day = eff(d); return day.kind === 'train' && legShare(day) >= LEG_SHARE }
  const isFree = (d) => { const day = eff(d); return day.kind !== 'train' || !day.items.length }
  const legIds = (e) => days[e.src].items.filter((it) => usesLegs(it.id)).map((it) => it.id)
  const withDrop = (e, ids) => { e.drop = [...new Set([...e.drop, ...ids])] }

  for (const S of [...new Set(sore || [])].sort()) {
    const L = lastLegDate(logs, S)
    const gate = [L && addDays(L, RECOVER_DAYS), addDays(S, SORE_DAYS)].filter(Boolean).sort().at(-1)
    const range = Array.from({ length: HORIZON }, (_, i) => addDays(S, i + 1))
    const ok = (d) => d >= today && !started(logs?.[d])
    const target = (pred) => range.find((d) => ok(d) && d >= gate && pred(d))

    // (a) เซสชันขาเป็นหลักที่ตกก่อน gate: ของวันที่ข้ามเอง → ไปวันพัก/เดินแรกหลัง gate (ไม่มี = ทิ้ง) · ของวันอื่น → สลับกับวันแรกหลัง gate ที่ไม่ใช่ขาเป็นหลัก (ไม่มี = ตัดท่าขาออก)
    const own = get(S)
    const ownHeavy = isHeavy(S)
    if (ownHeavy) {
      const t = target(isFree)
      if (t) { const e = get(t); e.src = own.src; e.drop = [...own.drop] }
    }
    for (const h of range) {
      if (!ok(h) || h >= gate || !isHeavy(h)) continue
      const t = target((d) => d !== h && !isHeavy(d))
      if (t) { const a = get(h), b = get(t), keep = { ...a, drop: [...a.drop] }; a.src = b.src; a.drop = b.drop; b.src = keep.src; b.drop = keep.drop }
      else withDrop(get(h), legIds(get(h)))
    }
    // (b) เซสชันผสม (เช่น Pull 2 + RDL) ที่ตกก่อน gate: ตัดเฉพาะท่าขา เก็บส่วนบนไว้
    for (const d of range) if (ok(d) && d < gate && eff(d).kind === 'train' && legShare(eff(d)) > 0) withDrop(get(d), legIds(get(d)))
    // (c) เซสชันที่ข้ามไปไม่ใช่ขาเป็นหลัก → ชดเชยในวันพัก/เดินว่างแรก (ถ้าตกก่อน gate ตัดท่าขาด้วย)
    if (!ownHeavy && own && days[own.src].kind === 'train' && eff(S).items.length) {
      const t = range.find((d) => ok(d) && isFree(d))
      if (t) { const e = get(t); e.src = own.src; e.drop = [...own.drop]; if (t < gate) withDrop(e, legIds(e)) }
    }
  }

  const out = {}
  for (const [d, e] of sched) {
    const a = {}
    if (e.src !== idx(d)) a.as = e.src
    if (e.drop.length) a.drop = e.drop
    if (Object.keys(a).length) out[d] = a
  }
  return out
}

/** บรรทัดสรุปการปรับของวันหนึ่ง สำหรับแสดงใน UI */
export function describeAdj(plan, date, adj) {
  const name = DAY_SHORT[idx(date)] + '.'
  const out = []
  if (Number.isInteger(adj?.as) && plan?.days?.[adj.as]) out.push(`${name} ${plan.days[adj.as].name} (ย้ายมาจาก ${DAY_SHORT[adj.as]}.)`)
  const names = (adj?.drop || []).map((id) => byId[id]?.th).filter(Boolean)
  if (names.length) out.push(`${name} ตัด ${names.join(', ')}`)
  return out
}
