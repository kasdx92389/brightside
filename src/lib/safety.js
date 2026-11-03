// ความปลอดภัยของแผนตามโปรไฟล์ — คัดกรองก่อนออกกำลังกาย · ข้อจำกัดท่าตามอายุ/BMI/ตั้งครรภ์ · ตรวจ/แก้แผนที่มีท่าไม่เหมาะ
// หลักคิด (ตรงตามจริง): แนวคิดคัดกรองมาจาก PAR-Q+ (มาตรฐานสากลของการคัดกรองก่อนออกกำลัง) · ตั้งครรภ์อิง Canadian guideline 2019 / ACOG CO 804 ·
//   ผู้สูงอายุต้องมีการฝึกทรงตัวร่วมกับแรง (ESSA 2025) · รายการท่าที่เลี่ยงเป็นข้อควรระวังที่แอพกำหนดเอง ไม่ใช่ผลวิจัยรายท่า — ไม่ใช่คำแนะนำทางการแพทย์
import { bmi } from './calc.js'
import { EXERCISES, byId } from '../data/exercises.js'

/** แบบคัดกรอง 7 ข้อ (แนวเดียวกับ PAR-Q+) — ติ๊กข้อที่ตรงกับคุณ */
export const SCREEN = [
  ['heart', 'แพทย์เคยบอกว่ามีโรคหัวใจ หรือความดันโลหิตสูง'],
  ['chest', 'เจ็บหรือแน่นหน้าอก ตอนพัก ทำกิจวัตร หรือตอนออกแรง'],
  ['dizzy', 'เวียนหัวจนเสียการทรงตัว หรือเคยหมดสติ ภายใน 12 เดือนที่ผ่านมา'],
  ['chronic', 'มีโรคเรื้อรังอื่น เช่น เบาหวาน โรคไต โรคปอด หอบหืดที่คุมไม่ได้'],
  ['meds', 'กินยารักษาโรคเรื้อรังอยู่ประจำ'],
  ['joint', 'มีปัญหากระดูก ข้อ หรือเนื้อเยื่ออ่อน (รวมที่เป็นภายใน 12 เดือน) ที่อาจแย่ลงเมื่อออกกำลังกาย'],
  ['supervised', 'แพทย์เคยบอกให้ออกกำลังกายภายใต้การดูแลของแพทย์เท่านั้น'],
]
export const PREG = [
  ['none', 'ไม่ได้ตั้งครรภ์ และไม่ได้ให้นมบุตร'],
  ['1', 'ตั้งครรภ์ ไตรมาสที่ 1 (ถึงสัปดาห์ที่ 13)'],
  ['2', 'ตั้งครรภ์ ไตรมาสที่ 2 (สัปดาห์ที่ 14–27)'],
  ['3', 'ตั้งครรภ์ ไตรมาสที่ 3 (สัปดาห์ที่ 28 ขึ้นไป)'],
  ['pp', 'หลังคลอด 6 เดือนแรก หรือกำลังให้นมบุตร'],
]
export const isPregnant = (p) => ['1', '2', '3'].includes(p?.preg)
export const pregActive = (p) => !!p?.preg && p.preg !== 'none'

// ───── ชุดท่าที่เลี่ยง (ทุก id ต้องมีในคลัง — มีเทสต์) ─────
export const IMPACT = ['jump-squat', 'rope-jumping', 'burpee', 'box-jump', 'jumping-jacks', 'plyo-pushup', 'mountain-climbers', 'treadmill-intervals', 'jogging', 'battle-ropes']
export const BALLISTIC = ['kettlebell-swing', 'kb-snatch', 'power-clean', 'clean-and-jerk', 'push-press']
export const OLYMPIC = ['power-clean', 'clean-and-jerk', 'kb-snatch']
export const HEAVY_HINGE = ['barbell-deadlift', 'rack-pull', 'sumo-deadlift', 'deficit-deadlift', 'good-morning'] // ยกหนักก้มตัว/กลั้นหายใจ
export const HEAVY_HINGE_ALL = [...HEAVY_HINGE, 'trap-bar-deadlift']
export const SUPINE = ['crunch', 'bicycle-crunch', 'sit-up', 'reverse-crunch', 'lying-leg-raise', 'flutter-kicks', 'v-up', 'heel-touch', 'oblique-crunch', 'dead-bug', 'barbell-bench', 'db-bench-press', 'db-fly', 'db-pullover', 'skullcrusher', 'close-grip-bench', 'smith-bench', 'glute-bridge', 'hip-thrust']
export const PRONE = ['superman', 'hyperextension', 'plank', 'mountain-climbers', 'ab-roller', 'glute-ham-raise']

/**
 * ข้อจำกัดของแผนตามโปรไฟล์ → { maxLevel, avoid:Set, balance, careful, reasons[] }
 * ผู้ใช้ที่ไม่เข้าเงื่อนไขใด ๆ ได้ maxLevel 3 ไม่มีท่าต้องเลี่ยง (ไม่เปลี่ยนจากเดิม)
 */
export function planLimits(p) {
  const L = { maxLevel: 3, avoid: new Set(), balance: false, careful: false, reasons: [] }
  if (!p) return L
  const age = Number(p.age), b = p.weight && p.height ? bmi(p.weight, p.height) : 0
  const ban = (ids, lvl) => { ids.forEach((id) => L.avoid.add(id)); if (lvl) L.maxLevel = Math.min(L.maxLevel, lvl) }
  const why = (t) => L.reasons.push(t)
  const yes = (p.screen || []).filter((k) => SCREEN.some(([id]) => id === k))

  if (yes.length) { ban([...IMPACT, ...BALLISTIC, ...HEAVY_HINGE_ALL], 1); L.careful = true; why('คัดกรองสุขภาพมีข้อที่ตรง → แผนเบา ไม่มีท่ากระแทก/แรงเหวี่ยง/ยกหนักก้มตัว') }
  if (pregActive(p)) {
    ban([...IMPACT, ...BALLISTIC, ...HEAVY_HINGE_ALL], 2); L.careful = true
    if (['2', '3'].includes(p.preg)) ban([...SUPINE, ...PRONE])
    why(isPregnant(p) ? 'ตั้งครรภ์ → ไม่มีท่ากระแทก/แรงเหวี่ยง/ยกหนักกลั้นหายใจ' + (['2', '3'].includes(p.preg) ? ' และไม่มีท่านอนหงาย/นอนคว่ำ' : '') : 'หลังคลอด/ให้นมบุตร → ไม่มีท่ากระแทกและแรงเหวี่ยง')
  }
  if (age < 18) { ban([...OLYMPIC, ...HEAVY_HINGE], 2); L.careful = true; why('อายุต่ำกว่า 18 ปี → ไม่มีท่ายกโอลิมปิก/ยกหนักก้มตัว ฝึกกับผู้ใหญ่หรือครูฝึกที่ดูท่าให้') }
  if (age >= 65) { ban([...IMPACT, ...BALLISTIC, ...HEAVY_HINGE], 2); L.balance = true; L.careful = true; why('อายุ 65+ → ไม่มีท่ากระแทก/แรงเหวี่ยง และเพิ่มท่าทรงตัวทุกวันฝึก') }
  else if (age >= 50) ban(OLYMPIC)
  if (b >= 30) { ban(IMPACT); why('BMI ≥ 30 → ลดท่ากระแทกเพื่อถนอมข้อต่อ เน้นเดิน ปั่น หรือเครื่องเอลลิปติคอล') }
  return L
}

/** ท่านี้ไม่เหมาะกับโปรไฟล์ไหม → ข้อความเหตุผล หรือ '' */
export function whyAvoid(id, p) {
  const L = planLimits(p), e = byId[id]
  if (!e) return ''
  if (L.avoid.has(id)) return 'ท่านี้ไม่แนะนำสำหรับข้อมูลสุขภาพ/อายุของคุณ (' + L.reasons.join(' · ') + ')'
  if (e.lv > L.maxLevel) return 'ท่านี้ยากเกินระดับที่แนะนำให้คุณตอนนี้'
  return ''
}

/** ท่าในแผนที่ขัดกับข้อจำกัด → [{ di, k, id }] */
export function planConflicts(plan, p) {
  const L = planLimits(p), out = []
  plan?.days?.forEach((d, di) => d.items?.forEach((it, k) => { const e = byId[it.id]; if (e && (L.avoid.has(it.id) || e.lv > L.maxLevel)) out.push({ di, k, id: it.id }) }))
  return out
}

const ALLOWED = { gym: ['bw', 'db', 'bb', 'cable', 'machine', 'band'], db: ['bw', 'db', 'band'], home: ['bw'] }
const rxOf = (e) => { const m = String(e.rx).match(/^(\d+)\s*×\s*(.+)$/); return m ? { sets: Number(m[1]), reps: m[2] } : { sets: 1, reps: e.rx } }

/** แทนท่าที่ขัดข้อจำกัดด้วยท่าปลอดภัยในกลุ่มเดียวกัน (ใกล้เคียงชนิด/ระดับ/อุปกรณ์) ไม่มีท่าแทน → ตัดออก · ส่วนอื่นของแผนไม่แตะ */
export function fixPlan(plan, p) {
  const L = planLimits(p)
  const equip = ALLOWED[p.equip] || ALLOWED.gym
  const maxLv = Math.min(Number(p.level) || 1, L.maxLevel)
  const days = plan.days.map((d) => {
    if (!d.items?.length) return d
    const used = new Set(d.items.map((i) => i.id))
    const items = d.items.flatMap((it) => {
      const e = byId[it.id]
      if (!e || (!L.avoid.has(e.id) && e.lv <= L.maxLevel)) return [it]
      const alt = EXERCISES.filter((x) => x.g === e.g && !used.has(x.id) && !L.avoid.has(x.id) && x.lv <= maxLv && equip.includes(x.eq))
        .sort((a, b) => (a.k !== e.k) - (b.k !== e.k) || Math.abs(a.lv - e.lv) - Math.abs(b.lv - e.lv) || (a.eq !== e.eq) - (b.eq !== e.eq))[0]
      if (!alt) return []
      used.add(alt.id)
      const rx = rxOf(alt)
      return [{ id: alt.id, sets: e.g === 'cardio' ? 1 : rx.sets, reps: e.g === 'cardio' ? it.reps : rx.reps }]
    })
    return { ...d, items }
  })
  return { ...plan, days }
}
