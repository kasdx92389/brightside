import { useState } from 'react'
import { ArrowRight, ArrowLeft, Sparkles, ClipboardList } from 'lucide-react'
import { BodyForm, GoalForm, emptyForm, validate, isValid, toProfile } from '../components/ProfileForms.jsx'
import { saveProfile, setPlan } from '../store.js'
import { generatePlan, PPL } from '../data/plan.js'

/** หน้าแรก: ชื่อ น้ำหนัก ส่วนสูง → BMI → เป้าหมาย → ออกแบบโปรแกรม */
export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [f, setF] = useState(emptyForm)
  const [touched, setTouched] = useState({})
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }))

  const next = () => (isValid(f) ? setStep(1) : setTouched({ all: true }))
  const finish = (preset) => {
    const p = toProfile(f)
    saveProfile(p)
    setPlan(preset ? PPL : generatePlan(p))
    location.hash = '#/today'
  }

  return (
    <main className="onb">
      <div className="row between">
        <img className="logo" src="./icon.svg" alt="brightside" />
        <div className="dots-step grow" style={{ marginLeft: '1rem' }} aria-label={`ขั้นที่ ${step + 1} จาก 2`}>
          <i className="on" /><i className={step ? 'on' : ''} />
        </div>
      </div>

      {step === 0 ? (
        <>
          <header className="col" style={{ gap: '0.25rem' }}>
            <span className="eyebrow">ยินดีต้อนรับ</span>
            <h1>เริ่มจากรู้จักร่างกายของคุณ</h1>
            <p className="mute">กรอกข้อมูลพื้นฐาน ระบบจะคำนวณ BMI และเป้าหมายแคลอรี่ให้ ข้อมูลเก็บในเครื่องของคุณเท่านั้น</p>
          </header>
          <BodyForm f={f} set={set} touch={touch} errors={validate(f, touched)} />
          <button className="btn pri block" onClick={next}>ถัดไป <ArrowRight /></button>
        </>
      ) : (
        <>
          <header className="col" style={{ gap: '0.25rem' }}>
            <span className="eyebrow">สวัสดี {f.name.trim()}</span>
            <h1>อยากฝึกแบบไหน</h1>
            <p className="mute">เลือกแล้วระบบออกแบบโปรแกรมรายสัปดาห์ให้ ปรับแก้ภายหลังได้ทุกท่า</p>
          </header>
          <GoalForm f={f} set={set} />
          <div className="col">
            <button className="btn pri block" onClick={() => finish(false)}><Sparkles /> ออกแบบโปรแกรมให้ฉัน</button>
            <button className="btn ghost block" onClick={() => finish(true)}><ClipboardList /> ใช้ตาราง PPL 5 วันสำเร็จรูป</button>
            <button className="btn ghost block" onClick={() => setStep(0)}><ArrowLeft /> ย้อนกลับ</button>
          </div>
        </>
      )}
    </main>
  )
}
