import { useEffect, useRef, useState } from 'react'
import { Trash2, Heart, BookHeart, ChevronRight, Check } from 'lucide-react'
import { MOODS, MOOD_BY, NOTE_MAX, moodOf, isLow, isHigh, pastEncouragement, kindLine, sustainedLow } from '../lib/mood.js'
import { setMood, getState } from '../store.js'

// ───── ตัวหน้ายิ้มแบบก้อนสีวาดมือ (SVG วาดเอง ไม่ใช้อีโมจิของระบบ → หน้าตาเหมือนกันทุกเครื่อง) ─────
const INK = '#2b2833'
const S = (d, w = 4) => <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
const D = (x, y, r = 3.8) => <circle cx={x} cy={y} r={r} fill={INK} />
const CHEEK = (x, y, c = '#e86f7a') => <circle cx={x} cy={y} r="7" fill={c} opacity=".45" />

const FACES = {
  joy: <>{D(36, 45)}{S('M57 48 Q64 38 71 48')}{S('M31 60 Q50 82 69 60')}</>,
  proud: <>{S('M29 47 Q36 38 43 47')}{S('M57 47 Q64 38 71 47')}{S('M38 62 Q50 74 62 62')}{CHEEK(25, 58)}{CHEEK(75, 58)}</>,
  happy: <>{D(36, 46)}{D(64, 46)}{S('M35 60 Q50 74 65 60')}</>,
  love: <>{D(36, 46)}{D(64, 46)}{CHEEK(26, 59)}{CHEEK(74, 59)}{S('M43 63 Q50 70 57 63')}</>,
  calm: <>{D(37, 46)}{D(63, 46)}{S('M41 64 Q50 70 59 64', 4.5)}</>,
  meh: <>{D(37, 46, 3.4)}{D(63, 46, 3.4)}{S('M50 51 L50 60', 3.4)}{S('M44 70 L56 70', 3.6)}</>,
  tired: <>{S('M29 47 L42 47')}{S('M58 47 L71 47')}{S('M42 68 L58 68')}</>,
  sad: <>{D(37, 47)}{D(63, 47)}{CHEEK(27, 58, '#5f86b8')}{CHEEK(73, 58, '#5f86b8')}{S('M38 71 Q50 60 62 71')}</>,
  cry: <>{D(37, 46)}{D(63, 46)}<path d="M66 52 Q72 60 66 66 Q60 60 66 52Z" fill="#d8ebff" />{S('M38 73 Q50 61 62 73')}</>,
  angry: <>{S('M29 36 L45 43')}{S('M71 36 L55 43')}{D(38, 52)}{D(62, 52)}{S('M40 72 Q50 63 60 72')}</>,
}
const BLOBS = [
  'M50 5C75 3 96 23 95 49C94 77 75 96 48 95C22 94 4 75 5 49C6 23 27 7 50 5Z',
  'M52 4C78 8 94 28 93 52C92 78 72 95 46 94C21 93 6 72 7 47C8 22 28 2 52 4Z',
  'M48 6C74 5 95 26 94 50C93 74 76 94 50 94C24 94 6 76 6 50C6 26 24 7 48 6Z',
]

export function MoodFace({ id, size, label }) {
  const m = MOOD_BY[id]
  if (!m) return null
  const i = MOODS.indexOf(m)
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'} focusable="false" className={size ? undefined : 'mf'}>
      <g transform={`rotate(${((i * 37) % 9) - 4} 50 50)`}><path d={BLOBS[i % 3]} fill={m.c} /></g>
      {FACES[id]}
    </svg>
  )
}

/** ตัวเลือกอารมณ์ — radiogroup ใช้ลูกศรซ้าย/ขวา/ขึ้น/ลงเลื่อนเลือกได้ */
export function MoodPicker({ value, onPick, label }) {
  const refs = useRef([])
  const move = (i, e) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!k) return
    e.preventDefault()
    const n = (i + k + MOODS.length) % MOODS.length
    refs.current[n]?.focus(); onPick(MOODS[n].id)
  }
  const tabbable = MOODS.findIndex((m) => m.id === value)
  return (
    <div className="moods" role="radiogroup" aria-label={label}>
      {MOODS.map((m, i) => (
        <button key={m.id} ref={(el) => (refs.current[i] = el)} type="button" role="radio" aria-checked={value === m.id} tabIndex={i === (tabbable < 0 ? 0 : tabbable) ? 0 : -1} className="mood" style={{ '--mc': m.c }} onClick={() => onPick(m.id)} onKeyDown={(e) => move(i, e)}>
          <MoodFace id={m.id} /><span>{m.th}</span>
        </button>
      ))}
    </div>
  )
}

const longTh = (k) => new Date(k + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

const PLACEHOLDER = (m) => (isHigh(m) ? 'อะไรทำให้วันนี้ดี? จดไว้ให้ตัวเองอ่านในวันที่เหนื่อย' : isLow(m) ? 'เกิดอะไรขึ้นบ้าง? ระบายได้เลย หรือเขียนประโยคให้กำลังใจตัวเอง' : 'วันนี้เจออะไรมาบ้าง? จะเขียนหรือไม่เขียนก็ได้')

/** การ์ดบันทึกอารมณ์ของวัน (ใช้ทั้งหน้า "วันนี้" และหน้า "ความทรงจำ") */
export function MoodCard({ date, today, log, logs, title, showKind = true }) {
  const cur = moodOf(log)
  const stored = log?.mood?.note || ''
  const [note, setNote] = useState(stored)
  const [ask, setAsk] = useState(false)
  const [saved, setSaved] = useState(false)
  const t = useRef(0), ft = useRef(0)
  const noteRef = useRef(stored) // ข้อความล่าสุดที่พิมพ์ (ใช้ตอนออกจากหน้า/เปลี่ยนวัน ที่ state อาจยังไม่ถูกบันทึก)
  useEffect(() => {
    noteRef.current = log?.mood?.note || ''
    setNote(noteRef.current); setAsk(false)
    return () => { // ออก/เปลี่ยนวันตอนยังพิมพ์ค้าง → บันทึกให้ก่อน (date ในที่นี้คือวันเดิม)
      clearTimeout(t.current)
      const cl = getState().logs[date]
      if (cl?.mood && noteRef.current.trim() !== (cl.mood.note || '')) setMood(date, { note: noteRef.current })
    }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const flash = () => { setSaved(true); clearTimeout(ft.current); ft.current = setTimeout(() => setSaved(false), 1500) }
  const edit = (v) => {
    setNote(v); noteRef.current = v
    clearTimeout(t.current)
    t.current = setTimeout(() => { setMood(date, { note: v }); flash() }, 700)
  }
  const commit = () => { clearTimeout(t.current); if (cur && note.trim() !== stored) { setMood(date, { note }); flash() } }
  const save = () => { clearTimeout(t.current); if (cur && note.trim() !== stored) setMood(date, { note }); flash() } // กดบันทึกเอง: บันทึกทันทีและแสดงผล
  const pick = (id) => { setMood(date, { m: id }); setAsk(false) }
  const enc = isLow(cur) ? pastEncouragement(logs, date, today) : null
  const isToday = date === today

  return (
    <section className="card col mood-card" aria-label="บันทึกอารมณ์">
      <div className="row between">
        <h2 className="row" style={{ gap: '0.5rem' }}><BookHeart aria-hidden="true" /> {title || (isToday ? 'วันนี้รู้สึกยังไงบ้าง' : `${longTh(date)} รู้สึกยังไงบ้าง`)}</h2>
        <a className="mem-link" href={`#/memory/${date}`}>ความทรงจำ <ChevronRight size={16} aria-hidden="true" /></a>
      </div>
      {!cur && <p className="mute sm">เลือกหน้าที่ตรงกับวันนั้น แล้วเขียนสั้นๆ ก็ได้ ไม่เขียนก็ได้ — เก็บไว้ให้ตัวเองย้อนอ่านภายหลัง</p>}
      <MoodPicker value={cur?.id} onPick={pick} label="เลือกอารมณ์ของวัน" />
      {cur && (
        <div className="col" style={{ gap: '0.5rem' }}>
          <label className="col" style={{ gap: '0.25rem' }}>
            <span className="sm"><b>{cur.th}</b> <span className="mute">· เล่าสั้นๆ ได้เลย</span></span>
            <textarea className="input note-in" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => edit(e.target.value)} onBlur={commit} placeholder={PLACEHOLDER(cur)} />
          </label>
          <div className="row between xs mute">
            <span aria-live="polite">{saved ? 'บันทึกแล้ว ✓' : 'บันทึกอัตโนมัติ'}</span>
            <span className="num">{note.length}/{NOTE_MAX}</span>
          </div>
          {showKind && isLow(cur) && (
            <div className="kind">
              <Heart size={18} aria-hidden="true" />
              <div className="col" style={{ gap: '0.25rem' }}>
                {enc ? <><span className="sm"><b>ข้อความจากตัวคุณเมื่อ {longTh(enc.date)}</b> <span className="mute">({enc.mood.th})</span></span><q className="enc">{enc.note}</q></> : <span className="sm">{kindLine(date)}</span>}
              </div>
            </div>
          )}
          {isToday && sustainedLow(logs, today) && (
            <p className="hint">หลายวันที่ผ่านมาคุณรู้สึกไม่ค่อยดี ลองพักและคุยกับคนใกล้ชิด ถ้าหนักใจต่อเนื่อง หรือมีความคิดทำร้ายตัวเอง โทรสายด่วนสุขภาพจิต <a href="tel:1323">1323</a> (กรมสุขภาพจิต) ได้ตลอด 24 ชั่วโมง</p>
          )}
          <div className="row between mood-actions">
            {ask ? (
              <>
                <button type="button" className="btn sm danger" onClick={() => { clearTimeout(t.current); setMood(date, { m: null }); setNote(''); setAsk(false) }}><Trash2 /> ยืนยันลบ</button>
                <button type="button" className="btn ghost sm" onClick={() => setAsk(false)}>ไม่ลบ</button>
              </>
            ) : (
              <>
                <button type="button" className="btn ghost sm" onClick={() => setAsk(true)}><Trash2 /> ลบบันทึกนี้</button>
                <button type="button" className="btn pri sm" onClick={save}><Check /> {saved ? 'บันทึกแล้ว' : 'บันทึก'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
