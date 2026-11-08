import { useState } from 'react'
import { BookHeart, Flame, CalendarCheck, Scale, Trophy, Plus, Activity, Ruler, Medal, Lock, Target } from 'lucide-react'
import { byId } from '../data/exercises.js'
import { foodById } from '../data/foods.js'
import { itemSodium } from '../data/sodium.js'
import { itemSugar, itemSugarTotal } from '../data/sugar.js'
import { bmi, bmiBand, dateKey, dayIdx, targets } from '../lib/calc.js'
import { addDays, daysBetween, goalProgress } from '../lib/coach.js'
import {
  useStore, addWeight, addMeasure, dayStatus, streak, personalBests, volumeOf, setsDone, weekStats, getAchievements, finishedDates, waterGoal,
} from '../store.js'
import { Field } from '../components/ui.jsx'
import ReviewCard from '../components/ReviewCard.jsx'
import { moodOf } from '../lib/mood.js'
import { MoodFace } from '../components/Mood.jsx'

const short = (k) => new Date(k + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const sign = (n) => (n > 0 ? '+' : '') + n
const ST_TH = { done: 'ฝึกแล้ว', miss: 'พลาด', rest: 'วันพัก', skip: 'ข้ามวัน', todo: 'ยังไม่ถึง', pre: 'ก่อนเริ่มใช้แอพ' }
const MEASURES = [['waist', 'รอบเอว'], ['arm', 'รอบแขน'], ['chest', 'รอบอก'], ['hip', 'รอบสะโพก']]

function WeightChart({ data, target }) {
  if (data.length < 2) return <p className="mute">บันทึกน้ำหนักอย่างน้อย 2 ครั้งเพื่อดูกราฟแนวโน้ม</p>
  const W = 320, H = 150, px = 8, top = 12, bot = 26
  const ks = data.map((d) => d.kg).concat(target ? [target] : [])
  const lo = Math.floor(Math.min(...ks) - 0.5), hi = Math.ceil(Math.max(...ks) + 0.5)
  const x = (i) => px + (i / (data.length - 1)) * (W - px * 2 - 24)
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bot)
  const pts = data.map((d, i) => [x(i), y(d.kg)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
  const last = pts.at(-1)
  const delta = (data.at(-1).kg - data[0].kg).toFixed(1)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`กราฟน้ำหนัก ${data.length} ครั้ง จาก ${data[0].kg} เป็น ${data.at(-1).kg} กก. เปลี่ยน ${delta} กก.${target ? ` เป้าหมาย ${target} กก.` : ''}`}>
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7a1a" stopOpacity=".3" /><stop offset="1" stopColor="#ff7a1a" stopOpacity="0" /></linearGradient></defs>
      {[lo, (lo + hi) / 2, hi].map((v) => <g key={v}><line className="grid" x1={px} x2={W - 24} y1={y(v)} y2={y(v)} /><text x={W - 20} y={y(v) + 4}>{v % 1 ? v.toFixed(1) : v}</text></g>)}
      {target && <g><line className="goal" x1={px} x2={W - 24} y1={y(target)} y2={y(target)} /><text className="goal-t" x={W - 20} y={y(target) + 4}>เป้า</text></g>}
      <path className="area" d={`${line}L${last[0]} ${H - bot}L${pts[0][0]} ${H - bot}Z`} />
      <path className="ln" d={line} />
      <circle cx={last[0]} cy={last[1]} r="5" />
      <text x={px} y={H - 6}>{short(data[0].date)}</text>
      <text x={W - 24} y={H - 6} textAnchor="end">{short(data.at(-1).date)}</text>
    </svg>
  )
}

function Delta({ now, before, unit, good }) {
  const d = Math.round((now - before) * 10) / 10
  if (!before && !now) return <span className="mute">–</span>
  const tone = d === 0 ? 'mute' : (good === 'up' ? d > 0 : d < 0) ? 'tone-good' : 'tone-warn'
  return <span className={tone}>{d > 0 ? '+' : ''}{d.toLocaleString()}{unit}</span>
}

export default function Progress({ toast }) {
  const s = useStore()
  const { profile, plan, logs, weights, measures } = s
  const [kg, setKg] = useState('')
  const [err, setErr] = useState('')
  const [m, setM] = useState({ waist: '', arm: '', chest: '', hip: '' })
  const [merr, setMerr] = useState('')

  const today = dateKey()
  const monday = addDays(today, -dayIdx())
  const cells = Array.from({ length: 84 }, (_, i) => addDays(monday, i - 77))
  const doneWeek = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((k) => dayStatus(s, k) === 'done').length
  const planned = plan.days.filter((d) => d.kind === 'train').length
  const finished = finishedDates(s).reverse()
  const pbs = personalBests(logs).slice(0, 6)
  const b = bmi(profile.weight, profile.height)
  const wk = weekStats(s, monday)
  const prev = weekStats(s, addDays(monday, -7))
  const gp = goalProgress(weights, profile.target)
  const medals = getAchievements(s)
  const lastMeasure = measures.at(-1)
  // โภชนาการ 7 วันล่าสุด: เฉลี่ยเฉพาะวันที่บันทึกอาหาร
  const nt = targets(profile)
  const week7 = Array.from({ length: 7 }, (_, i) => logs[addDays(today, -i)]?.food || {})
  const fed = week7.filter((x) => x.kcal > 0)
  const avg = (k) => (fed.length ? Math.round(fed.reduce((n, x) => n + (Number(x[k]) || 0), 0) / fed.length) : 0)
  const daySodium = (x) => (x.items || []).reduce((n, it) => n + itemSodium(it, foodById), 0)
  const avgNa = fed.length ? Math.round(fed.reduce((n, x) => n + daySodium(x), 0) / fed.length) : 0
  const avgSu = fed.length ? Math.round((fed.reduce((n, x) => n + (x.items || []).reduce((m, it) => m + itemSugar(it, foodById), 0), 0) / fed.length) * 10) / 10 : 0
  const avgSg = fed.length ? Math.round((fed.reduce((n, x) => n + (x.items || []).reduce((m, it) => m + itemSugarTotal(it, foodById), 0), 0) / fed.length) * 10) / 10 : 0
  const waterOk = week7.filter((x) => (x.water || 0) >= waterGoal(profile)).length
  const NROWS = [['พลังงาน (kcal)', 'kcal', nt.kcal], ['โปรตีน (g)', 'protein', Math.round((nt.protein[0] + nt.protein[1]) / 2)], ['คาร์บ (g)', 'carb', nt.carb], ['ไขมัน (g)', 'fat', nt.fat]]

  const submitWeight = (e) => {
    e.preventDefault()
    const n = Number(kg)
    if (!(n >= 30 && n <= 250)) return setErr('น้ำหนัก 30–250 กก.')
    setErr(''); addWeight(n); setKg('')
  }
  const submitMeasure = (e) => {
    e.preventDefault()
    const vals = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
    if (!Object.keys(vals).length) return setMerr('ใส่อย่างน้อย 1 ค่า')
    if (Object.values(vals).some((v) => !(v >= 10 && v <= 250))) return setMerr('ค่าต้องอยู่ระหว่าง 10–250 ซม.')
    setMerr(''); addMeasure({ ...lastMeasure && Object.fromEntries(MEASURES.map(([k]) => [k, lastMeasure[k]])), ...vals }); setM({ waist: '', arm: '', chest: '', hip: '' })
  }

  return (
    <div className="page dash">
      <header className="page-head"><div><span className="eyebrow">ภาพรวม</span><h1>ความคืบหน้า</h1></div></header>

      <div className="stats">
        <div className="stat"><CalendarCheck aria-hidden="true" /><span className="num">{doneWeek}<small>/{planned} วัน</small></span><small>สัปดาห์นี้</small></div>
        <div className="stat"><Flame aria-hidden="true" /><span className="num">{streak(s)}</span><small>วันต่อเนื่อง</small></div>
        <div className="stat"><Activity aria-hidden="true" /><span className="num">{finished.length}</span><small>ครั้งที่ฝึกทั้งหมด</small></div>
        <div className="stat"><Scale aria-hidden="true" /><span className="num">{b.toFixed(1)}</span><small>BMI · {bmiBand(b).label}</small></div>
      </div>

      <div className="masonry">
      <ReviewCard s={s} today={today} toast={toast} />

      <section className="card col">
        <h2>สัปดาห์นี้เทียบสัปดาห์ก่อน</h2>
        <table className="tbl grid"><thead><tr><th></th><th>สัปดาห์นี้</th><th>ก่อนหน้า</th><th>ต่าง</th></tr></thead><tbody>
          <tr><td>ครั้งที่ฝึก</td><td className="num">{wk.workouts}</td><td className="num">{prev.workouts}</td><td><Delta now={wk.workouts} before={prev.workouts} unit="" good="up" /></td></tr>
          <tr><td>เซ็ตรวม</td><td className="num">{wk.sets}</td><td className="num">{prev.sets}</td><td><Delta now={wk.sets} before={prev.sets} unit="" good="up" /></td></tr>
          <tr><td>ปริมาณ (กก.)</td><td className="num">{wk.volume.toLocaleString()}</td><td className="num">{prev.volume.toLocaleString()}</td><td><Delta now={wk.volume} before={prev.volume} unit="" good="up" /></td></tr>
        </tbody></table>
      </section>

      <section className="card col">
        <div className="row between"><h2>น้ำหนัก</h2><span className="num" style={{ fontSize: '1.5rem' }}>{profile.weight} <small className="mute">กก.</small></span></div>
        {gp && (
          <div className="col" style={{ gap: '0.375rem' }}>
            <div className="row between sm"><span className="row" style={{ gap: '0.375rem' }}><Target size={16} aria-hidden="true" /> เป้าหมาย {profile.target} กก.</span><b>{gp.left ? `เหลืออีก ${gp.left} กก.` : 'ถึงเป้าหมายแล้ว'}</b></div>
            <div className="bar" role="progressbar" aria-label="ความคืบหน้าสู่น้ำหนักเป้าหมาย" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(gp.pct * 100)}><i style={{ width: `${gp.pct * 100}%` }} className={gp.pct >= 1 ? 'full' : ''} /></div>
          </div>
        )}
        <WeightChart data={weights.slice(-30)} target={profile.target} />
        <form className="row" onSubmit={submitWeight} style={{ alignItems: 'flex-start' }}>
          <div className="grow"><Field label="บันทึกน้ำหนักวันนี้ (กก.)" error={err}>
            <input className="input" type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={String(profile.weight)} aria-invalid={!!err} />
          </Field></div>
          <button className="btn pri" style={{ marginTop: '1.65rem' }}><Plus /> บันทึก</button>
        </form>
        <p className="hint">ชั่งสัปดาห์ละครั้งตอนเช้า หลังเข้าห้องน้ำ เพื่อให้ตัวเลขเทียบกันได้ {!profile.target && 'ตั้งน้ำหนักเป้าหมายได้ที่หน้า “ฉัน”'}</p>
      </section>

      <section className="card col">
        <h2 className="row"><Ruler aria-hidden="true" /> สัดส่วนร่างกาย</h2>
        {(!lastMeasure || daysBetween(lastMeasure.date, today) >= 14) && <p className="nudge">{lastMeasure ? 'ครบ 2 สัปดาห์แล้ว วัดอีกครั้งได้เลย' : 'วัดรอบเอว (ระดับสะดือ) และรอบแขนทุก 2 สัปดาห์ — ถ้ารอบเอวลดแต่น้ำหนักนิ่ง แปลว่าไขมันลดและกล้ามเนื้อเพิ่ม'}</p>}
        {measures.length > 0 && (
          <table className="tbl grid"><thead><tr><th>วันที่</th>{MEASURES.map(([, t]) => <th key={t} style={{ textAlign: 'right' }}>{t.replace('รอบ', '')}</th>)}</tr></thead><tbody>
            {measures.slice(-4).reverse().map((r, i, arr) => {
              const p = arr[i + 1]
              return <tr key={r.date}><td>{short(r.date)}</td>{MEASURES.map(([k]) => <td key={k} style={{ textAlign: 'right' }}>{r[k] ?? '–'}{p && r[k] != null && p[k] != null && r[k] !== p[k] && <small className={r[k] < p[k] ? 'tone-good' : 'tone-warn'}><br />{sign(Math.round((r[k] - p[k]) * 10) / 10)}</small>}</td>)}</tr>
            })}
          </tbody></table>
        )}
        <form className="col" onSubmit={submitMeasure}>
          <div className="two">
            {MEASURES.map(([k, t]) => (
              <Field key={k} label={`${t} (ซม.)`}>
                <input className="input" type="number" inputMode="decimal" step="0.1" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} placeholder={lastMeasure?.[k] ? String(lastMeasure[k]) : '–'} />
              </Field>
            ))}
          </div>
          {merr && <small className="err" role="alert">{merr}</small>}
          <button className="btn block"><Plus /> บันทึกสัดส่วน</button>
        </form>
      </section>

      <section className="card col">
        <h2>อาหารและน้ำ 7 วันล่าสุด</h2>
        {fed.length ? (
          <table className="tbl grid"><thead><tr><th></th><th>เฉลี่ย</th><th>เป้า</th><th>ต่าง</th></tr></thead><tbody>
            {NROWS.map(([label, k, goal]) => {
              const v = avg(k), pct = goal ? (v - goal) / goal : 0
              return <tr key={k}><td>{label}</td><td className="num">{v.toLocaleString()}</td><td className="num">{goal.toLocaleString()}</td><td className={Math.abs(pct) <= 0.1 ? 'tone-good' : 'tone-warn'}>{sign(Math.round(pct * 100))}%</td></tr>
            })}
            <tr><td>น้ำตาลทั้งหมด (g)</td><td className="num">{avgSg}</td><td className="num">–</td><td className="mute">ไม่มีเป้า</td></tr>
            <tr><td>น้ำตาลเติม (g)</td><td className="num">{avgSu}</td><td className="num">{nt.sugar}</td><td className={avgSu <= nt.sugar ? 'tone-good' : 'tone-warn'}>{avgSu <= nt.sugar ? 'ไม่เกิน' : `เกิน ${sign(Math.round(((avgSu - nt.sugar) / nt.sugar) * 100))}%`}</td></tr>
            <tr><td>โซเดียม (มก.)</td><td className="num">{avgNa.toLocaleString()}</td><td className="num">{nt.sodium.toLocaleString()}</td><td className={avgNa <= nt.sodium ? 'tone-good' : 'tone-warn'}>{avgNa <= nt.sodium ? 'ไม่เกิน' : `เกิน ${sign(Math.round(((avgNa - nt.sodium) / nt.sodium) * 100))}%`}</td></tr>
          </tbody></table>
        ) : <p className="mute">ยังไม่มีบันทึกอาหาร ไปหน้า “วันนี้” แล้วแตะเลือกอาหารที่กิน ระบบจะสรุปให้ว่าตรงเป้าหรือไม่</p>}
        <p className="hint">บันทึกอาหาร {fed.length}/7 วัน · ดื่มน้ำถึงเป้า {waterOk}/7 วัน{fed.length > 0 && fed.length < 3 ? ' · บันทึกอย่างน้อย 3 วันเพื่อให้ค่าเฉลี่ยแม่นขึ้น' : ''} · ตรงเป้า = ต่างไม่เกิน ±10% (น้ำตาลเติมและโซเดียม = ไม่เกินเป้าคือดี ค่าประมาณจากเมนู)</p>
      </section>

      <section className="card col">
        <h2 className="row"><Medal aria-hidden="true" /> เหรียญรางวัล <span className="mute sm">{medals.filter((x) => x.done).length}/{medals.length}</span></h2>
        <ul className="medals">
          {medals.map((a) => (
            <li key={a.id} className={a.done ? 'got' : ''}>
              <span className="mi">{a.done ? <Medal aria-hidden="true" /> : <Lock aria-hidden="true" />}</span>
              <b>{a.title}</b>
              <span className="mute xs">{a.desc}</span>
              <span className="mute xs num">{a.done ? 'สำเร็จ' : `${Math.round(a.value * 10) / 10}/${a.goal}`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card col">
        <h2>ปฏิทิน 12 สัปดาห์</h2>
        <div className="heat" role="group" aria-label={`ปฏิทินการฝึก 12 สัปดาห์ ฝึกแล้ว ${finished.length} วัน แตะวันที่เพื่อเปิดความทรงจำของวันนั้น`}>
          {cells.map((k) => {
            if (k > today) return <i key={k} aria-hidden="true" />
            const st = dayStatus(s, k), mo = moodOf(logs[k])
            return (
              <a key={k} href={`#/memory/${k}`} className={`${st === 'done' ? 'done' : st === 'miss' ? 'miss' : ''} ${k === today ? 'today' : ''}`} aria-label={`${short(k)} ${ST_TH[st]}${mo ? ' · ' + mo.th : ''}`} aria-current={k === today ? 'date' : undefined}>
                {mo && <MoodFace id={mo.id} />}
              </a>
            )
          })}
        </div>
        <div className="legend"><span><i className="d" /> ฝึกแล้ว</span><span><i className="m" /> พลาด</span><span><i /> พัก/ข้าม/ยังไม่ถึง</span><span><i className="dot" /> หน้ายิ้ม = อารมณ์ที่บันทึก</span></div>
        <p className="hint">แตะวันที่ใดก็ได้เพื่อดูความทรงจำ — อารมณ์และข้อความที่เคยเขียนไว้ (หรือบันทึกย้อนหลัง)</p>
        <a className="btn block" href="#/memory"><BookHeart /> เปิดความทรงจำทั้งเดือน</a>
      </section>

      <section className="card col">
        <h2 className="row"><Trophy style={{ color: 'var(--warn-fg)' }} aria-hidden="true" /> น้ำหนักสูงสุดต่อท่า</h2>
        {pbs.length ? (
          <table className="tbl"><thead><tr><th>ท่า</th><th>สูงสุด</th></tr></thead><tbody>
            {pbs.map(([id, r]) => <tr key={id}><td><a href={`#/lib/${id}`} style={{ color: 'inherit' }}>{byId[id].th}</a><br /><span className="mute xs">{short(r.date)}</span></td><td><b className="num" style={{ fontSize: '1.25rem' }}>{r.kg}</b> กก. × {r.reps || '–'}</td></tr>)}
          </tbody></table>
        ) : <p className="mute">จดน้ำหนักที่ใช้ในแต่ละท่าตอนฝึก แล้วสถิติจะขึ้นที่นี่ — ตัวชี้วัดที่ชัดที่สุดว่ากำลังแข็งแรงขึ้น</p>}
      </section>

      <section className="card col">
        <h2>การฝึกล่าสุด</h2>
        {finished.length ? (
          <table className="tbl"><tbody>
            {finished.slice(0, 8).map((d) => {
              const l = logs[d]
              return <tr key={d}><td><a href={`#/today/${d}`} style={{ color: 'inherit' }}><b>{plan.days[dayIdx(new Date(d + 'T00:00:00'))].name}</b></a><br /><span className="mute xs">{short(d)} · แตะเพื่อดู/แก้ไข</span></td><td>{setsDone(l)} เซ็ต{volumeOf(l) > 0 && <><br /><span className="mute xs">{volumeOf(l).toLocaleString()} กก.</span></>}</td></tr>
            })}
          </tbody></table>
        ) : <p className="mute">ยังไม่มีบันทึก — ไปหน้า “วันนี้” แล้วเริ่มเซ็ตแรกได้เลย</p>}
      </section>
      </div>
    </div>
  )
}
