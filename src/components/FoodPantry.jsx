import { useMemo, useState } from 'react'
import { Search, Heart } from 'lucide-react'
import { PANTRY, PANTRY_KINDS, pantryById } from '../data/pantry.js'
import { matchName } from '../data/foods.js'
import { usesIngredient } from '../lib/suggest.js'
import { Sheet } from './ui.jsx'
import { useStore, toggleFoodFav } from '../store.js'

const ORDER = Object.fromEntries(PANTRY_KINDS.map(([k], i) => [k, i]))
const LABEL = Object.fromEntries(PANTRY_KINDS)
const r1 = (v) => Math.round(v * 10) / 10
const DISHES = PANTRY.filter((x) => x.kind === 'dish')
const byName = new Map(PANTRY.filter((x) => x.kind !== 'dish').map((x) => [x.n, x]))

/** วัตถุดิบในสูตรของเมนู → แถวในคลัง (ถ้ามี) */
const ingRow = (n) => pantryById[`ing-${n}`] || byName.get(n)

/** รายละเอียดของรายการในคลัง: คุณค่าทางโภชนาการ · ค่าต่อ 100 g · เมนูที่ใช้ของนี้ / วัตถุดิบในเมนู · หัวใจ */
function Detail({ x, on, onFav, onOpen }) {
  const per100 = x.u === '100 g' || !x.gw ? null : { k: Math.round((x.k / x.gw) * 100), p: r1((x.p / x.gw) * 100), c: r1((x.c / x.gw) * 100), f: r1((x.f / x.gw) * 100), na: Math.round((x.na / x.gw) * 100), su: r1((x.su / x.gw) * 100) }
  const used = useMemo(() => (x.kind === 'dish' ? [] : DISHES.filter((d) => d.id !== x.id && usesIngredient({ n: d.n, ing: d.ing }, x.n)).sort((a, b) => b.p - a.p).slice(0, 12)), [x])
  const ings = (x.ing || []).map((n) => [n, ingRow(n)])
  return (
    <div className="col">
      <p className="mute sm">{LABEL[x.kind]} · {x.u}{x.gw && x.u !== '100 g' ? ` (≈ ${x.gw} g)` : ''}</p>
      <div className="nstats" role="group" aria-label="คุณค่าทางโภชนาการ">
        {[['พลังงาน', x.k, 'kcal'], ['น้ำตาลเติม', x.su, 'g'], ['โซเดียม', x.na.toLocaleString(), 'มก.'], ['โปรตีน', x.p, 'g'], ['คาร์บ', x.c, 'g'], ['ไขมัน', x.f, 'g']].map(([l, v, u]) => (
          <div key={l}><span className="mute xs">{l}</span><b className="num">{v}</b><span className="mute xs">{u}</span></div>
        ))}
      </div>
      {per100 && <p className="hint">ต่อ 100 g ≈ {per100.k} kcal · P {per100.p} · C {per100.c} · F {per100.f} · น้ำตาล {per100.su} · Na {per100.na.toLocaleString()} มก. (ค่าประมาณ)</p>}
      <button type="button" className="btn" aria-pressed={on} onClick={onFav} style={on ? { borderColor: 'var(--pri)', background: 'var(--pri-soft)' } : undefined}>
        <Heart fill={on ? 'currentColor' : 'none'} /> {on ? 'อยู่ในรายการโปรดแล้ว (กดเพื่อเอาออก)' : 'กดหัวใจ เพื่อให้แนะนำบ่อยขึ้น'}
      </button>
      {x.kind !== 'dish' && <p className="hint">ระบบไม่แนะนำให้กิน “{x.n}” โดยตรง แต่จะเลือกเมนูที่ใช้{x.n}มาแนะนำ</p>}
      {ings.length > 0 && (
        <div className="col" style={{ gap: '0.375rem' }}>
          <b>วัตถุดิบในเมนูนี้</b>
          <div className="xchips">{ings.map(([n, r]) => (r ? <button key={n} type="button" className="xchip" onClick={() => onOpen(r)}><span className="xn">{n}{x.amt?.[n] ? ` ${x.amt[n]} g` : ''}</span><span className="xk2">{r.k} kcal / {r.u}</span></button> : <span key={n} className="xchip" aria-disabled="true"><span className="xn">{n}{x.amt?.[n] ? ` ${x.amt[n]} g` : ''}</span></span>))}</div>
        </div>
      )}
      {used.length > 0 && (
        <div className="col" style={{ gap: '0.375rem' }}>
          <b>เมนูที่ใช้{x.n}</b>
          <div className="xchips">{used.map((d) => <button key={d.id} type="button" className="xchip" onClick={() => onOpen(d)}><span className="xn">{d.n}</span><span className="xk2">{d.k} kcal · P {d.p}</span></button>)}</div>
        </div>
      )}
    </div>
  )
}

/** คลังอาหาร: ค้นหาอะไรก็ได้ (เมนู ผัก ผลไม้ วัตถุดิบ เครื่องปรุง) ดูแคล/โปรตีน/คาร์บ/ไขมัน/โซเดียม · หัวใจ = ให้ระบบแนะนำเมนูที่เกี่ยวข้อง */
export default function FoodPantry() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [onlyFav, setOnlyFav] = useState(false)
  const [lim, setLim] = useState(60)
  const [sel, setSel] = useState(null) // รายการที่เปิดดูรายละเอียด
  const favs = useStore((s) => s.foodFavs) || []
  const list = useMemo(() => {
    const key = q.trim()
    return PANTRY.filter((x) => (!kind || x.kind === kind) && (!onlyFav || favs.includes(x.id)) && (!key || matchName(x.n, key)))
      .sort((a, b) => (kind || key ? 0 : ORDER[a.kind] - ORDER[b.kind]))
  }, [q, kind, onlyFav, favs])
  const label = LABEL
  return (
    <div className="col">
      <div className="search">
        <Search aria-hidden="true" />
        <input className="input" type="search" placeholder="ค้นหาอาหาร ผัก ผลไม้ เครื่องปรุง เช่น น้ำปลา อกไก่" aria-label="ค้นหาในคลังอาหาร" value={q} onChange={(e) => { setQ(e.target.value); setLim(60) }} />
      </div>
      <div className="chips" role="group" aria-label="ประเภท">
        <button aria-pressed={!kind} onClick={() => { setKind(''); setLim(60) }}>ทั้งหมด</button>
        {PANTRY_KINDS.map(([k, t]) => <button key={k} aria-pressed={kind === k} onClick={() => { setKind(kind === k ? '' : k); setLim(60) }}>{t}</button>)}
      </div>
      <div className="row between wrap">
        <p className="mute sm grow" role="status">พบ {list.length.toLocaleString()} รายการ · ค่าต่อหน่วยที่ระบุ (วัตถุดิบ = ต่อ 100 g)</p>
        <button className="btn sm grow-0" aria-pressed={onlyFav} onClick={() => { setOnlyFav(!onlyFav); setLim(60) }} style={onlyFav ? { borderColor: 'var(--pri)', background: 'var(--pri-soft)' } : undefined}><Heart fill={onlyFav ? 'currentColor' : 'none'} /> โปรด{favs.length ? ` ${favs.length}` : ''}</button>
      </div>
      <p className="hint">กดหัวใจที่เมนูที่ชอบ → ระบบจะแนะนำเมนูนั้นบ่อยขึ้น · กดที่วัตถุดิบหรือเครื่องปรุง → แนะนำ “เมนูที่ใช้ของนั้น” (ไม่แนะนำให้กินเครื่องปรุงเดี่ยวๆ)</p>
      {list.length ? (
        <>
          <ul className="pantry">
            {list.slice(0, lim).map((x) => {
              const on = favs.includes(x.id)
              return (
                <li key={x.id} className="pitem">
                  <button type="button" className="pitem-b grow" aria-label={`ดูรายละเอียด ${x.n}`} onClick={() => setSel(x)}>
                    <b>{x.n}</b>
                    <div className="mute xs">{label[x.kind]} · {x.u}</div>
                    <div className="xs"><b className="num">{x.k}</b> kcal · P {x.p} · C {x.c} · F {x.f} · น้ำตาล {x.su} · Na {x.na.toLocaleString()}</div>
                  </button>
                  <button className="fav pfav" aria-pressed={on} aria-label={`${on ? 'เลิกกดโปรด' : 'กดโปรด'} ${x.n}`} onClick={() => toggleFoodFav(x.id)}><Heart fill={on ? 'currentColor' : 'none'} /></button>
                </li>
              )
            })}
          </ul>
          {list.length > lim && <button className="btn sm" onClick={() => setLim(lim + 100)}>แสดงเพิ่ม ({(list.length - lim).toLocaleString()} รายการ)</button>}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}><p>{onlyFav && !favs.length ? 'ยังไม่มีรายการโปรด กดรูปหัวใจที่รายการเพื่อบันทึก' : 'ไม่พบรายการที่ตรงกัน'}</p></div>
      )}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.n || ''}>
        {sel && <Detail key={sel.id} x={sel} on={favs.includes(sel.id)} onFav={() => toggleFoodFav(sel.id)} onOpen={setSel} />}
      </Sheet>
    </div>
  )
}
