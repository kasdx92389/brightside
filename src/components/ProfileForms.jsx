import { Flame, Zap, Dumbbell, Sprout, Gauge, Trophy, Building2, Home, PersonStanding } from 'lucide-react'
import { Field, Seg, Choice, BmiGauge } from './ui.jsx'
import { bmi, healthyRange } from '../lib/calc.js'
import { RANGE } from '../lib/validate.js'
import { SCREEN, PREG, planLimits } from '../lib/safety.js'

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

export const emptyForm = { name: '', sex: 'm', age: '', weight: '', height: '', goal: 'lose', level: 1, days: 4, equip: 'gym', target: '', screen: [], preg: 'none' }

export const toForm = (p) => ({ ...p, screen: p.screen || [], preg: p.preg || 'none', age: String(p.age), weight: String(p.weight), height: String(p.height), target: p.target ? String(p.target) : '' })
export const toProfile = (f) => ({ ...f, name: f.name.trim(), age: +f.age, weight: +f.weight, height: +f.height, target: f.target ? +f.target : undefined })

export { RANGE, validate, isValid } from '../lib/validate.js'

/** ต้องกดรับทราบก่อนไปต่อหรือไม่: ติ๊กข้อคัดกรอง หรือตั้งครรภ์/ให้นมบุตร */
export const needsAck = (f) => (f.screen?.length || 0) > 0 || (!!f.preg && f.preg !== 'none')

/** คัดกรองสุขภาพก่อนเริ่ม (แนวเดียวกับ PAR-Q+) + สถานะตั้งครรภ์ — ผลที่ได้ทำให้แอพจำกัดท่า/ระดับให้ปลอดภัยขึ้น */
export function HealthForm({ f, set, ack, setAck }) {
  const screen = f.screen || []
  const toggle = (k) => set({ screen: screen.includes(k) ? screen.filter((x) => x !== k) : [...screen, k] })
  const age = Number(f.age)
  const showPreg = f.sex === 'f' && age >= 12 && age <= 55
  const lim = planLimits({ ...f, age, weight: +f.weight, height: +f.height })
  return (
    <>
      <fieldset className="col hq-set">
        <legend>คัดกรองสุขภาพ <span className="mute sm">แนวเดียวกับ PAR-Q+ · ติ๊กข้อที่ตรงกับคุณ (ถ้าไม่มีข้อไหนตรง ไม่ต้องติ๊ก)</span></legend>
        {SCREEN.map(([k, t]) => (
          <label key={k} className="hq"><input type="checkbox" checked={screen.includes(k)} onChange={() => toggle(k)} /><span>{t}</span></label>
        ))}
      </fieldset>
      {showPreg && (
        <div className="field"><span>สถานะ (ผู้หญิง)</span>
          <select className="input" value={f.preg || 'none'} onChange={(e) => set({ preg: e.target.value })} aria-label="สถานะตั้งครรภ์หรือให้นมบุตร">
            {PREG.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
      )}
      {needsAck(f) && (
        <div className="callout warn" role="status"><div className="col" style={{ gap: '0.25rem' }}>
          <b>ควรปรึกษาแพทย์ก่อนเริ่มหรือเพิ่มความหนัก</b>
          <span>{lim.reasons.join(' · ') || 'แอพจะจัดแผนแบบเบา'} · แอพไม่สามารถแทนคำแนะนำของแพทย์ได้ ถ้ามีเจ็บหน้าอก หายใจไม่ทัน หรือเวียนหัวจะเป็นลมระหว่างฝึก ให้หยุดทันที</span>
          {setAck && <label className="hq" style={{ marginTop: '0.5rem' }}><input type="checkbox" checked={!!ack} onChange={(e) => setAck(e.target.checked)} /><span>ฉันเข้าใจ และจะปรึกษาแพทย์/ผู้เชี่ยวชาญตามความเหมาะสม</span></label>}
        </div></div>
      )}
      {age > 0 && age < 18 && <p className="callout warn" role="status">อายุต่ำกว่า 18 ปี: ฝึกกับผู้ใหญ่หรือครูฝึกที่ดูท่าให้ เน้นท่าที่ถูกต้องก่อนเพิ่มน้ำหนัก ไม่ลดน้ำหนักด้วยการอดอาหาร</p>}
    </>
  )
}

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
