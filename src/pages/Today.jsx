import { useMemo, useState } from 'react'
import { Check, ChevronDown, Rocket, Info, BedDouble, PartyPopper, Undo2, Clock, Timer, TrendingUp, TrendingDown, Moon, SkipForward, HeartPulse, ArrowLeftRight, Lightbulb } from 'lucide-react'
import { Ring, Media } from '../components/ui.jsx'
import ExerciseSheet from '../components/ExerciseSheet.jsx'
import SwapSheet from '../components/SwapSheet.jsx'
import FoodTracker from '../components/FoodTracker.jsx'
import { byId } from '../data/exercises.js'
import { minutesOf, itemLabel, parseRx } from '../data/plan.js'
import { DAY_TH, DAY_SHORT, dateKey, dayIdx } from '../lib/calc.js'
import { MoodCard } from '../components/Mood.jsx'
import SafetyBanner from '../components/SafetyBanner.jsx'
import { isTimed, timedSeconds, overloadHint, regressHint, deloadDue, inDeload } from '../lib/coach.js'
import { suggestKg, personalFactor, LOAD_UNIT } from '../lib/loads.js'
import { bmi as calcBmi } from '../lib/calc.js'
import {
  useStore, editDay, setLoadAdj, patchSet, finishDay, skipDay, toggleWarm, startDeload, endDeload,
  setsOf, progressOf, itemsFor, volumeOf, setsDone, lastKg, dayStatus, streak,
} from '../store.js'

const firstInt = (s) => String(s).match(/\d+/)?.[0] || ''
const longDate = (d) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
const STATUS_TH = { done: 'ทำแล้ว', rest: 'วันพัก', skip: 'ข้ามวัน', miss: 'พลาด', pre: 'ก่อนเริ่มใช้', todo: 'ยังไม่ทำ' }

function weekOf(d) {
  const mon = new Date(d)
  mon.setDate(d.getDate() - dayIdx(d))
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x })
}

/** อาการที่ต้องหยุดออกกำลังกายและขอความช่วยเหลือ — ตั้งครรภ์เพิ่มสัญญาณเตือนตาม ACOG CO 804 */
function StopSigns({ profile }) {
  const preg = !!profile.preg && profile.preg !== 'none'
  return (
    <details className="card stop">
      <summary className="row" style={{ cursor: 'pointer', minHeight: 44, gap: '0.5rem' }}><HeartPulse aria-hidden="true" style={{ color: 'var(--bad-fg)' }} /> <b>อาการที่ต้องหยุดทันที</b></summary>
      <ul className="sm" style={{ paddingLeft: '1.1rem', marginTop: '0.5rem' }}>
        <li>เจ็บหรือแน่นหน้าอก ใจสั่นผิดจังหวะ</li>
        <li>เวียนหัวจะเป็นลม หน้ามืด หายใจไม่ทันผิดปกติ</li>
        <li>เจ็บแปลบที่ข้อ หลัง หรือคอ ชา หรือร้าวลงแขนขา</li>
        {preg && <li><b>ตั้งครรภ์:</b> เลือดออกทางช่องคลอด น้ำเดิน ปวดท้อง/มดลูกบีบเป็นจังหวะ ปวดหัวมาก น่องบวมหรือปวด หายใจลำบากก่อนออกแรง ลูกดิ้นน้อยลง</li>}
      </ul>
      <p className="hint">หยุดพักก่อน ถ้าไม่หายหรือรุนแรง ไปพบแพทย์หรือโทร 1669 {preg && '· อ้างอิง ACOG Committee Opinion 804'}</p>
    </details>
  )
}

function ExRow({ it, ex, log, date, logs, profile, pf, open, onToggle, onInfo, onSwap, startTimer, rest }) {
  const sets = setsOf(log, it)
  const done = sets.filter((s) => s.done).length
  const timed = isTimed(it.reps)
  const secs = timed ? timedSeconds(it.reps) : null
  const up = timed ? null : overloadHint(logs, it.id, it.reps, date, 2.5, ex?.eq)
  const down = timed || up ? null : regressHint(logs, it.id, it.reps, date, ex?.eq)
  const hint = up ? String(up.kg) : down ? String(down.kg) : lastKg(logs, it.id, date)
  // ยังไม่เคยบันทึกท่านี้ → แนะนำน้ำหนักเริ่มต้นจากตัวผู้ใช้ (เป็น placeholder เท่านั้น ไม่เติมค่าให้เอง)
  const adj = profile.loadAdj || 1 // ผู้ใช้กด "หนักไป/เบาไป"
  const fa = Math.round(pf * adj * 100) / 100 // ตัวคูณรวม: ที่ยกจริง × ที่ผู้ใช้ปรับ
  const sug = !hint && !timed ? suggestKg(ex, profile, fa) : null

  const tick = (i) => {
    const s = sets[i]
    const on = !s.done
    patchSet(date, it.id, i, on ? { done: true, kg: s.kg || hint || '', reps: s.reps || (timed ? '' : firstInt(it.reps)) } : { done: false }, it.sets)
    if (on && i < it.sets - 1 && !timed) startTimer(rest, 'พักก่อนเซ็ตถัดไป')
  }

  return (
    <li className={`ex ${done === it.sets ? 'complete' : ''}`}>
      <button className="ex-head" aria-expanded={open} onClick={onToggle}>
        <Media ex={ex} />
        <span className="grow">
          <b>{ex.th}</b>
          <span className="mute sm" style={{ display: 'block' }}>{itemLabel(it)}</span>
          <span className="dots" aria-label={`ทำแล้ว ${done} จาก ${it.sets} เซ็ต`}>{sets.map((s, i) => <i key={i} className={s.done ? 'on' : ''} />)}</span>
        </span>
        <ChevronDown className="chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="sets">
          {up && <p className="nudge"><TrendingUp aria-hidden="true" /><span>ครั้งก่อนทำครบที่ {up.was} กก. — ครั้งนี้ลองเพิ่มเป็น <b>{up.kg} กก.</b></span></p>}
          {sug && (
            <p className="nudge">
              <Lightbulb aria-hidden="true" />
              <span>ครั้งแรกของท่านี้ เริ่มเบาๆ ที่ <b>~{sug.kg} กก. {LOAD_UNIT[sug.tag]}</b> ({fa !== 1 ? `ปรับ ${fa < 1 ? 'ลง' : 'ขึ้น'} ${Math.abs(Math.round((1 - fa) * 100))}% ตามที่คุณยกจริง/ที่ปรับไว้` : `ประมาณจากน้ำหนัก ${profile.weight} กก. · BMI ${calcBmi(profile.weight, profile.height).toFixed(1)}`}) เป็นแค่จุดเริ่ม <b>ถ้าหนักให้ลดได้เลย</b> เลือกน้ำหนักที่ทำได้ {String(it.reps).match(/\d+(?:–\d+)?/)?.[0]} ครั้งด้วยท่าที่สวย และยังเหลือแรงอีกราว 3 ครั้ง (ประเมินแม่นเมื่อเหลือไม่เกิน ~3–5 ครั้ง) {sug.tag === 'b' && 'บาร์เปล่ามาตรฐานหนัก ~20 กก. ถ้าหนักไป เริ่มด้วยดัมเบลก่อน '}หยุดทันทีถ้าเจ็บแปลบ ชา หรือเวียนหัว<span className="row wrap" style={{ gap: '0.5rem', marginTop: '0.5rem' }}><button type="button" className="btn sm" onClick={() => setLoadAdj(adj * 0.85)}>หนักไป ลดให้</button><button type="button" className="btn sm" onClick={() => setLoadAdj(adj * 1.15)}>เบาไป เพิ่มให้</button></span></span>
            </p>
          )}
          {down && <p className="nudge"><TrendingDown aria-hidden="true" /><span>ครั้งก่อนที่ {down.was} กก. ทำได้ไม่ถึงช่วงเป้าหมาย — ครั้งนี้ลองลดเป็น <b>{down.kg} กก.</b> แล้วเน้นท่าสวยและครบจำนวนครั้ง ค่อยเพิ่มทีหลัง จะได้ผลกว่าฝืนหนัก</span></p>}
          {!timed && <div className="set-labels"><span>เซ็ต</span><span>น้ำหนัก (กก.)</span><span>ครั้ง</span><span /></div>}
          {sets.map((s, i) => (
            <div className="set" key={i}>
              <span>{i + 1}</span>
              {timed ? (
                <div className="grow mute" style={{ gridColumn: '2 / 4' }}>เป้าหมาย {it.reps}</div>
              ) : (
                <>
                  <input className="input" type="number" inputMode="decimal" min="0" step="0.5" placeholder={hint || (sug ? String(sug.kg) : '–')} aria-label={`เซ็ต ${i + 1} น้ำหนัก กิโลกรัม`} value={s.kg ?? ''} onChange={(e) => patchSet(date, it.id, i, { kg: e.target.value }, it.sets)} />
                  <input className="input" type="number" inputMode="numeric" min="0" placeholder={firstInt(it.reps) || '–'} aria-label={`เซ็ต ${i + 1} จำนวนครั้ง`} value={s.reps ?? ''} onChange={(e) => patchSet(date, it.id, i, { reps: e.target.value }, it.sets)} />
                </>
              )}
              <button className="tick" aria-pressed={!!s.done} aria-label={`เซ็ต ${i + 1} ${s.done ? 'ทำแล้ว' : 'ยังไม่ทำ'}`} onClick={() => tick(i)}><Check /></button>
            </div>
          ))}
          <div className="row wrap acts" style={{ gap: '0.5rem' }}>
            {secs && <button className="btn sm" onClick={() => startTimer(secs, `จับเวลา ${ex.th}`)}><Timer /> จับเวลา {secs >= 60 ? `${secs / 60} นาที` : `${secs} วิ`}</button>}
            <button className="btn ghost sm grow" onClick={onInfo}><Info /> วิธีเล่นและสิ่งที่ได้</button>
            {done === 0 && <button className="btn ghost sm grow" onClick={onSwap}><ArrowLeftRight /> เครื่องไม่ว่าง? เปลี่ยนท่า</button>}
          </div>
        </div>
      )}
    </li>
  )
}

export default function Today({ date: dateParam, startTimer, toast }) {
  const s = useStore()
  const { profile, plan, logs } = s
  const date = dateParam || dateKey()
  const d = new Date(date + 'T00:00:00')
  const di = dayIdx(d)
  const day = plan.days[di]
  const log = logs[date]
  const items = itemsFor(s, date)
  const { total, done, pct } = progressOf(s, date)
  const pf = useMemo(() => personalFactor(logs, byId, profile), [logs, profile])
  const [open, setOpen] = useState(null)
  const [info, setInfo] = useState(null)
  const [swap, setSwap] = useState(null) // ท่าที่กำลังหาท่าแทน
  const isToday = date === dateKey()
  const finished = !!log?.finished
  const skipped = !!log?.skipped
  const light = inDeload(s, date)
  const sr = streak(s)
  const mins = (a, b) => Math.max(1, Math.round((b - a) / 60000))
  const train = items.length > 0 && day.kind !== 'rest'
  // สลับท่าในแผนของวันนี้ (อ่านเซ็ต/ครั้งจากแผนจริง ไม่ใช่ค่าที่ลดตอนสัปดาห์เบา)
  const doSwap = (e) => {
    const cur = day.items.find((i) => i.id === swap.id)
    const [sets, reps] = parseRx(e.rx)
    const keep = !isTimed(reps) && !isTimed(cur.reps)
    editDay(di, (d) => ({ ...d, items: d.items.map((i) => (i.id === swap.id ? { id: e.id, sets: keep ? cur.sets : sets, reps } : i)) }))
    toast(`เปลี่ยนเป็น ${e.th} แล้ว`)
    setSwap(null)
    setOpen(null)
  }

  return (
    <div className="page today">
      <div className="tcol">
      <header className="page-head">
        <div>
          <span className="eyebrow">{isToday ? 'วันนี้' : DAY_TH[di]} · {longDate(d)}</span>
          <h1>สวัสดี {profile.name}</h1>
        </div>
        <span className="badge l3" title="จำนวนวันต่อเนื่อง" style={{ minHeight: 32, padding: '0 12px', fontSize: '0.9375rem' }}><Rocket size={16} /> <span className="num">{sr}</span> วัน</span>
      </header>

      <nav className="week" aria-label="สัปดาห์นี้">
        {weekOf(d).map((x, i) => {
          const k = dateKey(x)
          const st = dayStatus(s, k)
          return (
            <a key={k} href={`#/today/${k}`} className={st} aria-current={k === date ? 'date' : undefined} aria-label={`${DAY_TH[i]} ${STATUS_TH[st]}`}>
              {DAY_SHORT[i]}
              <i>{st === 'done' && <Check />}</i>
            </a>
          )
        })}
      </nav>

      <SafetyBanner toast={toast} />

      {isToday && deloadDue(s, date) && (
        <section className="card col banner">
          <h2 className="row"><HeartPulse aria-hidden="true" /> ถึงเวลาสัปดาห์เบา</h2>
          <p className="mute sm">ฝึกต่อเนื่องครบ 6 สัปดาห์แล้ว ลดเหลือ 2 เซ็ตต่อท่าเป็นเวลา 7 วัน ให้ร่างกายฟื้นตัว แล้วกลับมาแรงขึ้น</p>
          <button className="btn pri sm" style={{ alignSelf: 'flex-start' }} onClick={() => { startDeload(); toast('เริ่มสัปดาห์เบา 7 วัน') }}>เริ่มสัปดาห์เบา</button>
        </section>
      )}
      {light && (
        <section className="card row between banner">
          <span className="sm"><b>สัปดาห์เบา</b> · ทุกท่าไม่เกิน 2 เซ็ต ถึง {longDate(new Date(s.deloadUntil + 'T00:00:00'))}</span>
          <button className="btn ghost sm" onClick={endDeload}>ยกเลิก</button>
        </section>
      )}

      {!train ? (
        <section className="card glow col" style={{ alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
          <BedDouble size={44} style={{ color: 'var(--info-fg)' }} aria-hidden="true" />
          <h2>วันพัก</h2>
          <p className="mute">กล้ามเนื้อโตตอนพัก นอน 7–8 ชั่วโมง ดื่มน้ำให้พอ และเดินเบาๆ 8,000–10,000 ก้าว</p>
        </section>
      ) : (
        <section className="card glow hero">
          <div className="col" style={{ gap: '0.375rem' }}>
            <span className="eyebrow">{day.name}</span>
            <h2>{day.focus}</h2>
            <p className="mute sm row" style={{ gap: '0.375rem' }}><Clock size={16} aria-hidden="true" /> ราว {minutesOf({ items })} นาที · {items.length} ท่า</p>
            {finished && <span className="badge l1" style={{ alignSelf: 'flex-start' }}><Check size={14} /> เสร็จแล้ว</span>}
            {skipped && <span className="badge" style={{ alignSelf: 'flex-start' }}><SkipForward size={14} /> ข้ามวันนี้</span>}
            {!finished && log?.startedAt && isToday && <span className="mute xs">เริ่มฝึกมาแล้ว {mins(log.startedAt, Date.now())} นาที</span>}
          </div>
          <Ring pct={pct} done={pct === 1}>
            <span className="num">{done}<span className="mute" style={{ fontSize: '1.125rem' }}>/{total}</span></span>
            <span className="mute xs">เซ็ต</span>
          </Ring>
        </section>
      )}

      {train && day.kind === 'train' && !skipped && (
        <label className="warm">
          <input type="checkbox" checked={!!log?.warm} onChange={() => toggleWarm(date)} />
          <span><b>วอร์มอัพ 5 นาที</b><span className="mute sm" style={{ display: 'block' }}>เดินเร็ว 5 นาที + เซ็ตเบาของท่าแรก 1 เซ็ต · ยกขึ้น 2 วินาที ลง 2–3 วินาที หยุดก่อนหมดแรง 1–2 ครั้ง</span></span>
        </label>
      )}

      {train && !skipped && <StopSigns profile={profile} />}

      {train && !skipped && (
        <ul className="list" aria-label="รายการท่า">
          {items.map((it, n) => (
            <ExRow
              key={`${it.id}-${n}`} it={it} ex={byId[it.id]} log={log} logs={logs} date={date}
              open={open === n} onToggle={() => setOpen(open === n ? null : n)} onInfo={() => setInfo(byId[it.id])} onSwap={() => setSwap(byId[it.id])}
              startTimer={startTimer} rest={profile.rest} profile={profile} pf={pf}
            />
          ))}
        </ul>
      )}

      {train && skipped && (
        <section className="card col">
          <p className="mute">ข้ามวันนี้แล้ว — ร่างกายต้องการพักเพิ่มก็ไม่เป็นไร ระบบไม่นับว่าพลาดและไม่ตัดสถิติต่อเนื่อง</p>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => skipDay(date, false)}><Undo2 /> กลับมาฝึกวันนี้</button>
        </section>
      )}

      {train && !skipped && (finished ? (
        <section className="card col" style={{ borderColor: 'rgba(34,197,94,.5)' }}>
          <h2 className="row"><PartyPopper style={{ color: 'var(--ok-fg)' }} aria-hidden="true" /> เยี่ยมมาก!</h2>
          <p className="mute">สรุปวันนี้: <b className="num tone-good" style={{ fontSize: '1.25rem' }}>{setsDone(log)}</b> เซ็ต
            {volumeOf(log) > 0 && <> · ปริมาณรวม <b className="num tone-good" style={{ fontSize: '1.25rem' }}>{volumeOf(log).toLocaleString()}</b> กก.</>}
            {log.startedAt && log.finishedAt && <> · ใช้เวลา <b className="num tone-good" style={{ fontSize: '1.25rem' }}>{mins(log.startedAt, log.finishedAt)}</b> นาที</>}</p>
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => finishDay(date, false)}><Undo2 /> ยกเลิกการจบ</button>
        </section>
      ) : (
        <div className="col" style={{ gap: '0.5rem' }}>
          <button className={`btn block ${pct === 1 ? 'ok' : 'pri'}`} disabled={done === 0} onClick={() => { finishDay(date); toast('บันทึกการฝึกแล้ว') }}>
            <Check /> {pct === 1 ? 'จบการฝึกวันนี้' : done ? `จบการฝึก (ทำแล้ว ${done}/${total} เซ็ต)` : 'ทำอย่างน้อย 1 เซ็ตก่อนจบ'}
          </button>
          {done === 0 && <button className="btn ghost block" onClick={() => { skipDay(date); toast('ข้ามวันนี้ พักเพิ่มได้เลย') }}><Moon /> เหนื่อยหรือไม่ว่าง — ข้ามวันนี้</button>}
        </div>
      ))}

      <MoodCard date={date} today={dateKey()} log={log} logs={logs} />

      </div>
      <FoodTracker date={date} log={log} logs={logs} profile={profile} train={day.kind === 'train' && !skipped} isToday={isToday} toast={toast} />
      <ExerciseSheet ex={info} onClose={() => setInfo(null)} toast={toast} />
      <SwapSheet ex={swap} level={profile.level} taken={day.items.map((i) => i.id)} onClose={() => setSwap(null)} onPick={doSwap} />
    </div>
  )
}
