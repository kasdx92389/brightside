import { Sheet, Media } from './ui.jsx'
import { EXERCISES, EQUIP } from '../data/exercises.js'
import { useStore } from '../store.js'
import { planLimits } from '../lib/safety.js'

const prim = (e) => e.m.split(' · ')[0]

/** ท่าแทน: กลุ่มเดียวกัน ไม่ยากกว่าระดับที่เลือก · กล้ามเนื้อหลักเดียวกันก่อน · อุปกรณ์ต่างจากเดิมก่อน */
export const altsFor = (ex, level, taken, lim = { avoid: new Set(), maxLevel: 3 }) =>
  EXERCISES.filter((e) => e.g === ex.g && e.id !== ex.id && e.lv <= Math.min(Math.max(level, ex.lv), lim.maxLevel) && !taken.includes(e.id) && !lim.avoid.has(e.id))
    .sort((a, b) => (prim(a) !== prim(ex)) - (prim(b) !== prim(ex)) || (a.eq === ex.eq) - (b.eq === ex.eq) || a.lv - b.lv)
    .slice(0, 8)

/** เครื่องไม่ว่าง/ไม่มี → เลือกท่าแทนในแผน */
export default function SwapSheet({ ex, level = 1, taken = [], onPick, onClose }) {
  const profile = useStore((s) => s.profile)
  const alts = ex ? altsFor(ex, level, taken, planLimits(profile)) : []
  return (
    <Sheet open={!!ex} onClose={onClose} title={ex ? `ท่าแทน ${ex.th}` : ''}>
      {ex && (
        <>
          <p className="hint">เลือกท่าที่ฟิตเนสมีและว่าง ระบบจะเปลี่ยนในแผนให้ทุกสัปดาห์</p>
          {alts.length ? (
            <div className="col" style={{ gap: '0.5rem' }}>
              {alts.map((e) => (
                <button key={e.id} className="pi" style={{ textAlign: 'left' }} onClick={() => onPick(e)}>
                  <Media ex={e} />
                  <span className="grow"><b>{e.th}</b><span className="mute sm" style={{ display: 'block' }}>{EQUIP[e.eq]} · แนะนำ {e.rx}</span></span>
                </button>
              ))}
            </div>
          ) : <p className="mute">ไม่มีท่าแทนที่เหมาะ ลองเพิ่มท่าเองจากหน้า "แผน"</p>}
        </>
      )}
    </Sheet>
  )
}
