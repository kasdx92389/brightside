// อารมณ์รายวัน — เก็บใน logs[date].mood = { m: id, note: ข้อความสั้น, at: เวลาแก้ไข }
// v = ระดับ 1–5 (ใช้สรุป/เทียบเท่านั้น ไม่ได้แสดงเป็นคะแนนให้ผู้ใช้) · c = สีตัวหน้ายิ้ม
import { addDays } from './coach.js'

export const NOTE_MAX = 280

// เรียงเป็น 2 แถว × 5 : แถวบนอารมณ์ดี แถวล่างอารมณ์หนัก
export const MOODS = [
  { id: 'joy', th: 'ดีมาก', c: '#f4a259', v: 5 },
  { id: 'proud', th: 'ภูมิใจ', c: '#7fd1c7', v: 5 },
  { id: 'happy', th: 'สุขใจ', c: '#f9d56e', v: 4 },
  { id: 'love', th: 'อบอุ่น', c: '#f4aaa4', v: 4 },
  { id: 'calm', th: 'สงบ', c: '#8fd49b', v: 4 },
  { id: 'meh', th: 'เฉยๆ', c: '#b9c4c2', v: 3 },
  { id: 'tired', th: 'เหนื่อย', c: '#bfa9cb', v: 2 },
  { id: 'sad', th: 'เศร้า', c: '#8fadcf', v: 2 },
  { id: 'cry', th: 'แย่มาก', c: '#546a9c', v: 1 },
  { id: 'angry', th: 'หงุดหงิด', c: '#ee6470', v: 2 },
]
export const MOOD_BY = Object.fromEntries(MOODS.map((m) => [m.id, m]))

export const moodOf = (log) => MOOD_BY[log?.mood?.m] || null
export const noteOf = (log) => (typeof log?.mood?.note === 'string' ? log.mood.note.trim() : '')
export const isLow = (m) => !!m && m.v <= 2
export const isHigh = (m) => !!m && m.v >= 4

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** ข้อความที่ตัวเองเคยเขียนไว้ตอนอารมณ์ดี (≥8 ตัวอักษร) ใช้ให้กำลังใจ — เลือกคงที่ตามวันที่ ไม่เปลี่ยนทุกครั้งที่เปิด */
export function pastEncouragement(logs, date, today) {
  const pool = Object.keys(logs).filter((d) => d !== date && d <= today && isHigh(moodOf(logs[d])) && noteOf(logs[d]).length >= 8).sort()
  if (!pool.length) return null
  const d = pool[hash(date) % pool.length]
  return { date: d, mood: moodOf(logs[d]), note: noteOf(logs[d]) }
}

// ประโยคกลางๆ ใช้เมื่อยังไม่มีข้อความเก่าของตัวเอง — ไม่วินิจฉัย ไม่สัญญาเกินจริง
export const KIND_LINES = [
  'วันที่ไม่ค่อยดีไม่ได้ลบสิ่งที่คุณทำมาทั้งหมด พักก็เป็นส่วนหนึ่งของการฝึก',
  'ไม่ต้องทำให้ครบทุกอย่างวันนี้ แค่ดูแลตัวเองเท่าที่ไหวก็พอ',
  'ความรู้สึกแบบนี้ผ่านไปได้ จดไว้ แล้วกลับมาอ่านตอนที่ดีขึ้น',
  'ถ้าวันนี้ไหวแค่เดินเบาๆ หรือยืดเส้น นั่นก็ยังนับว่าไม่ทิ้งตัวเอง',
]
export const kindLine = (date) => KIND_LINES[hash(date) % KIND_LINES.length]

/** อารมณ์ที่บันทึกในช่วง n วันล่าสุด (รวมวันนี้) เรียงเก่า→ใหม่ */
export function recentMoods(logs, today, n = 7) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i)
    const m = moodOf(logs[d])
    if (m) out.push({ date: d, mood: m })
  }
  return out
}

/** อารมณ์หนักต่อเนื่อง: บันทึก ≥5 จาก 7 วันล่าสุด และ ≥5 ครั้งเป็นอารมณ์หนัก */
export function sustainedLow(logs, today) {
  const r = recentMoods(logs, today, 7)
  return r.length >= 5 && r.filter((x) => isLow(x.mood)).length >= 5
}

/** สรุปเดือน ym = 'YYYY-MM' → { n, counts, hi, lo, headline } */
export function monthSummary(logs, ym) {
  const entries = Object.keys(logs).filter((d) => d.startsWith(ym) && moodOf(logs[d])).map((d) => moodOf(logs[d]))
  const n = entries.length
  const counts = {}
  for (const m of entries) counts[m.id] = (counts[m.id] || 0) + 1
  const hi = entries.filter(isHigh).length, lo = entries.filter(isLow).length
  const headline = !n ? '' : n < 3 ? 'เริ่มบันทึกแล้ว เก็บไปเรื่อยๆ นะ' : hi / n >= 0.6 ? 'เดือนนี้ยิ้มมากหน่อย' : lo / n >= 0.4 ? 'เดือนนี้หนักหน่อย ใจดีกับตัวเองนะ' : 'เดือนนี้มีหลายอารมณ์ ก็เป็นเรื่องปกติ'
  return { n, counts, hi, lo, headline }
}

/** อารมณ์เฉลี่ยวันที่ฝึกครบ เทียบวันอื่น (ต้องมีอย่างน้อย 4 วันทั้งสองกลุ่ม) — เป็นความสัมพันธ์ ไม่ใช่เหตุและผล */
export function moodVsTraining(logs) {
  const a = [], b = []
  for (const l of Object.values(logs)) {
    const m = moodOf(l)
    if (m) (l.finished ? a : b).push(m.v)
  }
  if (a.length < 4 || b.length < 4) return null
  const avg = (x) => Math.round((x.reduce((s, v) => s + v, 0) / x.length) * 10) / 10
  return { train: avg(a), other: avg(b), nT: a.length, nO: b.length }
}

export const validDate = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k || '') && !Number.isNaN(Date.parse(k + 'T00:00:00')) && addDays(k, 0) === k
export const validMonth = (k) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k || '')
