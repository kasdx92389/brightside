// ตรวจ/ซ่อมข้อมูลที่โหลดจากเครื่อง ไฟล์สำรอง หรือคลาวด์ ก่อนเข้า store — กันค่าเสียทำให้ NaN/หน้าขาวถาวร
// หลักการ: ข้อมูลร่างกายที่เสีย (อายุ/น้ำหนัก/ส่วนสูง) เดาให้ไม่ได้ → คืน profile = null (ให้กรอกใหม่) · ส่วนอื่นลบเฉพาะรายการที่เสีย ไม่ทิ้งทั้งก้อน
import { MOOD_BY, NOTE_MAX } from './mood.js'
import { SCREEN } from './safety.js'

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const DATE = /^\d{4}-\d{2}-\d{2}$/
const num = (v, lo, hi) => { const n = Number(v); return v !== '' && v !== null && Number.isFinite(n) && n >= lo && n <= hi ? n : null }
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
const pick = (v, list, d) => (list.includes(v) ? v : d)

export function sanitizeProfile(p) {
  if (!isObj(p)) return null
  const age = num(p.age, 12, 90), weight = num(p.weight, 30, 250), height = num(p.height, 120, 230)
  if (age === null || weight === null || height === null) return null
  const out = { ...p, age, weight, height }
  out.name = str(p.name, 24).trim() || 'เพื่อน'
  out.sex = p.sex === 'f' ? 'f' : 'm'
  out.goal = pick(p.goal, ['lose', 'muscle', 'fit'], 'fit')
  out.level = pick(Number(p.level), [1, 2, 3], 1)
  out.days = pick(Number(p.days), [2, 3, 4, 5, 6, 7], 4)
  out.equip = pick(p.equip, ['gym', 'db', 'home'], 'gym')
  out.rest = pick(Number(p.rest), [60, 90, 120, 180], 90)
  const t = num(p.target, 30, 250); if (t === null) delete out.target; else out.target = t
  out.screen = Array.isArray(p.screen) ? [...new Set(p.screen.filter((k) => SCREEN.some(([id]) => id === k)))] : []
  out.preg = pick(p.preg, ['none', '1', '2', '3', 'pp'], 'none')
  if (out.sex !== 'f') out.preg = 'none'
  for (const [k, lo, hi] of [['kcalAdj', -300, 300], ['loadAdj', 0.5, 1.5]]) { const v = num(p[k], lo, hi); if (v === null) delete out[k]; else out[k] = v }
  if (!DATE.test(out.kcalAdjAt || '')) delete out.kcalAdjAt
  return out
}

const KINDS = ['train', 'rest', 'walk']
export function sanitizePlan(plan) {
  if (!isObj(plan) || !Array.isArray(plan.days) || plan.days.length !== 7) return null
  const days = []
  for (const d of plan.days) {
    if (!isObj(d) || !KINDS.includes(d.kind)) return null
    const items = (Array.isArray(d.items) ? d.items : []).filter((it) => isObj(it) && typeof it.id === 'string').slice(0, 20)
      .map((it) => ({ id: it.id.slice(0, 60), sets: Math.round(num(it.sets, 1, 12) ?? 3), reps: str(String(it.reps ?? ''), 40) || '10' }))
    days.push({ ...d, name: str(d.name, 60) || 'ฝึก', focus: str(d.focus, 80), items })
  }
  return { ...plan, name: str(plan.name, 60) || 'โปรแกรมของฉัน', days }
}

function sanitizeLog(l) {
  if (!isObj(l)) return null
  const out = { ...l }
  const sets = {}
  if (isObj(l.sets)) for (const [id, arr] of Object.entries(l.sets)) if (Array.isArray(arr)) sets[id] = arr.slice(0, 20).map((x) => (isObj(x) ? x : {}))
  out.sets = sets
  out.finished = l.finished === true; out.skipped = l.skipped === true
  if (l.food !== undefined) {
    const f = isObj(l.food) ? { ...l.food } : {}
    for (const k of ['kcal', 'protein', 'carb', 'fat', 'water']) if (k in f) f[k] = Math.max(0, Number(f[k]) || 0)
    f.waterLog = (Array.isArray(f.waterLog) ? f.waterLog : []).filter((e) => isObj(e) && Number.isFinite(Number(e.ml)) && Math.abs(Number(e.ml)) <= 20000).slice(-60).map((e) => ({ ml: Math.round(Number(e.ml)), t: Number(e.t) || 0, ...(e.adj && { adj: 1 }) }))
    if (!f.waterLog.length) delete f.waterLog
    f.items = (Array.isArray(f.items) ? f.items : []).filter((it) => isObj(it) && typeof it.n === 'string' && Number.isFinite(Number(it.k))).slice(0, 80)
    out.food = f
  }
  if (l.mood !== undefined) {
    if (isObj(l.mood) && MOOD_BY[l.mood.m]) out.mood = { m: l.mood.m, note: str(l.mood.note, NOTE_MAX), at: Number(l.mood.at) || 0 }
    else delete out.mood
  }
  return out
}

export function sanitizeState(s, today) {
  const src = isObj(s) ? s : {}
  const logs = {}
  if (isObj(src.logs)) for (const [d, l] of Object.entries(src.logs)) { const c = DATE.test(d) ? sanitizeLog(l) : null; if (c) logs[d] = c }
  const series = (arr, fields) => (Array.isArray(arr) ? arr : []).filter((x) => isObj(x) && DATE.test(x.date || '') && fields.some((f) => num(x[f], 1, 400) !== null))
  const out = {
    ...src,
    profile: sanitizeProfile(src.profile),
    plan: sanitizePlan(src.plan),
    logs,
    weights: series(src.weights, ['kg']).filter((w) => num(w.kg, 20, 400) !== null).map((w) => ({ ...w, kg: Number(w.kg) })).sort((a, b) => a.date.localeCompare(b.date)),
    measures: series(src.measures, ['waist', 'arm', 'chest', 'hip']).sort((a, b) => a.date.localeCompare(b.date)),
    favs: (Array.isArray(src.favs) ? src.favs : []).filter((x) => typeof x === 'string').slice(0, 500),
    foodFavs: (Array.isArray(src.foodFavs) ? src.foodFavs : []).filter((x) => typeof x === 'string').slice(0, 1000),
    myFoods: (Array.isArray(src.myFoods) ? src.myFoods : []).filter((f) => isObj(f) && typeof f.id === 'string' && typeof f.n === 'string' && ['k', 'p', 'c', 'f'].every((k) => Number.isFinite(Number(f[k])))).slice(0, 300),
    deloadUntil: DATE.test(src.deloadUntil || '') ? src.deloadUntil : null,
    createdAt: DATE.test(src.createdAt || '') ? src.createdAt : today,
  }
  if (isObj(src.mod)) out.mod = Object.fromEntries(Object.entries(src.mod).filter(([, v]) => Number.isFinite(v)))
  else delete out.mod
  return out
}
