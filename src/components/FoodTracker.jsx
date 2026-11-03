import { useMemo, useState } from 'react'
import { Droplets, Beef, Zap, Wheat, Droplet, Plus, Minus, X, Search, Lightbulb, Pencil, Soup } from 'lucide-react'
import { Seg, Sheet } from './ui.jsx'
import { unitInfo, fmtAmt } from '../lib/units.js'
import { FOODS, FOOD_CATS, foodById, ADDON_GROUPS, ADDONS, addonById, addonStep, suggestAddons, matchName } from '../data/foods.js'
import { targets, MEAL_SLOTS } from '../lib/calc.js'
import { addDays } from '../lib/coach.js'
import { gramsPerUnit, gramInfo, addonGw } from '../data/grams.js'
import { sodiumOf, addonSodium, itemSodium } from '../data/sodium.js'
import { getWeighMode, setWeighMode } from '../lib/ui.js'
import { patchFood, addFood, removeFood, updateFood, addMyFood, removeMyFood, useStore } from '../store.js'

const ML = 250 // 1 แก้ว
const SLOTS = MEAL_SLOTS.map(([n], i) => [i, n])
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const slotNow = () => { const h = new Date().getHours(); return h < 10 ? 0 : h < 15 ? 1 : h < 18 ? 3 : 2 }

/** อาหารที่ช่วยเติมโปรตีนที่ยังขาด โดยไม่เกินพลังงานที่เหลือ — เรียงตามโปรตีนต่อแคลอรี่ ไม่ซ้ำหมวด */
export function suggestFoods(remP, remK) {
  if (remP < 10) return []
  const seen = new Set()
  return FOODS.filter((f) => ['meat', 'dish', 'dairy', 'plant', 'meal'].includes(f.cat) && f.p >= 8 && f.p <= remP + 10 && f.k <= Math.max(150, remK))
    .sort((a, b) => b.p / b.k - a.p / a.k)
    .filter((f) => !seen.has(f.cat) && seen.add(f.cat))
    .slice(0, 3)
}

function Bar({ icon: Icon, label, value, goal, unit, over, limit }) {
  const pct = goal ? value / goal : 0
  const cls = limit ? (pct >= 1 ? 'over' : '') : pct >= 1.1 && over ? 'over' : pct >= 1 ? 'full' : ''
  return (
    <div className="meter">
      <div className="row between">
        <span className="row" style={{ gap: '0.5rem' }}><Icon aria-hidden="true" /><b>{label}</b></span>
        <span className="mute sm"><b className="num" style={{ fontSize: '1.25rem', color: cls === 'over' ? 'var(--warn-fg)' : pct >= 1 && !limit ? 'var(--ok-fg)' : 'var(--text)' }}>{Math.round(value).toLocaleString()}</b> / {Math.round(goal).toLocaleString()} {unit}</span>
      </div>
      <div className="bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={Math.round(goal)} aria-valuenow={Math.round(value)}><i style={{ width: `${clamp(pct, 0, 1) * 100}%` }} className={cls} /></div>
    </div>
  )
}

/** รายการที่บันทึกไว้ → { lookup, ex, gm } สำหรับเปิดแก้ไข (gm = เครื่องปรุงที่บันทึกเป็นกรัม) */
function fromItem(it) {
  const lookup = { ...addonById }
  const ex = {}
  const gm = {}
  ;(it?.x || []).forEach((x, i) => {
    const ad = ADDONS.find((a) => a.n === x.n)
    if (ad) {
      if (x.w === 'g' && addonGw(ad)) { ex[ad.id] = x.a / addonGw(ad); gm[ad.id] = true } else ex[ad.id] = x.a
    } else {
      // ชื่อที่ถูกเปลี่ยน/ลบไปแล้ว: ใช้ค่าต่อหน่วยจากที่บันทึกไว้
      const id = `old-${i}`
      lookup[id] = { id, cat: 'old', n: x.n, u: x.w, na: (x.na || 0) / x.a, k: x.k / x.a, p: x.p / x.a, c: x.c / x.a, f: x.f / x.a, ...(x.w === 'g' && { gw: 1 }) }
      ex[id] = x.a
      if (x.w === 'g') gm[id] = true
    }
  })
  return { lookup, ex, gm }
}

/** เลือกปริมาณ: ตามหน่วยของอาหาร (ฟอง/ชิ้น = จำนวนเต็ม · ชาม/จาน = ครึ่งได้) หรือ "ชั่งเป็นกรัม" ถ้ารู้น้ำหนักต่อหน่วย
 *  "เพิ่มรายละเอียด" = เลือกเครื่องปรุง/น้ำมันเพิ่มเองเป็นช้อนหรือกรัม (ไม่เพิ่มให้อัตโนมัติ) */
function QtyPicker({ food, slot, setSlot, onAdd, onDelete, onDeleteFood, init, last, label = 'เพิ่ม' }) {
  const base = unitInfo(food)
  const gw = gramsPerUnit(food)
  const canG = base.kind !== 'g' && gw > 0
  const [mode, setMode] = useState(() => (canG && (init ? init.w === 'g' : getWeighMode() === 'g') ? 'g' : 'u'))
  const u = mode === 'g' ? gramInfo(gw) : base
  const [seed] = useState(() => fromItem(init))
  const [val, setVal] = useState(() => String(r2(clamp(init?.a ?? u.base, u.min, u.max))))
  const [xOpen, setXOpen] = useState(() => Object.keys(seed.ex).length > 0)
  const [ex, setEx] = useState(seed.ex) // id เครื่องปรุง → จำนวน (นับเป็นหน่วยของมัน)
  const [gm, setGm] = useState(seed.gm) // id เครื่องปรุง → แสดง/ใส่เป็นกรัม
  const [xq, setXq] = useState('')
  const a = clamp(Number(val) || 0, 0, u.max)
  const q = a / u.base
  const move = (d) => setVal(String(r2(clamp(a + d * u.step, u.min, u.max))))
  const switchMode = (m) => {
    if (m === mode) return
    const nu = m === 'g' ? gramInfo(gw) : base
    setMode(m)
    setWeighMode(m)
    setVal(String(r2(clamp(Math.round((q * nu.base) / nu.step) * nu.step, nu.min, nu.max))))
  }

  const per = (ad) => addonGw(ad) // กรัมต่อ 1 หน่วยของเครื่องปรุง (ไม่รู้ = null)
  const gOn = (ad) => !!gm[ad.id] && !!per(ad)
  const stepFor = (ad) => (gOn(ad) ? (per(ad) <= 20 ? 1 : 5) / per(ad) : addonStep(ad))
  const shown = (ad, n) => (gOn(ad) ? r1(n * per(ad)) : r2(n))
  const picked = Object.entries(ex).map(([id, n]) => [seed.lookup[id], n])
  const sumX = (k) => picked.reduce((s, [ad, n]) => s + ad[k] * n, 0)
  const sumNa = picked.reduce((s, [ad, n]) => s + addonSodium(ad) * n, 0)
  const foodNa = sodiumOf(food)
  const setX = (id, n) => setEx((cur) => { const o = { ...cur }; if (!(n > 0.0001)) delete o[id]; else o[id] = Math.min(n, 40); return o })
  const toggle = (ad) => {
    if (ex[ad.id]) return setX(ad.id, 0)
    const g = mode === 'g' && !!per(ad) // ใช้โหมดเดียวกับตัวอาหาร: คนมีเครื่องชั่งจะเริ่มเป็นกรัมเลย
    setGm((c) => ({ ...c, [ad.id]: g }))
    setX(ad.id, g ? 1 : addonStep(ad))
  }
  const commit = (ad, e) => { const v = Number(e.currentTarget.value); if (v > 0) setX(ad.id, gOn(ad) ? v / per(ad) : v) }
  const xkey = xq.trim().toLowerCase()
  const found = xkey ? ADDONS.filter((ad) => matchName(ad.n, xkey)) : null
  const tips = suggestAddons(food).map((id) => addonById[id]).filter(Boolean)
  const extras = () => picked.map(([ad, n]) => ({ n: ad.n, a: shown(ad, n), w: gOn(ad) ? 'g' : ad.u, k: Math.round(ad.k * n), p: r1(ad.p * n), c: r1(ad.c * n), f: r1(ad.f * n), na: Math.round(addonSodium(ad) * n) }))
  const submit = () => onAdd(q, r2(a), u.word, extras())
  const chip = (ad) => <button key={ad.id} type="button" className="xchip" aria-pressed={!!ex[ad.id]} onClick={() => toggle(ad)}><span className="xn">{ad.n}</span><span className="xk2">{ad.k} kcal{addonSodium(ad) >= 50 ? ` · Na ${addonSodium(ad)}` : ''} / {ad.u}</span></button>
  return (
    <>
      <p className="mute sm">
        {food.u} = <b className="num">{food.k}</b> kcal · P {food.p} · C {food.c} · F {food.f} · Na {foodNa} มก.
        {mode === 'g' && <span> · ≈ {gw} g ต่อหน่วยนี้ ({Math.round((food.k / gw) * 100)} kcal/100 g) เป็นค่าประมาณ</span>}
      </p>
      {canG && <Seg label="วิธีใส่ปริมาณ" value={mode} onChange={switchMode} options={[['u', `ตามหน่วย (${base.word})`], ['g', 'ชั่งเป็นกรัม (g)']]} />}
      <div className="qty-row">
        <button className="icon-btn qbtn" aria-label="ลดจำนวน" disabled={a <= u.min} onClick={() => move(-1)}><Minus /></button>
        <label className="qty-in">
          <input type="number" inputMode="decimal" min={u.min} max={u.max} step={u.kind === 'g' ? 'any' : u.step} value={val} aria-label={`จำนวน (${u.word})`} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && a >= u.min && submit()} onBlur={() => setVal(String(r2(clamp(Number(val) || u.min, u.min, u.max))))} />
          <span>{u.word}</span>
        </label>
        <button className="icon-btn qbtn" aria-label="เพิ่มจำนวน" disabled={a >= u.max} onClick={() => move(1)}><Plus /></button>
      </div>
      <div className="presets" role="group" aria-label="จำนวนที่เลือกบ่อย" style={{ gridTemplateColumns: `repeat(${Math.ceil(u.presets.length / Math.ceil(u.presets.length / 6))}, minmax(0, 1fr))` }}>
        {last && last.w === u.word && !u.presets.includes(last.a) && <button type="button" className="chip" style={{ gridColumn: '1 / -1' }} aria-pressed={a === last.a} onClick={() => setVal(String(last.a))} title="ปริมาณที่เพิ่มครั้งล่าสุด">ครั้งก่อน {fmtAmt(last.a)} {u.word}</button>}
        {u.presets.map((p) => <button key={p} type="button" className="chip" aria-pressed={a === p} onClick={() => setVal(String(p))}>{fmtAmt(p)}</button>)}
      </div>

      <details className="xbox" open={xOpen} onToggle={(e) => setXOpen(e.currentTarget.open)}>
        <summary className="more">เพิ่มรายละเอียด (น้ำมัน เครื่องปรุง ส่วนเสริม){picked.length > 0 && <b className="xcount">{picked.length}</b>}</summary>
        <div className="col" style={{ gap: '0.75rem', marginTop: '0.625rem' }}>
          <p className="hint">ค่าของเมนูทอด/ผัดรวมน้ำมันที่ใช้ตามปกติไว้แล้ว เลือกเพิ่มเฉพาะส่วนที่ใส่เกินหรือเครื่องปรุงที่ปรุงเพิ่มเอง ใส่เป็นช้อนหรือชั่งเป็นกรัมก็ได้</p>
          {picked.length > 0 && (
            <ul className="xlist" aria-label="เครื่องปรุงที่เลือก">
              {picked.map(([ad, n]) => (
                <li key={ad.id}>
                  <span className="grow">
                    <b>{ad.n}</b>
                    <span className="mute xs xk">+{Math.round(ad.k * n)} kcal{per(ad) ? <> · <button type="button" className="xunit" onClick={() => setGm((c) => ({ ...c, [ad.id]: !gOn(ad) }))}>{gOn(ad) ? `เปลี่ยนเป็น${ad.u}` : 'เปลี่ยนเป็น g'}</button></> : null}</span>
                  </span>
                  <span className="xctl">
                    <button type="button" className="icon-btn xbtn" aria-label={`ลด ${ad.n}`} onClick={() => setX(ad.id, n - stepFor(ad))}><Minus /></button>
                    <label className="xval">
                      <input key={`${ad.id}-${gOn(ad)}-${shown(ad, n)}`} className="xin" type="number" inputMode="decimal" min="0" step="any" defaultValue={shown(ad, n)} aria-label={`จำนวน ${ad.n}`} onBlur={(e) => commit(ad, e)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                      <span>{gOn(ad) ? 'g' : ad.u}</span>
                    </label>
                    <button type="button" className="icon-btn xbtn" aria-label={`เพิ่ม ${ad.n}`} onClick={() => setX(ad.id, n + stepFor(ad))}><Plus /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="search">
            <Search aria-hidden="true" />
            <input className="input" type="search" placeholder="ค้นหาเครื่องปรุง เช่น แม็กกี้ น้ำมันงา" aria-label="ค้นหาเครื่องปรุง" value={xq} onChange={(e) => setXq(e.target.value)} />
          </div>
          {found ? (
            found.length ? <div className="xchips">{found.map(chip)}</div> : <p className="mute sm">ไม่พบเครื่องปรุงนี้ ใช้ "กรอกเอง" ในหน้าหลักเพื่อใส่ค่าจากฉลากได้</p>
          ) : (
            <>
              {tips.length > 0 && <div className="col" style={{ gap: '0.375rem' }}><span className="xs mute">มักใส่กับเมนูนี้</span><div className="xchips">{tips.map(chip)}</div></div>}
              {ADDON_GROUPS.map(([k, label]) => (
                <div key={k} className="col" style={{ gap: '0.375rem' }}>
                  <span className="xs mute">{label}</span>
                  <div className="xchips">{ADDONS.filter((ad) => ad.cat === k).map(chip)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </details>

      <div className="qtot" aria-live="polite">
        <span><b className="num">{Math.round(food.k * q + sumX('k'))}</b> kcal{picked.length > 0 && <span className="mute xs"> (เครื่องปรุง +{Math.round(sumX('k'))})</span>}</span>
        <span className="mute xs">โปรตีน {r1(food.p * q + sumX('p'))} g · คาร์บ {r1(food.c * q + sumX('c'))} g · ไขมัน {r1(food.f * q + sumX('f'))} g · โซเดียม {Math.round(foodNa * q + sumNa).toLocaleString()} มก.</span>
      </div>
      <Seg label="มื้อ" value={slot} onChange={setSlot} options={SLOTS} />
      {onDelete && <button type="button" className="btn danger" onClick={onDelete}><X /> ลบรายการนี้</button>}
      {onDeleteFood && <button type="button" className="btn danger" onClick={onDeleteFood}><X /> ลบเมนูนี้ออกจาก “เมนูของฉัน”</button>}
      <div className="qfoot">
        <button className="btn pri qadd" disabled={a < u.min} onClick={submit}><Plus /> {label} {fmtAmt(a)} {u.word} · {Math.round(food.k * q + sumX('k'))} kcal</button>
      </div>
    </>
  )
}

/** แถวอาหารที่บันทึกแล้ว: แตะเพื่อแก้ไข (เฉพาะเมนูที่มีในฐานข้อมูล/เมนูของฉัน — "กรอกเอง" แบบไม่บันทึกแก้ไม่ได้ ลบแล้วเพิ่มใหม่) */
function EatRow({ it, food, na, onEdit, onDelete }) {
  const Row = food ? 'button' : 'div'
  const chip = it.w === 'g' || it.q !== 1
  return (
    <li className="eat">
      <Row className="eat-b" {...(food && { type: 'button', 'aria-label': `แก้ไข ${it.n}`, onClick: onEdit })}>
        <div className="grow">
          <div className="eat-n"><span>{it.n}</span>{food && <Pencil className="eat-pen" aria-hidden="true" />}{chip && <span className="qty">{it.w ? `${fmtAmt(it.a)} ${it.w}` : `×${it.q}`}</span>}</div>
          <div className="mute xs">{it.q === 1 && it.w !== 'g' && food?.u ? food.u + ' · ' : ''}P {it.p} · C {it.c ?? 0} · F {it.f ?? 0} · Na {na.toLocaleString()}</div>
          {it.x?.length > 0 && <div className="eat-x2 xs">+ {it.x.map((x) => `${x.n} ${fmtAmt(x.a)} ${x.w}`).join(' · ')}</div>}
        </div>
        <span className="num eat-k">{it.k.toLocaleString()}<small> kcal</small></span>
      </Row>
      <button className="icon-btn eat-x" aria-label={`ลบ ${it.n}`} onClick={onDelete}><X /></button>
    </li>
  )
}

/** อาหารและน้ำของวัน: เป้ารายบุคคล · แตะเพิ่มอาหารได้เลย · แนะนำสิ่งที่ควรกินต่อ */
export default function FoodTracker({ date, log, logs, profile, train, isToday, toast }) {
  const t = targets(profile)
  const f = log?.food || {}
  const items = f.items || []
  const water = Number(f.water) || 0
  const wg = t.glasses(train)
  const proteinGoal = Math.round((t.protein[0] + t.protein[1]) / 2)
  const [slot, setSlot] = useState(slotNow)
  const [sel, setSel] = useState(null) // อาหารที่กำลังเลือกปริมาณ
  const [edit, setEdit] = useState(null) // แก้ไขรายการที่บันทึกแล้ว: { i, s, init }
  const closeSheet = () => { setSel(null); setEdit(null) }
  const [cat, setCat] = useState('recent')
  const [q, setQ] = useState('')
  const blankCustom = { n: '', k: '', p: '', c: '', f: '', na: '', g: '', mode: 'all', save: false }
  const [custom, setCustom] = useState(blankCustom)
  const myFoods = useStore((s) => s.myFoods)
  const mine = useMemo(() => (myFoods || []).map((m) => ({ ...m, cat: 'mine' })), [myFoods])
  const allFoods = useMemo(() => [...mine, ...FOODS], [mine])
  const byId = useMemo(() => ({ ...foodById, ...Object.fromEntries(mine.map((m) => [m.id, m])) }), [mine])

  const recents = useMemo(() => {
    const n = {}
    for (let i = 0; i < 14; i++) for (const it of logs[addDays(date, -i)]?.food?.items || []) n[it.id] = (n[it.id] || 0) + 1
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([id]) => byId[id]).filter(Boolean).slice(0, 12)
  }, [logs, date, byId])
  const tab = (cat === 'recent' && !recents.length) || (cat === 'mine' && !mine.length) ? 'rice' : cat
  const key = q.trim().toLowerCase()
  const shown = key ? allFoods.filter((x) => matchName(x.n, key)) : tab === 'recent' ? recents : allFoods.filter((x) => x.cat === tab)

  const lastAmt = (id) => {
    for (let i = 0; i < 30; i++) {
      const hit = [...(logs[addDays(date, -i)]?.food?.items || [])].reverse().find((x) => x.id === id && x.a != null)
      if (hit) return { a: hit.a, w: hit.w }
    }
    return null
  }
  const mk = (food, qty = 1, amt, word, extras = [], s = slot) => {
    const X = (k) => extras.reduce((n, x) => n + x[k], 0)
    return { id: food.id, n: food.n, q: qty, s, k: Math.round(food.k * qty + X('k')), p: r1(food.p * qty + X('p')), c: r1(food.c * qty + X('c')), f: r1(food.f * qty + X('f')), na: Math.round(sodiumOf(food) * qty + X('na')), ...(word && { a: amt, w: word }), ...(extras.length && { x: extras }) }
  }
  const label = (food, qty, amt, word, extras) => `${food.n}${word ? ` ${fmtAmt(amt)} ${word}` : qty !== 1 ? ` ×${qty}` : ''}${extras?.length ? ` + ${extras.length} เครื่องปรุง` : ''}`
  const add = (food, qty = 1, amt, word, extras = []) => {
    addFood(date, mk(food, qty, amt, word, extras))
    toast?.(`เพิ่ม ${label(food, qty, amt, word, extras)} แล้ว`)
  }
  /** index ปัจจุบันของรายการที่กำลังแก้ (หาจากเนื้อหาเดิม ถ้าถูกแก้/ลบจากเครื่องอื่นจะไม่เจอ) */
  const editIndex = () => (JSON.stringify(items[edit.i]) === edit.orig ? edit.i : items.findIndex((x) => JSON.stringify(x) === edit.orig))
  const saveEdit = (food, qty, amt, word, extras = []) => {
    const i = editIndex()
    if (i < 0) return toast?.('รายการนี้ถูกแก้ไขหรือลบจากอีกเครื่อง เปิดดูใหม่อีกครั้ง')
    updateFood(date, i, mk(food, qty, amt, word, extras, edit.s))
    toast?.(`แก้ไข ${label(food, qty, amt, word, extras)} แล้ว`)
  }
  const deleteEdit = () => {
    const i = editIndex()
    if (i >= 0) removeFood(date, i)
    toast?.(i >= 0 ? `ลบ ${sel.n} แล้ว` : 'รายการนี้ถูกลบไปแล้ว')
    closeSheet()
  }
  const openEdit = (it, i) => {
    const food = byId[it.id]
    if (!food) return
    const u = unitInfo(food)
    setSel(food)
    setEdit({ i, s: it.s ?? 1, orig: JSON.stringify(it), init: { a: it.a ?? r2(it.q * u.base), w: it.w, x: it.x } })
  }
  const cv = (s) => Math.max(0, Number(s) || 0)
  const cp = { k: cv(custom.k), p: cv(custom.p), c: cv(custom.c), f: cv(custom.f), na: cv(custom.na), m: custom.mode === '100' ? cv(custom.g) / 100 : 1 } // ค่าที่กรอก × ตัวคูณน้ำหนัก
  const addCustom = () => {
    const per = custom.mode === '100'
    if (!cp.k || cp.k > (per ? 900 : 5000)) return toast?.(per ? 'ใส่พลังงานต่อ 100 g (kcal) 1–900' : 'ใส่พลังงาน (kcal) 1–5,000')
    if (per && !(cp.m > 0)) return toast?.('ใส่น้ำหนักที่ชั่ง (g)')
    const name = custom.n.trim() || 'อาหารกำหนดเอง'
    if (custom.save && custom.n.trim()) {
      // เมนูของฉัน: เก็บค่าต่อ 100 g (หรือต่อ 1 หน่วย) แล้วบันทึกรายการจากเมนูนั้น → แก้ไข/ชั่งซ้ำภายหลังได้
      const food = { id: 'my-' + Date.now().toString(36), n: name, u: per ? '100 g' : '1 หน่วย', k: r1(cp.k), p: r1(cp.p), c: r1(cp.c), f: r1(cp.f), na: Math.round(cp.na) }
      addMyFood(food)
      add({ ...food, cat: 'mine' }, per ? cp.m : 1, per ? r1(cp.m * 100) : 1, per ? 'g' : 'หน่วย')
    } else {
      addFood(date, { id: 'custom', n: name, q: 1, s: slot, k: Math.round(cp.k * cp.m), p: r1(cp.p * cp.m), c: r1(cp.c * cp.m), f: r1(cp.f * cp.m), na: Math.round(cp.na * cp.m), ...(per && { a: r1(cp.m * 100), w: 'g' }) })
      toast?.('เพิ่มอาหารแล้ว')
    }
    setCustom({ ...blankCustom, mode: custom.mode })
  }
  const drink = (ml) => patchFood(date, { water: Math.round(Math.max(0, water + ml / ML) * 100) / 100 })

  // ยอดที่บันทึกไว้จากแอปเวอร์ชันเก่า (กรอกยอดรวม ไม่มีรายการ) หรือเหลือจากการแก้ข้อมูล: แสดงให้เห็นและให้ล้างได้
  const sumI = (k) => items.reduce((n, it) => n + (Number(it[k]) || 0), 0)
  const extraK = Math.round((f.kcal || 0) - sumI('k'))
  const clearExtra = () => { patchFood(date, { kcal: sumI('k'), protein: r1(sumI('p')), carb: r1(sumI('c')), fat: r1(sumI('f')) }); toast?.('ล้างยอดที่ไม่มีรายการแล้ว') }
  const sodiumNow = items.reduce((n, it) => n + itemSodium(it, byId), 0)
  const remK = t.kcal - (f.kcal || 0), remP = proteinGoal - (f.protein || 0)
  const sugg = isToday ? suggestFoods(remP, remK) : []
  const h = new Date().getHours() + new Date().getMinutes() / 60
  const expected = wg * clamp((h - 7) / 14, 0, 1) // ควรดื่มทยอยตลอดวัน 07:00–21:00
  const pace = !isToday ? '' : water >= wg ? 'ดื่มครบเป้าแล้ว เก่งมาก' : expected - water >= 1
    ? `ตอนนี้ควรดื่มแล้วราว ${Math.round(expected * ML).toLocaleString()} มล. ตามอยู่ ${Math.round((expected - water) * ML)} มล. ดื่มสักแก้วเลย`
    : 'จังหวะดี ดื่มต่อเนื่องตลอดวัน อย่ารอจนกระหาย'

  return (
    <details className="card nutri" open={isToday}>
      <summary className="row between" style={{ cursor: 'pointer', minHeight: 44 }}>
        <h2>อาหารและน้ำ</h2>
        <span className="mute sm">{Math.round(water * ML).toLocaleString()}/{(wg * ML).toLocaleString()} มล. · {Math.round(f.kcal || 0).toLocaleString()}/{t.kcal.toLocaleString()} kcal</span>
      </summary>
      <div className="col" style={{ gap: '1.25rem', marginTop: '1rem' }}>
        <section className="col" style={{ gap: '0.5rem' }}>
          <Bar icon={Droplets} label="น้ำดื่ม" value={water * ML} goal={wg * ML} unit="มล." />
          <div className="drinks">
            <button className="btn sm" aria-label="ลดน้ำ 250 มล." onClick={() => drink(-ML)}><Minus /></button>
            {[250, 500, 600].map((ml) => <button key={ml} className="btn sm" onClick={() => drink(ml)}><Plus /> {ml}</button>)}
          </div>
          <p className="hint">{train ? (isToday ? `วันนี้วันฝึก เป้าน้ำ +500 มล. ดื่ม 400–600 มล. ก่อนฝึก 2 ชม. และจิบระหว่างฝึก · ` : 'วันฝึก เป้าน้ำ +500 มล.') : ''}{pace}</p>
        </section>

        <section className="col" style={{ gap: '0.75rem' }}>
          <Bar icon={Zap} label="พลังงาน" value={f.kcal || 0} goal={t.kcal} unit="kcal" over />
          <Bar icon={Beef} label="โปรตีน" value={f.protein || 0} goal={proteinGoal} unit="g" />
          <Bar icon={Wheat} label="คาร์บ" value={f.carb || 0} goal={t.carb} unit="g" />
          <Bar icon={Droplet} label="ไขมัน" value={f.fat || 0} goal={t.fat} unit="g" over />
          <Bar icon={Soup} label="โซเดียม" value={sodiumNow} goal={t.sodium} unit="มก." limit />
          <p className="hint">เหลือ {remK > 0 ? `${remK.toLocaleString()} kcal` : 'พลังงานเกินเป้าแล้ว'} · โปรตีนอีก {Math.max(0, remP)} g · เป้าของคุณคำนวณจาก BMI อายุ และเป้าหมาย (ดูรายละเอียดที่หน้า “ฉัน”)</p>
          <p className="hint">{sodiumNow >= t.sodium ? 'โซเดียมเกินเป้าแล้ว มื้อต่อไปลดน้ำซุป น้ำจิ้ม และเครื่องปรุง · ' : ''}โซเดียมเป็นค่าประมาณจากเมนู ไม่รวมเกลือหรือน้ำปลาที่เติมเองถ้าไม่ได้เพิ่มรายการ (เพิ่มได้ที่ “เพิ่มรายละเอียด”)</p>
        </section>

        {sugg.length > 0 && (
          <section className="nudge sugg-box">
            <span className="row" style={{ gap: '0.5rem' }}><Lightbulb aria-hidden="true" /> <b>โปรตีนยังขาด {Math.max(0, remP)} g ลองกิน</b></span>
            <span className="sugg">
              {sugg.map((x) => <button key={x.id} className="btn sm" onClick={() => add(x, 1)}><span className="row" style={{ gap: '0.5rem' }}><Plus /> {x.n}</span><span className="mute">+{x.p} g</span></button>)}
            </span>
          </section>
        )}

        <section className="col" style={{ gap: '0.625rem' }}>
          <h3>เพิ่มอาหาร</h3>
          <Seg label="มื้อ" value={slot} onChange={setSlot} options={SLOTS} />
          <div className="search">
            <Search aria-hidden="true" />
            <input className="input" type="search" placeholder="ค้นหาอาหาร เช่น ข้าวมันไก่" aria-label="ค้นหาอาหาร" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!key && (
            <div className="chips" role="group" aria-label="หมวดอาหาร">
              {recents.length > 0 && <button aria-pressed={tab === 'recent'} onClick={() => setCat('recent')}>กินบ่อย</button>}
              {mine.length > 0 && <button aria-pressed={tab === 'mine'} onClick={() => setCat('mine')}>เมนูของฉัน</button>}
              {FOOD_CATS.map(([k, label]) => <button key={k} aria-pressed={tab === k} onClick={() => setCat(k)}>{label}</button>)}
            </div>
          )}
          <div className="foods">
            {shown.map((x) => (
              <button key={x.id} className="food" onClick={() => { setEdit(null); setSel(x) }}>
                <b>{x.n}</b>
                <span className="mute xs">{x.u}</span>
                <span className="xs"><b className="num">{x.k}</b> kcal · P {x.p}</span>
                <span className="mute xs">โซเดียม {sodiumOf(x).toLocaleString()} มก.</span>
              </button>
            ))}
            {!shown.length && <p className="mute sm">ไม่พบอาหาร ลองกรอกเองด้านล่าง</p>}
          </div>
          <details>
            <summary className="more">กรอกเอง (ฉลากอาหาร / เมนูอื่น / ชั่งเอง)</summary>
            <div className="col" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
              <Seg label="ฐานของค่าที่กรอก" value={custom.mode} onChange={(mode) => setCustom({ ...custom, mode })} options={[['all', 'ทั้งหมดที่กิน'], ['100', 'ต่อ 100 g (ตามฉลาก)']]} />
              <input className="input" placeholder="ชื่ออาหาร" aria-label="ชื่ออาหาร" value={custom.n} onChange={(e) => setCustom({ ...custom, n: e.target.value })} maxLength={40} />
              {custom.mode === '100' && <p className="hint">ใส่ค่า <b>ต่อ 100 g</b> ตามที่ฉลากระบุ แล้วใส่น้ำหนักที่ชั่งได้ ระบบคำนวณให้</p>}
              <div className="two">
                {[['k', 'พลังงาน (kcal)'], ['p', 'โปรตีน (g)'], ['c', 'คาร์บ (g)'], ['f', 'ไขมัน (g)']].map(([k, label]) => (
                  <input key={k} className="input" type="number" inputMode="decimal" min="0" placeholder={label} aria-label={custom.mode === '100' ? `${label} ต่อ 100 กรัม` : label} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} />
                ))}
              </div>
              <input className="input" type="number" inputMode="decimal" min="0" placeholder="โซเดียม (มก.) ถ้ารู้ เว้นว่างได้" aria-label={custom.mode === '100' ? 'โซเดียม มิลลิกรัม ต่อ 100 กรัม' : 'โซเดียม มิลลิกรัม'} value={custom.na} onChange={(e) => setCustom({ ...custom, na: e.target.value })} />
              {custom.mode === '100' && <input className="input" type="number" inputMode="decimal" min="0" placeholder="น้ำหนักที่ชั่ง (g)" aria-label="น้ำหนักที่ชั่ง กรัม" value={custom.g} onChange={(e) => setCustom({ ...custom, g: e.target.value })} />}
              {cp.k > 0 && <p className="hint">รวมที่จะบันทึก: <b>{Math.round(cp.k * cp.m)}</b> kcal · โปรตีน {r1(cp.p * cp.m)} g · คาร์บ {r1(cp.c * cp.m)} g · ไขมัน {r1(cp.f * cp.m)} g{cp.na > 0 && ` · โซเดียม ${Math.round(cp.na * cp.m).toLocaleString()} มก.`}</p>}
              <label className="check"><input type="checkbox" checked={custom.save} onChange={(e) => setCustom({ ...custom, save: e.target.checked })} /> บันทึกเป็น “เมนูของฉัน” (ใช้ซ้ำได้ ชั่งเป็นกรัมได้เลย)</label>
              <button className="btn sm" onClick={addCustom}><Plus /> เพิ่ม</button>
            </div>
          </details>
        </section>

        <section className="col eaten" style={{ gap: '0.625rem' }}>
          <div className="row between">
            <h3>{isToday ? 'กินไปแล้ววันนี้' : 'กินไปแล้วในวันนี้ที่เลือก'}</h3>
            {items.length > 0 && <span className="mute xs"><b className="num" style={{ fontSize: '1.125rem', color: 'var(--text)' }}>{items.reduce((n, it) => n + it.k, 0).toLocaleString()}</b> kcal · {items.length} รายการ</span>}
          </div>
          {items.length === 0 && extraK <= 5 && <p className="mute sm">ยังไม่ได้บันทึก แตะอาหารด้านบนเพื่อเพิ่ม</p>}
          {extraK > 5 && (
            <div className="meal extra">
              <div className="meal-h"><b>ยอดที่บันทึกไว้ (ไม่มีรายการ)</b><span className="mute xs"><b className="num meal-k">{extraK.toLocaleString()}</b> kcal</span></div>
              <p className="meal-m xs mute">มาจากการกรอกยอดรวมแบบเดิม นับรวมในยอดของวันอยู่ ถ้าไม่ต้องการ ล้างออกได้</p>
              <div style={{ padding: '0.5rem 0.875rem 0.75rem' }}><button type="button" className="btn sm" onClick={clearExtra}><X /> ล้างยอดนี้</button></div>
            </div>
          )}
          {MEAL_SLOTS.map(([name], si) => {
            const rows = items.map((it, i) => [it, i]).filter(([it]) => (it.s ?? 1) === si)
            if (!rows.length) return null
            const sum = (k) => r1(rows.reduce((n, [it]) => n + (it[k] || 0), 0))
            return (
              <div key={name} className="meal">
                <div className="meal-h">
                  <b>{name}</b>
                  <span className="mute xs"><b className="num meal-k">{Math.round(sum('k')).toLocaleString()}</b> kcal</span>
                </div>
                <div className="meal-m xs mute">โปรตีน {sum('p')} g · คาร์บ {sum('c')} g · ไขมัน {sum('f')} g · โซเดียม {rows.reduce((n, [it]) => n + itemSodium(it, byId), 0).toLocaleString()} มก.</div>
                <ul className="meal-l">
                  {rows.map(([it, i]) => (
                    <EatRow key={i} it={it} food={byId[it.id]} na={itemSodium(it, byId)} onEdit={() => openEdit(it, i)} onDelete={() => removeFood(date, i)} />
                  ))}
                </ul>
              </div>
            )
          })}
          <p className="hint">ค่าสารอาหารเป็นค่าประมาณต่อหน่วยบริโภคทั่วไป ปริมาณจริงต่างกันได้ ใช้เป็นแนวทาง ไม่ต้องแม่นทุกกรัม ขอให้ใกล้เคียงและสม่ำเสมอ</p>
        </section>
        <Sheet open={!!sel} onClose={closeSheet} title={sel ? (edit ? `แก้ไข ${sel.n}` : sel.n) : ''}>
          {sel && <QtyPicker key={`${sel.id}-${edit?.i ?? 'new'}`} food={sel} slot={edit ? edit.s : slot} setSlot={edit ? (s) => setEdit({ ...edit, s }) : setSlot} init={edit?.init} last={edit ? undefined : lastAmt(sel.id)} onDelete={edit ? deleteEdit : undefined} onDeleteFood={!edit && sel.cat === 'mine' ? () => { removeMyFood(sel.id); toast?.(`ลบ ${sel.n} ออกจากเมนูของฉันแล้ว`); closeSheet() } : undefined} label={edit ? 'บันทึก' : 'เพิ่ม'} onAdd={(q, a, w, x) => { (edit ? saveEdit : add)(sel, q, a, w, x); closeSheet() }} />}
        </Sheet>
      </div>
    </details>
  )
}
