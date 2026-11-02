import { useEffect, useState } from 'react'
import { Share2, Copy, Download } from 'lucide-react'
import { Sheet } from './ui.jsx'
import { byId } from '../data/exercises.js'
import { DAY_SHORT } from '../lib/calc.js'
import { setPlan } from '../store.js'
import { encodePlan, decodePlan, planId, shareUrl } from '../lib/share.js'

const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true } catch { return false } }

/** ส่งแผนให้เพื่อน: ลิงก์เดียวที่มีแผนอยู่ข้างใน ไม่ต้องมีเซิร์ฟเวอร์ */
export function ShareSheet({ plan, open, onClose, toast }) {
  const [url, setUrl] = useState('')
  useEffect(() => { if (open) encodePlan(plan).then((c) => setUrl(shareUrl(c))) }, [open, plan])
  const id = planId(plan)
  const text = `แผนซ้อม "${plan.name}" (${id})\n${url}`
  const send = async () => {
    if (navigator.share) { try { await navigator.share({ title: plan.name, text: `แผนซ้อม "${plan.name}" (${id})`, url }) } catch { /* ยกเลิกเอง */ } return }
    toast((await copy(text)) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่ได้ กดค้างที่ลิงก์เพื่อคัดลอก')
  }
  return (
    <Sheet open={open} onClose={onClose} title="แชร์แผนให้เพื่อน">
      <p className="row wrap" style={{ gap: '0.5rem' }}><b>{plan.name}</b> <span className="badge">รหัสแผน {id}</span></p>
      <p className="hint">เพื่อนกดลิงก์แล้วจะเห็นตัวอย่างแผนและเลือกใช้ได้เลย ไม่ต้องสมัครอะไร ส่งเฉพาะตารางฝึก ไม่รวมประวัติ น้ำหนัก หรือข้อมูลส่วนตัวของคุณ รหัสแผนคำนวณจากเนื้อหา ถ้าเพื่อนเห็นรหัสตรงกับของคุณแปลว่าเป็นแผนเดียวกัน</p>
      <textarea className="input" readOnly rows={4} value={url} onFocus={(e) => e.target.select()} aria-label="ลิงก์แผน" style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', wordBreak: 'break-all' }} />
      <div className="row pair">
        <button className="btn pri grow" disabled={!url} onClick={send}><Share2 /> {navigator.share ? 'แชร์' : 'คัดลอกลิงก์'}</button>
        {navigator.share && <button className="btn grow-0" disabled={!url} aria-label="คัดลอกลิงก์" onClick={async () => toast((await copy(text)) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่ได้')}><Copy /></button>}
      </div>
    </Sheet>
  )
}

/** รับแผนจากเพื่อน: เปิดจากลิงก์ (#/import/รหัส) หรือวางรหัส/ลิงก์เอง · ดูตัวอย่างก่อนใช้ */
export function ImportSheet({ code = '', onClose, toast }) {
  const [text, setText] = useState(code)
  const [res, setRes] = useState(null) // { plan } | { err }
  useEffect(() => {
    if (!text.trim()) { setRes(null); return }
    let live = true
    decodePlan(text).then((plan) => live && setRes({ plan }), (e) => live && setRes({ err: e.message }))
    return () => { live = false }
  }, [text])
  const plan = res?.plan
  const use = () => { setPlan(plan); toast(`ใช้แผน "${plan.name}" แล้ว`); location.hash = '#/plan' }
  return (
    <Sheet open onClose={onClose} title="รับแผนจากเพื่อน">
      {!code && <p className="hint">วางลิงก์หรือรหัสแผนที่เพื่อนส่งมา</p>}
      {!code && <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…#/import/B1…" aria-label="ลิงก์หรือรหัสแผน" style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', wordBreak: 'break-all' }} />}
      {res?.err && <p className="err" role="alert">{res.err}</p>}
      {plan && (
        <>
          <p className="row wrap" style={{ gap: '0.5rem' }}><b>{plan.name}</b> <span className="badge">รหัสแผน {planId(plan)}</span></p>
          <div className="col" style={{ gap: '0.5rem' }}>
            {plan.days.map((d, i) => (
              <div key={i} className="card flat" style={{ padding: '0.625rem 0.875rem' }}>
                <b>{DAY_SHORT[i]} · {d.name}</b>
                <span className="mute sm" style={{ display: 'block' }}>{d.items.length ? d.items.map((it) => byId[it.id].th).join(' · ') : d.focus}</span>
              </div>
            ))}
          </div>
          <p className="hint">การใช้แผนนี้จะแทนที่ตารางปัจจุบัน ประวัติการฝึกและน้ำหนักของคุณยังอยู่ครบ</p>
          <button className="btn pri block" onClick={use}><Download /> ใช้แผนนี้</button>
        </>
      )}
    </Sheet>
  )
}
