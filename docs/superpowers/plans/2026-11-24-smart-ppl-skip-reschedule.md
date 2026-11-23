# Smart PPL Skip-Reschedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** กดข้ามวัน "ปวดขา" แล้วตารางวันถัดไปปรับเองตามกติกาพักฟื้น (ขาไม่ลงซ้ำก่อนพ้นช่วงปวด ส่วนบนยังเล่นได้) ย้อนกลับได้

**Architecture:** ฟังก์ชันบริสุทธิ์ `planSore` (ใหม่ `src/lib/resched.js`) คำนวณ `adj` รายวัน แล้ว `applySore` เขียนลง `logs[date].adj` (ซิงก์รายวันอยู่แล้ว) · `dayFor(s, date)` ใน store แทนการอ่าน `plan.days[dayIdx]` ทุกจุด · แม่แบบ 7 วันของผู้ใช้ไม่ถูกแก้

**Tech Stack:** React 18 + Vite, state ใน localStorage, เทสต์เป็นสคริปต์ Node `scripts/check.mjs` (`npm run check`)

**Spec:** `docs/superpowers/specs/2026-11-24-smart-ppl-skip-reschedule-design.md`

**ส่วนเบี่ยงจาก spec (ผลลัพธ์พฤติกรรมเท่าเดิม):** ไม่เก็บ `adj.via` — ทุกครั้งที่เพิ่ม/ลบการข้ามแบบปวดขา ให้ล้าง `adj` ของวันที่ยังแก้ได้แล้วคำนวณใหม่จากรายการข้ามที่เหลือ (undo = ลบ `why` แล้วคำนวณใหม่) จึงไม่ต้องรู้ว่า `adj` มาจากการข้ามวันไหน และ `setPlan` ก็คำนวณซ้ำด้วยกลไกเดียวกัน

## Global Constraints

- ค่าคงที่ตามสเปก: `RECOVER_DAYS=3`, `SORE_DAYS=3`, `LEG_SHARE=0.4`, ขอบเขต 7 วันหลังวันข้าม; ท่า "ใช้ขา" = `byId[id].g` เป็น `'legs'` หรือ `'full'`
- ห้ามแก้แม่แบบ `plan.days` · ห้ามสองเซสชันในวันเดียว · ห้ามย้ายขาให้เร็วขึ้น · ห้ามแตะวันที่ผ่านแล้ว/เริ่มฝึกแล้ว (มีเซ็ตที่ `done` หรือ `finished`)
- ข้อความผู้ใช้เป็นภาษาไทย โทนเดิมของแอป · วันที่ใช้ `dateKey()`/`addDays()` (`YYYY-MM-DD`), วันจันทร์ = 0 ผ่าน `dayIdx`
- ไม่แก้ `merge.js` · ไม่ push/deploy ในแผนนี้

## Review Focus

1. กด "ปวดขา" โดยไม่เคยเล่นขามาก่อน (ไม่มี `L`) → `gate = S+3` ไม่ throw (Task 1)
2. ข้ามวันอาทิตย์ → ขอบเขตข้ามไปสัปดาห์หน้า ต้องไม่ตัดเซสชันที่พ้น gate แล้ว (Task 1)
3. ข้ามปวดขาสองวันติดกัน → gate เลื่อน, คำนวณซ้ำได้ผลเท่าเดิม, ลบการข้ามแรกแล้วผลของครั้งที่สองยังอยู่ (Task 1, 2)
4. วันในขอบเขตที่ finished/เริ่มฝึกแล้ว (เช่นซิงก์มาจากเครื่องอื่น) ห้ามถูกทับ (Task 1)
5. `adj` เสียจากคลาวด์/ไฟล์สำรอง (`as: 9`, `drop` ไม่ใช่ array, ไม่มี `skipped` แต่มี `why`) → sanitize ล้างทิ้ง `dayFor` ถอยกลับใช้วันตามปฏิทิน (Task 2, 3)

---

### Task 1: ตัววางแผน `planSore`

**Files:**
- Create: `src/lib/resched.js`
- Modify: `scripts/check.mjs` (เพิ่มบล็อกท้ายไฟล์ รูปแบบเดียวกับบล็อก `ok — …` เดิม)

**Interfaces:**
- Produces (export จาก `resched.js`):
  - `RECOVER_DAYS = 3`, `SORE_DAYS = 3`, `LEG_SHARE = 0.4` (คอมเมนต์ระบุเหตุผล: ปวดสูงสุดวันที่ 2–3, Clarkson 1992/Cheung 2003)
  - `usesLegs(id: string): boolean`
  - `legShare(day: {items}): number` — สัดส่วนท่าใช้ขา (0 ถ้าไม่มีท่า)
  - `lastLegDate(logs, before: string): string | null` — วันล่าสุด `< before` ที่ `finished` และมีเซ็ต `done` ในท่าใช้ขา
  - `planSore({ plan, logs, sore, today }): { [date: string]: { as?: number, drop?: string[] } }` — `sore` = วันข้ามแบบปวดขา (เรียงเก่า→ใหม่) · คืนเฉพาะวันที่ต่างจากแม่แบบ
  - `describeAdj(plan, date: string, adj): string[]` — บรรทัดไทยสำหรับ UI เช่น `ศ. ตัด ดัมเบลโรมาเนียนเดดลิฟต์`, `ส. Push 2 (ย้ายมาจาก พฤ.)`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** ใน `check.mjs` (ใช้ `await import('../src/lib/resched.js')`, สัปดาห์ทดสอบ จ.=`2026-11-23` … อา.=`2026-11-29`, `today='2026-11-26'`)
  - `PPL` (`src/data/plan.js`), พุธ `2026-11-25` log `{ finished: true, sets: { 'goblet-squat': [{ done: true }] } }`, `sore=['2026-11-26']` → `deepEqual(planSore(...), { '2026-11-27': { drop: ['db-rdl'] }, '2026-11-28': { as: 3 } })`
  - `generatePlan({ goal: 'fit', level: 2, days: 6, equip: 'gym' })`, log พุธเหมือนเดิม, `sore=['2026-11-26']` → `{ '2026-11-28': { as: 3 }, '2026-11-29': { as: 5 } }`
  - Review Focus 1: ไม่มี log ขาเลย `sore=['2026-11-26']` → ไม่ throw และไม่มีเซสชันขาเป็นหลักที่ `date < '2026-11-29'` (gate = อา.)
  - Review Focus 2: `sore=['2026-11-29']` (อา.) ด้วย `PPL` → ไม่มี `adj` ที่ตัดวันพุธถัดไป (`2026-12-02`) เพราะพ้น gate (`2026-12-02`) แล้ว
  - Review Focus 3: `sore=['2026-11-26','2026-11-27']` → ผลไม่ตัดขาก่อน `2026-11-30` · `planSore` เรียกซ้ำด้วยอินพุตเดิมได้ `deepEqual` เท่าเดิม
  - Review Focus 4: ใส่ log `finished` ที่ `2026-11-28` → ผลไม่มี key `2026-11-28`
  - ตัวคงที่ (ลูป): `generatePlan({ goal, level: 2, days, equip: 'gym' })` ทุก `days` 3–6 × `goal` ใน `lose|fit|muscle` และ `PPL` · ทุกวันฝึกที่ `2026-11-23…29` เป็น S (ตั้ง `today = S`, ไม่มี log ขา) · `planSore` ต้องไม่ throw, `as` ทุกค่าเป็นจำนวนเต็ม 0–6, เมื่อประกอบตารางจริง (`as ?? dayIdx` + `drop`) ของ 7 วันหลัง S แล้ว: ไม่มีเซสชันขาเป็นหลักที่ `date < gate`, จำนวนวัน `train` ไม่เกินของแม่แบบ, และเซสชันขาเป็นหลักที่ถูกย้ายไม่ปรากฏซ้ำสองวัน (นับต้นทาง `src` ของแต่ละวัน)
- [ ] **Step 2: รันให้ล้ม** — `node scripts/check.mjs` · คาดว่า error หา `../src/lib/resched.js` ไม่เจอ
- [ ] **Step 3: เขียน `resched.js`** — แนวทาง: ตาราง `sched[date] = { src, drop }` ของ 7 วันหลัง S (เริ่มจากแม่แบบ) แล้วไล่ `sore` ทีละวันตามลำดับ แต่ละวัน S: `gate = max(addDays(L,3), addDays(S,3))` (ไม่มี L = `S+3`; `L = lastLegDate(logs, S)`) · วัน "แก้ได้" = `d > S && d >= today` และไม่ finished/ไม่มีเซ็ต `done` · ลำดับ: (a) ย้ายเซสชันขาเป็นหลัก (`legShare ≥ LEG_SHARE` และ `kind==='train'`) ที่ `< gate` — ของวัน S เอง ไปวันแก้ได้วันแรก `≥ gate` ที่เป็นพัก/เดินเท่านั้น (ไม่มีให้ตัดทิ้ง); ของวันอื่น สลับ `sched` ทั้งก้อนกับวันแก้ได้วันแรก `≥ gate` ที่ไม่ใช่ขาเป็นหลัก ไม่หาได้ก็ตัดทิ้ง (ทำให้เป็นวันพัก) (b) เซสชัน "ผสม" (`0 < legShare < LEG_SHARE`) ที่ `< gate` → เพิ่มรหัสท่าใช้ขาลง `drop` (c) เซสชัน S ที่ไม่ใช่ขาเป็นหลักและเป็น `train` → ย้ายไปวันแก้ได้วันแรกในขอบเขตที่เป็นพัก/เดิน (ถ้าตกก่อน gate ให้ `drop` ท่าใช้ขาด้วย) · ผลลัพธ์คืนเฉพาะวันที่ `src !== dayIdx(date)` (ใส่ `as`) หรือ `drop` ไม่ว่าง · `describeAdj` ใช้ `DAY_SHORT` จาก `lib/calc.js` และ `byId[id].th`
- [ ] **Step 4: รันให้ผ่าน** — `node scripts/check.mjs` · คาดว่าพิมพ์ `ok — smart ppl planner` (ชื่อบรรทัดจบของบล็อกใหม่) และบล็อกเดิมทั้งหมดผ่าน
- [ ] **Step 5: Commit** — `git add src/lib/resched.js scripts/check.mjs && git commit -m "Add skip-after-legs reschedule planner"`

---

### Task 2: เก็บผลลง state — sanitize, `applySore`, `skipDay` พร้อมเหตุผล

**Files:**
- Modify: `src/lib/sanitize.js` (`sanitizeLog`), `src/lib/resched.js`, `src/store.js` (`skipDay`, `setPlan`, `dayFor` ใหม่), `scripts/check.mjs`

**Interfaces:**
- Consumes: `planSore` (Task 1)
- Produces:
  - `applySore(s: State, today: string): State` ใน `resched.js` — ล้าง `adj` ของวันแก้ได้ (`>= today`, ไม่ finished/เริ่ม) แล้วเขียน `planSore({ plan: s.plan, logs: s.logs, sore, today })` ลง `logs[d].adj` โดย `sore` = วันที่ `skipped && why==='sore'` และ `>= addDays(today,-7)` · สร้าง log `{ sets: {}, finished: false, adj }` ถ้าวันนั้นยังไม่มี · log ที่เหลือแค่ค่าว่างถูกลบ
  - `skipDay(date: string, skipped = true, why?: 'sore'): void` — `why` ถูกเก็บเมื่อ `skipped` จริงเท่านั้น (ลบทิ้งเมื่อกลับมาฝึก) แล้วเรียก `applySore` ใน `update` เดียวกัน
  - `dayFor(s: State, date: string): { day: PlanDay | undefined, src: number, adj: object | undefined }` — `src = adj.as` ถ้าเป็นจำนวนเต็ม 0–6 และมีวันนั้นในแผน ไม่งั้น `dayIdx(date)` · `day` = แม่แบบวัน `src` ที่ตัดท่าใน `adj.drop` ออก

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (บล็อกเดียวกับ Task 1 ใน `check.mjs` ใช้ `update`/`getState` จาก store)
  - sanitize: log `{ skipped: true, why: 'sore', adj: { as: 3, drop: ['db-rdl'] } }` ผ่านครบ · `{ why: 'sore' }` (ไม่มี `skipped`) → ไม่มี `why` · `adj: { as: 9, drop: 'x' }` → ไม่มี `adj` · `drop` ยาวเกิน 20 หรือรหัสยาวเกิน 60 → ตัด/ทิ้งตามสเปก (Review Focus 5)
  - store: ตั้ง state ด้วย `PPL`, พุธ finished ขา, `skipDay('2026-11-26', true, 'sore')` → `getState().logs['2026-11-27'].adj` ตรงกับ Task 1 · `skipDay('2026-11-26', false)` → ไม่มี `adj` เหลือและ log ว่างของ `2026-11-27/28` ถูกลบ (state กลับเท่าก่อนข้าม)
  - Review Focus 3: ข้ามสองวัน แล้วยกเลิกวันแรก → `adj` ตรงกับกรณีข้ามเฉพาะวันหลัง
  - `dayFor` ของ `2026-11-28` ได้ `src === 3` ชื่อ `Push 2` · ของ `2026-11-27` ไม่มี `db-rdl` ใน `day.items` · `adj` เสียโดยตรงใน state (`as: 9`) → `src === dayIdx` (Review Focus 5)
- [ ] **Step 2: รันให้ล้ม** — `node scripts/check.mjs` · คาดว่า `applySore`/`dayFor` ไม่ถูก export
- [ ] **Step 3: ทำให้ผ่าน** — `sanitizeLog` เพิ่มการตรวจฟิลด์ `why`/`adj` ตามสเปก (ลบฟิลด์ที่เสีย ไม่ทิ้งทั้ง log) · `setPlan` เรียก `applySore` หลังตั้งแผนใหม่ · `skipDay` เปลี่ยนเป็น `update((s) => applySore(patched, dateKey()))` โดย `patched` คือ state ที่ patch log วันนั้นแล้ว
- [ ] **Step 4: รันให้ผ่าน** — `node scripts/check.mjs` คาดว่าผ่านทั้งหมด
- [ ] **Step 5: Commit** — `git add -A src scripts && git commit -m "Store sore-skip adjustments in logs with sanitize and undo"`

---

### Task 3: ทุกที่อ่านวันฝึกผ่าน `dayFor`

**Files:**
- Modify: `src/store.js` (`itemsFor` ~l.180, `dayStatus` ~l.221), `src/pages/Today.jsx` (l.119–120 และ `editDay(di, …)` ใน `doSwap` l.140 → `src`), `src/pages/Progress.jsx:229`, `src/pages/Memory.jsx:94`, `src/lib/review.js:88,102`, `scripts/check.mjs`

**Interfaces:**
- Consumes: `dayFor` (Task 2)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** — ด้วย state ของ Task 2 (หลัง `skipDay(... 'sore')`): `itemsFor(s, '2026-11-27')` ไม่มี `db-rdl` · `itemsFor(s, '2026-11-28')` เท่ากับท่าของ Push 2 · `dayStatus(s, '2026-11-28')` เป็น `'todo'` (ไม่ใช่ `'rest'`) เมื่อ today ≤ วันนั้น · `adherence`/`groupBalance` (`review.js`) ไม่นับวันที่ถูกข้าม (`skipped`) ซ้ำ และนับ Push 2 ที่ย้ายเป็นวันที่วางแผนไว้ที่ `2026-11-28`
- [ ] **Step 2: รันให้ล้ม** — `node scripts/check.mjs`
- [ ] **Step 3: แทน `s.plan?.days[dayIdx(...)]` ด้วย `dayFor(s, date).day`** ทุกจุดข้างบน (`review.js` ต้อง import `dayFor` จาก store ถ้าไม่เกิดวงจร import ไม่งั้นรับ `dayFor` ผ่านพารามิเตอร์/ย้ายตัวเลือกไว้ใน `resched.js`) · ใน `Today.jsx` ใช้ `src` กับ `editDay` ส่วน `di` ยังใช้แสดงชื่อวันตามปฏิทิน
- [ ] **Step 4: รันให้ผ่าน** — `npm run check` (ทั้งชุด) · คาดว่า `ok` ทุกบรรทัดและ `sw ok`
- [ ] **Step 5: Commit** — `git add -A src scripts && git commit -m "Read the effective training day through dayFor"`

---

### Task 4: UI, ข้อความความปลอดภัย, แหล่งอ้างอิง

**Files:**
- Modify: `src/pages/Today.jsx`, `src/pages/Plan.jsx`, `src/styles.css`, `src/pages/Me.jsx` (รายการแหล่งอ้างอิง l.11–34 รูปแบบ `[หัวข้อ, ข้อความ, [[ป้าย, DOI], …]]`)

**Interfaces:**
- Consumes: `skipDay(date, true, 'sore')`, `dayFor`, `describeAdj`, `planSore` ที่เก็บผลแล้ว

- [ ] **Step 1: Today** — เมื่อ `done === 0` เพิ่มปุ่ม "ปวดขา — ข้ามและปรับตาราง" (ไอคอน `Moon` เดิมหรือ `HeartPulse`) เรียก `skipDay(date, true, 'sore')` + `toast('ข้ามแล้ว ปรับตารางให้แล้ว')` ใต้ปุ่มเมื่อวันนี้ไม่มีท่าใช้ขา (`legShare(day) === 0`): "วันนี้ไม่ได้ใช้ขา ถ้าไหวลองเล่นเบาๆ ได้" · การ์ด "ข้ามวันนี้" (เมื่อ `log.why === 'sore'`) แสดง `describeAdj` ของวันถัดไป 7 วัน (รวมจาก `logs[d].adj` ของวันที่ `> date`) เป็นรายการ + ข้อความ "ปวดมากผิดปกติ ขาบวมตึง หรือปัสสาวะสีชา ให้ไปพบแพทย์" · ปุ่ม "กลับมาฝึกวันนี้" เดิมคือ undo (เรียก `skipDay(date, false)` อยู่แล้ว) · แถบสัปดาห์: วันที่มี `adj` เพิ่ม class `adj` และต่อท้าย `aria-label` ว่า "ปรับแล้ว" ส่วน CSS ใส่จุดเล็กใต้ตัวอักษร
- [ ] **Step 2: `StopSigns`** เพิ่มบรรทัด "ปวดกล้ามเนื้อรุนแรงมากหลังออกกำลังกาย ร่วมกับบวมตึงหรือปัสสาวะสีชา" ใน `Today.jsx`
- [ ] **Step 3: Plan** — แถบอ่านอย่างเดียวใต้ปุ่ม "ออกแบบให้/PPL 5 วัน" เมื่อสัปดาห์นี้มี `adj` แสดง `describeAdj` ทั้งสัปดาห์ (ไม่แตะแม่แบบ 7 วัน)
- [ ] **Step 4: Me** — เพิ่มรายการ `['ปวดกล้ามเนื้อหลังเล่นขา', ข้อความสรุป+ข้อจำกัด, [['Cheung 2003','10.2165/00007256-200333020-00005'], ['Clarkson 1992','10.1249/00005768-199205000-00004'], ['Morán-Navarro 2017','10.1007/s00421-017-3725-7'], ['Huerta-Alardín 2005','10.1186/cc2978'], ['Schoenfeld 2019','10.1080/02640414.2018.1555906']]]` ข้อความอ้างเฉพาะที่อยู่ในบทคัดย่อ ตามที่เขียนไว้ในสเปกหัวข้อ "หลักฐาน" และ "ข้อจำกัด" (รวมว่าตัวเลข 3 วันเป็นค่าที่เลือกเอง ไม่ใช่ค่าจากงานวิจัย)
- [ ] **Step 5: ตรวจ** — `npm run check` ผ่าน · `npm run build` สำเร็จ · เปิด `npm run dev` ทดลองจริงในเบราว์เซอร์: ตั้งตาราง PPL 5 วัน, ทำเซ็ตท่าขาวันพุธเสร็จ, วันพฤหัสกด "ปวดขา" → ศ. ไม่มี RDL, ส. เป็น Push 2, ปุ่ม "กลับมาฝึกวันนี้" คืนทุกอย่าง (รายงานผลตามจริง ถ้าทดสอบในเบราว์เซอร์ไม่ได้ให้บอกว่าไม่ได้ทดสอบ)
- [ ] **Step 6: Commit** — `git add -A src && git commit -m "Add sore-leg skip button, adjustment summary, and evidence notes"`

---

## Self-Review

- **ครอบคลุมสเปก:** ข้อมูลใน `logs` (Task 2), `dayFor` และจุดแทนค่าทุกแห่งที่สเปกระบุ (Task 3), ตัววางแผนและตัวอย่าง 2 กรณี (Task 1), UI/ความปลอดภัย/แหล่งอ้างอิง/แถบใน Plan (Task 4), เทสต์ในสเปกกระจายอยู่ใน Task 1–3 · ตัวคงที่ "ตาราง generate ทุกชุด 3–6 วันไม่ throw" → เพิ่มในลูปเทสต์ Task 1 (วน `days` 3–6 × เป้าหมาย 3 แบบ เรียก `planSore` ด้วยการข้ามทุกวันฝึก)
- **ชื่อสอดคล้อง:** `planSore`, `applySore`, `dayFor`, `usesLegs`, `legShare`, `lastLegDate`, `describeAdj`, `skipDay(date, skipped, why)` ใช้ตรงกันทุก Task
- **สัดส่วน:** แผนยาวประมาณสเปก ไม่มีโค้ดเต็มนอกจากชื่อและค่าที่สเปกกำหนด
