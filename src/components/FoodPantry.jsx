import { useMemo, useState } from 'react'
import { Search, Heart } from 'lucide-react'
import { PANTRY, PANTRY_KINDS } from '../data/pantry.js'
import { matchName } from '../data/foods.js'
import { useStore, toggleFoodFav } from '../store.js'

const ORDER = Object.fromEntries(PANTRY_KINDS.map(([k], i) => [k, i]))

/** คลังอาหาร: ค้นหาอะไรก็ได้ (เมนู ผัก ผลไม้ วัตถุดิบ เครื่องปรุง) ดูแคล/โปรตีน/คาร์บ/ไขมัน/โซเดียม · หัวใจ = ให้ระบบแนะนำเมนูที่เกี่ยวข้อง */
export default function FoodPantry() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [onlyFav, setOnlyFav] = useState(false)
  const [lim, setLim] = useState(60)
  const favs = useStore((s) => s.foodFavs) || []
  const list = useMemo(() => {
    const key = q.trim()
    return PANTRY.filter((x) => (!kind || x.kind === kind) && (!onlyFav || favs.includes(x.id)) && (!key || matchName(x.n, key)))
      .sort((a, b) => (kind || key ? 0 : ORDER[a.kind] - ORDER[b.kind]))
  }, [q, kind, onlyFav, favs])
  const label = Object.fromEntries(PANTRY_KINDS)
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
                  <div className="grow">
                    <b>{x.n}</b>
                    <div className="mute xs">{label[x.kind]} · {x.u}</div>
                    <div className="xs"><b className="num">{x.k}</b> kcal · P {x.p} · C {x.c} · F {x.f} · Na {x.na.toLocaleString()}</div>
                  </div>
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
    </div>
  )
}
