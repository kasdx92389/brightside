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

/**
 * วัยรุ่น 12–17 ปี: พลังงานที่ต้องการโดยประมาณ (IOM DRI 2002/2005 สำหรับอายุ 9–18 ปี รวม +25 kcal เพื่อการเติบโต)
 * Mifflin–St Jeor ตั้งขึ้นสำหรับผู้ใหญ่ จึงไม่ใช้กับวัยรุ่น · PA: ฝึก ≤4 วัน/สัปดาห์ = low active · ≥5 วัน = active (เลือกฝั่งต่ำไว้ก่อน เพราะวัยรุ่นยังโต กินเกินไปมีผลเรื้อรัง)
 * หมายเหตุ: NASEM ออก DRI พลังงานฉบับปรับปรุงปี 2023 ที่ใช้ค่า PA ต่างจากนี้ในเด็ก/วัยรุ่น ค่านี้เป็นค่าประมาณเท่านั้น
 */
export function teenEER({ sex, weight: wt, height, age, days }) {
  const h = height / 100
  // สมการ IOM ตั้งสำหรับเด็กน้ำหนักปกติ: ถ้าน้ำหนักเกินมาก จะประเมินสูงเกินจริง (เช่น 140 กก. → 6,000 kcal) จึงใช้ได้ไม่เกินน้ำหนักที่ BMI 22 ของส่วนสูงนั้น
  const weight = Math.min(wt, 22 * h * h)
  const pa = (sex === 'f' ? [1.16, 1.31] : [1.13, 1.26])[days <= 4 ? 0 : 1]
  return sex === 'f' ? 135.3 - 30.8 * age + pa * (10 * weight + 934 * h) + 25 : 88.5 - 61.9 * age + pa * (26.7 * weight + 903 * h) + 25
}
// พลังงานส่วนเพิ่มตามสถานะ: ตั้งครรภ์ไตรมาส 2 +340 · ไตรมาส 3 +452 (IOM) · ให้นมบุตร 6 เดือนแรก ≈ +330
const PREG_ADD = { 1: 0, 2: 340, 3: 452, pp: 330 }

const ACTIVITY = (days) => (days <= 2 ? 1.375 : days <= 4 ? 1.465 : 1.55)
const r = (v, step) => Math.round(v / step) * step

/**
 * ปรับพลังงานตามเป้าหมาย + BMI (เกณฑ์เอเชีย) + อายุ → { delta kcal, mode, notes[] }
 * หลักคิด: BMI ต่ำกว่าเกณฑ์ต้องเพิ่ม ไม่ลด · วัยรุ่นไม่ขาดดุล · 60+ จำกัดการขาดดุล · BMI สูงลดได้มากขึ้นแต่ไม่เกิน ~0.5–1% น้ำหนัก/สัปดาห์
 */
function adjust(p, b) {
  const teen = p.age < 18, senior = p.age >= 60, notes = []
  const preg = !!p.preg && p.preg !== 'none'
  const say = (tone, text) => notes.push({ tone, text })
  let delta = 0, mode = 'maintain'
  if (preg) {
    // ตั้งครรภ์/ให้นมบุตร: ไม่ขาดดุลไม่ว่าเลือกเป้าหมายใด พลังงานส่วนเพิ่มคิดใน targets()
    say('warn', p.goal === 'lose' ? 'ช่วงตั้งครรภ์/ให้นมบุตร แอพไม่ตั้งขาดดุลแคลอรี่ แม้เลือกเป้าหมายลดไขมัน เน้นกินให้ครบและขยับร่างกายเบาๆ' : 'ช่วงตั้งครรภ์/ให้นมบุตร: ค่าพลังงานและสารอาหารเป็นค่าประมาณทั่วไป ควรให้สูติแพทย์/นักกำหนดอาหารกำหนดตามน้ำหนักที่ควรขึ้นของคุณ')
  } else if (b < 18.5) {
    delta = p.goal === 'muscle' ? 400 : 300; mode = 'gain'
    say('info', `BMI ${b.toFixed(1)} ต่ำกว่าเกณฑ์ (<18.5) แอพจึงตั้งพลังงานให้เกินดุล ${delta} kcal เพื่อค่อยๆ เพิ่มน้ำหนัก แม้เลือกเป้าหมายอื่น ถ้าน้ำหนักน้อยผิดปกติหรือเบื่ออาหารต่อเนื่อง ควรปรึกษาแพทย์`)
  } else if (p.goal === 'lose') {
    if (teen) { say('info', 'อายุต่ำกว่า 18 ปี ร่างกายยังเติบโต แอพไม่ตั้งพลังงานขาดดุล เน้นฝึกและกินให้ครบ ให้น้ำหนักนิ่งขณะส่วนสูงเพิ่ม ถ้าต้องการลดน้ำหนักควรปรึกษาแพทย์หรือนักกำหนดอาหาร') }
    else if (b < 23) { delta = -250; mode = 'cut'; say('info', `BMI ${b.toFixed(1)} สมส่วนแล้ว จึงลดเบาๆ เพียง 250 kcal เน้นลดไขมันและรักษากล้ามเนื้อ ไม่ควรลดเร็ว`) }
    else if (b >= 27.5) { delta = -500; mode = 'cut'; say('warn', `BMI ${b.toFixed(1)} ≥ 27.5 (เสี่ยงสูงตามเกณฑ์เอเชีย) ตั้งขาดดุล 500 kcal ลดราว 0.5 กก./สัปดาห์ ถ้ามีเบาหวาน ความดัน หรือโรคประจำตัว ควรปรึกษาแพทย์ก่อน`) }
    else { delta = -400; mode = 'cut' }
  } else if (p.goal === 'muscle') {
    if (teen) { delta = 200; mode = 'bulk' }
    else if (b < 23) { delta = 300; mode = 'bulk' }
    else if (b < 25) { delta = 200; mode = 'bulk' }
    else { say('info', `BMI ${b.toFixed(1)} ≥ 25: สร้างกล้ามเนื้อพร้อมลดไขมันได้โดยไม่ต้องกินเกิน (โดยเฉพาะมือใหม่) แอพตั้งพลังงานเท่าที่ใช้ ร่วมกับโปรตีนสูงและเวท`); mode = 'recomp' }
  } else if (!teen) {
    if (b >= 30) { delta = -300; mode = 'cut'; say('warn', `BMI ${b.toFixed(1)} ≥ 30 แอพตั้งขาดดุล 300 kcal เพื่อลดน้ำหนักช้าๆ ควบคู่การออกกำลังกาย`) }
    else if (b >= 25) { delta = -200; mode = 'cut'; say('info', `BMI ${b.toFixed(1)} ≥ 25 (เกินเกณฑ์เอเชีย) แอพตั้งขาดดุลเบาๆ 200 kcal`) }
  }
  if (senior) {
    if (delta < -300) delta = -300
    say('info', 'อายุ 60+: กระจายโปรตีนทุกมื้อ มื้อละ 25–30 g เพื่อรักษากล้ามเนื้อ และจิบน้ำสม่ำเสมอแม้ไม่รู้สึกกระหาย (ความกระหายลดลงตามวัย)')
  }
  if (p.sex === 'f') say('info', 'ผู้หญิง: ใส่ใจแคลเซียมราว 800–1,000 มก./วัน (นม เต้าหู้ ปลาเล็กปลาน้อย ผักใบเขียว) และธาตุเหล็ก (เนื้อแดง ไข่ ผักใบเขียวเข้ม กินคู่ผลไม้วิตามินซี)')
  if (teen) say('info', 'วัยรุ่น: ไม่ควรอดอาหารหรือลดน้ำหนักเร็ว กินให้ครบ 3 มื้อ โปรตีนทุกมื้อ นอน 8–10 ชั่วโมง')
  say('info', 'โซเดียมไม่เกิน 2,000 มก./วัน (เกลือไม่เกิน 1 ช้อนชา) ระวังน้ำซุป น้ำจิ้ม ของหมักดอง และเครื่องปรุง')
  return { delta, mode, notes }
}

/** เป้าโภชนาการรายบุคคล — น้ำวันฝึกเพิ่ม 0.5 ลิตร (ดื่ม 400–600 มล. ก่อนฝึก 2 ชม. ตามแนวทาง ACSM) */
export function targets(p) {
  const b = bmi(p.weight, p.height)
  const preg = !!p.preg && p.preg !== 'none'
  const tdee = (p.age < 18 ? teenEER(p) : bmr(p) * ACTIVITY(p.days)) + (preg ? PREG_ADD[p.preg] || 0 : 0)
  const { delta, mode, notes } = adjust(p, b)
  const floor = p.sex === 'f' ? 1200 : 1500
  // ผู้ใช้กดยืนยันปรับเป้าตามน้ำหนักที่เปลี่ยนจริง (lib/review.js) — จำกัด ±300 และไม่ใช้กับอายุ <18
  const adj = p.age < 18 || preg ? 0 : Math.max(-300, Math.min(300, Number(p.kcalAdj) || 0))
  const kcal = Math.max(floor, r(tdee + delta + adj, 50))
  // BMI > 25 คิดโปรตีนจากน้ำหนักปรับ (ไม่ให้เกินจริงในคนน้ำหนักมาก)
  const ibw = 22 * (p.height / 100) ** 2
  const refW = b > 25 ? ibw + 0.25 * (p.weight - ibw) : p.weight
  const [lo, hi] = p.age < 18 || p.age >= 60 ? [1.2, 1.6] : p.goal === 'muscle' ? [1.6, 2.2] : delta < 0 ? [1.6, 2.0] : [1.4, 1.8]
  const protein = [r(refW * lo, 5), r(refW * hi, 5)]
  const fat = Math.max(r((kcal * 0.27) / 9, 1), Math.round(refW * 0.6))
  const carb = Math.max(100, r((kcal - ((protein[0] + protein[1]) / 2) * 4 - fat * 9) / 4, 5))
  const base = Math.min(3.5, Math.max(p.age >= 60 ? 1.6 : 1.8, p.weight * 0.033))
  if (adj) notes.unshift({ tone: 'info', text: `เป้าพลังงานถูกปรับ ${adj > 0 ? '+' : ''}${adj} kcal จากสูตรมาตรฐาน ตามน้ำหนักที่เปลี่ยนจริงของคุณ (ยกเลิกได้ที่หน้า “ความคืบหน้า”)` })
  const hydr = preg ? (p.preg === 'pp' ? 0.7 : 0.3) : 0 // ตั้งครรภ์/ให้นมบุตรต้องการน้ำมากขึ้น (ค่าประมาณ)
  if (['heart', 'chronic', 'meds'].some((k) => (p.screen || []).includes(k))) notes.push({ tone: 'warn', text: 'คุณระบุว่ามีโรคเรื้อรัง/ยาประจำ ค่าแคลอรี่ โปรตีน น้ำ และโซเดียมในแอพเป็นค่ามาตรฐานทั่วไป ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนยึดเป็นเป้า (เช่น โรคไต ต้องจำกัดโปรตีน/น้ำ เบาหวาน ต้องคุมคาร์บ)' })
  notes.push({ tone: 'info', text: 'โปรตีนสูงเกิน ~1.6 g/กก. ไม่จำเป็นสำหรับคนส่วนใหญ่ ผู้ที่เป็นโรคไตควรปรึกษาแพทย์ก่อนเพิ่มโปรตีน' })
  const glasses = (train) => Math.ceil((base + hydr + (train ? 0.5 : 0)) * 4) // แก้ว 250 มล.
  return {
    tdee: Math.round(tdee), kcal, protein, fat, carb, mode, delta, bmi: b, notes,
    fiber: Math.ceil((kcal / 1000) * 14), // 14 g ต่อ 1,000 kcal
    sugar: r((kcal * 0.05) / 4, 1), // น้ำตาลเติม ≤ 5% ของพลังงาน (WHO)
    sodium: 2000,
    water: Math.round((base + hydr) * 10) / 10, waterTrain: Math.round((base + hydr + 0.5) * 10) / 10, glasses,
  }
}

/** แบ่งเป้าตามมื้อ: เช้า 25% · กลางวัน 30% · เย็น 30% · ว่าง/รอบฝึก 15% */
export const MEAL_SLOTS = [['เช้า', 0.25], ['กลางวัน', 0.3], ['เย็น', 0.3], ['ว่าง', 0.15]]
export const mealTargets = (t) => MEAL_SLOTS.map(([n, s]) => ({ n, kcal: r(t.kcal * s, 10), protein: r(((t.protein[0] + t.protein[1]) / 2) * s, 5) }))

export const dateKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
// 0 = จันทร์ … 6 = อาทิตย์
export const dayIdx = (d = new Date()) => (d.getDay() + 6) % 7
export const DAY_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
export const DAY_SHORT = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
