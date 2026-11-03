// หน่วยบริโภคของอาหาร → ตัวเลือกปริมาณที่เหมาะกับหน่วยนั้น
//   ฟอง/ชิ้น/ไม้ …  นับเป็นจำนวนเต็ม (กี่ฟอง)       ชาม/จาน/ถ้วย …  ครึ่งหน่วยได้       g / มล.  ใส่น้ำหนักตรงๆ
// ค่า q (ตัวคูณของหน่วยตั้งต้น) = จำนวนที่เลือก ÷ จำนวนในหน่วยตั้งต้น เช่น "4 ชิ้น" เลือก 8 ชิ้น → q = 2

const SERVING = ['ชาม', 'จาน', 'ถ้วย', 'ทัพพี', 'กำมือ', 'ชุด', 'กระทะ', 'ปั้น', 'ห่อ', 'แก้ว', 'ขวด', 'กระป๋อง', 'กล่อง', 'ถุง', 'ที่', 'หน่วย']
const FRAC = { '½': 0.5, '¼': 0.25 }
const r2 = (v) => Math.round(v * 100) / 100
const uniq = (a) => [...new Set(a)]

export function unitInfo(food) {
  const u = food.u || ''
  const m = !u.includes('+') && u.match(/^(½|¼|\d+(?:\.\d+)?)\s*([^\s(]+)/)
  if (!m) return { base: 1, word: 'ชุด', kind: 'serving', step: 0.5, min: 0.5, max: 20, presets: [0.5, 1, 1.5, 2, 3] }
  const base = FRAC[m[1]] ?? Number(m[1])
  const word = m[2]
  if (word === 'g' || word === 'มล.') {
    const step = base >= 100 ? 10 : 5
    return { base, word, kind: 'g', step, min: step, max: base * 10, presets: uniq([0.5, 1, 1.5, 2, 3].map((x) => Math.round((base * x) / step) * step)) }
  }
  if (base < 1) return { base, word, kind: 'serving', step: base, min: base, max: 20, presets: [1, 2, 3, 4].map((x) => r2(base * x)) }
  if (SERVING.some((w) => word.startsWith(w))) return { base, word, kind: 'serving', step: 0.5, min: 0.5, max: 20, presets: [0.5, 1, 1.5, 2, 3] }
  return { base, word, kind: 'count', step: 1, min: 1, max: 60, presets: base === 1 ? [1, 2, 3, 4, 5, 6] : uniq([1, base, base * 2, base * 3]) }
}

const HALF = { 0.25: '¼', 0.5: '½', 0.75: '¾' }
export function fmtAmt(a) {
  const w = Math.floor(a), f = r2(a - w)
  if (!f) return String(w)
  return HALF[f] ? (w ? `${w}${HALF[f]}` : HALF[f]) : String(r2(a))
}
