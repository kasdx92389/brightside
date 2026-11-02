import { Flame, Zap, Dumbbell, Sprout, Gauge, Trophy, Building2, Home, PersonStanding } from 'lucide-react'
import { Field, Seg, Choice, BmiGauge } from './ui.jsx'
import { bmi, healthyRange } from '../lib/calc.js'

export const GOALS = [
  ['lose', 'ลดไขมัน ลดพุง', 'เวทเทรนนิ่ง + คาร์ดิโอ ขาดดุลแคลอรี่เล็กน้อย', Flame],
  ['muscle', 'สร้างกล้ามเนื้อ', 'เน้นเซ็ตหนัก พักพอ เกินดุลแคลอรี่เล็กน้อย', Dumbbell],
  ['fit', 'ฟิตและแข็งแรงทั่วไป', 'สมดุลระหว่างแรง ความอึด และสุขภาพ', Zap],
]
export const LEVELS = [
  [1, 'เริ่มต้น', 'ยังไม่เคยเล่น หรือเว้นมานาน', Sprout],
  [2, 'ฝึกมาแล้ว', 'เล่นสม่ำเสมอ 6 เดือนขึ้นไป', Gauge],
  [3, 'มืออาชีพ', 'เล่นหนักมาหลายปี พร้อมท่ายาก', Trophy],
]
export const EQUIPS = [
  ['gym', 'ฟิตเนส', 'มีบาร์เบล เครื่อง และเคเบิลครบ', Building2],
  ['db', 'ดัมเบลที่บ้าน', 'ดัมเบลและม้านั่ง', Home],
  ['home', 'ตัวเปล่า', 'ไม่ใช้อุปกรณ์เลย', PersonStanding],
]

export const emptyForm = { name: '', sex: 'm', age: '', weight: '', height: '', goal: 'lose', level: 1, days: 4, equip: 'gym', target: '' }

export const toForm = (p) => ({ ...p, age: String(p.age), weight: String(p.weight), height: String(p.height), target: p.target ? String(p.target) : '' })
export const toProfile = (f) => ({ ...f, name: f.name.trim(), age: +f.age, weight: +f.weight, height: +f.height, target: f.target ? +f.target : undefined })

const RANGE = { age: [12, 90, 'อายุ 12–90 ปี'], weight: [30, 250, 'น้ำหนัก 30–250 กก.'], height: [120, 230, 'ส่วนสูง 120–230 ซม.'] }
export function validate(f, touched = {}) {
  const e = {}
  if (!f.name.trim()) e.name = 'ใส่ชื่อก่อน'
  for (const k in RANGE) {
    const n = Number(f[k])
    if (!f[k] || !(n >= RANGE[k][0] && n <= RANGE[k][1])) e[k] = RANGE[k][2]
  }
  if (f.target && !(Number(f.target) >= 30 && Number(f.target) <= 250)) e.target = 'เป้าหมาย 30–250 กก.'
  return Object.fromEntries(Object.entries(e).filter(([k]) => touched.all || touched[k]))
}
export const isValid = (f) => Object.keys(validate(f, { all: true })).length === 0

export function BodyForm({ f, set, touch, errors }) {
  const num = (k, label, unit, mode = 'decimal') => (
    <Field label={`${label} (${unit})`} error={errors[k]}>
      <input
        className="input big" type="number" inputMode={mode} min={RANGE[k][0]} max={RANGE[k][1]} step={mode === 'decimal' ? '0.1' : '1'}
        value={f[k]} onChange={(e) => set({ [k]: e.target.value })} onBlur={() => touch(k)} aria-invalid={!!errors[k]}
        placeholder={k === 'weight' ? '65' : k === 'height' ? '170' : '30'}
      />
    </Field>
  )
  const live = f.weight && f.height && !errors.weight && !errors.height ? bmi(+f.weight, +f.height) : null
  return (
    <>
      <Field label="ชื่อเล่น" error={errors.name}>
        <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => touch('name')} autoComplete="given-name" maxLength={24} aria-invalid={!!errors.name} placeholder="เช่น เจมส์" />
      </Field>
      <div className="field"><span>เพศ (ใช้คำนวณพลังงานที่ร่างกายใช้)</span><Seg label="เพศ" value={f.sex} onChange={(sex) => set({ sex })} options={[['m', 'ชาย'], ['f', 'หญิง']]} /></div>
      <div className="three">{num('age', 'อายุ', 'ปี', 'numeric')}{num('weight', 'น้ำหนัก', 'กก.')}{num('height', 'ส่วนสูง', 'ซม.', 'numeric')}</div>
      <div className="card glow" aria-live="polite">
        {live ? (
          <>
            <BmiGauge value={live} />
            <p className="hint" style={{ marginTop: '0.5rem' }}>น้ำหนักที่สมส่วนสำหรับส่วนสูงนี้ ประมาณ {healthyRange(+f.height).join('–')} กก.</p>
          </>
        ) : (
          <p className="mute">ใส่น้ำหนักและส่วนสูง แล้ว BMI จะคำนวณให้ทันที</p>
        )}
      </div>
    </>
  )
}

export function GoalForm({ f, set, errors }) {
  return (
    <>
      <div className="field"><span>เป้าหมายหลัก</span><Choice label="เป้าหมาย" value={f.goal} onChange={(goal) => set({ goal })} options={GOALS} /></div>
      <div className="field"><span>ระดับประสบการณ์</span><Choice label="ระดับ" value={f.level} onChange={(level) => set({ level })} options={LEVELS} /></div>
      <div className="field"><span>วันที่ฝึกได้ต่อสัปดาห์</span><Seg label="วันต่อสัปดาห์" value={f.days} onChange={(days) => set({ days })} options={[[3, '3 วัน'], [4, '4 วัน'], [5, '5 วัน'], [6, '6 วัน']]} /></div>
      {f.target !== undefined && (
        <Field label="น้ำหนักเป้าหมาย (กก.) — ไม่บังคับ" error={errors?.target} hint="ใช้แสดงความคืบหน้าบนกราฟน้ำหนัก">
          <input className="input big" type="number" inputMode="decimal" step="0.1" value={f.target} onChange={(e) => set({ target: e.target.value })} placeholder="เช่น 62" aria-invalid={!!errors?.target} />
        </Field>
      )}
      <div className="field"><span>อุปกรณ์ที่มี</span><Choice label="อุปกรณ์" value={f.equip} onChange={(equip) => set({ equip })} options={EQUIPS} /></div>
    </>
  )
}
