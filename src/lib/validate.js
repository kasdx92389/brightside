// ตรวจแบบฟอร์มโปรไฟล์ (แยกเป็นไฟล์ล้วนเพื่อทดสอบใน Node ได้)
import { healthyRange } from './calc.js'

export const RANGE = { age: [12, 90, 'อายุ 12–90 ปี'], weight: [30, 250, 'น้ำหนัก 30–250 กก.'], height: [120, 230, 'ส่วนสูง 120–230 ซม.'] }
export function validate(f, touched = {}) {
  const e = {}
  if (!f.name.trim()) e.name = 'ใส่ชื่อก่อน'
  for (const k in RANGE) {
    const n = Number(f[k])
    if (!f[k] || !(n >= RANGE[k][0] && n <= RANGE[k][1])) e[k] = RANGE[k][2]
  }
  if (f.target && !(Number(f.target) >= 30 && Number(f.target) <= 250)) e.target = 'เป้าหมาย 30–250 กก.'
  else if (f.target && Number(f.height) >= 120) { const [lo] = healthyRange(Number(f.height)); if (Number(f.target) < lo) e.target = `น้ำหนักเป้าหมายต่ำกว่าเกณฑ์น้ำหนักน้อย (BMI < 18.5 = ต่ำกว่า ${lo} กก. ที่ส่วนสูงนี้) ไม่ปลอดภัย ตั้งไม่ต่ำกว่า ${lo} กก.` }
  return Object.fromEntries(Object.entries(e).filter(([k]) => touched.all || touched[k]))
}
export const isValid = (f) => Object.keys(validate(f, { all: true })).length === 0
