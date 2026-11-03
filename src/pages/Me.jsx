import { useState } from 'react'
import { Save, Flame, Beef, Droplets, Download, Upload, Trash2, Timer, Wheat, Droplet, Info } from 'lucide-react'
import { BodyForm, GoalForm, toForm, toProfile, validate, isValid } from '../components/ProfileForms.jsx'
import { BmiGauge, Seg } from '../components/ui.jsx'
import { bmi, targets, mealTargets } from '../lib/calc.js'
import { useStore, saveProfile, getState, importData, resetAll } from '../store.js'
import SyncPanel from '../components/SyncPanel.jsx'
import { useSync } from '../lib/sync.js'

const SOURCES = [
  ['ความถี่', 'ฝึกแต่ละกลุ่มกล้ามเนื้อ 2 ครั้ง/สัปดาห์ให้ผลดีกว่า 1 ครั้ง (Schoenfeld 2016) แต่ถ้าปริมาณรวมเท่ากัน ความถี่ที่สูงกว่านั้นแทบไม่เพิ่มผล (Schoenfeld 2019)'],
  ['ปริมาณ', 'ราว 10+ เซ็ต/กลุ่มกล้ามเนื้อ/สัปดาห์ให้ผลดีขึ้นตามปริมาณ มือใหม่เริ่มน้อยกว่านี้ได้ (Schoenfeld 2017)'],
  ['จำนวนครั้ง', 'ช่วง 5–30 ครั้งสร้างกล้ามได้ใกล้เคียงกัน ถ้าเซ็ตใกล้หมดแรง ท่าหนักหลายข้อต่อใช้ครั้งน้อย ท่าเดี่ยวใช้ครั้งมาก (Schoenfeld 2017)'],
  ['ความใกล้หมดแรง', 'หยุดเซ็ตที่เหลืออีก ~1–3 ครั้งก่อนหมดแรงก็พอ ไม่จำเป็นต้องฝืนถึงสุดทุกเซ็ต (Refalo 2023)'],
  ['เวลาพัก', 'ผู้ฝึกมาแล้วที่พัก ~2–3 นาที กล้ามโตและแรงขึ้นกว่าพัก 1 นาที จึงให้ท่าหลักพักนาน ท่าเสริมพักสั้นได้ (Schoenfeld 2016)'],
  ['ช่วงเคลื่อนไหว', 'ทำเต็มช่วง (เช่น สควอทลึก) สร้างกล้ามได้ไม่น้อยกว่าทำตื้น (Wolf 2023)'],
  ['โปรตีน', '1.6 g/กก./วัน เริ่มได้ผลสูงสุด ช่วงที่ปลอดภัยสูงถึง ~2.2 g/กก. (Morton 2018)'],
  ['ลดน้ำหนัก', 'ขาดดุลแคลอรี่เล็กน้อยพร้อมโปรตีนสูงและเวท รักษากล้ามเนื้อได้ดี ลดไม่เกิน ~1% ของน้ำหนักตัว/สัปดาห์ (Helms 2014)'],
  ['ลดไขมันเฉพาะจุด', 'ทำไม่ได้ ท่าท้องมากขึ้นไม่ได้ลดพุง ไขมันลดจากภาพรวมของพลังงานเข้า–ออก (Vispute 2011)'],
  ['คาร์ดิโอ/ก้าวเดิน', 'WHO แนะนำแอโรบิกปานกลาง 150–300 นาที/สัปดาห์ + เวท ≥ 2 วัน · อายุ <60 ปี ประโยชน์สูงสุดราว 8,000–10,000 ก้าว/วัน (Paluch 2022)'],
  ['น้ำดื่ม', 'ประมาณ 33 มล./กก. และเพิ่ม 0.5 ลิตรในวันฝึก (ACSM: ดื่ม 400–600 มล. ก่อนฝึก ~2 ชม.) เป็นค่าประมาณทั่วไป ความต้องการจริงขึ้นกับอากาศและเหงื่อ ปัสสาวะสีเหลืองอ่อนแปลว่าพอ'],
  ['ใยอาหาร น้ำตาล โซเดียม', 'ใยอาหาร 14 g ต่อ 1,000 kcal (IOM) · น้ำตาลเติมไม่เกิน 5–10% ของพลังงาน (WHO 2015) · โซเดียมไม่เกิน 2,000 มก./วัน (WHO 2012)'],
  ['ปรับตาม BMI และอายุ', 'BMI < 18.5 เพิ่มพลังงาน · BMI ≥ 27.5 ขาดดุลมากขึ้น · อายุ < 18 ปีไม่ขาดดุล · 60+ ขาดดุลไม่เกิน 300 kcal โปรตีน 1.2–1.6 g/กก. (PROT-AGE, Bauer 2013) · BMI > 25 คิดโปรตีนจากน้ำหนักปรับ'],
  ['BMI', 'ใช้เกณฑ์เอเชีย–แปซิฟิก/กรมอนามัย (สมส่วน 18.5–22.9) BMI ไม่แยกกล้ามกับไขมัน ถ้าฝึกหนักให้ดูรอบเอวและรูปร่างประกอบ'],
]

const MEALS = [ // ตัวอย่างเมนู 4 มื้อ (ปริมาณปรับตามเป้าของแต่ละคน)
  ['เช้า', 'ไข่ต้ม 2–3 ฟอง + ข้าวโอ๊ตหรือขนมปังโฮลวีต + นมหรือโยเกิร์ต'],
  ['กลางวัน', 'ข้าวสวย/ข้าวกล้อง + อกไก่ ปลา หรือเต้าหู้ + ผัก'],
  ['เย็น', 'ข้าวสวยน้อยลงเล็กน้อย + ปลา ไก่ ไข่ หรือเต้าหู้ + ผักเยอะๆ'],
  ['ว่าง', 'กล้วย + นมไม่หวาน/โยเกิร์ตกรีก ก่อนฝึก 1–2 ชม. หรือเวย์/ไข่ต้มหลังฝึก'],
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
        <h2>เป้าหมายประจำวัน <span className="mute sm">สำหรับคุณโดยเฉพาะ</span></h2>
        <div className="three" style={{ gap: '0.5rem' }}>
          <div className="stat"><Flame aria-hidden="true" /><span className="num">{t.kcal.toLocaleString()}</span><small>kcal</small></div>
          <div className="stat"><Beef aria-hidden="true" /><span className="num">{t.protein[0]}–{t.protein[1]}</span><small>โปรตีน g</small></div>
          <div className="stat"><Droplets aria-hidden="true" /><span className="num">{t.water}–{t.waterTrain}</span><small>น้ำ ลิตร</small></div>
        </div>
        <div className="three" style={{ gap: '0.5rem' }}>
          <div className="stat"><Wheat aria-hidden="true" /><span className="num">{t.carb}</span><small>คาร์บ g</small></div>
          <div className="stat"><Droplet aria-hidden="true" /><span className="num">{t.fat}</span><small>ไขมัน g</small></div>
          <div className="stat"><Info aria-hidden="true" /><span className="num">{t.fiber}</span><small>ใยอาหาร g</small></div>
        </div>
        <p className="hint">น้ำ = วันพัก–วันฝึก · ใยอาหาร = ขั้นต่ำ · น้ำตาลเติมไม่เกิน {t.sugar} g · โซเดียมไม่เกิน {t.sodium.toLocaleString()} มก.</p>
        <p className="hint">
          พลังงานที่ใช้ทั้งวัน ≈ {t.tdee.toLocaleString()} kcal (Mifflin–St Jeor × กิจกรรมจากจำนวนวันฝึก) ·
          {' '}{t.delta > 0 ? `เกินดุล ${t.delta} kcal` : t.delta < 0 ? `ขาดดุล ${-t.delta} kcal` : 'เท่าที่ใช้'} ตาม BMI {t.bmi.toFixed(1)} อายุ {profile.age} และเป้าหมายของคุณ · เป็นค่าประมาณ ปรับตามผลจริงทุก 2–3 สัปดาห์
        </p>
        {t.notes.map((n) => <p key={n.text} className="nudge"><Info aria-hidden="true" /><span>{n.text}</span></p>)}
      </section>

      <section className="card col">
        <h2>แบ่งตามมื้อ <span className="mute sm">ปรับปริมาณตามเป้าของคุณ</span></h2>
        <table className="tbl"><thead><tr><th>มื้อ / ตัวอย่าง</th><th>เป้า</th></tr></thead><tbody>
          {mealTargets(t).map((m, i) => <tr key={m.n}><td><b>{m.n}</b><br /><span className="mute sm">{MEALS[i][1]}</span></td><td className="num nw">{m.kcal} kcal<br /><span className="mute xs">โปรตีน ~{m.protein} g</span></td></tr>)}
        </tbody></table>
        <ul className="list sm mute" style={{ paddingLeft: '1.1rem', listStyle: 'disc' }}>
          <li>บันทึกอาหารได้ที่หน้า “วันนี้” แตะเลือกเมนูไทยที่กินบ่อย ระบบรวมพลังงาน โปรตีน คาร์บ ไขมันให้</li>
          <li>ตัดน้ำหวาน ชานม น้ำอัดลม และของทอด ดื่มน้ำให้ถึงเป้าด้านบน (วันฝึกเพิ่ม 0.5 ลิตร)</li>
          <li>กินโปรตีนกระจายทุกมื้อ มื้อละ 20–40 g กล้ามเนื้อใช้ประโยชน์ได้ดีกว่ากินรวมมื้อเดียว</li>
          <li>น้ำหนักลดช้าๆ ราว 0.25–0.5 กก./สัปดาห์ ถ้าลดเร็วกว่านี้ ให้เพิ่มอาหาร 100–200 kcal เพื่อไม่ให้กล้ามเนื้อหาย</li>
          <li>นอน 7–8 ชั่วโมง และเดินวันพัก 8,000–10,000 ก้าว</li>
          <li>ทุก 6–8 สัปดาห์ หรือเมื่อรู้สึกล้าสะสม น้ำหนักไม่ขึ้นมาหลายสัปดาห์ ลดเหลือ 2 เซ็ตต่อท่า 1 สัปดาห์ (หลักฐานเรื่องสัปดาห์เบายังจำกัด ฟังร่างกายเป็นหลัก)</li>
        </ul>
      </section>

      <details className="card nutri col">
        <summary className="row between" style={{ cursor: 'pointer', minHeight: 44 }}><h2>หลักฐานวิจัยที่แอพนี้ใช้</h2></summary>
        <ul className="list sm mute" style={{ paddingLeft: '1.1rem', listStyle: 'disc' }}>
          {SOURCES.map(([k, v]) => <li key={k}><b>{k}</b> — {v}</li>)}
        </ul>
        <p className="hint">สรุปจากงานวิจัยรวม (meta-analysis) และแนวทางขององค์กรสุขภาพ เป็นแนวทางทั่วไป ไม่ใช่คำแนะนำทางการแพทย์</p>
      </details>

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
        <p className="hint">ท่าหลักหนักๆ พัก 2–3 นาที (พักนานให้กล้ามโตและแรงขึ้นกว่าพัก 1 นาที) ท่าเสริมพัก 60–90 วินาทีได้</p>
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
