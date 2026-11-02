import { useState } from 'react'
import { Save, Flame, Beef, Droplets, Download, Upload, Trash2, Timer } from 'lucide-react'
import { BodyForm, GoalForm, toForm, toProfile, validate, isValid } from '../components/ProfileForms.jsx'
import { BmiGauge, Seg } from '../components/ui.jsx'
import { bmi, targets } from '../lib/calc.js'
import { useStore, saveProfile, getState, importData, resetAll } from '../store.js'
import SyncPanel from '../components/SyncPanel.jsx'
import { useSync } from '../lib/sync.js'

const MEALS = [
  ['เช้า', 'ไข่ต้ม 2–3 ฟอง + ข้าวโอ๊ตหรือขนมปังโฮลวีต 1–2 แผ่น', '18–25'],
  ['กลางวัน', 'ข้าวสวย 1.5–2 ทัพพี + อกไก่หรือปลา 120–150 g (สุก) + ผัก', '35–40'],
  ['ก่อนเล่น 1–2 ชม.', 'กล้วย 1 ลูก + นมไม่หวานหรือโยเกิร์ต', '8–15'],
  ['เย็น', 'ข้าวสวย 1–1.5 ทัพพี + ปลา ไก่ หรือเต้าหู้ 120–150 g + ผัก', '30–38'],
  ['ก่อนนอน (ถ้าหิว)', 'โยเกิร์ตกรีกไม่หวาน หรือนมไม่หวาน', '10–20'],
]

export default function Me({ toast }) {
  const profile = useStore((s) => s.profile)
  const linked = useSync().linked
  const [f, setF] = useState(() => toForm(profile))
  const [touched, setTouched] = useState({})
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }))
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(profile))
  const t = targets(isValid(f) ? toProfile(f) : profile)

  const save = () => {
    if (!isValid(f)) return setTouched({ all: true })
    saveProfile(toProfile(f)); toast('บันทึกโปรไฟล์แล้ว')
  }
  const exportData = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' }))
    a.download = `brightside-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(a.href)
  }
  const onImport = async (e) => {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    try { importData(await file.text()); location.reload() } catch { toast('ไฟล์ไม่ถูกต้อง') }
  }

  return (
    <div className="page">
      <header className="page-head"><div><span className="eyebrow">โปรไฟล์</span><h1>{profile.name}</h1></div></header>

      <section className="card glow"><BmiGauge value={bmi(profile.weight, profile.height)} /></section>

      <section className="col">
        <h2>เป้าหมายประจำวัน</h2>
        <div className="three" style={{ gap: '0.5rem' }}>
          <div className="stat"><Flame aria-hidden="true" /><span className="num">{t.kcal.toLocaleString()}</span><small>kcal</small></div>
          <div className="stat"><Beef aria-hidden="true" /><span className="num">{t.protein[0]}–{t.protein[1]}</span><small>โปรตีน g</small></div>
          <div className="stat"><Droplets aria-hidden="true" /><span className="num">{t.water}</span><small>น้ำ ลิตร</small></div>
        </div>
        <p className="hint">คำนวณด้วยสูตร Mifflin–St Jeor × ระดับกิจกรรมจากจำนวนวันฝึก {profile.goal === 'lose' ? 'ลบ 400 kcal เพื่อลดไขมันช้าๆ' : profile.goal === 'muscle' ? 'บวก 300 kcal เพื่อสร้างกล้าม' : 'เท่าที่ใช้จริง'} เป็นค่าประมาณ ปรับตามผลจริงทุก 2–3 สัปดาห์</p>
      </section>

      <section className="card col">
        <h2>ตัวอย่างมื้ออาหาร</h2>
        <table className="tbl"><thead><tr><th>มื้อ / ตัวอย่าง</th><th>โปรตีน (g)</th></tr></thead><tbody>
          {MEALS.map(([m, ex, p]) => <tr key={m}><td><b>{m}</b><br /><span className="mute sm">{ex}</span></td><td className="num">{p}</td></tr>)}
        </tbody></table>
        <ul className="list sm mute" style={{ paddingLeft: '1.1rem', listStyle: 'disc' }}>
          <li>ตัดน้ำหวาน ชานม น้ำอัดลม และของทอด ดื่มน้ำ 2–2.5 ลิตร/วัน</li>
          <li>น้ำหนักลดช้าๆ ราว 0.25–0.5 กก./สัปดาห์ ถ้าลดเร็วกว่านี้ ให้เพิ่มอาหาร 100–200 kcal เพื่อไม่ให้กล้ามเนื้อหาย</li>
          <li>นอน 7–8 ชั่วโมง และเดินวันพัก 8,000–10,000 ก้าว</li>
          <li>ทุก 6–8 สัปดาห์ ลดเหลือ 2 เซ็ตต่อท่า 1 สัปดาห์เพื่อให้ร่างกายฟื้นตัว</li>
        </ul>
      </section>

      <section className="col">
        <h2>แก้ไขข้อมูล</h2>
        <BodyForm f={f} set={set} touch={touch} errors={validate(f, touched)} />
        <GoalForm f={f} set={set} errors={validate(f, touched)} />
        <button className="btn pri block" disabled={!dirty} onClick={save}><Save /> บันทึกโปรไฟล์</button>
        <p className="hint">เปลี่ยนเป้าหมายแล้วไปหน้า “แผน” กด “ออกแบบให้” เพื่อสร้างโปรแกรมใหม่</p>
      </section>

      <section className="card col">
        <h2 className="row"><Timer aria-hidden="true" /> เวลาพักระหว่างเซ็ต</h2>
        <Seg label="เวลาพัก" value={profile.rest} onChange={(rest) => saveProfile({ ...profile, rest })} options={[[60, '60 วิ'], [90, '90 วิ'], [120, '2 นาที'], [180, '3 นาที']]} />
        <p className="hint">ท่าหลักหนักๆ พัก 90 วินาทีขึ้นไป ท่าเสริมพัก 60 วินาทีได้</p>
      </section>

      <SyncPanel toast={toast} />

      <section className="card col">
        <h2>ข้อมูลของฉัน</h2>
        <p className="mute sm">{linked ? 'ข้อมูลเก็บในเครื่องนี้และซิงก์ขึ้นคลาวด์แบบเข้ารหัสไปยังเครื่องที่เชื่อมไว้ สำรองเป็นไฟล์ไว้อีกชั้นได้' : 'ทุกอย่างเก็บในเบราว์เซอร์เครื่องนี้ ไม่มีการส่งขึ้นเซิร์ฟเวอร์ สำรองไว้เป็นไฟล์เพื่อย้ายเครื่องได้'}</p>
        <div className="two">
          <button className="btn" onClick={exportData}><Download /> สำรอง</button>
          <label className="btn" style={{ cursor: 'pointer' }}><Upload /> นำเข้า<input type="file" accept="application/json" onChange={onImport} className="sr" /></label>
        </div>
        <button className="btn danger ghost" onClick={() => confirm(linked ? 'ลบข้อมูลทั้งหมด? เครื่องอื่นที่เชื่อมไว้จะถูกลบด้วยเมื่อซิงก์ ถ้าไม่ต้องการ ให้กด "เลิกเชื่อมเครื่องนี้" ก่อน' : 'ลบข้อมูลทั้งหมดและเริ่มใหม่?') && (resetAll(), (location.hash = '#/'), location.reload())}><Trash2 /> ลบข้อมูลทั้งหมด</button>
      </section>

      <footer className="hint">
        brightside · รูปท่าจาก <a href="https://github.com/yuhonas/free-exercise-db">free-exercise-db</a> (Unlicense) · ตารางโปรแกรม PPL และคำแนะนำอาหารจาก Artifact ของผู้ใช้ · ข้อมูลทั้งหมดเป็นแนวทางทั่วไป ไม่ใช่คำแนะนำทางการแพทย์
      </footer>
    </div>
  )
}
