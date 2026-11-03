import { ChevronLeft, ChevronRight, Shuffle, Dumbbell, Scale, Utensils, Droplets, Quote, CalendarDays } from 'lucide-react'
import { MoodFace, MoodCard } from '../components/Mood.jsx'
import { MOODS, moodOf, noteOf, isLow, isHigh, monthSummary, moodVsTraining, pastEncouragement, validDate, validMonth } from '../lib/mood.js'
import { dateKey, dayIdx, targets } from '../lib/calc.js'
import { addDays } from '../lib/coach.js'
import { useStore, dayStatus, setsDone, volumeOf } from '../store.js'

const WEEK = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const dt = (k) => new Date(k + 'T00:00:00')
const shortTh = (k) => dt(k).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const longTh = (k) => dt(k).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const monthTh = (ym) => dt(ym + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
const shiftMonth = (ym, n) => { const d = dt(ym + '-01'); d.setMonth(d.getMonth() + n); return dateKey(d).slice(0, 7) }
const ST = { done: 'ฝึกแล้ว', miss: 'พลาดการฝึก', rest: 'วันพัก', skip: 'ข้ามวัน', todo: 'ยังไม่ฝึก', pre: 'ก่อนเริ่มใช้แอพ' }

function Month({ ym, s, today }) {
  const { logs } = s
  const sum = monthSummary(logs, ym)
  const first = dayIdx(dt(ym + '-01'))
  const len = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: len }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)]
  const top = Object.entries(sum.counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const notes = Object.keys(logs).filter((d) => d.startsWith(ym) && noteOf(logs[d])).sort().reverse()
  const vs = moodVsTraining(logs)
  const prev = shiftMonth(ym, -1), next = shiftMonth(ym, 1)
  const withNotes = Object.keys(logs).filter((d) => noteOf(logs[d]) && d <= today)

  const shuffle = () => {
    location.hash = `#/memory/${withNotes[Math.floor(Math.random() * withNotes.length)]}`
  }

  return (
    <>
      <header className="page-head"><div><span className="eyebrow">ความทรงจำ</span><h1>{monthTh(ym)}</h1></div>
        <div className="row" style={{ gap: '0.25rem' }}>
          <a className="icon-btn" href={`#/memory/${prev}`} aria-label="เดือนก่อนหน้า"><ChevronLeft /></a>
          <a className="icon-btn" href={`#/memory/${next}`} aria-label="เดือนถัดไป" aria-disabled={next > today.slice(0, 7)} style={next > today.slice(0, 7) ? { visibility: 'hidden' } : undefined}><ChevronRight /></a>
        </div>
      </header>

      <section className="card col mcal-card">
        {sum.headline ? <p className="mhead">{sum.headline}</p> : <p className="mute">ยังไม่มีอารมณ์ที่บันทึกในเดือนนี้ ไปหน้า “วันนี้” แล้วเลือกหน้าที่ตรงกับความรู้สึก หรือแตะวันที่ด้านล่างเพื่อบันทึกย้อนหลัง</p>}
        <div className="mcal" role="group" aria-label={`ปฏิทินอารมณ์ ${monthTh(ym)} แตะวันที่เพื่อเปิดความทรงจำ`}>
          {WEEK.map((w) => <span key={w} className="mwd" aria-hidden="true">{w}</span>)}
          {cells.map((k, i) => {
            if (!k) return <span key={'b' + i} aria-hidden="true" />
            const mo = moodOf(logs[k]), n = Number(k.slice(8)), future = k > today
            const label = `${longTh(k)}${mo ? ' · ' + mo.th : ' · ยังไม่ได้บันทึกอารมณ์'}`
            const inner = <>{mo ? <MoodFace id={mo.id} /> : <i className="mempty" />}<small>{n}</small></>
            return future
              ? <span key={k} className="mday off" aria-hidden="true">{inner}</span>
              : <a key={k} className={`mday ${k === today ? 'today' : ''}`} href={`#/memory/${k}`} aria-label={label} aria-current={k === today ? 'date' : undefined}>{inner}</a>
          })}
        </div>
        {top.length > 0 && (
          <ul className="mtop" aria-label="อารมณ์ที่พบบ่อยในเดือนนี้">
            {top.map(([id, n]) => <li key={id}><MoodFace id={id} size={28} /><b className="num">{n}</b><span className="mute xs">{MOODS.find((m) => m.id === id).th}</span></li>)}
          </ul>
        )}
        <p className="hint">บันทึกแล้ว {sum.n} วัน · แตะวันที่ใดก็ได้เพื่อเปิดความทรงจำของวันนั้น (หรือบันทึกย้อนหลัง)</p>
      </section>

      {withNotes.length > 0 && <button type="button" className="btn block" onClick={shuffle}><Shuffle /> ย้อนอ่านข้อความที่เคยเขียนสักข้อ</button>}

      {vs && (
        <section className="card col">
          <h2>อารมณ์กับการฝึก</h2>
          <p className="sm">วันที่ฝึกจบ อารมณ์เฉลี่ย <b className="num">{vs.train}</b>/5 · วันอื่น <b className="num">{vs.other}</b>/5 <span className="mute xs">(จาก {vs.nT} และ {vs.nO} วัน)</span></p>
          <p className="hint">เป็นแค่ความสัมพันธ์จากบันทึกของคุณเอง ไม่ได้แปลว่าการฝึกเป็นสาเหตุ (หรือวันที่อารมณ์ดีทำให้อยากฝึก)</p>
        </section>
      )}

      {notes.length > 0 && (
        <section className="card col">
          <h2 className="row"><Quote aria-hidden="true" /> ข้อความที่เคยเขียน</h2>
          <ul className="memos">
            {notes.slice(0, 12).map((d) => {
              const m = moodOf(logs[d])
              return <li key={d}><a href={`#/memory/${d}`}><MoodFace id={m.id} size={36} /><span className="col" style={{ gap: 2, minWidth: 0 }}><b className="xs mute">{shortTh(d)} · {m.th}</b><span className="memo-t">{noteOf(logs[d])}</span></span></a></li>
            })}
          </ul>
        </section>
      )}
    </>
  )
}

function Day({ date, s, today }) {
  const { logs, plan, profile, weights } = s
  const log = logs[date]
  const mo = moodOf(log), note = noteOf(log)
  const future = date > today
  const st = dayStatus(s, date)
  const day = plan.days[dayIdx(dt(date))]
  const w = weights.find((x) => x.date === date)
  const food = log?.food
  const t = targets(profile)
  const enc = isLow(mo) ? pastEncouragement(logs, date, today) : null
  const facts = [
    day && [Dumbbell, st === 'done' ? `${day.name} · ${setsDone(log)} เซ็ต${volumeOf(log) > 0 ? ` · ${volumeOf(log).toLocaleString()} กก.` : ''}` : `${ST[st]}${day?.kind === 'train' ? ` (${day.name})` : ''}`],
    w && [Scale, `น้ำหนัก ${w.kg} กก.`],
    food?.kcal > 0 && [Utensils, `กิน ${Math.round(food.kcal).toLocaleString()} จากเป้า ${t.kcal.toLocaleString()} kcal`],
    food?.water > 0 && [Droplets, `ดื่มน้ำ ${food.water} แก้ว`],
  ].filter(Boolean)

  return (
    <>
      <header className="page-head"><div><span className="eyebrow">ความทรงจำ</span><h1 style={{ fontSize: '1.375rem' }}>{longTh(date)}</h1></div>
        <div className="row" style={{ gap: '0.25rem' }}>
          <a className="icon-btn" href={`#/memory/${addDays(date, -1)}`} aria-label="วันก่อนหน้า"><ChevronLeft /></a>
          <a className="icon-btn" href={`#/memory/${addDays(date, 1)}`} aria-label="วันถัดไป" style={date >= today ? { visibility: 'hidden' } : undefined}><ChevronRight /></a>
        </div>
      </header>

      {future ? (
        <section className="card col" style={{ alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
          <CalendarDays size={40} style={{ color: 'var(--info-fg)' }} aria-hidden="true" />
          <h2>ยังมาไม่ถึง</h2><p className="mute">กลับมาบันทึกความรู้สึกวันนั้นเมื่อถึงวัน</p>
        </section>
      ) : mo ? (
        <section className="card col mem-hero" style={{ '--mc': mo.c }}>
          <div className="mem-face"><MoodFace id={mo.id} label={mo.th} /></div>
          <h2 style={{ textAlign: 'center' }}>{mo.th}</h2>
          {note ? <blockquote className="mem-note">{note}</blockquote> : <p className="mute sm" style={{ textAlign: 'center' }}>วันนั้นไม่ได้เขียนอะไรไว้</p>}
          {isHigh(mo) && note && <p className="hint" style={{ textAlign: 'center' }}>เก็บข้อความนี้ไว้ — ถ้าวันไหนเหนื่อย แอพจะเอามาให้อ่านเป็นกำลังใจ</p>}
        </section>
      ) : (
        <section className="card col"><p className="mute">ยังไม่ได้บันทึกอารมณ์ของวันนี้ เลือกหน้าที่ตรงกับความรู้สึกวันนั้นได้ด้านล่าง</p></section>
      )}

      {enc && (
        <section className="card col kind-card">
          <h2>ข้อความจากตัวคุณเมื่อ {shortTh(enc.date)}</h2>
          <q className="enc">{enc.note}</q>
          <a className="mem-link" href={`#/memory/${enc.date}`}>เปิดวันนั้น <ChevronRight size={16} aria-hidden="true" /></a>
        </section>
      )}

      {!future && facts.length > 0 && (
        <section className="card col">
          <h2>วันนั้นของคุณ</h2>
          <ul className="facts">{facts.map(([Icon, text], i) => <li key={i}><Icon aria-hidden="true" /> <span>{text}</span></li>)}</ul>
          <a className="mem-link" href={`#/today/${date}`}>เปิดการฝึกของวันนั้น <ChevronRight size={16} aria-hidden="true" /></a>
        </section>
      )}

      {!future && <MoodCard date={date} today={today} log={log} logs={logs} title={mo ? 'แก้ไขบันทึกวันนั้น' : 'บันทึกความรู้สึกวันนั้น'} showKind={false} />}
      <a className="btn ghost block" href={`#/memory/${date.slice(0, 7)}`}><CalendarDays /> ดูทั้งเดือน</a>
    </>
  )
}

export default function Memory({ param }) {
  const s = useStore()
  const today = dateKey()
  const day = validDate(param) ? param : null
  const ym = validMonth(param) ? param : today.slice(0, 7)
  return <div className="page memory">{day ? <Day date={day} s={s} today={today} /> : <Month ym={ym} s={s} today={today} />}</div>
}
