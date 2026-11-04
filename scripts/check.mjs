// รัน: npm run check — เช็คสูตรและตัวออกแบบโปรแกรม
import assert from 'node:assert/strict'
import { bmi, bmiBand, targets, healthyRange } from '../src/lib/calc.js'
import { generatePlan, PPL } from '../src/data/plan.js'
import { byId, EXERCISES } from '../src/data/exercises.js'
import { FOODS, ADDONS, addonById, suggestAddons, matchName } from '../src/data/foods.js'
import { unitInfo, fmtAmt } from '../src/lib/units.js'
import { suggestKg, effectiveWeight, hasSuggestion, personalFactor } from '../src/lib/loads.js'
import { EXERCISES as ALL_EX } from '../src/data/exercises.js'
import { mealTargets } from '../src/lib/calc.js'
import { planLimits, planConflicts, fixPlan, whyAvoid, IMPACT, BALLISTIC, OLYMPIC, HEAVY_HINGE, HEAVY_HINGE_ALL, SUPINE, PRONE, SCREEN, PREG } from '../src/lib/safety.js'
import { teenEER } from '../src/lib/calc.js'
import { sanitizeState, sanitizeProfile, sanitizePlan } from '../src/lib/sanitize.js'
import { addFood, removeFood, updateFood, getState, addMyFood, removeMyFood } from '../src/store.js'
import { gramsPerUnit, gramInfo, addonGw } from '../src/data/grams.js'
import { merge } from '../src/lib/merge.js'
import { MOODS, MOOD_BY, moodOf, isLow, isHigh, pastEncouragement, sustainedLow, monthSummary, moodVsTraining, validDate, validMonth, kindLine, NOTE_MAX } from '../src/lib/mood.js'
import { weightTrend, calorieAdvice, adherence, groupBalance, fatigueFlag, expectedRange, ADJ_MAX } from '../src/lib/review.js'
import { setMood, setKcalAdj } from '../src/store.js'
import { RECIPES, INGREDIENTS } from '../src/data/recipes.js'
import { sodiumOf, addonSodium, itemSodium } from '../src/data/sodium.js'
import { loadStep, regressHint, overloadHint, timedSeconds, goalProgress, deloadDue, inDeload, addDays, achievements } from '../src/lib/coach.js'

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
        { // ข้อกำหนดจากงานวิจัย: กลุ่มใหญ่ฝึก ≥2 วัน/สัปดาห์ (ACSM 2009; Schoenfeld 2016) · เป้ากล้ามเนื้อ ≥9 เซ็ต/สัปดาห์/กลุ่มใหญ่ (Schoenfeld 2017: ยิ่งเซ็ตมากยิ่งโต)
          const wkSets = {}, wkDays = {}
          for (const d of p.days) {
            const seen = new Set()
            for (const i of d.items) {
              if (/วินาที|นาที|เมตร/.test(String(i.reps))) continue
              const g = byId[i.id].g
              wkSets[g] = (wkSets[g] || 0) + i.sets; seen.add(g)
            }
            for (const g of seen) wkDays[g] = (wkDays[g] || 0) + 1
          }
          for (const g of ['chest', 'back', 'legs']) {
            assert.ok(wkDays[g] >= 2, `${g} only ${wkDays[g] || 0} day(s)/wk in ${tag}`)
            if (goal === 'muscle') assert.ok(wkSets[g] >= 9, `${g} only ${wkSets[g]} sets/wk in ${tag}`)
          }
          if (goal === 'muscle' && level >= 2) assert.ok(wkSets.shoulder >= 6, `shoulder only ${wkSets.shoulder || 0} sets/wk in ${tag}`)
          if (level === 1) for (const d of p.days) for (const i of d.items) assert.ok(!['barbell-deadlift', 'good-morning', 'power-clean', 'rack-pull', 'barbell-row', 'bent-db-row'].includes(i.id), `risky lift ${i.id} for beginner ${tag}`)
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
// ก้าวน้ำหนักตามอุปกรณ์ + ถอยเมื่อยกไม่ไหวจริง
assert.equal(loadStep('machine', 45), 2.5, 'machine/cable <50 kg: 2.5 (≤10% step, ACSM 2–10%)')
assert.deepEqual([loadStep('db', 5), loadStep('db', 12), loadStep('db', 35), loadStep('bb', 40), loadStep('bb', 100), loadStep('machine', 20), loadStep('machine', 60), loadStep('bw', 0)], [1, 2, 2.5, 2.5, 5, 2.5, 5, 2.5])
{
  const mk = (kg, reps) => ({ '2026-11-01': { sets: { x: reps.map((r) => ({ done: true, kg, reps: r })) } } })
  // ครบช่วงเป้าหมาย (3×10–12 ทำ 12,12,12 ที่ ดัมเบล 5 กก.) → +1 กก. ไม่ใช่ +2.5
  assert.deepEqual(overloadHint(mk(5, [12, 12, 12]), 'x', '10–12', '2026-11-02', 2.5, 'db'), { kg: 6, was: 5 })
  assert.deepEqual(overloadHint(mk(60, [8, 8, 8]), 'x', '6–8', '2026-11-02', 2.5, 'machine'), { kg: 65, was: 60 })
  assert.deepEqual(overloadHint(mk(20, [12, 12, 12]), 'x', '10–12', '2026-11-02'), { kg: 22.5, was: 20 }, 'legacy default step kept')
  // ยกไม่ถึงช่วง (เป้า 10–12 ทำได้ 7,6,6 ที่ 10 กก.) → ลด ~10% ปัดตามอุปกรณ์
  assert.deepEqual(regressHint(mk(10, [7, 6, 6]), 'x', '10–12', '2026-11-02', 'db'), { kg: 9, was: 10 })
  assert.equal(regressHint(mk(10, [9, 9, 9]), 'x', '10–12', '2026-11-02', 'db'), null, 'only 1 under range is fine')
  assert.equal(regressHint(mk(10, [7]), 'x', '10–12', '2026-11-02', 'db'), null, 'one set is not enough')
  assert.equal(regressHint(mk(10, [3, 3, 3]), 'x', '30 วินาที', '2026-11-02', 'db'), null, 'timed ignored')
  assert.equal(regressHint(mk(10, [7, 6, 6]), 'x', '10–12', '2026-11-01', 'db'), null, 'only earlier days')
}
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
  // ค้นหา: หลายคำ · ไม่สนช่องว่าง · คำอังกฤษ
  const found = (q) => FOODS.filter((f) => matchName(f.n, q)).map((f) => f.n)
  assert.ok(found('ไข่ ต้ม').includes('ไข่ต้ม') && found('ข้าวต้ม ไก่').includes('ข้าวต้มไก่'))
  assert.ok(found('coke').includes('โค้กซีโร่') && found('egg').length > 5 && found('tea').includes('ชาเย็น'))
  assert.equal(found('zzzz').length, 0)
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
// แก้รายการ: ยอดรวมต้องตามไปด้วย · index เกินไม่ทำอะไร
updateFood(D, 0, { id: 'y', n: 'y', q: 3, s: 2, k: 150, p: 8, c: 15, f: 2 })
assert.deepEqual([getState().logs[D].food.kcal, getState().logs[D].food.protein, getState().logs[D].food.items[0].s], [150, 8, 2])
updateFood(D, 9, { id: 'z', n: 'z', q: 1, s: 0, k: 1, p: 1, c: 1, f: 1 })
assert.equal(getState().logs[D].food.kcal, 150)
console.log('ok — nutrition')

// โหมดชั่งกรัม: ทุกเมนูมีน้ำหนักต่อหน่วย (ความหนาแน่นพลังงานไม่เพี้ยน) · เครื่องปรุงทุกตัวมีกรัมต่อหน่วย · แปลงกรัม↔ตัวคูณถูกต้อง · เมนูของฉัน
{
  for (const f of FOODS) {
    const g = gramsPerUnit(f)
    assert.ok(g > 0, 'no grams: ' + f.n)
    const dens = (f.k / g) * 100
    assert.ok(dens >= 0 && dens <= 760, `density ${f.n}: ${Math.round(dens)} kcal/100g (${g} g)`)
  }
  for (const a of ADDONS) {
    const g = addonGw(a)
    assert.ok(g > 0 && a.k / g <= 9.5, 'addon grams ' + a.n + ' ' + g + ' -> ' + (a.k / g).toFixed(1) + ' kcal/g')
  }
  const egg = FOODS.find((x) => x.n === 'ไข่ต้ม')
  const gi = gramInfo(gramsPerUnit(egg)) // 50 g ต่อฟอง
  assert.deepEqual([gi.word, gi.base, gi.step], ['g', 50, 5])
  assert.equal(Math.round(egg.k * (100 / gi.base)), 150, '100 g ของไข่ต้ม = 2 ฟอง = 150 kcal')
  assert.equal(gramsPerUnit(FOODS.find((x) => x.n === 'อกไก่ต้ม/ย่าง')), 100) // หน่วยเป็นกรัมอยู่แล้ว
  assert.ok(gramInfo(13).step === 1 && gramInfo(250).step === 10 && gramInfo(60).presets.length >= 4)
  // เมนูของฉัน: เพิ่ม/ลบ + ซิงก์ (merge) ไม่ทำให้หาย
  addMyFood({ id: 'my-t', n: 'ซอสบ้าน', u: '100 g', k: 120, p: 2, c: 20, f: 3 })
  assert.equal(getState().myFoods.length, 1)
  const merged = merge({ ...getState(), mod: { myFoods: 2 } }, { ...getState(), myFoods: [], mod: { myFoods: 1 } })
  assert.equal(merged.myFoods.length, 1, 'newer myFoods wins')
  const merged2 = merge({ ...getState(), myFoods: [], mod: { myFoods: 1 } }, { ...getState(), mod: { myFoods: 5 } })
  assert.equal(merged2.myFoods.length, 1, 'remote newer myFoods wins')
  removeMyFood('my-t')
  assert.equal(getState().myFoods.length, 0)
}

// โซเดียม: ทุกเมนู/เครื่องปรุงมีค่า · ช่วงสมเหตุสมผล · ลำดับความเค็มถูกต้อง · รายการเก่าไม่มี na ประมาณจากฐานข้อมูล
{
  for (const f of FOODS) {
    const na = sodiumOf(f)
    assert.ok(Number.isFinite(na) && na >= 0 && na <= 3000, `sodium ${f.n}: ${na}`)
    const g = gramsPerUnit(f)
    assert.ok((na / g) * 100 <= 2500, `sodium density ${f.n}: ${Math.round((na / g) * 100)} mg/100g`)
  }
  for (const a of ADDONS) assert.ok(Number.isFinite(addonSodium(a)) && addonSodium(a) >= 0, 'addon sodium ' + a.n)
  const F = (n) => FOODS.find((x) => x.n === n)
  const A = (n) => ADDONS.find((x) => x.n === n)
  assert.ok(sodiumOf(F('ข้าวสวย')) < 20 && sodiumOf(F('กล้วยหอม')) < 30, 'plain foods ~ no sodium')
  assert.ok(sodiumOf(F('ก๋วยเตี๋ยวน้ำใสหมู')) > 1200 && sodiumOf(F('ก๋วยเตี๋ยวน้ำใสหมู')) < 2600, 'noodle soup is salty')
  assert.ok(sodiumOf(F('ข้าวมันไก่')) > sodiumOf(F('อกไก่ต้ม/ย่าง')), 'dish > plain chicken')
  assert.ok(sodiumOf(F('โค้กซีโร่')) <= 60 && sodiumOf(F('บะหมี่กึ่งสำเร็จรูป')) >= 1500)
  assert.ok(addonSodium(A('น้ำปลา')) > 300 && addonSodium(A('เกลือ')) > 2000 && addonSodium(A('น้ำมันรำข้าว')) === 0, 'add-on sodium')
  assert.equal(itemSodium({ id: F('ข้าวมันไก่').id, q: 2 }, { [F('ข้าวมันไก่').id]: F('ข้าวมันไก่') }), sodiumOf(F('ข้าวมันไก่')) * 2, 'legacy item estimated by quantity')
  assert.equal(itemSodium({ id: 'x', q: 1, na: 123 }, {}), 123, 'recorded na wins')
  assert.equal(itemSodium({ id: 'gone', q: 1 }, {}), 0)
  assert.equal(sodiumOf({ n: 'x', cat: 'meal', k: 100, na: 55 }), 55, 'my food na wins')
}

// สูตรอาหาร: ค่าคำนวณสมเหตุสมผล · ไม่ซ้ำชื่อ · id/หน่วยของเมนูเดิมที่เคยบันทึกต้องไม่เปลี่ยน · ลำดับความหนักเบาถูกต้อง
{
  const names = RECIPES.map((r) => r.n)
  assert.equal(new Set(names).size, names.length, 'recipe name dup: ' + names.filter((n, i) => names.indexOf(n) !== i))
  const R = (n) => RECIPES.find((r) => r.n === n)
  const F = (n) => FOODS.find((x) => x.n === n)
  for (const r of RECIPES) {
    assert.ok([r.k, r.p, r.c, r.f, r.na, r.gw].every(Number.isFinite) && r.k > 0 && r.gw > 20, 'recipe numbers ' + r.n)
    assert.ok(r.k / r.gw >= 0.2 && r.k / r.gw <= 6.5, `recipe density ${r.n}: ${(r.k / r.gw).toFixed(2)} kcal/g`) // กระทั่งหมูกรอบ/น้ำมันท่วมก็ไม่เกิน ~6
    assert.ok(Math.abs(r.p * 4 + r.c * 4 + r.f * 9 - r.k) <= Math.max(30, r.k * 0.15), 'recipe macros ' + r.n)
  }
  assert.ok(Object.values(INGREDIENTS).every((v) => v.length === 5 && v.every((x) => x >= 0)), 'ingredient rows')
  // ลำดับ: ใส่เนื้อ/ไข่เพิ่ม ต้องมากกว่าผักล้วน · ไข่ดาวเพิ่ม ~ +100–200 kcal · หมูกรอบมันกว่าไก่
  assert.ok(R('ผัดผักกาดขาวไก่สับ').k > R('ผัดผักกาดขาว').k && R('ผัดผักกาดขาวไข่').k > R('ผัดผักกาดขาว').k)
  for (const p of ['หมู', 'ไก่', 'เนื้อ', 'กุ้ง']) {
    const d = R(`ข้าวกะเพรา${p}ไข่ดาว`).k - R(`ข้าวกะเพรา${p}`).k
    assert.ok(d >= 100 && d <= 200, `egg adds ${d}`)
  }
  assert.ok(R('ข้าวกะเพราหมูกรอบ').k > R('ข้าวกะเพราไก่').k && R('ก๋วยเตี๋ยวต้มยำหมู').na > 1000 && R('ผัดซีอิ๊วหมู').k > R('ก๋วยเตี๋ยวน้ำใสหมู').k)
  // เมนูเดิมที่เคยบันทึกไว้ต้องยังเจอด้วย id เดิม (รายการเก่าแก้ไข/ประมาณโซเดียมได้)
  for (const id of ['meal-ข้าวมันไก่', 'meal-ข้าวกะเพราไก่ไข่ดาว', 'meal-ก๋วยเตี๋ยวน้ำใสหมู', 'meal-ผัดไทยกุ้ง', 'meal-ส้มตำไทย', 'dish-ผัดผักกาดขาว', 'dish-ผัดผักกาดขาวไก่สับ', 'dish-แกงจืดวุ้นเส้น', 'dish-ต้มยำทะเลน้ำใส',
    'rice-ข้าวญี่ปุ่นสุก', 'plant-ผัดผักรวม', 'meat-ไข่เจียว', 'meat-ไข่ต้ม', 'meat-ปลาหมึกย่าง', 'noodle-ก๋วยเตี๋ยวไก่ น้ำใส', 'noodle-ราเมง', 'rice-ข้าวต้มไก่', 'rice-โจ๊กหมู (ไม่ใส่ไข่)', 'dish-น้ำพริกหมูสับ', 'drink-โค้กซีโร่', 'snack-ข้าวเหนียวมะม่วง']) assert.ok(FOODS.some((x) => x.id === id), 'old id lost: ' + id)
  assert.ok(F('ข้าวมันไก่').u === '1 จาน' && F('ไข่เจียว').u === '1 ฟอง' && F('ราเมง').u === '1 ชาม', 'old units kept')
  assert.ok(FOODS.length >= 590, 'food count ' + FOODS.length)
}

// น้ำหนักเริ่มต้นแนะนำ: ครอบคลุมท่าที่มีน้ำหนักทุกท่า · ทิศทางสมเหตุสมผล · ค่าไม่เพี้ยน
{
  const byId2 = Object.fromEntries(ALL_EX.map((e) => [e.id, e]))
  const weighted = ALL_EX.filter((e) => ['db', 'bb', 'cable', 'machine'].includes(e.eq) && e.g !== 'cardio' && !/นาที|เมตร/.test(e.rx) && e.id !== 'glute-ham-raise') // glute-ham-raise ใช้น้ำหนักตัว
  const missing = weighted.filter((e) => !hasSuggestion(e.id)).map((e) => e.id)
  assert.deepEqual(missing, [], 'ท่าที่ยังไม่มีน้ำหนักแนะนำ: ' + missing)
  assert.ok(Object.keys(byId2).length && ALL_EX.every((e) => !hasSuggestion(e.id) || ['db', 'bb', 'cable', 'machine'].includes(e.eq)), 'suggestion only for weighted equipment')
  const man = { weight: 70, height: 175, sex: 'm', age: 28, level: 1 }
  const S = (id, p = man) => suggestKg(byId2[id], p).kg
  assert.ok(S('barbell-squat') >= 25 && S('barbell-squat') <= 45, 'squat ~35 for 70kg male: ' + S('barbell-squat'))
  assert.ok(S('barbell-bench') <= S('barbell-squat') + 5 && S('db-curl') <= 8 && S('lat-pulldown') >= 25, 'sane ratios')
  assert.ok(S('db-bench-press', { ...man, sex: 'f' }) < S('db-bench-press'), 'female lighter')
  assert.ok(S('db-bench-press', { ...man, age: 68 }) < S('db-bench-press'), 'senior lighter')
  assert.ok(S('db-bench-press', { ...man, age: 15 }) < S('db-bench-press'), 'teen lighter')
  assert.ok(S('lat-pulldown', { ...man, level: 3 }) > S('lat-pulldown'), 'advanced heavier')
  const big = { ...man, weight: 130 }
  assert.ok(S('leg-press', big) > S('leg-press') && S('leg-press', big) < S('leg-press') * 130 / 70, 'heavy BMI: heavier but not proportional to fat')
  assert.ok(effectiveWeight(120, 172) < 120 && effectiveWeight(60, 175) === 60 && effectiveWeight(40, 170) < 40, 'effective weight')
  assert.equal(suggestKg(byId2['pushup'], man), null)
  // ตัวคูณส่วนตัว: ยกเบากว่าที่แนะนำ → คำแนะนำท่าอื่นเบาลงตาม · ข้อมูลไม่พอ/ไม่มี = 1 · ถูกจำกัดช่วง
  const lg = (kgById) => ({ '2026-11-01': { sets: Object.fromEntries(Object.entries(kgById).map(([id, kg]) => [id, [{ done: true, kg, reps: 10 }]])) } })
  const half = (id) => Math.round(suggestKg(byId2[id], man).kg / 2)
  assert.equal(personalFactor({}, byId2, man), 1)
  assert.equal(personalFactor(lg({ 'db-curl': suggestKg(byId2['db-curl'], man).kg }), byId2, man), 1, 'one exercise is not enough')
  const f = personalFactor(lg({ 'db-bench-press': half('db-bench-press'), 'lat-pulldown': half('lat-pulldown'), 'leg-press': half('leg-press') }), byId2, man)
  assert.ok(f >= 0.4 && f <= 0.6, 'lifting half -> factor ~0.5: ' + f)
  assert.ok(suggestKg(byId2['db-shoulder-press'], man, f).kg < suggestKg(byId2['db-shoulder-press'], man).kg, 'suggestion scaled by personal factor')
  assert.equal(personalFactor(lg({ 'db-bench-press': 200, 'lat-pulldown': 300 }), byId2, man), 1.3, 'capped high')
  assert.equal(personalFactor(lg({ 'db-bench-press': 1, 'lat-pulldown': 1 }), byId2, man), 0.4, 'capped low')
  assert.equal(personalFactor({ '2026-11-01': { sets: { 'db-curl': [{ done: false, kg: 99 }], 'lat-pulldown': [{ done: true, kg: 0 }] } } }, byId2, man), 1, 'undone / zero-kg sets ignored')
  assert.equal(suggestKg(byId2['barbell-squat'], null), null)
  for (const p of [man, { weight: 42, height: 165, sex: 'f', age: 22, level: 1 }, { weight: 120, height: 172, sex: 'm', age: 35, level: 3 }, { weight: 58, height: 155, sex: 'f', age: 75, level: 1 }]) {
    for (const e of weighted) {
      const r = suggestKg(e, p)
      assert.ok(r && r.kg > 0 && r.kg <= 400 && Number.isFinite(r.kg), `load ${e.id} ${JSON.stringify(p)} -> ${r?.kg}`)
    }
  }
}

// ───── อารมณ์ / ความทรงจำ ─────
{
  assert.equal(MOODS.length, 10)
  assert.equal(new Set(MOODS.map((m) => m.id)).size, 10)
  assert.ok(MOODS.every((m) => /^#[0-9a-f]{6}$/i.test(m.c) && m.v >= 1 && m.v <= 5 && m.th))
  assert.ok(isHigh(MOOD_BY.joy) && isLow(MOOD_BY.cry) && !isLow(MOOD_BY.meh) && !isHigh(MOOD_BY.meh))
  assert.equal(moodOf({ mood: { m: 'nope' } }), null)
  assert.ok(validDate('2026-11-04') && !validDate('2026-02-30') && !validDate('2026-1-4') && !validDate(undefined))
  assert.ok(validMonth('2026-11') && !validMonth('2026-13') && !validMonth('2026-11-04'))
  const today = '2026-11-10'
  const L = (m, note = '', extra = {}) => ({ mood: { m, note, at: 1 }, ...extra })
  const logs = { '2026-11-01': L('joy', 'วันนี้ยกขาไหวแล้ว ภูมิใจมาก'), '2026-11-02': L('proud', 'สั้น'), '2026-11-05': L('sad', 'เหนื่อยจัง'), '2026-11-06': L('tired'), '2026-11-07': L('cry'), '2026-11-08': L('angry'), '2026-11-09': L('sad') }
  // กำลังใจ: ใช้เฉพาะข้อความของวันที่อารมณ์ดีและยาว ≥8 ตัวอักษร · คงที่ตามวันที่
  const e = pastEncouragement(logs, '2026-11-07', today)
  assert.equal(e.date, '2026-11-01'); assert.equal(pastEncouragement(logs, '2026-11-07', today).note, e.note)
  assert.equal(pastEncouragement({ '2026-11-02': logs['2026-11-02'] }, '2026-11-07', today), null, 'short note not used')
  assert.equal(pastEncouragement({ '2026-11-12': L('joy', 'ข้อความจากอนาคตห้ามใช้ทั้งนั้น') }, '2026-11-07', today), null, 'future entries ignored')
  assert.ok(kindLine('2026-11-07').length > 10 && kindLine('2026-11-07') === kindLine('2026-11-07'))
  // หนักต่อเนื่อง: ≥5 วันที่มีบันทึกใน 7 วัน และ ≥5 วันเป็นอารมณ์หนัก
  assert.equal(sustainedLow(logs, today), true, '5 วันติดกันที่บันทึกและหนักทั้ง 5')
}
{
  const today = '2026-11-10'
  const L = (m) => ({ mood: { m, note: '', at: 1 } })
  const five = Object.fromEntries(['06', '07', '08', '09', '10'].map((d, i) => ['2026-11-' + d, L(['sad', 'cry', 'tired', 'angry', 'sad'][i])]))
  assert.equal(sustainedLow(five, today), true)
  assert.equal(sustainedLow({ ...five, '2026-11-10': L('joy') }, today), false, '4 จาก 5 ยังไม่ถึงเกณฑ์')
  assert.equal(sustainedLow({ '2026-11-10': L('sad') }, today), false, 'ข้อมูลน้อยไม่สรุป')
  // สรุปเดือน
  assert.equal(monthSummary({}, '2026-11').headline, '')
  assert.equal(monthSummary({ '2026-11-01': L('joy'), '2026-11-02': L('happy'), '2026-11-03': L('calm'), '2026-11-04': L('meh') }, '2026-11').headline, 'เดือนนี้ยิ้มมากหน่อย')
  assert.match(monthSummary({ '2026-11-01': L('sad'), '2026-11-02': L('cry'), '2026-11-03': L('joy') }, '2026-11').headline, /ใจดีกับตัวเอง/)
  assert.equal(monthSummary({ '2026-10-01': L('joy') }, '2026-11').n, 0)
  // อารมณ์กับการฝึก: ต้องมี ≥4 วันทั้งสองกลุ่ม
  assert.equal(moodVsTraining({ a: { ...L('joy'), finished: true } }), null)
  const mix = {}
  for (let i = 1; i <= 4; i++) { mix['t' + i] = { ...L('joy'), finished: true }; mix['o' + i] = { ...L('meh'), finished: false } }
  assert.deepEqual(moodVsTraining(mix), { train: 5, other: 3, nT: 4, nO: 4 })
}
{ // store: บันทึก/ลบอารมณ์ · ห้ามบันทึกอนาคต · ตัดความยาว
  const d = '2026-01-15'
  setMood(d, { m: 'joy', note: '  ดีมาก  ' })
  assert.equal(getState().logs[d].mood.m, 'joy'); assert.equal(getState().logs[d].mood.note, 'ดีมาก')
  setMood(d, { m: 'sad' }); assert.equal(getState().logs[d].mood.note, 'ดีมาก', 'เปลี่ยนอารมณ์ไม่ทำข้อความหาย')
  setMood(d, { note: 'x'.repeat(NOTE_MAX + 50) }); assert.equal(getState().logs[d].mood.note.length, NOTE_MAX)
  setMood(d, { m: 'bogus' }); assert.equal(getState().logs[d].mood, undefined, 'id ที่ไม่รู้จัก = ลบ')
  setMood(addDays(new Date().toISOString().slice(0, 10), 3), { m: 'joy' })
  assert.equal(Object.keys(getState().logs).some((k) => k > new Date(Date.now() + 86400000).toISOString().slice(0, 10) && getState().logs[k].mood), false, 'future date rejected')
  // อารมณ์ไม่กระทบสถานะการฝึก/streak
  assert.equal(getState().logs[d].finished ?? false, false)
}
{ // ซิงก์: อารมณ์อยู่ในล็อกรายวัน → ฝั่งที่แก้ใหม่กว่าชนะทั้งวัน และไม่ทำให้ merge พัง
  const base = { profile: null, plan: null, favs: [], foodFavs: [], myFoods: [], deloadUntil: null, weights: [], measures: [], createdAt: '2026-01-01' }
  const a = { ...base, logs: { '2026-01-15': { sets: {}, mood: { m: 'joy', note: 'a', at: 1 } } }, mod: { 'logs/2026-01-15': 100 } }
  const b = { ...base, logs: { '2026-01-15': { sets: {}, mood: { m: 'sad', note: 'b', at: 2 } } }, mod: { 'logs/2026-01-15': 200 } }
  assert.equal(merge(a, b).logs['2026-01-15'].mood.m, 'sad'); assert.equal(merge(b, a).logs['2026-01-15'].mood.m, 'sad')
}

// ───── โค้ชปรับตามข้อมูลจริง ─────
{
  const today = '2026-11-30'
  const prof = { name: 't', sex: 'm', age: 30, height: 175, weight: 80, days: 4, goal: 'lose', level: 2 }
  const t0 = targets(prof)
  const series = (kgPerWeek, days = 28, start = 80) => Array.from({ length: Math.floor(days / 3) + 1 }, (_, i) => ({ date: addDays(today, -days + i * 3), kg: Math.round((start + kgPerWeek * ((i * 3) / 7)) * 10) / 10 }))
  const food = (kcal, n = 8) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(today, -i - 1), { food: { kcal } }]))
  const S = (over = {}) => ({ profile: prof, plan: generatePlan({ goal: 'lose', level: 2, days: 4, equip: 'gym' }), logs: {}, weights: [], measures: [], createdAt: '2026-01-01', ...over })

  // weightTrend: ต้อง ≥3 ครั้ง ช่วง ≥14 วัน · ความชันตรงตามจริง
  assert.equal(weightTrend([{ date: today, kg: 80 }], addDays(today, -28), today), null)
  assert.equal(weightTrend(series(0, 10), addDays(today, -28), today), null, 'span <14 วัน')
  const tr = weightTrend(series(-0.5), addDays(today, -28), today)
  assert.ok(Math.abs(tr.kgWk + 0.5) < 0.05 && tr.pctWk < -0.5 && tr.pctWk > -0.7, JSON.stringify(tr))
  assert.deepEqual(expectedRange({ mode: 'cut', delta: -400 }), [-1, -0.4]); assert.deepEqual(expectedRange({ mode: 'bulk', delta: 300 }), [0.15, 0.5])

  assert.equal(calorieAdvice(S({ profile: { ...prof, age: 16 } }), today), null, 'อายุ <18 ไม่ปรับ')
  assert.equal(calorieAdvice(S(), today).kind, 'wait', 'ไม่มีน้ำหนัก')
  assert.equal(calorieAdvice(S({ weights: series(-0.35) }), today).kind, 'ok', 'ลด ~0.44%/สัปดาห์ = ตามเป้า')
  const fast = calorieAdvice(S({ weights: series(-1.2) }), today)
  assert.equal(fast.kind, 'adjust'); assert.equal(fast.delta, 150); assert.equal(fast.next, 150); assert.ok(fast.kcal > fast.from)
  // น้ำหนักไม่ลง: ต้องดูว่ากินตามเป้าไหมก่อน
  const stall = (logs) => calorieAdvice(S({ weights: series(0), logs }), today)
  assert.equal(stall({}).kind, 'behavior', 'ไม่มีบันทึกอาหาร ห้ามเดา')
  assert.equal(stall(food(t0.kcal + 500)).kind, 'behavior', 'กินเกินเป้า → แก้พฤติกรรม ไม่ลดเป้า')
  assert.equal(stall(food(Math.round(t0.kcal * 0.6))).kind, 'behavior', 'บันทึกต่ำผิดปกติ')
  const cut = stall(food(t0.kcal)); assert.equal(cut.kind, 'adjust'); assert.equal(cut.delta, -150); assert.ok(cut.kcal < cut.from)
  // เพดานการปรับ ±300 + ต้องรออย่างน้อยหลังวันที่ปรับ
  assert.equal(calorieAdvice(S({ profile: { ...prof, kcalAdj: -300, kcalAdjAt: addDays(today, -40) }, weights: series(0), logs: food(t0.kcal - 300) }), today).kind, 'cap')
  assert.equal(calorieAdvice(S({ profile: { ...prof, kcalAdj: -150, kcalAdjAt: addDays(today, -5) }, weights: series(0) }), today).kind, 'wait', 'เพิ่งปรับ ต้องรอ 2 สัปดาห์')
  // ไม่ลดต่ำกว่าขั้นต่ำปลอดภัย
  const lean = { ...prof, sex: 'f', weight: 50, height: 165, age: 30, days: 2 }
  const low = calorieAdvice(S({ profile: lean, weights: series(0, 28, 50), logs: food(targets(lean).kcal) }), today)
  assert.ok(low.kind !== 'adjust' || targets({ ...lean, kcalAdj: low.next }).kcal >= 1200, JSON.stringify(low))
  // เป้าเพิ่มกล้าม: ขึ้นเร็วไป → ลดเป้า · ไม่ขึ้นและกินครบ → เพิ่มเป้า
  const bulkP = { ...prof, goal: 'muscle', weight: 62, height: 175 }
  const tb = targets(bulkP); assert.equal(tb.mode, 'bulk')
  assert.equal(calorieAdvice(S({ profile: bulkP, weights: series(0.9, 28, 62) }), today).delta, -150)
  assert.equal(calorieAdvice(S({ profile: bulkP, weights: series(0, 28, 62), logs: food(tb.kcal) }), today).delta, 150)
  assert.equal(calorieAdvice(S({ profile: bulkP, weights: series(0, 28, 62), logs: food(tb.kcal - 500) }), today).kind, 'behavior')

  // targets: kcalAdj ใช้จริง จำกัด ±300 ไม่ใช้กับอายุ <18 และปรับคาร์บตาม
  const base = targets(prof)
  assert.equal(targets({ ...prof, kcalAdj: -150 }).kcal, base.kcal - 150)
  assert.equal(targets({ ...prof, kcalAdj: 9999 }).kcal, base.kcal + ADJ_MAX)
  assert.equal(targets({ ...prof, age: 16, kcalAdj: 300 }).kcal, targets({ ...prof, age: 16 }).kcal)
  assert.ok(targets({ ...prof, kcalAdj: -150 }).carb < base.carb)
  setKcalAdj(-130); assert.equal(getState().profile?.kcalAdj ?? -150, -150, 'ปัดทีละ 50')
}
{ // ความสม่ำเสมอ / สมดุลกลุ่ม / ความล้า
  const today = '2026-11-30' // จันทร์
  const plan = generatePlan({ goal: 'fit', level: 2, days: 4, equip: 'gym' })
  const trainDates = []
  for (let i = 1; i <= 28; i++) { const d = addDays(today, -i); const idx = (new Date(d + 'T00:00:00').getDay() + 6) % 7; if (plan.days[idx].kind !== 'rest') trainDates.push(d) } // walk นับเป็นงานของวัน เหมือน dayStatus
  const logsAll = Object.fromEntries(trainDates.map((d) => [d, { finished: true, sets: {} }]))
  const S = (logs) => ({ profile: { age: 30 }, plan, logs, weights: [], measures: [], createdAt: '2026-01-01' })
  const a = adherence(S(logsAll), today); assert.equal(a.pct, 1); assert.equal(a.n, trainDates.filter((d) => d >= addDays(today, -27)).length)
  const half = Object.fromEntries(trainDates.filter((_, i) => i % 2).map((d) => [d, { finished: true, sets: {} }]))
  assert.ok(Math.abs(adherence(S(half), today).pct - 0.5) < 0.1)
  const skipAll = Object.fromEntries(trainDates.map((d) => [d, { skipped: true, sets: {} }]))
  assert.equal(adherence(S(skipAll), today).n, 0, 'วันที่กดข้ามไม่นับว่าพลาด')
  // สมดุลกลุ่ม: ทำขาครบแต่ไม่ทำอกเลย → อกต้องถูกธงว่าต่ำ
  const sets = {}
  for (const d of trainDates.filter((x) => x >= addDays(today, -14))) {
    const idx = (new Date(d + 'T00:00:00').getDay() + 6) % 7
    sets[d] = { sets: Object.fromEntries(plan.days[idx].items.filter((it) => byId[it.id].g !== 'chest').map((it) => [it.id, Array.from({ length: it.sets }, () => ({ done: true }))]) ) }
  }
  const bal = groupBalance(S(sets), today)
  assert.ok(bal.find((x) => x.g === 'chest')?.low, 'chest flagged'); assert.ok(!bal.find((x) => x.g === 'legs')?.low, 'legs not flagged')
  assert.ok(bal.every((x) => x.planned >= 6 && x.done <= x.planned))
  // ความล้า
  const L = (m) => ({ mood: { m, note: '', at: 1 } })
  assert.equal(fatigueFlag(S({ [addDays(today, -1)]: L('tired'), [addDays(today, -2)]: L('sad'), [addDays(today, -3)]: L('angry'), [addDays(today, -4)]: L('joy') }), today).low, 3)
  assert.equal(fatigueFlag(S({ [addDays(today, -1)]: L('tired'), [addDays(today, -2)]: L('sad'), [addDays(today, -3)]: L('joy') }), today), null)
}
console.log('ok — mood, memory, review')

// ───── ความปลอดภัย: ข้อจำกัดท่า/ระดับ/โภชนาการ ทุกกลุ่มผู้ใช้ ─────
{
  for (const ids of [IMPACT, BALLISTIC, OLYMPIC, HEAVY_HINGE_ALL, SUPINE, PRONE]) for (const id of ids) assert.ok(byId[id], 'safety list id missing from library: ' + id)
  assert.ok(byId['single-leg-balance'])
  // ผู้ใหญ่ทั่วไปไม่โดนจำกัดอะไรเลย (พฤติกรรมเดิมต้องไม่เปลี่ยน)
  const adult = { age: 30, sex: 'm', weight: 70, height: 172, level: 3 }
  const L0 = planLimits(adult); assert.equal(L0.maxLevel, 3); assert.equal(L0.avoid.size, 0); assert.equal(L0.reasons.length, 0)
  assert.equal(planLimits({ ...adult, age: 55 }).avoid.has('power-clean'), true); assert.equal(planLimits({ ...adult, age: 55 }).avoid.has('jump-squat'), false)
  assert.equal(planLimits({ ...adult, weight: 100 }).avoid.has('jump-squat'), true, 'BMI ≥30 เลี่ยงท่ากระแทก')
  assert.equal(planLimits({ ...adult, age: 17 }).maxLevel, 2); assert.equal(planLimits({ ...adult, age: 70 }).balance, true)
  assert.equal(planLimits({ ...adult, screen: ['chest'] }).maxLevel, 1)
  assert.equal(planLimits({ ...adult, screen: ['bogus'] }).maxLevel, 3, 'ค่าคัดกรองที่ไม่รู้จักไม่มีผล')
  const pg = (preg) => planLimits({ ...adult, sex: 'f', preg })
  assert.equal(pg('1').avoid.has('crunch'), false); assert.equal(pg('2').avoid.has('crunch'), true); assert.equal(pg('3').avoid.has('plank'), true); assert.equal(pg('pp').avoid.has('crunch'), false)
  assert.ok(whyAvoid('jump-squat', { ...adult, age: 70 }) && !whyAvoid('jump-squat', adult) && whyAvoid('power-clean', { ...adult, level: 3, age: 16 }))

  // เมทริกซ์: ทุกโปรไฟล์ × ทุกเป้า/ระดับ/วัน/อุปกรณ์ → แผนต้องไม่มีท่าต้องห้าม ไม่เกินระดับที่อนุญาต และยังใช้ได้จริง
  const PROFILES = []
  for (const age of [12, 16, 17, 18, 30, 49, 50, 64, 65, 80]) for (const sex of ['m', 'f']) for (const [weight, height] of [[45, 165], [65, 170], [100, 170]])
    for (const screen of [[], ['chest']]) for (const preg of sex === 'f' && age >= 18 && age <= 45 ? ['none', '1', '2', '3', 'pp'] : ['none']) PROFILES.push({ age, sex, weight, height, screen, preg })
  let planCount = 0
  for (const pr of PROFILES) for (const goal of ['lose', 'fit', 'muscle']) for (const level of [1, 2, 3]) for (const equip of ['gym', 'db', 'home']) for (const days of [3, 5]) {
    const p = generatePlan({ ...pr, goal, level, days, equip }); planCount++
    const L = planLimits(pr), tag = JSON.stringify(pr) + goal + level + equip + days
    assert.deepEqual(planConflicts(p, { ...pr, level, equip }), [], 'conflict in generated plan ' + tag)
    for (const d of p.days) {
      if (d.kind === 'train') assert.ok(d.items.length >= 3, 'thin day ' + d.name + ' ' + tag)
      for (const it of d.items) { assert.ok(!L.avoid.has(it.id), it.id + ' banned ' + tag); assert.ok(byId[it.id].lv <= Math.min(level, L.maxLevel), it.id + ' too hard ' + tag) }
      if (L.balance && d.kind === 'train') assert.ok(d.items.some((i) => i.id === 'single-leg-balance'), 'senior day needs balance ' + tag)
    }
  }
  console.log(`ok — safety matrix: ${PROFILES.length} profiles, ${planCount} plans`)

  // fixPlan: แผนเสี่ยงที่รับมาจากเพื่อน/สร้างไว้ก่อนแก้โปรไฟล์ → แทนท่าได้ ไม่ทำให้วันว่าง
  const risky = { name: 'x', days: [{ kind: 'train', name: 'A', focus: 'x', items: [{ id: 'jump-squat', sets: 3, reps: '10' }, { id: 'barbell-deadlift', sets: 3, reps: '6–8' }, { id: 'goblet-squat', sets: 3, reps: '10' }, { id: 'treadmill-intervals', sets: 1, reps: '20 นาที' }, { id: 'power-clean', sets: 3, reps: '3–5' }] }, { kind: 'rest', name: 'พัก', focus: '', items: [] }] }
  const senior = { age: 72, sex: 'f', weight: 60, height: 158, level: 2, equip: 'gym' }
  assert.ok(planConflicts(risky, senior).length >= 4)
  const fixed = fixPlan(risky, senior)
  assert.deepEqual(planConflicts(fixed, senior), []); assert.equal(fixed.days.length, 2); assert.ok(fixed.days[0].items.some((i) => i.id === 'goblet-squat'), 'ท่าที่ปลอดภัยคงอยู่'); assert.ok(fixed.days[0].items.length >= 3)
  assert.equal(new Set(fixed.days[0].items.map((i) => i.id)).size, fixed.days[0].items.length, 'ไม่มีท่าซ้ำหลังแทน')
  assert.deepEqual(fixPlan(PPL, adult).days, PPL.days, 'แผนปกติของผู้ใหญ่ไม่ถูกแตะ')
}
{ // โภชนาการ: วัยรุ่น (IOM) · ตั้งครรภ์/ให้นมบุตร · ทุกกลุ่มต้องได้ค่าที่สมเหตุสมผล
  const boy = { sex: 'm', age: 16, weight: 60, height: 170, days: 4, goal: 'fit', level: 1 }
  assert.ok(teenEER({ ...boy, weight: 140, height: 170 }) < 3300, 'น้ำหนักเกินมากไม่ทำให้เป้าพุ่ง')
  assert.equal(Math.round(teenEER(boy)), 2668, 'IOM boys 9–18 low-active: 88.5−61.9×16 + 1.13×(26.7×60+903×1.7) + 25')
  assert.equal(Math.round(teenEER({ ...boy, sex: 'f' })), Math.round(135.3 - 30.8 * 16 + 1.16 * (10 * 60 + 934 * 1.7) + 25))
  assert.ok(teenEER({ ...boy, days: 5 }) > teenEER(boy))
  for (const goal of ['lose', 'muscle', 'fit']) for (const sex of ['m', 'f']) for (const age of [12, 15, 17]) {
    const t = targets({ ...boy, sex, age, goal, weight: age === 12 ? 42 : 58, height: age === 12 ? 150 : 165 })
    assert.ok(t.kcal >= 1700 && t.kcal <= 3500, `teen kcal ${sex}${age}${goal}: ${t.kcal}`)
    assert.ok(t.mode !== 'cut' && t.delta >= 0, 'วัยรุ่นไม่ขาดดุล')
    assert.ok(t.protein[0] >= 1.2 * 40 - 5)
  }
  const wf = { sex: 'f', age: 30, weight: 60, height: 163, days: 3, goal: 'lose', level: 1 }
  const base = targets(wf), t2 = targets({ ...wf, preg: '2' }), t3 = targets({ ...wf, preg: '3' }), pp = targets({ ...wf, preg: 'pp' })
  assert.ok(base.kcal < base.tdee, 'ปกติ: เป้าลดน้ำหนักต่ำกว่า TDEE')
  assert.ok(Math.abs(t2.kcal - (base.tdee + 340)) <= 50 && Math.abs(t3.kcal - (base.tdee + 452)) <= 50, 'ตั้งครรภ์: ไม่ขาดดุล + ส่วนเพิ่มไตรมาส')
  assert.ok(Math.abs(targets({ ...wf, preg: '1' }).kcal - base.tdee) <= 50 && Math.abs(pp.kcal - (base.tdee + 330)) <= 50)
  assert.equal(t2.mode, 'maintain'); assert.equal(t2.delta, 0); assert.ok(t2.notes.some((n) => /ไม่ตั้งขาดดุล/.test(n.text)))
  assert.equal(targets({ ...wf, preg: '2', kcalAdj: -300 }).kcal, t2.kcal, 'ตั้งครรภ์: ไม่ใช้การปรับเป้าอัตโนมัติ')
  assert.ok(t2.water > base.water && pp.water > t2.water)
  assert.ok(targets({ ...wf, screen: ['chronic'] }).notes.some((n) => /โรคเรื้อรัง/.test(n.text)))
  assert.ok(targets(wf).notes.some((n) => /โรคไต/.test(n.text)))
  // กวาดทุกกลุ่ม: ค่าต้องจำกัดความ finite สมเหตุสมผล ไม่ต่ำกว่าขั้นต่ำปลอดภัย
  let n = 0
  for (const sex of ['m', 'f']) for (const age of [12, 14, 17, 18, 25, 40, 59, 60, 75, 90]) for (const [weight, height] of [[30, 120], [40, 150], [55, 160], [70, 175], [95, 180], [140, 170], [250, 200]]) for (const goal of ['lose', 'muscle', 'fit']) for (const days of [3, 6]) for (const preg of sex === 'f' && age >= 18 && age <= 45 ? ['none', '2', 'pp'] : ['none']) {
    if (age < 18 && (height > 185 || weight > 150)) continue // ผสมที่เป็นไปไม่ได้ทางกายภาพ (เช่น อายุ 12 สูง 2 เมตร)
    const t = targets({ sex, age, weight, height, days, goal, level: 2, preg }); n++
    const tag = JSON.stringify({ sex, age, weight, height, goal, days, preg })
    for (const v of [t.kcal, t.carb, t.fat, t.fiber, t.sugar, t.sodium, t.water, t.protein[0], t.protein[1]]) assert.ok(Number.isFinite(v) && v > 0, 'non-finite ' + tag)
    if (age >= 18) assert.ok(t.kcal >= (sex === 'f' ? 1200 : 1500), 'below floor ' + tag + ' ' + t.kcal)
    assert.ok(t.kcal <= (age < 18 ? 4300 : 6500), 'absurd kcal ' + tag + ' ' + t.kcal)
    assert.ok(t.protein[0] <= t.protein[1] && t.protein[1] <= 3.0 * weight + 5, 'protein ' + tag)
    assert.ok(t.carb >= 100 && t.fat >= 20, 'macros ' + tag)
    assert.ok(t.water >= 1.5 && t.water <= 4.5, 'water ' + tag)
    if (age < 18 || preg !== 'none') assert.ok(t.delta >= 0, 'ห้ามขาดดุล ' + tag)
  }
  console.log('ok — nutrition sweep:', n, 'profiles')
}

// ───── ความทนทานของข้อมูล: sanitize + fuzz ─────
{
  const today = '2026-11-04'
  const profile = { name: 'เจมส์', sex: 'm', age: 32, weight: 73.6, height: 175, goal: 'muscle', level: 2, days: 5, equip: 'gym', rest: 90, target: 70, screen: [], preg: 'none', loadAdj: 0.85, kcalAdj: 150, kcalAdjAt: '2026-10-20' }
  const plan = { ...generatePlan({ ...profile }), startedAt: '2026-09-01' }
  const good = { profile, plan, logs: { '2026-11-03': { sets: { 'db-curl': [{ done: true, kg: 10, reps: '10' }] }, finished: true, food: { kcal: 2000, protein: 120, carb: 200, fat: 60, water: 8, items: [{ id: 'x', n: 'ข้าวสวย', q: 1, s: 0, k: 80, p: 2, c: 18, f: 0.3 }] }, mood: { m: 'joy', note: 'ดี', at: 5 }, warm: true, startedAt: 1, finishedAt: 2 } }, weights: [{ date: '2026-11-01', kg: 73.6 }], measures: [{ date: '2026-11-01', waist: 80 }], favs: ['pushup'], myFoods: [{ id: 'my1', n: 'ของฉัน', u: '100 g', k: 100, p: 5, c: 10, f: 2 }], deloadUntil: null, createdAt: '2026-09-01', mod: { profile: 5, 'logs/2026-11-03': 9 } }
  const c = sanitizeState(JSON.parse(JSON.stringify(good)), today)
  assert.deepEqual(c.profile, profile, 'โปรไฟล์ที่ดีไม่ถูกเปลี่ยน')
  assert.deepEqual(c.plan.days, plan.days, 'แผนที่ดีไม่ถูกเปลี่ยน'); assert.equal(c.plan.startedAt, '2026-09-01')
  assert.deepEqual(c.logs['2026-11-03'].sets, good.logs['2026-11-03'].sets); assert.deepEqual(c.logs['2026-11-03'].food, good.logs['2026-11-03'].food); assert.deepEqual(c.logs['2026-11-03'].mood, good.logs['2026-11-03'].mood)
  assert.deepEqual([c.weights, c.measures, c.favs, c.myFoods, c.mod], [good.weights, good.measures, good.favs, good.myFoods, good.mod])
  assert.deepEqual(sanitizeState(c, today), c, 'idempotent')
  // ค่าร่างกายเสีย → profile null (ให้กรอกใหม่) · ค่าอื่นผิดชนิดถูกซ่อม
  for (const bad of [{ age: 'abc' }, { weight: 0 }, { height: 999 }, { age: null }, { weight: NaN }, { age: 5 }]) assert.equal(sanitizeProfile({ ...profile, ...bad }), null, JSON.stringify(bad))
  const fixed = sanitizeProfile({ ...profile, goal: 'zzz', level: 9, days: 'x', equip: 1, rest: 7, screen: ['heart', 'bogus', 'heart'], preg: '9', target: -5, kcalAdj: 9e9, name: '' })
  assert.deepEqual([fixed.goal, fixed.level, fixed.days, fixed.equip, fixed.rest, fixed.screen, fixed.preg, fixed.target, fixed.kcalAdj, fixed.name], ['fit', 1, 4, 'gym', 90, ['heart'], 'none', undefined, undefined, 'เพื่อน'])
  assert.equal(sanitizeProfile({ ...profile, sex: 'm', preg: '2' }).preg, 'none', 'ชายไม่มีสถานะตั้งครรภ์')
  assert.equal(sanitizePlan({ days: [] }), null); assert.equal(sanitizePlan({ days: Array(7).fill({ kind: 'weird', items: [] }) }), null)
  const odd = sanitizePlan({ name: 5, days: Array(7).fill({ kind: 'train', name: 'A', items: [{ id: 'pushup', sets: 99, reps: 12 }, { id: 5 }, null, 'x'] }) })
  assert.equal(odd.days[0].items.length, 1); assert.equal(odd.days[0].items[0].sets, 3); assert.equal(odd.days[0].items[0].reps, '12')

  // fuzz: ข้อมูลสุ่มเละๆ ต้องไม่ throw ไม่ทำให้ targets/generatePlan พัง และผลลัพธ์ต้องมีรูปร่างถูก
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const junk = () => [null, undefined, NaN, Infinity, -1, 0, '', 'abc', '2026-02-30', '2026-11-03', [], {}, [1, 2], { a: 1 }, true, 1e308, 'x'.repeat(5000), () => 1, Symbol.iterator.toString()][Math.floor(rnd() * 19)]
  const mutate = (o, depth = 0) => {
    if (Array.isArray(o)) return o.map((x) => (rnd() < 0.2 ? junk() : mutate(x, depth + 1)))
    if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rnd() < 0.2 ? junk() : mutate(v, depth + 1)]))
    return o
  }
  let kept = 0, nulled = 0
  for (let i = 0; i < 4000; i++) {
    const m = rnd() < 0.15 ? junk() : mutate(JSON.parse(JSON.stringify(good)))
    let out
    assert.doesNotThrow(() => { out = sanitizeState(m, today) }, 'sanitize threw on ' + i)
    assert.ok(out.logs && typeof out.logs === 'object' && Array.isArray(out.weights) && Array.isArray(out.measures) && Array.isArray(out.favs) && Array.isArray(out.foodFavs) && Array.isArray(out.myFoods))
    for (const w of out.weights) assert.ok(Number.isFinite(w.kg) && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(w.date))
    for (const [d, l] of Object.entries(out.logs)) { assert.ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d) && l.sets && typeof l.sets === 'object' && !Array.isArray(l.sets)); for (const a of Object.values(l.sets)) assert.ok(Array.isArray(a)); if (l.mood) assert.ok(MOOD_BY[l.mood.m] && l.mood.note.length <= NOTE_MAX) }
    if (out.profile) { kept++; const t = targets(out.profile); assert.ok(Number.isFinite(t.kcal) && t.kcal > 0, 'targets NaN from sanitized profile ' + JSON.stringify(out.profile)); assert.ok(generatePlan({ ...out.profile }).days.length === 7) } else nulled++
    if (out.plan) { assert.equal(out.plan.days.length, 7); for (const d of out.plan.days) for (const it of d.items) assert.ok(typeof it.id === 'string' && it.sets >= 1 && it.sets <= 12 && typeof it.reps === 'string') }
  }
  console.log('ok — sanitize fuzz: 4000 mutated states (profile kept ' + kept + ', reset ' + nulled + ')')
}
// ───── เป้าหมายน้ำหนักต้องไม่ต่ำกว่า BMI 18.5 · ลดเร็วผิดปกติต้องมีคำแนะนำพบแพทย์ ─────
{
  const { validate, isValid } = await import('../src/lib/validate.js')
  const f = { name: 'x', age: '30', weight: '60', height: '170', target: '45' }
  assert.ok(validate(f, { all: true }).target, 'BMI<18.5 target rejected'); assert.equal(validate({ ...f, target: '55' }, { all: true }).target, undefined)
  assert.ok(isValid({ ...f, target: '' }) && !isValid({ ...f, age: '11' }) && !isValid({ ...f, weight: '29' }) && !isValid({ ...f, height: '300' }) && !isValid({ ...f, name: ' ' }), 'range validation')
  const today = '2026-11-30'
  const prof = { sex: 'm', age: 30, height: 175, weight: 80, days: 4, goal: 'fit', level: 2 }
  const w = Array.from({ length: 10 }, (_, i) => ({ date: addDays(today, -28 + i * 3), kg: Math.round((80 - 1.5 * ((i * 3) / 7)) * 10) / 10 }))
  const adv = calorieAdvice({ profile: prof, plan: generatePlan({ ...prof, equip: 'gym' }), logs: {}, weights: w, measures: [], createdAt: '2026-01-01' }, today)
  assert.equal(adv.kind, 'adjust'); assert.match(adv.msg, /ปรึกษาแพทย์/, 'rapid unintended loss mentions doctor')
  console.log('ok — unsafe target + rapid loss guards')
}

// ───── อาหารญี่ปุ่น ─────
{
  const { FOODS, matchName, foodById } = await import('../src/data/foods.js')
  const by = (n) => FOODS.find((x) => x.n === n)
  const jp = FOODS.filter((x) => matchName(x.n, 'ข้าวญี่ปุ่น'))
  assert.ok(jp.length >= 40, 'ค้นหา "ข้าวญี่ปุ่น" ต้องเจอทั้งข้าวสุก ข้าวปั้น ข้าวหน้า แกงกะหรี่ ซูชิ: ' + jp.length)
  for (const n of ['ข้าวญี่ปุ่น', 'ข้าวซูชิ (ปรุงรส)', 'โอนิกิริไส้แซลมอน', 'ข้าวหน้าเนื้อ (กิวด้ง)', 'ข้าวหน้าไก่ไข่ (โอยาโกะด้ง)', 'ข้าวหน้าหมูทอดไข่ (คัตสึด้ง)', 'ข้าวหน้าปลาไหลย่าง (อุนะด้ง)', 'ข้าวแกงกะหรี่ญี่ปุ่น', 'ซูชิแซลมอน (นิกิริ)', 'แคลิฟอร์เนียโรล', 'มิโสะซุป']) assert.ok(by(n) && matchName(by(n).n, 'ญี่ปุ่น') || by(n), 'missing ' + n)
  assert.ok(matchName('ซูชิแซลมอน (นิกิริ)', 'ข้าวญี่ปุ่น') && matchName('ข้าวหน้าเนื้อ (กิวด้ง)', 'japanese') && !matchName('ผัดไทยกุ้ง', 'ข้าวญี่ปุ่น') && !matchName('ข้าวหน้าเป็ด', 'ข้าวญี่ปุ่น') && !matchName('อุด้ง', 'ข้าวญี่ปุ่น') && matchName('อุด้ง', 'ญี่ปุ่น'), 'alias search')
  const rice = by('ข้าวญี่ปุ่น'); assert.ok(rice.k / rice.gw * 100 >= 150 && rice.k / rice.gw * 100 <= 160, 'ข้าวญี่ปุ่น ~155 kcal/100g (หุงหม้อไฟฟ้า)')
  for (const n of ['ซูชิแซลมอน (นิกิริ)', 'ซูชิทูน่า (นิกิริ)', 'ซูชิกุ้ง (เอบิ)', 'ซูชิไข่หวาน (ทามาโกะ)']) assert.ok(by(n).k >= 40 && by(n).k <= 80, n + ' 40–80 kcal/คำ: ' + by(n).k)
  for (const n of FOODS.filter((x) => /^ข้าวหน้า|ด้ง[)]|แกงกะหรี่ญี่ปุ่น|คัตสึแกง/.test(x.n) && x.cat === 'world').map((x) => x.n)) assert.ok(by(n).k >= 450 && by(n).k <= 1150, n + ' kcal ' + by(n).k)
  assert.ok(by("ข้าวหน้าหมูทอดไข่ (คัตสึด้ง)").k < 1000 && by("ข้าวหน้าหมูทอดไข่ (คัตสึด้ง)").k > 800, 'คัตสึด้ง ~900 kcal (ตามที่พบทั่วไป 900–1000)')
  assert.ok(by('มิโสะซุป').na >= 700 && by('มิโสะซุป').na <= 1100, 'มิโสะซุปโซเดียมสูงตามจริง')
  assert.equal(by('ข้าวหน้าเนื้อ (กิวด้ง)').u, '1 ชาม', 'หน่วยเดิมของเมนูเก่าไม่เปลี่ยน'); assert.equal(by('ข้าวแกงกะหรี่ญี่ปุ่น').u, '1 จาน')
  console.log('ok — japanese foods:', jp.length, 'matches')
}

// ───── ขนมปังแผ่น (ค่าจากฉลาก ต่อแผ่น) ─────
{
  const { BREADS } = await import('../src/data/breads.js')
  const { FOODS, matchName } = await import('../src/data/foods.js')
  const by = (n) => FOODS.find((x) => x.n === n)
  assert.ok(BREADS.length >= 16 && new Set(BREADS.map((b) => b.n)).size === BREADS.length, 'ชื่อไม่ซ้ำ')
  for (const b of BREADS) {
    const f = by(b.n); assert.ok(f && f.cat === 'rice' && f.gw === b.gw && f.u === '1 แผ่น (' + b.gw + ' g)', 'อยู่ใน FOODS ' + b.n)
    assert.ok(b.gw >= 20 && b.gw <= 60, 'น้ำหนักแผ่นสมเหตุผล ' + b.n)
    const { k, p, c, f: fat, na } = b.per100
    assert.ok(k >= 235 && k <= 320 && na >= 300 && na <= 500, 'ค่าต่อ 100 g อยู่ในช่วงขนมปังแผ่น ' + b.n)
    assert.ok(Math.abs(4 * p + 4 * c + 9 * fat - k) / k < 0.12, 'macro สอดคล้องกับพลังงาน ' + b.n + ' (' + Math.round(4 * p + 4 * c + 9 * fat) + ' vs ' + k + ')')
    assert.ok(Math.abs(b.k - (k * b.gw) / 100) <= 0.6, 'ต่อแผ่น = ต่อ 100 g × น้ำหนัก ' + b.n)
    assert.ok(Math.abs(4 * b.p + 4 * b.c + 9 * b.f - b.k) <= Math.max(8, b.k * 0.15), 'macro ต่อแผ่น ' + b.n)
  }
  // ตรงกับฉลากหน่วยบริโภค 2 แผ่นของฟาร์มเฮ้าส์: แผ่นมีขอบ 130/2 แผ่น · ตัดขอบ 140/2 แผ่น · โฮลวีต 130/2 แผ่น
  assert.equal(by('ขนมปังแผ่น ฟาร์มเฮ้าส์ (มีขอบ)').k * 2, 130); assert.equal(by('ขนมปังตัดขอบ ฟาร์มเฮ้าส์').k * 2, 140); assert.equal(by('ขนมปังโฮลวีต ฟาร์มเฮ้าส์ (มีขอบ)').k * 2, 130)
  assert.ok(by('ขนมปังรอยัลโฮลวีต สไลด์หนา ฟาร์มเฮ้าส์ (มีขอบ)').k >= 155 && by('ขนมปังรอยัลโฮลวีต สไลด์หนา ฟาร์มเฮ้าส์ (มีขอบ)').k <= 165, 'สไลด์หนา ~160 kcal/แผ่น (ฉลาก)')
  // ตัดขอบ: ต่อ 100 g ต่ำกว่าแผ่นมีขอบ (255 < 271) แต่แผ่นหนักกว่า
  const cl = BREADS.find((b) => b.n === 'ขนมปังตัดขอบ ฟาร์มเฮ้าส์'), rg = BREADS.find((b) => b.n === 'ขนมปังแผ่น ฟาร์มเฮ้าส์ (มีขอบ)')
  assert.ok(cl.per100.k < rg.per100.k && cl.gw > rg.gw)
  // ค้นหา
  const q = (s) => FOODS.filter((x) => matchName(x.n, s)).map((x) => x.n)
  assert.deepEqual(q('ตัดขอบ'), ['ขนมปังตัดขอบ ฟาร์มเฮ้าส์'], '"ตัดขอบ" ต้องไม่ติดแบบมีขอบ')
  assert.ok(!q('ไม่ตัดขอบ').includes('ขนมปังตัดขอบ ฟาร์มเฮ้าส์') && q('ไม่ตัดขอบ').length >= 4, '"ไม่ตัดขอบ" ได้เฉพาะแบบมีขอบ')
  assert.ok(q('ฟาร์มเฮ้าส์').length >= 9 && q('farmhouse').length === q('ฟาร์มเฮ้าส์').length && q('โฮวสวีท').length >= 7 && q('whole wheat').length >= 7 && q('ขนมปัง').length >= 20 && q('รอยัล').length === 3, 'ค้นหาไทย/อังกฤษ/คำสะกดผิด')
  assert.equal(q('ข้าว ต้ม').every((n) => /ข้าว|ต้ม/.test(n)), true, 'ค้นหาอื่นไม่เพี้ยน')
  assert.equal(by('ขนมปังขาว').u, '1 แผ่น', 'รายการขนมปังเดิมไม่เปลี่ยน')
  console.log('ok — breads:', BREADS.length, 'products')
}

// ───── นมโปรตีน/นมพืช (ml) + องุ่นไชน์มัสคัต ─────
{
  const { MILKS, MULK } = await import('../src/data/milks.js')
  const { FRUITS } = await import('../src/data/fruits.js')
  const { FOODS, matchName } = await import('../src/data/foods.js')
  const { isLiquid, gramInfo, gramsPerUnit } = await import('../src/data/grams.js')
  const by = (n) => FOODS.find((x) => x.n === n)
  assert.ok(MILKS.length >= 40 && new Set(MILKS.map((m) => m.n)).size === MILKS.length && new Set(MILKS.map((m) => m.code)).size === MILKS.length, 'นม ชื่อ/บาร์โค้ดไม่ซ้ำ')
  for (const m of MILKS) {
    const f = by(m.n); assert.ok(f && f.cat === 'dairy' && f.gw === m.gw, 'อยู่ใน FOODS ' + m.n)
    assert.ok(m.gw >= 80 && m.gw <= 500, 'ปริมาตรสมเหตุผล ' + m.n)
    if (m.liquid) { assert.ok(/ มล.$/.test(m.u) && isLiquid(f), 'ของเหลวใช้หน่วย มล. ' + m.n); assert.equal(gramInfo(gramsPerUnit(f), 'มล.').word, 'มล.') }
    assert.ok(Math.abs(4 * m.p + 4 * m.c + 9 * m.f - m.k) <= Math.max(10, m.k * 0.2), 'macro ต่อหน่วย ' + m.n + ' ' + m.k + ' vs ' + Math.round(4 * m.p + 4 * m.c + 9 * m.f))
    assert.ok(Math.abs(m.k - (m.per100.k * m.gw) / 100) <= (m.code === MULK.code ? 0.6 : 0.6), 'ต่อหน่วย = ต่อ 100 × ปริมาตร ' + m.n)
  }
  // Mulk+ ตรงฉลากบนกล่อง (ต่อ 400 มล.)
  const mk = by('Mulk+ นมโปรตีนสูง รสจืด (ปราศจากแลคโตส)')
  assert.deepEqual([mk.k, mk.p, mk.c, mk.f, mk.na, mk.gw], [300, 39, 23, 4.5, 190, 400], 'ตรงฉลาก')
  const hp = FOODS.filter((x) => matchName(x.n, 'นมโปรตีน') && x.gw && /มล|ถ้วย/.test(x.u))
  assert.ok(hp.length >= 12 && hp.every((x) => x.p / x.gw * 100 >= 4.5), 'นมโปรตีนสูงทุกตัวโปรตีน ≥4.5 g/100 มล.: ' + hp.length)
  assert.ok(matchName(mk.n, 'mulk') && matchName(mk.n, 'high protein') && matchName(mk.n, 'ไร้แลคโตส') && matchName(by('นมถั่วเหลือง โทฟุซัง ออริจินัล').n, 'soy milk') && matchName(by('นมโอ๊ต โอ๊ตลี').n, 'oat'))
  assert.equal(by('นมจืด (ครบมันเนย)').u, '1 กล่อง 200 มล.', 'นมเดิมไม่เปลี่ยน')
  assert.ok(isLiquid(by('นมจืด (ครบมันเนย)')) && isLiquid(by('โค้กซีโร่') || by('น้ำเปล่า') || { u: '1 แก้ว', cat: 'drink' }) && !isLiquid(by('ข้าวสวย')) && !isLiquid(by('ขนมปังตัดขอบ ฟาร์มเฮ้าส์')), 'ของเหลว vs ของแข็ง')
  // องุ่นไชน์มัสคัต: ต่อลูก ต่อถาด และต่อกรัมต้องสอดคล้องกัน (69 kcal/100 g)
  assert.equal(FRUITS.length, 3)
  for (const x of FRUITS) { const f = by(x.n); assert.ok(f && f.cat === 'plant' && f.gw === x.gw); assert.ok(Math.abs(f.k / f.gw * 100 - 69) < 0.7, 'kcal/100g ' + x.n + ' ' + (f.k / f.gw * 100)) }
  assert.ok(by('องุ่นไชน์มัสคัต ผลกลาง').k * 12 > 98 && by('องุ่นไชน์มัสคัต ผลกลาง').k * 12 < 101, '12 ลูกกลาง ≈ 1 ถาด 150 g ≈ 103 kcal')
  assert.equal(by('องุ่นไชน์มัสคัต (ถาด 150 g)').k, 103.5)
  assert.ok(matchName(by('องุ่นไชน์มัสคัต ผลกลาง').n, 'shine muscat') && matchName(by('องุ่นไชน์มัสคัต ผลกลาง').n, 'ไชน์มัสแคท') && by('องุ่น').u === '15 ลูก', 'ค้นหา + องุ่นเดิมไม่เปลี่ยน')
  console.log('ok — milks:', MILKS.length, '· grapes: 3')
}

{ // คลังอาหาร + เมนูแนะนำ
  const { PANTRY, PANTRY_KINDS } = await import('../src/data/pantry.js')
  const { suggestFoods, usesIngredient } = await import('../src/lib/suggest.js')
  assert.equal(new Set(PANTRY.map((x) => x.id)).size, PANTRY.length, 'pantry id dup')
  assert.ok(PANTRY.length > FOODS.length + 100, 'pantry has ingredients + condiments')
  assert.ok(PANTRY.every((x) => PANTRY_KINDS.some(([k]) => k === x.kind) && x.n && Number.isFinite(x.k) && Number.isFinite(x.na)), 'pantry rows')
  for (const k of ['dish', 'veg', 'fruit', 'ing', 'cond']) assert.ok(PANTRY.some((x) => x.kind === k), 'pantry kind ' + k)
  assert.ok(PANTRY.some((x) => x.n === 'น้ำปลา') && PANTRY.some((x) => x.n === 'แครอท') && PANTRY.some((x) => x.n === 'กล้วยหอม'), 'pantry has condiment/veg/fruit')
  assert.equal(PANTRY.filter((x) => x.n === 'น้ำปลา').length, 1, 'no duplicate names between addon and ingredient')
  const ids = (a) => a.map((x) => x.id)
  const base = suggestFoods(60, 1500, { seed: 'a' })
  assert.equal(base.length, 3)
  assert.deepEqual(ids(base), ids(suggestFoods(60, 1500, { seed: 'a' })), 'ตัวสุ่มคงที่ตาม seed')
  const seen = new Set(); for (let i = 0; i < 30; i++) ids(suggestFoods(60, 1500, { seed: 'd' + i })).forEach((id) => seen.add(id))
  assert.ok(seen.size >= 15, 'หมุนเวียนหลากหลาย ' + seen.size)
  for (let i = 0; i < 30; i++) { const s = suggestFoods(57.9000000006, 1495, { seed: 'z' + i }); assert.ok(s.every((x) => x.p >= 8 && x.k <= 1495 && !/น้ำสลัด|ซอส|น้ำจิ้ม/.test(x.n) && x.cat !== 'drink' && x.cat !== 'snack'), 'suggest filter') }
  assert.deepEqual(suggestFoods(5, 1000), [], 'ขาดน้อยไม่แนะนำ')
  { // อิงค่าที่เหลือกินได้: โซเดียม/คาร์บ/ไขมันไม่เกินที่เหลือ
    const { sodiumOf } = await import('../src/data/sodium.js')
    const rem = { c: 40, f: 15, na: 600 }
    for (let i = 0; i < 40; i++) for (const x of suggestFoods(60, 1500, { seed: 's' + i, rem })) assert.ok(sodiumOf(x) <= 600 && x.c <= 45 && x.f <= 18, `rem ${x.n} Na${sodiumOf(x)} C${x.c} F${x.f}`)
    assert.ok(!suggestFoods(60, 1500, { seed: 's', rem: { c: 100, f: 30, na: 1268 } }).some((x) => sodiumOf(x) > 1268), 'ไม่เกินโซเดียมที่เหลือ')
    assert.deepEqual(suggestFoods(60, 1500, { seed: 's', rem: { c: 100, f: 30, na: 0 } }).filter((x) => sodiumOf(x) > 0), [], 'โซเดียมหมดแล้ว ไม่แนะนำเมนูที่มีโซเดียม')
  }
  const tuna = FOODS.find((x) => x.n === 'ปลาทูน่ากระป๋อง (ในน้ำ)')
  const hearted = suggestFoods(60, 1500, { seed: 'a', favs: [tuna.id] })
  assert.ok(ids(hearted).includes(tuna.id) && hearted.find((x) => x.id === tuna.id).why, 'เมนูที่กดหัวใจได้รับเลือก')
  const recent = Object.fromEntries(ids(base).map((id) => [id, 0]))
  assert.ok(!ids(suggestFoods(60, 1500, { seed: 'a', recent })).some((id) => id in recent), 'เมนูที่กินวันนี้ไม่ซ้ำ')
  // กดหัวใจเครื่องปรุง/วัตถุดิบ → แนะนำเมนูที่ใช้ของนั้น ไม่แนะนำตัวเครื่องปรุงเอง
  const fish = suggestFoods(60, 1500, { seed: 'q', favs: ['ad:sauce-น้ำปลา'] }), kale = suggestFoods(60, 1500, { seed: 'q', favs: ['ing-คะน้า'] })
  assert.ok(fish.every((x) => !/^(ad:|ing-)/.test(x.id)) && kale.every((x) => !x.id.startsWith('ing-')), 'ไม่แนะนำเครื่องปรุงเดี่ยวๆ')
  assert.ok(kale.some((x) => usesIngredient(x, 'คะน้า')), 'มีเมนูที่ใช้คะน้า')
  assert.ok(FOODS.filter((x) => usesIngredient(x, 'น้ำปลา')).length > 20, 'หาเมนูที่ใช้น้ำปลาได้')
  console.log(`ok — pantry ${PANTRY.length} items · suggestions rotate (${seen.size} distinct in 30 shuffles)`)
}
{ // วัตถุดิบเป็นส่วนเสริม: ค้นหาใน "เพิ่มรายละเอียด" ได้ ใส่เป็นกรัม
  const { INGREDIENT_ADDONS } = await import('../src/data/pantry.js')
  const { addonGw } = await import('../src/data/grams.js')
  const { addonSodium } = await import('../src/data/sodium.js')
  const rice = INGREDIENT_ADDONS.find((a) => a.n === 'ข้าวญี่ปุ่น')
  assert.ok(rice && matchName(rice.n, 'ข้าวญี่ปุ่น') && matchName(rice.n, 'ญี่ปุ่น'), 'ข้าวญี่ปุ่นค้นหาเจอ')
  assert.equal(addonGw(rice), 10); assert.ok(Math.abs(rice.k * 10 - 155) < 0.5 && Math.abs(rice.p * 10 - 2.5) < 0.1, 'ค่าต่อ 100 g')
  assert.equal(new Set([...ADDONS, ...INGREDIENT_ADDONS].map((a) => a.id)).size, ADDONS.length + INGREDIENT_ADDONS.length, 'addon id dup')
  assert.equal(new Set([...ADDONS, ...INGREDIENT_ADDONS].map((a) => a.n)).size, ADDONS.length + INGREDIENT_ADDONS.length, 'addon name dup (fromItem ค้นจากชื่อ)')
  assert.ok(INGREDIENT_ADDONS.length > 80 && INGREDIENT_ADDONS.every((a) => a.gOnly && addonGw(a) === 10 && Number.isFinite(addonSodium(a))), 'ingredient addons')
  console.log(`ok — ingredient add-ons: ${INGREDIENT_ADDONS.length}`)
}
