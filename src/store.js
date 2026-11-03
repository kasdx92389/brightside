import { useSyncExternalStore } from 'react'
import { dateKey, dayIdx, targets } from './lib/calc.js'
import { achievements, addDays, inDeload } from './lib/coach.js'
import { byId } from './data/exercises.js'
import { stamp } from './lib/merge.js'
import { MOOD_BY, NOTE_MAX } from './lib/mood.js'
import { fixPlan } from './lib/safety.js'
import { sanitizeState } from './lib/sanitize.js'

const KEY = 'brightside:v1'
const EMPTY = { profile: null, plan: null, logs: {}, weights: [], measures: [], favs: [], myFoods: [], deloadUntil: null, createdAt: dateKey() }

const load = () => {
  try { return { ...EMPTY, ...sanitizeState(JSON.parse(localStorage.getItem(KEY)), dateKey()) } } catch { return EMPTY }
}
let state = load()
const subs = new Set()
export let saveFailed = false

export const getState = () => state
const localSubs = new Set() // ฟังเฉพาะการแก้ไขโดยผู้ใช้ (ใช้สั่งซิงก์) ไม่รวมข้อมูลที่เพิ่งรับจากคลาวด์
function commit(next) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)); saveFailed = false } catch { saveFailed = true /* โหมดส่วนตัว/พื้นที่เต็ม — ใช้ต่อใน memory */ }
  subs.forEach((f) => f())
}
export function update(fn) {
  commit(stamp(state, fn(state))) // ประทับเวลาแก้ไขรายรายการ เพื่อให้ซิงก์รวมข้อมูลสองเครื่องได้
  localSubs.forEach((f) => f())
}
/** ใส่ state ที่ merge แล้วจากคลาวด์ (ไม่ประทับเวลาใหม่ ไม่ทำให้เกิดการซิงก์ซ้ำ) */
export const replaceState = commit
export const onLocalChange = (f) => (localSubs.add(f), () => localSubs.delete(f))
export const useStore = (sel = (s) => s) =>
  sel(useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state))

const byDate = (a, b) => a.date.localeCompare(b.date)

// ───── actions ─────
export const saveProfile = (profile) =>
  update((s) => {
    const today = dateKey()
    const weights = s.weights.filter((w) => w.date !== today).concat({ date: today, kg: profile.weight })
    return { ...s, profile: { rest: 90, ...s.profile, ...profile }, weights: weights.sort(byDate) }
  })

// ปรับความหนักของ "น้ำหนักที่แนะนำ" ตามที่ผู้ใช้กดว่าหนักไป/เบาไป (ตัวคูณ 0.5–1.5 เก็บในโปรไฟล์ ซิงก์ข้ามเครื่อง)
export const setLoadAdj = (v) => update((s) => ({ ...s, profile: { ...s.profile, loadAdj: Math.min(1.5, Math.max(0.5, Math.round(v * 100) / 100)) } }))

// ปรับเป้าแคลอรี่ตามน้ำหนักที่เปลี่ยนจริง (±300 kcal สะสม ปัดทีละ 50) · kcalAdjAt = วันที่ปรับ ใช้ให้รอ 2 สัปดาห์ก่อนประเมินใหม่
export const setKcalAdj = (v) => update((s) => ({ ...s, profile: { ...s.profile, kcalAdj: Math.max(-300, Math.min(300, Math.round(v / 50) * 50)), kcalAdjAt: dateKey() } }))

// แทนท่าที่ไม่เหมาะกับอายุ/คัดกรอง/ตั้งครรภ์/BMI ด้วยท่าปลอดภัยในกลุ่มเดียวกัน (ส่วนอื่นของแผนไม่เปลี่ยน)
export const fixPlanSafety = () => update((s) => (s.plan && s.profile ? { ...s, plan: { ...fixPlan(s.plan, s.profile), source: 'custom' } } : s))

export const setPlan = (plan) => update((s) => ({ ...s, plan: { ...plan, startedAt: dateKey() }, deloadUntil: null }))

export const editDay = (i, fn) =>
  update((s) => ({ ...s, plan: { ...s.plan, source: 'custom', days: s.plan.days.map((d, k) => (k === i ? fn(d) : d)) } }))

export const addWeight = (kg, date = dateKey()) =>
  update((s) => ({
    ...s,
    weights: s.weights.filter((w) => w.date !== date).concat({ date, kg }).sort(byDate),
    profile: date === dateKey() ? { ...s.profile, weight: kg } : s.profile,
  }))

export const addMeasure = (m, date = dateKey()) =>
  update((s) => ({ ...s, measures: s.measures.filter((x) => x.date !== date).concat({ ...m, date }).sort(byDate) }))

export const toggleFav = (id) =>
  update((s) => ({ ...s, favs: s.favs.includes(id) ? s.favs.filter((x) => x !== id) : [...s.favs, id] }))

const dayLog = (s, date) => s.logs[date] || { sets: {}, finished: false }
const patchLog = (date, fn) => update((s) => ({ ...s, logs: { ...s.logs, [date]: fn(dayLog(s, date)) } }))

export const patchSet = (date, exId, idx, patch, total) =>
  patchLog(date, (log) => {
    const arr = Array.from({ length: total }, (_, i) => log.sets[exId]?.[i] || {})
    arr[idx] = { ...arr[idx], ...patch }
    return { ...log, startedAt: log.startedAt || Date.now(), skipped: false, sets: { ...log.sets, [exId]: arr } }
  })

// อารมณ์ของวัน: patch = { m: id (null = ลบ), note } · บันทึกได้เฉพาะวันนี้และย้อนหลัง
export const setMood = (date, patch) => {
  if (date > dateKey()) return
  patchLog(date, (log) => {
    const cur = log.mood || {}
    const m = patch.m !== undefined ? patch.m : cur.m
    if (!MOOD_BY[m]) { const { mood, ...rest } = log; return rest }
    const note = patch.note !== undefined ? String(patch.note).slice(0, NOTE_MAX).trim() : cur.note || ''
    return { ...log, mood: { m, note, at: Date.now() } }
  })
}

export const finishDay = (date, finished = true) =>
  patchLog(date, (log) => ({ ...log, finished, skipped: false, finishedAt: finished ? Date.now() : undefined }))
export const skipDay = (date, skipped = true) => patchLog(date, (log) => ({ ...log, skipped, finished: false }))
export const toggleWarm = (date) => patchLog(date, (log) => ({ ...log, warm: !log.warm }))
export const patchFood = (date, patch) =>
  patchLog(date, (log) => {
    const f = { ...log.food, ...patch }
    for (const k in f) if (k !== 'items') f[k] = Math.max(0, Number(f[k]) || 0)
    return { ...log, food: f }
  })

// บันทึกอาหารทีละรายการ: item = { id, n ชื่อ, q ปริมาณ, s มื้อ(0-3), k kcal, p โปรตีน, c คาร์บ, f ไขมัน } · ยอดรวมของวันอัปเดตตาม
const FOOD_KEYS = { k: 'kcal', p: 'protein', c: 'carb', f: 'fat' }
const bump = (food, it, sign) => {
  const o = { ...food }
  for (const [k, key] of Object.entries(FOOD_KEYS)) o[key] = Math.max(0, Math.round(((Number(food[key]) || 0) + sign * (Number(it[k]) || 0)) * 10) / 10)
  return o
}
export const addFood = (date, it) =>
  patchLog(date, (log) => ({ ...log, food: { ...bump(log.food || {}, it, 1), items: [...(log.food?.items || []), it] } }))
export const updateFood = (date, i, it) =>
  patchLog(date, (log) => {
    const items = log.food?.items || []
    return items[i] ? { ...log, food: { ...bump(bump(log.food, items[i], -1), it, 1), items: items.map((x, n) => (n === i ? it : x)) } } : log
  })
// เมนูของฉัน: อาหารที่ผู้ใช้บันทึกไว้ใช้ซ้ำ { id, n, u ('100 g' | '1 หน่วย'), k, p, c, f ต่อหน่วยนั้น }
export const addMyFood = (food) => update((s) => ({ ...s, myFoods: [...(s.myFoods || []), food] }))
export const removeMyFood = (id) => update((s) => ({ ...s, myFoods: (s.myFoods || []).filter((x) => x.id !== id) }))
export const removeFood = (date, i) =>
  patchLog(date, (log) => {
    const items = log.food?.items || []
    return items[i] ? { ...log, food: { ...bump(log.food, items[i], -1), items: items.filter((_, n) => n !== i) } } : log
  })

export const startDeload = () =>
  update((s) => {
    const until = addDays(dateKey(), 6)
    return { ...s, deloadUntil: until, plan: { ...s.plan, startedAt: addDays(until, 1) } }
  })
export const endDeload = () => update((s) => ({ ...s, deloadUntil: null, plan: { ...s.plan, startedAt: dateKey() } }))

export const importData = (json) => update(() => {
  const d = JSON.parse(json)
  // กันไฟล์ผิดชนิด (JSON ที่ไม่ใช่ข้อมูลสำรอง) ล้างข้อมูลทั้งหมดโดยไม่รู้ตัว
  if (!d?.profile || !d.plan?.days || typeof d.logs !== 'object' || !Array.isArray(d.weights)) throw new Error('not a backup')
  const clean = sanitizeState(d, dateKey())
  if (!clean.profile || !clean.plan) throw new Error('invalid profile or plan') // ข้อมูลร่างกาย/แผนเสียเกินซ่อม → ไม่ล้างข้อมูลเดิม
  return { ...EMPTY, ...clean }
})
export const resetAll = () => update(() => ({ ...EMPTY, createdAt: dateKey() }))

// ───── selectors / helpers ─────
export const setsOf = (log, it) => Array.from({ length: it.sets }, (_, i) => log?.sets?.[it.id]?.[i] || {})

/** รายการท่าของวันนั้น (สัปดาห์เบา = ไม่เกิน 2 เซ็ตต่อท่า) */
export function itemsFor(s, date) {
  const day = s.plan?.days[dayIdx(new Date(date + 'T00:00:00'))]
  const light = inDeload(s, date)
  return (day?.items || []).filter((it) => byId[it.id]).map((it) => (light ? { ...it, sets: Math.min(it.sets, 2) } : it))
}

export function progressOf(s, date) {
  const items = itemsFor(s, date)
  const log = s.logs[date]
  const total = items.reduce((n, it) => n + it.sets, 0)
  const done = items.reduce((n, it) => n + setsOf(log, it).filter((x) => x.done).length, 0)
  return { total, done, pct: total ? done / total : 0 }
}

export const volumeOf = (log) =>
  Object.values(log?.sets || {}).flat().reduce((v, x) => (x.done ? v + (Number(x.kg) || 0) * (Number(x.reps) || 0) : v), 0)

export const setsDone = (log) => Object.values(log?.sets || {}).flat().filter((x) => x.done).length

// น้ำหนักล่าสุดที่เคยยกในท่านี้ (ก่อนวันที่ระบุ) เพื่อเติมให้อัตโนมัติ
export function lastKg(logs, exId, before) {
  for (const d of Object.keys(logs).sort().reverse()) {
    if (d >= before) continue
    const hit = logs[d].sets?.[exId]?.filter((x) => x.done && x.kg).pop()
    if (hit) return hit.kg
  }
  return ''
}

export function personalBests(logs) {
  const best = {}
  for (const [d, log] of Object.entries(logs))
    for (const [id, sets] of Object.entries(log.sets || {}))
      for (const x of sets) {
        const kg = Number(x.kg)
        if (x.done && kg > 0 && (!best[id] || kg > best[id].kg)) best[id] = { kg, reps: x.reps, date: d }
      }
  return Object.entries(best).filter(([id]) => byId[id]).sort((a, b) => b[1].date.localeCompare(a[1].date))
}

// สถานะวัน: 'done' | 'rest' | 'skip' | 'miss' | 'todo' | 'pre' (ก่อนเริ่มใช้แอป)
export function dayStatus(s, date) {
  const day = s.plan?.days[dayIdx(new Date(date + 'T00:00:00'))]
  if (s.logs[date]?.finished) return 'done'
  if (date < s.createdAt) return 'pre'
  if (s.logs[date]?.skipped) return 'skip'
  if (!day || day.kind === 'rest') return 'rest'
  return date < dateKey() ? 'miss' : 'todo'
}

export function streak(s) {
  let n = 0
  const d = new Date()
  for (let i = 0; i < 365; i++, d.setDate(d.getDate() - 1)) {
    const st = dayStatus(s, dateKey(d))
    if (st === 'done') n++
    else if (st === 'todo' || st === 'rest' || st === 'skip') continue
    else break // miss | pre
  }
  return n
}

export const finishedDates = (s) => Object.entries(s.logs).filter(([, l]) => l.finished).map(([d]) => d).sort()

export const waterGoal = (p, train = false) => targets(p).glasses(train) // แก้ว 250 มล. (วันฝึก +500 มล.)

export function getAchievements(s) {
  const w = s.weights
  const goal = waterGoal(s.profile)
  return achievements({
    finished: finishedDates(s).length,
    streak: streak(s),
    hasPR: personalBests(s.logs).length > 0,
    lost: w.length > 1 ? w.at(-1).kg - w[0].kg : 0,
    measured: s.measures.length,
    waterDays: Object.values(s.logs).filter((l) => (l.food?.water || 0) >= goal).length,
  })
}

/** สรุปสัปดาห์ที่เริ่มวันจันทร์ = monday (YYYY-MM-DD) */
export function weekStats(s, monday) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const logs = days.map((d) => s.logs[d]).filter(Boolean)
  return {
    workouts: logs.filter((l) => l.finished).length,
    sets: logs.reduce((n, l) => n + setsDone(l), 0),
    volume: logs.reduce((n, l) => n + volumeOf(l), 0),
  }
}
