import { useState } from 'react'
import { RefreshCw, Link2, Copy, Unlink, CloudOff, Check } from 'lucide-react'
import { Sheet } from './ui.jsx'
import { SYNC_URL, useSync, runSync, createLink, joinLink, unlink, unlinkAndDeleteCloud, getSecret, joinUrl } from '../lib/sync.js'

const when = (t) => (t ? new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ยังไม่เคย')
const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true } catch { return false } }
const msg = (e) => e?.message || 'ไม่สำเร็จ'

/** เชื่อมคอมกับมือถือ: ข้อมูลเข้ารหัสในเครื่องก่อนส่ง เซิร์ฟเวอร์อ่านไม่ออก */
export default function SyncPanel({ toast }) {
  const st = useSync()
  const [code, setCode] = useState('')
  const [shown, setShown] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!SYNC_URL) return null

  const act = async (fn) => { setBusy(true); setErr(''); try { await fn() } catch (e) { setErr(msg(e)) } finally { setBusy(false) } }
  const secret = st.linked ? getSecret() : ''

  return (
    <section className="card col">
      <h2 className="row"><RefreshCw aria-hidden="true" /> เชื่อมคอมกับมือถือ</h2>
      {!st.linked ? (
        <>
          <p className="mute sm">ข้อมูลฝึก น้ำหนัก และแผน จะตามกันไปทุกเครื่องอัตโนมัติ ข้อมูลถูกเข้ารหัสในเครื่องก่อนส่ง เซิร์ฟเวอร์เก็บได้แต่ข้อความที่อ่านไม่ออก ไม่ต้องสมัครหรือล็อกอิน ใช้ &ldquo;รหัสเชื่อม&rdquo; แทน</p>
          <button className="btn pri" disabled={busy} onClick={() => act(async () => { await createLink(); setShown(true); toast('สร้างรหัสเชื่อมแล้ว') })}><Link2 /> สร้างรหัสเชื่อม (เครื่องแรก)</button>
          <div className="field">
            <span>หรือใส่รหัสจากเครื่องอื่น</span>
            <div className="row pair">
              <input className="input grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder="วางรหัสเชื่อมหรือลิงก์" aria-label="รหัสเชื่อม" autoComplete="off" spellCheck="false" />
              <button className="btn grow-0" disabled={busy || !code.trim()} onClick={() => act(async () => { await joinLink(code); setCode(''); toast('เชื่อมเครื่องแล้ว') })}>เชื่อม</button>
            </div>
          </div>
          <p className="hint">ถ้าทั้งสองเครื่องมีข้อมูลอยู่แล้ว ระบบรวมให้ทีละรายการ ถ้าวันเดียวกันขัดกัน เครื่องที่สร้างรหัสมีผลก่อน</p>
        </>
      ) : (
        <>
          <p className="row" style={{ gap: '0.5rem' }}><Check style={{ color: 'var(--ok-fg)' }} aria-hidden="true" /> <b>เชื่อมแล้ว</b> <span className="mute sm">ซิงก์ล่าสุด {when(st.last)}{st.busy ? ' · กำลังซิงก์…' : ''}</span></p>
          <button className="btn" disabled={busy || st.busy} onClick={() => act(() => runSync())}><RefreshCw /> ซิงก์ตอนนี้</button>
          <button className="btn ghost" onClick={() => setShown(!shown)} aria-expanded={shown}><Link2 /> {shown ? 'ซ่อนรหัสเชื่อม' : 'แสดงรหัสเชื่อม (สำหรับเพิ่มเครื่อง)'}</button>
          {shown && (
            <>
              <textarea className="input" readOnly rows={3} value={joinUrl(secret)} onFocus={(e) => e.target.select()} aria-label="ลิงก์เชื่อมเครื่อง" style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', wordBreak: 'break-all' }} />
              <button className="btn sm" onClick={async () => toast((await copy(joinUrl(secret))) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่ได้ กดค้างที่ลิงก์')}><Copy /> คัดลอกลิงก์</button>
              <p className="err">รหัสนี้เหมือนรหัสผ่าน ใครได้ไปจะอ่านและแก้ข้อมูลของคุณได้ ส่งให้เฉพาะเครื่องของคุณเอง ห้ามโพสต์หรือส่งให้เพื่อน (ถ้าจะแชร์แผน ใช้ปุ่มแชร์ในหน้า &ldquo;แผน&rdquo;)</p>
            </>
          )}
          <div className="col" style={{ gap: '0.5rem' }}>
            <button className="btn ghost" onClick={() => confirm('เลิกเชื่อมเครื่องนี้? ข้อมูลในเครื่องนี้และบนคลาวด์ยังอยู่ แต่จะไม่ตามกันอีก') && (unlink(), toast('เลิกเชื่อมแล้ว'))}><Unlink /> เลิกเชื่อมเครื่องนี้</button>
            <button className="btn danger ghost" disabled={busy} onClick={() => confirm('ลบข้อมูลบนคลาวด์และเลิกเชื่อม? เครื่องอื่นที่เชื่อมไว้จะหยุดซิงก์ (ข้อมูลในแต่ละเครื่องยังอยู่)') && act(async () => { await unlinkAndDeleteCloud(); toast('ลบข้อมูลบนคลาวด์แล้ว') })}><CloudOff /> ลบข้อมูลบนคลาวด์</button>
          </div>
        </>
      )}
      {(err || st.error) && <p className="err" role="alert">{err || st.error}</p>}
    </section>
  )
}

/** เปิดลิงก์ #/sync/รหัส จากอีกเครื่อง → ถามยืนยันก่อนเชื่อม */
export function JoinSync({ secret, onDone, toast }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    try { await joinLink(secret); toast('เชื่อมเครื่องแล้ว ข้อมูลตามกันแล้ว'); onDone() } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onDone} title="เชื่อมเครื่องนี้">
      {!SYNC_URL ? <p className="err">เวอร์ชันนี้ยังไม่เปิดระบบซิงก์</p> : (
        <>
          <p>เชื่อมเครื่องนี้กับข้อมูลที่ซิงก์ไว้จากอีกเครื่อง ข้อมูลจะถูกรวมกัน ไม่มีอะไรถูกลบ</p>
          <p className="hint">ถ้าเครื่องนี้มีข้อมูลอยู่แล้ว และวันเดียวกันขัดกัน ข้อมูลจากเครื่องที่สร้างรหัสมีผลก่อน</p>
          <button className="btn pri block" disabled={busy} onClick={go}><Link2 /> {busy ? 'กำลังเชื่อม…' : 'เชื่อมเครื่องนี้'}</button>
          {err && <p className="err" role="alert">{err}</p>}
        </>
      )}
    </Sheet>
  )
}
