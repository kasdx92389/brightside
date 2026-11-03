// รัน: npm run check — เช็คสูตรและตัวออกแบบโปรแกรม
import assert from 'node:assert/strict'
import { bmi, bmiBand, targets, healthyRange } from '../src/lib/calc.js'
import { generatePlan, PPL } from '../src/data/plan.js'
import { byId, EXERCISES } from '../src/data/exercises.js'
import { FOODS, ADDONS, addonById, suggestAddons } from '../src/data/foods.js'
import { unitInfo, fmtAmt } from '../src/lib/units.js'
import { mealTargets } from '../src/lib/calc.js'
import { addFood, removeFood, getState } from '../src/store.js'
import { overloadHint, timedSeconds, goalProgress, deloadDue, inDeload, addDays, achievements } from '../src/lib/coach.js'

// BMI ตามตัวอย่างใน Artifact (67.95 กก. / 168 ซม.)
const b = bmi(67.95, 168)
assert.ok(Math.abs(b - 24.07) < 0.01)
assert.equal(bmiBand(b).label, 'ท้วม')
assert.equal(bmiBand(22.9).label, 'สมส่วน')
assert.equal(bmiBand(23).label, 'ท้วม')
assert.deepEqual(healthyRange(168), [52.2, 64.6])

// เป้าแคลอรี่ใกล้เคียง Artifact (1,900–2,100 kcal / โปรตีน 120–140 g)
const tg = targets({ sex: 'm', age: 30, weight: 67.95, height: 168, days: 5, goal: 'lose' })
assert.ok(tg.kcal >= 1900 && tg.kcal <= 2100, `kcal ${tg.kcal}`)
assert.ok(tg.protein[0] >= 105 && tg.protein[1] <= 140, `protein ${tg.protein}`)

// ตารางเดิม + ข้อมูลท่าครบ
for (const d of PPL.days) for (const it of d.items) assert.ok(byId[it.id], `PPL missing ${it.id}`)
for (const e of EXERCISES) assert.ok(e.gain && e.how.length >= 3 && e.avoid, `incomplete ${e.id}`)
import { existsSync } from 'node:fs'
for (const e of EXERCISES) if (e.db) for (const n of [0, 1]) assert.ok(existsSync(new URL(`../public/ex/${e.db}/${n}.jpg`, import.meta.url)), `missing image ${e.id}`)
for (const e of EXERCISES) assert.equal(new URL(e.video).origin, 'https://www.youtube.com', `video source ${e.id}`) // วิดีโอแหล่งเดียว

// ตัวออกแบบ: ทุกชุดตัวเลือกต้องได้ท่าถูกต้อง ไม่ซ้ำในวัน และใช้เฉพาะอุปกรณ์/ระดับที่เลือก
const ALLOW = { gym: ['bw', 'db', 'bb', 'cable', 'machine', 'band'], db: ['bw', 'db', 'band'], home: ['bw'] }
let n = 0
for (const goal of ['lose', 'fit', 'muscle'])
  for (const level of [1, 2, 3])
    for (const days of [3, 4, 5, 6])
      for (const equip of ['gym', 'db', 'home']) {
        const p = generatePlan({ goal, level, days, equip })
        const tag = `${goal}/${level}/${days}/${equip}`
        assert.equal(p.days.length, 7)
        assert.equal(p.days.filter((d) => d.kind === 'train').length, days)
        for (const d of p.days) {
          const ids = d.items.map((i) => i.id)
          assert.equal(new Set(ids).size, ids.length, `dup ${tag}`)
          for (const i of d.items) {
            const e = byId[i.id]
            assert.ok(e, `unknown ${i.id}`)
            assert.ok(ALLOW[equip].includes(e.eq), `${e.id} needs ${e.eq} for ${tag}`)
            assert.ok(e.lv <= level, `${e.id} lv ${e.lv} > ${level}`)
          }
          if (d.kind === 'train') assert.ok(d.items.length >= 3, `thin ${d.name} ${tag}: ${d.items.length}`)
        }
        n++
      }
console.log(`ok — ${n} plans, ${EXERCISES.length} exercises`)

// ── โค้ช: เพิ่มน้ำหนัก (ครบทุกเซ็ตที่ครั้งสูงสุด → +2.5 กก.)
const L = (d, sets) => ({ [d]: { sets: { x: sets } } })
const full = [{ done: 1, kg: 20, reps: 12 }, { done: 1, kg: 20, reps: 12 }, { done: 1, kg: 20, reps: 12 }]
assert.deepEqual(overloadHint(L('2026-10-20', full), 'x', '10–12', '2026-10-27'), { kg: 22.5, was: 20 })
assert.equal(overloadHint(L('2026-10-20', [{ done: 1, kg: 20, reps: 12 }, { done: 1, kg: 20, reps: 10 }, { done: 1, kg: 20, reps: 12 }]), 'x', '10–12', '2026-10-27'), null) // ไม่ครบ 12
assert.equal(overloadHint(L('2026-10-20', [...full.slice(0, 2), {}]), 'x', '10–12', '2026-10-27'), null) // เซ็ตไม่ครบ (3 เซ็ตแต่ทำ 2)
assert.equal(overloadHint(L('2026-10-27', full), 'x', '10–12', '2026-10-27'), null) // วันเดียวกันไม่นับ
assert.equal(overloadHint(L('2026-10-20', full), 'x', '40–60 นาที', '2026-10-27'), null) // ท่าจับเวลา
assert.equal(timedSeconds('30–60 วินาที'), 60)
assert.equal(timedSeconds('20 นาที'), null) // ยาวเกิน 10 นาที ไม่ตั้ง timer
assert.equal(timedSeconds('5 นาที'), 300)
assert.equal(timedSeconds('10–12'), null)

// ── สัปดาห์เบา
assert.equal(addDays('2026-10-31', 1), '2026-11-01')
assert.equal(deloadDue({ plan: { startedAt: '2026-09-19' }, deloadUntil: null }, '2026-10-31'), true) // 42 วันพอดี
assert.equal(deloadDue({ plan: { startedAt: '2026-09-20' }, deloadUntil: null }, '2026-10-31'), false)
assert.equal(inDeload({ deloadUntil: '2026-11-06' }, '2026-11-01'), true)
assert.equal(inDeload({ deloadUntil: '2026-11-06' }, '2026-11-07'), false)

// ── เป้าหมายน้ำหนัก (ลดและเพิ่ม)
assert.deepEqual(goalProgress([{ kg: 70 }, { kg: 67 }], 62), { pct: 3 / 8, left: 5, dir: -1 })
assert.equal(goalProgress([{ kg: 70 }, { kg: 61 }], 62).left, 0) // เกินเป้า
assert.equal(goalProgress([{ kg: 55 }, { kg: 57 }], 60).pct, 0.4)
assert.equal(goalProgress([{ kg: 55 }], 0), null)

// ── เหรียญ
const med = achievements({ finished: 10, streak: 3, hasPR: true, lost: -2.4, measured: 0, waterDays: 0 })
assert.deepEqual(med.filter((m) => m.done).map((m) => m.id), ['first', 'ten', 'pr', 'lost'])
console.log('ok — coach logic')

// ── โภชนาการรายบุคคล
const P = { sex: 'm', age: 30, weight: 70, height: 170, days: 4 } // BMI 24.2
const T = (o) => targets({ ...P, goal: 'fit', ...o })
for (const goal of ['lose', 'fit', 'muscle']) for (const sex of ['m', 'f']) for (const age of [15, 30, 65]) for (const w of [45, 70, 120]) {
  const t = T({ goal, sex, age, weight: w })
  const kcalFromMacros = t.protein.reduce((a, b) => a + b) / 2 * 4 + t.carb * 4 + t.fat * 9
  assert.ok(Math.abs(kcalFromMacros - t.kcal) / t.kcal < 0.12, `macro sum ${goal}/${sex}/${age}/${w}: ${kcalFromMacros} vs ${t.kcal}`)
  assert.ok(t.water >= 1.6 && t.waterTrain === Math.round((t.water + 0.5) * 10) / 10 && t.glasses(true) > t.glasses(false))
  if (age < 18) assert.ok(t.delta >= 0, 'teen no deficit')
  if (age >= 60) assert.ok(t.delta >= -300, 'senior deficit cap')
}
assert.ok(T({ goal: 'lose', weight: 50 }).delta > 0, 'BMI<18.5 ต้องเกินดุลแม้เลือกลดไขมัน') // BMI 17.3
assert.equal(T({ goal: 'lose', weight: 90 }).delta, -500) // BMI 31
assert.equal(T({ goal: 'muscle', weight: 90 }).delta, 0) // BMI ≥ 25 recomp
assert.ok(T({ goal: 'muscle', weight: 60 }).delta > 0) // BMI 20.8
assert.ok(T({ goal: 'fit', weight: 90 }).protein[1] < 90 * 1.8, 'BMI สูงคิดโปรตีนจากน้ำหนักปรับ')
const mt = mealTargets(T({ goal: 'fit' }))
assert.equal(mt.length, 4)
assert.ok(Math.abs(mt.reduce((n, m) => n + m.kcal, 0) - T({ goal: 'fit' }).kcal) <= 40)

// ฐานข้อมูลอาหาร: พลังงานต้องสอดคล้องกับสารอาหาร (±15% หรือ ±25 kcal) และไม่มีรหัสซ้ำ
assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length, 'food id dup')
for (const f of FOODS.filter((x) => !x.alc)) {
  const est = f.p * 4 + f.c * 4 + f.f * 9
  assert.ok(Math.abs(est - f.k) <= Math.max(25, f.k * 0.15), `food ${f.n}: kcal ${f.k} vs macros ${est}`)
}

// ตัวเลือกปริมาณตามหน่วย: นับเป็นฟอง · ครึ่งชาม · กรัม · หน่วยฐานหลายชิ้น · ชุดผสม
{
  const U = (n) => unitInfo(FOODS.find((f) => f.n === n))
  assert.deepEqual([U('ไข่ต้ม').word, U('ไข่ต้ม').step, U('ไข่ต้ม').min], ['ฟอง', 1, 1])
  assert.ok(U('ไข่ต้ม').presets.includes(3))
  assert.deepEqual([U('ข้าวต้มไก่').word, U('ข้าวต้มไก่').step], ['ชาม', 0.5])
  assert.ok(U('อกไก่ต้ม/ย่าง').kind === 'g' && U('อกไก่ต้ม/ย่าง').presets.includes(150))
  assert.deepEqual(U('นักเก็ตไก่').presets, [1, 4, 8, 12]) // 4 ชิ้น/หน่วย
  assert.equal(U('ข้าวเหนียวหมูปิ้ง').word, 'ชุด')
  assert.equal(fmtAmt(1.5), '1½')
  for (const f of FOODS) { const u = unitInfo(f); assert.ok(u.base > 0 && u.min > 0 && u.presets.length && u.presets.every((p) => p >= u.min && p <= u.max), `unit ${f.n} (${f.u})`) }
}

// เครื่องปรุง: id ไม่ซ้ำ · kcal สอดคล้องสูตร · คำแนะนำชี้ไปที่ id ที่มีอยู่จริง
assert.equal(new Set(ADDONS.map((x) => x.id)).size, ADDONS.length, 'addon id dup')
for (const x of ADDONS) assert.ok(Math.abs(x.p * 4 + x.c * 4 + x.f * 9 - x.k) <= Math.max(25, x.k * 0.15), `addon ${x.n}`)
for (const f of FOODS) for (const id of suggestAddons(f)) assert.ok(addonById[id], `addon tip ${id}`)
assert.equal(addonById['oil-น้ำมันรำข้าว'].k, 120)

// บันทึก/ลบอาหาร: ยอดรวมต้องกลับมาเท่าเดิม
const D = '2026-11-03'
addFood(D, { id: 'x', n: 'x', q: 1, s: 0, k: 300, p: 20, c: 30, f: 10 })
addFood(D, { id: 'y', n: 'y', q: 2, s: 1, k: 100, p: 5.5, c: 10, f: 1 })
assert.deepEqual([getState().logs[D].food.kcal, getState().logs[D].food.protein, getState().logs[D].food.items.length], [400, 25.5, 2])
removeFood(D, 0)
assert.deepEqual([getState().logs[D].food.kcal, getState().logs[D].food.protein, getState().logs[D].food.items.length], [100, 5.5, 1])
removeFood(D, 5) // index เกิน ไม่ทำอะไร
assert.equal(getState().logs[D].food.items.length, 1)
console.log('ok — nutrition')
