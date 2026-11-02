// รัน: npm run check — เช็คสูตรและตัวออกแบบโปรแกรม
import assert from 'node:assert/strict'
import { bmi, bmiBand, targets, healthyRange } from '../src/lib/calc.js'
import { generatePlan, PPL } from '../src/data/plan.js'
import { byId, EXERCISES } from '../src/data/exercises.js'
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

// ตัวออกแบบ: ทุกชุดตัวเลือกต้องได้ท่าถูกต้อง ไม่ซ้ำในวัน และใช้เฉพาะอุปกรณ์/ระดับที่เลือก
const ALLOW = { gym: ['bw', 'db', 'bb', 'cable', 'machine'], db: ['bw', 'db'], home: ['bw'] }
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
