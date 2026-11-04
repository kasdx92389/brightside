// หักล้างส่วนที่ซ้ำ: เมนูทอด/ผัด/ปรุงสำเร็จรวมน้ำมันและเครื่องปรุงมาตรฐานไว้ในค่าแล้ว
// ถ้าผู้ใช้เลือกเพิ่ม "น้ำมัน/เครื่องปรุงชนิดเดียวกัน" ด้วยปริมาณที่ใช้จริง ให้ถือว่าแทนที่ค่ามาตรฐานของเมนู (ไม่นับซ้ำสองชั้น)
// ไม่ได้เลือก = คิดตามค่ามาตรฐานของเมนูเหมือนเดิม
import { INGREDIENTS } from '../data/recipes.js'
import { kindOfIng } from '../data/pantry.js'

const TYPES = new Set(['oil', 'sauce', 'powder', 'sweet']) // ชนิดของส่วนเสริมที่มีค่ามาตรฐานรวมอยู่ในเมนู
const COND = new Set(Object.keys(INGREDIENTS).filter((n) => kindOfIng(n) === 'cond')) // ผักเช่นมะเขือเทศไม่นับเป็นเครื่องปรุง

/** ชื่อวัตถุดิบในสูตรของเมนู ที่ส่วนเสริมนี้ "ทดแทน" (ว่าง = ไม่เกี่ยว) */
export function replaces(food, ad) {
  if (!food?.amt || !TYPES.has(ad.cat)) return []
  const keys = Object.keys(food.amt)
  if (ad.cat === 'oil' && !/กะทิ/.test(ad.n)) return keys.includes('น้ำมัน') ? ['น้ำมัน'] : [] // น้ำมันทุกชนิด/เนย ใช้แทนน้ำมันปรุงอาหารของเมนู
  const toks = ad.n.replace(/\s*\(.*?\)/g, '').split(/[/\s]+/).filter((t) => t.length >= 2)
  return keys.filter((k) => COND.has(k) && toks.some((t) => t === k || (k.length >= 2 && t.includes(k)) || (t.length >= 3 && k.includes(t))))
}

/** รายการที่ต้องหักออก (ต่อ 1 หน่วยตั้งต้นของเมนู × q) จากส่วนเสริมที่เลือก — แต่ละวัตถุดิบหักครั้งเดียว */
export function credits(food, picked, q) {
  const names = new Set()
  for (const ad of picked) for (const n of replaces(food, ad)) names.add(n)
  return [...names].map((name) => {
    const g = food.amt[name] * q, v = INGREDIENTS[name], w = g / 100
    return { name, g: Math.round(g * 10) / 10, k: Math.round(v[0] * w), p: Math.round(v[1] * w * 10) / 10, c: Math.round(v[2] * w * 10) / 10, f: Math.round(v[3] * w * 10) / 10, na: Math.round(v[4] * w) }
  })
}
