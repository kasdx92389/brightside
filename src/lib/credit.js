// หักล้างส่วนที่ซ้ำ: เมนูทอด/ผัดรวมน้ำมันปรุงอาหารมาตรฐานไว้ในค่าแล้ว
// ถ้าผู้ใช้เลือกเพิ่ม "น้ำมัน" ด้วยปริมาณที่ใช้จริง ให้ถือว่าแทนที่น้ำมันมาตรฐานของเมนู (คนปรุงเอง ใส่น้ำมันเท่าไรก็คือทั้งหมด)
// ไม่ได้เลือก = คิดตามค่ามาตรฐานของเมนูเหมือนเดิม
// น้ำปลา/ซอส/น้ำตาล/พริกป่น ฯลฯ ไม่หัก: เป็นของที่เติมเพิ่มบนโต๊ะ ทับจากที่ร้านหรือสูตรปรุงมาแล้ว (หักแล้วจะนับโซเดียม/น้ำตาลต่ำเกินจริง)
import { INGREDIENTS, ingSugar, ingSugarTotal } from '../data/recipes.js'

/** ชื่อวัตถุดิบในสูตรของเมนู ที่ส่วนเสริมนี้ "ทดแทน" (ว่าง = ไม่เกี่ยว) */
export function replaces(food, ad) {
  if (!food?.amt || ad.cat !== 'oil' || /กะทิ/.test(ad.n)) return []
  return 'น้ำมัน' in food.amt ? ['น้ำมัน'] : [] // น้ำมันทุกชนิด/เนย ใช้แทนน้ำมันปรุงอาหารของเมนู · กะทิไม่ใช่น้ำมันปรุงอาหาร
}

/** วัตถุดิบในสูตรที่ติ๊ก "ไม่ใส่…" แล้วหักออกได้ (ผงชูรส/ผงปรุงรส = ผงรสชาติสำเร็จรูป) */
export const NO_OPTS = { oil: ['น้ำมัน'], msg: ['ผงชูรส', 'ผงปรุงรส'] }
export const noHas = (food, key) => NO_OPTS[key].some((n) => n in (food?.amt || {}))

/** รายการที่ต้องหักออก (ต่อ 1 หน่วยตั้งต้นของเมนู × q) จากส่วนเสริมที่เลือก และช่องติ๊ก "ไม่ใส่…" (no = { oil, msg }) — แต่ละวัตถุดิบหักครั้งเดียว */
export function credits(food, picked, q, no = {}) {
  const names = new Set(), boxed = new Set()
  for (const ad of picked) for (const n of replaces(food, ad)) names.add(n)
  for (const key of Object.keys(NO_OPTS)) if (no[key]) for (const n of NO_OPTS[key]) if (food?.amt && n in food.amt) { names.add(n); boxed.add(n) }
  return [...names].map((name) => {
    const g = food.amt[name] * q, v = INGREDIENTS[name], w = g / 100
    return { name, ...(boxed.has(name) && { box: 1 }), g: Math.round(g * 10) / 10, k: Math.round(v[0] * w), p: Math.round(v[1] * w * 10) / 10, c: Math.round(v[2] * w * 10) / 10, f: Math.round(v[3] * w * 10) / 10, na: Math.round(v[4] * w), su: Math.round(ingSugar(name) * w * 10) / 10, sg: Math.round(ingSugarTotal(name) * w * 10) / 10 }
  })
}
