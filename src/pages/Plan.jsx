import { useState } from 'react'
import { Sparkles, ClipboardList, Pencil, Trash2, Plus, Minus, ChevronDown, Check } from 'lucide-react'
import { Media, Sheet, Seg, Choice } from '../components/ui.jsx'
import { GOALS, LEVELS, EQUIPS } from '../components/ProfileForms.jsx'
import Library from './Library.jsx'
import ExerciseSheet from '../components/ExerciseSheet.jsx'
import { byId } from '../data/exercises.js'
import { PPL, generatePlan, minutesOf, itemLabel, parseRx } from '../data/plan.js'
import { DAY_TH, DAY_SHORT, dayIdx } from '../lib/calc.js'
import { useStore, setPlan, editDay } from '../store.js'

function Generator({ open, onClose, toast }) {
  const p = useStore((s) => s.profile)
  const [o, setO] = useState({ goal: p.goal, level: p.level, days: p.days, equip: p.equip })
  const set = (x) => setO((v) => ({ ...v, ...x }))
  const preview = generatePlan(o)
  return (
    <Sheet open={open} onClose={onClose} title="ออกแบบโปรแกรมให้ฉัน">
      <Choice label="เป้าหมาย" value={o.goal} onChange={(goal) => set({ goal })} options={GOALS} />
      <Choice label="ระดับ" value={o.level} onChange={(level) => set({ level })} options={LEVELS} />
      <div className="field"><span>วันที่ฝึกต่อสัปดาห์</span><Seg label="วัน" value={o.days} onChange={(days) => set({ days })} options={[[3, '3'], [4, '4'], [5, '5'], [6, '6']]} /></div>
      <Choice label="อุปกรณ์" value={o.equip} onChange={(equip) => set({ equip })} options={EQUIPS} />
      <section className="col" aria-live="polite" style={{ gap: '0.5rem' }}>
        <h3>ตัวอย่างโปรแกรม · {preview.name}</h3>
        {preview.days.map((d, i) => (
          <div key={i} className="row between sm">
            <span><b>{DAY_TH[i]}</b> · {d.name}</span>
            <span className="mute">{d.kind === 'train' ? `${d.items.length} ท่า · ${minutesOf(d)} นาที` : d.kind === 'walk' ? 'เดินเร็ว' : 'พัก'}</span>
          </div>
        ))}
      </section>
      <button className="btn pri block" onClick={() => { setPlan(preview); onClose(); toast('ใช้โปรแกรมใหม่แล้ว') }}><Check /> ใช้โปรแกรมนี้</button>
      <p className="hint">การใช้โปรแกรมใหม่จะแทนที่ตารางปัจจุบัน แต่บันทึกการฝึกที่ผ่านมายังอยู่ครบ</p>
    </Sheet>
  )
}

export default function Plan({ toast }) {
  const plan = useStore((s) => s.plan)
  const [gen, setGen] = useState(false)
  const [edit, setEdit] = useState(false)
  const [pick, setPick] = useState(null) // วันที่กำลังเพิ่มท่า
  const [info, setInfo] = useState(null)
  const today = dayIdx()

  const patchItem = (di, k, patch) => editDay(di, (d) => ({ ...d, items: d.items.map((it, n) => (n === k ? { ...it, ...patch } : it)) }))
  const removeItem = (di, k) => editDay(di, (d) => ({ ...d, items: d.items.filter((_, n) => n !== k) }))
  const addEx = (e) => {
    const [sets, reps] = parseRx(e.rx)
    editDay(pick, (d) => ({ ...d, kind: 'train', name: d.kind === 'train' ? d.name : 'ฝึกเพิ่ม', focus: d.kind === 'train' ? d.focus : 'ฝึกเพิ่มเติม', items: [...d.items.filter((i) => i.id !== e.id), { id: e.id, sets, reps }] }))
    toast(`เพิ่ม ${e.th} แล้ว`)
    setPick(null)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div><span className="eyebrow">โปรแกรมปัจจุบัน</span><h1>{plan.name}</h1></div>
        <button className={`btn sm ${edit ? 'pri' : ''}`} onClick={() => setEdit(!edit)} aria-pressed={edit}><Pencil /> {edit ? 'เสร็จ' : 'แก้ไข'}</button>
      </header>

      <div className="two">
        <button className="btn pri" onClick={() => setGen(true)}><Sparkles /> ออกแบบให้</button>
        <button className="btn" onClick={() => { setPlan(PPL); toast('กลับไปใช้ตาราง PPL 5 วัน') }}><ClipboardList /> PPL 5 วัน</button>
      </div>

      <div className="col">
        {plan.days.map((d, di) => (
          <details key={di} className={`day ${di === today ? 'today' : ''}`} open={di === today}>
            <summary>
              <span className="dayno">{DAY_SHORT[di]}</span>
              <span className="grow"><b>{d.name}</b><span className="mute sm" style={{ display: 'block' }}>{d.focus}{d.kind === 'train' && ` · ${minutesOf(d)} นาที`}</span></span>
              <ChevronDown className="chev" aria-hidden="true" />
            </summary>
            <div className="day-body">
              {d.items.map((it, k) => {
                const ex = byId[it.id]
                if (!ex) return null
                return (
                  <div className="pi" key={`${it.id}-${k}`}>
                    <Media ex={ex} />
                    <button className="grow" style={{ textAlign: 'left' }} onClick={() => setInfo(ex)}>
                      <b>{ex.th}</b>
                      {!edit && <span className="mute sm" style={{ display: 'block' }}>{itemLabel(it)}</span>}
                    </button>
                    {edit ? (
                      <div className="pi-edit">
                        <button className="icon-btn" aria-label="ลดเซ็ต" onClick={() => patchItem(di, k, { sets: Math.max(1, it.sets - 1) })}><Minus /></button>
                        <span className="num" style={{ fontSize: '1.25rem' }} aria-label={`${it.sets} เซ็ต`}>{it.sets}</span>
                        <button className="icon-btn" aria-label="เพิ่มเซ็ต" onClick={() => patchItem(di, k, { sets: Math.min(10, it.sets + 1) })}><Plus /></button>
                        <input className="input" aria-label="จำนวนครั้ง" value={it.reps} onChange={(e) => patchItem(di, k, { reps: e.target.value })} />
                        <button className="icon-btn" aria-label={`ลบ ${ex.th}`} onClick={() => removeItem(di, k)}><Trash2 style={{ color: 'var(--bad-fg)' }} /></button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {!d.items.length && <p className="mute sm">วันพักผ่อน ไม่มีท่า</p>}
              {edit && <button className="btn sm" onClick={() => setPick(di)}><Plus /> เพิ่มท่า</button>}
            </div>
          </details>
        ))}
      </div>

      <ExerciseSheet ex={info} onClose={() => setInfo(null)} toast={toast} />
      <Generator key={String(gen)} open={gen} onClose={() => setGen(false)} toast={toast} />
      <Sheet open={pick !== null} onClose={() => setPick(null)} title={`เพิ่มท่าใน${pick !== null ? DAY_TH[pick] : ''}`}>
        {pick !== null && <Library onPick={addEx} />}
      </Sheet>
    </div>
  )
}
