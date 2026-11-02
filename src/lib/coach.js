// ตรรกะ "โค้ช": แนะนำเพิ่มน้ำหนัก สัปดาห์เบา เป้าหมายน้ำหนัก เหรียญรางวัล — ฟังก์ชันล้วน ทดสอบได้ใน scripts/check.mjs

const topReps = (s) => Number(String(s).match(/(\d+)(?!.*\d)/)?.[1]) || 0 // '10–12' → 12
export const isTimed = (reps) => /นาที|วินาที|เมตร/.test(reps)

/** วินาทีสูงสุดของท่าที่นับเวลา (ไว้ตั้ง timer) — null ถ้าไม่ใช่เวลา/ยาวเกิน 10 นาที */
export function timedSeconds(reps) {
  const m = String(reps).match(/(\d+)(?:–(\d+))?\s*(นาที|วินาที)/)
  if (!m) return null
  const s = Number(m[2] || m[1]) * (m[3] === 'นาที' ? 60 : 1)
  return s <= 600 ? s : null
}

/**
 * กฎจาก Artifact: ทำครบทุกเซ็ตที่ครั้งสูงสุดของช่วง (เช่น 12 ครั้ง) → ครั้งถัดไปเพิ่มน้ำหนัก
 * คืน { kg, was } หรือ null  (ท่าตัวเปล่า/ไม่มีบันทึกก่อนหน้า = null)
 */
export function overloadHint(logs, id, reps, before, step = 2.5) {
  const top = topReps(reps)
  if (!top || isTimed(reps)) return null
  for (const d of Object.keys(logs).sort().reverse()) {
    if (d >= before) continue
    const sets = logs[d].sets?.[id]
    if (!sets?.some((x) => x.done)) continue
    const done = sets.filter((x) => x.done)
    const kg = Math.max(...done.map((x) => Number(x.kg) || 0))
    if (!kg) return null
    const hit = done.length >= sets.length && done.every((x) => Number(x.reps) >= top && Number(x.kg) >= kg)
    return hit ? { kg: kg + step, was: kg } : null
  }
  return null
}

const DAY = 86400000
const parse = (k) => new Date(k + 'T00:00:00').getTime()
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY)
export const addDays = (k, n) => {
  const d = new Date(parse(k) + n * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ทุก 6–8 สัปดาห์ควรมีสัปดาห์เบา (2 เซ็ต/ท่า) */
export const DELOAD_AFTER_WEEKS = 6
export const inDeload = (s, date) => !!s.deloadUntil && date <= s.deloadUntil && date >= addDays(s.deloadUntil, -6)
export function deloadDue(s, today) {
  if (inDeload(s, today) || !s.plan?.startedAt) return false
  return daysBetween(s.plan.startedAt, today) >= DELOAD_AFTER_WEEKS * 7
}

/** ความคืบหน้าสู่น้ำหนักเป้าหมาย — รองรับทั้งลดและเพิ่ม */
export function goalProgress(weights, target) {
  if (!target || weights.length < 1) return null
  const start = weights[0].kg, now = weights.at(-1).kg
  if (start === target) return { pct: 1, left: 0, dir: 0 }
  const dir = target < start ? -1 : 1
  const pct = Math.min(Math.max((now - start) / (target - start), 0), 1)
  const left = Math.round(Math.abs(target - now) * 10) / 10
  return { pct, left: dir * (target - now) > 0 ? left : 0, dir }
}

/** เหรียญรางวัล คำนวณจากข้อมูลล้วน ไม่ต้องเก็บเพิ่ม */
export function achievements({ finished, streak, hasPR, lost, measured, waterDays }) {
  const a = (id, title, desc, value, goal) => ({ id, title, desc, value: Math.min(value, goal), goal, done: value >= goal })
  return [
    a('first', 'ก้าวแรก', 'จบการฝึกครั้งแรก', finished, 1),
    a('ten', 'เริ่มติดลม', 'จบการฝึกครบ 10 ครั้ง', finished, 10),
    a('thirty', 'ตัวจริง', 'จบการฝึกครบ 30 ครั้ง', finished, 30),
    a('streak7', 'ต่อเนื่อง 7 วัน', 'ทำตามแผนติดกัน 7 วัน', streak, 7),
    a('pr', 'สถิติใหม่', 'บันทึกน้ำหนักในท่าใดท่าหนึ่งครั้งแรก', hasPR ? 1 : 0, 1),
    a('lost', 'ลงตัว 2 กก.', 'น้ำหนักเปลี่ยนไปจากตอนเริ่ม 2 กก.', Math.abs(lost), 2),
    a('measure', 'วัดผลจริงจัง', 'บันทึกสัดส่วนร่างกาย 2 ครั้ง', measured, 2),
    a('water', 'ดื่มน้ำครบ', 'ดื่มน้ำถึงเป้า 5 วัน', waterDays, 5),
  ]
}
