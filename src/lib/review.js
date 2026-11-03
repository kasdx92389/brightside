// โค้ชปรับตามข้อมูลจริงของผู้ใช้: น้ำหนักที่เปลี่ยนจริง → ปรับเป้าแคลอรี่ · ความสม่ำเสมอ · กลุ่มกล้ามเนื้อที่ถูกข้าม · ความล้า
// ฟังก์ชันล้วน (ไม่แตะ store) รับ state s กับวันที่ today — ทุกข้อเสนอเป็น "คำแนะนำ" ให้ผู้ใช้กดยืนยันเอง ไม่แก้เป้าอัตโนมัติ
import { targets } from './calc.js'
import { addDays, daysBetween } from './coach.js'
import { moodOf, isLow, recentMoods } from './mood.js'
import { byId, GROUPS } from '../data/exercises.js'

export const ADJ_MAX = 300 // ปรับเป้าแคลอรี่สะสมได้ไม่เกิน ±300 kcal จากสูตรมาตรฐาน
export const ADJ_STEP = 150

const dow = (k) => (new Date(k + 'T00:00:00').getDay() + 6) % 7 // จันทร์ = 0

/** แนวโน้มน้ำหนักช่วง [from,to] แบบเส้นตรง (ต้อง ≥3 ครั้ง และกินช่วง ≥14 วัน กันความผันผวนของน้ำในร่างกาย) */
export function weightTrend(weights, from, to) {
  const w = weights.filter((x) => x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  if (w.length < 3) return null
  const span = daysBetween(w[0].date, w.at(-1).date)
  if (span < 14) return null
  const xs = w.map((x) => daysBetween(w[0].date, x.date)), ys = w.map((x) => x.kg)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (!den) return null
  const perDay = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den
  return { kgWk: Math.round(perDay * 7 * 100) / 100, pctWk: Math.round(((perDay * 7) / my) * 1000) / 10, n: w.length, span, from: w[0].date }
}

// ช่วงที่คาดหวังของการเปลี่ยนน้ำหนัก (%/สัปดาห์) ตามโหมดเป้าหมาย
// ลดไขมัน 0.5–1% (Helms 2014) · เพิ่มกล้าม 0.25–0.5% (Iraki 2019) — ทั้งคู่ศึกษาในนักเพาะกายธรรมชาติ ใช้เป็นแนวทางทั่วไป
export function expectedRange(t) {
  if (t.mode === 'cut') return t.delta <= -400 ? [-1.0, -0.4] : [-0.6, -0.2]
  if (t.mode === 'bulk' || t.mode === 'gain') return [0.15, 0.5]
  return [-0.3, 0.3]
}

const fedDays = (s, from, to) => {
  const ks = Object.keys(s.logs).filter((d) => d >= from && d <= to && (s.logs[d].food?.kcal || 0) > 0)
  const total = ks.reduce((n, d) => n + s.logs[d].food.kcal, 0)
  return { n: ks.length, avg: ks.length ? Math.round(total / ks.length) : 0 }
}

/**
 * ข้อเสนอปรับแคลอรี่จากน้ำหนักที่เปลี่ยนจริง
 * → null (ไม่เกี่ยว: อายุ <18) | { kind: 'wait'|'ok'|'behavior'|'adjust'|'cap', msg, trend?, delta? }
 */
export function calorieAdvice(s, today) {
  const p = s.profile
  if (!p || p.age < 18 || (p.preg && p.preg !== 'none')) return null
  const cur = Math.max(-ADJ_MAX, Math.min(ADJ_MAX, Number(p.kcalAdj) || 0))
  const from = [addDays(today, -28), p.kcalAdjAt].filter(Boolean).sort().at(-1)
  const tr = weightTrend(s.weights, from, today)
  if (!tr) return { kind: 'wait', msg: p.kcalAdjAt && p.kcalAdjAt > addDays(today, -28) ? `เพิ่งปรับเป้าเมื่อ ${p.kcalAdjAt} ให้เวลาอย่างน้อย 2 สัปดาห์ แล้วชั่งน้ำหนักอย่างน้อย 3 ครั้งก่อนประเมินใหม่` : 'ชั่งน้ำหนักอย่างน้อย 3 ครั้งในช่วง 2 สัปดาห์ขึ้นไป แอพจะดูแนวโน้มว่าเป้าแคลอรี่ตรงกับร่างกายคุณไหม' }
  const t = targets(p)
  const [lo, hi] = expectedRange(t)
  const food = fedDays(s, from, today)
  const info = `น้ำหนักเปลี่ยน ${tr.kgWk > 0 ? '+' : ''}${tr.kgWk} กก./สัปดาห์ (${tr.pctWk > 0 ? '+' : ''}${tr.pctWk}%) จาก ${tr.n} ครั้งใน ${tr.span} วัน · ที่คาดไว้ ${lo}% ถึง ${hi}%`
  if (tr.pctWk >= lo && tr.pctWk <= hi) return { kind: 'ok', trend: tr, msg: `${info} — เป้าตรงกับร่างกายคุณ คงไว้ได้` }

  const up = t.mode === 'bulk' || t.mode === 'gain' // ตั้งใจเพิ่มน้ำหนัก
  const lowFood = food.n >= 5 && food.avg < t.kcal * (up ? 0.9 : 0.85)
  let delta, why
  if (tr.pctWk < lo) { // ต่ำกว่าช่วงที่คาด → เพิ่มเป้า (ลดเร็วเกินหรือเพิ่มไม่ขึ้น)
    if (up && food.n < 5) return { kind: 'behavior', trend: tr, msg: `${info} · บันทึกอาหารอย่างน้อย 5 วันก่อน (ตอนนี้ ${food.n} วัน)` }
    if (lowFood) return { kind: 'behavior', trend: tr, msg: `${info} · คุณกินเฉลี่ย ${food.avg} kcal ต่ำกว่าเป้า ${t.kcal} กินให้ถึงเป้าก่อนแล้วดูผลอีกรอบ` }
    delta = ADJ_STEP
    const rapid = tr.pctWk < -1.5 ? ' · ลดเร็วเกิน 1.5%/สัปดาห์ โดยไม่ได้ตั้งใจ ควรปรึกษาแพทย์' : ''
    why = (up ? 'น้ำหนักยังไม่ขึ้นตามที่ตั้งใจ' : t.mode === 'cut' ? 'ลดเร็วเกินไป เสี่ยงเสียกล้ามเนื้อและล้าสะสม' : 'น้ำหนักลดทั้งที่ตั้งใจคงที่') + rapid
  } else { // สูงกว่าช่วงที่คาด → ลดเป้า (ลดไม่ลง หรือขึ้นเร็วเกิน)
    if (t.mode === 'cut') {
      if (food.n < 5) return { kind: 'behavior', trend: tr, msg: `${info} · บันทึกอาหารอย่างน้อย 5 วันก่อน แอพจะบอกได้ว่าควรลดเป้าหรือแค่กินให้ตรงเป้า (ตอนนี้ ${food.n} วัน)` }
      if (food.avg > t.kcal * 1.1) return { kind: 'behavior', trend: tr, msg: `${info} · แต่คุณกินเฉลี่ย ${food.avg} kcal เกินเป้า ${t.kcal} ปรับการกินให้ตรงเป้าก่อน ยังไม่ต้องลดเป้าเพิ่ม` }
      if (lowFood) return { kind: 'behavior', trend: tr, msg: `${info} · ที่บันทึกไว้ต่ำกว่าเป้ามาก (${food.avg} kcal) แต่น้ำหนักไม่ลง อาจบันทึกขาดหรือกินนอกบันทึก ลองชั่งปริมาณให้แม่นขึ้น` }
    }
    delta = -ADJ_STEP
    why = up ? 'น้ำหนักขึ้นเร็วกว่าที่ควร ส่วนเกินมักเป็นไขมัน' : t.mode === 'cut' ? 'น้ำหนักลดช้ากว่าที่คาด' : 'น้ำหนักเพิ่มทั้งที่ตั้งใจคงที่'
  }
  const next = cur + delta
  if (Math.abs(next) > ADJ_MAX) return { kind: 'cap', trend: tr, msg: `${info} · ปรับเป้าถึงขีดจำกัดแล้ว (±${ADJ_MAX} kcal) ลองดูการนอน กิจกรรม และความแม่นของบันทึกอาหาร หรือปรึกษานักกำหนดอาหาร` }
  const after = targets({ ...p, kcalAdj: next })
  if (after.kcal === t.kcal) return { kind: 'cap', trend: tr, msg: `${info} · เป้าอยู่ที่ขั้นต่ำที่ปลอดภัยแล้ว (${t.kcal} kcal) ไม่ควรลดอีก` }
  return { kind: 'adjust', trend: tr, delta, next, kcal: after.kcal, from: t.kcal, msg: `${info} · ${why}` }
}

/** ความสม่ำเสมอ 28 วันล่าสุด (ไม่นับวันที่กดข้าม/วันพัก/ก่อนเริ่มใช้ · วันนี้นับเมื่อฝึกแล้วเท่านั้น) */
export function adherence(s, today, days = 28) {
  let done = 0, miss = 0
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i)
    const day = s.plan?.days[dow(d)]
    if (!day || day.kind === 'rest' || d < s.createdAt || s.logs[d]?.skipped) continue
    if (s.logs[d]?.finished) done++
    else if (d < today) miss++
  }
  const n = done + miss
  return { done, miss, n, pct: n ? done / n : null }
}

/** เซ็ตตามแผน vs ที่ทำจริง แยกกลุ่มกล้ามเนื้อ 14 วันล่าสุด (ไม่นับวันนี้ที่ยังไม่จบ) → เฉพาะกลุ่มที่แผนมี ≥6 เซ็ต */
export function groupBalance(s, today, days = 14) {
  const acc = {}
  for (let i = days; i >= 1; i--) {
    const d = addDays(today, -i)
    const day = s.plan?.days[dow(d)]
    if (!day || day.kind === 'rest' || d < s.createdAt || s.logs[d]?.skipped) continue
    for (const it of day.items || []) {
      const e = byId[it.id]
      if (!e || e.g === 'cardio' || e.g === 'stretch') continue
      const a = (acc[e.g] ||= { planned: 0, done: 0 })
      a.planned += it.sets
      a.done += Math.min(it.sets, (s.logs[d]?.sets?.[it.id] || []).filter((x) => x?.done).length)
    }
  }
  const th = Object.fromEntries(GROUPS)
  return Object.entries(acc).filter(([, a]) => a.planned >= 6).map(([g, a]) => ({ g, th: th[g] || g, ...a, pct: a.done / a.planned, low: a.done / a.planned < 0.6 }))
}

/** ล้าสะสม: 7 วันล่าสุดบันทึกอารมณ์ ≥4 ครั้ง และ ≥3 ครั้งเป็นอารมณ์เหนื่อย/เศร้า/หงุดหงิด */
export function fatigueFlag(s, today) {
  const r = recentMoods(s.logs, today, 7)
  const low = r.filter((x) => isLow(x.mood)).length
  return r.length >= 4 && low >= 3 ? { low, n: r.length } : null
}

export { moodOf }
