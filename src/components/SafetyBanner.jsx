import { useState } from 'react'
import { ShieldAlert, Check } from 'lucide-react'
import { useStore, fixPlanSafety } from '../store.js'
import { planConflicts, planLimits } from '../lib/safety.js'
import { byId } from '../data/exercises.js'

/** แผนที่มีท่าไม่เหมาะกับอายุ/คัดกรอง/ตั้งครรภ์/BMI (เช่น แก้โปรไฟล์ทีหลัง หรือรับแผนจากเพื่อน) → เสนอแทนท่าให้อัตโนมัติ ผู้ใช้ยืนยันเอง */
export default function SafetyBanner({ toast }) {
  const plan = useStore((s) => s.plan), profile = useStore((s) => s.profile)
  const [ask, setAsk] = useState(false)
  if (!plan || !profile) return null
  const c = planConflicts(plan, profile)
  if (!c.length) return null
  const names = [...new Set(c.map((x) => byId[x.id].th))]
  const lim = planLimits(profile)
  return (
    <section className="card col banner" role="alert" aria-labelledby="sb-h" style={{ borderColor: 'rgba(255, 107, 122, 0.55)' }}>
      <h2 id="sb-h" className="row" style={{ gap: '0.5rem' }}><ShieldAlert aria-hidden="true" style={{ color: 'var(--bad-fg)' }} /> แผนมี {names.length} ท่าที่ไม่เหมาะกับคุณ</h2>
      <p className="sm">{lim.reasons.join(' · ')}</p>
      <p className="sm mute">ท่าที่ว่า: {names.slice(0, 6).join(', ')}{names.length > 6 ? ` และอีก ${names.length - 6} ท่า` : ''}</p>
      {ask ? (
        <div className="row wrap" style={{ gap: '0.5rem' }}>
          <button type="button" className="btn pri sm" onClick={() => { fixPlanSafety(); setAsk(false); toast('แทนท่าที่ไม่เหมาะแล้ว') }}><Check /> ยืนยัน แทนท่าให้</button>
          <button type="button" className="btn ghost sm" onClick={() => setAsk(false)}>ยังไม่แทน</button>
        </div>
      ) : (
        <button type="button" className="btn pri sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAsk(true)}>แทนท่าที่ไม่เหมาะให้อัตโนมัติ</button>
      )}
      <p className="hint">ส่วนอื่นของแผนไม่เปลี่ยน · ถ้ามีโรคประจำตัว/ตั้งครรภ์ ควรปรึกษาแพทย์ก่อนเริ่มหรือเพิ่มความหนัก</p>
    </section>
  )
}
