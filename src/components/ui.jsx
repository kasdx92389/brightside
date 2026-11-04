import { useEffect, useRef } from 'react'
import { Footprints, X } from 'lucide-react'
import { imgUrl } from '../data/exercises.js'
import { BMI_BANDS, bmiBand } from '../lib/calc.js'

/** รูปท่า 2 เฟรม สลับเป็นภาพเคลื่อนไหว (ปิดอัตโนมัติเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว) */
export function Media({ ex, eager }) {
  if (!ex.db)
    return (
      <div className="media ph" role="img" aria-label={ex.th}>
        <Footprints />
      </div>
    )
  const load = eager ? 'eager' : 'lazy'
  // eager = หน้ารายละเอียดท่า: สลับ 2 เฟรมให้ดูจังหวะ · ในรายการ (แผน/วันนี้/คลัง) แสดงเฟรมแรกนิ่งๆ ไม่โหลดเฟรมที่สอง
  return (
    <div className={`media${eager ? ' anim' : ''}`}>
      <img src={imgUrl(ex, 0)} alt={`${ex.th} — ท่าเริ่มต้น`} loading={load} decoding="async" />
      {eager && <img src={imgUrl(ex, 1)} alt="" aria-hidden="true" loading={load} decoding="async" />}
    </div>
  )
}

export function Ring({ pct, children, done }) {
  const r = 45, c = 2 * Math.PI * r
  return (
    <div className={`ring ${done ? 'done' : ''}`} role="img" aria-label={`ความคืบหน้า ${Math.round(pct * 100)}%`}>
      <svg viewBox="0 0 100 100">
        <circle className="bg" cx="50" cy="50" r={r} />
        <circle className="fg" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div>{children}</div>
    </div>
  )
}

/** แถบ BMI เกณฑ์เอเชีย: ช่วง 15–35 */
export function BmiGauge({ value }) {
  const band = bmiBand(value)
  const pos = Math.min(Math.max((value - 15) / 20, 0), 1) * 100
  return (
    <div>
      <div className="gauge">
        <div className="pin" style={{ left: `${pos}%` }}>{value.toFixed(1)}</div>
        <div className="bar" aria-hidden="true">{BMI_BANDS.map((b) => <i key={b.label} />)}</div>
        <div className="ticks" aria-hidden="true"><span>15</span><span>18.5</span><span>23</span><span>25</span><span>30</span><span>35</span></div>
      </div>
      <p className="row" style={{ marginTop: '0.75rem' }}>
        <b className={`tone-${band.tone}`} style={{ fontSize: '1.125rem' }}>{band.label}</b>
        <span className="mute sm">BMI {value.toFixed(1)} · เกณฑ์เอเชีย</span>
      </p>
    </div>
  )
}

/** Bottom sheet ด้วย <dialog> แบบ native — ได้ focus trap, Esc และ backdrop ฟรี */
export function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) { d.showModal(); d.focus({ preventScroll: true }) } // โฟกัสที่กล่อง ไม่ใช่ปุ่มปิด (ไม่ให้มีกรอบฟ้าโผล่ตอนเปิด)
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" tabIndex={-1} aria-label={title} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="sheet-in">
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="ปิด"><X /></button>
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      )}
    </dialog>
  )
}

export const Field = ({ label, hint, error, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {error ? <small className="err" role="alert">{error}</small> : hint && <small className="hint">{hint}</small>}
  </label>
)

export const Seg = ({ value, onChange, options, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, text]) => (
      <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
    ))}
  </div>
)

export const Choice = ({ value, onChange, options, label }) => (
  <div className="choice" role="group" aria-label={label}>
    {options.map(([v, title, sub, Icon]) => (
      <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
        <Icon aria-hidden="true" />
        <span><b>{title}</b><span className="mute sm">{sub}</span></span>
      </button>
    ))}
  </div>
)
