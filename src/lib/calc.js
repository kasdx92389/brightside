// สูตรคำนวณสุขภาพ — BMI ใช้เกณฑ์เอเชีย/กรมอนามัยไทย

export const bmi = (kg, cm) => kg / (cm / 100) ** 2

export const BMI_BANDS = [
  { max: 18.5, label: 'น้ำหนักน้อย', tone: 'info' },
  { max: 23, label: 'สมส่วน', tone: 'good' },
  { max: 25, label: 'ท้วม', tone: 'warn' },
  { max: 30, label: 'อ้วนระดับ 1', tone: 'bad' },
  { max: Infinity, label: 'อ้วนระดับ 2', tone: 'bad' },
]
export const bmiBand = (b) => BMI_BANDS.find((x) => b < x.max)

// น้ำหนักที่ BMI 18.5–22.9 ที่ส่วนสูงนี้
export const healthyRange = (cm) => [18.5, 22.9].map((b) => Math.round(b * (cm / 100) ** 2 * 10) / 10)

// Mifflin–St Jeor
export const bmr = ({ sex, weight, height, age }) =>
  10 * weight + 6.25 * height - 5 * age + (sex === 'f' ? -161 : 5)

const ACTIVITY = (days) => (days <= 2 ? 1.375 : days <= 4 ? 1.465 : 1.55)
const GOAL_KCAL = { lose: -400, fit: 0, muscle: 300 }

export function targets(p) {
  const tdee = bmr(p) * ACTIVITY(p.days)
  const floor = p.sex === 'f' ? 1200 : 1500
  const kcal = Math.max(floor, Math.round((tdee + GOAL_KCAL[p.goal]) / 50) * 50)
  const pr = (k) => Math.round((p.weight * k) / 5) * 5
  return {
    tdee: Math.round(tdee),
    kcal,
    protein: [pr(1.6), pr(p.goal === 'muscle' ? 2.2 : 2.0)],
    water: Math.round((p.weight * 35) / 100) / 10, // ลิตร
  }
}

export const dateKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
// 0 = จันทร์ … 6 = อาทิตย์
export const dayIdx = (d = new Date()) => (d.getDay() + 6) % 7
export const DAY_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
export const DAY_SHORT = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
