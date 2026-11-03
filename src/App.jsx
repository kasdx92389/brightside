import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CalendarCheck, ClipboardList, LibraryBig, TrendingUp, UserRound, Plus, X } from 'lucide-react'
import { useStore, saveFailed } from './store.js'
import Onboarding from './pages/Onboarding.jsx'
import Today from './pages/Today.jsx'
import Plan from './pages/Plan.jsx'
import Library from './pages/Library.jsx'
import Progress from './pages/Progress.jsx'
import Me from './pages/Me.jsx'
import Memory from './pages/Memory.jsx'
import { ImportSheet } from './components/SharePlan.jsx'
import { JoinSync } from './components/SyncPanel.jsx'
import { startSync } from './lib/sync.js'

const NAV = [
  ['today', 'วันนี้', CalendarCheck],
  ['plan', 'แผน', ClipboardList],
  ['lib', 'คลัง', LibraryBig],
  ['progress', 'ความคืบหน้า', TrendingUp],
  ['me', 'ฉัน', UserRound],
]

const useHash = () =>
  useSyncExternalStore((f) => (addEventListener('hashchange', f), () => removeEventListener('hashchange', f)), () => location.hash)

function RestTimer({ end, label, onAdd, onStop }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id) }, [])
  const left = Math.max(0, Math.ceil((end - now) / 1000))
  useEffect(() => {
    if (left > 0) return
    navigator.vibrate?.([200, 100, 200])
    const id = setTimeout(onStop, 4000)
    return () => clearTimeout(id)
  }, [left, onStop])
  const m = Math.floor(left / 60), s = String(left % 60).padStart(2, '0')
  return (
    <div className={`timer ${left ? '' : 'end'}`} role="timer" aria-live="off">
      <span className="tlabel"><small>{label}</small><span className="num" aria-label={left ? `เหลืออีก ${left} วินาที` : 'หมดเวลา'}>{left ? `${m}:${s}` : 'หมดเวลา!'}</span></span>
      {left > 0 && <button className="btn sm" onClick={() => onAdd(15)}><Plus /> 15 วิ</button>}
      <button className="icon-btn" onClick={onStop} aria-label="ปิดตัวจับเวลา"><X /></button>
    </div>
  )
}

export default function App() {
  const { profile, plan } = useStore()
  const hash = useHash()
  const [, page = 'today', param] = hash.split('/')
  const [rest, setRest] = useState(null) // { end, label }
  const [msg, setMsg] = useState('')

  const toastT = useRef(0)
  const toast = useCallback((m) => { setMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setMsg(''), 2200) }, [])
  const startTimer = useCallback((sec, label = 'พัก') => setRest({ end: Date.now() + sec * 1000, label }), [])
  const stopRest = useCallback(() => setRest(null), [])
  useEffect(() => { if (!param || page === 'memory') scrollTo(0, 0) }, [page, param])
  useEffect(startSync, [])
  // ลิงก์เชื่อมเครื่อง #/sync/รหัส: ถามยืนยันก่อน (ใช้ได้แม้เครื่องนี้ยังไม่มีโปรไฟล์)
  const join = page === 'sync' ? <JoinSync key={param} secret={param || ''} toast={toast} onDone={() => { location.hash = '#/today' }} /> : null

  if (!profile || !plan) return <><Onboarding sharedCode={page === 'import' ? param : undefined} />{join}{msg && <div className="toast" role="status">{msg}</div>}</>

  const view = {
    today: <Today key={param} date={/^\d{4}-\d{2}-\d{2}$/.test(param) ? param : undefined} startTimer={startTimer} toast={toast} />,
    plan: <Plan toast={toast} />,
    import: <Plan toast={toast} />,
    lib: <Library openId={param} toast={toast} />,
    progress: <Progress toast={toast} />,
    memory: <Memory key={param} param={param} />,
    me: <Me toast={toast} />,
  }[page] || <Today startTimer={startTimer} toast={toast} />

  return (
    <div className="app">
      <nav className="tabbar" aria-label="เมนูหลัก">
        <div className="brand"><img src="./icon.svg" alt="" /> <span>bright<b>side</b></span></div>
        {NAV.map(([k, label, Icon]) => (
          <a key={k} className="tab" href={`#/${k}`} aria-current={page === k || (k === 'progress' && page === 'memory') ? 'page' : undefined}><Icon aria-hidden="true" />{label}</a>
        ))}
      </nav>
      {saveFailed && <div className="warnbar" role="alert">บันทึกลงเครื่องไม่ได้ (พื้นที่เต็มหรือโหมดส่วนตัว) ข้อมูลจะหายเมื่อปิดหน้านี้ — ไปหน้า “ฉัน” แล้วกด “สำรอง”</div>}
      <main>{view}</main>
      {join}
      {page === 'import' && <ImportSheet key={param} code={param || ''} onClose={() => { location.hash = '#/plan' }} toast={toast} />}
      {rest && <RestTimer end={rest.end} label={rest.label} onAdd={(s) => setRest((r) => ({ ...r, end: r.end + s * 1000 }))} onStop={stopRest} />}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  )
}
