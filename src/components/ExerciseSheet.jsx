import { useState } from 'react'
import { Target, TriangleAlert, ExternalLink, Plus, Trophy, Heart } from 'lucide-react'
import { Sheet, Media } from './ui.jsx'
import { EQUIP, LEVELS, imgUrl } from '../data/exercises.js'
import { DAY_TH } from '../lib/calc.js'
import { useStore, editDay, personalBests, toggleFav } from '../store.js'
import { parseRx } from '../data/plan.js'

/** รายละเอียดท่า: ได้อะไร · วิธีเล่น · ห้ามพลาด · รูป 2 เฟรม · วิดีโอ */
export default function ExerciseSheet({ ex, onClose, toast }) {
  const plan = useStore((s) => s.plan)
  const logs = useStore((s) => s.logs)
  const favs = useStore((s) => s.favs)
  const [day, setDay] = useState(0)
  if (!ex) return <Sheet open={false} onClose={onClose} title="" />

  const pb = personalBests(logs).find(([id]) => id === ex.id)?.[1]
  const lv = LEVELS.find(([n]) => n === ex.lv)[1]
  const add = () => {
    const [sets, reps] = parseRx(ex.rx)
    editDay(day, (d) => ({
      ...d,
      kind: 'train',
      name: d.kind === 'train' ? d.name : 'ฝึกเพิ่ม',
      focus: d.kind === 'train' ? d.focus : 'ฝึกเพิ่มเติม',
      items: d.items.some((i) => i.id === ex.id) ? d.items : [...d.items, { id: ex.id, sets, reps }],
    }))
    toast?.(`เพิ่ม ${ex.th} ใน${DAY_TH[day]}แล้ว`)
  }

  return (
    <Sheet open onClose={onClose} title={ex.th}>
      <Media ex={ex} eager />
      <div className="row wrap" style={{ gap: '0.5rem' }}>
        <span className={`badge l${ex.lv}`}>{lv}</span>
        <span className="badge">{EQUIP[ex.eq]}</span>
        <span className="badge">แนะนำ {ex.rx}</span>
      </div>
      <div className="row">
        <span className="mute sm grow">{ex.en}</span>
        <button className="btn sm grow-0" aria-pressed={favs.includes(ex.id)} onClick={() => toggleFav(ex.id)}><Heart fill={favs.includes(ex.id) ? 'currentColor' : 'none'} /> {favs.includes(ex.id) ? 'โปรดแล้ว' : 'โปรด'}</button>
      </div>

      <div className="callout">
        <Target aria-hidden="true" />
        <div><b>ท่านี้ได้อะไร</b><p>{ex.gain}</p></div>
      </div>
      <div className="mchips" aria-label="กล้ามเนื้อที่ใช้">{ex.m.split(' · ').map((m) => <span key={m}>{m}</span>)}</div>

      <section className="col" style={{ gap: '0.5rem' }}>
        <h3>วิธีเล่น</h3>
        <ol className="steps">{ex.how.map((s) => <li key={s}>{s}</li>)}</ol>
      </section>

      <div className="callout warn">
        <TriangleAlert aria-hidden="true" />
        <div><b>ห้ามพลาด</b><p>{ex.avoid}</p></div>
      </div>

      {ex.g === 'stretch' && <p className="hint">ยืดหลังฝึกหรือวันพัก ค้างจนรู้สึกตึงแต่ไม่เจ็บ · ก่อนยกหนักให้วอร์มอัพแบบเคลื่อนไหวแทน เพราะการยืดค้างนานก่อนยกอาจลดแรงชั่วคราว</p>}
      {ex.db && (
        <div className="frames">
          {['จุดเริ่มต้น', 'จุดสิ้นสุด'].map((c, n) => (
            <figure key={c}><img src={imgUrl(ex, n)} alt={`${ex.th} — ${c}`} loading="lazy" /><figcaption>{c}</figcaption></figure>
          ))}
        </div>
      )}

      {pb && <p className="row"><Trophy style={{ color: 'var(--warn-fg)' }} aria-hidden="true" /> น้ำหนักสูงสุดของคุณ <b className="num" style={{ fontSize: '1.25rem' }}>{pb.kg} กก. × {pb.reps || '–'}</b></p>}

      <a className="btn block" href={ex.video} target="_blank" rel="noreferrer"><ExternalLink /> ค้นหาวิดีโอสอนบน YouTube</a>

      {plan && (
        <div className="row pair">
          <select className="input grow" aria-label="เลือกวัน" value={day} onChange={(e) => setDay(+e.target.value)}>
            {DAY_TH.map((d, i) => <option key={d} value={i}>{d} · {plan.days[i].name}</option>)}
          </select>
          <button className="btn pri" onClick={add}><Plus /> เพิ่มเข้าโปรแกรม</button>
        </div>
      )}
      <p className="hint">รูปประกอบ: free-exercise-db (สาธารณสมบัติ) · ข้อมูลเป็นแนวทางทั่วไป หากมีอาการบาดเจ็บหรือโรคประจำตัวควรปรึกษาแพทย์/ผู้ฝึกก่อน</p>
    </Sheet>
  )
}
