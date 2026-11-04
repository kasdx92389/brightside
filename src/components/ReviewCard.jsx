import { Compass, TrendingUp, TrendingDown, Check, HeartPulse, CalendarCheck, Info } from 'lucide-react'
import { calorieAdvice, adherence, groupBalance, fatigueFlag } from '../lib/review.js'
import { deloadDue, inDeload } from '../lib/coach.js'
import { targets } from '../lib/calc.js'
import { setKcalAdj, startDeload } from '../store.js'

/** "ปรับให้เข้ากับคุณ": คำแนะนำจากข้อมูลจริงที่ผู้ใช้บันทึก — ทุกข้อให้ผู้ใช้กดยืนยันเอง */
export default function ReviewCard({ s, today, toast }) {
  const p = s.profile
  const cal = calorieAdvice(s, today)
  const adh = adherence(s, today)
  const bal = groupBalance(s, today)
  const tired = fatigueFlag(s, today)
  const cur = Number(p.kcalAdj) || 0
  const t = targets(p)
  const lowGroups = bal.filter((x) => x.low)

  return (
    <section className="card col review" aria-labelledby="rv-h">
      <h2 id="rv-h" className="row"><Compass aria-hidden="true" /> ปรับให้เข้ากับคุณ</h2>
      <p className="mute sm">แอพดูจากสิ่งที่คุณบันทึกจริง แล้วเสนอปรับแผนและเป้าหมาย คุณกดยืนยันเองทุกครั้ง</p>

      <div className="rv-item">
        <b className="row" style={{ gap: '0.375rem' }}>{cal?.kind === 'adjust' ? (cal.delta > 0 ? <TrendingUp size={18} aria-hidden="true" /> : <TrendingDown size={18} aria-hidden="true" />) : cal?.kind === 'ok' ? <Check size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />} เป้าแคลอรี่ <span className="num mute">{t.kcal.toLocaleString()} kcal{cur ? ` (ปรับ ${cur > 0 ? '+' : ''}${cur})` : ''}</span></b>
        {cal === null && <p className="mute sm">อายุต่ำกว่า 18 ปี หรือตั้งครรภ์/ให้นมบุตร แอพไม่ปรับเป้าแคลอรี่อัตโนมัติ ควรปรึกษาแพทย์หรือนักกำหนดอาหาร</p>}
        {cal && <p className="sm">{cal.msg}</p>}
        {cal?.kind === 'adjust' && (
          <button type="button" className="btn pri sm" onClick={() => { setKcalAdj(cal.next); toast(`ปรับเป้าเป็น ${cal.kcal.toLocaleString()} kcal แล้ว`) }}>
            ปรับเป็น {cal.kcal.toLocaleString()} kcal ({cal.delta > 0 ? '+' : ''}{cal.delta})
          </button>
        )}
        {cur !== 0 && <button type="button" className="btn ghost sm" onClick={() => { setKcalAdj(0); toast('กลับไปใช้เป้าตามสูตรมาตรฐาน') }}>ใช้ค่าตามสูตรมาตรฐาน</button>}
        <p className="hint">น้ำหนักแกว่งได้จากน้ำ/โซเดียม/ประจำเดือน จึงดูแนวโน้ม ≥2 สัปดาห์ ลด 0.5–1%/สัปดาห์ (Helms 2014) · เพิ่ม 0.25–0.5%/สัปดาห์ (Iraki 2019) ศึกษาในนักเพาะกายธรรมชาติ ใช้เป็นแนวทางทั่วไป</p>
      </div>

      <div className="rv-item">
        <b className="row" style={{ gap: '0.375rem' }}><CalendarCheck size={18} aria-hidden="true" /> ความสม่ำเสมอ 4 สัปดาห์</b>
        {adh.n < 4 ? <p className="mute sm">ยังมีวันฝึกตามแผนไม่ถึง 4 วัน ใช้ต่ออีกสักพักแล้วแอพจะสรุปให้</p> : (
          <>
            <div className="bar" role="progressbar" aria-label="ฝึกตามแผน" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(adh.pct * 100)}><i style={{ width: `${adh.pct * 100}%` }} className={adh.pct >= 0.8 ? 'full' : ''} /></div>
            <p className="sm">ฝึกตามแผน {adh.done}/{adh.n} วัน ({Math.round(adh.pct * 100)}%){adh.pct < 0.6 ? ' — แผนอาจแน่นเกินตารางชีวิตตอนนี้ ลดจำนวนวัน/สัปดาห์ในหน้า “แผน” ให้ทำได้จริงดีกว่าทำครบแต่หยุดกลางทาง' : adh.pct >= 0.8 ? ' — สม่ำเสมอมาก' : ''}</p>
          </>
        )}
      </div>

      {bal.length > 0 && (
        <div className="rv-item">
          <b>สมดุลกลุ่มกล้ามเนื้อ <span className="mute xs">(เซ็ตที่ทำจริง / ตามแผน 14 วัน)</span></b>
          <ul className="rv-groups">
            {bal.map((x) => <li key={x.g} className={x.low ? 'low' : ''}><span>{x.th}</span><b className="num">{x.done}/{x.planned}</b></li>)}
          </ul>
          {lowGroups.length > 0 && <p className="sm">{lowGroups.map((x) => x.th).join(' · ')} ทำได้ไม่ถึง 60% ของแผน — ถ้าคุณมักข้ามวันที่มีกลุ่มนี้ ย้ายไปวันที่คุณมาเล่นสม่ำเสมอ หรือสลับท่าในหน้า “วันนี้” ให้สั้นลง เพื่อให้ทุกกลุ่มได้ฝึกอย่างน้อย 2 ครั้ง/สัปดาห์</p>}
        </div>
      )}

      {tired && !inDeload(s, today) && (
        <div className="rv-item">
          <b className="row" style={{ gap: '0.375rem' }}><HeartPulse size={18} aria-hidden="true" /> ช่วงนี้ดูเหนื่อย</b>
          <p className="sm">7 วันล่าสุดบันทึกอารมณ์ {tired.n} วัน และ {tired.low} วันรู้สึกเหนื่อย/เศร้า/หงุดหงิด ถ้าตรงกับช่วงที่ฝึกหนักหรือนอนน้อย ลองสัปดาห์เบา (ไม่เกิน 2 เซ็ตต่อท่า 7 วัน) ให้ร่างกายและใจได้พัก</p>
          <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { startDeload(); toast('เริ่มสัปดาห์เบา 7 วัน') }}>เริ่มสัปดาห์เบา</button>
        </div>
      )}
      {!tired && deloadDue(s, today) && <p className="sm mute">ถึงเวลาสัปดาห์เบาตามรอบ 6 สัปดาห์แล้ว (ดูที่หน้า “วันนี้”)</p>}
    </section>
  )
}
