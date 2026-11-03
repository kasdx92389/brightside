import { useState } from 'react'
import { ArrowRight, ArrowLeft, Sparkles, ClipboardList } from 'lucide-react'
import { BodyForm, GoalForm, HealthForm, needsAck, emptyForm, validate, isValid, toProfile } from '../components/ProfileForms.jsx'
import { saveProfile, setPlan } from '../store.js'
import { generatePlan, PPL } from '../data/plan.js'

/** หน้าแรก: ชื่อ น้ำหนัก ส่วนสูง → BMI → เป้าหมาย → ออกแบบโปรแกรม */
export default function Onboarding({ sharedCode }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState(emptyForm)
  const [touched, setTouched] = useState({})
  const [ack, setAck] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }))

  const next = () => (isValid(f) ? setStep(1) : setTouched({ all: true }))
  const toGoal = () => (needsAck(f) && !ack ? setTouched((t) => ({ ...t, ack: true })) : setStep(2))
  const finish = (preset) => {
    const p = toProfile(f)
    saveProfile(p)
    setPlan(preset ? PPL : generatePlan(p)) // generatePlan อ่านอายุ/คัดกรอง/ตั้งครรภ์จากโปรไฟล์เพื่อจำกัดท่า
    location.hash = sharedCode ? `#/import/${sharedCode}` : '#/today' // มีลิงก์แผนจากเพื่อน → ไปดูตัวอย่างต่อ
  }

  return (
    <main className="onb">
      <div className="row between">
        <img className="logo" src="./icon.svg" alt="brightside" />
        <div className="dots-step grow" style={{ marginLeft: '1rem' }} aria-label={`ขั้นที่ ${step + 1} จาก 3`}>
          <i className="on" /><i className={step ? 'on' : ''} /><i className={step > 1 ? 'on' : ''} />
        </div>
      </div>

      {sharedCode && <p className="callout" role="status">เพื่อนส่งแผนซ้อมมาให้ ตั้งค่าโปรไฟล์ก่อน แล้วระบบจะแสดงแผนให้เลือกใช้ทันที</p>}

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
      ) : step === 1 ? (
        <>
          <header className="col" style={{ gap: '0.25rem' }}>
            <span className="eyebrow">เพื่อความปลอดภัย</span>
            <h1>เช็กสุขภาพก่อนเริ่ม</h1>
            <p className="mute">ตอบสั้นๆ แอพจะเลือกท่าและความหนักที่ปลอดภัยกับคุณ ข้อมูลอยู่ในเครื่องคุณเท่านั้น</p>
          </header>
          <HealthForm f={f} set={set} ack={ack} setAck={setAck} />
          {touched.ack && needsAck(f) && !ack && <small className="err" role="alert">กรุณากดรับทราบก่อนไปต่อ</small>}
          <div className="col">
            <button className="btn pri block" onClick={toGoal}>ถัดไป <ArrowRight /></button>
            <button className="btn ghost block" onClick={() => setStep(0)}><ArrowLeft /> ย้อนกลับ</button>
          </div>
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
            <button className="btn ghost block" onClick={() => setStep(1)}><ArrowLeft /> ย้อนกลับ</button>
          </div>
        </>
      )}
    </main>
  )
}
