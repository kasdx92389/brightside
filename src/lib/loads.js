// น้ำหนักเริ่มต้นที่แนะนำต่อท่า — ใช้เป็น placeholder ช่องน้ำหนัก เมื่อยังไม่เคยบันทึกท่านั้น
// เป็นจุดเริ่มต้นสำหรับ "เซ็ตทำงาน" ราว 10–12 ครั้งที่ยังเหลือแรงอีก 2–3 ครั้ง ไม่ใช่ค่ามาตรฐานสากลและไม่ใช่คำแนะนำทางการแพทย์
// ที่มา: สัดส่วนต่อน้ำหนักตัวของผู้ฝึกใหม่ (ปรับเทียบจากตารางมาตรฐานความแข็งแรงของผู้เริ่มต้น แล้วลดลงให้ปลอดภัย)
// ปรับตาม: BMI (เกณฑ์เอเชีย — ใช้มวลที่ไม่ใช่ไขมันเป็นฐาน) · เพศ · อายุ · ระดับประสบการณ์ · ชนิดอุปกรณ์

// id → [สัดส่วนต่อน้ำหนักตัวที่ใช้คำนวณ, ชนิด]  ชนิด: h = ดัมเบลข้างละ · t = ตัวเดียว/รวม · b = บาร์เบลรวมบาร์ · s = เครื่อง/เคเบิล (น้ำหนักที่สแตก)
const R = {
  // อก
  'machine-chest-press': [0.4, 's'], 'db-bench-press': [0.18, 'h'], 'incline-db-press': [0.16, 'h'], 'db-fly': [0.07, 'h'], 'incline-db-fly': [0.06, 'h'],
  'cable-crossover': [0.12, 's'], 'barbell-bench': [0.45, 'b'], 'incline-barbell-bench': [0.38, 'b'], 'pec-deck': [0.3, 's'], 'smith-bench': [0.35, 'b'], 'db-pullover': [0.15, 't'],
  // หลัง
  'seated-cable-row': [0.45, 's'], 'lat-pulldown': [0.5, 's'], 'vbar-pulldown': [0.45, 's'], 'reverse-grip-pulldown': [0.45, 's'], 'straight-arm-pulldown': [0.2, 's'],
  'db-row': [0.2, 'h'], 'bent-db-row': [0.17, 'h'], 'barbell-row': [0.4, 'b'], 'tbar-row': [0.35, 'b'], 'machine-row': [0.4, 's'], 'cable-one-arm-row': [0.2, 's'],
  'barbell-deadlift': [0.7, 'b'], 'rack-pull': [0.75, 'b'], 'trap-bar-deadlift': [0.7, 'b'], 'deficit-deadlift': [0.55, 'b'], 'good-morning': [0.25, 'b'],
  // ไหล่
  'shrug': [0.2, 'h'], 'lateral-raise': [0.05, 'h'], 'front-raise': [0.05, 'h'], 'reverse-fly': [0.04, 'h'], 'face-pull': [0.15, 's'], 'cable-lateral-raise': [0.04, 's'],
  'db-shoulder-press': [0.14, 'h'], 'arnold-press': [0.11, 'h'], 'barbell-ohp': [0.3, 'b'], 'push-press': [0.3, 'b'], 'machine-shoulder-press': [0.3, 's'], 'reverse-pec-deck': [0.2, 's'],
  // แขน
  'db-curl': [0.09, 'h'], 'hammer-curl': [0.1, 'h'], 'concentration-curl': [0.08, 'h'], 'incline-db-curl': [0.07, 'h'], 'barbell-curl': [0.2, 'b'], 'ez-bar-curl': [0.2, 'b'], 'preacher-curl': [0.18, 'b'],
  'cable-curl': [0.2, 's'], 'triceps-pushdown': [0.25, 's'], 'overhead-triceps-ext': [0.12, 't'], 'cable-overhead-triceps': [0.2, 's'], 'skullcrusher': [0.18, 'b'], 'close-grip-bench': [0.35, 'b'],
  'triceps-kickback': [0.05, 'h'], 'wrist-curl': [0.06, 'h'],
  // ขา-สะโพก
  'goblet-squat': [0.25, 't'], 'db-squat': [0.14, 'h'], 'db-sumo-squat': [0.22, 't'], 'db-lunge': [0.12, 'h'], 'reverse-lunge': [0.12, 'h'], 'split-squat': [0.12, 'h'], 'db-step-up': [0.1, 'h'],
  'db-rdl': [0.18, 'h'], 'leg-press': [1.0, 's'], 'hack-squat': [0.6, 's'], 'smith-squat': [0.4, 'b'], 'leg-extension': [0.35, 's'], 'leg-curl': [0.3, 's'], 'seated-leg-curl': [0.3, 's'],
  'calf-raise': [0.6, 's'], 'seated-calf-raise': [0.4, 's'], 'hip-abduction': [0.4, 's'], 'hip-adduction': [0.35, 's'], 'cable-kickback': [0.1, 's'], 'cable-pull-through': [0.25, 's'],
  'barbell-squat': [0.5, 'b'], 'rdl-barbell': [0.5, 'b'], 'hip-thrust': [0.7, 'b'], 'front-squat': [0.4, 'b'], 'overhead-squat': [0.15, 'b'], 'sumo-deadlift': [0.65, 'b'],
  // แกนลำตัว / ทั้งตัว
  'cable-crunch': [0.3, 's'], 'pallof-press': [0.1, 's'], 'woodchop': [0.12, 's'], 'machine-crunch': [0.3, 's'],
  'kettlebell-swing': [0.2, 't'], 'farmers-walk': [0.3, 'h'], 'thruster': [0.1, 'h'], 'kb-snatch': [0.12, 't'], 'turkish-getup': [0.08, 't'],
  'power-clean': [0.3, 'b'], 'clean-and-jerk': [0.25, 'b'],
}

const LOWER = new Set(['legs'])
const IDEAL_BMI = 22 // เกณฑ์เอเชีย: ใช้ส่วนสูงหาน้ำหนักฐาน แล้วนับน้ำหนักส่วนเกินเพียงบางส่วน เพราะส่วนเกินส่วนใหญ่เป็นไขมันไม่ได้เพิ่มแรง

/** น้ำหนักตัวที่ "ใช้คำนวณแรง" (ไม่ใช่น้ำหนักตัวจริงเมื่อ BMI สูง) */
export function effectiveWeight(weight, height) {
  const w = Number(weight), h = Number(height)
  if (!(w > 0 && h > 0)) return 0
  const ideal = IDEAL_BMI * (h / 100) ** 2
  const bmi = w / (h / 100) ** 2
  if (bmi < 18.5) return w * 0.9 // น้ำหนักน้อย: มวลกล้ามเนื้อมักน้อยตาม
  return w <= ideal ? w : ideal + 0.4 * (w - ideal)
}

const ageF = (a) => (a < 18 ? 0.7 : a < 40 ? 1 : a < 50 ? 0.9 : a < 60 ? 0.8 : a < 70 ? 0.65 : 0.55)
const levelF = (l) => [1, 1, 1.3, 1.6][l] || 1

const round = (v, tag) => {
  if (tag === 'b') return Math.max(10, Math.round(v / 2.5) * 2.5)
  if (tag === 's') return Math.max(2.5, v < 20 ? Math.round(v / 2.5) * 2.5 : Math.round(v / 5) * 5)
  return Math.max(1, v < 10 ? Math.round(v) : Math.round(v / 2) * 2) // ดัมเบล/ตัวเดียว
}

/** → { kg, tag } หรือ null (ตัวเปล่า/คาร์ดิโอ/ยางยืด/ไม่มีข้อมูลโปรไฟล์) */
export function suggestKg(ex, p) {
  const r = R[ex?.id]
  if (!r || !p) return null
  const eff = effectiveWeight(p.weight, p.height)
  if (!eff) return null
  const sex = p.sex === 'f' ? (LOWER.has(ex.g) ? 0.75 : ex.g === 'core' ? 0.7 : 0.6) : 1
  const kg = round(r[0] * eff * sex * ageF(Number(p.age) || 30) * levelF(Number(p.level) || 1), r[1])
  return { kg, tag: r[1] }
}

export const LOAD_UNIT = { h: 'ข้างละ', t: '(ตัวเดียว)', b: 'รวมบาร์', s: 'ที่เครื่อง/เคเบิล' }
export const hasSuggestion = (id) => id in R
