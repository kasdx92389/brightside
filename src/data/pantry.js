// คลังอาหาร: ทุกอย่างที่แอปรู้จักในที่เดียว — เมนู ผัก ผลไม้ วัตถุดิบ เครื่องปรุง · ค้นหาดูคุณค่าทางโภชนาการได้ และกดหัวใจได้
// kind: dish เมนู · veg ผัก · fruit ผลไม้ · ing วัตถุดิบหลัก (เนื้อ ไข่ แป้ง ถั่ว) · cond เครื่องปรุง/น้ำมัน
import { FOODS, ADDONS } from './foods.js'
import { INGREDIENTS } from './recipes.js'
import { sodiumOf, addonSodium } from './sodium.js'
import { gramsPerUnit, addonGw } from './grams.js'

export const PANTRY_KINDS = [['dish', 'เมนู'], ['veg', 'ผัก'], ['fruit', 'ผลไม้'], ['ing', 'วัตถุดิบ'], ['cond', 'เครื่องปรุง']]

const FRUIT = /กล้วย|แอปเปิล|^ส้ม|ฝรั่ง|มะม่วงสุก|แตงโม|มะละกอสุก|สับปะรด|องุ่น|แก้วมังกร|ลำไย|ลิ้นจี่|เงาะ|มังคุด|ทุเรียน|ขนุน|สตรอว์|บลูเบอร์รี่|ลูกเกด|อินทผลัม|อะโวคาโด|ส้มโอ/
const NUT = /อัลมอนด์|ถั่ว|เนยถั่ว|เม็ดมะม่วง|วอลนัท|เมล็ด/
const COND = /น้ำมัน|กะทิ|น้ำปลา|ซีอิ๊ว|ซอส|น้ำตาล|มะนาว|มะขาม|พริก(เผา|แกง|ป่น)|กะปิ|ผงปรุง|ผงชูรส|เกลือ|น้ำซุป|น้ำต้มยำ|น้ำแกง|เต้าเจี้ยว|ครีม|มิโสะ|มิริน|มายอง|ก้อนแกง|ดาชิ|บ๊วยดอง|ปลาร้า|น้ำสลัด|ข้าวคั่ว|^นม$|^ชีส$/
const VEG = /ผัก|กะหล่ำ|คะน้า|ถั่วฝักยาว|ถั่วงอก|เห็ด|บวบ|มะเขือ|บร็อคโคลี|บรอกโคลี|แครอท|ข้าวโพด|ใบกะเพรา|หอม|มะละกอดิบ|แตงกวา|ฟักทอง|มะระ|หน่อไม้|มะม่วงดิบ|มันฝรั่ง|พริกกระเทียม|มันหวาน/
const r1 = (v) => Math.round(v * 10) / 10

const kindOfFood = (f) => {
  if (f.cat !== 'plant') return 'dish'
  if (FRUIT.test(f.n)) return 'fruit'
  if (/น้ำสลัด|เนยถั่ว|ฮัมมุส/.test(f.n)) return 'cond'
  if (NUT.test(f.n)) return 'ing'
  return 'veg'
}
export const kindOfIng = (n) => (COND.test(n) ? 'cond' : FRUIT.test(n) ? 'fruit' : VEG.test(n) ? 'veg' : 'ing')

const rows = []
for (const f of FOODS) rows.push({ id: f.id, kind: kindOfFood(f), n: f.n, u: f.u, k: f.k, p: f.p, c: f.c, f: f.f, na: sodiumOf(f), ...(f.ing && { ing: f.ing }), ...(f.amt && { amt: f.amt }), ...(f.isan && { isan: 1 }), ...(gramsPerUnit(f) && { gw: gramsPerUnit(f) }) })
const addonNames = new Set(ADDONS.map((a) => a.n))
for (const a of ADDONS) rows.push({ id: `ad:${a.id}`, kind: a.cat === 'meat' || a.cat === 'extra' ? 'ing' : 'cond', n: a.n, u: `1 ${a.u}`, k: a.k, p: a.p, c: a.c, f: a.f, na: addonSodium(a), ...(addonGw(a) && { gw: addonGw(a) }) })
for (const [n, [k, p, c, f, na]] of Object.entries(INGREDIENTS)) {
  if (addonNames.has(n)) continue // เครื่องปรุงที่มีหน่วยช้อนอยู่แล้ว ใช้แถวนั้นแทน
  rows.push({ id: `ing-${n}`, kind: kindOfIng(n), n, u: '100 g', k, p: r1(p), c: r1(c), f: r1(f), na })
}
export const PANTRY = rows
export const pantryById = Object.fromEntries(rows.map((r) => [r.id, r]))

/** วัตถุดิบดิบ/สุก (ต่อ 100 g) ในรูปของ "ส่วนเสริม" — ค้นหาใน "เพิ่มรายละเอียด" แล้วใส่เป็นกรัมได้ เช่น กินข้าวญี่ปุ่นกับไข่เจียว
 *  หน่วยภายใน = 10 g (gw 10) · gOnly = แสดง/บันทึกเป็นกรัมเสมอ · def = ปริมาณตั้งต้น (หน่วย 10 g → 50 g) */
const r2 = (v) => Math.round(v * 100) / 100
export const INGREDIENT_ADDONS = Object.entries(INGREDIENTS).filter(([n]) => !addonNames.has(n)).map(([n, [k, p, c, f, na]]) => (
  { id: `ing-${n}`, cat: 'ing', n, u: '10 g', gw: 10, gOnly: true, gStep: 10, def: 5, k: r2(k / 10), p: r2(p / 10), c: r2(c / 10), f: r2(f / 10), na: Math.round(na / 10) }
))
export const ingAddonById = Object.fromEntries(INGREDIENT_ADDONS.map((a) => [a.id, a]))
