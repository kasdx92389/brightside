// แนะนำเมนูเติมโปรตีน: สุ่มหมุนเวียนจากคลังอาหารทั้งหมด (ไม่ซ้ำจนน่าเบื่อ) · เมนูที่กดหัวใจไว้ได้คะแนนเพิ่ม
// เครื่องปรุง/วัตถุดิบที่กดหัวใจ = แนะนำ "เมนูที่ใช้ของนั้น" ไม่แนะนำให้กินเครื่องปรุงเดี่ยวๆ
import { FOODS, addonById } from '../data/foods.js'
import { sodiumOf } from '../data/sodium.js'

const MAIN = new Set(['meat', 'dish', 'dairy', 'plant', 'meal', 'noodle', 'world', 'rice'])
const STARCH = new Set(['rice', 'noodle']) // แป้งล้วนต้องมีโปรตีนจริงจังถึงจะแนะนำ
const SKIP = /น้ำสลัด|ซอส|น้ำจิ้ม|เครื่องปรุง|เนยถั่ว|ฮัมมุส|น้ำมัน|ผงปรุง/
const PROTEINS = ['ไข่', 'ไก่', 'หมู', 'เนื้อ', 'ปลา', 'กุ้ง', 'หมึก', 'เต้าหู้', 'นม', 'โยเกิร์ต', 'ทูน่า', 'แซลมอน', 'ถั่ว', 'เวย์', 'โปรตีน', 'ปู', 'หอย', 'ตับ']
/** โปรตีนหลักของเมนู (ใช้กันแนะนำไก่ซ้ำสามอย่างติดกัน) */
export const mainProtein = (food) => PROTEINS.find((k) => food.n.includes(k)) || food.n

/** ชื่อวัตถุดิบ/เครื่องปรุงจาก id ที่กดหัวใจไว้ (id ของเมนูอื่นๆ ไม่นับ) */
export function favIngredientNames(favIds) {
  const out = []
  for (const id of favIds || []) {
    if (id.startsWith('ing-')) out.push(id.slice(4))
    else if (id.startsWith('ad:') && addonById[id.slice(3)]) out.push(addonById[id.slice(3)].n)
  }
  return out
}

/** เมนูนี้ใช้วัตถุดิบ/เครื่องปรุงชื่อนี้หรือไม่ (สูตรมี ing = เทียบตรงๆ · เมนูอื่นเทียบจากชื่อเมนู) */
export function usesIngredient(food, name) {
  const toks = name.replace(/\s*\(.*?\)/g, '').split(/[/\s]+/).filter((t) => t.length >= 2)
  return toks.some((t) => (food.ing || []).some((g) => g === t || g.includes(t) || (g.length >= 3 && t.includes(g))) || (!food.ing && food.n.includes(t)))
}

/** สุ่มคงที่ตาม seed (เห็นเหมือนเดิมตลอดวันจนกดสุ่มใหม่ ไม่กระพริบทุกครั้งที่เรนเดอร์) */
export function seeded(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/**
 * @param remP โปรตีนที่ยังขาด (g) · @param remK พลังงานที่เหลือ (kcal)
 * @param o.favs id ที่กดหัวใจ · o.seed ตัวสุ่ม · o.recent { id: กี่วันที่แล้วที่กิน (0 = วันนี้) } · o.n จำนวนที่ต้องการ
 * @param o.rem { c, f, na } คาร์บ/ไขมัน (g) และโซเดียม (มก.) ที่ยังเหลือกินได้ — เมนูที่ทำให้เกินเป้าไม่ถูกแนะนำ (เกินได้เล็กน้อย: คาร์บ 5 g ไขมัน 3 g)
 */
export function suggestFoods(remP, remK, o = {}) {
  if (remP < 10) return []
  const { favs = [], seed = '', recent = {}, n = 3, rem } = o
  const left = (v) => (v == null ? Infinity : Math.max(0, v))
  const remC = left(rem?.c), remF = left(rem?.f), remNa = left(rem?.na)
  const favSet = new Set(favs)
  const ings = favIngredientNames(favs)
  const pool = FOODS.filter((f) => MAIN.has(f.cat) && !SKIP.test(f.n) && f.p >= (STARCH.has(f.cat) ? 12 : 8) && f.p <= remP + 10 && f.k <= Math.max(150, remK) && f.c <= remC + 5 && f.f <= remF + 3 && sodiumOf(f) <= remNa)
  const scored = pool.map((f) => {
    const hit = ings.find((g) => usesIngredient(f, g))
    const ago = recent[f.id]
    const score = Math.min(f.p / f.k * 100 / 12, 1.5) + seeded(`${seed}|${f.id}`) * 1.5
      + (favSet.has(f.id) ? 2 : 0) + (hit ? 1.5 : 0)
      - (ago === 0 ? 3 : ago <= 3 ? 1 : 0)
      - (Number.isFinite(remNa) ? Math.min(sodiumOf(f) / Math.max(remNa, 1), 1) * 1.2 : 0) // ยิ่งกินโซเดียมเกือบหมดโควตา ยิ่งไม่แนะนำ
    return { f, score, why: favSet.has(f.id) ? 'เมนูโปรดของคุณ' : hit ? `มี${hit.replace(/\s*\(.*?\)/g, '')}ที่คุณชอบ` : '' }
  }).sort((a, b) => b.score - a.score)
  const out = [], cats = new Set(), prot = new Set()
  for (const { f, why } of scored) {
    const c = f.grp ?? f.cat, m = mainProtein(f)
    if (cats.has(c) || prot.has(m)) continue
    cats.add(c); prot.add(m); out.push({ ...f, why })
    if (out.length >= n) break
  }
  return out
}
